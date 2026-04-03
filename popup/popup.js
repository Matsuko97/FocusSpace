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
      card.style.animationDelay = `${idx * 0.04}s`;

      const lastHistory = ws.history && ws.history.length > 0
        ? ws.history[ws.history.length - 1]
        : null;
      const lastTimeText = lastHistory
        ? `${lastHistory.action === 'save' ? '保存' : '恢复'}于 ${timeAgo(lastHistory.timestamp)}`
        : `创建于 ${timeAgo(ws.createdAt)}`;

      card.innerHTML = `
        <div class="scene-card-header">
          <div class="scene-info">
            <div class="scene-name">${escapeHtml(ws.name)}</div>
            <div class="scene-meta">
              <span class="tab-count">${ws.tabs.length} 个标签</span>
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
        ? `<img src="${escapeHtml(t.favIconUrl)}" width="13" height="13" onerror="this.style.display='none'">`
        : '';
      return `<div class="scene-tab-item">${icon}<span>${escapeHtml(t.title || t.url)}</span></div>`;
    }).join('');

    const historyHtml = (ws.history && ws.history.length > 0)
      ? `<div class="timeline">${ws.history.slice(-5).reverse().map(h => `
          <div class="timeline-item">
            <span class="timeline-badge ${h.action}">${h.action === 'save' ? '保存' : '恢复'}</span>
            <span>${formatTime(h.timestamp)}</span>
            <span>(${h.tabCount} 个标签)</span>
          </div>`).join('')}</div>`
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

    // 查询哪些 URL 有便签
    const allNotes = await Storage.getAllURLNotes();
    const urlsWithNotes = new Set();
    for (const t of ws.tabs) {
      const urlKey = t.url.split('#')[0];
      if (allNotes[urlKey] && allNotes[urlKey].length > 0) {
        urlsWithNotes.add(urlKey);
      }
    }

    // 追加打开所有标签，收集需要注入便签的 tabId
    const tabsNeedingNotes = [];
    for (const t of ws.tabs) {
      const created = await chrome.tabs.create({ url: t.url, pinned: t.pinned, active: false });
      const urlKey = t.url.split('#')[0];
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

    showToast(`已恢复场景「${ws.name}」(${ws.tabs.length} 个标签)`);
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
      if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
        showToast('此页面不支持便签');
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

  // ========== 标签概览加载（占位） ==========
  function loadTabOverview() {
    // 阶段四实现
  }

  // ========== 初始化 ==========
  async function init() {
    await renderSceneList();
    // 阶段五实现智能推荐
  }

  init();
})();
