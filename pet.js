/**
 * 桌宠主入口 - pet.js
 * 负责初始化各模块和绑定全局事件
 */

// ========== 等待模块加载 ==========
(function() {
    'use strict';
    
    // 上下文菜单引用
    let contextMenu = null;
    
    // 认证状态
    let authState = { is_authenticated: false, username: null };
    
    // ========== 认证相关 ==========
    async function refreshAuthStatus() {
        if (!window.petAPI || !window.petAPI.check_auth) return;
        try {
            const result = await window.petAPI.check_auth();
            if (result.ok) {
                authState.is_authenticated = result.is_authenticated;
                authState.username = result.username;
                const menuAuth = document.getElementById('menu-auth');
                const menuAuthItems = document.getElementById('menu-auth-items');
                
                if (menuAuth) {
                    if (result.is_authenticated) {
                        menuAuth.style.display = 'none';
                    } else {
                        menuAuth.style.display = 'block';
                        menuAuth.textContent = '登录';
                    }
                }
                if (menuAuthItems) {
                    menuAuthItems.style.display = result.is_authenticated ? 'block' : 'none';
                }
                // 同步登录状态到圆盘菜单模块
                if (window.RadialMenu) {
                    window.RadialMenu.setAuthState(result.is_authenticated);
                }
            } else {
                const menuAuth = document.getElementById('menu-auth');
                if (menuAuth) {
                    menuAuth.style.display = 'block';
                    menuAuth.textContent = '登录 (未连接)';
                }
            }
        } catch (e) {
            const menuAuth = document.getElementById('menu-auth');
            if (menuAuth) {
                menuAuth.style.display = 'block';
                menuAuth.textContent = '登录 (未连接)';
            }
        }
    }
    
    function initAuth() {
        const menuAuth = document.getElementById('menu-auth');
        const menuAuthItems = document.getElementById('menu-auth-items');
        
        if (menuAuth) {
            menuAuth.addEventListener('click', () => {
                if (!window.petAPI) return;
                if (authState.is_authenticated) {
                    window.petAPI.logout();
                    authState.is_authenticated = false;
                    authState.username = null;
                    menuAuth.style.display = 'block';
                    menuAuth.textContent = '登录';
                    if (menuAuthItems) menuAuthItems.style.display = 'none';
                    // 同步登录状态到圆盘菜单模块
                    if (window.RadialMenu) {
                        window.RadialMenu.setAuthState(false);
                    }
                } else {
                    window.petAPI.open_login();
                }
                if (contextMenu) contextMenu.style.display = 'none';
            });
        }
        
        // 监听主进程通知的登录状态变化
        if (window.petAPI && window.petAPI.on_auth_changed) {
            window.petAPI.on_auth_changed(() => {
                refreshAuthStatus();
            });
        }
        
        // 每 30 秒刷新一次登录状态
        setInterval(refreshAuthStatus, 30000);
        setTimeout(refreshAuthStatus, 1000);
    }
    
    // ========== 圆盘菜单 ==========
    function initRadialMenu() {
        // 初始化圆盘菜单模块
        if (window.RadialMenu) {
            window.RadialMenu.init();
        }
        
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;
        
        // 悬停显示菜单相关变量
        let hoverTimer = null;
        let isHovering = false;
        let lastHoverEvent = null;
        let isInZone = false; // 是否在中间30%区域
        
        // 单击/双击区分相关变量
        let clickTimer = null;
        let clickCount = 0;
        
        // 检查鼠标是否在中间30%区域
        function checkMouseZone(e) {
            const rect = canvasContainer.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const zoneStart = rect.height * 0.35; // 中间30%区域起点
            const zoneEnd = rect.height * 0.65;   // 中间30%区域终点
            
            return mouseY >= zoneStart && mouseY <= zoneEnd;
        }
        
        // 鼠标移动事件：持续检测是否在中间30%区域
        // 注意：悬停触发已禁用，此事件处理器保留用于状态跟踪
        canvasContainer.addEventListener('mousemove', (e) => {
            // 如果圆盘菜单已打开，不处理
            if (window.RadialMenu && window.RadialMenu.isOpen) {
                return;
            }
            
            const inZone = checkMouseZone(e);
            
            if (inZone && !isInZone) {
                // 刚进入中间30%区域
                console.log('[圆盘菜单] 鼠标进入中间30%区域（悬停触发已禁用）');
                isInZone = true;
            } else if (!inZone && isInZone) {
                // 离开中间30%区域
                isInZone = false;
            }
        });
        
        canvasContainer.addEventListener('mouseleave', () => {
            // 鼠标离开桌宠，清理状态
            isInZone = false;
            isHovering = false;
        });
        
        // 单击事件：延迟执行，等待确认不是双击
        canvasContainer.addEventListener('click', (e) => {
            clickCount++;
            
            // 如果已经有定时器在运行，说明可能是双击的第一次点击
            if (clickTimer) {
                console.log('[圆盘菜单] 检测到快速点击，可能是双击，等待确认');
                return;
            }
            
            // 延迟 250ms 确认是单击还是双击
            clickTimer = setTimeout(() => {
                clickTimer = null;
                clickCount = 0;
                
                // 如果刚发生过拖动，不触发单击
                if (window.PetCore && window.PetCore.getState && window.PetCore.getState().hasMoved) {
                    console.log('[圆盘菜单] 检测到拖动，忽略单击');
                    return;
                }
                
                // 如果圆盘菜单已打开，不处理
                if (window.RadialMenu && window.RadialMenu.isOpen) {
                    return;
                }
                
                console.log('[圆盘菜单] 单击确认，显示菜单');
                
                // 获取桌宠窗口中心位置
                const rect = canvasContainer.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                if (window.RadialMenu) {
                    window.RadialMenu.toggle(centerX, centerY);
                } else {
                    console.error('[圆盘菜单] RadialMenu 模块未初始化');
                }
            }, 250);
        });
        
        // 双击事件：对整个桌宠有效，独立于悬停事件
        canvasContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 取消单击定时器，不执行单击逻辑
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            clickCount = 0;
            
            // 取消悬停定时器（避免双击触发悬停菜单）
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            isInZone = false;
            isHovering = false;
            
            console.log('[聊天] 双击桌宠，打开聊天窗口');
            
            if (window.PetChat && window.PetChat.toggleChatDialog) {
                window.PetChat.toggleChatDialog();
            } else {
                console.error('[聊天] PetChat.toggleChatDialog 方法不存在');
            }
        });
    }
    
    // ========== 右键菜单（已禁用，使用圆盘菜单替代） ==========
    // 注意：右键菜单功能已注释，现在统一使用圆盘菜单
    // 如需恢复右键菜单，取消下方注释即可
    /*
    function initContextMenu() {
        contextMenu = document.getElementById('context-menu');
        
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            contextMenu.style.display = 'block';
            contextMenu.style.left = '0px';
            contextMenu.style.top = '0px';
            
            const menuRect = contextMenu.getBoundingClientRect();
            let posX = e.clientX;
            let posY = e.clientY;
            
            if (posX + menuRect.width > window.innerWidth) {
                posX = Math.max(0, window.innerWidth - menuRect.width);
            }
            if (posY + menuRect.height > window.innerHeight) {
                posY = Math.max(0, window.innerHeight - menuRect.height);
            }
            
            contextMenu.style.left = posX + 'px';
            contextMenu.style.top = posY + 'px';
        });
        
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
        
        document.getElementById('menu-exit').addEventListener('click', () => {
            if (window.petAPI) {
                window.petAPI.close_window();
            }
        });
    }
    */
    
    // 空函数占位，保持原有调用逻辑不变
    function initContextMenu() {
        // 右键菜单已禁用，使用圆盘菜单替代
        console.log('[菜单] 右键菜单已禁用，请使用圆盘菜单（点击桌宠头部）');
    }
    
    // ========== 设置菜单 ==========
    // 注意: menu-settings 的点击事件已在 pet-panels.js 中绑定
    function initSettingsMenu() {
        PetCore.log('[设置] initSettingsMenu 被调用');
        // 备用：如果 pet-panels.js 的绑定失败，这里的绑定作为后备
        const menuSettings = document.getElementById('menu-settings');
        if (menuSettings && !menuSettings._settingsHandlerBound) {
            menuSettings._settingsHandlerBound = true;
            menuSettings.addEventListener('click', async () => {
                PetCore.log('[设置] 备用设置处理器被调用');
                if (window.PetSettings && window.PetSettings.loadSettings) {
                    await window.PetSettings.loadSettings();
                }
                if (contextMenu) contextMenu.style.display = 'none';
            });
        }
    }
    
    // ========== 获取设置值（供其他模块使用） ==========
    function getSettingsValue(id) {
        if (window.PetSettings && window.PetSettings.getSettingsValue) {
            return window.PetSettings.getSettingsValue(id);
        }
        return undefined;
    }
    
    function getAllSettings() {
        if (window.PetSettings && window.PetSettings.getAllSettings) {
            return window.PetSettings.getAllSettings();
        }
        return {};
    }
    
    // ========== 初始化 ==========
    async function init() {
        // 首先初始化设置模块（因为其他模块需要设置值）
        if (window.PetSettings) {
            await window.PetSettings.loadSettingsValues?.();
            window.PetSettings.setStateRef?.(PetCore.getState());
            window.PetSettings.init?.();
        }
        
        // 初始化核心模块（传入获取设置值的方法）
        PetCore.setGetSettingsValue((id) => {
            if (window.PetSettings && window.PetSettings.getSettingsValue) {
                return window.PetSettings.getSettingsValue(id);
            }
            return undefined;
        });
        
        const coreReady = await PetCore.init();
        if (!coreReady) {
            PetCore.err('核心模块初始化失败');
            return;
        }
        
        // 获取核心模块状态
        const coreState = PetCore.getState();
        
        // 验证模型尺寸设置：如果之前使用默认值加载了模型，且用户有自定义 pet_size，需要重新加载
        // 注意：由于 loadModel 是异步的，需要等待模型加载完成后才能确定实际的 pet_size
        const savedPetSize = window.PetSettings?.getSettingsValue('pet_size');
        PetCore.log('[初始化] 读取到的 pet_size: ' + (savedPetSize || 'undefined'));
        if (coreState.currentModelPath && savedPetSize && savedPetSize !== 'large') {
            // 等待 Live2D 模型加载完成后再重新加载（模型可能需要 1-3 秒加载）
            const waitForReload = () => {
                const currentState = PetCore.getState();
                if (currentState.model) {
                    PetCore.log('[初始化] pet_size 不匹配，重新加载模型为 ' + savedPetSize);
                    PetCore.loadModel(currentState.currentModelPath, savedPetSize).catch(e => PetCore.err('重新加载模型失败: ' + e.message));
                } else {
                    // 模型还在加载中，继续等待
                    setTimeout(waitForReload, 500);
                }
            };
            setTimeout(waitForReload, 1500);
        }
        
        // 初始化面板模块
        PetPanels.init();
        PetPanels.setStateRef(coreState);
        
        // 初始化聊天模块
        PetChat.init();
        PetChat.setStateRef(coreState);
        PetChat.setGetSettingsValues(getAllSettings);
        
        // 初始化走动模块
        const recoverTab = document.getElementById('recover-tab');
        PetWander.init(coreState, PetCore.getState, recoverTab, contextMenu);
        PetWander.setGetSettingsValue(getSettingsValue);
        // 初始化时根据设置启用闲时走动
        PetWander.updateIdleWandering();
        
        // 初始化菜单
        initRadialMenu();
        initContextMenu();
        initAuth();
        initSettingsMenu();
        
        // 页面卸载前保存设置
        window.addEventListener('beforeunload', () => {
            if (window.petAPI && window.petAPI.saveAllSettings && window.PetSettings) {
                const settings = window.PetSettings.getAllSettings?.();
                if (settings) window.petAPI.saveAllSettings(settings);
            }
        });
        
        PetCore.log('[初始化] 应用初始设置');
        if (window.PetSettings && window.PetSettings.applySettings) {
            window.PetSettings.applySettings();
        }
        
        PetCore.log('[初始化] 桌宠初始化完成');
    }
    
    // 等待 DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 暴露全局 API（供其他模块使用）
    window.getSettingsValue = getSettingsValue;
    window.getAllSettings = getAllSettings;
    
})();
