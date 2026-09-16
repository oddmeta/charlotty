/**
 * Electron 主进程
 * - 启动本地 HTTP 服务器
 * - 创建透明无边框窗口
 * - 处理 IPC 通信
 */

const { app, BrowserWindow, ipcMain, screen, shell, session, dialog, Tray, Menu } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 手动加载 .env 文件（不依赖 dotenv 包，兼容打包环境）
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
    console.log('[环境配置] 已加载 .env 文件');
  }
}
loadEnvFile();

let metaYayBase = 'http://127.0.0.1:8000'; // metayay 服务地址（可通过设置修改）
let customModelsDir = null; // 用户自定义模型目录
const CONFIG_PATH = path.join(app.getPath('userData'), 'pet-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.base_url) {
        metaYayBase = config.base_url;
        console.log('[配置] 已加载后端地址:', metaYayBase);
      }
      if (config.customModelsDir && fs.existsSync(config.customModelsDir)) {
        customModelsDir = config.customModelsDir;
        console.log('[配置] 已加载自定义模型目录:', customModelsDir);
      }
    }
  } catch (e) {
    console.log('[配置] 加载失败:', e.message);
  }
}

function saveConfig(config) {
  try {
    // 合并已有配置
    let existing = {};
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch (e) {}
    const merged = { ...existing, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {
    console.log('[配置] 保存失败:', e.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.moc3': 'application/octet-stream',
  '.motion3.json': 'application/json',
  '.exp3.json': 'application/json',
  '.physics3.json': 'application/json',
  '.pose3.json': 'application/json',
  '.userdata3.json': 'application/json',
  '.cdi3.json': 'application/json',
  '.model3.json': 'application/json',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  // 处理 .model3.json 这样的复合扩展名
  if (filePath.endsWith('.model3.json')) return 'application/json';
  if (filePath.endsWith('.motion3.json')) return 'application/json';
  if (filePath.endsWith('.exp3.json')) return 'application/json';
  if (filePath.endsWith('.physics3.json')) return 'application/json';
  if (filePath.endsWith('.pose3.json')) return 'application/json';
  if (filePath.endsWith('.userdata3.json')) return 'application/json';
  if (filePath.endsWith('.cdi3.json')) return 'application/json';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      let urlPath = decodeURIComponent(req.url.split('?')[0]);

      // 路径映射
      let baseDir;
      if (urlPath.startsWith('/models/')) {
        // 如果自定义模型目录存在且有效，使用自定义目录；否则使用默认目录
        baseDir = (customModelsDir && fs.existsSync(customModelsDir)) 
          ? customModelsDir 
          : path.join(__dirname, '..', 'media', 'live2d', 'models');
        urlPath = urlPath.substring('/models/'.length);
      } else {
        baseDir = __dirname;
        urlPath = urlPath.substring(1); // remove leading /
      }

      let filePath = path.join(baseDir, urlPath);
      if (urlPath === '' || urlPath.endsWith('/')) {
        filePath = path.join(filePath, 'index.html');
      }

      // 安全检查：防止目录遍历
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDir);
      if (!resolvedPath.startsWith(resolvedBase)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.log(`[HTTP 404] ${req.url}`);
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[服务器] 已启动: http://127.0.0.1:${port}`);
      resolve(port);
    });

    server.on('error', reject);
  });
}

let mainWindow;
let tray = null;
let originalBounds = null;
let modelSize = null;
let inPanelMode = false;
let originalPetBounds = null;
let isHidden = false;
let hiddenEdge = null;
const EDGE_THRESHOLD = 30;

// ── Toast 独立窗口 ──
let toastWindow = null;
let toastQueue = [];
let toastHideTimer = null;

// ── 靠边隐藏参数 ──
const TAB_W = 18;
const TAB_H = 90;
const PREVIEW_W = 110;
const PREVIEW_H = 150;
const ANIM_HIDE = 280;
const ANIM_PREVIEW = 220;
const ANIM_RESTORE = 300;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateWindow(fromX, fromY, fromW, fromH, toX, toY, toW, toH, dur, cb) {
  const t0 = Date.now();
  (function step() {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const e = easeOutCubic(p);
    mainWindow.setBounds({
      x: Math.round(fromX + (toX - fromX) * e),
      y: Math.round(fromY + (toY - fromY) * e),
      width: Math.round(fromW + (toW - fromW) * e),
      height: Math.round(fromH + (toH - fromH) * e),
    });
    if (p < 1) setTimeout(step, 16);
    else if (cb) cb();
  })();
}

function getTabBounds(edge, workArea, windowBounds) {
  const cy = windowBounds.y + windowBounds.height / 2;
  const cx = windowBounds.x + windowBounds.width / 2;
  switch (edge) {
    case 'left': {
      let y = Math.round(cy - TAB_H / 2);
      y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - TAB_H));
      return { x: workArea.x, y, w: TAB_W, h: TAB_H };
    }
    case 'right': {
      let y = Math.round(cy - TAB_H / 2);
      y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - TAB_H));
      return { x: workArea.x + workArea.width - TAB_W, y, w: TAB_W, h: TAB_H };
    }
    case 'top': {
      let x = Math.round(cx - TAB_H / 2);
      x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - TAB_H));
      return { x, y: workArea.y, w: TAB_H, h: TAB_W };
    }
    case 'bottom': {
      let x = Math.round(cx - TAB_H / 2);
      x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - TAB_H));
      return { x, y: workArea.y + workArea.height - TAB_W, w: TAB_H, h: TAB_W };
    }
  }
}

