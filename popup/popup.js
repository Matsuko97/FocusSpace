/**
 * popup.js — FocusSpace 弹窗入口
 * 负责视图切换、场景 CRUD、便签注入触发
 */

(function () {
  'use strict';

  // ========== DOM 引用 ==========
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPill = document.getElementById('tab-pill');
  const viewScenes = document.getElementById('view-scenes');
  const viewOverview = document.getElementById('view-overview');
  const btnOpenNote = document.getElementById('btn-open-note');

  const inputSceneName = document.getElementById('input-scene-name');
  const btnSaveScene = document.getElementById('btn-save-scene');
  const sceneListEl = document.getElementById('scene-list');
  const emptyScenes = document.getElementById('empty-scenes');

  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmMsg = document.getElementById('confirm-msg');
  const confirmOk = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');

  // ========== 视图切换（滑动 pill 动画） ==========
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.view;
      const isRight = target === 'overview';
      tabPill.classList.toggle('right', isRight);

      viewScenes.classList.toggle('active', target === 'scenes');
      viewOverview.classList.toggle('active', target === 'overview');

      if (target === 'overview') {
        loadTabOverview();
      }
    });
  });

  // ========== 确认弹窗 ==========
  let _confirmResolve = null;

  function showConfirm(message) {
    confirmMsg.textContent = message;
    confirmOverlay.hidden = false;
    return new Promise(resolve => { _confirmResolve = resolve; });
  }

  confirmOk.addEventListener('click', () => {
    confirmOverlay.hidden = true;
    if (_confirmResolve) _confirmResolve(true);
    _confirmResolve = null;
  });

  confirmCancel.addEventListener('click', () => {
    confirmOverlay.hidden = true;
    if (_confirmResolve) _confirmResolve(false);
    _confirmResolve = null;
  });

  // ========== 时间格式化 ==========
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // ========== 场景列表渲染 ==========
  async function renderSceneList() {
    const workspaces = await Storage.getWorkspaces();

    // 清除旧的场景卡片（保留 empty-state）
    sceneListEl.querySelectorAll('.scene-card').forEach(el => el.remove());

    if (workspaces.length === 0) {
      emptyScenes.hidden = false;
      return;
    }
    emptyScenes.hidden = true;

    workspaces.forEach((ws, idx) => {
      const card = document.createElement('div');
      card.className = 'scene-card';
      if (idx < 10) card.style.animationDelay = `${idx * 0.04}s`;

      const lastHistory = ws.history && ws.history.length > 0
        ? ws.history[ws.history.length - 1]
        : null;
      const lastActionBadge = lastHistory
        ? `<span class="meta-badge ${lastHistory.action}">${lastHistory.action === 'save' ? '保存' : '恢复'}</span>`
        : '';
      const lastTimeText = lastHistory
        ? timeAgo(lastHistory.timestamp)
        : `创建于 ${timeAgo(ws.createdAt)}`;

      card.innerHTML = `
        <div class="scene-card-header">
          <div class="scene-info">
            <div class="scene-name">${escapeHtml(ws.name)}</div>
            <div class="scene-meta">
              <span class="tab-count">${ws.tabs.length} 个标签</span>
              ${lastActionBadge}
              <span>${lastTimeText}</span>
            </div>
          </div>
          <div class="scene-actions">
            <button class="btn-icon btn-ghost" data-action="restore" title="恢复场景">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 105.64-12.36L1 10"/>
              </svg>
            </button>
            <button class="btn-icon btn-ghost" data-action="rename" title="重命名">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-ghost" data-action="delete" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
            <button class="btn-icon btn-ghost" data-action="toggle" title="展开详情">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="scene-detail" id="detail-${ws.id}">
          ${renderSceneDetail(ws)}
        </div>
      `;

      // 事件委托
      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;
        const action = actionBtn.dataset.action;
        if (action === 'restore') restoreScene(ws.id);
        else if (action === 'rename') renameScene(ws.id);
        else if (action === 'delete') deleteScene(ws.id);
        else if (action === 'toggle') toggleDetail(ws.id, card);
      });

      sceneListEl.appendChild(card);
    });
  }

  function renderSceneDetail(ws) {
    const tabsHtml = ws.tabs.map(t => {
      const icon = t.favIconUrl
        ? `<img src="${escapeHtml(t.favIconUrl)}" width="13" height="13" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'favicon-fallback\\'></span>'));">`
        : '<span class="favicon-fallback"></span>';
      return `<div class="scene-tab-item">${icon}<span>${escapeHtml(t.title || t.url)}</span></div>`;
    }).join('');

    const historyHtml = (ws.history && ws.history.length > 0)
      ? `<div class="timeline">
          <div class="timeline-title">操作记录</div>
          ${ws.history.slice(-8).reverse().map(h => `
          <div class="timeline-item">
            <span class="timeline-dot ${h.action}"></span>
            <span class="timeline-badge ${h.action}">${h.action === 'save' ? '保存' : '恢复'}</span>
            <span class="timeline-time">${formatTime(h.timestamp)}</span>
            <span class="timeline-count">${h.tabCount} 个标签</span>
          </div>`).join('')}
        </div>`
      : '';

    return `
      <div class="scene-detail-tabs">${tabsHtml}</div>
      ${historyHtml}
    `;
  }

  function toggleDetail(id, card) {
    const detail = card.querySelector('.scene-detail');
    detail.classList.toggle('open');
    const chevron = card.querySelector('[data-action="toggle"] svg');
    if (detail.classList.contains('open')) {
      chevron.style.transform = 'rotate(180deg)';
    } else {
      chevron.style.transform = '';
    }
  }

  // ========== 保存场景 ==========
  btnSaveScene.addEventListener('click', saveScene);
  inputSceneName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveScene();
  });

  async function saveScene() {
    const name = inputSceneName.value.trim();
    if (!name) {
      showToast('请输入场景名称');
      inputSceneName.focus();
      return;
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(t => t.url && /^https?:\/\//.test(t.url));

    if (validTabs.length === 0) {
      showToast('当前没有可保存的标签页');
      return;
    }

    const workspaces = await Storage.getWorkspaces();

    // 检查同名场景
    const existing = workspaces.find(w => w.name === name);
    if (existing) {
      const confirmed = await showConfirm(`场景"${name}"已存在，是否覆盖？`);
      if (!confirmed) return;

      // 覆盖更新
      existing.tabs = validTabs.map(t => ({
        url: t.url,
        title: t.title || '',
        favIconUrl: t.favIconUrl || '',
        pinned: t.pinned || false
      }));
      existing.domainFingerprint = extractDomainFingerprint(validTabs);
      existing.history.push({
        action: 'save',
        timestamp: Date.now(),
        tabCount: validTabs.length
      });
      existing.updatedAt = Date.now();
    } else {
      // 新建
      const now = Date.now();
      workspaces.unshift({
        id: Storage.generateId(),
        name,
        tabs: validTabs.map(t => ({
          url: t.url,
          title: t.title || '',
          favIconUrl: t.favIconUrl || '',
          pinned: t.pinned || false
        })),
        domainFingerprint: extractDomainFingerprint(validTabs),
        history: [{
          action: 'save',
          timestamp: now,
          tabCount: validTabs.length
        }],
        createdAt: now,
        updatedAt: now
      });
    }

    await Storage.saveWorkspaces(workspaces);
    inputSceneName.value = '';
    showToast(`已保存场景「${name}」(${validTabs.length} 个标签)`);
    renderSceneList();
  }

  function extractDomainFingerprint(tabs) {
    const domains = new Set();
    tabs.forEach(t => {
      try { domains.add(new URL(t.url).hostname); } catch {}
    });
    return [...domains];
  }

  // ========== 恢复场景 ==========
  async function restoreScene(id) {
    const workspaces = await Storage.getWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return;

    // 构建当前窗口已打开的 URL 集合（去除 hash）
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const openedUrls = new Set();
    currentTabs.forEach(t => {
      const url = (t.url || t.pendingUrl || '').split('#')[0];
      if (url) openedUrls.add(url);
    });

    // 查询哪些 URL 有便签
    const allNotes = await Storage.getAllURLNotes();
    const urlsWithNotes = new Set();
    for (const t of ws.tabs) {
      const urlKey = t.url.split('#')[0];
      if (allNotes[urlKey] && allNotes[urlKey].length > 0) {
        urlsWithNotes.add(urlKey);
      }
    }

    // 追加打开未重复的标签，收集需要注入便签的 tabId
    const tabsNeedingNotes = [];
    let skippedCount = 0;
    for (const t of ws.tabs) {
      const urlKey = t.url.split('#')[0];
      if (openedUrls.has(urlKey)) {
        skippedCount++;
        continue;
      }
      const created = await chrome.tabs.create({ url: t.url, pinned: t.pinned, active: false });
      if (urlsWithNotes.has(urlKey)) {
        tabsNeedingNotes.push(created.id);
      }
    }

    // 通知 service_worker 在这些 tab 加载完成后注入便签
    if (tabsNeedingNotes.length > 0) {
      chrome.runtime.sendMessage({
        type: 'INJECT_NOTES_ON_LOAD',
        tabIds: tabsNeedingNotes
      }).catch(() => {});
    }

    // 记录 history
    ws.history.push({
      action: 'restore',
      timestamp: Date.now(),
      tabCount: ws.tabs.length
    });
    ws.updatedAt = Date.now();
    await Storage.saveWorkspaces(workspaces);

    const openedCount = ws.tabs.length - skippedCount;
    const skippedText = skippedCount > 0 ? `，跳过 ${skippedCount} 个已打开的标签` : '';
    showToast(`已恢复场景「${ws.name}」(${openedCount} 个标签${skippedText})`);
    renderSceneList();
  }

  // ========== 重命名场景 ==========
  async function renameScene(id) {
    const workspaces = await Storage.getWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return;

    // 用 inline 编辑替代 prompt
    const card = sceneListEl.querySelector(`.scene-card:has([data-action="rename"])`);
    const nameEls = sceneListEl.querySelectorAll('.scene-name');
    let targetNameEl = null;

    // 找到对应卡片的 scene-name 元素
    for (const el of nameEls) {
      if (el.textContent === ws.name) {
        targetNameEl = el;
        break;
      }
    }

    if (!targetNameEl) return;

    const oldName = ws.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input rename-input';
    input.value = oldName;
    input.style.cssText = 'height:24px; font-size:13px; padding:0 8px; width: 100%;';

    targetNameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = async () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        ws.name = newName;
        ws.updatedAt = Date.now();
        await Storage.saveWorkspaces(workspaces);
        showToast(`已重命名为「${newName}」`);
      }
      renderSceneList();
    };

    input.addEventListener('blur', finish, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
  }

  // ========== 删除场景 ==========
  async function deleteScene(id) {
    const workspaces = await Storage.getWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (!ws) return;

    const confirmed = await showConfirm(`确定删除场景「${ws.name}」？此操作不可撤回。`);
    if (!confirmed) return;

    const updated = workspaces.filter(w => w.id !== id);
    await Storage.saveWorkspaces(updated);
    showToast(`已删除场景「${ws.name}」`);
    renderSceneList();
  }

  // ========== 便签注入 ==========
  btnOpenNote.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showToast('无法获取当前标签页');
        return;
      }
      const url = tab.url || '';
      if (/^chrome(-extension)?:\/\//.test(url) || /^edge:\/\//.test(url)) {
        showToast('浏览器内部页面不支持便签');
        return;
      }
      if (/^about:/.test(url) || url === '') {
        showToast('空白页面不支持便签');
        return;
      }
      if (!/^https?:\/\//.test(url)) {
        showToast('此类型页面不支持便签');
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/note.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/note.css']
      });
      showToast('便签已注入当前页面');
    } catch (e) {
      console.error('注入便签失败:', e);
      showToast('无法在此页面注入便签');
    }
  });

  // ========== Toast ==========
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2000);
  }

  // ========== HTML 转义 ==========
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ========== 标签概览 (模块 C) ==========
  const domainListEl = document.getElementById('domain-list');
  const emptyTabs = document.getElementById('empty-tabs');
  const inputSearch = document.getElementById('input-search');
  const bottomBar = document.getElementById('bottom-bar');
  const selectedCountEl = bottomBar.querySelector('.selected-count');
  const btnCloseSelected = document.getElementById('btn-close-selected');
  const undoBar = document.getElementById('undo-bar');
  const undoText = undoBar.querySelector('.undo-text');
  const btnUndo = document.getElementById('btn-undo');

  let allTabs = [];         // 当前窗口所有 tab 原始数据
  let domainGroups = {};    // { hostname: [tab, ...] }
  let checkedTabIds = new Set();
  let undoTimer = null;

  async function loadTabOverview(preserveUndo = false) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    // 兼容新创建的 tab：URL 可能在 pendingUrl 中
    allTabs = tabs.filter(t => {
      const url = t.url || t.pendingUrl || '';
      return /^https?:\/\//.test(url);
    }).map(t => {
      // 确保 url 字段可用
      if (!t.url || t.url === 'about:blank' || t.url === 'chrome://newtab/') {
        t.url = t.pendingUrl || t.url;
      }
      return t;
    });
    checkedTabIds.clear();
    if (!preserveUndo) {
      const cache = await Storage.getUndoCache();
      if (cache && (Date.now() - cache.timestamp) < 5000) {
        showUndoBar(cache.closedTabs.length);
      } else {
        undoBar.hidden = true;
        if (cache) await Storage.clearUndoCache();
      }
    }
    bottomBar.hidden = true;
    buildDomainGroups(allTabs);
    renderDomainList();
  }

  function buildDomainGroups(tabs) {
    domainGroups = {};
    tabs.forEach(t => {
      try {
        const host = new URL(t.url).hostname;
        if (!domainGroups[host]) domainGroups[host] = [];
        domainGroups[host].push(t);
      } catch {}
    });
  }

  function getFilteredGroups() {
    const query = inputSearch.value.trim().toLowerCase();
    if (!query) return domainGroups;

    const filtered = {};
    for (const [host, tabs] of Object.entries(domainGroups)) {
      if (host.toLowerCase().includes(query)) {
        filtered[host] = tabs;
      } else {
        const matchedTabs = tabs.filter(t =>
          (t.title || '').toLowerCase().includes(query)
        );
        if (matchedTabs.length > 0) filtered[host] = matchedTabs;
      }
    }
    return filtered;
  }

  function renderDomainList() {
    // 清除旧内容（保留 empty-state）
    domainListEl.querySelectorAll('.domain-group').forEach(el => el.remove());

    const groups = getFilteredGroups();
    const sortedHosts = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    if (sortedHosts.length === 0) {
      emptyTabs.hidden = false;
      bottomBar.hidden = true;
      return;
    }
    emptyTabs.hidden = true;

    sortedHosts.forEach((host, idx) => {
      const tabs = groups[host];
      const group = document.createElement('div');
      group.className = 'domain-group';
      if (idx < 10) group.style.animationDelay = `${idx * 0.04}s`;

      // 取第一个 tab 的 favicon（含兜底）
      const firstFav = tabs[0].favIconUrl || '';
      const favHtml = firstFav
        ? `<img class="domain-favicon" src="${escapeHtml(firstFav)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=\\'domain-favicon favicon-fallback\\'></span>'));">`
        : `<span class="domain-favicon favicon-fallback"></span>`;

      group.innerHTML = `
        <div class="domain-header">
          <svg class="domain-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9,6 15,12 9,18"/>
          </svg>
          ${favHtml}
          <span class="domain-name">${escapeHtml(host)}</span>
          <span class="domain-count">${tabs.length}</span>
          <button class="btn-domain-close" title="关闭全部 ${host} 标签">✕</button>
        </div>
        <div class="domain-tabs">
          ${tabs.map(t => `
            <div class="tab-row" data-tab-id="${t.id}">
              <label>
                <input type="checkbox" ${checkedTabIds.has(t.id) ? 'checked' : ''}>
                <span>${escapeHtml(t.title || t.url)}</span>
              </label>
              <button class="btn-close-tab" title="关闭此标签">✕</button>
            </div>
          `).join('')}
        </div>
      `;

      // 展开/收起
      const header = group.querySelector('.domain-header');
      const chevron = group.querySelector('.domain-chevron');
      const tabsContainer = group.querySelector('.domain-tabs');

      header.addEventListener('click', (e) => {
        if (e.target.closest('.btn-domain-close')) return;
        tabsContainer.classList.toggle('open');
        chevron.classList.toggle('open');
      });

      // 关闭整个域名的 Tab
      group.querySelector('.btn-domain-close').addEventListener('click', () => {
        const ids = tabs.map(t => t.id);
        closeTabs(ids, `${host} 的 ${ids.length} 个标签`);
      });

      // Tab 行事件委托
      tabsContainer.addEventListener('click', (e) => {
        // 单个关闭按钮
        const closeBtn = e.target.closest('.btn-close-tab');
        if (closeBtn) {
          const row = closeBtn.closest('.tab-row');
          const tabId = parseInt(row.dataset.tabId);
          closeTabs([tabId], '1 个标签');
          return;
        }

        // 复选框
        const checkbox = e.target.closest('input[type="checkbox"]');
        if (checkbox) {
          const row = checkbox.closest('.tab-row');
          const tabId = parseInt(row.dataset.tabId);
          if (checkbox.checked) {
            checkedTabIds.add(tabId);
          } else {
            checkedTabIds.delete(tabId);
          }
          updateBottomBar();
        }
      });

      domainListEl.appendChild(group);
    });

    updateBottomBar();
  }

  function updateBottomBar() {
    if (checkedTabIds.size > 0) {
      bottomBar.hidden = false;
      selectedCountEl.textContent = `已选 ${checkedTabIds.size} 个`;
    } else {
      bottomBar.hidden = true;
    }
  }

  // ========== 批量关闭 ==========
  async function closeTabs(tabIds, description) {
    if (tabIds.length === 0) return;

    // 排除当前活动 Tab，防止 popup 关闭
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTab ? activeTab.id : null;
    let excludedActive = false;

    const idsToClose = tabIds.filter(id => {
      if (id === activeTabId) {
        excludedActive = true;
        return false;
      }
      return true;
    });

    if (idsToClose.length === 0) {
      showToast('当前标签页无法在此关闭');
      return;
    }

    // >3 个标签时弹确认
    if (idsToClose.length > 3) {
      const confirmed = await showConfirm(`即将关闭 ${idsToClose.length} 个标签，确认？`);
      if (!confirmed) return;
    }

    // 收集关闭信息用于撤回
    const closedInfo = [];
    for (const id of idsToClose) {
      const t = allTabs.find(tab => tab.id === id);
      if (t) closedInfo.push({ url: t.url, title: t.title || '' });
    }

    // 缓存撤回数据
    await Storage.saveUndoCache({
      closedTabs: closedInfo,
      timestamp: Date.now()
    });

    // 执行关闭
    await chrome.tabs.remove(idsToClose);

    // 清理选中状态
    idsToClose.forEach(id => checkedTabIds.delete(id));
    if (excludedActive) checkedTabIds.delete(activeTabId);

    // 提示
    if (excludedActive) {
      showToast(`已关闭 ${closedInfo.length} 个标签（当前标签页已保留）`);
    }

    // 显示撤回栏
    showUndoBar(closedInfo.length);

    // 刷新列表（保留撤回栏）
    await loadTabOverview(true);
  }

  // 关闭选中按钮
  btnCloseSelected.addEventListener('click', () => {
    const ids = [...checkedTabIds];
    closeTabs(ids, `${ids.length} 个标签`);
  });

  // ========== 撤回 ==========
  function showUndoBar(count) {
    undoText.textContent = `已关闭 ${count} 个标签`;
    undoBar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      undoBar.hidden = true;
    }, 5000);
  }

  btnUndo.addEventListener('click', async () => {
    const cache = await Storage.getUndoCache();
    if (!cache) {
      showToast('撤回数据已过期');
      undoBar.hidden = true;
      return;
    }

    const elapsed = Date.now() - cache.timestamp;
    if (elapsed > 5000) {
      showToast('撤回已过期');
      undoBar.hidden = true;
      await Storage.clearUndoCache();
      return;
    }

    // 重新打开（等待所有 tab 创建完成）
    const createPromises = cache.closedTabs.map(t =>
      chrome.tabs.create({ url: t.url, active: false })
    );
    await Promise.all(createPromises);

    showToast(`已撤回 ${cache.closedTabs.length} 个标签`);
    undoBar.hidden = true;
    clearTimeout(undoTimer);
    await Storage.clearUndoCache();

    // 刷新列表
    await loadTabOverview();
  });

  // ========== 搜索过滤 ==========
  inputSearch.addEventListener('input', () => {
    renderDomainList();
  });

  // ========== 智能场景推荐 (模块 D) ==========
  const recommendationEl = document.getElementById('recommendation');
  const recTextEl = recommendationEl.querySelector('.rec-text');
  const btnRecRestore = document.getElementById('btn-rec-restore');
  const btnRecDismiss = document.getElementById('btn-rec-dismiss');

  let dismissedRecId = null; // 当次 popup 会话内忽略的场景 ID

  async function checkRecommendation() {
    const workspaces = await Storage.getWorkspaces();
    if (workspaces.length === 0) {
      recommendationEl.hidden = true;
      return;
    }

    // 获取当前所有 Tab 的域名列表
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentDomains = new Set();
    tabs.forEach(t => {
      try {
        const url = t.url || t.pendingUrl || '';
        if (/^https?:\/\//.test(url)) {
          currentDomains.add(new URL(url).hostname);
        }
      } catch {}
    });

    if (currentDomains.size === 0) {
      recommendationEl.hidden = true;
      return;
    }

    // 遍历所有场景，计算匹配度
    let bestMatch = null;
    let bestScore = 0;

    for (const ws of workspaces) {
      if (!ws.domainFingerprint || ws.domainFingerprint.length === 0) continue;
      if (ws.id === dismissedRecId) continue;

      const intersection = ws.domainFingerprint.filter(d => currentDomains.has(d));
      const score = intersection.length / ws.domainFingerprint.length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = ws;
      }
    }

    // 匹配度 ≥ 60% 才推荐
    if (bestMatch && bestScore >= 0.6) {
      recTextEl.textContent = `你似乎在进行「${bestMatch.name}」，要恢复完整场景吗？`;
      recommendationEl.hidden = false;
      recommendationEl.dataset.wsId = bestMatch.id;
    } else {
      recommendationEl.hidden = true;
    }
  }

  btnRecRestore.addEventListener('click', () => {
    const wsId = recommendationEl.dataset.wsId;
    if (wsId) {
      recommendationEl.hidden = true;
      restoreScene(wsId);
    }
  });

  btnRecDismiss.addEventListener('click', () => {
    dismissedRecId = recommendationEl.dataset.wsId;
    recommendationEl.hidden = true;
  });

  // ========== 初始化 ==========
  async function init() {
    await renderSceneList();
    await checkRecommendation();
  }

  init();
})();
