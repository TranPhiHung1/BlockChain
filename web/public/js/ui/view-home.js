/* =============================================================================
 *  view-home.js — Trang chủ
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };

  var FEATURES = [
    { href: '#/linked-list', icon: '🔗', k: 'll' },
    { href: '#/blockchain',  icon: '⛓️', k: 'bc' },
    { href: '#/consensus',   icon: '⚖️', k: 'cs' },
    { href: '#/keys',        icon: '🔑', k: 'ky' }
  ];

  var PROPS = ['1', '2', '3', '4'];
  var PROP_ICONS = { '1': '📏', '2': '⛔', '3': '🌊', '4': '🧬' };

  /** Ba khối mẫu ở hero — hash là kết quả băm thật, không phải chữ trang trí. */
  function heroChain() {
    var chain = new DLU.Blockchain({ genesisData: 'Genesis Block' });
    chain.addBlock('Nguyên gửi 0.27 BTC cho Bảo');
    chain.addBlock('Bảo gửi 0.10 BTC cho Chi');

    return chain.toArray().map(function (b, i) {
      var link = i === 0 ? '' : '<div class="hc-link"></div>';
      return link +
        '<div class="hc-block">' +
          '<small>' + t('home.block') + ' #' + i + '</small>' +
          '<b>' + d.esc(i === 0 ? t('home.genesis') : t('home.tx') + ' ' + i) + '</b>' +
          '<div class="hash">' + d.esc(b.hash.slice(0, 14)) + '…</div>' +
        '</div>';
    }).join('');
  }

  function render(root) {
    root.innerHTML =
      '<div class="page">' +
      // ---------- HERO ----------
      '<section class="hero wrap">' +
        '<span class="eyebrow">' + d.esc(t('home.eyebrow')) + '</span>' +
        '<h1>' + d.esc(t('home.title1')) + ' <span class="grad-text">' +
            d.esc(t('home.title2')) + '</span><br>' + d.esc(t('home.title3')) +
            ' <span class="grad-text">' + d.esc(t('home.title4')) + '</span></h1>' +
        '<p class="lead">' + d.esc(t('home.lead')) + '</p>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="#/linked-list">' + d.esc(t('home.cta1')) + '</a>' +
          '<a class="btn btn-ghost" href="#/consensus">' + d.esc(t('home.cta2')) + '</a>' +
        '</div>' +
        '<div class="hero-chain">' + heroChain() + '</div>' +
        '<div class="stat-strip">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div class="stat"><b>' + d.esc(t('home.stat' + i + 'n')) + '</b>' +
                   '<span>' + d.esc(t('home.stat' + i + 'l')) + '</span></div>';
          }).join('') +
        '</div>' +
      '</section>' +

      // ---------- 3 CHỨC NĂNG ----------
      '<section class="section wrap">' +
        '<div class="section-title">' +
          '<h2>' + d.esc(t('home.feat.title')) + '</h2>' +
          '<p>' + d.esc(t('home.feat.sub')) + '</p>' +
        '</div>' +
        '<div class="grid grid-3">' +
          FEATURES.map(function (f) {
            return '<a class="feature" href="' + f.href + '">' +
              '<div class="ficon">' + f.icon + '</div>' +
              '<h3>' + d.esc(t('home.feat.' + f.k + '.t')) + '</h3>' +
              '<p>' + d.esc(t('home.feat.' + f.k + '.d')) + '</p>' +
              '<span class="more">' + d.esc(t('home.feat.more')) + ' →</span>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</section>' +

      // ---------- HÀM BĂM ----------
      '<section class="section wrap">' +
        '<div class="section-title">' +
          '<h2>' + d.esc(t('home.hash.title1')) + ' <span class="grad-text">' +
              d.esc(t('home.hash.title2')) + '</span></h2>' +
          '<p>' + d.esc(t('home.hash.sub')) + '</p>' +
        '</div>' +
        '<div class="card" style="margin-bottom:22px">' +
          '<div class="card-head"><h3>' + d.esc(t('home.hash.card')) + '</h3></div>' +
          '<div class="field" style="margin-bottom:14px">' +
            '<label for="homeHashIn">' + d.esc(t('home.hash.label')) + '</label>' +
            '<input id="homeHashIn" type="text" value="' + d.esc(t('home.hash.sample')) +
                   '" placeholder="' + d.esc(t('home.hash.ph')) + '">' +
          '</div>' +
          '<div class="big-hash" id="homeHashOut"></div>' +
          '<p style="font-size:12.5px;color:var(--text-2);margin-top:10px">' +
            t('home.hash.note') + '</p>' +
        '</div>' +
        '<div class="grid grid-4">' +
          PROPS.map(function (i) {
            return '<div class="card">' +
              '<div class="ficon" style="width:42px;height:42px;font-size:20px;border-radius:12px">' +
                 PROP_ICONS[i] + '</div>' +
              '<h3 style="font-size:15.5px;margin:12px 0 6px">' + d.esc(t('home.prop' + i + '.t')) + '</h3>' +
              '<p style="font-size:13.5px;color:var(--text-2)">' + d.esc(t('home.prop' + i + '.p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</section>' +

      // ---------- CTA ----------
      '<section class="section wrap" style="padding-top:0">' +
        '<div class="card" style="text-align:center;padding:44px 26px">' +
          '<h2 style="font-size:clamp(22px,3vw,30px);letter-spacing:-.6px;margin-bottom:10px">' +
            d.esc(t('home.end.t')) + '</h2>' +
          '<p style="color:var(--text-2);max-width:520px;margin:0 auto 22px">' +
            d.esc(t('home.end.p')) + '</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-green" href="#/blockchain">' + d.esc(t('home.end.b1')) + '</a>' +
            '<a class="btn btn-ghost" href="#/about">' + d.esc(t('home.end.b2')) + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '</div>';

    // --- Widget băm trực tiếp ---
    var input = d.$('#homeHashIn', root);
    var out = d.$('#homeHashOut', root);
    function refresh() { out.textContent = DLU.sha256(input.value); }
    input.addEventListener('input', refresh);
    refresh();
  }

  DLU.views = DLU.views || {};
  DLU.views.home = { render: render, destroy: function () {} };
})(typeof window !== 'undefined' ? window : globalThis);