function getPreviewBounds(edge, workArea, currentBounds) {
  switch (edge) {
    case 'left': {
      let y = currentBounds.y;
      if (y + PREVIEW_H > workArea.y + workArea.height) y = workArea.y + workArea.height - PREVIEW_H;
      if (y < workArea.y) y = workArea.y;
      return { x: workArea.x, y, w: PREVIEW_W, h: PREVIEW_H };
    }
    case 'right': {
      let y = currentBounds.y;
      if (y + PREVIEW_H > workArea.y + workArea.height) y = workArea.y + workArea.height - PREVIEW_H;
      if (y < workArea.y) y = workArea.y;
      return { x: workArea.x + workArea.width - PREVIEW_W, y, w: PREVIEW_W, h: PREVIEW_H };
    }
    case 'top': {
      let x = currentBounds.x;
      if (x + PREVIEW_H > workArea.x + workArea.width) x = workArea.x + workArea.width - PREVIEW_H;
      if (x < workArea.x) x = workArea.x;
      return { x, y: workArea.y, w: PREVIEW_H, h: PREVIEW_W };
    }
    case 'bottom': {
      let x = currentBounds.x;
      if (x + PREVIEW_H > workArea.x + workArea.width) x = workArea.x + workArea.width - PREVIEW_H;
      if (x < workArea.x) x = workArea.x;
      return { x, y: workArea.y + workArea.height - PREVIEW_W, w: PREVIEW_H, h: PREVIEW_W };
    }
  }
}

// 检测窗口是否贴近屏幕边缘，返回最近边缘或 null
function checkEdgeSnap(bounds) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const distances = {
    left: bounds.x - workArea.x,
    right: (workArea.x + workArea.width) - (bounds.x + bounds.width),
    top: bounds.y - workArea.y,
    bottom: (workArea.y + workArea.height) - (bounds.y + bounds.height),
  };
  let nearestEdge = null;
  let minDist = Infinity;
  for (const [edge, dist] of Object.entries(distances)) {
    if (dist < minDist) {
      minDist = dist;
      nearestEdge = edge;
    }
  }
  return minDist <= EDGE_THRESHOLD ? nearestEdge : null;
}

// 隐藏到指定边缘（动画滑入）
function hideToEdge(edge) {
  if (!mainWindow || isHidden) return;
  const bounds = mainWindow.getBounds();
  originalBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  const workArea = screen.getPrimaryDisplay().workArea;
  const t = getTabBounds(edge, workArea, bounds);
  isHidden = true;
  hiddenEdge = edge;
  animateWindow(bounds.x, bounds.y, bounds.width, bounds.height, t.x, t.y, t.w, t.h, ANIM_HIDE, () => {
    mainWindow.setShape([{ x: 0, y: 0, width: t.w, height: t.h }]);
    mainWindow.webContents.send('pet-hidden', { edge });
    console.log('[隐藏] 吸附到 ' + edge + ':', { x: t.x, y: t.y, w: t.w, h: t.h });
  });
}

