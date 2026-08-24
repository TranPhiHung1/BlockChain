/* =============================================================================
 *  view-nodes.js — Phân hệ 01: Mắt xích dữ liệu (danh sách liên kết đơn)
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };

  var list = null;
  var journal = [];       // [{key, params, kind}] — dịch lại khi đổi ngôn ngữ
  var busy = false;       // khoá bảng lệnh trong lúc chạy hoạt ảnh dò tìm
  var walkTimer = null;   // bộ hẹn giờ của hoạt ảnh, phải huỷ khi rời trang
  var root = null;

  var SOURCE = [
    'insertFirst(data) {                  // O(1)',
    '  const fresh = new Node(data);',
    '  if (this.head) {',
    '    fresh.next = this.head;          // móc vào mắt xích đang đứng đầu',
    '    this.head = fresh;               // rồi tự nhận vị trí đầu',
    '  } else {',
    '    this.head = this.tail = fresh;   // danh sách còn trống',
    '  }',
    '}',
    '',
    'insertLast(data) {                   // O(1) nhờ giữ sẵn con trỏ tail',
    '  const fresh = new Node(data);',
    '  if (this.head) {',
    '    this.tail.next = fresh;',
    '    this.tail = fresh;',
    '  } else {',
    '    this.head = this.tail = fresh;',
    '  }',
    '}',
    '',
    'search(data) {                       // O(n) — lần theo từng con trỏ',
    '  let cur = this.head;',
    '  while (cur) {',
    '    if (cur.data === data) return true;',
    '    cur = cur.next;                  // nhảy sang mắt xích kế tiếp',
    '  }',
    '  return false;',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------ nhật ký */
  function note(key, params, kind) {
    journal.unshift({ key: key, params: params || {}, kind: kind || '' });
    if (journal.length > 40) journal.pop();
    drawJournal();
  }

  function drawJournal() {
    var box = d.$('#ndTape', root);
    if (!box) return;
    box.innerHTML = journal.map(function (l) {
      var cls = l.kind ? ' class="k-' + l.kind + '"' : '';
      return '<div' + cls + '>$ ' + d.esc(t(l.key, l.params)) + '</div>';
    }).join('');
  }

  /* --------------------------------------------------------- vẽ mắt xích */
  function draw() {
    var track = d.$('#ndTrack', root);
    if (!track) return;
    var cells = list.toArray();

    if (!cells.length) {
      track.innerHTML = '<div class="blank">' + d.esc(t('nd.blank')) + '</div>';
    } else {
      track.innerHTML = cells.map(function (n, i) {
        var pins = '';
        if (n === list.head) pins += '<span class="pin a">HEAD</span>';
        if (n === list.tail) pins += '<span class="pin b">TAIL</span>';
        return (i ? '<div class="hop">→</div>' : '') +
          '<div class="cell" data-id="' + n.id + '">' + pins +
            '<div class="cell-val">' +
              '<b>' + d.esc(n.data) + '</b>' +
              '<small>' + d.esc(n.addr) + '</small>' +
            '</div>' +
            '<div class="cell-ptr">' + (n.next ? '→' : '∅') + '</div>' +
          '</div>';
      }).join('') +
      '<div class="hop">→</div><div class="void">null</div>';
    }

    d.$('#ndSize', root).textContent = list.length;
    d.$('#ndHead', root).textContent = list.head ? String(list.head.data) : '—';
    d.$('#ndTail', root).textContent = list.tail ? String(list.tail.data) : '—';
    d.$('#ndDump', root).textContent = list.length ? list.show() : t('nd.blankDump');
  }

  /* ------------------------------------------------------------ thao tác */
  function takeInput() {
    var input = d.$('#ndInput', root);
    var value = input.value.trim();
    if (!value) {
      note('nd.j.empty', {}, 'no');
      input.focus();
      return null;
    }
    return value;
  }

  function pushFront() {
    var v = takeInput(); if (v === null) return;
    list.insertFirst(v);
    note('nd.j.front', { v: v, n: list.length }, 'ok');
    d.$('#ndInput', root).value = '';
    draw();
  }

  function pushBack() {
    var v = takeInput(); if (v === null) return;
    list.insertLast(v);
    note('nd.j.back', { v: v, n: list.length }, 'ok');
    d.$('#ndInput', root).value = '';
    draw();
  }

  /** Dò tìm có hoạt ảnh: sáng dần từng mắt xích theo đúng đường đi thật. */
  function walk() {
    var v = takeInput(); if (v === null || busy) return;
    if (!list.length) { note('nd.j.noWalk', {}, 'no'); return; }

    busy = true;
    lock(true);
    var result = list.search(v);
    note('nd.j.walkStart', { v: v }, 'hi');

    var i = 0;
    (function stepOn() {
      if (!root) return;   // đã rời trang hoặc đổi ngôn ngữ ⇒ dừng hẳn
      d.$$('.cell', root).forEach(function (n) { n.classList.remove('step', 'hit'); });

      if (i >= result.steps.length) {
        if (result.found) {
          var last = d.$('.cell[data-id="' + result.steps[result.steps.length - 1] + '"]', root);
          if (last) last.classList.add('hit');
          note('nd.j.hit', { v: v, i: result.index, n: result.steps.length }, 'ok');
        } else {
          note('nd.j.miss', { v: v, n: result.steps.length }, 'no');
        }
        busy = false;
        lock(false);
        return;
      }

      var el = d.$('.cell[data-id="' + result.steps[i] + '"]', root);
      var last = (i === result.steps.length - 1);
      if (el) el.classList.add(result.found && last ? 'hit' : 'step');
      note('nd.j.walkStep', { i: i });
      i++;
      walkTimer = setTimeout(stepOn, 520);
    })();
  }

  function drop() {
    var v = takeInput(); if (v === null) return;
    var gone = list.remove(v);
    note(gone ? 'nd.j.drop' : 'nd.j.noDrop', { v: v, n: list.length }, gone ? 'ok' : 'no');
    d.$('#ndInput', root).value = '';
    draw();
  }

  function flip() {
    if (!list.length) return;
    list.reverse();
    note('nd.j.flip', {}, 'hi');
    draw();
  }

  function wipe() {
    list.clear();
    note('nd.j.wipe', {}, 'hi');
    draw();
  }

  function seed() {
    list.clear();
    list.insertLast('prepare');
    list.insertLast('roll');
    list.insertFirst('assemble');
    note('nd.j.seed', {}, 'hi');
    draw();
  }

  function lock(state) {
    d.$$('[data-act]', root).forEach(function (b) { b.disabled = state; });
  }

  /* -------------------------------------------------------------- dựng trang */
  function render(container) {
    if (walkTimer) { clearTimeout(walkTimer); walkTimer = null; }
    root = container;
    list = new DLU.LinkedList();
    journal = [];
    busy = false;

    root.innerHTML =
      '<div class="page bound zone" style="padding-top:40px">' +

      '<div class="zone-head">' +
        '<span class="kicker">' + d.esc(t('nd.kicker')) + '</span>' +
        '<h2>' + d.esc(t('nd.h')) + '</h2>' +
        '<p>' + t('nd.p') + '</p>' +
      '</div>' +

      /* ---- Bảng lệnh + chỉ số ---- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nd.deck')) + '</h3></div>' +
          '<div class="fld" style="margin-bottom:14px">' +
            '<label for="ndInput">' + d.esc(t('nd.inLabel')) + '</label>' +
            '<input id="ndInput" type="text" placeholder="' + d.esc(t('nd.inPh')) +
                   '" autocomplete="off">' +
          '</div>' +
          '<div class="rows" style="grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:9px">' +
            '<button class="act act-key"  data-act="front">' + d.esc(t('nd.b.front')) + '</button>' +
            '<button class="act act-key"  data-act="back">'  + d.esc(t('nd.b.back'))  + '</button>' +
            '<button class="act act-alt"  data-act="walk">'  + d.esc(t('nd.b.walk'))  + '</button>' +
            '<button class="act act-warn" data-act="drop">'  + d.esc(t('nd.b.drop'))  + '</button>' +
          '</div>' +
          '<div class="line" style="margin-top:10px">' +
            '<button class="act act-line act-xs" data-act="flip">' + d.esc(t('nd.b.flip')) + '</button>' +
            '<button class="act act-line act-xs" data-act="seed">' + d.esc(t('nd.b.seed')) + '</button>' +
            '<button class="act act-line act-xs" data-act="wipe">' + d.esc(t('nd.b.wipe')) + '</button>' +
          '</div>' +
          '<p style="font-size:12.5px;color:var(--txt-3);margin-top:12px">' +
            d.esc(t('nd.hint')) + '</p>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nd.state')) + '</h3></div>' +
          '<div class="meter">' +
            '<div><b id="ndSize">0</b><span>' + d.esc(t('nd.m.size')) + '</span></div>' +
            '<div><b id="ndHead">—</b><span>' + d.esc(t('nd.m.head')) + '</span></div>' +
            '<div><b id="ndTail">—</b><span>' + d.esc(t('nd.m.tail')) + '</span></div>' +
          '</div>' +
          '<div class="fld" style="margin-top:14px">' +
            '<label>' + d.esc(t('nd.m.dump')) + '</label>' +
            '<div class="calc" id="ndDump"></div>' +
          '</div>' +
          '<div class="tip" style="margin-top:14px">' + t('nd.state.tip') + '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Bản đồ ô nhớ ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nd.map')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag">' + d.esc(t('nd.mapNote')) + '</span>' +
        '</div>' +
        '<div class="track" id="ndTrack"></div>' +
      '</div>' +

      /* ---- Nhật ký + mã nguồn ---- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nd.journal')) + '</h3></div>' +
          '<div class="tape" id="ndTape"></div>' +
        '</div>' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nd.source')) + '</h3></div>' +
          '<div class="tape" style="max-height:330px">' + d.esc(SOURCE) + '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Bảng chi phí thao tác ---- */
      '<div class="slab">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nd.cost')) + '</h3></div>' +
        '<div class="sheet-wrap">' +
        '<table class="sheet"><thead><tr>' +
          '<th>' + d.esc(t('nd.c.op')) + '</th><th>' + d.esc(t('nd.c.list')) + '</th>' +
          '<th>' + d.esc(t('nd.c.arr')) + '</th><th>' + d.esc(t('nd.c.chain')) + '</th>' +
        '</tr></thead><tbody>' +
          '<tr><th>' + d.esc(t('nd.c.r1')) + '</th><td>O(1)</td><td>' + d.esc(t('nd.c.r1a')) +
              '</td><td>' + d.esc(t('nd.c.r1b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('nd.c.r2')) + '</th><td>' + d.esc(t('nd.c.r2a')) +
              '</td><td>O(1)</td><td>' + t('nd.c.r2b') + '</td></tr>' +
          '<tr><th>' + d.esc(t('nd.c.r3')) + '</th><td>O(n)</td><td>O(1)</td><td>' +
              d.esc(t('nd.c.r3b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('nd.c.r4')) + '</th><td>O(n)</td><td>O(n)</td><td>' +
              d.esc(t('nd.c.r4b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('nd.c.r5')) + '</th><td>' + t('nd.c.r5a') + '</td><td>' +
              d.esc(t('nd.c.r5arr')) + '</td><td>' + t('nd.c.r5b') + '</td></tr>' +
        '</tbody></table></div>' +
        '<div class="tip" style="margin-top:16px">' + t('nd.bridge') +
          ' → <a href="#/ledger">' + d.esc(t('nd.bridgeLink')) + '</a></div>' +
      '</div>' +
      '</div>';

    var acts = {
      front: pushFront, back: pushBack, walk: walk,
      drop: drop, flip: flip, wipe: wipe, seed: seed
    };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = acts[btn.getAttribute('data-act')];
      if (fn) fn();
    });
    d.$('#ndInput', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') pushBack();
    });

    seed();
    note('nd.j.ready', {}, 'hi');
  }

  function destroy() {
    if (walkTimer) { clearTimeout(walkTimer); walkTimer = null; }
    busy = false;
    root = null;
  }

  DLU.views = DLU.views || {};
  DLU.views.nodes = { render: render, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
