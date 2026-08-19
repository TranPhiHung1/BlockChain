/* =============================================================================
 *  view-dossier.js — Hồ sơ đồ án
 *  Thông tin nhóm / học phần / kho mã lấy từ js/config.js
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };
  var tr = function (v) { return DLU.tr(v); };

  var FILES = [
    ['js/lib/sha256.js', 1], ['js/core/linked-list.js', 2],
    ['js/core/blockchain.js', 3], ['js/core/ecdsa.js', 4],
    ['js/core/consensus.js', 5],
    ['js/i18n.js', 6], ['js/ui/*.js', 7], ['css/style.css', 8]
  ];

  var BRIEF = ['ctx', 'aim', 'edge', 'way', 'out', 'next'];

  /* ------------------------------------------------- thẻ một thành viên */
  function whoCard(m) {
    var links = '';
    if (m.email) {
      links += '<a class="who-link" href="mailto:' + d.esc(m.email) + '">' +
               d.esc(m.email) + '</a>';
    }
    if (m.github) {
      links += '<a class="who-link" href="' + d.esc(m.github) +
               '" target="_blank" rel="noopener">GitHub</a>';
    }

    return '<div class="who' + (m.lead ? ' lead' : '') + '">' +
      '<div class="who-av">' + d.esc(d.initials(m.name)) + '</div>' +
      '<div class="who-body">' +
        '<b>' + d.esc(m.name) + '</b>' +
        (m.lead ? ' <span class="tag tag-b">' + d.esc(t('ds.crew.lead')) + '</span>' : '') +
        '<div class="who-id"><span class="tag tag-a">' + d.esc(t('ds.crew.id')) + ' ' +
           d.esc(m.id) + '</span></div>' +
        '<p>' + d.esc(tr(m.role)) + '</p>' +
        (links ? '<div class="who-links">' + links + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function factRow(labelKey, value) {
    return '<div class="fact"><dt>' + d.esc(t(labelKey)) + '</dt>' +
           '<dd>' + d.esc(value) + '</dd></div>';
  }

  function render(root) {
    var cfg = DLU.config;

    root.innerHTML =
      '<div class="page bound zone" style="padding-top:40px">' +

      /* ---------- Tiêu đề ---------- */
      '<div class="zone-head">' +
        '<span class="kicker">' + d.esc(t('ds.kicker')) + '</span>' +
        '<h2>' + d.esc(t('ds.h1')) + ' <span class="hl">' + d.esc(t('ds.h2')) + '</span></h2>' +
        '<p>' + d.esc(t('ds.p')) + '</p>' +
      '</div>' +

      /* ---------- Tên đề tài ---------- */
      '<div class="slab" style="margin-bottom:16px;border-left:3px solid var(--blue)">' +
        '<span class="kicker">' + d.esc(t('ds.topic.tag')) + '</span>' +
        '<h3 class="headline">' + d.esc(t('ds.topic.vi')) + '</h3>' +
        '<p class="subline">' + d.esc(t('ds.topic.en')) + '</p>' +
      '</div>' +

      /* ---------- Sáu ô tóm tắt đề tài ---------- */
      '<div class="rows rows-3" style="margin-bottom:16px">' +
        BRIEF.map(function (k) {
          return '<div class="slab slab-plain">' +
            '<b style="color:var(--blue-2);font-size:14.5px">' + d.esc(t('ds.b.' + k + 'h')) + '</b>' +
            '<p style="font-size:13px;color:var(--txt-2);margin-top:8px">' +
               d.esc(t('ds.b.' + k + 'p')) + '</p>' +
          '</div>';
        }).join('') +
      '</div>' +

      /* ---------- Học phần + kho mã ---------- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('ds.course.t')) + '</h3></div>' +
          '<dl class="facts">' +
            factRow('ds.course.subject',  tr(cfg.course.subject)) +
            factRow('ds.course.lecturer', tr(cfg.course.lecturer)) +
            factRow('ds.course.class',    tr(cfg.course.className)) +
            factRow('ds.course.term',     tr(cfg.course.term)) +
            factRow('ds.course.year',     tr(cfg.course.year)) +
            factRow('ds.course.faculty',  tr(cfg.course.faculty)) +
            factRow('ds.course.school',   tr(cfg.course.school)) +
          '</dl>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('ds.repo.t')) + '</h3></div>' +
          '<p style="font-size:13px;color:var(--txt-2)">' + d.esc(t('ds.repo.p')) + '</p>' +
          '<a class="act act-key" style="margin-top:16px" target="_blank" rel="noopener" ' +
             'href="' + d.esc(cfg.github.url) + '">' + d.esc(t('ds.repo.btn')) + '</a>' +
          '<div class="fld" style="margin-top:16px">' +
            '<label>' + d.esc(t('ds.repo.clone')) + '</label>' +
            '<div class="tape" style="max-height:none">' + d.esc(cfg.github.clone) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---------- Nhóm thực hiện ---------- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('ds.crew.t')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag tag-a">' + cfg.team.length + ' ' + d.esc(t('ds.crew.unit')) + '</span>' +
        '</div>' +
        '<p style="font-size:13px;color:var(--txt-2);margin-bottom:16px">' +
          d.esc(t('ds.crew.p')) + '</p>' +
        '<div class="crew">' + cfg.team.map(whoCard).join('') + '</div>' +
      '</div>' +

      /* ---------- Mạch bài + gốc mã Python ---------- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('ds.path.t')) + '</h3></div>' +
          '<p style="font-size:13.5px;color:var(--txt-2)">' + d.esc(t('ds.path.p')) + '</p>' +
          '<ol style="font-size:13.5px;color:var(--txt-2);margin:14px 0 0 18px;display:grid;gap:8px">' +
            '<li>' + t('ds.path.1') + '</li>' +
            '<li>' + t('ds.path.2') + '</li>' +
            '<li>' + t('ds.path.3') + '</li>' +
          '</ol>' +
        '</div>' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('ds.port.t')) + '</h3></div>' +
          '<p style="font-size:13.5px;color:var(--txt-2)">' + d.esc(t('ds.port.p')) + '</p>' +
          '<div class="tape" style="margin-top:12px;max-height:none">' +
            'LinkList.py           -> insert_First / insert_Last / Search / show\n' +
            'Block_BlockChain.py   -> compute_hash / add_Block / is_Valid / show\n' +
            'Key.py                -> generate / public_key / sign / verify / PEM\n\n' +
            d.esc(t('ds.port.note')) +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---------- Nền tảng kỹ thuật ---------- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('ds.tech.t')) + '</h3></div>' +
        '<div class="rows rows-4">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div>' +
              '<b style="color:var(--blue-2);font-size:14px">' + d.esc(t('ds.tech.' + i + 'h')) + '</b>' +
              '<p style="font-size:12.5px;color:var(--txt-2);margin-top:6px">' +
                 d.esc(t('ds.tech.' + i + 'p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      /* ---------- Bản đồ tệp nguồn ---------- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('ds.files.t')) + '</h3></div>' +
        '<div class="sheet-wrap"><table class="sheet"><thead><tr>' +
          '<th>' + d.esc(t('ds.files.file')) + '</th><th>' + d.esc(t('ds.files.role')) +
          '</th><th>' + d.esc(t('ds.files.note')) + '</th></tr></thead><tbody>' +
          FILES.map(function (f) {
            return '<tr><th class="mono" style="width:206px">' + d.esc(f[0]) + '</th><td>' +
              d.esc(t('ds.files.' + f[1] + 'r')) + '</td><td style="color:var(--txt-2)">' +
              d.esc(t('ds.files.' + f[1] + 'n')) + '</td></tr>';
          }).join('') +
        '</tbody></table></div>' +
      '</div>' +

      /* ---------- Tài liệu tham khảo ---------- */
      '<div class="slab">' +
        '<div class="slab-bar"><h3>' + d.esc(t('ds.ref.t')) + '</h3></div>' +
        '<ul style="font-size:13.5px;color:var(--txt-2);margin-left:18px;display:grid;gap:9px">' +
          [1, 2, 3, 4].map(function (i) {
            return '<li>' + t('ds.ref.' + i) + '</li>';
          }).join('') +
        '</ul>' +
        '<div class="tip" style="margin-top:18px">' + t('ds.ref.note') + '</div>' +
      '</div>' +
      '</div>';
  }

  DLU.views = DLU.views || {};
  DLU.views.dossier = { render: render, destroy: function () {} };
})(typeof window !== 'undefined' ? window : globalThis);
