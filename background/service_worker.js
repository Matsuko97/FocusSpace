/**
 * service_worker.js — FocusSpace 后台服务
 * 负责：撤回计时清理、快捷键监听（V2）、活跃度追踪（V1.5）
 */

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
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'clearUndoCache') {
    chrome.storage.local.remove('undoCache');
  }
});
