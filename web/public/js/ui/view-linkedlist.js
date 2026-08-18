/* =============================================================================
 *  view-linkedlist.js — Trang mô phỏng Danh sách liên kết đơn
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };

  var list = null;
  var logLines = [];      // [{key, params, kind}] — dịch lại khi đổi ngôn ngữ
  var busy = false;       // khoá thao tác khi đang chạy hoạt ảnh tìm kiếm
  var searchTimer = null; // hẹn giờ của hoạt ảnh, phải huỷ khi rời trang
  var root = null;

  var CODE = [
    'insertFirst(data) {                  // O(1)',
    '  const newNode = new Node(data);',
    '  if (this.head) {',
    '    newNode.next = this.head;        // new node points at the old head',
    '    this.head = newNode;             // it becomes the new head',
    '  } else {',
    '    this.head = this.tail = newNode; // empty list',
    '  }',
    '}',
    '',
    'insertLast(data) {                   // O(1) thanks to the tail pointer',
    '  const newNode = new Node(data);',
    '  if (this.head) {',
    '    this.tail.next = newNode;',
    '    this.tail = newNode;',
    '  } else {',
    '    this.head = this.tail = newNode;',
    '  }',
    '}',
    '',
    'search(data) {                       // O(n) — linear walk',
    '  let cur = this.head;',
    '  while (cur) {',
    '    if (cur.data === data) return true;',
    '    cur = cur.next;                  // follow the pointer',
    '  }',
    '  return false;',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------------- ghi log */
  function log(key, params, kind) {
    logLines.unshift({ key: key, params: params || {}, kind: kind || '' });
    if (logLines.length > 40) logLines.pop();
    drawLog();
  }

  function drawLog() {
    var box = d.$('#llTerm', root);
    if (!box) return;
    box.innerHTML = logLines.map(function (l) {
      var cls = l.kind ? ' class="t-' + l.kind + '"' : '';
      return '<div' + cls + '>&gt; ' + d.esc(t(l.key, l.params)) + '</div>';
    }).join('');
  }

  /* ------------------------------------------------------------- vẽ danh sách */
  function draw() {
    var canvas = d.$('#llCanvas', root);
    if (!canvas) return;
    var nodes = list.toArray();

    if (!nodes.length) {
      canvas.innerHTML = '<div class="ll-empty">' + d.esc(t('ll.empty')) + '</div>';
    } else {
      canvas.innerHTML = nodes.map(function (n, i) {
        var tags = '';
        if (n === list.head) tags += '<span class="ll-tag head">HEAD</span>';
        if (n === list.tail) tags += '<span class="ll-tag tail">TAIL</span>';
        return (i ? '<div class="ll-arrow">→</div>' : '') +
          '<div class="ll-node" data-id="' + n.id + '">' + tags +
            '<div class="cell-data">' +
              '<b>' + d.esc(n.data) + '</b>' +
              '<small>' + d.esc(n.addr) + '</small>' +
            '</div>' +
            '<div class="cell-next">' + (n.next ? '●' : '∅') + '</div>' +
          '</div>';
      }).join('') +
      '<div class="ll-arrow">→</div><div class="ll-null">null</div>';
    }

    d.$('#llCount', root).textContent = list.length;
    d.$('#llHead', root).textContent = list.head ? String(list.head.data) : '—';
    d.$('#llTail', root).textContent = list.tail ? String(list.tail.data) : '—';
    d.$('#llShow', root).textContent = list.length ? list.show() : t('ll.emptyShow');
  }

  /* ----------------------------------------------------------- các thao tác */
  function readInput() {
    var input = d.$('#llInput', root);
    var value = input.value.trim();
    if (!value) {
      log('ll.log.needValue', {}, 'bad');
      input.focus();
      return null;
    }
    return value;
  }

  function doInsertFirst() {
    var v = readInput(); if (v === null) return;
    list.insertFirst(v);
    log('ll.log.first', { v: v, n: list.length }, 'ok');
    d.$('#llInput', root).value = '';
    draw();
  }

  function doInsertLast() {
    var v = readInput(); if (v === null) return;
    list.insertLast(v);
    log('ll.log.last', { v: v, n: list.length }, 'ok');
    d.$('#llInput', root).value = '';
    draw();
  }

  /** Tìm kiếm có hoạt ảnh: tô sáng từng nút theo đúng đường duyệt. */
  function doSearch() {
    var v = readInput(); if (v === null || busy) return;
    if (!list.length) { log('ll.log.emptySearch', {}, 'bad'); return; }

    busy = true;
    setDisabled(true);
    var result = list.search(v);
    log('ll.log.searchStart', { v: v }, 'hi');

    var i = 0;
    (function stepThrough() {
      if (!root) return;   // đã rời trang hoặc đổi ngôn ngữ ⇒ dừng hẳn
      d.$$('.ll-node', root).forEach(function (n) {
        n.classList.remove('visiting', 'found');
      });

      if (i >= result.steps.length) {
        if (result.found) {
          var hit = d.$('.ll-node[data-id="' + result.steps[result.steps.length - 1] + '"]', root);
          if (hit) hit.classList.add('found');
          log('ll.log.found', { v: v, i: result.index, n: result.steps.length }, 'ok');
        } else {
          log('ll.log.notFound', { v: v, n: result.steps.length }, 'bad');
        }
        busy = false;
        setDisabled(false);
        return;
      }

      var el = d.$('.ll-node[data-id="' + result.steps[i] + '"]', root);
      var isLast = (i === result.steps.length - 1);
      if (el) el.classList.add(result.found && isLast ? 'found' : 'visiting');
      log('ll.log.searchStep', { i: i });
      i++;
      searchTimer = setTimeout(stepThrough, 520);
    })();
  }

  function doRemove() {
    var v = readInput(); if (v === null) return;
    var removed = list.remove(v);
    log(removed ? 'll.log.removed' : 'll.log.notRemoved',
        { v: v, n: list.length }, removed ? 'ok' : 'bad');
    d.$('#llInput', root).value = '';
    draw();
  }

  function doReverse() {
    if (!list.length) return;
    list.reverse();
    log('ll.log.reverse', {}, 'hi');
    draw();
  }

  function doClear() {
    list.clear();
    log('ll.log.clear', {}, 'hi');
    draw();
  }

  function doSample() {
    list.clear();
    list.insertLast('prepare');
    list.insertLast('roll');
    list.insertFirst('assemble');
    log('ll.log.sample', {}, 'hi');
    draw();
  }

  function setDisabled(state) {
    d.$$('[data-act]', root).forEach(function (b) { b.disabled = state; });
  }

  /* -------------------------------------------------------------- render */
  function render(container) {
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
    root = container;
    list = new DLU.LinkedList();
    logLines = [];
    busy = false;

    root.innerHTML =
      '<div class="page wrap section" style="padding-top:44px">' +
      '<div class="section-title" style="text-align:left;margin-bottom:26px">' +
        '<span class="eyebrow">' + d.esc(t('ll.eyebrow')) + '</span>' +
        '<h2 style="margin-top:12px">' + d.esc(t('ll.title')) + '</h2>' +
        '<p style="margin:0">' + t('ll.sub') + '</p>' +
      '</div>' +

      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ll.panel')) + '</h3>' +
          '<span class="spacer"></span>' +
          '<span class="badge">' + d.esc(t('ll.len')) + ' <b id="llCount">0</b></span>' +
          '<span class="badge badge-head">HEAD: <b id="llHead">—</b></span>' +
          '<span class="badge badge-tail">TAIL: <b id="llTail">—</b></span>' +
        '</div>' +
        '<div class="row">' +
          '<div class="field" style="flex:1;min-width:220px">' +
            '<label for="llInput">' + d.esc(t('ll.inputLabel')) + '</label>' +
            '<input id="llInput" type="text" placeholder="' + d.esc(t('ll.inputPh')) +
                   '" autocomplete="off">' +
          '</div>' +
          '<button class="btn btn-primary" data-act="first">' + d.esc(t('ll.btn.first')) + '</button>' +
          '<button class="btn btn-green"   data-act="last">' + d.esc(t('ll.btn.last')) + '</button>' +
          '<button class="btn btn-ghost"   data-act="search">' + d.esc(t('ll.btn.search')) + '</button>' +
          '<button class="btn btn-danger"  data-act="remove">' + d.esc(t('ll.btn.remove')) + '</button>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-ghost btn-sm" data-act="reverse">' + d.esc(t('ll.btn.reverse')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="sample">' + d.esc(t('ll.btn.sample')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="clear">' + d.esc(t('ll.btn.clear')) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ll.mem')) + '</h3>' +
          '<span class="spacer"></span>' +
          '<span class="badge">' + d.esc(t('ll.memNote')) + '</span>' +
        '</div>' +
        '<div class="ll-canvas" id="llCanvas"></div>' +
        '<div class="formula" style="margin-top:14px">show() → <span id="llShow"></span></div>' +
      '</div>' +

      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(330px,1fr))">' +
        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ll.log')) + '</h3></div>' +
          '<div class="term" id="llTerm"></div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head"><h3>' + d.esc(t('ll.code')) + '</h3></div>' +
          '<div class="term" style="max-height:340px">' + d.esc(CODE) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ll.cmp')) + '</h3></div>' +
        '<div class="table-scroll">' +
        '<table class="cmp"><thead><tr>' +
          '<th>' + d.esc(t('ll.cmp.op')) + '</th><th>' + d.esc(t('ll.cmp.ll')) + '</th>' +
          '<th>' + d.esc(t('ll.cmp.arr')) + '</th><th>' + d.esc(t('ll.cmp.bc')) + '</th>' +
        '</tr></thead><tbody>' +
          '<tr><th>' + d.esc(t('ll.cmp.r1')) + '</th><td>O(1)</td><td>' + d.esc(t('ll.cmp.r1a')) +
              '</td><td>' + d.esc(t('ll.cmp.r1b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('ll.cmp.r2')) + '</th><td>' + d.esc(t('ll.cmp.r2a')) +
              '</td><td>O(1)</td><td>' + t('ll.cmp.r2b') + '</td></tr>' +
          '<tr><th>' + d.esc(t('ll.cmp.r3')) + '</th><td>O(n)</td><td>O(1)</td><td>' +
              d.esc(t('ll.cmp.r3b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('ll.cmp.r4')) + '</th><td>O(n)</td><td>O(n)</td><td>' +
              d.esc(t('ll.cmp.r4b')) + '</td></tr>' +
          '<tr><th>' + d.esc(t('ll.cmp.r5')) + '</th><td>' + t('ll.cmp.r5a') + '</td><td>' +
              d.esc(t('ll.cmp.r5arr')) + '</td><td>' + t('ll.cmp.r5b') + '</td></tr>' +
        '</tbody></table></div>' +
        '<div class="note" style="margin-top:16px">' + t('ll.note') +
          ' → <a href="#/blockchain" style="color:var(--dlu-orange-2)">' +
          d.esc(t('ll.note.link')) + '</a></div>' +
      '</div>' +
      '</div>';

    var actions = {
      first: doInsertFirst, last: doInsertLast, search: doSearch,
      remove: doRemove, reverse: doReverse, clear: doClear, sample: doSample
    };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = actions[btn.getAttribute('data-act')];
      if (fn) fn();
    });
    d.$('#llInput', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') doInsertLast();
    });

    doSample();
    log('ll.log.ready', {}, 'hi');
  }

  function destroy() {
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
    busy = false;
    root = null;
  }

  DLU.views = DLU.views || {};
  DLU.views.linkedlist = { render: render, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
