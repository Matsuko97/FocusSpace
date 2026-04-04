/**
 * note.js — FocusSpace 悬浮便签 Content Script
 * 通过 chrome.scripting.executeScript 动态注入到目标页面
 * 使用 Shadow DOM 隔离样式
 * 功能：新建 / 编辑 / 拖拽 / 最小化 / 删除 / 多色 / 自动保存
 */

(function () {
  'use strict';

  // 防止重复注入
  if (document.getElementById('focusspace-note-host')) {
    const host = document.getElementById('focusspace-note-host');
    host.style.display = host.style.display === 'none' ? 'block' : 'none';
    return;
  }

  // ====== 常量 ======
  const PAGE_URL = window.location.href.split('#')[0]; // 去除 hash
  const COLORS = [
    { name: 'yellow', bg: '#fff9c4', border: '#f9e547', header: '#f5e052' },
    { name: 'green',  bg: '#c8e6c9', border: '#66bb6a', header: '#81c784' },
    { name: 'blue',   bg: '#bbdefb', border: '#42a5f5', header: '#64b5f6' },
    { name: 'pink',   bg: '#f8bbd0', border: '#ec407a', header: '#f06292' },
    { name: 'orange', bg: '#ffe0b2', border: '#ffa726', header: '#ffb74d' },
    { name: 'purple', bg: '#e1bee7', border: '#ab47bc', header: '#ba68c8' },
  ];
  const SAVE_DEBOUNCE = 500;

  // ====== Shadow DOM 宿主 ======
  const host = document.createElement('div');
  host.id = 'focusspace-note-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // ====== 内联样式 ======
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    .fs-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    }

    /* ====== 新建按钮 ====== */
    .fs-fab {
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: #fff;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(245,158,11,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .fs-fab:hover { transform: scale(1.1); box-shadow: 0 4px 18px rgba(245,158,11,0.5); }
    .fs-fab:active { transform: scale(0.95); }

    /* ====== 便签卡片 ====== */
    .fs-note {
      position: fixed;
      width: 220px;
      min-height: 120px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18);
      transition: box-shadow 0.2s;
      z-index: 2147483646;
      overflow: hidden;
    }
    .fs-note.dragging { box-shadow: 0 8px 32px rgba(0,0,0,0.25); opacity: 0.92; }

    .fs-note-header {
      display: flex;
      align-items: center;
      padding: 5px 6px;
      cursor: grab;
      user-select: none;
      gap: 2px;
    }
    .fs-note-header:active { cursor: grabbing; }

    .fs-note-header .fs-drag-area { flex: 1; height: 18px; }

    .fs-note-btn {
      width: 22px; height: 22px;
      border: none; border-radius: 4px;
      background: transparent;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: rgba(0,0,0,0.45);
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
    }
    .fs-note-btn:hover { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.7); }

    .fs-note-body {
      flex: 1;
      padding: 0 8px 8px;
    }

    .fs-note-textarea {
      width: 100%;
      min-height: 70px;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 12.5px;
      line-height: 1.5;
      color: #333;
      resize: vertical;
      outline: none;
    }
    .fs-note-textarea::placeholder { color: rgba(0,0,0,0.3); }

    /* ====== Markdown 预览 ====== */
    .fs-note-preview {
      width: 100%;
      min-height: 70px;
      font-family: inherit;
      font-size: 12.5px;
      line-height: 1.6;
      color: #333;
      display: none;
      cursor: default;
      word-break: break-word;
    }
    .fs-note-body.preview-mode .fs-note-textarea { display: none; }
    .fs-note-body.preview-mode .fs-note-preview { display: block; }

    .fs-note-preview strong { font-weight: 700; }
    .fs-note-preview ul {
      margin: 2px 0;
      padding-left: 16px;
      list-style: disc;
    }
    .fs-note-preview li { margin: 1px 0; }

    .fs-note-preview .md-checkbox {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      margin: 2px 0;
    }
    .fs-note-preview .md-checkbox input[type="checkbox"] {
      width: 13px; height: 13px;
      cursor: pointer;
      accent-color: #666;
    }
    .fs-note-preview .md-checkbox.checked span {
      text-decoration: line-through;
      opacity: 0.5;
    }
    .fs-note-preview p { margin: 2px 0; }

    .fs-note-btn.active {
      background: rgba(0,0,0,0.1);
      color: rgba(0,0,0,0.7);
    }

    /* ====== 颜色选择 ====== */
    .fs-colors {
      display: flex;
      gap: 3px;
      padding: 4px 8px 6px;
    }
    .fs-color-dot {
      width: 14px; height: 14px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }
    .fs-color-dot:hover { transform: scale(1.2); }
    .fs-color-dot.active { border-color: rgba(0,0,0,0.35); }

    /* ====== 最小化状态 ====== */
    .fs-note.minimized {
      width: auto !important;
      min-height: auto !important;
      height: auto !important;
      border-radius: 20px;
    }
    .fs-note.minimized .fs-note-body,
    .fs-note.minimized .fs-colors { display: none; }
    .fs-note.minimized .fs-note-header { padding: 4px 8px; cursor: pointer; }
    .fs-note.minimized .fs-drag-area { display: none; }
    .fs-note.minimized .fs-min-label {
      display: inline;
      font-size: 11px;
      color: rgba(0,0,0,0.5);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 4px;
    }

    .fs-min-label { display: none; }

    /* ====== 删除确认遮罩（便签内居中） ====== */
    .fs-del-confirm {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(2px);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      animation: fs-fade-in 0.15s ease-out;
      padding: 12px;
      text-align: center;
    }
    @keyframes fs-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .fs-del-confirm p { margin-bottom: 8px; font-weight: 500; font-size: 12.5px; color: #333; }
    .fs-del-confirm-actions { display: flex; gap: 8px; }
    .fs-del-confirm-btn {
      border: none; border-radius: 5px; padding: 5px 14px;
      font-size: 11.5px; cursor: pointer; font-family: inherit;
      transition: background 0.15s;
    }
    .fs-del-confirm-btn.cancel { background: #e5e7eb; color: #555; }
    .fs-del-confirm-btn.cancel:hover { background: #d1d5db; }
    .fs-del-confirm-btn.ok { background: #ef4444; color: #fff; }
    .fs-del-confirm-btn.ok:hover { background: #dc2626; }
    .fs-del-hint { font-size: 10px; color: #999; margin-top: 6px; line-height: 1.3; }
  `;
  shadow.appendChild(style);

  // ====== 主容器 ======
  const panel = document.createElement('div');
  panel.className = 'fs-panel';
  shadow.appendChild(panel);

  // FAB 按钮
  const fab = document.createElement('button');
  fab.className = 'fs-fab';
  fab.textContent = '+';
  fab.title = '新建便签';
  fab.addEventListener('click', () => createNote());
  panel.appendChild(fab);

  // ====== 数据操作 ======
  let notes = []; // 当前页面便签数组
  let saveTimer = null;
  let deleteWarningShown = false; // 是否已展示过删除提示

  async function loadNotes() {
    const result = await chrome.storage.local.get(['urlNotes', 'noteDeleteWarningShown']);
    const all = result.urlNotes || {};
    notes = all[PAGE_URL] || [];
    deleteWarningShown = !!result.noteDeleteWarningShown;
    renderAllNotes();
  }

  async function persistNotes() {
    const result = await chrome.storage.local.get('urlNotes');
    const all = result.urlNotes || {};
    if (notes.length > 0) {
      all[PAGE_URL] = notes;
    } else {
      delete all[PAGE_URL];
    }
    await chrome.storage.local.set({ urlNotes: all });
  }

  function debounceSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistNotes(), SAVE_DEBOUNCE);
  }

  // ====== 渲染 ======
  function renderAllNotes() {
    // 移除旧便签元素（保留 FAB）
    shadow.querySelectorAll('.fs-note').forEach(el => el.remove());
    notes.forEach(n => renderNote(n));
  }

  function getColor(colorName) {
    return COLORS.find(c => c.name === colorName) || COLORS[0];
  }

  function renderNote(data) {
    const color = getColor(data.color);

    const note = document.createElement('div');
    note.className = 'fs-note' + (data.minimized ? ' minimized' : '');
    note.dataset.id = data.id;
    note.style.cssText = `
      left: ${data.position.x}px;
      top: ${data.position.y}px;
      background: ${color.bg};
      border: 1px solid ${color.border};
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'fs-note-header';
    header.style.background = color.header;

    const minLabel = document.createElement('span');
    minLabel.className = 'fs-min-label';
    minLabel.textContent = data.content ? data.content.substring(0, 15) : '便签';

    const dragArea = document.createElement('div');
    dragArea.className = 'fs-drag-area';

    const btnMin = document.createElement('button');
    btnMin.className = 'fs-note-btn';
    btnMin.innerHTML = '&#8722;';
    btnMin.title = '最小化';

    const btnToggleView = document.createElement('button');
    btnToggleView.className = 'fs-note-btn active';
    btnToggleView.innerHTML = '&#9998;'; // ✎
    btnToggleView.title = '切换预览/编辑';

    const btnDel = document.createElement('button');
    btnDel.className = 'fs-note-btn';
    btnDel.innerHTML = '&#10005;';
    btnDel.title = '删除';

    header.append(minLabel, dragArea, btnToggleView, btnMin, btnDel);
    note.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'fs-note-body';

    const textarea = document.createElement('textarea');
    textarea.className = 'fs-note-textarea';
    textarea.placeholder = '支持 **加粗**、- 列表、- [ ] 待办';
    textarea.value = data.content || '';

    const preview = document.createElement('div');
    preview.className = 'fs-note-preview';

    body.appendChild(textarea);
    body.appendChild(preview);
    note.appendChild(body);

    // Colors
    const colorsBar = document.createElement('div');
    colorsBar.className = 'fs-colors';
    COLORS.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'fs-color-dot' + (c.name === data.color ? ' active' : '');
      dot.style.background = c.bg;
      dot.title = c.name;
      dot.addEventListener('click', () => {
        data.color = c.name;
        data.updatedAt = Date.now();
        debounceSave();
        // 即时更新颜色
        const nc = getColor(c.name);
        note.style.background = nc.bg;
        note.style.borderColor = nc.border;
        header.style.background = nc.header;
        colorsBar.querySelectorAll('.fs-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
      colorsBar.appendChild(dot);
    });
    note.appendChild(colorsBar);

    // ====== 事件 ======

    // 编辑自动保存
    textarea.addEventListener('input', () => {
      data.content = textarea.value;
      data.updatedAt = Date.now();
      minLabel.textContent = data.content ? data.content.substring(0, 15) : '便签';
      debounceSave();
    });

    // 预览/编辑 切换
    let isPreviewMode = false;

    function updatePreview() {
      preview.innerHTML = renderMarkdown(data.content || '');
      // 绑定复选框点击
      preview.querySelectorAll('.md-checkbox input[type="checkbox"]').forEach((cb, i) => {
        cb.addEventListener('change', () => {
          data.content = toggleCheckbox(data.content, i);
          data.updatedAt = Date.now();
          textarea.value = data.content;
          updatePreview();
          debounceSave();
        });
      });
    }

    btnToggleView.addEventListener('click', () => {
      isPreviewMode = !isPreviewMode;
      body.classList.toggle('preview-mode', isPreviewMode);
      btnToggleView.classList.toggle('active', !isPreviewMode);
      if (isPreviewMode) {
        updatePreview();
      }
    });

    // 最小化 / 展开
    btnMin.addEventListener('click', () => {
      data.minimized = !data.minimized;
      data.updatedAt = Date.now();
      note.classList.toggle('minimized', data.minimized);
      debounceSave();
    });

    // 最小化状态下点击 header 展开
    header.addEventListener('dblclick', () => {
      if (data.minimized) {
        data.minimized = false;
        data.updatedAt = Date.now();
        note.classList.remove('minimized');
        debounceSave();
      }
    });

    // 删除（首次弹确认，之后直接删除）
    btnDel.addEventListener('click', () => {
      if (deleteWarningShown) {
        doDeleteNote(data, note);
        return;
      }
      // 最小化状态下先展开再弹确认
      if (data.minimized) {
        data.minimized = false;
        data.updatedAt = Date.now();
        note.classList.remove('minimized');
        debounceSave();
      }
      showDeleteConfirm(note, data);
    });

    // 拖拽
    setupDrag(note, header, data);

    shadow.appendChild(note);
  }

  // ====== 删除便签 ======
  function doDeleteNote(data, noteEl) {
    notes = notes.filter(n => n.id !== data.id);
    noteEl.remove();
    persistNotes();
  }

  function showDeleteConfirm(noteEl, data) {
    // 移除已有的确认气泡
    const existing = noteEl.querySelector('.fs-del-confirm');
    if (existing) { existing.remove(); return; }

    const bubble = document.createElement('div');
    bubble.className = 'fs-del-confirm';
    bubble.innerHTML = `
      <p>确定删除这条便签？</p>
      <div class="fs-del-confirm-actions">
        <button class="fs-del-confirm-btn cancel">取消</button>
        <button class="fs-del-confirm-btn ok">删除</button>
      </div>
      <div class="fs-del-hint">确认后，后续删除将不再提示</div>
    `;
    noteEl.appendChild(bubble);

    bubble.querySelector('.cancel').addEventListener('click', () => bubble.remove());
    bubble.querySelector('.ok').addEventListener('click', () => {
      deleteWarningShown = true;
      chrome.storage.local.set({ noteDeleteWarningShown: true });
      bubble.remove();
      doDeleteNote(data, noteEl);
    });
  }

  // ====== 拖拽 ======
  function setupDrag(noteEl, handleEl, data) {
    let isDragging = false;
    let startX, startY, origX, origY;

    handleEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.fs-note-btn')) return; // 别在按钮上拖
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = data.position.x;
      origY = data.position.y;
      noteEl.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      data.position.x = Math.max(0, Math.min(window.innerWidth - 60, origX + dx));
      data.position.y = Math.max(0, Math.min(window.innerHeight - 40, origY + dy));
      noteEl.style.left = data.position.x + 'px';
      noteEl.style.top = data.position.y + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      noteEl.classList.remove('dragging');
      data.updatedAt = Date.now();
      debounceSave();
    });
  }

  // ====== Markdown 解析 (模块 J) ======
  function renderMarkdown(text) {
    if (!text) return '<p style="color:rgba(0,0,0,0.3)">空便签</p>';

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // 复选框：- [x] 或 - [ ]
      const cbMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
      if (cbMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        const checked = cbMatch[1].toLowerCase() === 'x';
        const label = escapeMarkdown(cbMatch[2]);
        html += `<label class="md-checkbox${checked ? ' checked' : ''}"><input type="checkbox" ${checked ? 'checked' : ''}><span>${label}</span></label><br>`;
        continue;
      }

      // 无序列表：- text
      const liMatch = trimmed.match(/^-\s+(.+)$/);
      if (liMatch) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inlineParse(liMatch[1])}</li>`;
        continue;
      }

      // 关闭列表
      if (inList) { html += '</ul>'; inList = false; }

      // 空行
      if (trimmed === '') {
        html += '<br>';
        continue;
      }

      // 普通段落
      html += `<p>${inlineParse(trimmed)}</p>`;
    }

    if (inList) html += '</ul>';
    return html;
  }

  function inlineParse(text) {
    // **bold**
    let result = escapeMarkdown(text);
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return result;
  }

  function escapeMarkdown(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toggleCheckbox(text, targetIndex) {
    if (!text) return text;
    const lines = text.split('\n');
    let cbCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*-\s*\[)([ xX])(\]\s*.*)$/);
      if (match) {
        if (cbCount === targetIndex) {
          const currentlyChecked = match[2].toLowerCase() === 'x';
          lines[i] = match[1] + (currentlyChecked ? ' ' : 'x') + match[3];
          break;
        }
        cbCount++;
      }
    }

    return lines.join('\n');
  }

  // ====== 新建便签 ======
  function createNote(content = '', colorName = 'yellow') {
    const now = Date.now();
    const data = {
      id: crypto.randomUUID(),
      content,
      position: {
        x: Math.max(20, window.innerWidth - 260 - Math.random() * 40),
        y: Math.max(20, 60 + notes.length * 30 + Math.random() * 20)
      },
      color: colorName,
      minimized: false,
      createdAt: now,
      updatedAt: now
    };
    notes.push(data);
    renderNote(data);
    persistNotes();
  }

  // ====== SPA 路由监听 ======
  let currentUrl = PAGE_URL;

  function checkUrlChange() {
    const newUrl = window.location.href.split('#')[0];
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      loadNotes();
    }
  }

  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);
  // MutationObserver 兼顾 pushState
  const urlObserver = new MutationObserver(checkUrlChange);
  urlObserver.observe(document.querySelector('head > title') || document.head, {
    childList: true, subtree: true, characterData: true
  });

  // ====== 启动 ======
  loadNotes();
})();
