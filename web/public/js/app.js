/* =============================================================================
 *  app.js — Bộ định tuyến (router) & khung ứng dụng
 * -----------------------------------------------------------------------------
 *  Ứng dụng một trang (SPA) không dùng framework: định tuyến bằng hash để
 *  chạy được cả khi mở trực tiếp bằng giao thức file:// (không cần máy chủ).
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var i18n = DLU.i18n;

  var ROUTES = {
    '/':            { view: 'home',       titleKey: 'nav.home' },
    '/linked-list': { view: 'linkedlist', titleKey: 'nav.ll' },
    '/blockchain':  { view: 'blockchain', titleKey: 'nav.bc' },
    '/consensus':   { view: 'consensus',  titleKey: 'nav.cs' },
    '/keys':        { view: 'keys',       titleKey: 'nav.ky' },
    '/about':       { view: 'about',      titleKey: 'nav.about' }
  };

  var SITE = 'DLU Blockchain Lab';
  var outlet = null;
  var activeView = null;

  /* -------------------------------------------------------------- định tuyến */
  function currentPath() {
    var hash = location.hash.replace(/^#/, '');
    return ROUTES[hash] ? hash : '/';
  }

  function navigate() {
    var path = currentPath();
    var route = ROUTES[path];

    // Dọn dẹp trang cũ: huỷ tiến trình đào, gỡ bộ đếm giờ…
    if (activeView && activeView.destroy) activeView.destroy();

    activeView = DLU.views[route.view];
    outlet.innerHTML = '';
    activeView.render(outlet);

    document.title = i18n.t(route.titleKey) + ' · ' + SITE;
    d.$$('.nav-links a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + path);
    });
    d.$('.nav-links').classList.remove('open');
    global.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ chế độ màu */
  var THEME_KEY = 'dlu-blockchain-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = d.$('#themeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = i18n.t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark');
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* chế độ riêng tư */ }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* bỏ qua */ }
    applyTheme(saved || 'dark');
    d.$('#themeBtn').addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      applyTheme(now === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------- ngôn ngữ */

  /**
   * Dịch các chuỗi tĩnh nằm sẵn trong index.html.
   *   data-i18n       → đổi nội dung chữ
   *   data-i18n-title → đổi thuộc tính title (chú giải khi rê chuột)
   */
  function applyStaticI18n() {
    d.$$('[data-i18n]').forEach(function (el) {
      el.textContent = i18n.t(el.getAttribute('data-i18n'));
    });
    d.$$('[data-i18n-title]').forEach(function (el) {
      el.title = i18n.t(el.getAttribute('data-i18n-title'));
    });
    var btn = d.$('#langBtn');
    if (btn) {
      btn.textContent = i18n.t('lang.flag');
      btn.title = i18n.t('lang.switchTo');
    }
    // Liên kết mã nguồn ở chân trang lấy từ config
    var src = d.$('#footerSource');
    if (src && DLU.config) src.href = DLU.config.github.url;
  }

  function initLang() {
    i18n.init();
    applyStaticI18n();

    d.$('#langBtn').addEventListener('click', function () {
      i18n.setLang(i18n.getLang() === 'vi' ? 'en' : 'vi');
    });

    // Đổi ngôn ngữ ⇒ dịch lại khung trang rồi vẽ lại trang hiện tại
    i18n.onChange(function () {
      applyStaticI18n();
      applyTheme(document.documentElement.getAttribute('data-theme'));
      navigate();
    });
  }

  /* ------------------------------------------------------------------ khởi động */
  function boot() {
    outlet = d.$('#app');

    initLang();
    initTheme();

    d.$('#burger').addEventListener('click', function () {
      d.$('.nav-links').classList.toggle('open');
    });

    d.$('#year').textContent = new Date().getFullYear();

    global.addEventListener('hashchange', navigate);
    navigate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
