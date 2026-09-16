/**
 * Electron Preload 脚本
 * 在渲染进程加载前执行，安全地暴露 IPC API 给前端
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  move_window: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  close_window: () => ipcRenderer.send('close-window'),
  resize_window: (width, height) => ipcRenderer.send('resize-window', width, height),
  verify_window_size: (width, height) => ipcRenderer.send('verify-window-size', width, height),
  hide_pet: (edge) => ipcRenderer.send('hide-pet', edge),
  show_pet: () => ipcRenderer.send('show-pet'),
  try_snap_to_edge: () => ipcRenderer.send('try-snap-to-edge'),
  move_hidden_tab: (dx, dy) => ipcRenderer.send('move-hidden-tab', dx, dy),
  hover_preview: () => ipcRenderer.send('hover-preview'),
  leave_preview: () => ipcRenderer.send('leave-preview'),
  on_pet_hidden: (callback) => ipcRenderer.on('pet-hidden', (event, data) => callback(data)),
  on_pet_shown: (callback) => ipcRenderer.on('pet-shown', callback),
  on_trigger_restore_from_tray: (callback) => ipcRenderer.on('trigger-restore-from-tray', callback),
  enter_panel_mode: (width, height) => ipcRenderer.send('enter-panel-mode', width, height),
  exit_panel_mode: () => ipcRenderer.send('exit-panel-mode'),
  show_from_tray: () => {
    if (ipcRenderer) {
      ipcRenderer.send('show-pet');
    }
  },
  // 认证相关
  check_auth: () => ipcRenderer.invoke('check-auth'),
  open_login: () => ipcRenderer.send('open-login'),
  logout: () => ipcRenderer.send('logout'),
  on_auth_changed: (callback) => ipcRenderer.on('auth-changed', callback),
  // 通用 metayay 请求代理
  metayay_request: (opts) => ipcRenderer.invoke('metayay-request', opts),
  // 用系统浏览器打开 URL
  open_external: (url) => ipcRenderer.invoke('open-external', url),
  // 后端地址设置
  get_metayay_base: () => ipcRenderer.invoke('get-metayay-base'),
  set_metayay_base: (url) => ipcRenderer.send('set-metayay-base', url),
  // 监听后端地址变更事件
  on_metayay_base_changed: (callback) => ipcRenderer.on('metayay-base-changed', (event, newUrl) => callback(newUrl)),
  // 获取 Electron session cookies（用于 WebSocket 认证）
  get_cookies: (url) => ipcRenderer.invoke('get-cookies', url),
  // 行走功能
  get_screen_info: () => ipcRenderer.invoke('get-screen-info'),
  auto_move_to: (x, y, duration) => ipcRenderer.send('auto-move-to', x, y, duration),
  auto_move_stop: () => ipcRenderer.send('auto-move-stop'),
  on_auto_move_finished: (callback) => ipcRenderer.on('auto-move-finished', () => callback()),
  // 模型管理
  get_custom_models_dir: () => ipcRenderer.invoke('get-custom-models-dir'),
  set_custom_models_dir: (dirPath) => ipcRenderer.send('set-custom-models-dir', dirPath),
  open_dir_dialog: () => ipcRenderer.invoke('open-dir-dialog'),
  list_models: (dirPath) => ipcRenderer.invoke('list-models', dirPath),
  // 远程模型浏览与下载
  fetch_remote_models: () => ipcRenderer.invoke('fetch-remote-models'),
  download_remote_model: (modelId, modelName) => ipcRenderer.invoke('download-remote-model', { modelId, modelName }),
  
  // 设置管理
  saveAllSettings: (settings) => ipcRenderer.invoke('save-all-settings', settings),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  
  // Toast 通知（独立窗口）
  show_toast: (notification) => ipcRenderer.send('show-toast', notification),
  close_toast: () => ipcRenderer.send('close-toast'),
  on_notification_read: (callback) => ipcRenderer.on('notification-read', (event, notificationId) => callback(notificationId)),
});
