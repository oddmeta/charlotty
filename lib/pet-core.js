/**
 * 桌宠核心模块 - pet-core.js
 * - 调试面板
 * - Live2D 模型加载
 * - 动画控制
 * - 窗口拖拽移动
 */

// ========== 调试面板 ==========
const debugDiv = document.createElement('div');
debugDiv.id = 'debug-panel';
debugDiv.style.cssText = 'display:none;position:fixed;top:4px;left:4px;z-index:9999;background:rgba(0,0,0,0.7);color:#0f0;font-family:monospace;font-size:11px;padding:6px 10px;border-radius:4px;max-width:380px;pointer-events:none;';
document.body.appendChild(debugDiv);

function log(msg) {
    console.log('[桌宠]', msg);
    debugDiv.innerHTML += msg + '<br>';
    debugDiv.scrollTop = debugDiv.scrollHeight;
}

function err(msg) {
    console.error('[桌宠]', msg);
    debugDiv.innerHTML += '<span style="color:#f55">' + msg + '</span><br>';
}

// ========== 默认模型路径 ==========
const DEFAULT_MODEL_PATH = '/models/Hiyori/Hiyori.model3.json';

// ========== 状态定义 ==========
let state = {
    // 模型状态
    model: null,
    currentModelPath: null,
    loadModelBusy: false,
    
    // 窗口尺寸
    targetW: 420,
    targetH: 520,
    
    // 默认模型路径
    defaultModelPath: DEFAULT_MODEL_PATH,
    
    // 动画状态
    currentIdleIndex: 0,
    IDLE_COUNT: 9,
    
    // 拖拽状态
    isDragging: false,
    hasMoved: false,
    dragStartX: 0,
    dragStartY: 0,
    mouseDownX: 0,
    mouseDownY: 0,
    
    // 面板模式
    inPanelMode: false,
    
    // 隐藏状态
    isHidden: false,
    isPreviewing: false,
    isRestoring: false,
    
    // 走动状态
    wanderingEnabled: false,
    
    // 正在切换模型
    isSwappingModel: false,
};

// ========== PIXI Application ==========
let app = null;

