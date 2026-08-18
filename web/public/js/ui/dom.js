/* =============================================================================
 *  dom.js — Vài tiện ích DOM dùng chung cho mọi trang
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  /** Chống XSS khi nhúng dữ liệu người dùng vào innerHTML. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Rút gọn mã băm: 8 ký tự đầu … 8 ký tự cuối. */
  function shortHash(hash, n) {
    n = n || 8;
    if (!hash || hash.length <= n * 2) return hash || '';
    return hash.slice(0, n) + '…' + hash.slice(-n);
  }

  /** Đổi timestamp (giây) sang giờ Việt Nam dễ đọc. */
  function fmtTime(seconds) {
    var d = new Date(seconds * 1000);
    return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
  }

  /** Tách phần số 0 dẫn đầu của hash để tô màu riêng. */
  function highlightZeros(hash, difficulty) {
    if (!difficulty) return esc(hash);
    var lead = hash.slice(0, difficulty);
    if (lead !== new Array(difficulty + 1).join('0')) return esc(hash);
    return '<span class="zeros">' + esc(lead) + '</span>' + esc(hash.slice(difficulty));
  }

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /** Gắn sự kiện theo kiểu uỷ quyền: on(root, 'click', '[data-act]', handler) */
  function on(root, type, selector, handler) {
    root.addEventListener(type, function (ev) {
      var target = ev.target.closest(selector);
      if (target && root.contains(target)) handler(ev, target);
    });
  }

  /** Chờ `ms` mili-giây, trả về Promise — dùng cho hoạt ảnh từng bước. */
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  DLU.dom = {
    esc: esc, shortHash: shortHash, fmtTime: fmtTime,
    highlightZeros: highlightZeros, $: $, $$: $$, on: on, sleep: sleep
  };
})(typeof window !== 'undefined' ? window : globalThis);
