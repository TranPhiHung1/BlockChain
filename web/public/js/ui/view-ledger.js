/* =============================================================================
 *  view-ledger.js — Phân hệ 02: Sổ cái khối (khối & chuỗi khối)
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };
  var num = function (v) { return DLU.i18n.num(v); };

  var chain = null;
  var root = null;
  var forge = null;    // tay cầm của tiến trình đào đang chạy
  var seedAt = 0;

  function seeds() {
    return [t('lg.seed1'), t('lg.seed2'), t('lg.seed3'), t('lg.seed4'), t('lg.seed5')];
  }

  /** Dải thông báo dưới bảng đóng khối (tự ẩn khi không có nội dung). */
  function say(html) {
    var box = d.$('#lgSay', root);
    if (!box) return;
    box.innerHTML = html || '';
    box.classList.toggle('hidden', !html);
  }

  /* ------------------------------------------------------------ vẽ 1 khối */
  function brickHtml(entry) {
    var b = entry.block;
    var i = entry.index;
    var k = b.difficulty;   // độ khó mà chính khối này đã được đóng

    var flag = entry.valid
      ? '<span class="tag tag-ok js-flag">' + d.esc(t('lg.k.ok')) + '</span>'
      : '<span class="tag tag-no js-flag">' + d.esc(
          !entry.dataOk ? t('lg.k.noData')
            : (!entry.powOk ? t('lg.k.noWork') : t('lg.k.noLink'))) + '</span>';

    var nonceRow = k
      ? '<dt>nonce</dt><dd class="mono">' + num(b.nonce) +
        ' <span class="tag tag-warn" style="margin-left:6px">' +
        d.esc(t('lg.k.diff', { k: k })) + '</span></dd>'
      : '';

    var redo = entry.dataOk ? '' :
      '<dt>' + d.esc(t('lg.k.redo')) + '</dt><dd class="digest digest-no">' +
      d.esc(b.computeHash()) + '<br><span style="color:var(--warn)">' +
      d.esc(t('lg.k.redoNote')) + '</span></dd>';

    return '<div class="brick' + (entry.valid ? '' : ' bad') +
             (i === 0 ? ' root' : '') + '" data-index="' + i + '">' +
      '<div class="brick-top">' +
        '<span class="no">' + i + '</span>' +
        '<b>' + d.esc(i === 0 ? t('lg.k.root') : t('lg.k.block', { i: i })) + '</b>' +
        flag +
        (i > 0 ? '<span class="push"></span>' +
          '<button class="act act-warn act-xs" data-strike="' + i + '">' +
          d.esc(t('lg.k.strike')) + '</button>' : '') +
      '</div>' +
      '<dl class="spec">' +
        '<dt>' + d.esc(t('lg.k.body')) + '</dt><dd><input class="edit" data-edit="' +
            i + '" value="' + d.esc(b.data) + '"></dd>' +
        '<dt>' + d.esc(t('lg.k.stamp')) + '</dt><dd class="mono" style="font-size:12.5px">' +
            d.esc(d.fmtTime(b.timestamp)) + '</dd>' +
        nonceRow +
        '<dt>' + d.esc(t('lg.k.prev')) + '</dt><dd class="digest' +
            (entry.linkOk ? '' : ' digest-no') + '">' + d.esc(b.previousHash) + '</dd>' +
        '<dt>' + d.esc(t('lg.k.self')) + '</dt><dd class="digest' +
            (entry.valid ? ' digest-ok' : '') + '">' +
            d.highlightZeros(b.hash, k) + '</dd>' +
        redo +
      '</dl>' +
      '<div class="calc" style="margin-top:11px">SHA256( <em>prev_hash</em> + ' +
        '<i>timestamp</i> + <em>data</em>' + (k ? ' + <i>nonce</i>' : '') +
        ' ) = ' + d.esc(b.hash.slice(0, 16)) + '…</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- vẽ sổ cái */
  function draw() {
    var stack = d.$('#lgStack', root);
    var report = chain.validateDetailed();

    stack.innerHTML = report.map(function (entry, i) {
      var tie = i === 0 ? '' :
        '<div class="tie' + (entry.linkOk ? '' : ' cut') + '"></div>';
      return tie + brickHtml(entry);
    }).join('');

    drawVerdict(report);
  }

  function drawVerdict(report) {
    report = report || chain.validateDetailed();
    var sound = chain.isValid();
    var broken = report.filter(function (r) { return !r.valid; }).length;

    d.$('#lgVerdict', root).innerHTML =
      '<div class="line" style="align-items:center;margin-bottom:10px">' +
        '<span class="tag ' + (sound ? 'tag-ok' : 'tag-no') + '" style="font-size:12.5px;padding:5px 11px">' +
          d.esc(sound ? t('lg.v.ok') : t('lg.v.no')) + '</span>' +
      '</div>' +
      '<div class="meter">' +
        '<div><b>' + num(chain.length) + '</b><span>' + d.esc(t('lg.v.count')) + '</span></div>' +
        '<div><b>' + num(broken) + '</b><span>' + d.esc(t('lg.v.broken')) + '</span></div>' +
        '<div><b>' + num(chain.difficulty) + '</b><span>' + d.esc(t('lg.v.diff')) + '</span></div>' +
      '</div>' +
      '<p style="font-size:13.5px;color:var(--txt-2);margin-top:12px">' +
        (sound ? t('lg.v.okTxt') : t('lg.v.noTxt', { n: broken })) + '</p>';
  }

  /**
   * Cập nhật nhanh khi người dùng đang gõ vào ô dữ liệu: KHÔNG vẽ lại toàn bộ
   * (sẽ mất con trỏ nhập liệu), chỉ đổi trạng thái hợp lệ của từng khối.
   */
  function refreshFlags() {
    var report = chain.validateDetailed();
    report.forEach(function (entry, i) {
      var card = d.$('.brick[data-index="' + i + '"]', root);
      if (!card) return;
      card.classList.toggle('bad', !entry.valid);
      var flag = d.$('.js-flag', card);
      if (flag) {
        flag.className = 'tag js-flag ' + (entry.valid ? 'tag-ok' : 'tag-no');
        flag.textContent = entry.valid ? t('lg.k.ok')
          : (!entry.dataOk ? t('lg.k.noData')
            : (!entry.powOk ? t('lg.k.noWork') : t('lg.k.noLink')));
      }
    });
    d.$$('.tie', root).forEach(function (tie, i) {
      tie.classList.toggle('cut', !report[i + 1].linkOk);
    });
    drawVerdict(report);
  }

  /* ------------------------------------------------------------- thao tác */
  function seal() {
    var input = d.$('#lgBody', root);
    var pool = seeds();
    var data = input.value.trim() || pool[seedAt++ % pool.length];
    var btn = d.$('[data-act="seal"]', root);
    var status = d.$('#lgWork', root);

    if (!chain.difficulty) {
      chain.addBlock(data);
      input.value = '';
      draw();
      return;
    }

    // Có độ khó ⇒ phải dò nonce; làm bất đồng bộ để giao diện không đứng hình
    var prevHash = chain.tail ? chain.tail.hash : DLU.Blockchain.ZERO_HASH;
    var block = new DLU.Block(data, prevHash);
    btn.disabled = true;
    status.classList.remove('hidden');

    forge = DLU.consensus.mineAsync(block, chain.difficulty, {
      onProgress: function (s) {
        status.innerHTML = t('lg.working', {
          n: num(s.nonce), r: num(s.hashrate), h: d.esc(s.hash.slice(0, 24))
        });
      },
      onDone: function (s) {
        if (chain.tail) { chain.tail.next = block; chain.tail = block; }
        else { chain.head = chain.tail = block; }
        chain.length++;
        status.classList.add('hidden');
        btn.disabled = false;
        input.value = '';
        forge = null;
        draw();
        say(t('lg.worked', { n: num(s.nonce), a: num(s.attempts), s: s.seconds.toFixed(2) }));
      }
    });
  }

  function setDifficulty(value) {
    chain.difficulty = parseInt(value, 10) || 0;
    d.$('#lgDiffVal', root).textContent = chain.difficulty === 0
      ? t('lg.diffOff')
      : t('lg.diffOn', {
          k: chain.difficulty,
          n: num(DLU.consensus.expectedAttempts(chain.difficulty))
        });
    draw();
  }

  function rebuild() {
    var attempts = chain.recomputeFrom(0);
    draw();
    say(chain.difficulty ? t('lg.rebuilt.work', { n: num(attempts) })
                         : t('lg.rebuilt.plain'));
  }

  function strike() {
    if (chain.length < 2) { seal(); seal(); }
    chain.tamper(1, t('lg.strikeBody'));
    draw();
    say(t('lg.struck'));
  }

  function reset() {
    if (forge) { forge.cancel(); forge = null; }
    var k = chain ? chain.difficulty : 0;
    chain = new DLU.Blockchain({ difficulty: k, genesisData: 'Genesis Block' });
    seedAt = 0;
    say('');
    d.$('#lgWork', root).classList.add('hidden');
    d.$('[data-act="seal"]', root).disabled = false;
    draw();
  }

  /* -------------------------------------------------------------- dựng trang */
  function render(container) {
    root = container;
    chain = new DLU.Blockchain({ genesisData: 'Genesis Block', difficulty: 0 });
    seedAt = 0;

    root.innerHTML =
      '<div class="page bound zone" style="padding-top:40px">' +

      '<div class="zone-head">' +
        '<span class="kicker">' + d.esc(t('lg.kicker')) + '</span>' +
        '<h2>' + d.esc(t('lg.h')) + '</h2>' +
        '<p>' + t('lg.p') + '</p>' +
      '</div>' +

      /* ---- Xưởng đóng khối + tình trạng ---- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('lg.deck')) + '</h3></div>' +
          '<div class="fld" style="margin-bottom:12px">' +
            '<label for="lgBody">' + d.esc(t('lg.bodyLabel')) + '</label>' +
            '<input id="lgBody" type="text" placeholder="' + d.esc(t('lg.bodyPh')) +
                   '" autocomplete="off">' +
          '</div>' +
          '<div class="rows" style="grid-template-columns:repeat(auto-fit,minmax(146px,1fr));gap:9px">' +
            '<button class="act act-key"  data-act="seal">'    + d.esc(t('lg.b.seal'))    + '</button>' +
            '<button class="act act-warn" data-act="strike">'  + d.esc(t('lg.b.strike'))  + '</button>' +
            '<button class="act act-alt"  data-act="rebuild">' + d.esc(t('lg.b.rebuild')) + '</button>' +
            '<button class="act act-line" data-act="reset">'   + d.esc(t('lg.b.reset'))   + '</button>' +
          '</div>' +
          '<div class="fld" style="margin-top:16px">' +
            '<label for="lgDiff">' + d.esc(t('lg.diff')) + '</label>' +
            '<input id="lgDiff" type="range" min="0" max="5" step="1" value="0">' +
            '<span class="mono" id="lgDiffVal" style="font-size:12.5px;color:var(--txt-2)"></span>' +
          '</div>' +
          '<div id="lgWork" class="tip hidden" style="margin-top:12px"></div>' +
          '<div id="lgSay"  class="tip hidden" style="margin-top:12px;font-size:13px"></div>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('lg.state')) + '</h3></div>' +
          '<div id="lgVerdict"></div>' +
          '<div class="tip" style="margin-top:14px">' + t('lg.state.tip') + '</div>' +
        '</div>' +
      '</div>' +

      /* ---- Chồng khối ---- */
      '<div class="stack" id="lgStack"></div>' +

      /* ---- Ba điều rút ra ---- */
      '<div class="slab" style="margin-top:20px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('lg.take')) + '</h3></div>' +
        '<div class="rows rows-3">' +
          [1, 2, 3].map(function (i) {
            return '<div>' +
              '<b style="color:var(--blue-2);font-size:15px">' + d.esc(t('lg.t' + i + 'h')) + '</b>' +
              '<p style="font-size:13.5px;color:var(--txt-2);margin-top:6px">' + t('lg.t' + i + 'p') + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="tip" style="margin-top:16px">' + t('lg.bridge') +
          ' → <a href="#/desk">' + d.esc(t('lg.bridgeLink')) + '</a></div>' +
      '</div>' +
      '</div>';

    var acts = { seal: seal, strike: strike, rebuild: rebuild, reset: reset };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = acts[btn.getAttribute('data-act')];
      if (fn) fn();
    });

    // Sửa thẳng dữ liệu trên khối = mô phỏng kẻ sửa trộm sổ sách
    d.on(root, 'input', '[data-edit]', function (ev, input) {
      var index = parseInt(input.getAttribute('data-edit'), 10);
      var block = chain.at(index);
      if (block) { block.data = input.value; refreshFlags(); }
    });
    d.on(root, 'click', '[data-strike]', function (ev, btn) {
      var index = parseInt(btn.getAttribute('data-strike'), 10);
      var input = d.$('[data-edit="' + index + '"]', root);
      if (input) { input.focus(); input.select(); }
    });

    d.$('#lgDiff', root).addEventListener('input', function (ev) {
      setDifficulty(ev.target.value);
    });
    d.$('#lgBody', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') seal();
    });

    setDifficulty(0);
    var pool = seeds();
    chain.addBlock(pool[seedAt++]);
    chain.addBlock(pool[seedAt++]);
    draw();
  }

  function destroy() {
    if (forge) { forge.cancel(); forge = null; }
    root = null;
  }

  DLU.views = DLU.views || {};
  DLU.views.ledger = { render: render, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
