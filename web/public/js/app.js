/* =============================================================================
 *  app.js — Bộ định tuyến & khung điều phối ứng dụng
 * -----------------------------------------------------------------------------
 *  Ứng dụng một trang (SPA) không dùng framework. Định tuyến bằng phần hash của
 *  địa chỉ để trang vẫn chạy khi mở trực tiếp bằng giao thức file:// — không
 *  cần dựng máy chủ, tiện cho việc chấm bài trên máy bất kỳ.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var i18n = DLU.i18n;

  var ROUTES = {
    '/':        { view: 'open',    titleKey: 'ui.nav.open' },
    '/nodes':   { view: 'nodes',   titleKey: 'ui.nav.nodes' },
    '/ledger':  { view: 'ledger',  titleKey: 'ui.nav.ledger' },
    '/desk':    { view: 'desk',    titleKey: 'ui.nav.desk' },
    '/network': { view: 'network', titleKey: 'ui.nav.network' },
    '/dossier': { view: 'dossier', titleKey: 'ui.nav.dossier' }
  };

  var SITE = 'DLU Ledger Studio';
  var stage = null;
  var current = null;

  /* -------------------------------------------------------------- điều hướng */
  function currentPath() {
    var hash = location.hash.replace(/^#/, '');
    return ROUTES[hash] ? hash : '/';
  }

  /**
   * Thay hẳn thẻ <main> bằng một thẻ mới trước mỗi lần vẽ.
   *
   * Các trang gắn sự kiện theo kiểu uỷ quyền lên chính thẻ chứa (d.on). Nếu chỉ
   * xoá nội dung bên trong thì những trình xử lý ấy vẫn bám lại trên thẻ cũ, và
   * sau vài lần qua lại giữa các trang, một cú bấm sẽ chạy nhiều lần. Dựng thẻ
   * mới là cách dứt điểm: trình xử lý cũ đi theo thẻ cũ vào bộ thu gom rác.
   */
  function freshStage() {
    var next = document.createElement('main');
    next.id = 'stage';
    stage.parentNode.replaceChild(next, stage);
    stage = next;
  }

  function navigate() {
    var path = currentPath();
    var route = ROUTES[path];

    // Dọn dẹp trang cũ: dừng tiến trình đang chạy, gỡ bộ hẹn giờ…
    if (current && current.destroy) current.destroy();

    current = DLU.views[route.view];
    freshStage();
    current.render(stage);

    document.title = i18n.t(route.titleKey) + ' · ' + SITE;
    d.$$('.rail-nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#' + path);
    });
    d.$('.rail-nav').classList.remove('open');
    global.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ chế độ nền */
  var THEME_KEY = 'dlu-ledger-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = d.$('#themeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '◐' : '◑';
      btn.title = i18n.t(theme === 'dark' ? 'ui.theme.toLight' : 'ui.theme.toDark');
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* chế độ riêng tư */ }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* bỏ qua */ }
    applyTheme(saved === 'light' ? 'light' : 'dark');
    d.$('#themeBtn').addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      applyTheme(now === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------- ngôn ngữ */

  /**
   * Dịch những chuỗi tĩnh nằm sẵn trong index.html.
   *   data-i18n       → thay nội dung chữ
   *   data-i18n-title → thay thuộc tính title (chú giải khi rê chuột)
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
      btn.textContent = i18n.t('ui.lang.tag');
      btn.title = i18n.t('ui.lang.switch');
    }
    // Liên kết kho mã ở chân trang lấy thẳng từ config.js
    var repo = d.$('#footRepo');
    if (repo && DLU.config) repo.href = DLU.config.github.url;
  }

  function initLang() {
    i18n.init();
    applyStaticI18n();

    d.$('#langBtn').addEventListener('click', function () {
      i18n.setLang(i18n.getLang() === 'vi' ? 'en' : 'vi');
    });

    // Đổi ngôn ngữ ⇒ dịch lại khung trang rồi vẽ lại trang đang xem
    i18n.onChange(function () {
      applyStaticI18n();
      applyTheme(document.documentElement.getAttribute('data-theme'));
      navigate();
    });
  }

  /* ------------------------------------------------------------------ khởi động */
  function boot() {
    stage = d.$('#stage');

    initLang();
    initTheme();

    d.$('#tapBtn').addEventListener('click', function () {
      d.$('.rail-nav').classList.toggle('open');
    });

    d.$('#year').textContent = new Date().getFullYear();

    // Trợ lý gắn thẳng vào <body>, ngoài thẻ <main>, nên chỉ dựng đúng một lần
    // và sống sót qua mọi lần chuyển trang.
    DLU.assistantUI.mount();

    global.addEventListener('hashchange', navigate);
    navigate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
