/**
 * storage.js — FocusSpace 统一存储工具
 * 封装 chrome.storage.local 的异步读写操作
 */

const Storage = (() => {
  'use strict';

  // ========== 通用读写 ==========

  async function _get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }

  async function _set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async function _remove(key) {
    await chrome.storage.local.remove(key);
  }

  // ========== Workspaces ==========

  async function getWorkspaces() {
    return (await _get('workspaces')) || [];
  }

  async function saveWorkspaces(workspaces) {
    await _set('workspaces', workspaces);
  }

  // ========== URL Notes ==========

  async function getAllURLNotes() {
    return (await _get('urlNotes')) || {};
  }

  async function getURLNotes(url) {
    const all = await getAllURLNotes();
    return all[url] || [];
  }

  async function saveURLNotes(url, notes) {
    const all = await getAllURLNotes();
    if (notes && notes.length > 0) {
      all[url] = notes;
    } else {
      delete all[url];
    }
    await _set('urlNotes', all);
  }

  // ========== Undo Cache ==========

  async function getUndoCache() {
    return await _get('undoCache');
  }

  async function saveUndoCache(data) {
    await _set('undoCache', data);
    // 通知 service_worker 启动 5 秒清除定时器
    chrome.runtime.sendMessage({ type: 'START_UNDO_TIMER' }).catch(() => {});
  }

  async function clearUndoCache() {
    await _remove('undoCache');
  }

  // ========== Parked Tabs (隔离区) ==========

  async function getParkedTabs() {
    return (await _get('parkedTabs')) || [];
  }

  async function saveParkedTabs(tabs) {
    await _set('parkedTabs', tabs);
  }

  // ========== UUID 生成 ==========

  function generateId() {
    return crypto.randomUUID();
  }

  // ========== 公开接口 ==========

  return {
    getWorkspaces,
    saveWorkspaces,
    getAllURLNotes,
    getURLNotes,
    saveURLNotes,
    getUndoCache,
    saveUndoCache,
    clearUndoCache,
    getParkedTabs,
    saveParkedTabs,
    generateId
  };
})();
