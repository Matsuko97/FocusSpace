/**
 * note.js — FocusSpace 悬浮便签 Content Script
 * 通过 chrome.scripting.executeScript 动态注入到目标页面
 * 使用 Shadow DOM 隔离样式
 */

(function () {
  'use strict';

  // 防止重复注入
  if (document.getElementById('focusspace-note-host')) {
    // 已注入，切换显示/隐藏
    const host = document.getElementById('focusspace-note-host');
    host.style.display = host.style.display === 'none' ? 'block' : 'none';
    return;
  }

  // 创建 Shadow DOM 宿主
  const host = document.createElement('div');
  host.id = 'focusspace-note-host';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // 注入样式（阶段三完善具体便签 UI）
  const style = document.createElement('style');
  style.textContent = `
    .note-container {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 240px;
      min-height: 60px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
    }
    .note-placeholder {
      background: #fff9c4;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      color: #333;
      text-align: center;
    }
  `;
  shadow.appendChild(style);

  // 占位 UI（阶段三替换为完整便签 CRUD）
  const container = document.createElement('div');
  container.className = 'note-container';
  container.innerHTML = `
    <div class="note-placeholder">
      📝 FocusSpace 便签已就绪<br>
      <small style="color:#888">阶段三将实现完整便签功能</small>
    </div>
  `;
  shadow.appendChild(container);
})();
