/**
 * 桌宠聊天模块 - pet-chat.js
 * - 文字对话窗口
 * - WebSocket 连接
 * - 流式输出
 * - 字幕显示
 */

const PetChat = (function() {
    'use strict';
    
    // 引用公共模块
    const { apiReq, log, err, formatTime, formatDate, formatDateTime } = PetCommon;
    
    // DOM 元素
    let chatHistory = null;
    let chatInput = null;
    let chatSendBtn = null;
    let chatDialog = null;
    let chatDialogClose = null;
    let subtitleBar = null;
    let subtitleText = null;
    
    // 状态
    let socket = null;
    let currentAssistantDiv = null;
    let isChatOpen = false;
    let subtitleTimer = null;
    
    // 状态引用
    let state = null;
    let getState = () => null;
    
    function setStateRef(ref) {
        state = ref;
    }
    
    // ========== 时间格式化（已迁移到 PetCommon）==========
    // 此函数保留用于向后兼容，新代码请使用 PetCommon.formatTime
    function formatChatTime(timeStr) {
        return formatTime(timeStr);
    }
    
    function appendTimeSeparator(timeStr) {
        if (!chatHistory) return;
        const div = document.createElement('div');
        div.style.cssText = 'text-align:center;padding:8px 0;color:#555;font-size:10px;';
        div.textContent = timeStr;
        chatHistory.appendChild(div);
    }
    
    function appendChatMessage(role, text, timeStr) {
        if (!chatHistory) return;
        const div = document.createElement('div');
        const color = role === 'user' ? '#64b4ff' : '#eee';
        const label = role === 'user' ? '我' : '助手';
        div.innerHTML = '<span style="color:#888;font-size:11px;">' + label + ':</span> <span style="color:' + color + ';white-space:pre-wrap;">' + text + '</span>';
        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    
    function nowTimeStr() {
        return formatDateTime();
    }
    
    // ========== API 请求（已迁移到 PetCommon.apiReq）==========
    // 此函数保留用于向后兼容，新代码请使用 PetCommon.apiReq
    async function petAPIRequest(method, path, data) {
        return await apiReq(method, path, data);
    }
    
    // 加载聊天历史
    async function loadChatHistory() {
        if (!chatHistory) return;
        chatHistory.innerHTML = '';
        
        try {
            const res = await petAPIRequest('GET', '/api/chat/history/', null);
            console.log('[聊天] loadChatHistory res:', res);
            if (!res.ok) throw new Error(res.error || '加载失败');
            
            const messages = res.data?.data || res.data || [];
            if (messages.length === 0) {
                chatHistory.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">暂无聊天记录</div>';
                return;
            }
            
            let lastDate = '';
            messages.forEach(msg => {
                const msgDate = msg.created_at ? msg.created_at.split(' ')[0] : '';
                if (msgDate !== lastDate) {
                    appendTimeSeparator(msgDate);
                    lastDate = msgDate;
                }
                appendChatMessage(msg.role, msg.message, formatChatTime(msg.created_at));
            });
        } catch (e) {
            chatHistory.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">加载聊天记录失败</div>';
        }
    }
    
    // 发送消息
    async function sendChatMessage() {
        log('[聊天] sendChatMessage 被调用');
        log('[聊天] chatInput 存在:', !!chatInput);
        log('[聊天] chatInput.value:', chatInput ? chatInput.value : 'NULL');
        log('[聊天] socket 存在:', !!socket);
        log('[聊天] socket.readyState:', socket ? socket.readyState : 'NULL');
        
        if (!chatInput) {
            err('[聊天] chatInput 为 NULL!');
            return;
        }
        if (!socket) {
            err('[聊天] socket 为 NULL! WebSocket 未初始化');
            return;
        }
        
        const text = chatInput.value.trim();
        log('[聊天] 输入文本长度:', text.length);
        if (!text) {
            log('[聊天] 文本为空，不发送');
            return;
        }
        
        chatInput.value = '';
        appendChatMessage('user', text, nowTimeStr());
        
        // 创建助手消息占位
        currentAssistantDiv = document.createElement('div');
        currentAssistantDiv.innerHTML = '<span style="color:#888;font-size:11px;">助手:</span> <span style="color:#eee" class="stream-text"></span>';
        chatHistory.appendChild(currentAssistantDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        // 通过 WebSocket 发送
        log('[聊天] WebSocket readyState:', socket.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)');
        if (socket.readyState === WebSocket.OPEN) {
            log('[聊天] ✓ WebSocket 已连接，发送消息');
            // 注意：后端期望的字段名是 'text' 而不是 'content'
            socket.send(JSON.stringify({
                type: 'text_message',
                text: text,  // 后端使用 data.get('text') 获取
                mode: 'text',
            }));
            log('[聊天] ✓ 消息已发送 (type: text_message, text:', text.substring(0, 20) + ')');
        } else {
            err('[聊天] ✗ WebSocket 未连接! readyState=' + socket.readyState);
            err('[聊天] 请检查后端服务是否启动 (http://127.0.0.1:8000)');
        }
    }
    
    // 处理 WebSocket 消息
    function handleWsMessage(data) {
        try {
            const msg = typeof data === 'string' ? JSON.parse(data) : data;
            
            // [调试] 打印所有收到的消息
            log(`[WebSocket] 收到消息: type=${msg.type}, keys=${Object.keys(msg).join(',')}`);
            
            // ── 优先处理通知消息 ──────────────────────────────
            if (msg.type === 'notification') {
                log(`[通知] 检测到通知消息，准备转发给 PetNotifications`);
                log(`[通知] 通知数据: ${JSON.stringify(msg).substring(0, 200)}`);
                
                // 转发给通知模块处理
                if (window.PetNotifications) {
                    log(`[通知] PetNotifications 模块存在，调用 handleNotificationMessage`);
                    window.PetNotifications.handleNotificationMessage(data);
                } else {
                    err(`[通知] PetNotifications 模块不存在！`);
                }
                return;
            }
            
            // 处理聊天消息
            // 支持多种消息类型：text/content (旧格式)、llm_response_chunk (新格式)
            if (msg.type === 'text' || msg.type === 'content' || msg.type === 'llm_response_chunk') {
                // 流式文本
                const text = msg.content || msg.text || '';
                
                // 如果是 llm_response_chunk 且 currentAssistantDiv 不存在，创建一个
                if (msg.type === 'llm_response_chunk' && !currentAssistantDiv) {
                    currentAssistantDiv = document.createElement('div');
                    currentAssistantDiv.innerHTML = '<span style="color:#888;font-size:11px;">助手:</span> <span style="color:#eee" class="stream-text"></span>';
                    chatHistory.appendChild(currentAssistantDiv);
                    log('[聊天] 创建助手消息容器 (llm_response_chunk)');
                }
                
                const span = currentAssistantDiv?.querySelector('.stream-text');
                if (span) {
                    span.textContent += text;
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                } else {
                    log('[聊天] 警告: 找不到 stream-text 元素，currentAssistantDiv 存在:', !!currentAssistantDiv);
                }
                // 更新字幕
                showSubtitle(text);
            } else if (msg.type === 'llm_response') {
                // 新对话轮次开始
                log('[聊天] 收到 llm_response，new_turn:', msg.new_turn);
                if (msg.new_turn && !currentAssistantDiv) {
                    currentAssistantDiv = document.createElement('div');
                    currentAssistantDiv.innerHTML = '<span style="color:#888;font-size:11px;">助手:</span> <span style="color:#eee" class="stream-text"></span>';
                    chatHistory.appendChild(currentAssistantDiv);
                    log('[聊天] 创建助手消息容器 (llm_response new_turn)');
                }
            } else if (msg.type === 'done' || msg.type === 'finish') {
                // 完成
                currentAssistantDiv = null;
                log('[WebSocket] 消息接收完成');
            } else if (msg.type === 'error') {
                // 错误
                err('[WebSocket] 错误: ' + (msg.message || msg.error || '未知错误'));
                if (currentAssistantDiv) {
                    const span = currentAssistantDiv.querySelector('.stream-text');
                    if (span) span.textContent = '[出错] ' + (msg.message || '未知错误');
                    currentAssistantDiv = null;
                }
            }
        } catch (e) {
            err('[WebSocket] 消息解析失败: ' + e.message);
        }
    }
    
    // 初始化 WebSocket
    async function initSocket() {
        const settings = getSettingsValues();
        const baseUrl = settings.base_url || 'http://127.0.0.1:8000';
        
        // 获取 Electron session 中的 cookies 并附加到 WebSocket URL
        let wsUrlWithSession = baseUrl.replace('http', 'ws') + '/ws/';
        
        try {
            // 尝试从 Electron 获取 cookie 并附加到 URL
            if (window.petAPI && window.petAPI.get_cookies) {
                const cookies = await window.petAPI.get_cookies(baseUrl);
                if (cookies && cookies.length > 0) {
                    // 查找 sessionid cookie
                    const sessionCookie = cookies.find(c => c.name === 'sessionid');
                    if (sessionCookie) {
                        const separator = wsUrlWithSession.includes('?') ? '&' : '?';
                        wsUrlWithSession += separator + 'session_id=' + encodeURIComponent(sessionCookie.value);
                        log('[WebSocket] 已附加 session_id 到连接 URL');
                    } else {
                        log('[WebSocket] 未找到 sessionid cookie，将使用无认证连接');
                    }
                } else {
                    log('[WebSocket] 未获取到任何 cookie，将使用无认证连接');
                }
            }
        } catch (e) {
            log('[WebSocket] 获取 cookie 失败: ' + e.message + '，将使用无认证连接');
        }
        
        log('[WebSocket] 尝试连接: ' + wsUrlWithSession);
        
        try {
            socket = new WebSocket(wsUrlWithSession);
            log(`[WebSocket] WebSocket 对象已创建，等待连接...`);
            
            socket.onopen = () => {
                log(`[WebSocket] ✓ 连接已建立 (readyState=${socket.readyState})`);
                // 认证
                log(`[WebSocket] 发送认证消息`);
                socket.send(JSON.stringify({ type: 'auth' }));
                
                // 将 socket 引用传递给通知模块
                if (window.PetNotifications && window.PetNotifications.setSocketRef) {
                    log(`[通知] ✓ 已将 WebSocket 引用传递给 PetNotifications`);
                    window.PetNotifications.setSocketRef(socket);
                } else {
                    err(`[通知] ✗ PetNotifications.setSocketRef 不存在！`);
                }
            };
            
            socket.onmessage = (event) => {
                log(`[WebSocket] 收到原始消息，长度=${event.data.length}`);
                handleWsMessage(event.data);
            };
                        
            socket.onerror = (e) => {
                err(`[WebSocket] ✗ 连接错误: ${e.message || '未知错误'}`);
                err(`[WebSocket] readyState=${socket.readyState}`);
            };
            
            socket.onclose = (event) => {
                log(`[WebSocket] ○ 连接已关闭 (code=${event.code}, reason=${event.reason || '无'})`);
                log(`[WebSocket] 将在 3 秒后尝试重连...`);
                socket = null;
                setTimeout(initSocket, 3000);
            };
        } catch (e) {
            err('[WebSocket] 初始化失败: ' + e.message);
        }
    }
    
    // 监听后端地址变更，自动重连 WebSocket
    function initBaseUrlListener() {
        if (window.petAPI && window.petAPI.on_metayay_base_changed) {
            window.petAPI.on_metayay_base_changed((newBaseUrl) => {
                log('[WebSocket] 后端地址已变更为新地址: ' + newBaseUrl);
                log('[WebSocket] 正在断开旧连接并重新连接...');
                
                // 关闭旧连接（阻止自动重连）
                if (socket) {
                    socket.onclose = null;  // 清除 onclose 处理器，避免触发重连
                    socket.close();
                    socket = null;
                }
                
                // 立即用新地址重连
                setTimeout(() => {
                    initSocket();
                }, 500);
            });
            log('[WebSocket] 已注册后端地址变更监听器');
        } else {
            err('[WebSocket] 无法注册后端地址变更监听器');
        }
    }
    
    // 字幕
    function showSubtitle(text) {
        if (!subtitleBar || !subtitleText) return;
        subtitleBar.style.display = 'block';
        subtitleText.textContent = text;
        
        if (subtitleTimer) clearTimeout(subtitleTimer);
        subtitleTimer = setTimeout(() => {
            subtitleBar.style.display = 'none';
            subtitleText.textContent = '';
        }, 3000);
    }
    
    // 对话窗口
    function toggleChatDialog() {
        if (!chatDialog) return;
        isChatOpen = !isChatOpen;
        
        if (isChatOpen) {
            // 进入面板模式（调整窗口大小）
            if (window.petAPI && window.petAPI.enter_panel_mode) {
                window.petAPI.enter_panel_mode();
            }
            chatDialog.style.display = 'flex';
            loadChatHistory();
            chatInput?.focus();
        } else {
            chatDialog.style.display = 'none';
            // 退出面板模式（恢复窗口大小）
            if (window.petAPI && window.petAPI.exit_panel_mode) {
                window.petAPI.exit_panel_mode();
            }
        }
    }
    
    // 获取设置值
    let getSettingsValues = () => ({});
    function setGetSettingsValues(fn) {
        getSettingsValues = fn;
    }
    
    // 初始化
    function init() {
        // 获取 DOM 元素
        chatHistory = document.getElementById('chat-history');
        chatInput = document.getElementById('chat-input');
        chatSendBtn = document.getElementById('chat-send-btn');
        chatDialog = document.getElementById('chat-dialog');
        chatDialogClose = document.getElementById('chat-dialog-close');
        subtitleBar = document.getElementById('subtitle-bar');
        subtitleText = document.getElementById('subtitle-text');
        
        log('[聊天] DOM 元素初始化:');
        log('[聊天] chatHistory:', chatHistory);
        log('[聊天] chatInput:', chatInput);
        log('[聊天] chatSendBtn:', chatSendBtn);
        log('[聊天] chatDialog:', chatDialog);
        
        // 双击打开对话框（已禁用，由 pet.js 处理双击事件）
        // 注意：pet.js 中的 dblclick 事件处理器负责打开/关闭聊天窗口
        // 这里的双击逻辑会导致冲突，已注释
        /*
        let lastClickTime = 0;
        document.addEventListener('click', (e) => {
            // 处于面板模式时不触发双击
            if (state?.inPanelMode) return;
            // 点击聊天框内部时不触发双击
            if (chatDialog?.contains(e.target)) return;
            // 点击 MCP 面板时不触发双击
            const panelOverlay = document.getElementById('panel-overlay');
            if (panelOverlay && panelOverlay.style.display !== 'none' && panelOverlay.contains(e.target)) return;
            // 点击 MCP 工具调用对话框时不触发双击
            const mcpDialog = document.querySelector('.mcp-call-dialog');
            if (mcpDialog && mcpDialog.contains(e.target)) return;
            const now = Date.now();
            if (now - lastClickTime < 350) {
                toggleChatDialog();
                lastClickTime = 0;
            } else {
                lastClickTime = now;
            }
        });
        */
        
        // 发送按钮
        if (chatSendBtn) {
            log('[聊天] 绑定发送按钮点击事件');
            chatSendBtn.addEventListener('click', sendChatMessage);
        } else {
            err('[聊天] 未找到发送按钮元素!');
        }
        if (chatInput) {
            log('[聊天] 绑定输入框回车事件');
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendChatMessage();
            });
        } else {
            err('[聊天] 未找到输入框元素!');
        }
        
        // 关闭按钮
        if (chatDialogClose) {
            chatDialogClose.addEventListener('click', toggleChatDialog);
        }
        
        // 初始化 WebSocket
        initSocket();
        
        // 监听后端地址变更
        initBaseUrlListener();
        
        log('聊天模块初始化完成');
    }
    
    return {
        init,
        setStateRef,
        setGetSettingsValues,
        showSubtitle,
        toggleChatDialog,
        sendChatMessage,
        loadChatHistory,
    };
})();

// 导出到 window（供其他模块调用）
window.PetChat = PetChat;

console.log('[桌宠] pet-chat.js 已加载');
