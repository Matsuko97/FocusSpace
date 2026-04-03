/**
 * service_worker.js — FocusSpace 后台服务
 * 负责：撤回计时清理、快捷键监听（V2）、活跃度追踪（V1.5）
 */

// 清理回调（需在 onMessage 之前声明）
let _noteInjectorCleanup = null;

// 监听插件安装/更新
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('FocusSpace 已安装');
  }
});

// ========== 撤回缓存自动过期 ==========
// popup 关闭标签时通过消息通知 service_worker 设置 5 秒定时清除
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_UNDO_TIMER') {
    chrome.alarms.create('clearUndoCache', { delayInMinutes: 5 / 60 });
    sendResponse({ ok: true });
  }

  // 恢复场景时自动注入便签到已有笔记的 tab
  if (message.type === 'INJECT_NOTES_ON_LOAD') {
    const pendingTabs = new Set(message.tabIds || []);
    if (pendingTabs.size === 0) return;

    const onUpdated = (tabId, changeInfo) => {
      if (!pendingTabs.has(tabId)) return;
      if (changeInfo.status !== 'complete') return;

      pendingTabs.delete(tabId);
      // 注入便签脚本和样式
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/note.js']
      }).catch(() => {});
      chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/note.css']
      }).catch(() => {});

      // 所有 tab 都已处理完毕，移除监听器
      if (pendingTabs.size === 0) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    _noteInjectorCleanup = () => chrome.tabs.onUpdated.removeListener(onUpdated);

    // 30 秒后自动清理监听器，防止泄漏（用 alarm 代替 setTimeout，兼容 SW 休眠）
    chrome.alarms.create('clearNoteInjector', { delayInMinutes: 0.5 });

    sendResponse({ ok: true });
  }

  return true;
});

// ========== Alarm 统一处理 ==========
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'clearUndoCache') {
    chrome.storage.local.remove('undoCache');
  }
  if (alarm.name === 'clearNoteInjector' && _noteInjectorCleanup) {
    _noteInjectorCleanup();
    _noteInjectorCleanup = null;
  }
});
