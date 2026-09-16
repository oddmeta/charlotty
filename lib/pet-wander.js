/**
 * 桌宠走动模块 - pet-wander.js
 * - 走来走去功能
 * - 边缘隐藏/恢复
 */

const PetWander = (function() {
    'use strict';
    
    // 引用公共模块
    const { log, err } = PetCommon;
    
    // 状态（从核心模块获取）
    let state = null;
    let getState = () => null;
    
    // DOM 引用
    let contextMenu = null;
    let recoverTab = null;
    
    // 内部状态
    let wanderTimer = null;
    let isWandering = false;
    let lastWanderX = 200;
    let lastActivityTime = Date.now();
    let idleWanderTimer = null;
    let manualWandering = false;
    let leaveTimer = null;
    
    // 恢复标签拖拽状态
    let tabDragging = false;
    let tabDragMoved = false;
    let tabDragSX = 0, tabDragSY = 0;
    let tabDownSX = 0, tabDownSY = 0;
    
    // 获取设置值
    let getSettingsValue = () => ({});
    
    function setGetSettingsValue(fn) {
        getSettingsValue = fn;
    }
    
    function randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    // 走来走去
    function doWander() {
        const wanderEnabled = getSettingsValue('wander_enabled');
        if (!wanderEnabled || state.isHidden || state.inPanelMode || isWandering || !state.model) return;
        isWandering = true;
        
        window.petAPI.get_screen_info().then(screenInfo => {
            if (!screenInfo) { isWandering = false; return; }
            const margin = 60;
            const minX = screenInfo.x + margin;
            const maxX = screenInfo.x + screenInfo.width - state.targetW - margin;
            const minY = screenInfo.y + margin;
            const maxY = screenInfo.y + screenInfo.height - state.targetH - margin;
            if (minX >= maxX || minY >= maxY) { isWandering = false; return; }
            
            const maxMoveDistance = getSettingsValue('wander_max_distance') || 50;
            const currentX = lastWanderX || (minX + (maxX - minX) / 2);
            const currentY = (minY + (maxY - minY) / 2);
            
            const targetX = Math.round(Math.min(maxX, Math.max(minX, currentX + randomRange(-maxMoveDistance, maxMoveDistance))));
            const targetY = Math.round(Math.min(maxY, Math.max(minY, currentY + randomRange(-maxMoveDistance, maxMoveDistance))));
            
            const absScale = Math.abs(state.model.scale.x);
            state.model.scale.x = targetX >= lastWanderX ? absScale : -absScale;
            lastWanderX = targetX;
            
            // 尝试播放走动动作
            try {
                const walkMotionNames = ['Walk', 'walk', 'WALK', 'Move', 'move', 'MOVE', 'WalkLeft', 'WalkRight', 'Walking', 'walking'];
                let playedWalkMotion = false;
                for (const motionName of walkMotionNames) {
                    if (state.model._motions && state.model._motions[motionName]) {
                        state.model.motion(motionName, 0);
                        console.log('[桌宠] 播放 ' + motionName + ' 动作');
                        playedWalkMotion = true;
                        break;
                    }
                }
                if (!playedWalkMotion) {
                    PetCore.playIdle(0);
                }
            } catch (motionErr) {
                PetCore.playIdle(0);
            }
            
            const moveSpeed = getSettingsValue('wander_speed') || 2000;
            window.petAPI.auto_move_to(targetX, targetY, moveSpeed);
        }).catch(e => {
            err('行走获取屏幕信息失败: ' + e.message);
            isWandering = false;
        });
    }
    
    function onAutoMoveFinished() {
        const wanderEnabled = getSettingsValue('wander_enabled');
        if (!wanderEnabled || !isWandering) return;
        isWandering = false;
        
        try {
            const walkMotionNames = ['Walk', 'walk', 'WALK', 'Move', 'move', 'MOVE', 'WalkLeft', 'WalkRight', 'Walking', 'walking'];
            let isPlayingWalkMotion = false;
            for (const motionName of walkMotionNames) {
                if (state.model._motions && state.model._motions[motionName]) {
                    isPlayingWalkMotion = true;
                    break;
                }
            }
            if (isPlayingWalkMotion) {
                PetCore.playIdle(0);
            }
        } catch (e) {}
        
        const idleDelay = Math.round(randomRange(2000, 6000));
        wanderTimer = setTimeout(() => { doWander(); }, idleDelay);
    }
    
    function startWandering(isManual = false) {
        const wanderEnabled = getSettingsValue('wander_enabled');
        if (!wanderEnabled && !isManual) return;
        if (wanderEnabled && state.wanderingEnabled) return;
        
        state.wanderingEnabled = true;
        manualWandering = isManual;
        log('走来走去已开启' + (isManual ? '（手动）' : '（自动）'));
        doWander();
    }
    
    function stopWandering() {
        if (!state.wanderingEnabled) return;
        
        state.wanderingEnabled = false;
        manualWandering = false;
        if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null; }
        if (window.petAPI && window.petAPI.auto_move_stop) {
            window.petAPI.auto_move_stop();
        }
        isWandering = false;
        log('走来走去已关闭');
    }
    
    function toggleWandering() {
        if (state.wanderingEnabled) {
            stopWandering();
        } else {
            startWandering(true);
        }
        updateWanderMenuText();
    }
    
    function updateWanderMenuText() {
        const menuWander = document.getElementById('menu-wander');
        if (menuWander) {
            menuWander.textContent = state.wanderingEnabled ? '停止走动' : '走来走去';
        }
    }
    
    // 更新闲时走动状态
    function updateIdleWandering() {
        const settings = getSettingsValue('wander_enabled');
        if (settings) {
            if (!idleWanderTimer) {
                idleWanderTimer = setInterval(checkIdleAndWander, 5000);
            }
        } else {
            if (idleWanderTimer) {
                clearInterval(idleWanderTimer);
                idleWanderTimer = null;
            }
            if (state.wanderingEnabled && !manualWandering) {
                stopWandering();
            }
        }
    }
    
    function checkIdleAndWander() {
        const wanderEnabled = getSettingsValue('wander_enabled');
        if (!wanderEnabled) return;
        
        const idleTimeout = (getSettingsValue('wander_idle_timeout') || 60) * 1000;
        const elapsed = Date.now() - lastActivityTime;
        
        if (elapsed >= idleTimeout && !state.wanderingEnabled && !state.isHidden && !state.inPanelMode) {
            log('检测到闲时，启动自动走动');
            startWandering();
        } else if (elapsed < idleTimeout && state.wanderingEnabled) {
            if (!manualWandering) {
                log('不再处于闲时，停止自动走动');
                stopWandering();
            }
        }
    }
    
    function recordActivity() {
        lastActivityTime = Date.now();
        const wanderEnabled = getSettingsValue('wander_enabled');
        
        if (state.wanderingEnabled && !manualWandering && wanderEnabled) {
            log('用户活动，停止自动走动');
            stopWandering();
        }
    }
    
    // 隐藏/恢复功能
    function initHideRestore(recoverTab) {
        // Tab 点击恢复
        recoverTab.addEventListener('click', () => {
            if (tabDragMoved) {
                return;
            }
            // 如果正在恢复中，避免重复发送请求
            if (state.isRestoring) {
                return;
            }
            // 如果前端状态已经是显示状态，不发送恢复请求
            if (!state.isHidden) {
                // 同步前端 UI 状态
                recoverTab.style.display = 'none';
                delete recoverTab.dataset.edge;
                return;
            }
            state.isHidden = false;
            state.isPreviewing = false;
            state.isRestoring = true;
            recoverTab.style.display = 'none';
            delete recoverTab.dataset.edge;
            if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
            if (window.petAPI) window.petAPI.show_pet();
        });
        
        // Tab 悬停展开预览
        recoverTab.addEventListener('mouseenter', () => {
            if (!state.isHidden || state.isRestoring || tabDragging) return;
            if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
            if (!state.isPreviewing) {
                state.isPreviewing = true;
                if (window.petAPI && window.petAPI.hover_preview) window.petAPI.hover_preview();
            }
        });
        
        recoverTab.addEventListener('mouseleave', () => {
            if (!state.isHidden || state.isRestoring || !state.isPreviewing) return;
            leaveTimer = setTimeout(() => {
                leaveTimer = null;
                state.isPreviewing = false;
                if (window.petAPI && window.petAPI.leave_preview) window.petAPI.leave_preview();
            }, 150);
        });
        
        // Tab 拖动
        recoverTab.addEventListener('mousedown', (e) => {
            if (!state.isHidden) return;
            tabDragging = true;
            tabDragMoved = false;
            tabDownSX = e.screenX;
            tabDownSY = e.screenY;
            tabDragSX = e.screenX;
            tabDragSY = e.screenY;
            recoverTab.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!tabDragging) return;
            const dx = e.screenX - tabDragSX;
            const dy = e.screenY - tabDragSY;
            tabDragSX = e.screenX;
            tabDragSY = e.screenY;
            if (Math.abs(e.screenX - tabDownSX) > 3 || Math.abs(e.screenY - tabDownSY) > 3) {
                tabDragMoved = true;
            }
            if (window.petAPI && window.petAPI.move_hidden_tab) {
                window.petAPI.move_hidden_tab(dx, dy);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (!tabDragging) return;
            tabDragging = false;
            recoverTab.style.cursor = '';
        });
    }
    
    // 监听主进程通知
    function initIPCListeners() {
        if (window.petAPI && window.petAPI.on_pet_hidden) {
            window.petAPI.on_pet_hidden((data) => {
                state.isHidden = true;
                state.isPreviewing = false;
                recoverTab.style.display = 'flex';
                recoverTab.dataset.edge = data.edge;
                if (contextMenu) contextMenu.style.display = 'none';
                if (state.wanderingEnabled) {
                    stopWandering();
                }
                if (state.model) {
                    state.model.y = state.targetH / 2 + state.model.height * 0.32;
                }
            });
        }
        
        // 监听从托盘触发的恢复请求
        if (window.petAPI && window.petAPI.on_trigger_restore_from_tray) {
            window.petAPI.on_trigger_restore_from_tray(() => {
                // 如果已经在显示状态或正在恢复中，忽略请求
                if (!state.isHidden || state.isRestoring) {
                    return;
                }
                // 更新前端状态
                state.isHidden = false;
                state.isPreviewing = false;
                state.isRestoring = true;
                recoverTab.style.display = 'none';
                delete recoverTab.dataset.edge;
                if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
                // 调用恢复 API
                if (window.petAPI) window.petAPI.show_pet();
            });
        }
        
        if (window.petAPI && window.petAPI.on_auto_move_finished) {
            window.petAPI.on_auto_move_finished(onAutoMoveFinished);
        }
        
        if (window.petAPI && window.petAPI.on_pet_shown) {
            window.petAPI.on_pet_shown(() => {
                state.isHidden = false;
                state.isPreviewing = false;
                state.isRestoring = false;
                recoverTab.style.display = 'none';
                delete recoverTab.dataset.edge;
                if (state.model) {
                    state.model.y = state.targetH / 2;
                }
                if (window.petAPI && window.petAPI.show_from_tray) {
                    window.petAPI.show_from_tray();
                }
            });
        }
    }
    
    // 初始化
    function init(coreState, coreGetState, recoverTabEl, contextMenuEl) {
        state = coreState;
        getState = coreGetState;
        recoverTab = recoverTabEl;
        contextMenu = contextMenuEl;
        
        // 初始化活动监听
        document.addEventListener('mousemove', recordActivity);
        document.addEventListener('mousedown', recordActivity);
        document.addEventListener('keypress', recordActivity);
        document.addEventListener('touchstart', recordActivity);
        
        // 初始化隐藏/恢复
        if (recoverTab) initHideRestore(recoverTab);
        
        // 初始化 IPC
        initIPCListeners();
        
        log('走动模块初始化完成');
    }
    
    return {
        init,
        setGetSettingsValue,
        startWandering,
        stopWandering,
        toggleWandering,
        updateWanderMenuText,
        updateIdleWandering,
        getState: () => ({ isWandering, wanderTimer, lastActivityTime }),
    };
})();

// 导出到 window（供其他模块调用）
window.PetWander = PetWander;

console.log('[桌宠] pet-wander.js 已加载');