// ========== 核心模块 ==========
const PetCore = (function() {
    'use strict';
    
    // 检查依赖
    function checkDependencies() {
        if (typeof Live2DCubismCore === 'undefined') {
            err('错误: live2dcubismcore.min.js 未加载');
            return false;
        }
        log('Cubism Core 已加载');

        if (typeof PIXI === 'undefined') {
            err('错误: pixi.min.js 未加载');
            return false;
        }
        log('PIXI 已加载, 版本: ' + PIXI.VERSION);

        if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
            err('错误: pixi-live2d-display 未加载');
            return false;
        }
        log('pixi-live2d-display 已加载');
        
        return true;
    }
    
    // 初始化 PIXI
    function initPIXI() {
        try {
            app = new PIXI.Application({
                width: 420,
                height: 520,
                transparent: true,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });
            document.getElementById('canvas-container').appendChild(app.view);
            window.pixiApp = app;
            log('PIXI Application 创建成功');
            return true;
        } catch (e) {
            err('PIXI 初始化失败: ' + e.message);
            return false;
        }
    }
    
    // 加载模型
    // @param modelPath 模型路径
    // @param petSize 可选，直接指定 pet_size，避免异步获取设置的竞态问题
    async function loadModel(modelPath, petSize) {
        if (state.loadModelBusy) return state.model;
        state.loadModelBusy = true;
        try {
            return await _doLoadModel(modelPath, petSize);
        } finally {
            state.loadModelBusy = false;
        }
    }
    
    async function _doLoadModel(modelPath, petSize) {
        // 移除旧模型
        if (state.model) {
            try {
                if (state.model.parent) state.model.parent.removeChild(state.model);
                state.model.destroy();
            } catch (e) {}
            state.model = null;
        }

        log('正在加载模型: ' + modelPath);
        const loadPromise = PIXI.live2d.Live2DModel.from(modelPath);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('模型加载超时 (15s)，请检查文件路径')), 15000);
        });
        
        state.model = await Promise.race([loadPromise, timeoutPromise]);
        app.stage.addChild(state.model);
        log('模型加载成功, 原始尺寸: ' + Math.round(state.model.width) + 'x' + Math.round(state.model.height));
        
        state.currentModelPath = modelPath;
        
        // 窗口贴合模型 - 优先使用传入的 petSize，否则从设置获取
        const size = petSize || getSettingsValue('pet_size') || 'large';
        const sizeMultiplier = { large: 1, medium: 0.75, small: 0.5 }[size] || 1;
        const MAX_W = Math.round(400 * sizeMultiplier);
        const MAX_H = Math.round(500 * sizeMultiplier);
        const origW = state.model.width;
        const origH = state.model.height;
        const scale = Math.min(MAX_W / origW, MAX_H / origH, 1);
        const targetW = Math.round(origW * scale);
        const targetH = Math.round(origH * scale);

        log('[_doLoadModel] 目标尺寸计算: multiplier=' + sizeMultiplier + ', MAX=' + MAX_W + 'x' + MAX_H + ', 原始=' + origW + 'x' + origH + ', scale=' + scale + ', 目标=' + targetW + 'x' + targetH);
        
        app.renderer.resize(targetW, targetH);
        state.model.scale.set(scale);
        state.model.anchor.set(0.5, 0.5);
        state.model.x = targetW / 2;
        state.model.y = targetH / 2;

        state.targetW = targetW;
        state.targetH = targetH;
        log('窗口调整: ' + targetW + 'x' + targetH);
        if (window.petAPI) {
            // 面板模式下不调整窗口大小，只更新 PIXI 渲染尺寸
            if (!state.inPanelMode) {
                window.petAPI.resize_window(targetW, targetH);
                // 延迟验证窗口尺寸，防止 DWM 漂移导致尺寸不一致
                setTimeout(() => {
                    if (window.petAPI && window.petAPI.verify_window_size) {
                        window.petAPI.verify_window_size(targetW, targetH);
                    }
                }, 500);
            } else {
                log('[_doLoadModel] 面板模式，跳过窗口尺寸调整');
            }
        }

        state.currentIdleIndex = 0;
        state.IDLE_COUNT = 9;

        playIdle(0);

        // 点击互动
        state.model.on('hit', (hitAreas) => {
            log('点击命中区域: ' + JSON.stringify(hitAreas));
            if (hitAreas.includes('Body')) {
                playTapBody();
            }
        });

        return state.model;
    }
    
    // 播放待机动画
    function playIdle(index) {
        state.currentIdleIndex = index % state.IDLE_COUNT;
        try {
            state.model.motion('Idle', state.currentIdleIndex);
            log('播放 Idle ' + state.currentIdleIndex);
        } catch (e) {
            err('播放 Idle 失败: ' + e.message);
        }
    }
    
    // 播放随机待机
    function playRandomIdle() {
        let next;
        do {
            next = Math.floor(Math.random() * state.IDLE_COUNT);
        } while (next === state.currentIdleIndex && state.IDLE_COUNT > 1);
        playIdle(next);
    }
    
    // 点击身体
    function playTapBody() {
        try {
            const motions = state.model._motions;
            if (motions) {
                const tapMotionNames = ['TapBody', 'Tap', 'tap', 'Tap_', 'tap_body'];
                for (const name of tapMotionNames) {
                    if (motions[name] !== undefined) {
                        state.model.motion(name, 0);
                        log('播放 TapBody: ' + name);
                        return;
                    }
                }
            }
            playRandomIdle();
        } catch (e) {
            playRandomIdle();
        }
    }
    
    // 获取设置值（需要外部注入）
    let getSettingsValue = () => 'large';
    function setGetSettingsValue(fn) {
        getSettingsValue = fn;
    }
    
    // 初始化拖拽
    function initDrag() {
        const DRAG_THRESHOLD = 5;
        
        document.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (state.isHidden) return;
            if (state.inPanelMode) return;
            state.isDragging = true;
            state.hasMoved = false;
            state.mouseDownX = e.clientX;
            state.mouseDownY = e.clientY;
            state.dragStartX = e.screenX;
            state.dragStartY = e.screenY;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!state.isDragging) return;
            if (state.inPanelMode) { state.isDragging = false; return; }
            const dx = e.screenX - state.dragStartX;
            const dy = e.screenY - state.dragStartY;
            if (Math.abs(e.clientX - state.mouseDownX) > DRAG_THRESHOLD ||
                Math.abs(e.clientY - state.mouseDownY) > DRAG_THRESHOLD) {
                state.hasMoved = true;
                if (window.petAPI) {
                    window.petAPI.move_window(dx, dy);
                }
                state.dragStartX = e.screenX;
                state.dragStartY = e.screenY;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (state.isDragging && state.hasMoved && !state.isHidden) {
                if (window.petAPI && window.petAPI.try_snap_to_edge) {
                    window.petAPI.try_snap_to_edge();
                }
            }
            state.isDragging = false;
            state.hasMoved = false;
        });
    }
    
    // 初始化
    async function init() {
        log('脚本开始执行...');
        
        // 检测 WebGL
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        if (!gl) {
            err('错误: 浏览器不支持 WebGL，无法渲染 Live2D');
        } else {
            log('WebGL 支持正常');
        }
        
        if (!checkDependencies()) return false;
        if (!initPIXI()) return false;
        initDrag();
        
        log('核心模块初始化完成');
        
        // 加载默认模型
        const savedPath = getSettingsValue('currentModelPath');
        const savedPetSize = getSettingsValue('pet_size');
        const modelPath = savedPath || DEFAULT_MODEL_PATH;
        if (modelPath) {
            loadModel(modelPath, savedPetSize).catch(e => err('加载默认模型失败: ' + e.message));
        }
        
        return true;
    }
    
    // 导出 API
    return {
        init,
        loadModel,
        playIdle,
        playRandomIdle,
        playTapBody,
        getState: () => state,
        setGetSettingsValue,
        log,
        err,
    };
})();

// 导出到 window（供其他模块调用）
window.PetCore = PetCore;

log('pet-core.js 已加载');
