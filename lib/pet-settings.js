/**
 * 桌宠设置模块 - pet-settings.js
 * - 设置加载与保存
 * - 设置面板 UI
 */

const PetSettings = (function() {
    'use strict';
    
    // 引用公共模块
    const { getTpl, setTpl, setLoading, setEmpty, setError, log, err } = PetCommon;
    
    // 设置分类定义
    const settingsCategories = [
        {
            id: 'network',
            label: '网络',
            icon: '🌐',
            items: [
                { id: 'base_url', label: '后端地址', type: 'text', placeholder: 'http://127.0.0.1:8000', default: 'http://127.0.0.1:8000' },
            ]
        },
        {
            id: 'appearance',
            label: '外观',
            icon: '🎨',
            items: [
                { id: 'pet_size', label: '桌宠大小', type: 'select', options: [
                    { value: 'large', label: '大' },
                    { value: 'medium', label: '中' },
                    { value: 'small', label: '小' },
                ], default: 'large' },
                { id: 'show_border', label: '显示窗口边框', type: 'toggle', default: false },
                { id: 'idle_interval', label: '待机动画间隔', type: 'range', min: 3, max: 30, unit: '秒', default: 5 },
                { id: 'idle_probability', label: '待机动画概率', type: 'range', min: 0, max: 100, unit: '%', default: 30 },
            ]
        },
        {
            id: 'behavior',
            label: '行为',
            icon: '⚙️',
            items: [
                { id: 'wander_enabled', label: '自动走来走去', type: 'toggle', default: false },
                { id: 'wander_idle_timeout', label: '走动空闲时间', type: 'range', min: 30, max: 300, unit: '秒', default: 60 },
                { id: 'wander_max_distance', label: '走动最大距离', type: 'range', min: 20, max: 200, unit: 'px', default: 50 },
                { id: 'wander_speed', label: '走动速度', type: 'range', min: 500, max: 5000, unit: 'ms', default: 2000 },
            ]
        },
        {
            id: 'model',
            label: '模型',
            icon: '🎭',
        },
        {
            id: 'edge',
            label: '边缘',
            icon: '📐',
            items: [
                { id: 'edge_behavior', label: '边缘行为', type: 'select', options: [
                    { value: 'none', label: '无' },
                    { value: 'hide', label: '隐藏' },
                    { value: 'snap', label: '吸附' },
                ], default: 'hide' },
            ]
        },
    ];
    
    // 状态
    let settingsValues = {};
    let settingsOrigValues = {};
    let currentSettingsCategory = 'network';
    
    // 状态引用
    let state = null;
    
    function setStateRef(ref) {
        state = ref;
    }
    
    // 加载设置值
    async function loadSettingsValues() {
        if (!window.petAPI || !window.petAPI.getAllSettings) {
            log('[加载设置] petAPI 未就绪，使用默认值');
        } else {
            try {
                const values = await window.petAPI.getAllSettings();
                log('[加载设置] 从配置文件读取的值: ' + JSON.stringify(values));
                if (values) {
                    settingsValues = { ...settingsValues, ...values };
                    log('[加载设置] 已加载设置: ' + JSON.stringify(settingsValues));
                } else {
                    log('[加载设置] 配置文件返回空值');
                }
            } catch (e) {
                err('[加载设置] 加载失败: ' + e.message);
            }
        }
        
        // 填充默认值（无论 petAPI 是否就绪都要执行）
        settingsCategories.forEach(cat => {
            if (!cat.items) return;
            cat.items.forEach(item => {
                if (settingsValues[item.id] === undefined) {
                    settingsValues[item.id] = item.default;
                }
            });
        });
        
        // 走动相关默认值
        if (settingsValues.wander_max_distance === undefined) {
            settingsValues.wander_max_distance = 50;
        }
        if (settingsValues.wander_speed === undefined) {
            settingsValues.wander_speed = 2000;
        }
        
        settingsOrigValues = JSON.parse(JSON.stringify(settingsValues));
        log('[加载设置] 设置加载完成，最终 settingsValues: ' + JSON.stringify(settingsValues));
        log('[加载设置] 设置加载完成，当前 pet_size: ' + settingsValues.pet_size);
    }
    
    // 应用设置
    function applySettings() {
        log('[应用设置] 开始应用设置，当前 pet_size: ' + settingsValues.pet_size);
        
        // 后端地址
        if (settingsValues.base_url && settingsValues.base_url.startsWith('http')) {
            if (window.petAPI && window.petAPI.set_metayay_base) {
                window.petAPI.set_metayay_base(settingsValues.base_url);
            }
        }
        
        // 窗口边框
        if (settingsValues.show_border) {
            document.body.classList.add('window-border');
        } else {
            document.body.classList.remove('window-border');
        }
        
        // 桌宠大小变化时重新加载模型
        log('[应用设置] 检查大小变化: currentModelPath=' + state?.currentModelPath + ', model=' + (state?.model ? '存在' : '不存在') + ', prevSize=' + settingsOrigValues.pet_size + ', newSize=' + settingsValues.pet_size);
        if (state?.currentModelPath && state?.model) {
            const prevSize = settingsOrigValues.pet_size || 'large';
            if (settingsValues.pet_size !== prevSize) {
                log('[应用设置] 桌宠大小已更改，从 ' + prevSize + ' 到 ' + settingsValues.pet_size + '，重新加载模型...');
                // 直接传入 pet_size 参数，避免异步获取设置值的竞态问题
                PetCore.loadModel(state.currentModelPath, settingsValues.pet_size).catch(e => err('调整大小失败: ' + e.message));
                settingsOrigValues.pet_size = settingsValues.pet_size;
            } else {
                log('[应用设置] 大小未变化，不重新加载模型');
            }
        } else {
            log('[应用设置] 无法调整大小: state=' + JSON.stringify(state ? {currentModelPath: state.currentModelPath, hasModel: !!state.model} : 'null'));
        }
        
        // 自动 Idle
        const interval = (settingsValues.idle_interval || 5) * 1000;
        const prob = (settingsValues.idle_probability || 30) / 100;
        if (window._idleTimerHandle) clearInterval(window._idleTimerHandle);
        window._idleTimerHandle = setInterval(() => {
            if (Math.random() < prob) PetCore.playRandomIdle();
        }, interval);
        
        log('[应用设置] 设置应用完成');
    }
    
    // 保存设置
    async function saveSettings() {
        log('[保存设置] 开始保存设置');
        log('[保存设置] 保存前 pet_size: ' + settingsValues.pet_size + ', 原始值: ' + settingsOrigValues.pet_size);
        
        // 从 DOM 读取值
        settingsCategories.forEach(cat => {
            if (!cat.items) return;
            cat.items.forEach(item => {
                const el = document.getElementById('set-' + item.id);
                if (!el) return;
                
                if (item.type === 'toggle') {
                    settingsValues[item.id] = el.classList.contains('active');
                } else if (item.type === 'range') {
                    settingsValues[item.id] = parseInt(el.value, 10);
                } else if (item.type === 'select') {
                    settingsValues[item.id] = el.value;
                } else {
                    settingsValues[item.id] = el.value.trim();
                }
            });
        });
        
        // model 分类没有 items，需要单独同步 customModelsDir 和 currentModelPath
        if (window.petAPI && window.petAPI.get_custom_models_dir) {
            try {
                const dir = await window.petAPI.get_custom_models_dir();
                settingsValues.customModelsDir = dir || '';
            } catch (e) {}
        }
        if (state?.currentModelPath) {
            settingsValues.currentModelPath = state.currentModelPath;
        }
        
        log('[保存设置] 读取后 pet_size: ' + settingsValues.pet_size);
        
        // 保存到配置文件
        if (window.petAPI && window.petAPI.saveAllSettings) {
            window.petAPI.saveAllSettings(settingsValues);
            log('[保存设置] 所有设置已保存到配置文件');
        }
        
        applySettings();
        settingsOrigValues = JSON.parse(JSON.stringify(settingsValues));
        log('[保存设置] 保存完成，原始值已更新为: ' + settingsOrigValues.pet_size);
    }
    
    // 重置设置
    function resetSettings() {
        settingsCategories.forEach(cat => {
            if (!cat.items) return;
            cat.items.forEach(item => {
                settingsValues[item.id] = item.default;
            });
        });
        // 重置自定义模型目录
        settingsValues.customModelsDir = '';
        if (window.petAPI && window.petAPI.set_custom_models_dir) {
            window.petAPI.set_custom_models_dir('');
        }
        settingsOrigValues = JSON.parse(JSON.stringify(settingsValues));
        
        if (window.petAPI && window.petAPI.saveAllSettings) {
            window.petAPI.saveAllSettings(settingsValues);
        }
        
        applySettings();
        loadSettingsContent();
    }
    
    // 取消设置
    function cancelSettings() {
        settingsValues = JSON.parse(JSON.stringify(settingsOrigValues));
        applySettings();
        loadSettingsContent();
    }
    
    // 加载设置内容
    async function loadSettingsContent() {
        const right = document.getElementById('settings-content');
        if (!right) {
            err('[设置面板] 错误: 找不到 settings-content 元素');
            return;
        }
        
        const cat = settingsCategories.find(c => c.id === currentSettingsCategory);
        if (!cat) return;
        
        // 模型分类
        if (cat.id === 'model') {
            await loadModelContent(right);
            return;
        }
        
        // 边缘分类
        if (cat.id === 'edge') {
            await loadEdgeContent(right);
            return;
        }
        
        // 标准分类
        let html = '<div style="padding:4px 0;">';
        cat.items.forEach(item => {
            html += '<div style="margin-bottom:14px;">'
                + '<div style="color:#eee;font-size:12px;font-weight:500;margin-bottom:3px;">' + item.label + '</div>'
                + '<div style="color:#888;font-size:11px;line-height:1.4;margin-bottom:6px;">' + (item.desc || '') + '</div>';
            
            if (item.type === 'text') {
                const val = settingsValues[item.id] || '';
                html += '<input id="set-' + item.id + '" type="text" value="' + val.replace(/"/g, '&quot;') + '" placeholder="' + (item.placeholder || '') + '" '
                    + 'style="width:100%;padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#eee;font-size:12px;outline:none;box-sizing:border-box;">';
            } else if (item.type === 'select') {
                const val = settingsValues[item.id] || item.default;
                html += '<select id="set-' + item.id + '" style="width:100%;padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.35);background:#1e1e1e;color:#fff;font-size:12px;">';
                (item.options || []).forEach(opt => {
                    const sel = val === opt.value ? ' selected' : '';
                    html += '<option value="' + opt.value + '" style="background:#1e1e1e;color:#fff;"' + sel + '>' + opt.label + '</option>';
                });
                html += '</select>';
            } else if (item.type === 'toggle') {
                const active = settingsValues[item.id] ? ' active' : '';
                const dotLeft = active ? '20px' : '2px';
                const bgColor = active ? 'rgba(100,180,255,0.7)' : 'rgba(255,255,255,0.15)';
                html += '<div id="set-' + item.id + '" class="settings-toggle' + active + '" '
                    + 'style="display:inline-flex;width:38px;height:20px;border-radius:10px;cursor:pointer;position:relative;transition:background 0.2s;background:' + bgColor + ';">'
                    + '<div style="position:absolute;top:2px;left:' + dotLeft + ';width:16px;height:16px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>'
                    + '</div>';
            } else if (item.type === 'range') {
                const val = settingsValues[item.id] || item.default;
                html += '<div style="display:flex;align-items:center;gap:8px;">'
                    + '<input id="set-' + item.id + '" type="range" min="' + (item.min || 0) + '" max="' + (item.max || 100) + '" value="' + val + '" '
                    + 'style="flex:1;accent-color:rgba(100,180,255,0.8);height:4px;">'
                    + '<span id="set-' + item.id + '-val" style="color:#64b4ff;font-size:12px;min-width:36px;text-align:right;">' + val + (item.unit || '') + '</span>'
                    + '</div>';
            }
            html += '</div>';
        });
        right.innerHTML = html;
        
        // 绑定事件
        bindSettingsEvents(right, cat);
    }
    
    // 加载模型分类内容
    async function loadModelContent(right) {
        setLoading(right, '扫描模型中...');
        
        let models = [];
        try {
            if (window.petAPI && window.petAPI.list_models) {
                models = await window.petAPI.list_models();
            }
        } catch (e) {
            setError(right, '扫描失败: ' + e.message);
            return;
        }
        
        let currentDir = null;
        try {
            if (window.petAPI && window.petAPI.get_custom_models_dir) {
                currentDir = await window.petAPI.get_custom_models_dir();
            }
        } catch (e) {}
        
        let html = '';
        if (models.length === 0) {
            setTpl(right, 'tpl-settings-no-models');
            html = '';
        } else {
            html += '<div style="color:#888;font-size:11px;margin-bottom:8px;">共 ' + models.length + ' 个本地模型，点击切换</div>';
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">';
            
            models.forEach(m => {
                const isActive = state?.currentModelPath === m.modelPath;
                const borderStyle = isActive ? 'border:2px solid rgba(100,180,255,0.8);' : 'border:1px solid rgba(255,255,255,0.1);';
                const badge = isActive ? '<div style="position:absolute;top:4px;right:4px;background:rgba(100,180,255,0.8);color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;">当前</div>' : '';
                html += '<div class="settings-model-card" data-path="' + m.modelPath + '" style="position:relative;background:rgba(255,255,255,0.05);border-radius:8px;cursor:pointer;overflow:hidden;transition:all 0.2s;' + borderStyle + '">'
                    + badge
                    + '<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);overflow:hidden;">'
                    + (m.thumbnail ? '<img src="' + m.thumbnail + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<span style=font-size:28px>🎭</span>\'">' : '<span style="font-size:28px;">🎭</span>')
                    + '</div>'
                    + '<div style="padding:5px 3px;text-align:center;">'
                    + '<div style="color:#eee;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.displayName + '</div>'
                    + '</div>'
                    + '</div>';
            });
            html += '</div>';
        }
        
        const dirDisplay = currentDir || '(默认目录)';
        html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">'
            + '<div style="color:#888;font-size:11px;margin-bottom:6px;">模型目录: <span style="color:#ccc;">' + dirDisplay + '</span></div>'
            + '<div style="display:flex;gap:6px;">'
            + '<button id="settings-model-select-dir" style="flex:1;padding:6px 0;border-radius:4px;border:none;background:rgba(100,180,255,0.5);color:#fff;cursor:pointer;font-size:12px;">选择目录</button>'
            + (currentDir ? '<button id="settings-model-reset-dir" style="flex:1;padding:6px 0;border-radius:4px;border:none;background:rgba(120,120,120,0.5);color:#fff;cursor:pointer;font-size:12px;">恢复默认</button>' : '')
            + '</div></div>';

        // 远程模型浏览区域
        html += '<div id="remote-models-section" style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
            + '<div style="color:#ccc;font-size:12px;font-weight:500;">浏览远程模型</div>'
            + '<button id="settings-fetch-remote" style="padding:4px 12px;border-radius:4px;border:none;background:rgba(100,180,255,0.4);color:#64b4ff;cursor:pointer;font-size:11px;">从服务器获取</button>'
            + '</div>'
            + '<div id="remote-models-list"></div>'
            + '</div>';
        
        right.innerHTML = html;
        
        // 绑定模型卡片点击
        right.querySelectorAll('.settings-model-card').forEach(card => {
            card.addEventListener('click', async () => {
                if (state?.isSwappingModel) return;
                const modelPath = card.dataset.path;
                if (modelPath === state?.currentModelPath) return;
                state.isSwappingModel = true;
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
                
                try {
                    await PetCore.loadModel(modelPath);
                    // 保存路径
                    if (window.petAPI && window.petAPI.saveAllSettings) {
                        await window.petAPI.saveAllSettings({ currentModelPath: modelPath });
                    }
                } catch (e) {
                    err('加载模型失败: ' + e.message);
                }
                
                state.isSwappingModel = false;
                card.style.opacity = '';
                card.style.pointerEvents = '';
                loadSettingsContent();
            });
        });

        // 绑定目录选择按钮
        const selectDirBtn = document.getElementById('settings-model-select-dir');
        if (selectDirBtn) {
            selectDirBtn.addEventListener('click', async () => {
                if (!window.petAPI || !window.petAPI.open_dir_dialog) return;
                const dir = await window.petAPI.open_dir_dialog();
                if (dir && window.petAPI.set_custom_models_dir) {
                    window.petAPI.set_custom_models_dir(dir);
                    loadSettingsContent();
                }
            });
        }

        // 绑定恢复默认按钮
        const resetDirBtn = document.getElementById('settings-model-reset-dir');
        if (resetDirBtn) {
            resetDirBtn.addEventListener('click', async () => {
                if (window.petAPI && window.petAPI.set_custom_models_dir) {
                    window.petAPI.set_custom_models_dir('');
                    loadSettingsContent();
                }
            });
        }

        // 绑定远程模型获取按钮
        const fetchRemoteBtn = document.getElementById('settings-fetch-remote');
        if (fetchRemoteBtn) {
            fetchRemoteBtn.addEventListener('click', async () => {
                const listEl = document.getElementById('remote-models-list');
                if (!listEl) return;
                listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:11px;">正在获取...</div>';
                fetchRemoteBtn.disabled = true;
                fetchRemoteBtn.textContent = '获取中...';

                try {
                    const result = await window.petAPI.fetch_remote_models();
                    if (!result || !result.ok) {
                        listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#f55;font-size:11px;">获取失败: ' + (result?.error || '未知错误') + '</div>';
                        return;
                    }

                    const remoteModels = result.models || [];
                    if (remoteModels.length === 0) {
                        listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:11px;">服务器上暂无模型</div>';
                        return;
                    }

                    let rhtml = '<div style="color:#888;font-size:11px;margin-bottom:8px;">共 ' + remoteModels.length + ' 个远程模型</div>';
                    rhtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">';
                    remoteModels.forEach(m => {
                        rhtml += '<div style="background:rgba(255,255,255,0.05);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">'
                            + '<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);overflow:hidden;">'
                            + (m.model_avatar ? '<img src="' + m.model_avatar + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<span style=font-size:28px>🎭</span>\'">' : '<span style="font-size:28px;">🎭</span>')
                            + '</div>'
                            + '<div style="padding:6px;text-align:center;">'
                            + '<div style="color:#eee;font-size:11px;font-weight:500;margin-bottom:2px;">' + m.model_name + '</div>'
                            + '<div style="color:#888;font-size:10px;margin-bottom:6px;">' + (m.model_memo || '').substring(0, 30) + '</div>'
                            + '<div style="color:#666;font-size:9px;margin-bottom:6px;">by ' + m.owner + '</div>'
                            + '<button class="remote-model-dl-btn" data-id="' + m.id + '" data-name="' + m.model_name + '" '
                            + 'style="width:100%;padding:4px 0;border-radius:4px;border:none;background:rgba(100,200,100,0.5);color:#fff;cursor:pointer;font-size:11px;">'
                            + '下载</button>'
                            + '</div></div>';
                    });
                    rhtml += '</div>';
                    listEl.innerHTML = rhtml;

                    // 绑定下载按钮
                    listEl.querySelectorAll('.remote-model-dl-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (btn.disabled) return;
                            const modelId = parseInt(btn.dataset.id, 10);
                            const modelName = btn.dataset.name;
                            btn.disabled = true;
                            btn.textContent = '下载中...';
                            btn.style.background = 'rgba(120,120,120,0.3)';

                            try {
                                const dlResult = await window.petAPI.download_remote_model(modelId, modelName);
                                if (dlResult && dlResult.ok) {
                                    btn.textContent = '已下载';
                                    btn.style.background = 'rgba(100,200,100,0.7)';
                                    // 刷新本地模型列表
                                    loadSettingsContent();
                                } else {
                                    btn.textContent = '失败';
                                    btn.style.background = 'rgba(200,80,80,0.5)';
                                    btn.disabled = false;
                                    err('下载模型失败: ' + (dlResult?.error || '未知错误'));
                                }
                            } catch (e) {
                                btn.textContent = '失败';
                                btn.style.background = 'rgba(200,80,80,0.5)';
                                btn.disabled = false;
                                err('下载模型异常: ' + e.message);
                            }
                        });
                    });
                } catch (e) {
                    listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#f55;font-size:11px;">获取失败: ' + e.message + '</div>';
                } finally {
                    fetchRemoteBtn.disabled = false;
                    fetchRemoteBtn.textContent = '从服务器获取';
                }
            });
        }
    }
    
    // 加载边缘分类内容
    async function loadEdgeContent(right) {
        let html = '<div style="padding:8px 0;">';
        html += '<p style="color:#888;font-size:12px;margin-bottom:16px;">点击边缘按钮将桌宠隐藏到屏幕相应边缘</p>';
        ['left', 'top', 'right', 'bottom'].forEach(edge => {
            const edgeNames = { left: '← 左侧', top: '↑ 顶部', right: '→ 右侧', bottom: '↓ 底部' };
            html += '<button class="settings-hide-edge" data-edge="' + edge + '" style="display:block;width:100%;padding:10px 0;margin-bottom:8px;border-radius:6px;border:none;background:rgba(100,180,255,0.2);color:#64b4ff;cursor:pointer;font-size:13px;">' + edgeNames[edge] + '</button>';
        });
        html += '</div>';
        right.innerHTML = html;
        
        // 绑定隐藏按钮
        right.querySelectorAll('.settings-hide-edge').forEach(btn => {
            btn.addEventListener('click', () => {
                const edge = btn.dataset.edge;
                if (window.petAPI) window.petAPI.hide_pet(edge);
            });
        });
    }
    
    // 绑定设置事件
    function bindSettingsEvents(right, cat) {
        // Toggle 事件
        right.querySelectorAll('.settings-toggle').forEach(el => {
            el.addEventListener('click', () => {
                el.classList.toggle('active');
                const isActive = el.classList.contains('active');
                el.style.background = isActive ? 'rgba(100,180,255,0.7)' : 'rgba(255,255,255,0.15)';
                el.querySelector('div').style.left = isActive ? '20px' : '2px';
            });
        });
        
        // Range 滑块
        cat.items.forEach(item => {
            if (item.type === 'range') {
                const slider = document.getElementById('set-' + item.id);
                const label = document.getElementById('set-' + item.id + '-val');
                if (slider && label) {
                    slider.addEventListener('input', () => {
                        label.textContent = slider.value + (item.unit || '');
                    });
                }
            }
        });
        
        // 隐藏按钮
        right.querySelectorAll('.settings-hide-edge').forEach(btn => {
            btn.addEventListener('click', () => {
                const edge = btn.dataset.edge;
                if (window.petAPI) window.petAPI.hide_pet(edge);
            });
        });
    }
    
    // 加载设置面板 - 使用独立的 settings-overlay
    async function loadSettings() {
        log('[设置面板] 开始加载设置面板');
        
        // 获取独立的设置面板元素
        const settingsOverlay = document.getElementById('settings-overlay');
        const settingsModal = document.getElementById('settings-modal');
        const settingsNav = document.getElementById('settings-nav');
        const settingsContent = document.getElementById('settings-content');
        
        if (!settingsOverlay || !settingsModal) {
            err('[设置面板] 错误: 找不到独立设置面板的静态 HTML 元素');
            return;
        }
        
        // 进入面板模式（禁用拖拽等交互）
        state.inPanelMode = true;
        if (window.petAPI && window.petAPI.enter_panel_mode) {
            window.petAPI.enter_panel_mode();
        }
        
        // 显示独立设置面板
        settingsOverlay.style.display = 'flex';
        log('[设置面板] settingsOverlay 显示');
        
        // 加载设置值
        await loadSettingsValues();
        
        // 填充导航栏
        settingsNav.innerHTML = '';
        settingsCategories.forEach(cat => {
            const isActive = cat.id === currentSettingsCategory;
            const navItem = document.createElement('div');
            navItem.className = 'settings-nav-item';
            navItem.dataset.cat = cat.id;
            navItem.style.cssText = 'padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:background 0.15s;';
            if (isActive) {
                navItem.style.background = 'rgba(100,180,255,0.15)';
                navItem.style.borderRight = '2px solid rgba(100,180,255,0.8)';
            }
            const iconSpan = document.createElement('span');
            iconSpan.style.fontSize = '18px';
            iconSpan.textContent = cat.icon;
            const labelSpan = document.createElement('span');
            labelSpan.style.fontSize = '11px';
            labelSpan.style.color = isActive ? '#64b4ff' : '#aaa';
            labelSpan.textContent = cat.label;
            navItem.appendChild(iconSpan);
            navItem.appendChild(labelSpan);
            settingsNav.appendChild(navItem);
        });
        log('[设置面板] 导航栏填充完成，共 ' + settingsCategories.length + ' 个分类');
        
        // 绑定导航点击
        settingsNav.querySelectorAll('.settings-nav-item').forEach(el => {
            el.addEventListener('click', () => {
                currentSettingsCategory = el.dataset.cat;
                settingsNav.querySelectorAll('.settings-nav-item').forEach(n => {
                    const isActive = n.dataset.cat === currentSettingsCategory;
                    n.style.background = isActive ? 'rgba(100,180,255,0.15)' : '';
                    n.style.borderRight = isActive ? '2px solid rgba(100,180,255,0.8)' : '2px solid transparent';
                    n.querySelector('span:last-child').style.color = isActive ? '#64b4ff' : '#aaa';
                });
                loadSettingsContent();
            });
        });
        
        // 渲染当前分类
        loadSettingsContent().catch(e => {
            err('加载设置内容失败: ' + e.message);
            if (settingsContent) setError(settingsContent, e.message);
        });
        
        // 绑定关闭和操作按钮
        bindActionButtons();
        
        log('[设置面板] 加载完成');
    }
    
    // 关闭设置面板
    function closeSettingsPanel() {
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsOverlay) {
            settingsOverlay.style.display = 'none';
        }
        // 退出面板模式（恢复拖拽等交互）
        state.inPanelMode = false;
        if (window.petAPI && window.petAPI.exit_panel_mode) {
            window.petAPI.exit_panel_mode();
        }
    }
    
    // 绑定操作按钮
    function bindActionButtons() {
        // 关闭按钮
        const closeBtn = document.getElementById('settings-close');
        if (closeBtn) {
            closeBtn.onclick = () => closeSettingsPanel();
        }
        
        // 保存按钮
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                try {
                    saveSettings();
                    closeSettingsPanel();
                    log('[设置面板] 保存成功');
                } catch (e) {
                    err('[设置面板] 保存时发生错误: ' + e.message);
                }
            };
        }
        
        // 取消按钮
        const cancelBtn = document.getElementById('settings-cancel-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                cancelSettings();
                closeSettingsPanel();
            };
        }
        
        // 重置按钮
        const resetBtn = document.getElementById('settings-reset-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('确定恢复所有设置为默认值？')) resetSettings();
            };
        }
    }
    
    // 获取设置值
    function getSettingsValue(id) {
        return settingsValues[id];
    }
    
    // 获取所有设置值
    function getAllSettings() {
        return { ...settingsValues };
    }
    
    return {
        init: () => {},
        loadSettings,
        loadSettingsValues,
        applySettings,
        saveSettings,
        resetSettings,
        cancelSettings,
        getSettingsValue,
        getAllSettings,
        getCategories: () => settingsCategories,
        setStateRef,
    };
})();

// 导出到 window（供其他模块调用）
window.PetSettings = PetSettings;

console.log('[桌宠] pet-settings.js 已加载');
