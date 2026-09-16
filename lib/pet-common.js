/**
 * 桌宠公共模块 - pet-common.js
 * 提供各模块复用的工具函数
 */

const PetCommon = (function() {
    'use strict';
    
    // ========== 调试面板 ==========
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-panel';
    debugDiv.style.cssText = 'display:none;position:fixed;top:4px;left:4px;z-index:9999;background:rgba(0,0,0,0.7);color:#0f0;font-family:monospace;font-size:11px;padding:6px 10px;border-radius:4px;max-width:380px;pointer-events:none;';
    document.body.appendChild(debugDiv);
    
    /**
     * 输出日志信息
     * @param {...any} args - 日志消息（支持多个参数）
     */
    function log(...args) {
        console.log('[桌宠]', ...args);
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        debugDiv.innerHTML += msg + '<br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    
    /**
     * 输出错误信息
     * @param {...any} args - 错误消息（支持多个参数）
     */
    function err(...args) {
        console.error('[桌宠]', ...args);
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        debugDiv.innerHTML += '<span style="color:#f55">' + msg + '</span><br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    
    /**
     * 切换调试面板显示
     */
    function toggleDebug() {
        debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
    }
    
    // ========== API 请求 ==========
    
    /**
     * 发送 metayay API 请求
     * @param {string} method - HTTP 方法 GET/POST
     * @param {string} path - API 路径
     * @param {object} data - 请求数据
     * @returns {Promise<object>} 响应结果
     */
    async function apiReq(method, path, data) {
        if (!window.petAPI || !window.petAPI.metayay_request) {
            return { ok: false, error: 'API 未就绪' };
        }
        return await window.petAPI.metayay_request({ method, path, data });
    }
    
    // ========== 时间格式化 ==========
    
    /**
     * 格式化时间为 HH:mm
     * @param {string} [timeStr] - ISO 时间字符串
     * @returns {string} 格式化后的时间
     */
    function formatTime(timeStr) {
        if (!timeStr) {
            const d = new Date();
            return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        }
        const d = new Date(timeStr);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    
    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {string|Date} date - 日期字符串或 Date 对象
     * @returns {string} 格式化后的日期
     */
    function formatDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
    }
    
    /**
     * 格式化时间为 YYYY-MM-DD HH:mm
     * @param {string} [timeStr] - ISO 时间字符串
     * @returns {string} 格式化后的时间
     */
    function formatDateTime(timeStr) {
        if (!timeStr) {
            const d = new Date();
            return formatDate(d) + ' ' + formatTime(d);
        }
        const d = new Date(timeStr);
        return formatDate(d) + ' ' + formatTime(d);
    }
    
    // ========== 面板模式 ==========
    
    /**
     * 进入面板模式（放大窗口）
     * @param {number} [width=540] - 面板宽度
     * @param {number} [height=640] - 面板高度
     */
    function enterPanelMode(width, height) {
        if (window.petAPI && window.petAPI.enter_panel_mode) {
            window.petAPI.enter_panel_mode(width, height);
        }
    }
    
    /**
     * 退出面板模式（恢复窗口）
     */
    function exitPanelMode() {
        if (window.petAPI && window.petAPI.exit_panel_mode) {
            window.petAPI.exit_panel_mode();
        }
    }
    
    // ========== 模板辅助函数 ==========
    
    /**
     * 获取模板元素的克隆
     * @param {string} id - 模板元素的 ID
     * @returns {DocumentFragment|null} 模板克隆或 null
     */
    function getTpl(id) {
        const tpl = document.getElementById(id);
        if (!tpl) return null;
        return tpl.content.cloneNode(true);
    }
    
    /**
     * 使用模板填充容器
     * @param {HTMLElement} container - 目标容器
     * @param {string} tplId - 模板 ID
     */
    function setTpl(container, tplId) {
        container.innerHTML = '';
        const tpl = getTpl(tplId);
        if (tpl) container.appendChild(tpl);
    }
    
    /**
     * 设置加载状态
     * @param {HTMLElement} container - 目标容器
     * @param {string} [msg] - 自定义消息
     */
    function setLoading(container, msg) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">' + (msg || '加载中...') + '</div>';
    }
    
    /**
     * 设置空状态
     * @param {HTMLElement} container - 目标容器
     * @param {string} [msg] - 自定义消息
     */
    function setEmpty(container, msg) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">' + (msg || '暂无数据') + '</div>';
    }
    
    /**
     * 设置错误状态
     * @param {HTMLElement} container - 目标容器
     * @param {string} [msg] - 错误消息
     */
    function setError(container, msg) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#f55;">' + (msg || '加载失败') + '</div>';
    }
    
    // ========== 导出 API ==========
    return {
        // 模板
        getTpl,
        setTpl,
        setLoading,
        setEmpty,
        setError,
        // 日志
        log,
        err,
        toggleDebug,
        // API
        apiReq,
        // 时间格式化
        formatTime,
        formatDate,
        formatDateTime,
        // 面板模式
        enterPanelMode,
        exitPanelMode,
    };
})();

// 导出到 window（供其他模块使用）
window.PetCommon = PetCommon;

console.log('[桌宠] pet-common.js 已加载');
