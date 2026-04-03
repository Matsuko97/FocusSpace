/**
 * popup.js — FocusSpace 弹窗入口
 * 负责视图切换、Tab pill 动画、便签注入触发
 */

(function () {
  'use strict';

  // ========== DOM 引用 ==========
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPill = document.getElementById('tab-pill');
  const viewScenes = document.getElementById('view-scenes');
  const viewOverview = document.getElementById('view-overview');
  const btnOpenNote = document.getElementById('btn-open-note');

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

  // ========== 标签概览加载（占位） ==========
  function loadTabOverview() {
    // 阶段四实现
  }

  // ========== 初始化 ==========
  async function init() {
    // 阶段二实现场景列表加载
    // 阶段五实现智能推荐
  }

  init();
})();
