/* =============================================================================
 *  view-open.js — Trang tổng quan (điểm vào của xưởng mô phỏng)
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };

  var GATES = [
    { href: '#/nodes',  no: '01', k: 'nodes' },
    { href: '#/ledger', no: '02', k: 'ledger' },
    { href: '#/desk',   no: '03', k: 'desk' },
    { href: '#/network', no: '04', k: 'network' }
  ];

  var TRAITS = ['1', '2', '3', '4'];

  /**
   * Ba khối xem trước ở đầu trang. Mã băm hiển thị là kết quả SHA-256 THẬT,
   * tính ngay lúc dựng trang chứ không phải chuỗi trang trí.
   */
  function preview() {
    var chain = new DLU.Blockchain({ genesisData: 'Genesis Block' });
    chain.addBlock('Hung -> Viet : 0.42 DLU');
    chain.addBlock('Viet -> Tien : 0.15 DLU');

    return chain.toArray().map(function (b, i) {
      var tie = i === 0 ? '' : '<div class="stub-tie"></div>';
      return tie +
        '<div class="stub">' +
          '<small>' + t('hm.pv.block') + ' ' + String(i).padStart(2, '0') + '</small>' +
          '<b>' + d.esc(i === 0 ? t('hm.pv.root') : t('hm.pv.entry') + ' ' + i) + '</b>' +
          '<div class="digest">' + d.esc(b.hash.slice(0, 30)) + '…</div>' +
        '</div>';
    }).join('');
  }

  function render(root) {
    root.innerHTML =
      '<div class="page">' +

      /* ---------- MỞ ĐẦU ---------- */
      '<section class="top bound">' +
        '<div>' +
          '<span class="kicker">' + d.esc(t('hm.kicker')) + '</span>' +
          '<h1>' + d.esc(t('hm.h1a')) + ' <span class="hl">' + d.esc(t('hm.h1b')) +
            '</span><br>' + d.esc(t('hm.h1c')) + '</h1>' +
          '<p class="lead">' + d.esc(t('hm.lead')) + '</p>' +
          '<div class="cta">' +
            '<a class="act act-key" href="#/nodes">' + d.esc(t('hm.cta1')) + '</a>' +
            '<a class="act act-alt" href="#/desk">' + d.esc(t('hm.cta2')) + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="console">' +
          '<div class="console-bar"><i></i><i></i><i></i>' +
            '<span style="margin-left:6px">' + d.esc(t('hm.pv.title')) + '</span></div>' +
          '<div class="console-body">' + preview() + '</div>' +
        '</div>' +
      '</section>' +

      '<div class="bound">' +
        '<div class="strip">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div><b>' + d.esc(t('hm.num' + i)) + '</b>' +
                   '<span>' + d.esc(t('hm.cap' + i)) + '</span></div>';
          }).join('') +
        '</div>' +
      '</div>' +

      /* ---------- BA PHÂN HỆ ---------- */
      '<section class="zone bound">' +
        '<div class="zone-head">' +
          '<span class="kicker">' + d.esc(t('hm.gate.kicker')) + '</span>' +
          '<h2>' + d.esc(t('hm.gate.h')) + '</h2>' +
          '<p>' + d.esc(t('hm.gate.p')) + '</p>' +
        '</div>' +
        '<div class="rows rows-3">' +
          GATES.map(function (g) {
            return '<a class="gate" href="' + g.href + '">' +
              '<span class="no">' + g.no + ' / 04</span>' +
              '<h3>' + d.esc(t('hm.gate.' + g.k + '.h')) + '</h3>' +
              '<p>' + d.esc(t('hm.gate.' + g.k + '.p')) + '</p>' +
              '<span class="go">' + d.esc(t('hm.gate.go')) + ' →</span>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</section>' +

      /* ---------- MÁY NGHIỀN SHA-256 ---------- */
      '<section class="zone bound" style="padding-top:0">' +
        '<div class="zone-head">' +
          '<span class="kicker">' + d.esc(t('hm.mill.kicker')) + '</span>' +
          '<h2>' + d.esc(t('hm.mill.h1')) + ' <span class="hl">' +
             d.esc(t('hm.mill.h2')) + '</span></h2>' +
          '<p>' + d.esc(t('hm.mill.p')) + '</p>' +
        '</div>' +

        '<div class="slab" style="margin-bottom:16px">' +
          '<div class="slab-bar"><h3>' + d.esc(t('hm.mill.panel')) + '</h3>' +
            '<span class="push"></span>' +
            '<span class="tag tag-b">SHA-256 · FIPS 180-4</span>' +
          '</div>' +
          '<div class="fld" style="margin-bottom:14px">' +
            '<label for="millIn">' + d.esc(t('hm.mill.label')) + '</label>' +
            '<input id="millIn" type="text" value="' + d.esc(t('hm.mill.seed')) +
                   '" placeholder="' + d.esc(t('hm.mill.ph')) + '">' +
          '</div>' +
          '<div class="wide-hash" id="millOut"></div>' +
          '<div class="line" style="margin-top:12px">' +
            '<span class="tag">' + d.esc(t('hm.mill.inLen')) + ' <b id="millLen">0</b></span>' +
            '<span class="tag">' + d.esc(t('hm.mill.outLen')) + ' <b>64 hex · 256 bit</b></span>' +
          '</div>' +
          '<p style="font-size:13px;color:var(--txt-2);margin-top:12px">' +
            t('hm.mill.note') + '</p>' +
        '</div>' +

        '<div class="rows rows-4">' +
          TRAITS.map(function (i) {
            return '<div class="slab slab-plain">' +
              '<span class="tag tag-a">0' + i + '</span>' +
              '<h3 style="font-size:15.5px;margin:11px 0 6px">' + d.esc(t('hm.tr' + i + 'h')) + '</h3>' +
              '<p style="font-size:13.5px;color:var(--txt-2)">' + d.esc(t('hm.tr' + i + 'p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</section>' +

      /* ---------- LỜI MỜI CUỐI TRANG ---------- */
      '<section class="zone bound" style="padding-top:0">' +
        '<div class="slab" style="padding:38px 26px;text-align:center">' +
          '<h2 style="font-size:clamp(21px,3vw,29px);letter-spacing:-.6px;margin-bottom:10px">' +
            d.esc(t('hm.end.h')) + '</h2>' +
          '<p style="color:var(--txt-2);max-width:560px;margin:0 auto 22px">' +
            d.esc(t('hm.end.p')) + '</p>' +
          '<div class="cta" style="justify-content:center">' +
            '<a class="act act-key" href="#/ledger">' + d.esc(t('hm.end.b1')) + '</a>' +
            '<a class="act act-line" href="#/dossier">' + d.esc(t('hm.end.b2')) + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '</div>';

    /* --- Máy nghiền băm chạy trực tiếp --- */
    var input = d.$('#millIn', root);
    var out = d.$('#millOut', root);
    var len = d.$('#millLen', root);
    function refresh() {
      out.textContent = DLU.sha256(input.value);
      len.textContent = DLU.i18n.num(input.value.length);
    }
    input.addEventListener('input', refresh);
    refresh();
  }

  DLU.views = DLU.views || {};
  DLU.views.open = { render: render, destroy: function () {} };
})(typeof window !== 'undefined' ? window : globalThis);
