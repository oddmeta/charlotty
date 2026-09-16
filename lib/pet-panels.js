/**
 * 桌宠面板模块 - pet-panels.js
 * - 通用面板系统
 * - 小奥收藏
 * - 提醒待办
 * - 定时任务
 * - MCP工具
 * - 编辑提醒模态框
 */

const PetPanels = (function() {
    'use strict';
    
    // DOM 元素
    let panelOverlay = null;
    let panelBox = null;
    let panelTitle = null;
    let panelList = null;
    let panelForm = null;
    let panelClose = null;
    let editOverlay = null;
    let editTitle = null;
    let editContent = null;
    let editForm = null;
    let editClose = null;
    let contextMenu = null;
    
    // 状态引用
    let state = null;
    
    // 引用公共模块
    const { getTpl, setTpl, setLoading, setEmpty, setError, apiReq, log, err, enterPanelMode, exitPanelMode } = PetCommon;
    
    function setStateRef(ref) {
        state = ref;
    }
    
    // ========== API 请求（已迁移到 PetCommon.apiReq）==========
    // 此函数保留用于向后兼容，新代码请使用 PetCommon.apiReq
    async function metayayReq(method, path, data) {
        return await apiReq(method, path, data);
    }
    
    // ========== 面板基础 ==========
    function openPanel(title) {
        panelTitle.textContent = title;
        panelOverlay.style.display = 'flex';
        setLoading(panelList);
        panelForm.innerHTML = '';
        panelForm.style.display = '';
        
        // 恢复被 closePanel 清除的关键布局样式
        panelList.style.flex = '1';
        panelList.style.overflowY = 'auto';
        panelForm.style.flexShrink = '0';
        panelForm.style.display = 'flex';
        
        // 隐藏设置面板
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) settingsPanel.style.display = 'none';
        
        state.inPanelMode = true;
        if (state.wanderingEnabled) {
            if (window.PetWander) window.PetWander.stopWandering?.();
        }
        if (window.petAPI && window.petAPI.enter_panel_mode) {
            window.petAPI.enter_panel_mode();
        }
    }
    
    function closePanel() {
        log('[设置面板] 关闭面板');
        state.inPanelMode = false;
        
        // 隐藏设置面板
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) settingsPanel.style.display = 'none';
        
        // 恢复 panel-list 和 panel-form 的显示
        panelList.style.display = '';
        panelList.style.flex = '';
        panelList.style.height = '';
        panelList.style.overflow = '';
        panelForm.style.display = '';
        panelForm.style.flex = '';
        panelForm.style.height = '';
        panelForm.style.overflow = '';
        panelOverlay.style.display = 'none';
        
        if (window.petAPI && window.petAPI.exit_panel_mode) {
            window.petAPI.exit_panel_mode();
        }
    }
    
    // ========== 编辑模态框 ==========
    let currentCategoryFilter = null;
    
    function openEditModal(title) {
        editTitle.textContent = title || '编辑提醒';
        editOverlay.style.display = 'flex';
        setLoading(editContent);
        editForm.innerHTML = '';
    }
    
    function closeEditModal() {
        editOverlay.style.display = 'none';
    }
    
    // ========== 小奥收藏 ==========
    async function loadMarkit(categoryFilter) {
        const panelTitleText = categoryFilter ? '小奥收藏 - 【' + categoryFilter + '】' : '小奥收藏';
        openPanel(panelTitleText);

        const apiPath = categoryFilter ? '/markit/api/markit/list?type=' + encodeURIComponent(categoryFilter) : '/markit/api/markit/list';
        const res = await metayayReq('GET', apiPath, null);
        if (!res.ok || res.data.code !== 200) {
            setError(panelList, res.error || res.data?.response || '未知错误');
            return;
        }
        
        const items = res.data.data || [];
        if (items.length === 0) {
            // 有筛选条件时显示返回按钮
            if (categoryFilter) {
                panelList.innerHTML = '<div style="padding:4px 0 8px;border-bottom:1px solid rgba(255,255,255,0.15);margin-bottom:4px;">'
                    + '<span class="markit-back-all" style="color:#64b4ff;font-size:12px;cursor:pointer;">&lt; 显示全部</span>'
                    + '</div>';
                panelList.appendChild(getTpl('tpl-markit-empty'));
            } else {
                setTpl(panelList, 'tpl-markit-empty');
            }
        } else {
            let html = '';
            if (categoryFilter) {
                html += '<div style="padding:4px 0 8px;border-bottom:1px solid rgba(255,255,255,0.15);margin-bottom:4px;">'
                    + '<span class="markit-back-all" style="color:#64b4ff;font-size:12px;cursor:pointer;">&lt; 显示全部</span>'
                    + '</div>';
            }
            html += items.map(b => {
                const title = b.bookmark_title || '无标题';
                const catName = b.bookmark_category || '未分类';
                return '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;">'
                    + '<span class="markit-category" data-category="' + (b.bookmark_category || '') + '" style="color:#64b4ff;font-size:12px;cursor:pointer;margin-right:4px;flex-shrink:0;">【' + catName + '】</span>'
                    + '<span class="markit-title" data-id="' + b.id + '" style="color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-decoration:underline;flex:1;min-width:0;">' + title + '</span>'
                    + '</div>';
            }).join('');
            panelList.innerHTML = html;

            // 绑定分类点击
            panelList.querySelectorAll('.markit-category').forEach(el => {
                el.addEventListener('click', () => {
                    loadMarkit(el.dataset.category || 'uncategorized');
                });
            });

            // 绑定标题点击
            panelList.querySelectorAll('.markit-title').forEach(el => {
                el.addEventListener('click', () => {
                    if (window.petAPI && window.petAPI.open_external) {
                        window.petAPI.open_external('/markit/markit_view/' + el.dataset.id);
                    }
                });
            });

            // 返回按钮
            const backBtn = panelList.querySelector('.markit-back-all');
            if (backBtn) {
                backBtn.addEventListener('click', () => loadMarkit());
            }
        }
        
        // 添加表单（使用模板）
        panelForm.innerHTML = '';
        const formTpl = getTpl('tpl-markit-form');
        if (formTpl) panelForm.appendChild(formTpl);
        
        document.getElementById('markit-add-btn').addEventListener('click', async () => {
            const url = document.getElementById('markit-url').value.trim();
            if (!url) return;
            document.getElementById('markit-add-btn').textContent = '添加中...';
            const addRes = await metayayReq('POST', '/markit/markit_add', { article_url: url });
            if (addRes.ok && (addRes.data.code === 200 || addRes.data.response?.description?.includes('成功'))) {
                loadMarkit();
            } else {
                alert('添加失败: ' + (addRes.data?.response?.description || addRes.error || '未知错误'));
                document.getElementById('markit-add-btn').textContent = '添加收藏';
            }
        });
    }
    
    // ========== 提醒待办 ==========
    // 类别图标映射
    const reminderCategoryIcons = {
        'birthday': '🎂',
        'holiday': '🎉',
        'alarm': '⏰',
        'todo': '📋',
        'work': '💼',
        'life': '🏠',
        'realtime': '📢',
        'default': '📌'
    };
    
    // 获取类别图标
    function getCategoryIcon(code, isDefault) {
        if (isDefault && reminderCategoryIcons[code]) {
            return reminderCategoryIcons[code];
        }
        return reminderCategoryIcons.default;
    }
    
    // 加载提醒类别列表视图
    async function loadReminderCategories() {
        openPanel('提醒待办');
        
        const catRes = await metayayReq('GET', '/admin/api/category/list', null);
        if (!catRes.ok || catRes.data.code !== 200) {
            setError(panelList, catRes.error || catRes.data?.response || '未知错误');
            return;
        }
        
        const categories = catRes.data.data || [];
        
        // 渲染类别图标网格
        let categoriesHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:12px;padding:8px 0 16px;">';
        categories.forEach(c => {
            const icon = getCategoryIcon(c.code, c.is_default);
            categoriesHtml += '<div class="reminder-cat-item" data-id="' + c.id + '" data-code="' + (c.code || '') + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:8px;background:rgba(255,255,255,0.05);cursor:pointer;transition:background 0.2s;">' +
                '<span style="font-size:28px;">' + icon + '</span>' +
                '<span style="color:#ccc;font-size:11px;text-align:center;word-break:break-all;">' + c.name + '</span>' +
                '</div>';
        });
        categoriesHtml += '</div>';
        categoriesHtml += '<div style="color:#888;font-size:11px;text-align:center;padding-bottom:8px;">点击类别图标查看该类别的提醒</div>';
        
        panelList.innerHTML = categoriesHtml;
        
        panelList.querySelectorAll('.reminder-cat-item').forEach(item => {
            item.addEventListener('click', () => {
                loadReminder(item.dataset.id);
            });
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255,255,255,0.1)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(255,255,255,0.05)';
            });
        });
        
        loadReminderAddForm(categories, null);
    }
    
    // 加载新增提醒表单
    function loadReminderAddForm(categories, selectedCategoryId) {
        const { formatDate } = PetCommon;
        
        // 使用模板
        panelForm.innerHTML = '';
        const formTpl = getTpl('tpl-reminder-form');
        if (!formTpl) return;
        
        // 填充类别选项
        const categorySelect = formTpl.querySelector('#reminder-category');
        if (categorySelect) {
            let options = '<option value="" style="background:#1e1e1e;color:#fff;">选择类别</option>';
            categories.forEach(c => {
                const selected = selectedCategoryId === c.id ? ' selected' : '';
                options += '<option value="' + c.id + '" style="background:#1e1e1e;color:#fff;"' + selected + '>' + c.name + '</option>';
            });
            categorySelect.innerHTML = options;
        }
        
        // 设置默认日期时间
        const now = new Date();
        const dateInput = formTpl.querySelector('#reminder-date');
        const timeInput = formTpl.querySelector('#reminder-time');
        if (dateInput) dateInput.value = formatDate(now);
        if (timeInput) timeInput.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        
        panelForm.appendChild(formTpl);
        
        // 绑定更多选项切换
        const toggleBtn = document.getElementById('reminder-toggle-more');
        const moreDiv = document.getElementById('reminder-more');
        if (toggleBtn && moreDiv) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = moreDiv.style.display === 'none';
                moreDiv.style.display = isHidden ? 'flex' : 'none';
                toggleBtn.textContent = isHidden ? '▲ 收起选项' : '▼ 更多选项';
            });
        }
        
        // 绑定添加按钮
        const addBtn = document.getElementById('reminder-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const title = document.getElementById('reminder-title')?.value.trim();
                const content = document.getElementById('reminder-content')?.value.trim();
                const date = document.getElementById('reminder-date')?.value;
                const time = document.getElementById('reminder-time')?.value;
                const categoryId = document.getElementById('reminder-category')?.value;
                const repeatType = document.getElementById('reminder-repeat')?.value;
                const calendarType = document.getElementById('reminder-calendar')?.value || 'solar';
                
                if (!title || !date) return;
                addBtn.textContent = '添加中...';
                
                const addRes = await metayayReq('POST', '/admin/api/reminder/create', {
                    title, content, reminder_category: categoryId, trigger_date: date,
                    trigger_time: time || '08:00', repeat_type: repeatType, calendar_type: calendarType,
                });
                
                if (addRes.ok && (addRes.data.code === 200 || addRes.data.response?.includes('成功'))) {
                    if (currentCategoryFilter) {
                        loadReminder(currentCategoryFilter);
                    } else {
                        loadReminderCategories();
                    }
                } else {
                    alert('添加失败: ' + (addRes.data?.response || addRes.error || '未知错误'));
                    addBtn.textContent = '添加提醒';
                }
            });
        }
    }
    
    // 加载提醒列表（按类别筛选）
    async function loadReminder(categoryFilter) {
        currentCategoryFilter = categoryFilter || null;
        const panelTitleText = categoryFilter ? '提醒待办 - 查看类别' : '提醒待办';
        openPanel(panelTitleText);
        
        const listApiPath = categoryFilter ? '/admin/api/reminder/list?category_id=' + encodeURIComponent(categoryFilter) : '/admin/api/reminder/list';
        const [res, catRes] = await Promise.all([
            metayayReq('GET', listApiPath, null),
            metayayReq('GET', '/admin/api/category/list', null)
        ]);
        
        if (!res.ok || res.data.code !== 200) {
            setError(panelList, res.error || res.data?.response || '未知错误');
            return;
        }

        const categories = (catRes.ok && catRes.data.code === 200) ? (catRes.data.data || []) : [];
        
        // 找到当前选中的类别名称
        let currentCatName = '全部';
        if (categoryFilter) {
            const currentCat = categories.find(c => c.id === categoryFilter);
            if (currentCat) currentCatName = currentCat.name;
        }
        
        // 添加返回按钮和当前类别信息
        const headerHtml = '<div style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;">' +
            '<span id="reminder-back-cats" style="color:#64b4ff;font-size:12px;cursor:pointer;">&lt; 类别列表</span>' +
            '<span style="color:#888;font-size:11px;">|</span>' +
            '<span style="color:#eee;font-size:12px;font-weight:500;">' + currentCatName + '</span>' +
            '</div>';

        const items = res.data.data || [];
        if (items.length === 0) {
            panelList.innerHTML = headerHtml;
            panelList.appendChild(getTpl('tpl-reminder-empty'));
        } else {
            const categoryMap = {};
            categories.forEach(c => { categoryMap[c.id] = c; });
            const categoryIconMap = { 'birthday': '🎂', 'holiday': '🎉', 'alarm': '⏰', 'todo': '📋', 'realtime': '📢' };
            
            const itemsHtml = items.map(r => {
                const isCompleted = r.status === 'completed';
                const pendingConfirm = isCompleted && !r.is_confirmed;
                const confirmed = isCompleted && r.is_confirmed;
                const statusColor = r.status === 'active' ? '#4caf50' : (r.status === 'paused' ? '#ff9800' : (confirmed ? '#78909c' : '#888'));
                const statusText = r.status === 'active' ? '进行中' : (r.status === 'paused' ? '已暂停' : (confirmed ? '已确认' : '已完成'));
                let bgColor = 'transparent', borderLeft = '', opacity = '1';
                if (pendingConfirm) {
                    bgColor = 'rgba(255,193,7,0.12)';
                    borderLeft = 'border-left:3px solid #ffc107;';
                } else if (confirmed) {
                    bgColor = 'rgba(120,144,156,0.08)';
                    borderLeft = 'border-left:3px solid #546e7a;';
                    opacity = '0.6';
                }
                let catBadge = '';
                if (r.category_id) {
                    const cat = categoryMap[r.category_id];
                    if (cat) {
                        const icon = cat.is_default ? (categoryIconMap[cat.code] || '🏷️') : '🏷️';
                        catBadge = '<span style="flex-shrink:0;font-size:13px;" title="' + cat.name + '">' + icon + '</span>';
                    }
                }
                const nextTime = r.next_trigger_at ? new Date(r.next_trigger_at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
                return '<div class="reminder-item" data-id="' + r.id + '" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between;gap:6px;background:' + bgColor + ';' + borderLeft + 'cursor:pointer;opacity:' + opacity + ';">'
                    + '<div style="flex:1;min-width:0;">'
                    + '<div style="display:flex;align-items:center;gap:4px;">' + catBadge
                    + (pendingConfirm ? '<span style="flex-shrink:0;font-size:13px;">⚠️</span>' : '')
                    + (confirmed ? '<span style="flex-shrink:0;font-size:13px;">✓</span>' : '')
                    + '<span style="color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;flex:1;min-width:0;">' + r.title + '</span>'
                    + '</div>'
                    + '<div style="color:#888;font-size:11px;">' + r.trigger_date + ' ' + r.trigger_time + ' · <span style="color:' + statusColor + '">' + statusText + '</span> · 下次: ' + nextTime + '</div>'
                    + '</div>'
                    + '<div style="display:flex;gap:8px;flex-shrink:0;align-items:center;">'
                    + (pendingConfirm ? '<button class="reminder-confirm" data-id="' + r.id + '" style="border:none;background:transparent;color:#4caf50;cursor:pointer;font-size:14px;padding:0;line-height:1;">✓</button>' : '')
                    + '<button class="reminder-delete" data-id="' + r.id + '" style="border:none;background:transparent;color:#f44336;cursor:pointer;font-size:14px;padding:0;line-height:1;">✕</button>'
                    + '</div></div>';
            }).join('');
            panelList.innerHTML = headerHtml + itemsHtml;

            // 绑定事件
            panelList.querySelectorAll('.reminder-confirm').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await metayayReq('POST', '/admin/api/reminder/confirm/' + btn.dataset.id, {});
                    loadReminder(categoryFilter);
                });
            });
            panelList.querySelectorAll('.reminder-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('确定删除此提醒？')) return;
                    await metayayReq('POST', '/admin/api/reminder/delete/' + btn.dataset.id, {});
                    loadReminder(categoryFilter);
                });
            });
            panelList.querySelectorAll('.reminder-item').forEach(item => {
                item.addEventListener('click', () => {
                    loadReminderEdit(item.dataset.id);
                });
            });
        }
        
        // 绑定返回类别列表
        document.getElementById('reminder-back-cats')?.addEventListener('click', () => {
            loadReminderCategories();
        });
        
        // 添加新增提醒表单（预选当前类别）
        loadReminderAddForm(categories, categoryFilter);
    }
    
    // ========== 编辑提醒 ==========
    async function loadReminderEdit(id) {
        openEditModal('编辑提醒');
        const [detailRes, catRes] = await Promise.all([
            metayayReq('GET', '/admin/api/reminder/detail/' + id, null),
            metayayReq('GET', '/admin/api/category/list', null)
        ]);
        
        if (!detailRes.ok || detailRes.data.code !== 200) {
            setError(editContent, '加载详情失败');
            return;
        }
        
        const r = detailRes.data.data;
        const categories = (catRes.ok && catRes.data.code === 200) ? (catRes.data.data || []) : [];
        
        // 使用模板填充表单
        editContent.innerHTML = '';
        const formTpl = getTpl('tpl-reminder-edit-form');
        if (formTpl) {
            // 填充类别选项
            const categorySelect = formTpl.querySelector('#edit-reminder-category');
            if (categorySelect) {
                let options = '<option value="" style="background:#1e1e1e;color:#fff;">选择类别</option>';
                options += categories.map(c => 
                    '<option value="' + c.id + '" style="background:#1e1e1e;color:#fff;"' + (r.category_id === c.id ? ' selected' : '') + '>' + c.name + '</option>'
                ).join('');
                categorySelect.innerHTML = options;
            }
            // 填充表单值
            const titleInput = formTpl.querySelector('#edit-reminder-title');
            if (titleInput) titleInput.value = r.title || '';
            const contentInput = formTpl.querySelector('#edit-reminder-content');
            if (contentInput) contentInput.value = r.content || '';
            const dateInput = formTpl.querySelector('#edit-reminder-date');
            if (dateInput) dateInput.value = r.trigger_date || '';
            const timeInput = formTpl.querySelector('#edit-reminder-time');
            if (timeInput) timeInput.value = r.trigger_time || '';
            const repeatSelect = formTpl.querySelector('#edit-reminder-repeat');
            if (repeatSelect) {
                // 更新重复选项的选中状态
                const opts = repeatSelect.options;
                for (let i = 0; i < opts.length; i++) {
                    opts[i].selected = opts[i].value === r.repeat_type;
                }
            }
            // 设置日历类型选中状态
            const calendarSelect = formTpl.querySelector('#edit-reminder-calendar');
            if (calendarSelect) {
                const opts = calendarSelect.options;
                for (let i = 0; i < opts.length; i++) {
                    opts[i].selected = opts[i].value === (r.calendar_type || 'solar');
                }
            }
            editContent.appendChild(formTpl);
        }
        
        // 按钮表单（使用模板）
        editForm.innerHTML = '';
        const btnTpl = getTpl('tpl-reminder-edit-buttons');
        if (btnTpl) editForm.appendChild(btnTpl);
        
        document.getElementById('edit-reminder-cancel')?.addEventListener('click', closeEditModal);
        document.getElementById('edit-reminder-save')?.addEventListener('click', async () => {
            const saveRes = await metayayReq('POST', '/admin/api/reminder/update/' + id, {
                title: document.getElementById('edit-reminder-title')?.value.trim(),
                content: document.getElementById('edit-reminder-content')?.value.trim(),
                reminder_category: document.getElementById('edit-reminder-category')?.value,
                trigger_date: document.getElementById('edit-reminder-date')?.value,
                trigger_time: document.getElementById('edit-reminder-time')?.value,
                repeat_type: document.getElementById('edit-reminder-repeat')?.value,
                calendar_type: document.getElementById('edit-reminder-calendar')?.value || 'solar',
            });
            
            if (saveRes.ok && (saveRes.data.code === 200 || saveRes.data.response?.includes('成功'))) {
                closeEditModal();
                loadReminder(currentCategoryFilter);
            } else {
                alert('保存失败: ' + (saveRes.data?.response || saveRes.error || '未知错误'));
            }
        });
    }
    
    // ========== 定时任务 ==========
    let scheduleMcpTools = [];  // 缓存 MCP 工具列表
    
    // 加载 MCP 工具列表（用于新增/编辑任务时选择动作类型）
    async function loadScheduleMcpTools() {
        if (scheduleMcpTools.length > 0) return scheduleMcpTools;
        const res = await metayayReq('GET', '/admin/api/schedule/mcp_tools', null);
        if (res.ok && res.data.code === 200) {
            scheduleMcpTools = res.data.data || [];
        }
        return scheduleMcpTools;
    }
    
    // 加载通知机器人列表
    let scheduleNotifiers = [];
    async function loadScheduleNotifiers() {
        if (scheduleNotifiers.length > 0) return scheduleNotifiers;
        const res = await metayayReq('GET', '/admin/api/schedule/notifiers', null);
        if (res.ok && res.data.code === 200) {
            scheduleNotifiers = res.data.data || [];
        }
        return scheduleNotifiers;
    }
    
    // 填充通知机器人下拉框
    function populateNotifierSelect(selectEl, selectedValue) {
        if (!selectEl) return;
        let options = '<option value="" style="background:#1e1e1e;color:#fff;">-- 不通知 --</option>';
        scheduleNotifiers.forEach(n => {
            const selected = String(n.id) === String(selectedValue) ? ' selected' : '';
            options += '<option value="' + n.id + '" style="background:#1e1e1e;color:#fff;"' + selected + '>' + n.notifier_name + '</option>';
        });
        selectEl.innerHTML = options;
    }
    
    // 填充动作类型下拉框
    function populateActionTypeSelect(selectEl, selectedValue) {
        if (!selectEl) return;
        let options = '<option value="" style="background:#1e1e1e;color:#fff;">选择动作</option>';
        scheduleMcpTools.forEach(t => {
            const selected = t.name === selectedValue ? ' selected' : '';
            options += '<option value="' + t.name + '" style="background:#1e1e1e;color:#fff;"' + selected + '>' + (t.description || t.name) + '</option>';
        });
        selectEl.innerHTML = options;
    }
    
    // 渲染 MCP 工具动态参数表单
    function renderScheduleParams(containerEl, actionType, existingConfig) {
        if (!containerEl) return;
        containerEl.innerHTML = '';
        
        const toolDef = scheduleMcpTools.find(t => t.name === actionType);
        if (!toolDef) {
            if (actionType) containerEl.innerHTML = '<div style="color:#888;font-size:11px;">该工具暂无参数配置</div>';
            return;
        }
        
        const props = toolDef.parameters?.properties || {};
        const required = toolDef.parameters?.required || [];
        const keys = Object.keys(props);
        if (keys.length === 0) {
            containerEl.innerHTML = '<div style="color:#888;font-size:11px;">该工具无需参数</div>';
            return;
        }
        
        const inputStyle = 'padding:5px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#eee;font-size:12px;width:100%;box-sizing:border-box;';
        const labelStyle = 'color:#aaa;font-size:10px;';
        
        keys.forEach(key => {
            const schema = props[key];
            const isRequired = required.includes(key);
            const val = existingConfig?.[key] ?? schema.default ?? '';
            
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
            
            const label = document.createElement('label');
            label.style.cssText = labelStyle;
            label.textContent = key + (isRequired ? ' *' : '');
            if (schema.description) label.title = schema.description;
            
            let input;
            if (schema.enum) {
                input = document.createElement('select');
                input.style.cssText = inputStyle;
                schema.enum.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt; o.textContent = opt;
                    o.style.cssText = 'background:#1e1e1e;color:#fff;';
                    if (String(val) === String(opt)) o.selected = true;
                    input.appendChild(o);
                });
            } else if (schema.type === 'boolean') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = val === true || val === 'true';
                input.style.cssText = 'accent-color:#64b4ff;';
            } else if (schema.type === 'integer') {
                input = document.createElement('input');
                input.type = 'number'; input.step = '1';
                input.value = val;
                input.style.cssText = inputStyle;
            } else if (schema.type === 'number') {
                input = document.createElement('input');
                input.type = 'number'; input.step = 'any';
                input.value = val;
                input.style.cssText = inputStyle;
            } else if (schema.type === 'object' || schema.type === 'array') {
                input = document.createElement('textarea');
                input.rows = 2;
                input.placeholder = 'JSON格式';
                input.value = (typeof val === 'object') ? JSON.stringify(val, null, 2) : (val || '');
                input.style.cssText = inputStyle + 'resize:vertical;';
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.value = val;
                input.style.cssText = inputStyle;
            }
            
            input.dataset.paramKey = key;
            if (schema.type === 'boolean') input.dataset.paramType = 'boolean';
            else if (schema.type === 'integer') input.dataset.paramType = 'integer';
            else if (schema.type === 'number') input.dataset.paramType = 'number';
            else if (schema.type === 'object' || schema.type === 'array') input.dataset.paramType = 'json';
            else input.dataset.paramType = 'string';
            
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            containerEl.appendChild(wrapper);
        });
    }
    
    // 收集动态参数为 action_config JSON
    function buildScheduleActionConfig(containerEl) {
        const config = {};
        if (!containerEl) return config;
        containerEl.querySelectorAll('[data-param-key]').forEach(el => {
            const key = el.dataset.paramKey;
            const type = el.dataset.paramType;
            let val;
            if (type === 'boolean') {
                val = el.checked;
            } else if (type === 'integer') {
                val = el.value !== '' ? parseInt(el.value, 10) : undefined;
            } else if (type === 'number') {
                val = el.value !== '' ? parseFloat(el.value) : undefined;
            } else if (type === 'json') {
                try { val = el.value ? JSON.parse(el.value) : undefined; } catch(e) { val = el.value; }
            } else {
                val = el.value || undefined;
            }
            if (val !== undefined && val !== null) config[key] = val;
        });
        return config;
    }
    
    // 绑定任务类型切换（一次性/循环）
    function bindTaskTypeSwitch(typeSelect, timeSection, recurringSection, frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts) {
        if (!typeSelect) return;
        typeSelect.addEventListener('change', () => {
            const isRecurring = typeSelect.value === 'recurring';
            timeSection.style.display = isRecurring ? 'none' : '';
            recurringSection.style.display = isRecurring ? 'flex' : 'none';
            if (isRecurring) {
                frequencySelect.dispatchEvent(new Event('change'));
            }
        });
    }
    
    // 绑定频率切换（每天/每周/每月/每年）
    function bindFrequencySwitch(frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts) {
        if (!frequencySelect) return;
        frequencySelect.addEventListener('change', () => {
            weeklyOpts.style.display = frequencySelect.value === 'weekly' ? '' : 'none';
            monthlyOpts.style.display = frequencySelect.value === 'monthly' ? '' : 'none';
            yearlyOpts.style.display = frequencySelect.value === 'yearly' ? '' : 'none';
        });
    }
    
    // 收集循环任务参数
    function collectRecurrenceParams(prefix) {
        const frequency = document.getElementById(prefix + '-frequency')?.value || 'daily';
        const timeVal = document.getElementById(prefix + '-time')?.value || '08:00';
        const interval = parseInt(document.getElementById(prefix + '-interval')?.value || '1');
        const params = { frequency, time: timeVal, interval };
        
        if (frequency === 'weekly') {
            const dowCheckboxes = document.querySelectorAll('.' + prefix + '-dow:checked');
            params.days_of_week = Array.from(dowCheckboxes).map(cb => parseInt(cb.value));
        } else if (frequency === 'monthly') {
            params.day_of_month = parseInt(document.getElementById(prefix + '-day-of-month')?.value || '1');
        } else if (frequency === 'yearly') {
            params.month = parseInt(document.getElementById(prefix + '-month')?.value || '1');
            params.day = parseInt(document.getElementById(prefix + '-year-day')?.value || '1');
        }
        return params;
    }
    
    // 加载定时任务列表
    async function loadScheduleTasks() {
        openPanel('定时任务');
        
        const [tasksRes, toolsRes, notifiersRes] = await Promise.all([
            metayayReq('GET', '/admin/api/schedule/list', null),
            loadScheduleMcpTools(),
            loadScheduleNotifiers()
        ]);
        
        if (!tasksRes.ok || tasksRes.data.code !== 200) {
            setError(panelList, tasksRes.error || tasksRes.data?.response || '未知错误');
            return;
        }
        
        const tasks = tasksRes.data.data || [];
        
        // 渲染任务列表
        if (tasks.length === 0) {
            panelList.innerHTML = '';
            panelList.appendChild(getTpl('tpl-schedule-empty'));
        } else {
            const statusMap = {
                'active': { text: '运行中', color: '#4caf50', icon: '▶' },
                'paused': { text: '已暂停', color: '#ff9800', icon: '⏸' },
                'completed': { text: '已完成', color: '#78909c', icon: '✓' },
                'failed': { text: '已失效', color: '#f44336', icon: '✕' },
            };
            
            const itemsHtml = tasks.map(t => {
                const st = statusMap[t.status] || { text: t.status, color: '#888', icon: '?' };
                const typeLabel = t.task_type === 'recurring' ? '循环' : '一次性';
                const typeIcon = t.task_type === 'recurring' ? '🔄' : '⏱';
                const nextTime = t.next_run_at ? new Date(t.next_run_at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
                const lastStatus = t.last_log_status === 'success' ? '✓' : (t.last_log_status === 'failed' ? '✕' : '');
                
                // 计算下次执行的相对时间
                let relativeTime = '';
                if (t.next_run_at) {
                    const diff = new Date(t.next_run_at) - new Date();
                    if (diff > 0) {
                        const hours = Math.floor(diff / 3600000);
                        const mins = Math.floor((diff % 3600000) / 60000);
                        if (hours > 0) {
                            relativeTime = hours + '小时' + mins + '分钟后';
                        } else {
                            relativeTime = mins + '分钟后';
                        }
                    }
                }
                
                return '<div class="schedule-item" data-id="' + t.id + '" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all 0.2s;">' +
                    '<div style="display:flex;align-items:flex-start;gap:10px;">' +
                        '<div style="flex-shrink:0;width:4px;height:100%;min-height:50px;border-radius:2px;background:' + st.color + ';opacity:0.8;"></div>' +
                        '<div style="flex:1;min-width:0;">' +
                            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
                                '<span style="font-size:14px;" title="' + typeLabel + '">' + typeIcon + '</span>' +
                                '<span style="color:#eee;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">' + (t.name || '未命名') + '</span>' +
                                '<span style="background:' + st.color + ';color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;white-space:nowrap;">' + st.icon + ' ' + st.text + '</span>' +
                            '</div>' +
                            (t.description ? '<div style="color:#999;font-size:11px;margin-bottom:6px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + t.description + '">' + t.description + '</div>' : '') +
                            '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;">' +
                                '<span style="color:#888;">⏰ 下次: <span style="color:#64b4ff;">' + nextTime + '</span></span>' +
                                (relativeTime ? '<span style="color:#64b4ff;opacity:0.7;">(' + relativeTime + ')</span>' : '') +
                                '<span style="color:#888;">📊 执行: <span style="color:#aaa;">' + t.total_run_count + '次</span></span>' +
                                (lastStatus ? '<span style="color:#888;">结果: <span style="color:' + (lastStatus === '✓' ? '#4caf50' : '#f44336') + ';">' + lastStatus + '</span></span>' : '') +
                            '</div>' +
                            (t.recurrence_display ? '<div style="color:#64b4ff;font-size:10px;margin-top:6px;padding:4px 8px;background:rgba(100,180,255,0.1);border-radius:4px;display:inline-block;">🔄 ' + t.recurrence_display + '</div>' : '') +
                        '</div>' +
                        '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">' +
                            '<button class="schedule-toggle" data-id="' + t.id + '" data-status="' + t.status + '" style="border:none;background:' + (t.status === 'active' ? 'rgba(255,152,0,0.2)' : 'rgba(76,175,80,0.2)') + ';color:' + (t.status === 'active' ? '#ff9800' : '#4caf50') + ';cursor:pointer;font-size:11px;padding:4px 8px;border-radius:4px;transition:all 0.2s;" title="' + (t.status === 'active' ? '暂停' : '启用') + '">' + (t.status === 'active' ? '⏸ 暂停' : '▶ 启用') + '</button>' +
                            '<button class="schedule-delete" data-id="' + t.id + '" style="border:none;background:rgba(244,67,54,0.2);color:#f44336;cursor:pointer;font-size:11px;padding:4px 8px;border-radius:4px;transition:all 0.2s;" title="删除">✕ 删除</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
            panelList.innerHTML = itemsHtml + 
                '<div style="text-align:center;padding:16px 0 8px;">' +
                    '<button id="schedule-add-trigger" class="schedule-add-btn" style="padding:10px 24px;border-radius:8px;border:2px dashed rgba(100,180,255,0.4);background:rgba(100,180,255,0.08);color:#64b4ff;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">' +
                        '<span style="font-size:16px;margin-right:6px;">+</span> 新增定时任务' +
                    '</button>' +
                '</div>';
            
            // 绑定新增按钮事件
            const addTriggerBtn = document.getElementById('schedule-add-trigger');
            if (addTriggerBtn) {
                addTriggerBtn.addEventListener('click', () => {
                    openScheduleAddModal();
                });
            }
            
            // 绑定事件
            panelList.querySelectorAll('.schedule-toggle').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await metayayReq('POST', '/admin/api/schedule/toggle/' + btn.dataset.id, {});
                    loadScheduleTasks();
                });
            });
            panelList.querySelectorAll('.schedule-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('确定删除此定时任务？')) return;
                    await metayayReq('POST', '/admin/api/schedule/delete/' + btn.dataset.id, {});
                    loadScheduleTasks();
                });
            });
            panelList.querySelectorAll('.schedule-item').forEach(item => {
                item.addEventListener('click', () => {
                    loadScheduleEdit(item.dataset.id);
                });
            });
        }
        
        // 移除原来的表单加载，改为显示新增按钮
        panelForm.innerHTML = '';
    }
    
    // 打开新增定时任务弹窗
    function openScheduleAddModal() {
        const overlay = document.getElementById('schedule-add-overlay');
        if (!overlay) return;
        
        overlay.style.display = 'flex';
        
        // 加载表单到弹窗中
        loadScheduleAddFormToModal();
        
        // 绑定关闭按钮
        const closeBtn = document.getElementById('schedule-add-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                closeScheduleAddModal();
            };
        }
        
        // 点击背景关闭
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeScheduleAddModal();
            }
        };
    }
    
    // 关闭新增定时任务弹窗
    function closeScheduleAddModal() {
        const overlay = document.getElementById('schedule-add-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    // 加载新增定时任务表单到弹窗
    function loadScheduleAddFormToModal() {
        const contentEl = document.getElementById('schedule-add-content');
        const formEl = document.getElementById('schedule-add-form');
        if (!contentEl || !formEl) return;
        
        contentEl.innerHTML = '';
        formEl.innerHTML = '';
        
        const formTpl = getTpl('tpl-schedule-form');
        if (!formTpl) return;
        
        // 填充动作类型下拉框
        populateActionTypeSelect(formTpl.querySelector('#schedule-action-type'), '');
        // 填充通知机器人下拉框
        populateNotifierSelect(formTpl.querySelector('#schedule-notifier-id'), '');
        
        // 设置默认时间（当前时间+1小时）
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0, 0, 0);
        const execInput = formTpl.querySelector('#schedule-execute-at');
        if (execInput) {
            const pad = n => String(n).padStart(2, '0');
            execInput.value = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        }
        
        // 绑定任务类型切换
        const typeSelect = formTpl.querySelector('#schedule-task-type');
        const timeSection = formTpl.querySelector('#schedule-time-section');
        const recurringSection = formTpl.querySelector('#schedule-recurring-section');
        const frequencySelect = formTpl.querySelector('#schedule-frequency');
        const weeklyOpts = formTpl.querySelector('#schedule-weekly-options');
        const monthlyOpts = formTpl.querySelector('#schedule-monthly-options');
        const yearlyOpts = formTpl.querySelector('#schedule-yearly-options');
        
        bindTaskTypeSwitch(typeSelect, timeSection, recurringSection, frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts);
        bindFrequencySwitch(frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts);
        
        // 绑定动作类型切换 → 渲染动态参数
        const actionSelect = formTpl.querySelector('#schedule-action-type');
        const paramsContainer = formTpl.querySelector('#schedule-params-container');
        if (actionSelect && paramsContainer) {
            actionSelect.addEventListener('change', () => {
                renderScheduleParams(paramsContainer, actionSelect.value);
            });
        }
        
        formEl.appendChild(formTpl);
        
        // 绑定添加按钮
        const addBtn = document.getElementById('schedule-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const name = document.getElementById('schedule-name')?.value.trim();
                const description = document.getElementById('schedule-description')?.value.trim() || '';
                const actionType = document.getElementById('schedule-action-type')?.value;
                const taskType = document.getElementById('schedule-task-type')?.value;
                const timezone = document.getElementById('schedule-timezone')?.value || 'UTC';
                const maxRetries = document.getElementById('schedule-max-retries')?.value || '0';
                const retryDelay = document.getElementById('schedule-retry-delay')?.value || '60';
                const timeout = document.getElementById('schedule-timeout')?.value || '';
                const notifierId = document.getElementById('schedule-notifier-id')?.value || '';
                
                if (!name) { alert('请输入任务名称'); return; }
                if (!actionType) { alert('请选择动作类型'); return; }
                
                addBtn.textContent = '创建中...';
                addBtn.disabled = true;
                
                const paramsContainer = document.getElementById('schedule-params-container');
                const actionConfig = buildScheduleActionConfig(paramsContainer);
                
                const payload = {
                    name, description, action_type: actionType, task_type: taskType,
                    timezone, max_retries: parseInt(maxRetries),
                    retry_delay_seconds: parseInt(retryDelay),
                    action_config: actionConfig,  // 直接传递对象,不要JSON.stringify
                };
                if (timeout) payload.timeout_seconds = parseInt(timeout);
                if (notifierId) payload.notifier_id = parseInt(notifierId);
                
                if (taskType === 'one_time') {
                    const execAt = document.getElementById('schedule-execute-at')?.value;
                    if (!execAt) { alert('请选择执行时间'); addBtn.textContent = '添加任务'; addBtn.disabled = false; return; }
                    payload.execute_at = execAt;
                } else {
                    const rp = collectRecurrenceParams('schedule');
                    Object.assign(payload, rp);
                }
                
                const res = await metayayReq('POST', '/admin/api/schedule/create', payload);
                if (res.ok && res.data.code === 200) {
                    closeScheduleAddModal();
                    loadScheduleTasks();
                } else {
                    alert('创建失败: ' + (res.data?.response || res.error || '未知错误'));
                    addBtn.textContent = '添加任务';
                    addBtn.disabled = false;
                }
            });
        }
    }
    
    // 加载编辑定时任务模态框
    async function loadScheduleEdit(id) {
        openEditModal('编辑定时任务');
        
        const [detailRes] = await Promise.all([
            metayayReq('GET', '/admin/api/schedule/detail/' + id, null),
            loadScheduleMcpTools(),
            loadScheduleNotifiers()
        ]);
        
        if (!detailRes.ok || detailRes.data.code !== 200) {
            setError(editContent, '加载详情失败');
            return;
        }
        
        const t = detailRes.data.data;
        
        editContent.innerHTML = '';
        const formTpl = getTpl('tpl-schedule-edit-form');
        if (formTpl) {
            // 填充动作类型下拉框
            populateActionTypeSelect(formTpl.querySelector('#edit-schedule-action-type'), t.action_type);
            // 填充通知机器人下拉框
            populateNotifierSelect(formTpl.querySelector('#edit-schedule-notifier-id'), t.notifier_id);
            
            // 填充基本值
            const nameInput = formTpl.querySelector('#edit-schedule-name');
            if (nameInput) nameInput.value = t.name || '';
            const descInput = formTpl.querySelector('#edit-schedule-description');
            if (descInput) descInput.value = t.description || '';
            const typeSelect = formTpl.querySelector('#edit-schedule-task-type');
            if (typeSelect) typeSelect.value = t.task_type || 'one_time';
            
            // 时区
            const tzSelect = formTpl.querySelector('#edit-schedule-timezone');
            if (tzSelect) tzSelect.value = t.timezone || 'UTC';
            
            // 重试策略
            const maxRetries = formTpl.querySelector('#edit-schedule-max-retries');
            if (maxRetries) maxRetries.value = t.max_retries ?? 0;
            const retryDelay = formTpl.querySelector('#edit-schedule-retry-delay');
            if (retryDelay) retryDelay.value = t.retry_delay_seconds ?? 60;
            const timeout = formTpl.querySelector('#edit-schedule-timeout');
            if (timeout) timeout.value = t.timeout_seconds ?? '';
            
            // 时间设置
            const timeSection = formTpl.querySelector('#edit-schedule-time-section');
            const recurringSection = formTpl.querySelector('#edit-schedule-recurring-section');
            const frequencySelect = formTpl.querySelector('#edit-schedule-frequency');
            const weeklyOpts = formTpl.querySelector('#edit-schedule-weekly-options');
            const monthlyOpts = formTpl.querySelector('#edit-schedule-monthly-options');
            const yearlyOpts = formTpl.querySelector('#edit-schedule-yearly-options');
            
            if (t.task_type === 'one_time') {
                timeSection.style.display = '';
                recurringSection.style.display = 'none';
                if (t.execute_at) {
                    const dt = new Date(t.execute_at);
                    const pad = n => String(n).padStart(2, '0');
                    const execInput = formTpl.querySelector('#edit-schedule-execute-at');
                    if (execInput) {
                        execInput.value = dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
                    }
                }
            } else {
                timeSection.style.display = 'none';
                recurringSection.style.display = 'flex';
                
                // 下次执行时间
                if (t.next_run_at) {
                    const dt = new Date(t.next_run_at);
                    const pad = n => String(n).padStart(2, '0');
                    const nextRunInput = formTpl.querySelector('#edit-schedule-next-run-at');
                    if (nextRunInput) {
                        nextRunInput.value = dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
                    }
                }
                
                if (t.recurrence_rule) {
                    frequencySelect.value = t.recurrence_rule.frequency || 'daily';
                    const timeInput = formTpl.querySelector('#edit-schedule-time');
                    if (timeInput) timeInput.value = t.recurrence_rule.time || '08:00';
                    const intervalInput = formTpl.querySelector('#edit-schedule-interval');
                    if (intervalInput) intervalInput.value = t.recurrence_rule.interval || 1;
                    
                    frequencySelect.dispatchEvent(new Event('change'));
                    
                    if (t.recurrence_rule.frequency === 'weekly' && t.recurrence_rule.days_of_week) {
                        formTpl.querySelectorAll('.edit-schedule-dow').forEach(cb => {
                            cb.checked = t.recurrence_rule.days_of_week.includes(parseInt(cb.value));
                        });
                    } else if (t.recurrence_rule.frequency === 'monthly' && t.recurrence_rule.day_of_month) {
                        const domInput = formTpl.querySelector('#edit-schedule-day-of-month');
                        if (domInput) domInput.value = t.recurrence_rule.day_of_month;
                    } else if (t.recurrence_rule.frequency === 'yearly') {
                        const monthInput = formTpl.querySelector('#edit-schedule-month');
                        const dayInput = formTpl.querySelector('#edit-schedule-year-day');
                        if (monthInput) monthInput.value = t.recurrence_rule.month || 1;
                        if (dayInput) dayInput.value = t.recurrence_rule.day || 1;
                    }
                }
            }
            
            bindTaskTypeSwitch(typeSelect, timeSection, recurringSection, frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts);
            bindFrequencySwitch(frequencySelect, weeklyOpts, monthlyOpts, yearlyOpts);
            
            // 绑定动作类型切换 → 渲染动态参数
            const actionSelect = formTpl.querySelector('#edit-schedule-action-type');
            const paramsContainer = formTpl.querySelector('#edit-schedule-params-container');
            if (actionSelect && paramsContainer) {
                actionSelect.addEventListener('change', () => {
                    renderScheduleParams(paramsContainer, actionSelect.value);
                });
                // 初始渲染已有参数
                if (t.action_type) {
                    renderScheduleParams(paramsContainer, t.action_type, t.action_config || {});
                }
            }
            
            editContent.appendChild(formTpl);
        }
        
        // 按钮表单
        editForm.innerHTML = '';
        const btnTpl = getTpl('tpl-schedule-edit-buttons');
        if (btnTpl) editForm.appendChild(btnTpl);
        
        document.getElementById('edit-schedule-cancel')?.addEventListener('click', closeEditModal);
        document.getElementById('edit-schedule-save')?.addEventListener('click', async () => {
            const name = document.getElementById('edit-schedule-name')?.value.trim();
            const description = document.getElementById('edit-schedule-description')?.value.trim() || '';
            const actionType = document.getElementById('edit-schedule-action-type')?.value;
            const taskType = document.getElementById('edit-schedule-task-type')?.value;
            const timezone = document.getElementById('edit-schedule-timezone')?.value || 'UTC';
            const maxRetries = document.getElementById('edit-schedule-max-retries')?.value || '0';
            const retryDelay = document.getElementById('edit-schedule-retry-delay')?.value || '60';
            const timeout = document.getElementById('edit-schedule-timeout')?.value || '';
            const notifierId = document.getElementById('edit-schedule-notifier-id')?.value || '';
            
            if (!name) { alert('请输入任务名称'); return; }
            if (!actionType) { alert('请选择动作类型'); return; }
            
            const paramsContainer = document.getElementById('edit-schedule-params-container');
            const actionConfig = buildScheduleActionConfig(paramsContainer);
            
            const payload = {
                name, description, action_type: actionType, task_type: taskType,
                timezone, max_retries: parseInt(maxRetries),
                retry_delay_seconds: parseInt(retryDelay),
                action_config: actionConfig,  // 直接传递对象,不要JSON.stringify
            };
            if (timeout) payload.timeout_seconds = parseInt(timeout);
            if (notifierId) payload.notifier_id = parseInt(notifierId);
            
            log('[Schedule] 任务类型:', taskType);
            
            if (taskType === 'one_time') {
                payload.execute_at = document.getElementById('edit-schedule-execute-at')?.value || null;
                log('[Schedule] 一次性任务 execute_at:', payload.execute_at);
            } else {
                const rp = collectRecurrenceParams('edit-schedule');
                Object.assign(payload, rp);
                log('[Schedule] 循环任务参数:', rp);
                // 循环任务也允许手动修改下次执行时间
                const nextRunAtEl = document.getElementById('edit-schedule-next-run-at');
                const nextRunAt = nextRunAtEl?.value;
                log('[Schedule] edit-schedule-next-run-at 元素:', nextRunAtEl);
                log('[Schedule] edit-schedule-next-run-at 值:', nextRunAt);
                if (nextRunAt) {
                    payload.next_run_at = nextRunAt;
                    log('[Schedule] 已添加 next_run_at 到 payload', nextRunAt);
                } else {
                    log('[Schedule] next_run_at 为空,未添加到 payload');
                }
            }
            
            log('[Schedule] 保存编辑 payload:', JSON.stringify(payload, null, 2));
            
            const saveRes = await metayayReq('POST', '/admin/api/schedule/update/' + id, payload);
            log('[Schedule] 保存编辑响应:', JSON.stringify(saveRes, null, 2));
            
            if (saveRes.ok && saveRes.data.code === 200) {
                closeEditModal();
                loadScheduleTasks();
            } else {
                alert('保存失败: ' + (saveRes.data?.response || saveRes.error || '未知错误'));
            }
        });
    }
    
    // ========== 初始化 ==========
    function init() {
        // 获取 DOM 元素
        panelOverlay = document.getElementById('panel-overlay');
        panelBox = document.getElementById('panel-box');
        panelTitle = document.getElementById('panel-title');
        panelList = document.getElementById('panel-list');
        panelForm = document.getElementById('panel-form');
        panelClose = document.getElementById('panel-close');
        editOverlay = document.getElementById('edit-overlay');
        editTitle = document.getElementById('edit-title');
        editContent = document.getElementById('edit-content');
        editForm = document.getElementById('edit-form');
        editClose = document.getElementById('edit-close');
        contextMenu = document.getElementById('context-menu');
        
        // 绑定关闭事件
        panelClose.addEventListener('click', closePanel);
        panelOverlay.addEventListener('click', (e) => {
            if (e.target === panelOverlay) closePanel();
        });
        editClose.addEventListener('click', closeEditModal);
        editOverlay.addEventListener('click', (e) => {
            if (e.target === editOverlay) closeEditModal();
        });
        
        // 绑定菜单
        document.getElementById('menu-markit')?.addEventListener('click', () => {
            loadMarkit();
            contextMenu.style.display = 'none';
        });
        document.getElementById('menu-reminder')?.addEventListener('click', () => {
            loadReminderCategories();
            contextMenu.style.display = 'none';
        });
        document.getElementById('menu-schedule')?.addEventListener('click', () => {
            loadScheduleTasks();
            contextMenu.style.display = 'none';
        });
        document.getElementById('menu-mcptools')?.addEventListener('click', () => {
            if (window.PetMCP && window.PetMCP.openPanel) {
                window.PetMCP.openPanel();
            }
            contextMenu.style.display = 'none';
        });
        document.getElementById('menu-settings')?.addEventListener('click', () => {
            log('[面板模块] 菜单-设置被点击');
            if (window.PetSettings && window.PetSettings.loadSettings) {
                window.PetSettings.loadSettings();
            }
            contextMenu.style.display = 'none';
        });
        
        log('面板模块菜单绑定完成');
    }
    
    return {
        init,
        setStateRef,
        openPanel,
        closePanel,
        loadMarkit,
        loadReminder,
        loadReminderCategories,
        loadReminderEdit,
        loadScheduleTasks,
        loadScheduleEdit,
        openEditModal,
        closeEditModal,
    };
})();

// 导出到 window（供其他模块调用）
window.PetPanels = PetPanels;

console.log('[桌宠] pet-panels.js 已加载');

