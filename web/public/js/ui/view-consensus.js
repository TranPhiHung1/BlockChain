/* =============================================================================
 *  view-consensus.js — Trang Giao thức đồng thuận
 *  Gồm 3 thẻ: Proof of Work · Mạng đồng thuận · An ninh & So sánh
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var C = DLU.consensus;
  var t = function () { return DLU.t.apply(null, arguments); };
  var num = function (v) { return DLU.i18n.num(v); };

  var root = null;
  var currentTab = 'pow';
  var miner = null;
  var network = null;
  var mode = 'pow';          // pow | pos — cách chọn nút được ghi khối
  var busyRound = false;
  var txIndex = 0;

  var PEER_CONFIG = [
    { id: 'n1', nameKey: 'cs.peer.n1', emoji: '🌲', hashPower: 32, stake: 400 },
    { id: 'n2', nameKey: 'cs.peer.n2', emoji: '🏙️', hashPower: 26, stake: 250 },
    { id: 'n3', nameKey: 'cs.peer.n3', emoji: '🏛️', hashPower: 20, stake: 180 },
    { id: 'n4', nameKey: 'cs.peer.n4', emoji: '🌊', hashPower: 14, stake: 120 },
    { id: 'n5', nameKey: 'cs.peer.n5', emoji: '🌾', hashPower:  8, stake:  50 }
  ];

  function txPool() {
    return [t('cs.tx1'), t('cs.tx2'), t('cs.tx3'), t('cs.tx4'), t('cs.tx5'), t('cs.tx6')];
  }

  /* =====================================================================
   *  THẺ 1 — PROOF OF WORK
   * =================================================================== */
  function powHtml() {
    return '' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('cs.pow.shop')) + '</h3></div>' +
        '<div class="field" style="margin-bottom:14px">' +
          '<label for="pwData">' + d.esc(t('cs.pow.data')) + '</label>' +
          '<input id="pwData" type="text" value="' + d.esc(t('cs.pow.dataVal')) +
                 '" autocomplete="off">' +
        '</div>' +
        '<div class="field" style="margin-bottom:14px">' +
          '<label for="pwDiff">' + d.esc(t('cs.pow.diff')) +
             ' — <span id="pwDiffVal" class="mono"></span></label>' +
          '<input id="pwDiff" type="range" min="1" max="6" step="1" value="4">' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn btn-primary" id="pwStart">' + d.esc(t('cs.pow.start')) + '</button>' +
          '<button class="btn btn-danger"  id="pwStop" disabled>' + d.esc(t('cs.pow.stop')) + '</button>' +
        '</div>' +
        '<div class="gauge" style="margin-top:16px"><i id="pwGauge"></i></div>' +
        '<div class="kpi" style="margin-top:14px">' +
          '<div><b id="pwNonce">0</b><span>' + d.esc(t('cs.pow.k1')) + '</span></div>' +
          '<div><b id="pwAttempts">0</b><span>' + d.esc(t('cs.pow.k2')) + '</span></div>' +
          '<div><b id="pwRate">0</b><span>' + d.esc(t('cs.pow.k3')) + '</span></div>' +
          '<div><b id="pwTime">0.0s</b><span>' + d.esc(t('cs.pow.k4')) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('cs.pow.trying')) + '</h3>' +
          '<span class="spacer"></span><span class="badge" id="pwTarget"></span></div>' +
        '<div class="big-hash" id="pwHash">' + new Array(65).join('·') + '</div>' +
        '<div class="note" style="margin-top:16px">' + t('cs.pow.rule') + '</div>' +
        '<div class="formula" style="margin-top:12px" id="pwFormula"></div>' +
      '</div>' +
    '</div>' +

    '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.pow.why')) + '</h3></div>' +
      '<div class="table-scroll"><table class="cmp"><thead><tr>' +
        '<th>' + d.esc(t('cs.pow.th1')) + '</th><th>' + d.esc(t('cs.pow.th2')) + '</th>' +
        '<th>' + d.esc(t('cs.pow.th3')) + '</th><th>' + d.esc(t('cs.pow.th4')) + '</th>' +
      '</tr></thead><tbody>' +
        [1, 2, 3, 4, 5, 6].map(function (k) {
          var attempts = C.expectedAttempts(k);
          var secs = attempts / 200000;
          var human = secs < 1 ? t('cs.pow.lt1')
            : secs < 60 ? t('cs.pow.sec', { n: secs.toFixed(1) })
            : secs < 3600 ? t('cs.pow.min', { n: (secs / 60).toFixed(1) })
            : t('cs.pow.hour', { n: (secs / 3600).toFixed(1) });
          return '<tr><th>' + k + '</th><td class="mono">' + new Array(k + 1).join('0') +
            '…</td><td class="mono">' + num(attempts) + '</td><td>' + d.esc(human) + '</td></tr>';
        }).join('') +
      '</tbody></table></div>' +
      '<p style="font-size:13px;color:var(--text-2);margin-top:12px">' +
        t('cs.pow.whyNote') + '</p>' +
    '</div>';
  }

  function bindPow() {
    var diff = d.$('#pwDiff', root);

    function updateDiffLabel() {
      var k = parseInt(diff.value, 10);
      d.$('#pwDiffVal', root).textContent =
        t('cs.pow.diffVal', { k: k, n: num(C.expectedAttempts(k)) });
      d.$('#pwTarget', root).textContent =
        t('cs.pow.target', { t: new Array(k + 1).join('0') });
    }
    diff.addEventListener('input', updateDiffLabel);
    updateDiffLabel();

    function paint(state, difficulty, done) {
      d.$('#pwNonce', root).textContent = num(state.nonce);
      d.$('#pwAttempts', root).textContent = num(state.attempts);
      d.$('#pwRate', root).textContent = num(state.hashrate);
      d.$('#pwTime', root).textContent = state.seconds.toFixed(1) + 's';
      var pct = Math.min(100, state.attempts / C.expectedAttempts(difficulty) * 100);
      d.$('#pwGauge', root).style.width = (done ? 100 : pct) + '%';
      var box = d.$('#pwHash', root);
      box.innerHTML = d.highlightZeros(state.hash, done ? difficulty : 0);
      box.classList.toggle('mining', !done);
    }

    d.$('#pwStart', root).addEventListener('click', function () {
      if (miner) miner.cancel();
      var difficulty = parseInt(diff.value, 10);
      var data = d.$('#pwData', root).value || t('cs.pow.dataVal');
      var prev = DLU.sha256('previous block');
      var block = new DLU.Block(data, prev);

      d.$('#pwStart', root).disabled = true;
      d.$('#pwStop', root).disabled = false;
      d.$('#pwFormula', root).innerHTML = t('cs.pow.hashing', {
        p: d.esc(prev.slice(0, 12)), t: block.timestamp.toFixed(3), d: d.esc(data)
      });

      miner = C.mineAsync(block, difficulty, {
        onProgress: function (s) { paint(s, difficulty, false); },
        onDone: function (s) {
          paint(s, difficulty, true);
          miner = null;
          d.$('#pwStart', root).disabled = false;
          d.$('#pwStop', root).disabled = true;
          d.$('#pwFormula', root).innerHTML = t('cs.pow.found', {
            n: num(s.nonce), a: num(s.attempts), s: s.seconds.toFixed(2)
          });
        }
      });
    });

    d.$('#pwStop', root).addEventListener('click', function () {
      if (miner) { miner.cancel(); miner = null; }
      d.$('#pwStart', root).disabled = false;
      d.$('#pwStop', root).disabled = true;
      d.$('#pwHash', root).classList.remove('mining');
    });
  }

  /* =====================================================================
   *  THẺ 2 — MẠNG ĐỒNG THUẬN
   * =================================================================== */
  function netHtml() {
    return '' +
    '<div class="card" style="margin-bottom:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.net.title')) + '</h3>' +
        '<span class="spacer"></span>' +
        '<button class="tab' + (mode === 'pow' ? ' active' : '') + '" data-mode="pow">' +
           d.esc(t('cs.tab.pow')) + '</button>' +
        '<button class="tab' + (mode === 'pos' ? ' active' : '') + '" data-mode="pos">' +
           '🪙 Proof of Stake</button>' +
      '</div>' +
      '<p style="font-size:13.5px;color:var(--text-2);margin-bottom:14px" id="netModeText"></p>' +
      '<div class="row">' +
        '<button class="btn btn-primary" data-net="propose">' + d.esc(t('cs.net.propose')) + '</button>' +
        '<button class="btn btn-danger"  data-net="tamper">' + d.esc(t('cs.net.tamper')) + '</button>' +
        '<button class="btn btn-green"   data-net="resolve">' + d.esc(t('cs.net.resolve')) + '</button>' +
        '<button class="btn btn-ghost"   data-net="reset">' + d.esc(t('cs.net.reset')) + '</button>' +
      '</div>' +
      '<div id="netBanner" style="margin-top:14px"></div>' +
    '</div>' +

    '<div class="peer-grid" id="netPeers"></div>' +

    '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.net.log')) + '</h3></div>' +
      '<div class="logbox" id="netLog"></div>' +
    '</div>' +

    '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.net.rules')) + '</h3></div>' +
      '<div class="grid grid-3">' +
        [1, 2, 3].map(function (i) {
          return '<div><b style="color:var(--dlu-orange-2)">' + d.esc(t('cs.net.r' + i + 't')) +
            '</b><p style="font-size:13.5px;color:var(--text-2);margin-top:6px">' +
            t('cs.net.r' + i + 'p') + '</p></div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function drawNetwork() {
    var wrap = d.$('#netPeers', root);
    if (!wrap) return;

    wrap.innerHTML = network.peers.map(function (p) {
      var report = p.chain.validateDetailed();
      var mini = report.map(function (r, i) {
        var cls = !r.valid ? ' class="bad"' : (i === 0 ? ' class="gen"' : '');
        return '<i' + cls + ' title="#' + i + ': ' + d.esc(r.block.data) + '">' + i + '</i>';
      }).join('');
      var weight = mode === 'pos'
        ? t('cs.net.stake', { n: num(p.stake) })
        : t('cs.net.power', { n: p.hashPower });
      var barPct = mode === 'pos' ? p.stake / 400 * 100 : p.hashPower / 32 * 100;

      return '<div class="peer' + (p.isValid() ? '' : ' bad') + '" data-peer="' + p.id + '">' +
        '<div class="peer-top"><span class="av">' + p.emoji + '</span>' +
          '<b>' + d.esc(t(p.nameKey)) + '</b>' +
          '<span class="spacer" style="margin-left:auto"></span>' +
          (p.isValid()
            ? '<span class="badge badge-ok">' + d.esc(t('cs.net.ok')) + '</span>'
            : '<span class="badge badge-bad">' + d.esc(t('cs.net.bad')) + '</span>') +
        '</div>' +
        '<div class="peer-mini">' + mini + '</div>' +
        '<div class="hash" style="font-size:10.5px">' + d.esc(t('cs.net.tip')) + ' ' +
           d.esc(d.shortHash(p.tip(), 10)) + '</div>' +
        '<div style="font-size:11.5px;color:var(--text-2);margin-top:8px">' + d.esc(weight) +
          '<div class="peer-bar"><i style="width:' + barPct + '%"></i></div></div>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:7px">' +
          d.esc(t('cs.net.blocks', { n: p.chain.length })) + ' · ' +
          d.esc(t(p.lastAction.key, p.lastAction.params)) + '</div>' +
      '</div>';
    }).join('');

    // Băng trạng thái đồng thuận
    var agreed = network.inAgreement();
    d.$('#netBanner', root).innerHTML =
      '<div class="note" style="border-left-color:' + (agreed ? 'var(--ok)' : 'var(--bad)') + '">' +
        (agreed ? t('cs.net.agreed', { n: network.peers.length }) : t('cs.net.split')) +
      '</div>';

    // Nhật ký: dịch lại từ khoá nên đổi ngôn ngữ là cả log cũ cũng đổi theo
    d.$('#netLog', root).innerHTML = network.log.map(function (l) {
      var params = l.params;
      if (params.nameKey) {
        params = Object.assign ? Object.assign({}, params) : params;
        params.name = t(params.nameKey);
      }
      return '<div class="' + l.kind + '"><time>' +
        l.at.toLocaleTimeString(DLU.i18n.locale()) + '</time>' +
        d.esc(t(l.key, params)) + '</div>';
    }).join('');

    d.$('#netModeText', root).textContent =
      mode === 'pow' ? t('cs.net.modePow') : t('cs.net.modePos');
  }

  function bindNet() {
    if (!network) {
      network = new C.Network({
        peers: PEER_CONFIG.map(function (c) { return new C.Peer(c); }),
        difficulty: 3,
        genesisData: t('cs.genesis')
      });
    }
    drawNetwork();
  }

  /**
   * Các sự kiện của thẻ Mạng được uỷ quyền cho `root` và chỉ đăng ký MỘT LẦN
   * trong render(), nếu không mỗi lần đổi thẻ sẽ chồng thêm một bộ lắng nghe.
   */
  function bindNetDelegates() {
    d.on(root, 'click', '[data-mode]', function (ev, btn) {
      mode = btn.getAttribute('data-mode');
      network.difficulty = mode === 'pow' ? 3 : 0;
      network.reset(t('cs.genesis'));
      txIndex = 0;
      renderTab();
    });

    d.on(root, 'click', '[data-net]', function (ev, btn) {
      var act = btn.getAttribute('data-net');

      if (act === 'propose') {
        if (busyRound) return;
        busyRound = true;
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = mode === 'pow' ? t('cs.net.mining') : t('cs.net.casting');
        var pool = txPool();
        network.proposeBlock(pool[txIndex++ % pool.length], mode, function (res) {
          busyRound = false;
          btn.disabled = false;
          btn.textContent = label;
          drawNetwork();
          var card = d.$('.peer[data-peer="' + res.proposer.id + '"]', root);
          if (card) {
            card.classList.add('proposer');
            setTimeout(function () { card.classList.remove('proposer'); }, 1600);
          }
        });
      }

      if (act === 'tamper') {
        var honest = network.peers.filter(function (p) { return p.isValid(); });
        var victim = honest[Math.floor(Math.random() * honest.length)];
        if (!victim || victim.chain.length < 2) {
          network.write('cs.log.needBlocks', {}, 'warn');
        } else {
          var idx = 1 + Math.floor(Math.random() * (victim.chain.length - 1));
          network.tamper(victim.id, idx, t('cs.evilData'));
        }
        drawNetwork();
      }

      if (act === 'resolve') { network.resolveConflicts(); drawNetwork(); }
      if (act === 'reset')   { network.reset(t('cs.genesis')); txIndex = 0; drawNetwork(); }
    });
  }

  /* =====================================================================
   *  THẺ 3 — AN NINH & SO SÁNH
   * =================================================================== */
  function secHtml() {
    var rows = ['idea', 'security', 'energy', 'speed', 'finality', 'users'];

    return '' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('cs.atk.title')) + '</h3></div>' +
        '<p style="font-size:13.5px;color:var(--text-2);margin-bottom:16px">' +
          t('cs.atk.intro') + '</p>' +
        '<div class="field" style="margin-bottom:14px">' +
          '<label for="atkQ">' + d.esc(t('cs.atk.q')) +
             ' <b id="atkQVal" class="mono">30%</b></label>' +
          '<input id="atkQ" type="range" min="1" max="49" step="1" value="30">' +
        '</div>' +
        '<div class="field" style="margin-bottom:18px">' +
          '<label for="atkZ">' + d.esc(t('cs.atk.z')) +
             ' <b id="atkZVal" class="mono">6</b></label>' +
          '<input id="atkZ" type="range" min="0" max="20" step="1" value="6">' +
        '</div>' +
        '<div class="big-hash" style="text-align:center;font-size:15px">' +
          d.esc(t('cs.atk.p')) +
          ' <b id="atkP" style="font-size:28px;color:var(--dlu-orange-2)"></b>' +
        '</div>' +
        '<div class="gauge" style="margin-top:12px"><i id="atkGauge"></i></div>' +
        '<div class="note" style="margin-top:14px" id="atkNote"></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('cs.atk.tblT')) + '</h3></div>' +
        '<div class="table-scroll"><table class="cmp"><thead><tr>' +
          '<th>z</th><th>q = 10%</th><th>q = 25%</th><th>q = 35%</th><th>q = 45%</th>' +
        '</tr></thead><tbody id="atkTable"></tbody></table></div>' +
        '<p style="font-size:12.5px;color:var(--text-2);margin-top:12px">' +
          d.esc(t('cs.atk.tblNote')) + '</p>' +
      '</div>' +
    '</div>' +

    '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.cmp.title')) + '</h3></div>' +
      '<div class="table-scroll"><table class="cmp"><thead><tr>' +
        '<th>' + d.esc(t('cs.cmp.crit')) + '</th>' +
        C.PROTOCOL_KEYS.map(function (p) {
          return '<th>' + d.esc(t('cs.proto.' + p + '.name')) + '</th>';
        }).join('') +
      '</tr></thead><tbody>' +
        rows.map(function (field) {
          return '<tr><th>' + d.esc(t('cs.cmp.' + field)) + '</th>' +
            C.PROTOCOL_KEYS.map(function (p) {
              return '<td>' + d.esc(t('cs.proto.' + p + '.' + field)) + '</td>';
            }).join('') + '</tr>';
        }).join('') +
      '</tbody></table></div>' +
    '</div>' +

    '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h3>' + d.esc(t('cs.prob.title')) + '</h3></div>' +
      '<div class="grid grid-3">' +
        [1, 2, 3].map(function (i) {
          return '<div><b style="color:var(--dlu-orange-2)">' + d.esc(t('cs.prob.' + i + 't')) +
            '</b><p style="font-size:13.5px;color:var(--text-2);margin-top:6px">' +
            t('cs.prob.' + i + 'p') + '</p></div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function bindSec() {
    var q = d.$('#atkQ', root), z = d.$('#atkZ', root);

    function update() {
      var qv = parseInt(q.value, 10) / 100;
      var zv = parseInt(z.value, 10);
      var p = C.attackSuccessProbability(qv, zv);

      d.$('#atkQVal', root).textContent = (qv * 100).toFixed(0) + '%';
      d.$('#atkZVal', root).textContent = zv;
      d.$('#atkP', root).textContent = p < 0.0001 && p > 0
        ? p.toExponential(2)
        : (p * 100).toFixed(4) + '%';
      d.$('#atkGauge', root).style.width = Math.min(100, p * 100) + '%';
      d.$('#atkNote', root).innerHTML =
        p > 0.5 ? t('cs.atk.high') : (p > 0.01 ? t('cs.atk.mid') : t('cs.atk.low'));
    }

    q.addEventListener('input', update);
    z.addEventListener('input', update);
    update();

    // Bảng tra cứu nhanh
    var rows = '';
    [0, 1, 2, 3, 4, 5, 6, 8, 10, 15].forEach(function (zv) {
      rows += '<tr><th class="mono">' + zv + '</th>' +
        [0.10, 0.25, 0.35, 0.45].map(function (qv) {
          var p = C.attackSuccessProbability(qv, zv);
          var txt = p >= 0.001 ? (p * 100).toFixed(2) + '%' : p.toExponential(1);
          var color = p > 0.5 ? 'var(--bad)' : p > 0.01 ? 'var(--warn)' : 'var(--ok)';
          return '<td class="mono" style="color:' + color + '">' + txt + '</td>';
        }).join('') + '</tr>';
    });
    d.$('#atkTable', root).innerHTML = rows;
  }

  /* =====================================================================
   *  Bộ khung & chuyển thẻ
   * =================================================================== */
  function renderTab() {
    if (miner) { miner.cancel(); miner = null; }
    var panel = d.$('#csPanel', root);

    d.$$('#csTabs .tab', root).forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === currentTab);
    });

    if (currentTab === 'pow') { panel.innerHTML = powHtml(); bindPow(); }
    if (currentTab === 'net') { panel.innerHTML = netHtml(); bindNet(); }
    if (currentTab === 'sec') { panel.innerHTML = secHtml(); bindSec(); }
  }

  function render(container) {
    root = container;
    busyRound = false;

    root.innerHTML =
      '<div class="page wrap section" style="padding-top:44px">' +
      '<div class="section-title" style="text-align:left;margin-bottom:22px">' +
        '<span class="eyebrow">' + d.esc(t('cs.eyebrow')) + '</span>' +
        '<h2 style="margin-top:12px">' + d.esc(t('cs.title')) + '</h2>' +
        '<p style="margin:0">' + t('cs.sub') + '</p>' +
      '</div>' +
      '<div class="tabs" id="csTabs">' +
        ['pow', 'net', 'sec'].map(function (k) {
          return '<button class="tab' + (k === currentTab ? ' active' : '') +
                 '" data-tab="' + k + '">' + d.esc(t('cs.tab.' + k)) + '</button>';
        }).join('') +
      '</div>' +
      '<div id="csPanel"></div>' +
      '</div>';

    d.on(root, 'click', '#csTabs .tab', function (ev, btn) {
      currentTab = btn.getAttribute('data-tab');
      renderTab();
    });
    bindNetDelegates();

    renderTab();
  }

  function destroy() {
    if (miner) { miner.cancel(); miner = null; }
    busyRound = false;
    root = null;
  }

  DLU.views = DLU.views || {};
  DLU.views.consensus = { render: render, destroy: destroy };
})(typeof window !== 'undefined' ? window : globalThis);
