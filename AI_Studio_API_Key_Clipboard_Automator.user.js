// ==UserScript==
// @name         AI Studio 多功能脚本合集（更新版）
// @namespace    http://tampermonkey.net/
// @version      1.4.5
// @description  此脚本整合了三个主要功能：项目创建、API KEY 自动生成、API KEY 提取。生成/提取完 API KEY 后自动复制到剪贴板；若失败则弹出 textarea 兜底，手机浏览器也可一键长按复制。
// @author       YourName
// @match        *://*.console.cloud.google.com/*
// @match        *://*.aistudio.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    /********** 公共工具 **********/
    const delay = ms => new Promise(r => setTimeout(r, ms));
    async function waitForElement(sel, timeout = 15000, root = document, checkDisabled = true) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            let el;
            try { el = root.querySelector(sel); } catch {}
            if (el && el.offsetParent !== null) {
                const st = getComputedStyle(el);
                if (st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0 && (!checkDisabled || !el.disabled)) {
                    return el;
                }
            }
            await delay(250);
        }
        throw new Error(`等待元素 "${sel}" 超时 (${timeout}ms)`);
    }
    async function waitForElements(sel, min = 1, timeout = 20000, root = document) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const list = root.querySelectorAll(sel);
            if (list.length >= min && list[0].offsetParent !== null) return list;
            await delay(300);
        }
        throw new Error(`超时：等待至少 ${min} 个元素 "${sel}"`);
    }

    /********** 1. 项目创建流程 **********/
    async function runProjectCreation() {
        if (!/console\.cloud\.google\.com/.test(location.host)) {
            location.href = "https://console.cloud.google.com";
            return;
        }
        const TARGET = 5, BETWEEN = 5000, MAXR = 5, RK = 'aiStudioAutoRefreshCountSilentColorOpt';
        let success = 0, refreshCount = +GM_getValue(RK, '0');

        async function checkLimit() {
            try {
                if (document.querySelector('a#p6ntest-quota-submit-button')) return true;
                const texts = [...document.querySelectorAll('mat-dialog-content p, mat-dialog-content div, mat-dialog-container p, mat-dialog-container div')];
                if (texts.some(el => /quota (limit|has been reached|creation limit)/i.test(el.textContent))) return true;
            } catch {}
            return false;
        }
        async function tryCloseDialog() {
            const sels = ['button[aria-label="Close dialog"]','button[aria-label="关闭"]','mat-dialog-actions button:nth-child(1)','button.cancel-button','button:contains("Cancel")','button:contains("取消")'];
            for (let sel of sels) {
                let btn = null;
                if (sel.includes(':contains')) {
                    const txt = sel.match(/:contains\(["']?([^"']+)/)?.[1]?.toLowerCase();
                    if (txt) btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().toLowerCase() === txt);
                } else {
                    btn = document.querySelector(sel);
                }
                if (btn && btn.offsetParent !== null) { btn.click(); await delay(700); return; }
            }
        }
        async function createOnce() {
            try {
                if (await checkLimit()) return { limitReached: true };
                (await waitForElement('button.mdc-button.mat-mdc-button span.cfc-switcher-button-label-text')).click();
                await delay(2000);
                if (await checkLimit()) { await tryCloseDialog(); return { limitReached: true }; }
                (await waitForElement('button.purview-picker-create-project-button')).click();
                await delay(2500);
                if (await checkLimit()) { await tryCloseDialog(); return { limitReached: true }; }
                (await waitForElement('button.projtest-create-form-submit',20000)).click();
                return { limitReached: false };
            } catch (e) {
                await tryCloseDialog();
                if (refreshCount < MAXR) {
                    GM_setValue(RK, ++refreshCount + '');
                    location.reload();
                    return { refreshed: true };
                }
                throw e;
            }
        }

        let existingProjectCount = 0;
        try {
            // 尝试查找项目列表并计数 - 此选择器是猜测，可能需要根据实际页面结构调整
            const projectTableBody = await waitForElement('div[role="main"] table tbody', 5000);
            const projectRows = projectTableBody.querySelectorAll('tr');
            existingProjectCount = projectRows.length;
            console.log(`Detected ${existingProjectCount} existing projects.`);
        } catch (e) {
            console.warn("Could not determine existing project count, proceeding with default target (5).", e);
            // 如果无法计数，为了安全起见，继续使用原有的 TARGET 值（5）
            existingProjectCount = 0; // 视为 0，允许创建最多 8 个
        }

        const projectsToCreate = Math.max(0, 8 - existingProjectCount);
        console.log(`Attempting to create ${projectsToCreate} new projects.`);

        if (projectsToCreate <= 0) {
            console.log("Existing project count is 8 or more. No new projects will be created.");
            GM_setValue(RK, '0'); // 重置刷新计数
            return; // 退出函数
        }

        for (let i = 1; i <= projectsToCreate; i++) {
            const res = await createOnce();
            if (res.limitReached) break;
            if (res.refreshed) return;
            success++;
            if (i < projectsToCreate) await delay(BETWEEN);
        }
        GM_setValue(RK, '0');
    }

    /********** 2. API KEY 自动生成 **********/
    async function runApiKeyCreation() {
        const mainBtnSel = "button.create-api-key-button",
              dialogSel  = "mat-dialog-content",
              projInput  = "input#project-name-input",
              optionSel  = "mat-option.mat-mdc-option",
              nameInOpt  = ".gmat-body-medium",
              dialogCreateSel = "mat-dialog-content button.create-api-key-button",
              keyDisplaySel   = "div.apikey-text";
        const summary = {}, allKeys = [];

        // --- New code to get existing keys ---
        const projectsWithExistingKeys = new Set();
        try {
            const rows = document.querySelectorAll("project-table div[role='rowgroup'].table-body > div[role='row'].table-row");
            for (const row of rows) {
                const nameEl = row.querySelector("div[role='cell'].project-cell > div:first-child");
                const linkEl = row.querySelector("div[role='cell'].project-cell + div[role='cell'].key-cell a.apikey-link");
                if (nameEl && linkEl) { // If a project row has a key link, assume it has a key
                    projectsWithExistingKeys.add(nameEl.textContent.trim());
                }
            }
            console.log(`Found ${projectsWithExistingKeys.size} projects with existing keys.`);
        } catch (e) {
            console.warn("Could not determine projects with existing keys.", e);
            // If unable to get existing keys, proceed with creation for all projects found in the dropdown later
        }
        // --- End new code ---

        async function waitEl(sel,t=20000,root=document,chk=true) {
            const start = Date.now();
            while (Date.now()-start < t) {
                let el=null;
                try { el = root.querySelector(sel); } catch {}
                if (el && el.offsetParent!==null && (!chk||!el.disabled)) {
                    const st = getComputedStyle(el);
                    if (st.display!=='none'&&st.visibility!=='hidden'&&+st.opacity>0) return el;
                }
                await delay(300);
            }
            throw new Error(`元素 "${sel}" 等待超时`);
        }
        async function closeDialog() {
            const sels = ["button[aria-label='关闭']","button.close-button","button:contains('Done')","button:contains('完成')","button:contains('Close')","mat-dialog-actions button:last-child"];
            for (let sel of sels) {
                try {
                    let btn = await waitEl(sel,3000,document,false);
                    btn.click(); await delay(1000);
                    if (!document.querySelector("mat-dialog-container")) return;
                } catch {}
            }
            document.body.click();
            await delay(1000);
        }

        // 取项目列表
        let projectCount = 0, projectInfo = [];
        try {
            const btn0 = await waitEl(mainBtnSel);
            btn0.click();
            const d0 = await waitEl(dialogSel);
            const inp0 = await waitEl(projInput,15000,d0);
            inp0.click(); await delay(2000);
            const opts0 = await waitForElements(optionSel,1,20000,document);
            projectCount = opts0.length;
            projectInfo = Array.from(opts0).map((o,i) => {
                let name = `项目 ${i+1}`;
                const el = o.querySelector(nameInOpt);
                if (el?.textContent) name = el.textContent.trim();
                return { name };
            });
            await closeDialog();
        } catch (e) {
            console.error("获取项目列表失败", e);
            return;
        }
        if (!projectCount) return;

        // 每个项目生成 key (确保每个项目只尝试生成一次)
        for (let pi = 0; pi < projectCount; pi++) {
            const projName = projectInfo[pi].name;
            summary[projName] = [];
            // ---- 移除了内层 for (let ki = 0; ki < 1; ki++) 循环 ----
            // --- New check for existing key ---
            if (projectsWithExistingKeys.has(projName)) { // Check if project name is in the set of projects with existing keys
                console.log(`项目 "${projName}" 已有 API Key，跳过生成。`);
                continue; // Skip to the next project in the loop
            }
            // --- End new check ---

            try {
                (await waitEl(mainBtnSel)).click();
                await delay(500);
                const dlg1 = await waitEl(dialogSel);
                (await waitEl(projInput,15000,dlg1)).click();
                await delay(2000);
                const opts1 = await waitForElements(optionSel, projectCount, 20000, document);

                // 检查索引是否有效，防止列表在操作过程中变化
                if (pi < opts1.length) {
                    opts1[pi].click();
                    // 触发 change 事件可能不是必需的，但保留以防万一
                    opts1[pi].dispatchEvent(new Event('change',{bubbles:true}));
                    await delay(1500);
                    (await waitEl(dialogCreateSel,10000,dlg1,false)).click();
                    const keyEl = await waitForElement(keyDisplaySel,25000,document,false);
                    let key = keyEl.textContent?.trim()||keyEl.value||'';

                    // 仅当成功获取到 key 时才记录
                    if (key) {
                        summary[projName].push(key);
                        allKeys.push(`${projName}: ${key}`);
                        console.log(`${projName}: ${key}`);
                    } else {
                         console.warn(`项目 "${projName}" 生成的 key 为空或获取失败。`);
                    }
                    await closeDialog();
                    // 等待一段时间再处理下一个项目，避免过快操作
                    await delay(2500);
                } else {
                    console.error(`项目索引 ${pi} 超出选项列表范围 (${opts1.length})，跳过此项目。`);
                    // 如果项目索引无效，也尝试关闭可能打开的对话框
                    await closeDialog();
                }

            } catch (e) {
                console.error(`项目 "${projName}" 生成 key 时发生错误`, e);
                // 确保出错时也尝试关闭对话框
                await closeDialog();
            }
            // 在处理下一个项目之前增加延时，无论成功与否
            await delay(4000);
        }

        // 复制或弹出
        if (allKeys.length) {
            const text = allKeys.join(',\n');
            try {
                GM_setClipboard(text, 'text');
                alert(`已复制 ${allKeys.length} 个 API KEY 到剪贴板`);
            } catch {
                const ta = document.createElement('textarea');
                Object.assign(ta.style, {position:'fixed',top:'10%',left:'5%',width:'90%',height:'80%',zIndex:10000,fontSize:'14px'});
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                alert('剪贴板写入被拦截，已在页面弹出所有 KEY，请手动复制');
            }
            return allKeys.length; // 返回成功获取的 API Key 数量
        }
        return allKeys.length; // 返回成功获取的 API Key 数量
    }

    /********** 3. 提取现有 API KEY **********/
    async function runExtractKeys() {
        console.clear();
        const rowSel       = "project-table div[role='rowgroup'].table-body > div[role='row'].table-row",
              nameCell     = "div[role='cell'].project-cell > div:first-child",
              linkSel      = "div[role='cell'].project-cell + div[role='cell'].key-cell a.apikey-link",
              fullKeySel   = "div.apikey-text";
        const allKeys = [], byProj = {};

        async function waitLocal(sel,t=15000) {
            const start = Date.now();
            while (Date.now()-start < t) {
                const el = document.querySelector(sel);
                if (el?.offsetParent!==null && getComputedStyle(el).display!=='none') return el;
                await delay(300);
            }
            throw new Error(`等待 "${sel}" 超时`);
        }
        async function closeReveal() {
            const sels = ["button[aria-label='关闭']"];
            for (let sel of sels) {
                try {
                    let b = await waitLocal(sel,5000);
                    b.click(); await delay(1200);
                    if (!document.querySelector(fullKeySel)) return;
                } catch {}
            }
            document.body.click(); await delay(1200);
        }

        const rows = document.querySelectorAll(rowSel);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let pname = `项目 ${i+1}`;
            const nmEl = row.querySelector(nameCell);
            if (nmEl?.textContent) pname = nmEl.textContent.trim();
            byProj[pname] = [];
            const links = row.querySelectorAll(linkSel);
            for (let j = 0; j < links.length; j++) {
                try {
                    links[j].click(); await delay(600);
                    const full = await waitLocal(fullKeySel,25000);
                    let key = full.textContent?.trim()||full.value||'';
                    if (key && !allKeys.includes(key)) {
                        allKeys.push(`${pname}: ${key}`);
                        byProj[pname].push(key);
                        console.log(`${pname}: ${key}`);
                    }
                    await closeReveal(); await delay(1500);
                } catch (e) {
                    console.error(`提取 ${pname} 的第${j+1}个 key 失败`, e);
                    try { await closeReveal(); } catch {}
                }
            }
        }

        if (allKeys.length) {
            const text = allKeys.join(',\n');
            try {
                GM_setClipboard(text,'text');
                alert(`已复制 ${allKeys.length} 个 API KEY 到剪贴板`);
            } catch {
                const ta = document.createElement('textarea');
                Object.assign(ta.style, {position:'fixed',top:'10%',left:'5%',width:'90%',height:'80%',zIndex:10000,fontSize:'14px'});
                ta.value = text; document.body.appendChild(ta); ta.select();
                alert('剪贴板写入被拦截，已在页面弹出所有 KEY，请手动复制');
            }
        }
    }

    /********** 入口 & 按钮 **********/
    async function createAndFetch() {
        if (/console\.cloud\.google\.com/.test(location.host)) {
            await runProjectCreation();
            GM_setValue("projectsCreated", true);
            const savedAuthuser = GM_getValue('aiStudioAuthuser', '0');
            location.href = `https://aistudio.google.com${savedAuthuser !== '0' ? `/u/${savedAuthuser}` : ''}/apikey`;
        } else {
            await runApiKeyCreation();
        }
    }
    if (/aistudio\.google\.com/.test(location.host) && GM_getValue("projectsCreated",false)) {
        GM_setValue("projectsCreated", false);
        delay(1000).then(runApiKeyCreation);
    }

    function initButtons() {
        if (document.getElementById('ai-floating-buttons')) return;
        const c = document.createElement('div');
        c.id = 'ai-floating-buttons';
        
        // 初始位置设为右侧中间
        const initialRight = '10px';
        const initialTop = `${Math.max(10, (window.innerHeight - 100) / 2)}px`;
        
        Object.assign(c.style, {
            position: 'fixed',
            top: initialTop,
            right: initialRight,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            background: 'rgba(255,255,255,0.9)',
            padding: '5px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'move', // 指示可拖动
            userSelect: 'none' // 防止文本选择
        });
        
        // 添加拖动条样式，作为提示
        const dragHandle = document.createElement('div');
        dragHandle.style.cssText = 'height:6px;width:100%;background:#e0e0e0;border-radius:3px;margin-bottom:5px;';
        c.appendChild(dragHandle);
        
        const btn1 = document.createElement('button'), btn2 = document.createElement('button');
        btn1.textContent='创建项目并获取API KEY'; btn2.textContent='提取API KEY';
        [btn1,btn2].forEach(b=>{
            Object.assign(b.style,{padding:'5px 10px',fontSize:'14px',cursor:'pointer'});
            c.appendChild(b);
        });
        document.body.appendChild(c);

        // 添加拖拽功能
        let isDragging = false;
        let offsetX, offsetY;

        function handleMouseDown(e) {
            isDragging = true;
            const rect = c.getBoundingClientRect();
            // 计算鼠标点击位置与面板左上角的偏移
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            // 添加临时样式
            c.style.opacity = '0.8';
        }

        function handleMouseMove(e) {
            if (!isDragging) return;
            
            // 计算新位置
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;
            
            // 确保不超出视口
            const maxLeft = window.innerWidth - c.offsetWidth;
            const maxTop = window.innerHeight - c.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            // 使用left而不是right，因为拖动时使用left更直观
            c.style.left = `${newLeft}px`;
            c.style.top = `${newTop}px`;
            c.style.right = 'auto';
        }

        function handleMouseUp() {
            if (isDragging) {
                isDragging = false;
                c.style.opacity = '1';
            }
        }

        // 绑定拖拽事件
        c.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        btn1.onclick = async ()=>{
            btn1.disabled=true; btn1.textContent='运行中...'; // 立即禁用按钮并更新文本

            if (/aistudio\.google\.com/.test(location.host)) {
                // 在 AI Studio 页面
                try {
                    // 优先尝试获取现有项目的 API Key
                    const createdKeyCount = await runApiKeyCreation();
                    console.log(`尝试创建/提取 API Key，找到 ${createdKeyCount} 个。`);

                    // 设定一个阈值，例如如果少于 8 个 Key，则认为需要创建更多项目
                    const MIN_KEYS_NEEDED = 8;

                    if (createdKeyCount < MIN_KEYS_NEEDED) {
                        console.log(`找到的 Key 少于 ${MIN_KEYS_NEEDED} 个。正在跳转以创建更多项目。`);
                        // 需要创建更多项目，跳转到 Google Cloud Console
                        const match = location.href.match(/\/u\/(\d+)\/apikey/);
                        const authuser = match ? match[1] : '0'; // 默认使用 0
                        GM_setValue('aiStudioAuthuser', authuser); // 保存用户顺序号
                        const targetUrl = `https://console.cloud.google.com${authuser !== '0' ? `?authuser=${authuser}` : ''}`;
                        location.href = targetUrl;
                        // 脚本将在跳转后的页面继续执行
                    } else {
                        console.log(`找到 ${createdKeyCount} 个 Key。无需创建更多项目。`);
                        btn1.textContent='完成'; // 任务在此页面完成
                        setTimeout(()=>{btn1.disabled=false;btn1.textContent='创建项目并获取API KEY';},3000); // 重新启用按钮
                    }
                } catch(e) {
                    console.error("在 AI Studio 页面创建/提取 API Key 时发生错误:", e);
                    btn1.textContent='错误';
                    setTimeout(()=>{btn1.disabled=false;btn1.textContent='创建项目并获取API KEY';},3000); // 错误时重新启用按钮
                }

            } else if (/console\.cloud\.google\.com/.test(location.host)) {
                // 在 Google Cloud Console 页面 (从 AI Studio 跳转过来后执行)
                try {
                    await createAndFetch(); // 执行项目创建并跳转回 AI Studio
                    // 脚本将在跳转后的页面继续执行
                } catch(e) {
                    console.error("在 Google Cloud Console 页面创建项目时发生错误:", e);
                    btn1.textContent='错误';
                    setTimeout(()=>{btn1.disabled=false;btn1.textContent='创建项目并获取API KEY';},3000); // 错误时重新启用按钮
                }
            } else {
                 // 不在 AI Studio 或 Google Cloud Console 页面，先跳转到 AI Studio
                const match = location.href.match(/\/u\/(\d+)\//); // 尝试从任意 google.com 域名提取用户顺序号
                const authuserSegment = match ? `/u/${match[1]}` : '';
                location.href = `https://aistudio.google.com${authuserSegment}/apikey`;
                // 脚本将在跳转后的页面继续执行
            }
        };
        btn2.onclick = async ()=>{
            if (!/aistudio\.google\.com/.test(location.host)) { location.href="https://aistudio.google.com/apikey"; return; }
            btn2.disabled=true; btn2.textContent='运行中...';
            try { await runExtractKeys(); btn2.textContent='完成'; }
            catch(e){ console.error(e); btn2.textContent='错误'; }
            setTimeout(()=>{btn2.disabled=false;btn2.textContent='提取API KEY';},3000);
        };
        
        // 防止按钮点击触发拖动
        btn1.addEventListener('mousedown', e => e.stopPropagation());
        btn2.addEventListener('mousedown', e => e.stopPropagation());
        
        // 防止可能的触摸设备上的拖动问题
        c.addEventListener('touchstart', e => {
            const touch = e.touches[0];
            handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        
        document.addEventListener('touchmove', e => {
            if (!isDragging) return;
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            e.preventDefault(); // 防止页面滚动
        }, { passive: false });
        
        document.addEventListener('touchend', handleMouseUp);
    }

    new MutationObserver(initButtons).observe(document,{childList:true,subtree:true});
    window.addEventListener('DOMContentLoaded',initButtons);
    window.addEventListener('load',initButtons);
    setInterval(initButtons,1000);

    // SPA 路由监听
    (()=>{
        const wrap=(t)=>{
            const orig=history[t];
            history[t]=function(){
                const rv=orig.apply(this,arguments);
                window.dispatchEvent(new Event(t));
                window.dispatchEvent(new Event('locationchange'));
                return rv;
            };
        };
        wrap('pushState'); wrap('replaceState');
        window.addEventListener('popstate',()=>window.dispatchEvent(new Event('locationchange')));
    })();
    window.addEventListener('locationchange',initButtons);

    // 初始挂载
    delay(3000).then(initButtons);

})();