async function createWindow() {
  const port = await startServer();

  mainWindow = new BrowserWindow({
    width: 420,
    height: 520,
    x: screen.getPrimaryDisplay().workArea.width - 440,
    y: screen.getPrimaryDisplay().workArea.height - 540,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true, // 允许调整大小（由 resize-window IPC 控制）
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    show: false, // 先隐藏，等加载完成再显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);

  // 窗口大小变化时自动同步 shape
  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getSize();
    setTimeout(() => {
      mainWindow.setShape([{ x: 0, y: 0, width: w, height: h }]);
    }, 0);
  });

  // 加载完成后注入透明背景 CSS，再显示窗口
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('html, body { background: transparent !important; }');
    mainWindow.show();
    console.log('[桌宠] 已启动！拖拽窗口移动，点击模型互动，右键退出');
    
    // 启用开发者工具以查看调试日志
    if (process.env.DEBUG_MODE === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      console.log('[桌宠] 开发者工具已打开');
    }
    
    // 监听渲染进程的控制台输出，将其转发到主进程控制台
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[前端日志] ${message}`);
    });

// 创建系统托盘
    createTray();
  });
  
  // 页面卸载前保存设置，由渲染进程处理

  // IPC: 移动窗口
  // 注意：不用 setPosition，因为 Windows 下 transparent+frameless 窗口
  // 调用 setPosition 会导致 DWM 重新计算客户端区域，尺寸逐渐漂移。
  // 改用 setBounds 并始终固定大小为 modelSize。
  ipcMain.on('move-window', (event, dx, dy) => {
    const bounds = mainWindow.getBounds();
    // 始终使用固定的尺寸，避免透明无边框窗口的尺寸漂移问题
    // Windows 下 getBounds() 可能返回累积误差的尺寸，必须用固定值
    if (inPanelMode) {
      // 面板模式下使用固定的面板尺寸（540x640）
      const panelW = 540;
      const panelH = 640;
      mainWindow.setBounds({
        x: bounds.x + dx,
        y: bounds.y + dy,
        width: panelW,
        height: panelH,
      });
    } else {
      const fixedWidth = modelSize ? modelSize.width : 420;
      const fixedHeight = modelSize ? modelSize.height : 520;
      mainWindow.setBounds({
        x: bounds.x + dx,
        y: bounds.y + dy,
        width: fixedWidth,
        height: fixedHeight,
      });
    }
  });

  // IPC: 进入面板扩展模式（窗口放大并移到屏幕中央）
  ipcMain.on('enter-panel-mode', (event, width, height) => {
    if (inPanelMode || !mainWindow) return;
    const bounds = mainWindow.getBounds();
    originalPetBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    const display = screen.getPrimaryDisplay().workArea;
    const w = width || 540;
    const h = height || 640;
    const x = Math.round(display.x + (display.width - w) / 2);
    const y = Math.round(display.y + (display.height - h) / 2);
    inPanelMode = true;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setBounds({ x, y, width: w, height: h });
    console.log('[面板模式] 进入:', { x, y, width: w, height: h });
  });

  // IPC: 退出面板扩展模式（恢复原始窗口大小和位置）
  ipcMain.on('exit-panel-mode', () => {
    if (!inPanelMode || !mainWindow) return;
    const bounds = originalPetBounds || { x: 200, y: 200, width: 420, height: 520 };
    const workArea = screen.getPrimaryDisplay().workArea;
    let { x, y } = bounds;
    // 如果有 modelSize，说明模型已加载且可能调整过大小，使用 modelSize 作为恢复大小
    const width = modelSize ? modelSize.width : bounds.width;
    const height = modelSize ? modelSize.height : bounds.height;
    // 边界保护（使用绝对坐标）
    const margin = 50;
    const minX = workArea.x + margin;
    const maxX = workArea.x + workArea.width - margin - width;
    const minY = workArea.y + margin;
    const maxY = workArea.y + workArea.height - margin - height;
    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(minY, Math.min(y, maxY));
    inPanelMode = false;
    originalPetBounds = null;
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setBounds({ x, y, width, height });
    console.log('[面板模式] 退出，恢复:', { x, y, width, height });
  });

  // IPC: 获取屏幕工作区信息（供行走功能使用）
  ipcMain.handle('get-screen-info', () => {
    const display = screen.getPrimaryDisplay();
    return display.workArea;
  });

  // IPC: 自动移动窗口到目标位置（行走功能，带缓动动画）
  let autoMoveAnim = null;
  ipcMain.on('auto-move-to', (event, targetX, targetY, duration) => {
    if (!mainWindow || inPanelMode || isHidden) return;
    if (autoMoveAnim) { clearTimeout(autoMoveAnim); autoMoveAnim = null; }
    const bounds = mainWindow.getBounds();
    const fromX = bounds.x;
    const fromY = bounds.y;
    const w = modelSize ? modelSize.width : bounds.width;
    const h = modelSize ? modelSize.height : bounds.height;
    const dur = duration || 2000;
    const t0 = Date.now();
    function step() {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const e = easeOutCubic(p);
      mainWindow.setBounds({
        x: Math.round(fromX + (targetX - fromX) * e),
        y: Math.round(fromY + (targetY - fromY) * e),
        width: w,
        height: h,
      });
      if (p < 1) {
        autoMoveAnim = setTimeout(step, 16);
      } else {
        autoMoveAnim = null;
        mainWindow.webContents.send('auto-move-finished');
      }
    }
    step();
  });

  // IPC: 停止自动移动
  ipcMain.on('auto-move-stop', () => {
    if (autoMoveAnim) { clearTimeout(autoMoveAnim); autoMoveAnim = null; }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-move-finished');
    }
  });

  // IPC: 关闭窗口
  ipcMain.on('close-window', () => {
    app.quit();
  });

  // IPC: 调整大小（同时记录模型尺寸，用于恢复时避免误差累积）
  ipcMain.on('resize-window', (event, width, height) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // 使用 setBounds 确保尺寸正确应用（Windows 下更可靠）
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: width,
      height: height,
    });
    modelSize = { width, height };
    // 同步更新 shape 以匹配新尺寸
    mainWindow.setShape([{ x: 0, y: 0, width: width, height: height }]);
    console.log('[窗口] 调整大小为 ' + width + 'x' + height);
  });

  // IPC: 验证窗口尺寸（防止 DWM 漂移）
  ipcMain.on('verify-window-size', (event, width, height) => {
    if (!mainWindow || mainWindow.isDestroyed() || inPanelMode || isHidden) return;
    const currentSize = mainWindow.getSize();
    if (currentSize[0] !== width || currentSize[1] !== height) {
      console.log(`[窗口验证] 尺寸不匹配，修正: 当前=${currentSize[0]}x${currentSize[1]}, 期望=${width}x${height}`);
      mainWindow.setSize(width, height);
      modelSize = { width, height };
    }
  });

  // IPC: 隐藏到边缘（支持指定边缘，未指定则自动检测最近边缘）
  ipcMain.on('hide-pet', (event, edge) => {
    if (!edge) {
      const bounds = mainWindow.getBounds();
      edge = checkEdgeSnap(bounds) || 'right';
    }
    hideToEdge(edge);
  });

  // IPC: 拖动结束后尝试边缘吸附
  ipcMain.on('try-snap-to-edge', () => {
    if (isHidden || inPanelMode || !mainWindow) return;
    const bounds = mainWindow.getBounds();
    const edge = checkEdgeSnap(bounds);
    if (edge) {
      hideToEdge(edge);
    }
  });

  // IPC: 隐藏状态下沿边缘拖动tab
  ipcMain.on('move-hidden-tab', (event, dx, dy) => {
    if (!isHidden || !mainWindow) return;
    const bounds = mainWindow.getBounds();
    const workArea = screen.getPrimaryDisplay().workArea;
    const isVert = hiddenEdge === 'left' || hiddenEdge === 'right';
    const tabW = isVert ? TAB_W : TAB_H;
    const tabH = isVert ? TAB_H : TAB_W;
    let x = bounds.x + dx;
    let y = bounds.y + dy;
    if (isVert) {
      x = bounds.x;
      y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - tabH));
    } else {
      y = bounds.y;
      x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - tabW));
    }
    mainWindow.setBounds({ x, y, width: tabW, height: tabH });
  });

  // IPC: 隐藏状态下鼠标悬停 → 展开预览
  ipcMain.on('hover-preview', () => {
    if (!isHidden || !mainWindow) return;
    const bounds = mainWindow.getBounds();
    const workArea = screen.getPrimaryDisplay().workArea;
    const p = getPreviewBounds(hiddenEdge, workArea, bounds);
    animateWindow(bounds.x, bounds.y, bounds.width, bounds.height, p.x, p.y, p.w, p.h, ANIM_PREVIEW, () => {
      mainWindow.setShape([{ x: 0, y: 0, width: p.w, height: p.h }]);
    });
  });

  // IPC: 隐藏状态下鼠标离开 → 收回tab
  ipcMain.on('leave-preview', () => {
    if (!isHidden || !mainWindow) return;
    const bounds = mainWindow.getBounds();
    const workArea = screen.getPrimaryDisplay().workArea;
    const t = getTabBounds(hiddenEdge, workArea, bounds);
    animateWindow(bounds.x, bounds.y, bounds.width, bounds.height, t.x, t.y, t.w, t.h, ANIM_PREVIEW, () => {
      mainWindow.setShape([{ x: 0, y: 0, width: t.w, height: t.h }]);
    });
  });

  // IPC: 恢复显示（动画滑出）
  ipcMain.on('show-pet', () => {
    if (!isHidden) {
      // 已经处于显示状态，直接忽略请求，避免状态不同步导致的无限循环
      return;
    }
    if (!originalBounds) {
      console.log('[恢复] 错误: originalBounds 为空，尝试从当前窗口边界恢复');
      if (mainWindow && !mainWindow.isDestroyed()) {
        originalBounds = mainWindow.getBounds();
        console.log('[恢复] 已从当前边界恢复 originalBounds:', originalBounds);
      } else {
        console.log('[恢复] 主窗口已销毁，无法恢复');
        return;
      }
    }
    const bounds = mainWindow.getBounds();
    const workArea = screen.getPrimaryDisplay().workArea;
    let { x, y, width, height } = originalBounds;
    // 确保恢复后的位置远离所有边缘，避免立即触发自动隐藏
    // 使用较大的安全边距（至少100px），确保不会误触发靠边隐藏（EDGE_THRESHOLD=30）
    const safeMargin = 100;
    // 检查并修正左边距
    if (x < workArea.x + safeMargin) {
      x = workArea.x + safeMargin;
    }
    // 检查并修正右边距
    if (x + width > workArea.x + workArea.width - safeMargin) {
      x = workArea.x + workArea.width - safeMargin - width;
    }
    // 检查并修正上边距
    if (y < workArea.y + safeMargin) {
      y = workArea.y + safeMargin;
    }
    // 检查并修正下边距
    if (y + height > workArea.y + workArea.height - safeMargin) {
      y = workArea.y + workArea.height - safeMargin - height;
    }
    // 确保坐标在有效范围内
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));
    
    console.log('[恢复] 开始恢复动画:', {
      from: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height },
      to: { x, y, width, height }
    });
    
    isHidden = false;
    hiddenEdge = null;
    animateWindow(bounds.x, bounds.y, bounds.width, bounds.height, x, y, width, height, ANIM_RESTORE, () => {
      mainWindow.setShape([{ x: 0, y: 0, width, height }]);
      mainWindow.webContents.send('pet-shown');
      console.log('[恢复] 完成，目标位置:', { x, y, width, height });
    });
  });

  // ========== 认证相关 IPC ==========

  // IPC: 获取指定 URL 的 cookies（供前端 WebSocket 认证使用）
  ipcMain.handle('get-cookies', async (event, url) => {
    try {
      const cookies = await session.defaultSession.cookies.get({ url: url || metaYayBase });
      return cookies.map(c => ({ name: c.name, value: c.value }));
    } catch (e) {
      console.log('[get-cookies] 获取 cookie 失败:', e.message);
      return [];
    }
  });

  // IPC: 检查登录状态（携带 Electron session cookie）
  ipcMain.handle('check-auth', async () => {
    return new Promise(async (resolve) => {
      // 从 Electron defaultSession 获取 cookie
      let cookieHeader = '';
      try {
        const cookies = await session.defaultSession.cookies.get({ url: metaYayBase });
        cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      } catch (e) {
        console.log('[check-auth] 获取 cookie 失败:', e.message);
      }

      const options = {
        headers: cookieHeader ? { 'Cookie': cookieHeader } : {},
        timeout: 5000,
      };

      const client = metaYayBase.startsWith('https') ? https : http;
      const req = client.get(`${metaYayBase}/api/auth/status/`, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ ok: true, ...json });
          } catch {
            resolve({ ok: false, error: '解析失败' });
          }
        });
      });
      req.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '超时' }); });
    });
  });

  // IPC: 打开登录窗口
  ipcMain.on('open-login', () => {
    const loginWin = new BrowserWindow({
      width: 520,
      height: 640,
      title: '登录 - 小落同学',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    loginWin.loadURL(`${metaYayBase}/admin/login`);
    // 登录成功后（跳转到 admin 首页），自动关闭登录窗口
    loginWin.webContents.on('did-navigate', (event, url) => {
      if (url.includes('/admin/') && !url.includes('/admin/login')) {
        setTimeout(() => loginWin.close(), 800);
        // 通知主窗口刷新登录状态
        if (mainWindow) {
          mainWindow.webContents.send('auth-changed');
        }
      }
    });
  });

  // IPC: 退出登录
  ipcMain.on('logout', () => {
    const logoutWin = new BrowserWindow({
      width: 400,
      height: 300,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    logoutWin.loadURL(`${metaYayBase}/admin/logout`);
    logoutWin.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        logoutWin.close();
        // 通知主窗口刷新登录状态
        if (mainWindow) {
          mainWindow.webContents.send('auth-changed');
        }
      }, 1000);
    });
  });

  // IPC: 用系统浏览器打开 URL
  ipcMain.handle('open-external', (event, url) => {
    const fullUrl = url && url.startsWith('http') ? url : `${metaYayBase}${url || '/'}`;
    shell.openExternal(fullUrl);
  });

  // IPC: 获取/设置 metayay 后端地址
  ipcMain.handle('get-metayay-base', () => metaYayBase);
  ipcMain.on('set-metayay-base', (event, url) => {
    if (url && url.startsWith('http')) {
      metaYayBase = url.replace(/\/$/, '');
      saveConfig({ metaYayBase });
      console.log('[设置] metayay 后端地址已更新为:', metaYayBase);
      // 通知渲染进程后端地址已变更，需要重连 WebSocket
      event.sender.send('metayay-base-changed', metaYayBase);
    }
  });

  // ========== 模型管理 IPC ==========

  // IPC: 获取当前自定义模型目录
  ipcMain.handle('get-custom-models-dir', () => customModelsDir);

  // IPC: 设置自定义模型目录
  ipcMain.on('set-custom-models-dir', (event, dirPath) => {
    customModelsDir = dirPath || null;
    saveConfig({ customModelsDir });
    console.log('[设置] 自定义模型目录:', customModelsDir || '(恢复默认)');
  });
  
  // IPC: 保存所有桌宠设置到配置文件
  ipcMain.handle('save-all-settings', async (event, settings) => {
    try {
      saveConfig(settings);
      console.log('[设置] 保存所有设置到配置文件:', JSON.stringify(settings));
      return { success: true };
    } catch (error) {
      console.log('[设置] 保存配置文件失败:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // IPC: 获取所有保存的设置
  ipcMain.handle('get-all-settings', async () => {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        console.log('[设置] 从配置文件读取设置:', JSON.stringify(config));
        return config;
      }
      return {};
    } catch (e) {
      console.log('[设置] 读取配置文件失败:', e.message);
      return {};
    }
  });

  // IPC: 打开目录选择对话框
  ipcMain.handle('open-dir-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择 Live2D 模型目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // IPC: 扫描目录中的 Live2D 模型
  ipcMain.handle('list-models', async (event, dirPath) => {
    const modelsDir = dirPath || customModelsDir || path.join(__dirname, '..', 'media', 'live2d', 'models');
    const models = [];
    try {
      if (!fs.existsSync(modelsDir)) return models;
      const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderPath = path.join(modelsDir, entry.name);
        // 查找模型文件，优先级：.model3.json > index.json > model.json
        const files = fs.readdirSync(folderPath);
        let model3File = files.find(f => f.endsWith('.model3.json'));
        if (!model3File) {
          model3File = files.find(f => f === 'index.json');
        }
        if (!model3File) {
          model3File = files.find(f => f === 'model.json');
        }
        if (model3File) {
          const modelJsonPath = path.join(folderPath, model3File);
          let displayName = entry.name;
          try {
            const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
            if (modelJson.FileReferences && modelJson.FileReferences.Moc) {
              // 从 moc 文件名推断显示名
              const mocName = path.basename(modelJson.FileReferences.Moc, '.moc3');
              displayName = mocName || entry.name;
            }
          } catch (e) {}
          // 尝试读取缩略图
          let thumbnail = null;
          const texFiles = files.filter(f => f.endsWith('.png'));
          if (texFiles.length > 0) {
            thumbnail = '/models/' + entry.name + '/' + texFiles[0];
          }
          models.push({
            name: entry.name,
            displayName: displayName,
            modelPath: '/models/' + entry.name + '/' + model3File,
            thumbnail: thumbnail,
          });
        }
      }
    } catch (e) {
      console.log('[模型扫描] 错误:', e.message);
    }
    return models;
  });

  // IPC: 从后端获取远程模型列表
  ipcMain.handle('fetch-remote-models', async () => {
    return new Promise(async (resolve) => {
      let cookieHeader = '';
      try {
        const cookies = await session.defaultSession.cookies.get({ url: metaYayBase });
        cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      } catch (e) {
        console.log('[远程模型] 获取 cookie 失败:', e.message);
      }

      const url = new URL('/admin/api/live2d/model/list', metaYayBase);
      const client = url.protocol === 'https:' ? https : http;
      const options = {
        method: 'GET',
        headers: {},
        timeout: 30000,
      };
      if (cookieHeader) options.headers['Cookie'] = cookieHeader;

      console.log('[远程模型] 请求列表:', url.toString());
      const req = client.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            console.log('[远程模型] 获取到', (json.models || []).length, '个模型');
            resolve({ ok: true, models: json.models || [] });
          } catch (e) {
            console.log('[远程模型] 解析响应失败:', e.message);
            resolve({ ok: false, error: '响应解析失败' });
          }
        });
      });
      req.on('error', (err) => {
        console.log('[远程模型] 请求失败:', err.message);
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '超时' }); });
      req.end();
    });
  });

  // IPC: 从后端下载模型 zip 并解压到本地模型目录
  ipcMain.handle('download-remote-model', async (event, { modelId, modelName }) => {
    return new Promise(async (resolve) => {
      let cookieHeader = '';
      try {
        const cookies = await session.defaultSession.cookies.get({ url: metaYayBase });
        cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      } catch (e) {
        console.log('[模型下载] 获取 cookie 失败:', e.message);
      }

      const url = new URL('/admin/api/live2d/model/download/' + modelId, metaYayBase);
      const client = url.protocol === 'https:' ? https : http;
      const options = {
        method: 'GET',
        headers: {},
        timeout: 120000,
      };
      if (cookieHeader) options.headers['Cookie'] = cookieHeader;

      console.log('[模型下载] 开始下载:', url.toString());
      const req = client.request(url, options, (res) => {
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            console.log('[模型下载] 下载失败, HTTP', res.statusCode);
            resolve({ ok: false, error: 'HTTP ' + res.statusCode });
          });
          return;
        }

        const modelsDir = customModelsDir || path.join(__dirname, '..', 'media', 'live2d', 'models');
        if (!fs.existsSync(modelsDir)) {
          fs.mkdirSync(modelsDir, { recursive: true });
        }

        // 先保存 zip 到临时路径
        const safeName = (modelName || 'model').replace(/[<>:"/\\|?*]/g, '_');
        const zipPath = path.join(modelsDir, safeName + '.tmp.zip');
        const fileStream = fs.createWriteStream(zipPath);
        let totalBytes = 0;

        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          fileStream.write(chunk);
        });

        res.on('end', () => {
          fileStream.end();
        });

        // 等文件流真正关闭后再解压，避免文件被占用
        fileStream.on('close', () => {
          console.log('[模型下载] 下载完成, 大小:', totalBytes, '字节');
          // 从 zip 文件名推断解压后的文件夹名
          const folderName = path.basename(zipPath, '.tmp.zip');
          const extractedDir = path.join(modelsDir, folderName);
          console.log('[模型下载] 解压目标路径:', extractedDir);
          // 解压
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(modelsDir, true);
            console.log('[模型下载] 解压完成, 模型路径:', extractedDir);
            try { fs.unlinkSync(zipPath); } catch (e) {}
            resolve({ ok: true, size: totalBytes, modelPath: extractedDir });
          } catch (e) {
            console.log('[模型下载] adm-zip 不可用，尝试使用 child_process 解压');
            try {
              const { execSync } = require('child_process');
              if (process.platform === 'win32') {
                execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${modelsDir}' -Force"`, { timeout: 60000 });
                console.log('[模型下载] PowerShell 解压完成, 模型路径:', extractedDir);
                try { fs.unlinkSync(zipPath); } catch (e) {}
                resolve({ ok: true, size: totalBytes, modelPath: extractedDir });
              } else {
                execSync(`unzip -o '${zipPath}' -d '${modelsDir}'`, { timeout: 60000 });
                console.log('[模型下载] 解压完成, 模型路径:', extractedDir);
                try { fs.unlinkSync(zipPath); } catch (e) {}
                resolve({ ok: true, size: totalBytes, modelPath: extractedDir });
              }
            } catch (e2) {
              console.log('[模型下载] 解压失败:', e2.message);
              resolve({ ok: true, size: totalBytes, note: '下载完成但解压失败，zip 文件已保存', zipPath });
            }
          }
        });
      });

      req.on('error', (err) => {
        console.log('[模型下载] 请求失败:', err.message);
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '超时' }); });
      req.end();
    });
  });

  // IPC: 通用 metayay HTTP 代理（自动携带 Electron session cookie）
  ipcMain.handle('metayay-request', async (event, { method, path, data }) => {
    return new Promise(async (resolve) => {
      const urlObj = new URL(path, metaYayBase);

      // 从 Electron defaultSession 获取 cookie 并携带到请求中
      let cookieHeader = '';
      try {
        const cookies = await session.defaultSession.cookies.get({ url: metaYayBase });
        cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        console.log('[metayay-request] cookies:', cookies.map(c => c.name).join(', ') || '无');
      } catch (e) {
        console.log('[metayay-request] 获取 cookie 失败:', e.message);
      }

      // 判断是否需要发送 JSON 格式数据（当 data 包含嵌套对象时）
      const hasNestedObject = data && typeof data === 'object' && Object.values(data).some(v => typeof v === 'object' && v !== null);
      let postData = '';
      let contentType = 'application/x-www-form-urlencoded';
      
      if (method === 'POST' && data) {
        if (hasNestedObject) {
          // 嵌套对象使用 JSON 格式
          postData = JSON.stringify(data);
          contentType = 'application/json';
        } else {
          // 简单数据使用 form-encoded
          postData = new URLSearchParams(data).toString();
        }
      }

        const options = {
            method: method || 'GET',
            headers: {
                'Content-Type': contentType,
            },
            timeout: 65000,
      };
      if (cookieHeader) {
        options.headers['Cookie'] = cookieHeader;
      }
      if (method === 'POST' && postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      console.log(`[metayay-request] ${method || 'GET'} ${path} cookie=${cookieHeader ? '有' : '无'} contentType=${contentType}`);
      console.log('[metayay-request] 完整URL:', urlObj.toString());
      if (method === 'POST') {
        console.log('[metayay-request] 请求数据:', postData);
      }

      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.request(urlObj, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`[metayay-request] ${path} 状态=${res.statusCode}`);
          try {
            const json = JSON.parse(body);
            resolve({ ok: true, status: res.statusCode, data: json });
          } catch {
            resolve({ ok: false, status: res.statusCode, body: body.slice(0, 200) });
          }
        });
      });
      req.on('error', (err) => {
        console.log('[metayay-request] 错误:', err.message);
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '超时' }); });
      if (method === 'POST' && postData) req.write(postData);
      req.end();
    });
  });

  // ========== Toast 通知窗口 ==========

  function showToastWindow(notification) {
    const display = screen.getPrimaryDisplay().workArea;
    const TOAST_W = 360;
    const TOAST_H_INIT = 120;
    const x = display.x + display.width - TOAST_W - 20;
    const y = display.y + display.height - TOAST_H_INIT - 20;

    if (!toastWindow || toastWindow.isDestroyed()) {
      toastWindow = new BrowserWindow({
        width: TOAST_W,
        height: TOAST_H_INIT,
        x: x,
        y: y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false,
        hasShadow: false,
        webPreferences: {
          preload: path.join(__dirname, 'toast-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      toastWindow.loadFile(path.join(__dirname, 'toast.html'));
      toastWindow.setVisibleOnAllWorkspaces(true);
    } else {
      toastWindow.setBounds({ x, y, width: TOAST_W, height: TOAST_H_INIT });
      toastWindow.show();
    }

    toastWindow.webContents.once('did-finish-load', () => {
      toastWindow.webContents.send('notification-data', notification);
    });
    if (toastWindow.webContents.isLoading() === false) {
      toastWindow.webContents.send('notification-data', notification);
    }
  }

  function hideToastWindow() {
    if (toastHideTimer) {
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
    }
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.hide();
    }
  }

  // ========== Toast 通知窗口 IPC ==========

  // IPC: 显示 Toast 通知（独立窗口）
  ipcMain.on('show-toast', (event, notification) => {
    showToastWindow(notification);
  });

  // IPC: 关闭 Toast 窗口
  ipcMain.on('close-toast', () => {
    hideToastWindow();
  });

  // IPC: Toast 被点击（标记已读）
  ipcMain.on('toast-clicked', (event, notificationId) => {
    // 转发给主窗口处理
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification-read', notificationId);
    }
  });

  // IPC: Toast 窗口动态调整大小（由 toast.html 发送）
  ipcMain.on('resize-toast', (event, width, height) => {
    if (!toastWindow || toastWindow.isDestroyed()) return;
    if (height <= 0) {
      hideToastWindow();
      return;
    }
    const display = screen.getPrimaryDisplay().workArea;
    const x = display.x + display.width - width - 20;
    const y = display.y + display.height - height - 20;
    toastWindow.setBounds({ x, y, width, height });
  });
}

// 创建系统托盘
function createTray() {
  // 尝试创建一个简单的图标，如果找不到特定图标文件
  let iconPath;
  try {
    // 检查是否存在图标文件
    iconPath = path.join(__dirname, 'resources', 'icon.png');
    if (!fs.existsSync(iconPath)) {
      // 如果不存在图标文件，尝试使用应用程序图标
      iconPath = path.join(process.resourcesPath, 'icon.png');
      if (!fs.existsSync(iconPath)) {
        // 如果还是不存在，尝试从根目录获取图标
        iconPath = path.join(path.dirname(__dirname), 'static', 'images', 'favicon.ico');
        if (!fs.existsSync(iconPath)) {
          // 如果都不存在，使用空字符串，让Electron自己处理
          iconPath = null;
        }
      }
    }
  } catch (e) {
    console.log('[托盘] 图标路径检查出错:', e.message);
    iconPath = null;
  }
  
  // 创建托盘，如果有图标则使用，否则让Electron使用默认图标
  if (iconPath && fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
  } else {
    // 在Windows上，我们可以尝试创建一个基本的系统托盘图标
    try {
      // 对于Windows平台，可以使用系统默认图标
      tray = new Tray(path.join(__dirname, 'resources', 'icon.png')); // 如果图标不存在，Electron会尝试使用默认图标
    } catch (e) {
      // 如果无法创建带图标的托盘，则使用系统默认方式
      try {
        // 创建一个最小化的图像作为图标
        const { nativeImage } = require('electron');
        const image = nativeImage.createFromDataURL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACJUlEQVRYw+2WPUsDQRCFj4BLIAiKFoLC3cJCQREBwUZBUEhRiJWQzgp2Fv4A8QcoKIiFhYVfwMZKRMDCQiwtRAQ7OwsLwSKCIIKCkksu7lq83SxmL3eX5Xlg2Nmdmf32zc7O7gLYgR34rwGZTGYLwAKAH8/zXrzXnmVZPwCWAHQAvAE48TxvYT1AqVR6BbAE4BjAoOM4LxuBPM978DxvFsAkgF0AOwCOPM97WguQTCbnAewD6AUwAeDU87yV9QDxePwGwCSAQwBnAJ4AjGua9rEWIB6PvwI4BnAE4AbAN4BTAOVYLHYL4BnAF4BlTdNeNwJ4njcF4AnAI4CQpmlzmqYtbwb6BciRpmnvAK5FUZzRNK2xEcBxnCsAzwCCEonEBYA7TdOebwFUKpU3TdMeAfyUiCRJugRQ1TTtZTOA4zgzAD4BfEsikchfAJqmPQJYBvAjiqIcj8dfNhsGjuMsAXgH8C2K4gyAzGYAx3GeAawA+CGKYhrARi1zHGcOwCqAH1EU0wBONwM4jjMH4BvAnSiKaQBnGwEcxxkF8AvgQRTHNQBXmqZ9bAdIpVLvAKYAfIuiOA5gfgsgmUzOAZgD8COK4iiA180AjuMMArgH8COK4giA140ATdMYBPAE4E0UxVEA7xsBHMdpB/AK4E0UxVEAnxsBHMfZB3AviuIQgK+NAJqmDQNYBvAmiuIggN8bgWzb7gfwAOCfKIojAH42AhRFcQDAHwD8B4DhCzRDPcJOAAAAAElFTkSuQmCC'
        );
        tray = new Tray(image);
      } catch (e) {
        console.log('[托盘] 创建默认图标失败:', e.message);
        // 最后的备选方案：使用一个基础图标路径
        try {
          // 创建一个简单的基础图标
          const { nativeImage } = require('electron');
          const imageData = Buffer.alloc(128 * 128 * 4); // 创建一个简单的缓冲区
          const image = nativeImage.createFromBuffer(imageData, 128, 128);
          tray = new Tray(image);
        } catch (e2) {
          // 如果所有方法都失败了，使用一个基础的图标路径，让Electron处理
          // 直接创建一个空的托盘，让Electron使用系统默认图标
          const iconPathFallback = path.join(__dirname, 'resources', 'icon.png');
          // 确保托盘对象被创建，即使图标文件不存在
          tray = new Tray(iconPathFallback);
        }
      }
    }
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示桌宠',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // 如枟桌宠被隐藏到了边缘，需要恢复显示
          if (isHidden) {
            console.log('[托盘] 桌宠处于隐藏状态，触发恢复流程');
            // 通过 IPC 触发恢复，复用完整的恢复逻辑
            if (mainWindow.webContents) {
              mainWindow.webContents.send('trigger-restore-from-tray');
            }
          }
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('小落同学 - 桌面宠物');
  
  // 单击显示桌宠
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true); // 确保窗口在最前面
      // 如果桌宠被隐藏到了边缘，需要恢复显示
      if (isHidden) {
        console.log('[托盘点击] 桌宠处于隐藏状态，触发恢复流程');
        // 通过 IPC 触发恢复，复用完整的恢复逻辑
        if (mainWindow.webContents) {
          mainWindow.webContents.send('trigger-restore-from-tray');
        }
      }
    }
  });
}

loadConfig();
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
