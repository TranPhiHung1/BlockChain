/* =============================================================================
 *  dom.js — Bộ tiện ích DOM dùng chung cho mọi trang
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  /** Chặn XSS khi nhúng dữ liệu người dùng vào innerHTML. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Rút gọn chuỗi băm: n ký tự đầu … n ký tự cuối. */
  function shortHash(hash, n) {
    n = n || 8;
    if (!hash || hash.length <= n * 2) return hash || '';
    return hash.slice(0, n) + '…' + hash.slice(-n);
  }

  /** Đổi mốc thời gian (giây) sang chuỗi đọc được theo ngôn ngữ đang chọn. */
  function fmtTime(seconds) {
    var loc = DLU.i18n ? DLU.i18n.locale() : 'vi-VN';
    var when = new Date(seconds * 1000);
    return when.toLocaleTimeString(loc) + ' · ' + when.toLocaleDateString(loc);
  }

  /** Tách phần số 0 dẫn đầu của chuỗi băm để tô màu riêng. */
  function highlightZeros(hash, difficulty) {
    if (!difficulty) return esc(hash);
    var lead = hash.slice(0, difficulty);
    if (lead !== new Array(difficulty + 1).join('0')) return esc(hash);
    return '<span class="zeros">' + esc(lead) + '</span>' + esc(hash.slice(difficulty));
  }

  /** Chữ cái viết tắt của một họ tên — dùng cho ảnh đại diện dạng chữ. */
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    var last = parts[parts.length - 1] || '?';
    var first = parts.length > 1 ? parts[0] : '';
    return (first.charAt(0) + last.charAt(0)).toUpperCase() || '?';
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

  /**
   * Chép chuỗi vào bộ nhớ tạm.
   * navigator.clipboard chỉ chạy trong ngữ cảnh bảo mật (https / localhost),
   * nên có đường lùi bằng execCommand để trang vẫn dùng được khi mở file://
   */
  function copy(text, onDone) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); if (onDone) onDone(); }
      catch (e) { /* trình duyệt chặn */ }
      document.body.removeChild(ta);
    }
    if (global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(text).then(
        function () { if (onDone) onDone(); }, fallback);
    } else {
      fallback();
    }
  }

  DLU.dom = {
    esc: esc, shortHash: shortHash, fmtTime: fmtTime, initials: initials,
    highlightZeros: highlightZeros, $: $, $$: $$, on: on, sleep: sleep, copy: copy
  };
})(typeof window !== 'undefined' ? window : globalThis);
