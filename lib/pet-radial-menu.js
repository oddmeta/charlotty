/**
 * 圆盘菜单模块
 * 负责圆盘菜单的显示、隐藏和交互
 */

(function() {
    'use strict';

    const RadialMenu = {
        menu: null,
        isOpen: false,
        centerX: 0,
        centerY: 0,
        radius: 120, // 菜单项距离中心的半径（像素）- 会根据窗口大小动态调整
        centerSize: 60, // 中心图标尺寸
        itemSize: 70, // 菜单项尺寸
        authState: { is_authenticated: false }, // 登录状态
        
        /**
         * 根据窗口大小计算合适的圆盘参数
         */
        calculateSize() {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const windowSize = Math.min(windowWidth, windowHeight);
            
            // 根据窗口大小动态调整半径
            if (windowSize < 300) {
                // 小窗口
                this.radius = 80;
                this.centerSize = 45;
                this.itemSize = 48;
            } else if (windowSize < 500) {
                // 中等窗口
                this.radius = 100;
                this.centerSize = 50;
                this.itemSize = 55;
            } else if (windowSize < 700) {
                // 标准窗口
                this.radius = 120;
                this.centerSize = 60;
                this.itemSize = 65;
            } else {
                // 大窗口
                this.radius = 150;
                this.centerSize = 70;
                this.itemSize = 75;
            }
            
            // 确保菜单项不会超出窗口边界
            const maxRadius = Math.min(windowWidth, windowHeight) / 2 - this.itemSize / 2 - 10;
            if (this.radius > maxRadius) {
                this.radius = maxRadius;
            }
            
            // 确保菜单项之间有足够间距（至少为菜单项大小的1.5倍）
            const circumference = 2 * Math.PI * this.radius;
            const minSpacing = this.itemSize * 1.5;
            const maxItemsBySpacing = Math.floor(circumference / minSpacing);
            
            // 如果间距不够，缩小菜单项或增大半径
            if (maxItemsBySpacing < 7) {
                // 计算合适的菜单项大小
                const idealItemSize = circumference / (7 * 1.5);
                if (idealItemSize < this.itemSize) {
                    this.itemSize = Math.max(40, idealItemSize); // 最小40px
                    this.centerSize = this.itemSize * 0.9;
                } else {
                    // 增大半径
                    this.radius = (7 * this.itemSize * 1.5) / (2 * Math.PI);
                }
            }
            
            console.log(`[圆盘菜单] 窗口大小: ${windowWidth}x${windowHeight}, 半径: ${this.radius}px, 菜单项: ${this.itemSize}px`);
        },
        
        /**
         * 初始化圆盘菜单
         */
        init() {
            this.menu = document.getElementById('radial-menu');
            if (!this.menu) {
                console.error('[圆盘菜单] 未找到 radial-menu 元素');
                return;
            }
            
            this.bindEvents();
            
            // 监听窗口大小变化
            window.addEventListener('resize', () => {
                if (this.isOpen) {
                    // 如果菜单已打开，重新计算尺寸
                    this.calculateSize();
                    this.menu.style.setProperty('--center-size', this.centerSize + 'px');
                    this.menu.style.setProperty('--item-size', this.itemSize + 'px');
                    this.positionItems();
                }
            });
            
            console.log('[圆盘菜单] 初始化完成');
        },
        
        /**
         * 检查鼠标是否在圆形菜单区域内
         * @param {number} mouseX - 鼠标X坐标（视口）
         * @param {number} mouseY - 鼠标Y坐标（视口）
         * @returns {boolean}
         */
        isMouseInMenuArea(mouseX, mouseY) {
            if (!this.isOpen) return false;
            const dx = mouseX - this.centerX;
            const dy = mouseY - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 允许一定容差（半个菜单项大小），方便从中心移到菜单项
            return dist <= this.radius + this.itemSize / 2;
        },
        
        /**
         * 绑定事件
         */
        bindEvents() {
            // 使用事件委托，绑定在菜单容器上
            this.menu.addEventListener('click', (e) => {
                // 查找点击的菜单项
                const menuItem = e.target.closest('.radial-menu-item');
                if (menuItem) {
                    e.stopPropagation();
                    const action = menuItem.getAttribute('data-action');
                    console.log('[圆盘菜单] 点击菜单项:', action);
                    this.handleAction(action);
                    this.close();
                    return;
                }
                
                // 点击中心关闭
                const centerElement = e.target.closest('.radial-menu-center');
                if (centerElement) {
                    e.stopPropagation();
                    console.log('[圆盘菜单] 点击中心，关闭菜单');
                    this.close();
                    return;
                }
            });
            
            // 鼠标移动时检测是否在圆形菜单区域内
            document.addEventListener('mousemove', (e) => {
                if (this.isOpen && !this.isMouseInMenuArea(e.clientX, e.clientY)) {
                    console.log('[圆盘菜单] 鼠标移出菜单区域，自动关闭');
                    this.close();
                }
            });
            
            // ESC键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
            
            console.log('[圆盘菜单] 事件绑定完成');
        },
        
        /**
         * 打开圆盘菜单
         * @param {number} x - 中心X坐标
         * @param {number} y - 中心Y坐标
         */
        open(x, y) {
            if (!this.menu) return;
            
            // 计算适合的尺寸
            this.calculateSize();
            
            this.centerX = x;
            this.centerY = y;
            
            // 根据登录状态显示/隐藏登录菜单项
            this.updateAuthMenuItem();
            
            // 设置菜单位置
            this.menu.style.left = x + 'px';
            this.menu.style.top = y + 'px';
            this.menu.style.display = 'block';
            
            // 使用CSS变量设置尺寸
            this.menu.style.setProperty('--center-size', this.centerSize + 'px');
            this.menu.style.setProperty('--item-size', this.itemSize + 'px');
            
            // 计算并设置菜单项位置
            this.positionItems();
            
            // 添加active类触发动画
            requestAnimationFrame(() => {
                this.menu.classList.add('active');
            });
            
            this.isOpen = true;
            console.log('[圆盘菜单] 打开于:', x, y, ', 半径:', this.radius, 'px');
        },
        
        /**
         * 关闭圆盘菜单
         */
        close() {
            if (!this.menu || !this.isOpen) return;
            
            this.menu.classList.remove('active');
            
            // 等待动画结束后隐藏
            setTimeout(() => {
                this.menu.style.display = 'none';
                this.isOpen = false;
            }, 300);
            
            console.log('[圆盘菜单] 关闭');
        },
        
        /**
         * 计算并设置菜单项的圆形位置
         */
        positionItems() {
            const allItems = this.menu.querySelectorAll('.radial-menu-item');
            // 过滤出可见的菜单项
            const visibleItems = Array.from(allItems).filter(item => item.style.display !== 'none');
            const count = visibleItems.length;
            if (count === 0) return;
            
            const angleStep = (2 * Math.PI) / count;
            const startAngle = -Math.PI / 2; // 从顶部开始
            
            visibleItems.forEach((item, index) => {
                const angle = startAngle + angleStep * index;
                const x = Math.cos(angle) * this.radius;
                const y = Math.sin(angle) * this.radius;
                
                item.style.left = x + 'px';
                item.style.top = y + 'px';
            });
        },
        
        /**
         * 处理菜单项点击
         * @param {string} action - 动作标识
         */
        handleAction(action) {
            console.log('[圆盘菜单] 执行动作:', action);
            
            switch(action) {
                case 'markit':
                    if (window.PetPanels && window.PetPanels.loadMarkit) {
                        window.PetPanels.loadMarkit();
                    } else {
                        console.error('[圆盘菜单] PetPanels.loadMarkit 方法不存在');
                    }
                    break;
                case 'reminder':
                    if (window.PetPanels && window.PetPanels.loadReminderCategories) {
                        window.PetPanels.loadReminderCategories();
                    } else {
                        console.error('[圆盘菜单] PetPanels.loadReminderCategories 方法不存在');
                    }
                    break;
                case 'schedule':
                    if (window.PetPanels && window.PetPanels.loadScheduleTasks) {
                        window.PetPanels.loadScheduleTasks();
                    } else {
                        console.error('[圆盘菜单] PetPanels.loadScheduleTasks 方法不存在');
                    }
                    break;
                case 'mcptools':
                    if (window.PetMCP && window.PetMCP.openPanel) {
                        window.PetMCP.openPanel();
                    } else {
                        console.error('[圆盘菜单] PetMCP.openPanel 方法不存在');
                    }
                    break;
                case 'settings':
                    if (window.PetSettings && window.PetSettings.loadSettings) {
                        window.PetSettings.loadSettings();
                    } else {
                        console.error('[圆盘菜单] PetSettings.loadSettings 方法不存在');
                    }
                    break;
                case 'auth':
                    if (window.petAPI && window.petAPI.open_login) {
                        window.petAPI.open_login();
                    } else {
                        console.error('[圆盘菜单] petAPI.open_login 方法不存在');
                    }
                    break;
                case 'exit':
                    if (window.petAPI && window.petAPI.close_window) {
                        window.petAPI.close_window();
                    } else {
                        console.error('[圆盘菜单] petAPI.close_window 方法不存在');
                    }
                    break;
                default:
                    console.warn('[圆盘菜单] 未知动作:', action);
            }
        },
        
        /**
         * 切换菜单显示
         * @param {number} x - 中心X坐标
         * @param {number} y - 中心Y坐标
         */
        toggle(x, y) {
            if (this.isOpen) {
                this.close();
            } else {
                this.open(x, y);
            }
        },
        
        /**
         * 设置登录状态
         * @param {boolean} is_authenticated - 是否已登录
         */
        setAuthState(is_authenticated) {
            this.authState.is_authenticated = is_authenticated;
        },
        
        /**
         * 更新登录菜单项的显示状态
         * 未登录时显示登录菜单项，已登录时隐藏
         */
        updateAuthMenuItem() {
            if (!this.menu) return;
            
            const authItem = this.menu.querySelector('[data-action="auth"]');
            if (!authItem) return;
            
            if (this.authState.is_authenticated) {
                // 已登录，隐藏登录菜单项
                authItem.style.display = 'none';
            } else {
                // 未登录，显示登录菜单项
                authItem.style.display = 'flex';
            }
        }
    };
    
    // 暴露到全局
    window.RadialMenu = RadialMenu;
    
})();
