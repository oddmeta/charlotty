/**
 * 桌宠 MCP 工具模块 - pet-mcp.js
 * - MCP 工具列表展示
 * - 工具调用
 * - 支持 args 列表格式和 JSON Schema 格式的参数
 */

const PetMCP = (function() {
    'use strict';
    
    // 引用公共模块
    const { apiReq, log, err, getTpl, setTpl, setLoading, setError } = PetCommon;
    
    // MCP 图标映射
    const MCP_ICONS = {
        'weather': '🌤️',
        'translate': '📝',
        'schedule': '📅',
        'email': '📧',
        'weibo': '📱',
        'news': '📰',
        'workhours': '⏰',
        'reminder': '🔔',
        'markit': '📌',
        'default': '🛠️'
    };
    
    // 获取工具图标
    function getToolIcon(toolName) {
        return MCP_ICONS[toolName] || MCP_ICONS.default;
    }
    
    // 判断是否为标志参数（如 -y, --help）
    function isFlagArg(arg) {
        return arg && (arg.startsWith('-') || arg.startsWith('--'));
    }
    
    // 打开 MCP 面板
    async function openPanel() {
        const panelList = document.getElementById('panel-list');
        const panelForm = document.getElementById('panel-form');
        if (!panelList) return;
        
        // 设置面板标题
        const panelTitle = document.getElementById('panel-title');
        if (panelTitle) panelTitle.textContent = '技能';
        
        // 显示面板（与 PetPanels.openPanel 保持一致）
        const panelOverlay = document.getElementById('panel-overlay');
        if (panelOverlay) panelOverlay.style.display = 'flex';
        
        // 隐藏设置面板
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) settingsPanel.style.display = 'none';
        
        // 进入面板扩展模式（窗口放大）
        if (window.petAPI && window.petAPI.enter_panel_mode) {
            window.petAPI.enter_panel_mode(540, 640);
        }
        
        // 显示加载状态
        setLoading(panelList, '加载技能中...');
        
        try {
            const res = await apiReq('GET', '/admin/api/mcp/list', null);
            if (!res.ok || res.data.code !== 200) {
                setError(panelList, res.error || '加载失败');
                return;
            }
            
            const tools = res.data.data || [];
            if (tools.length === 0) {
                setTpl(panelList, 'tpl-mcp-empty');
                panelForm.innerHTML = '';
                return;
            }
            
            // 打印收到的工具数据
            log('[MCP] 收到工具列表:');
            tools.forEach(tool => {
                log('  - ' + tool.name + ': args=' + JSON.stringify(tool.args || []) + ', parameters=' + (tool.parameters || '{}'));
            });
            
            // 渲染工具列表
            panelList.innerHTML = '';
            tools.forEach(tool => {
                const icon = getToolIcon(tool.name);
                const itemTpl = getTpl('tpl-mcp-item');
                if (!itemTpl) return;
                
                const itemEl = itemTpl.querySelector('.mcp-tool-item');
                if (itemEl) itemEl.dataset.name = tool.name;
                
                const iconSpan = itemTpl.querySelector('span');
                if (iconSpan) iconSpan.textContent = icon;
                
                const descEl = itemTpl.querySelector('.mcp-tool-desc');
                if (descEl) descEl.textContent = tool.description || tool.name;
                
                const nameEl = itemTpl.querySelector('.mcp-tool-name');
                if (nameEl) nameEl.textContent = tool.name;
                
                panelList.appendChild(itemTpl);
            });
            
            // TODO: 暂时禁用MCP工具点击弹出调用窗口
            // 绑定工具点击事件
            // panelList.querySelectorAll('.mcp-tool-item').forEach(item => {
            //     item.addEventListener('click', () => {
            //         const toolName = item.dataset.name;
            //         const currentTool = tools.find(t => t.name === toolName);
            //         handleToolClick(toolName, currentTool);
            //     });
            // });
            
            panelForm.innerHTML = '';
            
        } catch (e) {
            setError(panelList, e.message);
        }
    }
    
    // 将 args 列表转换为参数定义（JSON Schema 格式）
    function convertArgsToSchema(args) {
        if (!args || !Array.isArray(args)) return { properties: {}, required: [] };
        
        const properties = {};
        const required = [];
        
        args.forEach((arg, index) => {
            // 跳过标志参数（如 -y, --help）
            if (isFlagArg(arg)) return;
            
            // 为参数生成字段名和定义
            properties[arg] = {
                type: 'string',
                title: arg,
                description: `参数: ${arg}`
            };
            // 除了第一个参数外，其他都设为可选
            // 或者根据业务逻辑判断
        });
        
        return { properties, required };
    }
    
    // 从 parameters 中提取 mcpServers 格式的 args
    function extractArgsFromParameters(parameters, toolName) {
        if (!parameters) return [];
        
        // 尝试解析 parameters
        let paramObj = parameters;
        if (typeof parameters === 'string') {
            try {
                paramObj = JSON.parse(parameters);
            } catch (e) {
                return [];
            }
        }
        
        // 检查是否是 mcpServers 格式
        if (paramObj && paramObj.mcpServers) {
            const serverConfig = paramObj.mcpServers[toolName] || paramObj.mcpServers[toolName.replace('_', '-')];
            if (serverConfig && Array.isArray(serverConfig.args)) {
                return serverConfig.args;
            }
        }
        
        return [];
    }
    
    // 从 parameters 中提取 command
    function extractCommandFromParameters(parameters, toolName) {
        if (!parameters) return 'npx';
        
        let paramObj = parameters;
        if (typeof parameters === 'string') {
            try {
                paramObj = JSON.parse(parameters);
            } catch (e) {
                return 'npx';
            }
        }
        
        if (paramObj && paramObj.mcpServers) {
            const serverConfig = paramObj.mcpServers[toolName] || paramObj.mcpServers[toolName.replace('_', '-')];
            if (serverConfig && serverConfig.command) {
                return serverConfig.command;
            }
        }
        
        return 'npx';
    }
    
    // 打开工具调用对话框
    function openToolDialog(tool) {
        // 移除已存在的对话框
        const existing = document.querySelector('.mcp-call-dialog');
        if (existing) existing.remove();
        
        // 工具名称映射（旧名称 -> MCP服务器名称）
        // 注意：后端已做映射，前端直接使用 tool.tool_name
        const mappedToolName = tool.tool_name || tool.name;
        
        // 解析参数定义
        let paramDefs = {};
        // 优先使用 tool.args，其次从 parameters 中提取
        let argsList = tool.args || [];
        let command = tool.command || 'npx';
        
        // 如果 args 为空，尝试从 parameters 中提取
        if ((!argsList || argsList.length === 0) && tool.parameters) {
            argsList = extractArgsFromParameters(tool.parameters, tool.name);
            command = extractCommandFromParameters(tool.parameters, tool.name);
            log('[MCP] 从 parameters 提取 args:', argsList, 'command:', command);
        }
        
        // 首先检查是否有 args 列表格式的参数
        if (argsList && Array.isArray(argsList) && argsList.length > 0) {
            // 将 args 列表转换为 schema 格式
            paramDefs = convertArgsToSchema(argsList);
            log('[MCP] 检测到 args 列表格式参数:', argsList);
        } else {
            // 使用 JSON Schema 格式
            try {
                paramDefs = JSON.parse(tool.parameters || '{}');
                log('[MCP] 解析后的 paramDefs:', JSON.stringify(paramDefs));
            } catch (e) {
                log('[MCP] 解析参数失败:', e.message);
                paramDefs = { properties: {}, required: [] };
            }
        }
        
        const properties = paramDefs.properties || {};
        const required = paramDefs.required || [];
        
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'mcp-call-dialog';
        dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:600;display:flex;align-items:center;justify-content:center;';
        
        const box = document.createElement('div');
        box.style.cssText = 'background:#2a2a2a;border:1px solid rgba(255,255,255,0.2);border-radius:10px;width:90%;max-width:400px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;';
        
        // 头部
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.1);';
        header.innerHTML = '<span style="color:#eee;font-size:14px;font-weight:500;">' + (tool.name || '调用工具') + '</span>' +
            '<span class="mcp-call-close" style="cursor:pointer;color:#999;font-size:18px;line-height:1;">×</span>';
        box.appendChild(header);
        
        // 内容区
        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 14px;';
        
        // 描述
        const desc = document.createElement('div');
        desc.style.cssText = 'color:#888;font-size:12px;margin-bottom:12px;line-height:1.5;';
        desc.textContent = tool.description || '无描述';
        body.appendChild(desc);
        
        // 如果有 args 列表，显示原始命令预览
        if (argsList && Array.isArray(argsList) && argsList.length > 0) {
            const cmdPreview = document.createElement('div');
            cmdPreview.style.cssText = 'color:#888;font-size:11px;margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;';
            cmdPreview.innerHTML = '<div style="color:#aaa;margin-bottom:4px;">命令预览：</div>' +
                '<code style="color:#9cf;">' + command + ' ' + argsList.map(arg => 
                    isFlagArg(arg) ? arg : '<span style="color:#ff9;">{' + arg + '}</span>'
                ).join(' ') + '</code>';
            body.appendChild(cmdPreview);
        }
        
        // 参数表单
        const paramsDiv = document.createElement('div');
        paramsDiv.id = 'mcp-call-params';
        paramsDiv.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        
        // 保存参数定义到对话框数据中
        dialog.dataset.argsList = JSON.stringify(argsList);
        dialog.dataset.command = command;
        
        Object.entries(properties).forEach(([key, def]) => {
            const field = document.createElement('div');
            field.style.display = 'flex';
            field.style.flexDirection = 'column';
            field.style.gap = '4px';
            
            const label = document.createElement('label');
            label.style.color = '#aaa';
            label.style.fontSize = '12px';
            const requiredMark = required.includes(key) ? ' *' : '';
            label.textContent = (def.title || key) + requiredMark;
            field.appendChild(label);
            
            if (def.type === 'boolean') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = 'param-' + key;
                checkbox.checked = def.default === true;
                field.appendChild(checkbox);
            } else if (def.enum) {
                const select = document.createElement('select');
                select.id = 'param-' + key;
                select.style.cssText = 'padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:#1e1e1e;color:#fff;font-size:12px;';
                def.enum.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt;
                    optEl.textContent = opt;
                    if (opt === def.default) optEl.selected = true;
                    select.appendChild(optEl);
                });
                field.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = def.type === 'integer' || def.type === 'number' ? 'number' : 'text';
                input.id = 'param-' + key;
                input.placeholder = def.description || '';
                if (def.default !== undefined) input.value = def.default;
                input.style.cssText = 'padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:#1e1e1e;color:#fff;font-size:12px;';
                field.appendChild(input);
            }
            
            paramsDiv.appendChild(field);
        });
        
        // 如果没有参数
        if (Object.keys(properties).length === 0) {
            paramsDiv.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;padding:10px;">此工具无需参数</div>';
        }
        
        body.appendChild(paramsDiv);
        box.appendChild(body);
        
        // 按钮区
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 14px;border-top:1px solid rgba(255,255,255,0.1);';
        const submitBtn = document.createElement('button');
        submitBtn.style.cssText = 'width:100%;padding:8px 0;border-radius:4px;border:none;background:rgba(76,175,80,0.8);color:#fff;cursor:pointer;font-size:13px;';
        submitBtn.textContent = '调用';
        footer.appendChild(submitBtn);
        box.appendChild(footer);
        
        // 结果区
        const resultDiv = document.createElement('div');
        resultDiv.className = 'mcp-call-result';
        resultDiv.style.cssText = 'display:none;max-height:200px;overflow-y:auto;padding:10px 14px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.1);';
        box.appendChild(resultDiv);
        
        dialog.appendChild(box);
        document.body.appendChild(dialog);
        
        // 关闭按钮事件
        header.querySelector('.mcp-call-close').addEventListener('click', () => dialog.remove());
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
        
        // 调用按钮事件
        submitBtn.addEventListener('click', async () => {
            submitBtn.textContent = '调用中...';
            submitBtn.disabled = true;
            resultDiv.style.display = 'none';
            resultDiv.innerHTML = '';
            
            // 收集参数
            const args = {};
            Object.keys(properties).forEach(key => {
                const field = document.getElementById('param-' + key);
                if (!field) return;
                const def = properties[key];
                if (def.type === 'boolean') {
                    args[key] = field.checked;
                } else if (field.value) {
                    if (def.type === 'integer') args[key] = parseInt(field.value);
                    else if (def.type === 'number') args[key] = parseFloat(field.value);
                    else args[key] = field.value;
                }
            });
            
            try {
                // 检查是否有 args 列表格式
                const originalArgsList = JSON.parse(dialog.dataset.argsList || '[]');
                
                let callData;
                if (originalArgsList && Array.isArray(originalArgsList) && originalArgsList.length > 0) {
                    // args 列表格式：
                    // 前端渲染时将参数名替换为输入框占位符 {param_name}
                    // 调用时，将参数字典和原始 args 列表一起发送给后端
                    log('[MCP] args 列表格式调用，参数:', args);
                    callData = {
                        tool_name: mappedToolName,  // 使用映射后的工具名称
                        args: args,  // 直接传递参数字典
                        original_args: originalArgsList,  // 原始 args 列表
                        is_args_list: true
                    };
                } else {
                    // JSON Schema 格式
                    log('[MCP] JSON Schema 格式调用:', args);
                    callData = {
                        tool_name: mappedToolName,  // 使用映射后的工具名称
                        args: args
                    };
                }
                
                const res = await apiReq('POST', '/admin/api/mcp/call', callData);
                
                if (res.ok && res.data.code === 200) {
                    const result = res.data.data?.result || [];
                    resultDiv.innerHTML = '<div style="color:#4caf50;font-size:12px;margin-bottom:8px;">✓ 调用成功</div>' +
                        '<pre style="color:#ccc;font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0;">' + 
                        result.join('\n') + '</pre>';
                } else {
                    resultDiv.innerHTML = '<div style="color:#f44336;font-size:12px;">调用失败: ' + (res.data?.message || '未知错误') + '</div>';
                }
            } catch (e) {
                resultDiv.innerHTML = '<div style="color:#f44336;font-size:12px;">调用失败: ' + e.message + '</div>';
            }
            
            resultDiv.style.display = 'block';
            submitBtn.textContent = '调用';
            submitBtn.disabled = false;
        });
    }
    
    // 处理工具点击
    function handleToolClick(toolName, tool) {
        if (!tool) return;
        log('[MCP] 点击工具: ' + toolName);
        openToolDialog(tool);
    }
    
    // 显示天气工具（保留兼容）
    function showWeatherTool(panelForm) {
        openToolDialog({ name: 'weather', description: '查询天气信息', parameters: '{}' });
    }
    
    // 显示翻译工具（保留兼容）
    function showTranslateTool(panelForm) {
        openToolDialog({ name: 'translate', description: '翻译文本', parameters: '{}' });
    }
    
    // 显示日程工具（保留兼容）
    function showScheduleTool(panelForm) {
        openToolDialog({ name: 'schedule', description: '管理日程安排', parameters: '{}' });
    }
    
    // 显示邮件工具（保留兼容）
    function showEmailTool(panelForm) {
        openToolDialog({ name: 'email', description: '读取邮件', parameters: '{}' });
    }
    
    // 显示微博工具（保留兼容）
    function showWeiboTool(panelForm) {
        openToolDialog({ name: 'weibo', description: '查看微博热搜', parameters: '{}' });
    }
    
    // 显示工时工具（保留兼容）
    function showWorkhoursTool(panelForm) {
        openToolDialog({ name: 'workhours', description: '记录工时', parameters: '{}' });
    }
    
    // 显示默认工具
    function showDefaultTool(panelForm, tool) {
        openToolDialog(tool);
    }
    
    // 导出 API
    return {
        openPanel,
    };
})();

// 导出到 window（供其他模块调用）
window.PetMCP = PetMCP;

console.log('[桌宠] pet-mcp.js 已加载');
