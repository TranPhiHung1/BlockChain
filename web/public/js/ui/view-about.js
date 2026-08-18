/* =============================================================================
 *  view-about.js — Trang Giới thiệu đồ án
 *  Dữ liệu nhóm / học phần / GitHub lấy từ js/config.js
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };
  var tr = function (v) { return DLU.tr(v); };

  var FILES = [
    ['js/lib/sha256.js', 1], ['js/core/linked-list.js', 2],
    ['js/core/blockchain.js', 3], ['js/core/consensus.js', 4],
    ['js/core/ecdsa.js', 8],
    ['js/i18n.js', 5], ['js/ui/*.js', 6], ['css/style.css', 7]
  ];

  var TOPIC_CARDS = ['ctx', 'goal', 'scope', 'method', 'result', 'future'];

  /* ------------------------------------------------- thẻ một sinh viên */
  function memberCard(m) {
    var initials = String(m.name || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase();
    var links = '';
    if (m.email) {
      links += '<a class="member-link" href="mailto:' + d.esc(m.email) + '">✉️ ' +
               d.esc(m.email) + '</a>';
    }
    if (m.github) {
      links += '<a class="member-link" href="' + d.esc(m.github) +
               '" target="_blank" rel="noopener">🐙 GitHub</a>';
    }

    return '<div class="member">' +
      '<div class="member-av">' + (m.emoji ? m.emoji : d.esc(initials)) + '</div>' +
      '<div class="member-body">' +
        '<b>' + d.esc(m.name) + '</b>' +
        '<div class="member-id"><span class="badge">' + d.esc(t('ab.team.id')) + ': ' +
           d.esc(m.id) + '</span></div>' +
        '<p>' + d.esc(tr(m.role)) + '</p>' +
        (links ? '<div class="member-links">' + links + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------- một dòng học phần */
  function courseRow(labelKey, value) {
    return '<div class="info-row"><dt>' + d.esc(t(labelKey)) + '</dt>' +
           '<dd>' + d.esc(value) + '</dd></div>';
  }

  function render(root) {
    var cfg = DLU.config;

    root.innerHTML =
      '<div class="page wrap section" style="padding-top:44px">' +

      // ---------- Tiêu đề ----------
      '<div class="section-title" style="text-align:left;margin-bottom:26px">' +
        '<span class="eyebrow">' + d.esc(t('ab.eyebrow')) + '</span>' +
        '<h2 style="margin-top:12px">' + d.esc(t('ab.title')) +
          ' <span class="grad-text">' + d.esc(t('ab.titleHi')) + '</span></h2>' +
        '<p style="margin:0">' + d.esc(t('ab.sub')) + '</p>' +
      '</div>' +

      // ---------- Tên đề tài ----------
      '<div class="card topic-card" style="margin-bottom:18px">' +
        '<span class="eyebrow">' + d.esc(t('ab.topic.badge')) + '</span>' +
        '<h3 class="topic-title">' + d.esc(t('ab.topic.title')) + '</h3>' +
        '<p class="topic-alt">' + d.esc(t('ab.topic.en')) + '</p>' +
      '</div>' +

      // ---------- Giới thiệu đề tài: 6 thẻ ----------
      '<div class="grid grid-3" style="margin-bottom:18px">' +
        TOPIC_CARDS.map(function (k) {
          return '<div class="card">' +
            '<b style="color:var(--dlu-orange-2);font-size:15px">' +
               d.esc(t('ab.topic.' + k + '.t')) + '</b>' +
            '<p style="font-size:13.5px;color:var(--text-2);margin-top:8px">' +
               d.esc(t('ab.topic.' + k + '.p')) + '</p>' +
          '</div>';
        }).join('') +
      '</div>' +

      // ---------- Học phần + GitHub ----------
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-bottom:18px">' +
        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ab.course.t')) + '</h3></div>' +
          '<dl class="info-list">' +
            courseRow('ab.course.subject',  tr(cfg.course.subject)) +
            courseRow('ab.course.lecturer', tr(cfg.course.lecturer)) +
            courseRow('ab.course.class',    tr(cfg.course.className)) +
            courseRow('ab.course.term',     tr(cfg.course.term)) +
            courseRow('ab.course.year',     tr(cfg.course.year)) +
            courseRow('ab.course.faculty',  tr(cfg.course.faculty)) +
            courseRow('ab.course.school',   tr(cfg.course.school)) +
          '</dl>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ab.repo.t')) + '</h3></div>' +
          '<p style="font-size:13.5px;color:var(--text-2)">' + d.esc(t('ab.repo.p')) + '</p>' +
          '<a class="btn btn-primary" style="margin-top:16px" target="_blank" rel="noopener" ' +
             'href="' + d.esc(cfg.github.url) + '">🐙 ' + d.esc(t('ab.repo.btn')) + '</a>' +
          '<div class="field" style="margin-top:16px">' +
            '<label>' + d.esc(t('ab.repo.clone')) + '</label>' +
            '<div class="term" style="max-height:none">' + d.esc(cfg.github.clone) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ---------- Sinh viên thực hiện ----------
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ab.team.t')) + '</h3>' +
          '<span class="spacer"></span>' +
          '<span class="badge">' + cfg.team.length + '</span>' +
        '</div>' +
        '<p style="font-size:13.5px;color:var(--text-2);margin-bottom:16px">' +
          d.esc(t('ab.team.sub')) + '</p>' +
        '<div class="member-grid">' + cfg.team.map(memberCard).join('') + '</div>' +
      '</div>' +

      // ---------- Mạch suy luận + nguồn gốc mã ----------
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-bottom:18px">' +
        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ab.goal.t')) + '</h3></div>' +
          '<p style="font-size:14px;color:var(--text-2)">' + d.esc(t('ab.goal.p')) + '</p>' +
          '<ol style="font-size:14px;color:var(--text-2);margin:14px 0 0 18px;display:grid;gap:8px">' +
            '<li>' + t('ab.goal.1') + '</li>' +
            '<li>' + t('ab.goal.2') + '</li>' +
            '<li>' + t('ab.goal.3') + '</li>' +
          '</ol>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ab.src.t')) + '</h3></div>' +
          '<p style="font-size:14px;color:var(--text-2)">' + d.esc(t('ab.src.p')) + '</p>' +
          '<div class="term" style="margin-top:12px;max-height:none">' +
            'LinkList.py           → insert_First / insert_Last / Search / show\n' +
            'Block_BlockChain.py   → compute_hash / add_Block / is_Valid / show\n\n' +
            'consensus.js          → ' + d.esc(t('ab.src.new')) +
          '</div>' +
        '</div>' +
      '</div>' +

      // ---------- Công nghệ ----------
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ab.stack.t')) + '</h3></div>' +
        '<div class="grid grid-4">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div>' +
              '<b style="color:var(--dlu-orange-2);font-size:14.5px">' +
                 d.esc(t('ab.stack.' + i + 't')) + '</b>' +
              '<p style="font-size:13px;color:var(--text-2);margin-top:6px">' +
                 d.esc(t('ab.stack.' + i + 'p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      // ---------- Cấu trúc thư mục ----------
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ab.files.t')) + '</h3></div>' +
        '<div class="table-scroll"><table class="cmp"><thead><tr>' +
          '<th>' + d.esc(t('ab.files.file')) + '</th><th>' + d.esc(t('ab.files.role')) +
          '</th><th>' + d.esc(t('ab.files.note')) + '</th></tr></thead><tbody>' +
          FILES.map(function (f) {
            return '<tr><th class="mono" style="width:210px">' + d.esc(f[0]) + '</th><td>' +
              d.esc(t('ab.files.' + f[1] + 'r')) + '</td><td style="color:var(--text-2)">' +
              d.esc(t('ab.files.' + f[1] + 'n')) + '</td></tr>';
          }).join('') +
        '</tbody></table></div>' +
      '</div>' +

      // ---------- Tài liệu tham khảo ----------
      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('ab.ref.t')) + '</h3></div>' +
        '<ul style="font-size:14px;color:var(--text-2);margin-left:18px;display:grid;gap:9px">' +
          [1, 2, 3, 4].map(function (i) {
            return '<li>' + t('ab.ref.' + i) + '</li>';
          }).join('') +
        '</ul>' +
        '<div class="note" style="margin-top:18px">' + t('ab.ref.note') + '</div>' +
      '</div>' +
      '</div>';
  }

  DLU.views = DLU.views || {};
  DLU.views.about = { render: render, destroy: function () {} };
})(typeof window !== 'undefined' ? window : globalThis);
