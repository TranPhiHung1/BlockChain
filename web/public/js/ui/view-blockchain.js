/* =============================================================================
 *  view-blockchain.js — Trang mô phỏng Khối & Chuỗi khối
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };
  var num = function (v) { return DLU.i18n.num(v); };

  var chain = null;
  var root = null;
  var miner = null;   // tay cầm của tiến trình đào đang chạy
  var sampleIndex = 0;

  function samples() {
    return [t('bc.sample1'), t('bc.sample2'), t('bc.sample3'),
            t('bc.sample4'), t('bc.sample5')];
  }

  /** Hiện dải thông báo dưới bảng điều khiển (ẩn khi không có nội dung). */
  function info(html) {
    var box = d.$('#bcMineInfo', root);
    if (!box) return;
    box.innerHTML = html || '';
    box.classList.toggle('hidden', !html);
  }

  /* ------------------------------------------------------------ vẽ 1 khối */
  function blockHtml(entry) {
    var b = entry.block;
    var i = entry.index;
    var difficulty = b.difficulty;   // độ khó mà chính khối này đã được đào

    var statusBadge = entry.valid
      ? '<span class="badge badge-ok">' + d.esc(t('bc.b.ok')) + '</span>'
      : '<span class="badge badge-bad">' + d.esc(
          !entry.dataOk ? t('bc.b.badData')
            : (!entry.powOk ? t('bc.b.badPow') : t('bc.b.badLink'))) + '</span>';

    var nonceRow = difficulty
      ? '<dt>' + d.esc(t('bc.b.nonce')) + '</dt><dd class="mono">' + num(b.nonce) +
        ' <span class="badge badge-warn" style="margin-left:6px">' +
        d.esc(t('bc.b.diff', { k: difficulty })) + '</span></dd>'
      : '';

    var recomputed = entry.dataOk ? '' :
      '<dt>' + d.esc(t('bc.b.recomputed')) + '</dt><dd class="hash hash-bad">' +
      d.esc(b.computeHash()) + '<br><span style="color:var(--warn)">' +
      d.esc(t('bc.b.recomputedNote')) + '</span></dd>';

    return '<div class="block-card' + (entry.valid ? '' : ' invalid') +
             (i === 0 ? ' genesis' : '') + '" data-index="' + i + '">' +
      '<div class="block-head">' +
        '<span class="idx">' + i + '</span>' +
        '<b>' + d.esc(i === 0 ? t('bc.b.genesis') : t('bc.b.block', { i: i })) + '</b>' +
        statusBadge +
        (i > 0 ? '<span class="spacer"></span>' +
          '<button class="btn btn-danger btn-sm" data-tamper="' + i + '">' +
          d.esc(t('bc.b.tamper')) + '</button>' : '') +
      '</div>' +
      '<dl class="block-grid">' +
        '<dt>' + d.esc(t('bc.b.data')) + '</dt><dd><input class="inline-edit" data-edit="' +
            i + '" value="' + d.esc(b.data) + '"></dd>' +
        '<dt>' + d.esc(t('bc.b.time')) + '</dt><dd class="mono" style="font-size:12px">' +
            d.esc(d.fmtTime(b.timestamp)) + '</dd>' +
        nonceRow +
        '<dt>' + d.esc(t('bc.b.prev')) + '</dt><dd class="hash' +
            (entry.linkOk ? '' : ' hash-bad') + '">' + d.esc(b.previousHash) + '</dd>' +
        '<dt>' + d.esc(t('bc.b.hash')) + '</dt><dd class="hash' +
            (entry.valid ? ' hash-ok' : '') + '">' +
            d.highlightZeros(b.hash, difficulty) + '</dd>' +
        recomputed +
      '</dl>' +
      '<div class="formula" style="margin-top:12px">SHA256( <em>prev_hash</em> + ' +
        '<i>timestamp</i> + <em>data</em>' + (difficulty ? ' + <i>nonce</i>' : '') +
        ' ) = ' + d.esc(b.hash.slice(0, 16)) + '…</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- vẽ chuỗi */
  function draw() {
    var view = d.$('#bcChain', root);
    var report = chain.validateDetailed();

    view.innerHTML = report.map(function (entry, i) {
      var link = i === 0 ? '' :
        '<div class="chain-link' + (entry.linkOk ? '' : ' broken') + '"></div>';
      return link + blockHtml(entry);
    }).join('');

    updateStatus(report);
  }

  function updateStatus(report) {
    report = report || chain.validateDetailed();
    var valid = chain.isValid();
    var broken = report.filter(function (r) { return !r.valid; }).length;

    var banner = d.$('#bcStatus', root);
    banner.className = 'card';
    banner.style.borderLeft = '4px solid ' + (valid ? 'var(--ok)' : 'var(--bad)');
    banner.innerHTML =
      '<div class="card-head" style="margin-bottom:6px">' +
        '<h3>' + d.esc(valid ? t('bc.validT') : t('bc.validF')) + '</h3>' +
        '<span class="spacer"></span>' +
        '<span class="badge">' + d.esc(t('bc.count', { n: chain.length })) + '</span>' +
        '<span class="badge">' + d.esc(t('bc.diffNew', { k: chain.difficulty })) + '</span>' +
      '</div>' +
      '<p style="font-size:13.5px;color:var(--text-2)">' +
        (valid ? t('bc.validTxt') : t('bc.invalidTxt', { n: broken })) + '</p>';
  }

  /**
   * Cập nhật nhanh khi người dùng gõ vào ô dữ liệu: KHÔNG vẽ lại toàn bộ
   * (sẽ mất con trỏ nhập liệu), chỉ đổi trạng thái hợp lệ của các khối.
   */
  function refreshValidity() {
    var report = chain.validateDetailed();
    report.forEach(function (entry, i) {
      var card = d.$('.block-card[data-index="' + i + '"]', root);
      if (!card) return;
      card.classList.toggle('invalid', !entry.valid);
      var badge = d.$('.badge', card);
      if (badge) {
        badge.className = 'badge ' + (entry.valid ? 'badge-ok' : 'badge-bad');
        badge.textContent = entry.valid ? t('bc.b.ok')
          : (!entry.dataOk ? t('bc.b.badData')
            : (!entry.powOk ? t('bc.b.badPow') : t('bc.b.badLink')));
      }
    });
    d.$$('.chain-link', root).forEach(function (link, i) {
      link.classList.toggle('broken', !report[i + 1].linkOk);
    });
    updateStatus(report);
  }

  /* ------------------------------------------------------------ thao tác */
  function addBlock() {
    var input = d.$('#bcData', root);
    var pool = samples();
    var data = input.value.trim() || pool[sampleIndex++ % pool.length];
    var btn = d.$('[data-act="add"]', root);
    var status = d.$('#bcMining', root);

    if (!chain.difficulty) {
      chain.addBlock(data);
      input.value = '';
      draw();
      return;
    }

    // Có độ khó ⇒ phải đào, làm bất đồng bộ để giao diện không đứng
    var prevHash = chain.tail ? chain.tail.hash : DLU.Blockchain.ZERO_HASH;
    var block = new DLU.Block(data, prevHash);
    btn.disabled = true;
    status.classList.remove('hidden');

    miner = DLU.consensus.mineAsync(block, chain.difficulty, {
      onProgress: function (s) {
        status.innerHTML = t('bc.mining', {
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
        miner = null;
        draw();
        info(t('bc.mined', { n: num(s.nonce), a: num(s.attempts), s: s.seconds.toFixed(2) }));
      }
    });
  }

  function setDifficulty(value) {
    chain.difficulty = parseInt(value, 10) || 0;
    d.$('#bcDiffVal', root).textContent = chain.difficulty === 0
      ? t('bc.diffOff')
      : t('bc.diffOn', {
          k: chain.difficulty,
          n: num(DLU.consensus.expectedAttempts(chain.difficulty))
        });
    draw();
  }

  function repair() {
    var attempts = chain.recomputeFrom(0);
    draw();
    info(chain.difficulty ? t('bc.repaired.pow', { n: num(attempts) })
                          : t('bc.repaired.off'));
  }

  function attackDemo() {
    if (chain.length < 2) { addBlock(); addBlock(); }
    chain.tamper(1, t('bc.attackData'));
    draw();
    info(t('bc.attacked'));
  }

  function reset() {
    if (miner) { miner.cancel(); miner = null; }
    var diff = chain ? chain.difficulty : 0;
    chain = new DLU.Blockchain({ difficulty: diff, genesisData: 'Genesis Block' });
    sampleIndex = 0;
    info('');
    d.$('#bcMining', root).classList.add('hidden');
    d.$('[data-act="add"]', root).disabled = false;
    draw();
  }

  /* -------------------------------------------------------------- render */
  function render(container) {
    root = container;
    chain = new DLU.Blockchain({ genesisData: 'Genesis Block', difficulty: 0 });
    sampleIndex = 0;

    root.innerHTML =
      '<div class="page wrap section" style="padding-top:44px">' +
      '<div class="section-title" style="text-align:left;margin-bottom:26px">' +
        '<span class="eyebrow">' + d.esc(t('bc.eyebrow')) + '</span>' +
        '<h2 style="margin-top:12px">' + d.esc(t('bc.title')) + '</h2>' +
        '<p style="margin:0">' + t('bc.sub') + '</p>' +
      '</div>' +

      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('bc.panel')) + '</h3></div>' +
        '<div class="row">' +
          '<div class="field" style="flex:1;min-width:250px">' +
            '<label for="bcData">' + d.esc(t('bc.dataLabel')) + '</label>' +
            '<input id="bcData" type="text" placeholder="' + d.esc(t('bc.dataPh')) +
                   '" autocomplete="off">' +
          '</div>' +
          '<button class="btn btn-primary" data-act="add">' + d.esc(t('bc.btn.add')) + '</button>' +
          '<button class="btn btn-danger"  data-act="attack">' + d.esc(t('bc.btn.attack')) + '</button>' +
          '<button class="btn btn-green"   data-act="repair">' + d.esc(t('bc.btn.repair')) + '</button>' +
          '<button class="btn btn-ghost"   data-act="reset">' + d.esc(t('bc.btn.reset')) + '</button>' +
        '</div>' +
        '<div class="field" style="margin-top:16px">' +
          '<label for="bcDiff">' + d.esc(t('bc.diff')) +
             ' — <span id="bcDiffVal" class="mono"></span></label>' +
          '<input id="bcDiff" type="range" min="0" max="5" step="1" value="0">' +
        '</div>' +
        '<div id="bcMining" class="note hidden" style="margin-top:12px"></div>' +
        '<div id="bcMineInfo" class="note hidden" style="margin-top:12px;font-size:13px"></div>' +
      '</div>' +

      '<div id="bcStatus" class="card" style="margin-bottom:18px"></div>' +

      '<div class="chain-view" id="bcChain"></div>' +

      '<div class="card" style="margin-top:22px">' +
        '<div class="card-head"><h3>' + d.esc(t('bc.explain')) + '</h3></div>' +
        '<div class="grid grid-3">' +
          [1, 2, 3].map(function (i) {
            return '<div><b style="color:var(--dlu-orange-2)">' + d.esc(t('bc.e' + i + '.t')) +
              '</b><p style="font-size:13.5px;color:var(--text-2);margin-top:6px">' +
              t('bc.e' + i + '.p') + '</p></div>';
          }).join('') +
        '</div>' +
        '<div class="note" style="margin-top:16px">' + t('bc.note') +
          ' → <a href="#/consensus" style="color:var(--dlu-orange-2)">' +
          d.esc(t('bc.note.link')) + '</a></div>' +
      '</div>' +
      '</div>';

    var actions = { add: addBlock, attack: attackDemo, repair: repair, reset: reset };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = actions[btn.getAttribute('data-act')];
      if (fn) fn();
    });

    // Sửa dữ liệu trực tiếp trên khối = mô phỏng kẻ tấn công
    d.on(root, 'input', '[data-edit]', function (ev, input) {
      var index = parseInt(input.getAttribute('data-edit'), 10);
      var block = chain.at(index);
      if (block) { block.data = input.value; refreshValidity(); }
    });
    d.on(root, 'click', '[data-tamper]', function (ev, btn) {
      var index = parseInt(btn.getAttribute('data-tamper'), 10);
      var input = d.$('[data-edit="' + index + '"]', root);
      if (input) { input.focus(); input.select(); }
    });

    d.$('#bcDiff', root).addEventListener('input', function (ev) {
      setDifficulty(ev.target.value);
    });
    d.$('#bcData', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') addBlock();
    });

    setDifficulty(0);
    var pool = samples();
    chain.addBlock(pool[sampleIndex++]);
    chain.addBlock(pool[sampleIndex++]);
    draw();
  }

  function destroy() {
    if (miner) { miner.cancel(); miner = null; }
    root = null;
  }

  DLU.views = DLU.views || {};
  DLU.views.blockchain = { render: render, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
