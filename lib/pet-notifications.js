/**
 * 桌宠通知 Toast 模块 - pet-notifications.js
 * - 接收后端 WebSocket 推送的通知
 * - 显示桌面 Toast（用户点击前不消失）
 * - 用户点击后标记为已读
 */

const PetNotifications = (function() {
    'use strict';
    
    // 引用公共模块
    const { apiReq, log, err } = PetCommon;
    
    // DOM 容器
    let toastContainer = null;
    
    // 状态引用
    let socket = null;
    let getSettingsValues = () => ({});
    
    // ========== Toast 样式 ==========
    function createToastStyles() {
        if (document.getElementById('pet-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pet-notification-styles';
        style.textContent = `
            .pet-notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 320px;
                min-width: 280px;
                background: linear-gradient(135deg, rgba(40, 40, 50, 0.98), rgba(30, 30, 40, 0.98));
                border: 1px solid rgba(100, 180, 255, 0.3);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(100, 180, 255, 0.15);
                z-index: 9999;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: toastSlideIn 0.3s ease-out;
                backdrop-filter: blur(10px);
            }
            
            .pet-notification-toast:hover {
                transform: translateX(-4px);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(100, 180, 255, 0.25);
                border-color: rgba(100, 180, 255, 0.5);
            }
            
            .pet-notification-toast.toast-fade-out {
                opacity: 0;
                transform: translateX(100px);
            }
            
            .pet-notification-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            }
            
            .pet-notification-icon {
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .pet-notification-title {
                font-size: 13px;
                font-weight: 600;
                color: #fff;
                flex: 1;
                line-height: 1.4;
            }
            
            .pet-notification-time {
                font-size: 10px;
                color: #888;
                flex-shrink: 0;
            }
            
            .pet-notification-content {
                font-size: 12px;
                color: #ccc;
                line-height: 1.5;
                margin-left: 30px;
                white-space: pre-wrap;
                word-break: break-word;
            }
            
            .pet-notification-badge {
                position: absolute;
                top: -6px;
                right: -6px;
                background: #ff4444;
                color: #fff;
                font-size: 10px;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 5px;
                box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4);
            }
            
            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes badgePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ========== 创建 Toast 容器 ==========
    function createToastContainer() {
        if (toastContainer) return;
        
        toastContainer = document.createElement('div');
        toastContainer.id = 'pet-notification-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 20px;
            pointer-events: none;
        `;
        
        document.body.appendChild(toastContainer);
    }
    
    // ========== 显示 Toast ==========
    function showToast(notification) {
        log(`[Toast] showToast 被调用`);
        log(`[Toast] notification 对象: ${JSON.stringify(notification).substring(0, 200)}`);
        
        // 优先使用独立窗口显示 toast（主窗口外）
        if (window.petAPI && window.petAPI.show_toast) {
            log(`[Toast] 使用独立窗口显示 toast`);
            window.petAPI.show_toast(notification);
            return;
        }
        
        // 降级：在主窗口内显示 DOM toast
        createToastStyles();
        createToastContainer();
        
        log(`[Toast] Toast 容器已准备`);
        
        const toast = document.createElement('div');
        toast.className = 'pet-notification-toast';
        toast.dataset.notificationId = notification.id;
        toast.style.pointerEvents = 'auto';
        
        // 根据通知类型选择图标
        const iconMap = {
            'reminder_triggered': '🔔',
            'task_completed': '✅',
            'task_failed': '❌',
            'task_started': '🚀',
            'system_notify': 'ℹ️',
        };
        
        const icon = iconMap[notification.notification_type] || '📢';
        const time = notification.created_at ? formatTime(notification.created_at) : '';
        
        log(`[Toast] 图标: ${icon}, 类型: ${notification.notification_type || '未指定'}`);
        log(`[Toast] 标题: ${notification.title || '无标题'}`);
        log(`[Toast] 内容: ${notification.content || '无内容'}`);
        log(`[Toast] 时间: ${time || '未提供'}`);
        
        toast.innerHTML = `
            <div class="pet-notification-header">
                <span class="pet-notification-icon">${icon}</span>
                <span class="pet-notification-title">${escapeHtml(notification.title)}</span>
                <span class="pet-notification-time">${time}</span>
            </div>
            <div class="pet-notification-content">${escapeHtml(notification.content || '')}</div>
        `;
        
        // 点击事件：标记为已读并移除 Toast
        toast.addEventListener('click', async () => {
            try {
                // 添加淡出动画
                toast.classList.add('toast-fade-out');
                
                // 等待动画完成
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 标记为已读
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'mark_notification_read',
                        notification_id: notification.id
                    }));
                }
                
                // 移除 Toast
                toast.remove();
                
                log(`[通知] 已标记为已读: ${notification.id}`);
            } catch (e) {
                err(`[通知] 标记已读失败: ${e.message}`);
            }
        });
        
        toastContainer.appendChild(toast);
        log(`[Toast] ✓ Toast 已添加到 DOM，ID: ${notification.id || '无ID'}`);
        log(`[Toast] 容器当前子元素数量: ${toastContainer.children.length}`);
    }
    
    // ========== HTML 转义 ==========
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ========== 时间格式化 ==========
    function formatTime(timeStr) {
        if (!timeStr) return '';
        try {
            const date = new Date(timeStr);
            const now = new Date();
            const diff = now - date;
            
            // 小于1分钟
            if (diff < 60000) return '刚刚';
            // 小于1小时
            if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
            // 小于24小时
            if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
            // 其他
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }
    
    // ========== 处理 WebSocket 通知消息 ==========
    function handleNotificationMessage(data) {
        try {
            log(`[通知] handleNotificationMessage 被调用`);
            log(`[通知] 原始数据类型: ${typeof data}, 长度: ${typeof data === 'string' ? data.length : 'N/A'}`);
            
            const msg = typeof data === 'string' ? JSON.parse(data) : data;
            log(`[通知] 解析后的消息 type: ${msg.type}`);
            log(`[通知] 消息所有键: ${Object.keys(msg).join(', ')}`);
            
            // 处理通知消息
            if (msg.type === 'notification') {
                const notification = msg.notification;
                log(`[通知] 提取 notification 对象: ${notification ? '存在' : '不存在'}`);
                
                if (notification) {
                    log(`[通知] ✓ 收到推送: ${notification.title || '无标题'}`);
                    log(`[通知] 通知详情: ${JSON.stringify(notification).substring(0, 300)}`);
                    
                    // 检查必要字段
                    if (!notification.id) {
                        log(`[通知] ⚠ 警告: notification 缺少 id 字段`);
                    }
                    if (!notification.title) {
                        log(`[通知] ⚠ 警告: notification 缺少 title 字段`);
                    }
                    if (!notification.content) {
                        log(`[通知] ⚠ 警告: notification 缺少 content 字段`);
                    }
                    
                    showToast(notification);
                } else {
                    err(`[通知] ✗ notification 对象为空！`);
                }
            } else {
                log(`[通知] 消息类型不是 'notification'，而是 '${msg.type}'`);
            }
        } catch (e) {
            err(`[通知] ✗ 消息解析失败: ${e.message}`);
            err(`[通知] 错误堆栈: ${e.stack}`);
        }
    }
    
    // ========== 设置 WebSocket 引用 ==========
    function setSocketRef(ws) {
        log(`[通知] setSocketRef 被调用`);
        if (ws) {
            socket = ws;
            log(`[通知] ✓ WebSocket 引用已设置，readyState: ${ws.readyState}`);
            
            // 监听来自主窗口的 notification-read IPC（独立 toast 窗口点击后触发）
            if (window.petAPI && window.petAPI.on_notification_read) {
                window.petAPI.on_notification_read((notificationId) => {
                    log(`[通知] 收到 notification-read IPC: ${notificationId}`);
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'mark_notification_read',
                            notification_id: notificationId
                        }));
                        log(`[通知] 已通过 WebSocket 标记已读: ${notificationId}`);
                    }
                });
            }
        } else {
            err(`[通知] ✗ 尝试设置空的 WebSocket 引用！`);
        }
    }
    
    // ========== 公开 API ==========
    return {
        handleNotificationMessage,
        setSocketRef,
        showToast,
    };
})();

// 导出到 window（供其他模块调用）
window.PetNotifications = PetNotifications;

log('[通知] pet-notifications.js 已加载');
