/* =============================================================================
 *  view-network.js — Phân hệ 04: Mạng lưới (Blockchain Network Explorer)
 * -----------------------------------------------------------------------------
 *  Trang này ráp mọi mảnh của ba phân hệ trước thành một MẠNG đang chạy, và
 *  bày ra đúng mạch của một blockchain thật:
 *
 *     Nút mạng → Giao dịch (ký ECDSA) → Cây Merkle → Gốc Merkle → Khối
 *       → Mã băm khối → previous_hash → Đồng thuận (bỏ phiếu) → Khối chung cuộc
 *
 *  KHÔNG CÓ SỐ LIỆU GIẢ Ở BẤT KỲ ĐÂU:
 *    · txid, gốc Merkle, mã băm khối đều gọi SHA-256 thật trong lib/sha256.js
 *    · chữ ký là ECDSA secp256k1 thật trong core/ecdsa.js
 *    · nonce do vòng dò thật trong core/consensus.js tìm ra
 *    · phiếu bầu của mỗi nút là kết quả Peer.review() chạy trên BẢN SAO CHUỖI
 *      của chính nút đó — không có giá trị nào được gán sẵn
 *    · số dư được tính lại bằng cách duyệt toàn bộ chuỗi, không lưu sẵn
 *
 *  Muốn kiểm chứng: mở Console của trình duyệt và gõ
 *      DLU.views.network.debug()
 *  để tự đối chiếu mọi con số đang hiển thị.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };
  var num = function (v) { return DLU.i18n.num(v); };

  var COIN = 'DLU';
  var OPENING = 100;      // số coin phát hành cho mỗi nút trong khối gốc
  var REWARD = 5;         // tiền thưởng cho nút đóng được khối

  /* ---- Cấu hình mạng: sức đào và cổ phần khác nhau để việc chọn nút có ý nghĩa ---- */
  var NODE_SPECS = [
    { id: 'N1', nameKey: 'nw.node.n1', emoji: '🛰️', hashPower: 35, stake: 120 },
    { id: 'N2', nameKey: 'nw.node.n2', emoji: '⛏️', hashPower: 28, stake:  90 },
    { id: 'N3', nameKey: 'nw.node.n3', emoji: '🧭', hashPower: 22, stake: 160 },
    { id: 'N4', nameKey: 'nw.node.n4', emoji: '📡', hashPower: 15, stake:  70 }
  ];

  var root = null;
  var net = null;          // DLU.consensus.Network — mạng đang chạy
  var wallets = {};        // { id: {keys, address} } — khoá riêng nằm trong trình duyệt
  var mempool = [];        // hàng chờ giao dịch chưa vào khối
  var candidate = null;    // khối ứng viên đang dựng (chưa được mạng chấp nhận)
  var candidateMiner = ''; // id nút đề xuất khối ứng viên
  var lastRound = null;    // kết quả bỏ phiếu của vòng gần nhất
  var forge = null;        // tay cầm tiến trình đào
  var mining = false;
  var txCounter = 0;
  var feed = [];           // nhật ký sự kiện: {key, params, kind, at}
  var opened = {};         // các khối đang mở rộng trong bảng tra cứu
  var stepAt = 1;          // bước đang sáng trên dải quy trình

  var C = DLU.consensus;

  /* =======================================================================
   *  0. TIỆN ÍCH
   * ===================================================================== */

  function say(key, params, kind) {
    feed.unshift({ key: key, params: params || {}, kind: kind || 'info', at: new Date() });
    if (feed.length > 40) feed.pop();
  }

  function peers() { return net ? net.peers : []; }

  function peerById(id) {
    var found = null;
    peers().forEach(function (p) { if (p.id === id) found = p; });
    return found;
  }

  /**
   * Chuỗi "chính thống" để tra cứu: chuỗi HỢP LỆ DÀI NHẤT đang có trong mạng.
   * Đây đúng là quy tắc mà một nút thật dùng để chọn nhánh, không phải chọn bừa.
   */
  function canonical() {
    var best = null;
    peers().forEach(function (p) {
      if (!p.isValid()) return;
      if (!best || p.chain.length > best.chain.length) best = p;
    });
    return best || peers()[0];
  }

  function canonState() {
    var p = canonical();
    return p ? C.stateOf(p.chain) : { balances: {}, spent: {} };
  }

  function balanceOf(id) {
    var w = wallets[id];
    if (!w) return 0;
    return canonState().balances[w.address] || 0;
  }

  function nodeName(peer) { return peer.emoji + ' ' + t(peer.nameKey); }

  /** Ô đánh dấu đạt / không đạt cho từng phép kiểm. */
  function chip(ok, label) {
    return '<span class="chip ' + (ok ? 'chip-ok' : 'chip-no') + '">' +
      (ok ? '✓' : '✗') + ' ' + d.esc(label) + '</span>';
  }

  /* =======================================================================
   *  1. KHỞI TẠO MẠNG
   * ===================================================================== */

  /**
   * Sinh ví cho từng nút rồi dựng khối gốc chứa các bút toán phát hành.
   * Số dư ban đầu KHÔNG phải biến đếm rời: nó nằm trong khối Genesis, và mọi
   * nút tính lại số dư bằng cách duyệt chuỗi của chính mình.
   */
  function bootNetwork(difficulty) {
    wallets = {};
    var genesisTxs = [];

    NODE_SPECS.forEach(function (spec, i) {
      var keys = DLU.ecdsa.generateKeyPair();
      wallets[spec.id] = { keys: keys, address: C.addressOf(keys.uncompressed) };
      genesisTxs.push(
        C.makeCoinbase(wallets[spec.id].address, OPENING, i, 'genesis-allocation', spec.id));
    });

    var list = NODE_SPECS.map(function (spec) {
      return new C.Peer({
        id: spec.id, nameKey: spec.nameKey, emoji: spec.emoji,
        hashPower: spec.hashPower, stake: spec.stake,
        address: wallets[spec.id].address
      });
    });

    net = new C.Network({
      peers: list,
      difficulty: difficulty,
      genesisData: 'DLU Genesis Block',
      genesisTxs: genesisTxs
    });

    mempool = [];
    candidate = null;
    candidateMiner = '';
    lastRound = null;
    txCounter = 0;
    opened = {};
    stepAt = 1;
    feed = [];
    say('nw.g.boot', { n: list.length, k: difficulty }, 'ok');
  }

  /* =======================================================================
   *  2. GIAO DỊCH — LẬP PHIẾU & KÝ BẰNG KHOÁ RIÊNG CỦA NÚT
   * ===================================================================== */

  function signAndBroadcastTx() {
    var from = d.$('#nwFrom', root).value;
    var to = d.$('#nwTo', root).value;
    var amount = parseFloat(d.$('#nwAmt', root).value);
    var memo = d.$('#nwMemo', root).value.trim();

    if (from === to) { flash(t('nw.m.err.same'), 'no'); return; }
    if (!isFinite(amount) || amount <= 0) { flash(t('nw.m.err.amount'), 'no'); return; }

    var sender = wallets[from];
    var taker = wallets[to];
    var t0 = performance.now();

    // Chữ ký ECDSA thật, sinh bằng khoá riêng của nút gửi
    var tx = C.makeTx({
      fromAddr: sender.address, toAddr: taker.address,
      amount: amount, nonce: ++txCounter,
      memo: memo || t('nw.m.memoDefault'),
      keys: sender.keys,
      from: from, to: to
    });
    var ms = Math.round(performance.now() - t0);

    mempool.push(tx);
    d.$('#nwMemo', root).value = '';
    stepAt = Math.max(stepAt, 2);
    say('nw.g.tx', {
      from: from, to: to, a: num(tx.amount), c: COIN, id: d.shortHash(tx.txid, 6)
    }, 'ok');
    flash(t('nw.m.ok', { n: ms, id: d.shortHash(tx.txid, 8) }), 'ok');
    paint();
  }

  /** Sửa trộm số tiền SAU KHI ký — để thấy mạng tự phát hiện. */
  function tamperTx(txid) {
    var tx = findTx(txid);
    if (!tx) return;
    C.tamperTx(tx, tx.amount + 5);
    say('nw.g.tamperTx', { id: d.shortHash(tx.txid, 6), a: num(tx.amount) }, 'bad');
    paint();
  }

  function dropTx(txid) {
    mempool = mempool.filter(function (x) { return x.txid !== txid; });
    if (candidate) discardCandidate(true);
    paint();
  }

  function findTx(txid) {
    var found = null;
    mempool.concat(candidate ? candidate.txs : []).forEach(function (x) {
      if (x.txid === txid) found = x;
    });
    return found;
  }

  /* =======================================================================
   *  3. CÂY MERKLE
   * ===================================================================== */

  /** Danh sách txid sẽ được đưa vào cây: của khối ứng viên, hoặc xem trước hàng chờ. */
  function merkleSource() {
    if (candidate) return { txs: candidate.txs, live: true };
    return { txs: mempool, live: false };
  }

  function merkleTree() {
    var src = merkleSource();
    return DLU.merkle.build(src.txs.map(function (tx) { return tx.txid; }));
  }

  /* =======================================================================
   *  4. DỰNG KHỐI ỨNG VIÊN
   * ===================================================================== */

  function assemble() {
    if (!mempool.length) { flash(t('nw.b.needTx'), 'no'); return; }

    var pick = d.$('#nwProposer', root).value;
    var proposer = pick === 'auto' ? net.selectProposer('pow') : peerById(pick);
    candidateMiner = proposer.id;

    // Bút toán thưởng khối đứng đầu danh sách — đúng vị trí coinbase của Bitcoin
    var coinbase = C.makeCoinbase(
      wallets[proposer.id].address, REWARD, net.peers.length + txCounter,
      'block-reward', proposer.id);

    var txs = [coinbase].concat(mempool.slice());
    var merkleRoot = DLU.merkle.root(txs.map(function (tx) { return tx.txid; }));

    // previous_hash lấy từ đỉnh chuỗi mà CHÍNH NÚT ĐỀ XUẤT đang giữ
    var block = new DLU.Block('', proposer.tip());
    block.txs = txs;
    block.merkleRoot = merkleRoot;
    block.miner = proposer.id;
    block.difficulty = 0;
    block.nonce = 0;
    block.hash = block.computeHash();

    candidate = block;
    lastRound = null;
    stepAt = 4;
    say('nw.g.assemble', {
      node: proposer.id, n: txs.length,
      r: d.shortHash(merkleRoot, 8), p: d.shortHash(block.previousHash, 8)
    }, 'info');
    paint();
  }

  function discardCandidate(quiet) {
    if (forge) { forge.cancel(); forge = null; }
    mining = false;
    candidate = null;
    candidateMiner = '';
    lastRound = null;
    stepAt = mempool.length ? 2 : 1;
    if (!quiet) say('nw.g.discard', {}, 'warn');
  }

  /** Đổi trộm gốc Merkle trong header — để xem các nút tính lại và bắt lỗi. */
  function forgeRoot() {
    if (!candidate) return;
    candidate.merkleRoot = DLU.sha256('forged-root-' + Date.now());
    candidate.hash = candidate.computeHash();
    candidate.difficulty = 0;
    candidate.nonce = 0;
    say('nw.g.forgeRoot', { r: d.shortHash(candidate.merkleRoot, 8) }, 'bad');
    lastRound = null;
    paint();
  }

  /* =======================================================================
   *  5. BĂM & BẰNG CHỨNG CÔNG VIỆC
   * ===================================================================== */

  function mine() {
    if (!candidate || mining) return;
    var status = d.$('#nwWork', root);
    mining = true;
    stepAt = 5;
    status.classList.remove('hidden');
    paintBlock();

    forge = C.mineAsync(candidate, net.difficulty, {
      onProgress: function (s) {
        status.innerHTML = t('nw.b.mining', {
          n: num(s.nonce), r: num(s.hashrate), h: d.esc(s.hash.slice(0, 26))
        });
      },
      onDone: function (s) {
        mining = false;
        forge = null;
        status.classList.add('hidden');
        stepAt = 6;
        say('nw.g.mined', {
          node: candidateMiner, n: num(s.nonce), a: num(s.attempts),
          s: s.seconds.toFixed(2), h: d.shortHash(candidate.hash, 8)
        }, 'ok');
        paint();
      }
    });
  }

  /* =======================================================================
   *  6. ĐỒNG THUẬN — PHÁT SÓNG & BỎ PHIẾU
   * ===================================================================== */

  function broadcast() {
    if (!candidate || mining) return;

    // Mỗi nút tự thẩm định trên bản sao chuỗi của chính nó rồi bỏ phiếu.
    var result = net.broadcastBlock(candidate);
    lastRound = {
      block: candidate, miner: candidateMiner,
      votes: result.votes, yes: result.yes,
      quorum: result.quorum, finalized: result.finalized,
      total: net.peers.length
    };

    if (result.finalized) {
      var ids = {};
      candidate.txs.forEach(function (tx) { ids[tx.txid] = true; });
      mempool = mempool.filter(function (tx) { return !ids[tx.txid]; });
      say('nw.g.final', {
        h: d.shortHash(candidate.hash, 8), y: result.yes,
        t: net.peers.length, n: candidate.txs.length
      }, 'ok');
      candidate = null;
      candidateMiner = '';
      stepAt = 7;
    } else {
      say('nw.g.reject', { y: result.yes, q: result.quorum, t: net.peers.length }, 'bad');
      stepAt = 6;
    }
    paint();
  }

  /** Một nút gian lận: sửa dữ liệu một khối cũ trong bản sao của nó. */
  function tamperNode(peerId) {
    var peer = peerById(peerId);
    if (!peer || peer.chain.length < 2) { flash(t('nw.n.needBlock'), 'no'); return; }
    var index = peer.chain.length - 1;
    var block = peer.chain.at(index);
    block.data = 'rewritten-by-' + peerId;    // không băm lại ⇒ chuỗi tự tố cáo
    peer.honest = false;
    peer.lastAction = { key: 'cs.peer.tampered', params: { i: index } };
    say('nw.g.tamperChain', { node: peerId, i: index }, 'bad');
    paint();
  }

  /** Đồng bộ mạng: mọi nút nhận lấy chuỗi hợp lệ dài nhất. */
  function resync() {
    var out = net.resolveConflicts();
    say('nw.g.sync', { n: out.replaced.length, h: d.shortHash(out.winnerTip, 8) },
        out.replaced.length ? 'ok' : 'info');
    paint();
  }

  function setDifficulty(value) {
    net.difficulty = parseInt(value, 10) || 0;
    // Đổi luật giữa chừng ⇒ khối ứng viên phải đào lại từ nonce 0.
    // Các khối đã đóng vẫn giữ độ khó của riêng chúng nên không bị mất hiệu lực.
    if (candidate) {
      candidate.difficulty = 0;
      candidate.nonce = 0;
      candidate.hash = candidate.computeHash();
      lastRound = null;
    }
    var box = d.$('#nwDiffVal', root);
    if (box) {
      box.textContent = t('nw.b.diffVal', {
        k: net.difficulty, n: num(C.expectedAttempts(net.difficulty))
      });
    }
    paint();
  }

  function resetNetwork() {
    var k = net ? net.difficulty : 2;
    if (forge) { forge.cancel(); forge = null; }
    mining = false;
    bootNetwork(k);
    paint();
  }

  /* =======================================================================
   *  7. VẼ GIAO DIỆN
   * ===================================================================== */

  function flash(text, kind) {
    var box = d.$('#nwFlash', root);
    if (!box) return;
    box.className = 'tip' + (kind === 'no' ? ' tip-no' : '');
    box.innerHTML = text;
    box.classList.remove('hidden');
  }

  /* ---------------------------------------------------------- dải chỉ số */
  function paintStats() {
    var head = canonical();
    var tip = head ? head.tip() : '';
    var agree = net.inAgreement();
    var valid = peers().filter(function (p) { return p.isValid(); }).length;

    var tiles = [
      { v: num(head ? head.chain.length : 0), k: 'nw.s.height' },
      { v: '<span class="mono">' + d.esc(d.shortHash(tip, 7)) + '</span>', k: 'nw.s.tip' },
      { v: num(mempool.length), k: 'nw.s.pool' },
      { v: valid + '/' + peers().length, k: 'nw.s.peers' },
      { v: num(net.difficulty), k: 'nw.s.diff' },
      { v: num(Math.floor(peers().length / 2) + 1), k: 'nw.s.quorum' },
      {
        v: '<span class="' + (agree ? 'ok-txt' : 'no-txt') + '">' +
           d.esc(t(agree ? 'nw.s.synced' : 'nw.s.forked')) + '</span>',
        k: 'nw.s.sync'
      }
    ];

    d.$('#nwStats', root).innerHTML = tiles.map(function (s) {
      return '<div class="stat"><b>' + s.v + '</b><span>' + d.esc(t(s.k)) + '</span></div>';
    }).join('');
  }

  /* ------------------------------------------------------- dải quy trình */
  function paintFlow() {
    var steps = [1, 2, 3, 4, 5, 6, 7];
    d.$('#nwFlow', root).innerHTML = steps.map(function (i) {
      var cls = i === stepAt ? ' on' : (i < stepAt ? ' done' : '');
      return '<li class="step' + cls + '">' +
        '<i>' + (i < stepAt ? '✓' : '0' + i) + '</i>' +
        '<span>' + d.esc(t('nw.f.' + i)) + '</span>' +
      '</li>';
    }).join('');
  }

  /* ---------------------------------------------------------- danh sách nút */
  function peerHtml(peer) {
    var ok = peer.isValid();
    var w = wallets[peer.id];
    var vote = null;
    if (lastRound) {
      lastRound.votes.forEach(function (v) { if (v.peer.id === peer.id) vote = v; });
    }
    var voteTag = vote
      ? '<span class="tag ' + (vote.verdict.ok ? 'tag-ok' : 'tag-no') + '">' +
        d.esc(t(vote.verdict.ok ? 'nw.v.yes' : 'nw.v.no')) + '</span>'
      : '';

    return '<div class="peer' + (ok ? '' : ' rogue') + '">' +
      '<div class="peer-top">' +
        '<span class="peer-av">' + peer.emoji + '</span>' +
        '<div class="peer-id">' +
          '<b>' + d.esc(t(peer.nameKey)) + '</b>' +
          '<span class="mono">' + d.esc(peer.id) + ' · ' + d.esc(d.shortHash(w.address, 6)) + '</span>' +
        '</div>' +
        '<span class="push"></span>' +
        voteTag +
        '<span class="tag ' + (ok ? 'tag-ok' : 'tag-no') + '">' +
          d.esc(t(ok ? 'nw.n.ok' : 'nw.n.bad')) + '</span>' +
      '</div>' +

      '<div class="peer-bars">' +
        '<div><span>' + d.esc(t('nw.n.power')) + '</span>' +
          '<i style="width:' + peer.hashPower + '%"></i>' +
          '<b class="mono">' + peer.hashPower + '%</b></div>' +
        '<div><span>' + d.esc(t('nw.n.stake')) + '</span>' +
          '<i class="alt" style="width:' + Math.min(100, peer.stake / 2) + '%"></i>' +
          '<b class="mono">' + num(peer.stake) + '</b></div>' +
      '</div>' +

      '<dl class="peer-spec">' +
        '<dt>' + d.esc(t('nw.n.height')) + '</dt><dd class="mono">' + num(peer.height()) + '</dd>' +
        '<dt>' + d.esc(t('nw.n.tip')) + '</dt>' +
          '<dd class="digest">' + d.esc(d.shortHash(peer.tip(), 12)) + '</dd>' +
        '<dt>' + d.esc(t('nw.n.balance')) + '</dt>' +
          '<dd class="mono">' + num(peer.balanceOf(w.address)) + ' ' + COIN + '</dd>' +
        '<dt>' + d.esc(t('nw.n.last')) + '</dt>' +
          '<dd>' + d.esc(t(peer.lastAction.key, peer.lastAction.params)) + '</dd>' +
      '</dl>' +

      '<div class="line" style="margin-top:10px">' +
        '<button class="act act-warn act-xs" data-tamper="' + peer.id + '">' +
          d.esc(t('nw.n.tamper')) + '</button>' +
      '</div>' +
    '</div>';
  }

  function paintPeers() {
    d.$('#nwNodes', root).innerHTML = peers().map(peerHtml).join('');
  }

  /* ------------------------------------------------------------ hàng chờ */
  function txHtml(tx, inBlock) {
    // Chữ ký được KIỂM LẠI mỗi lần vẽ, dựa trên nội dung hiện tại của phiếu
    var sigOk = tx.coinbase ||
      DLU.ecdsa.verify(tx.pub, C.txPayload(tx), tx.sigDer).valid;
    var idOk = C.txHash(tx) === tx.txid;
    var bal = tx.coinbase ? Infinity : (canonState().balances[tx.fromAddr] || 0);
    var funded = tx.coinbase || bal >= tx.amount;

    var label = tx.coinbase
      ? t('nw.m.coinbase', { to: tx.to })
      : tx.from + ' → ' + tx.to;

    return '<div class="tx' + (sigOk && idOk ? '' : ' bad') + (tx.coinbase ? ' coin' : '') + '">' +
      '<div class="tx-top">' +
        '<span class="mono tx-id">' + d.esc(d.shortHash(tx.txid, 8)) + '</span>' +
        '<b>' + d.esc(label) + '</b>' +
        '<span class="amt mono">' + num(tx.amount) + ' ' + COIN + '</span>' +
        '<span class="push"></span>' +
        (tx.coinbase
          ? '<span class="tag tag-b">' + d.esc(t('nw.m.reward')) + '</span>'
          : '<span class="tag ' + (sigOk ? 'tag-ok' : 'tag-no') + '">' +
            d.esc(t(sigOk ? 'nw.m.sigOk' : 'nw.m.sigNo')) + '</span>') +
        (idOk ? '' : '<span class="tag tag-no">' + d.esc(t('nw.m.idNo')) + '</span>') +
        (funded ? '' : '<span class="tag tag-warn">' + d.esc(t('nw.m.noFunds')) + '</span>') +
      '</div>' +
      '<div class="calc tx-payload">' + d.esc(C.txPayload(tx)) + '</div>' +
      (inBlock ? '' :
        '<div class="line" style="margin-top:9px">' +
          (tx.coinbase ? '' :
            '<button class="act act-warn act-xs" data-tampertx="' + d.esc(tx.txid) + '">' +
              d.esc(t('nw.m.tamper')) + '</button>') +
          '<button class="act act-line act-xs" data-droptx="' + d.esc(tx.txid) + '">' +
            d.esc(t('nw.m.drop')) + '</button>' +
        '</div>') +
    '</div>';
  }

  function paintPool() {
    var box = d.$('#nwPool', root);
    box.innerHTML = mempool.length
      ? mempool.map(function (tx) { return txHtml(tx, false); }).join('')
      : '<div class="empty-note">' + d.esc(t('nw.m.empty')) + '</div>';
    d.$('#nwPoolCount', root).textContent = t('nw.m.count', { n: mempool.length });

    // Số dư của bên gửi — lấy từ chuỗi chính thống, tính lại chứ không lưu sẵn
    var from = d.$('#nwFrom', root).value;
    d.$('#nwFromBal', root).textContent =
      t('nw.m.bal', { n: num(balanceOf(from)), c: COIN });
  }

  /* ------------------------------------------------------------ cây Merkle */
  function paintMerkle() {
    var src = merkleSource();
    var tree = merkleTree();
    var box = d.$('#nwMerkle', root);

    if (!src.txs.length) {
      box.innerHTML = '<div class="empty-note">' + d.esc(t('nw.mk.empty')) + '</div>';
      d.$('#nwMerkleTag', root).textContent = t('nw.mk.preview');
      return;
    }
    d.$('#nwMerkleTag', root).textContent =
      t(src.live ? 'nw.mk.live' : 'nw.mk.preview');

    var rows = [];
    // Vẽ từ GỐC xuống LÁ để nhìn ra hình cây
    for (var level = tree.levels.length - 1; level >= 0; level--) {
      var isRoot = level === tree.levels.length - 1;
      var isLeaf = level === 0;
      var cells = tree.levels[level].map(function (h, i) {
        var cls = isRoot ? 'mk-cell mk-root' : (isLeaf ? 'mk-cell mk-leaf' : 'mk-cell');
        var tag = isRoot ? t('nw.mk.root')
          : (isLeaf ? t('nw.mk.leaf', { i: i }) : t('nw.mk.node', { l: level, i: i }));
        return '<div class="' + cls + '" title="' + d.esc(h) + '">' +
            '<small>' + d.esc(tag) + '</small>' +
            '<span class="mono">' + d.esc(d.shortHash(h, isRoot ? 12 : 6)) + '</span>' +
          '</div>';
      }).join('');

      rows.push('<div class="mk-lv">' +
        '<span class="mk-tag mono">' + d.esc(isLeaf ? t('nw.mk.leaves')
            : t('nw.mk.level', { l: level })) + '</span>' +
        '<div class="mk-row">' + cells + '</div>' +
      '</div>');
      if (level > 0) rows.push('<div class="mk-up">▲ ' +
        d.esc(t('nw.mk.pair')) + '</div>');
    }

    var dup = tree.duplicated.some(function (x) { return x; });

    box.innerHTML = rows.join('') +
      '<div class="calc" style="margin-top:12px">merkle_root = ' +
        d.esc(tree.root) + '</div>' +
      '<p class="mk-note">' + t('nw.mk.note', { n: tree.size, d: tree.depth }) +
        (dup ? ' ' + t('nw.mk.dup') : '') + '</p>';
  }

  /* ------------------------------------------------------- khối ứng viên */
  function paintBlock() {
    var box = d.$('#nwBlock', root);
    var head = canonical();

    if (!candidate) {
      box.innerHTML = '<div class="empty-note">' + d.esc(t('nw.b.none')) + '</div>';
      setBtn('mine', true);
      setBtn('cast', true);
      setBtn('forge', true);
      setBtn('drop', true);
      return;
    }

    var mined = candidate.meetsDifficulty(net.difficulty);
    var recomputed = candidate.computeHash();
    var hashOk = recomputed === candidate.hash;
    var rootOk = DLU.merkle.root(candidate.txs.map(function (x) { return x.txid; }))
                 === candidate.merkleRoot;

    setBtn('mine', mining || mined);
    setBtn('cast', mining);
    setBtn('forge', mining);
    setBtn('drop', mining);

    box.innerHTML =
      '<dl class="spec hdr">' +
        '<dt>' + d.esc(t('nw.b.height')) + '</dt>' +
          '<dd class="mono">#' + num(head.chain.length) + '</dd>' +
        '<dt>' + d.esc(t('nw.b.miner')) + '</dt>' +
          '<dd>' + d.esc(nodeName(peerById(candidateMiner))) + '</dd>' +
        '<dt>previous_hash</dt>' +
          '<dd class="digest">' + d.esc(candidate.previousHash) + '</dd>' +
        '<dt>merkle_root</dt>' +
          '<dd class="digest' + (rootOk ? '' : ' digest-no') + '">' +
            d.esc(candidate.merkleRoot) +
            (rootOk ? '' : '<br><span class="no-txt">' + d.esc(t('nw.b.rootBad')) + '</span>') +
          '</dd>' +
        '<dt>timestamp</dt>' +
          '<dd class="mono">' + d.esc(d.fmtTime(candidate.timestamp)) + '</dd>' +
        '<dt>nonce</dt>' +
          '<dd class="mono">' + num(candidate.nonce) +
            ' <span class="tag ' + (mined ? 'tag-ok' : 'tag-warn') + '">' +
            d.esc(t(mined ? 'nw.b.mined' : 'nw.b.needMine', { k: net.difficulty })) +
            '</span></dd>' +
        '<dt>' + d.esc(t('nw.b.txcount')) + '</dt>' +
          '<dd class="mono">' + num(candidate.txs.length) + '</dd>' +
        '<dt>block_hash</dt>' +
          '<dd class="digest' + (hashOk ? '' : ' digest-no') + '">' +
            d.highlightZeros(candidate.hash, mined ? net.difficulty : 0) + '</dd>' +
      '</dl>' +

      '<div class="calc" style="margin-top:12px">' +
        '<b>' + d.esc(t('nw.b.preimage')) + '</b><br>' +
        'SHA256( <em>previous_hash</em> + <i>timestamp</i> + <em>merkle_root</em> + <i>nonce</i> )<br>' +
        '= ' + d.esc(candidate.headerString().slice(0, 120)) + '…' +
      '</div>' +

      '<div class="slab-sub">' + d.esc(t('nw.b.inside')) + '</div>' +
      '<div class="txs">' +
        candidate.txs.map(function (tx) { return txHtml(tx, true); }).join('') +
      '</div>';
  }

  function setBtn(name, disabled) {
    var btn = d.$('[data-act="' + name + '"]', root);
    if (btn) btn.disabled = !!disabled;
  }

  /* ---------------------------------------------------------- đồng thuận */
  function voteHtml(vote) {
    var v = vote.verdict;
    var blockChips = v.checks.map(function (c) {
      return chip(c.ok, t('nw.v.check.' + c.key));
    }).join('');

    // Chỉ liệt kê chi tiết những phiếu giao dịch bị đánh trượt
    var badTx = v.txReports.filter(function (r) { return !r.report.ok; });
    var reasons = badTx.map(function (r) {
      var failed = r.report.checks.filter(function (c) { return !c.ok; })
        .map(function (c) { return t('nw.v.tx.' + c.key); }).join(', ');
      return '<div class="vote-why">' +
        '<span class="mono">' + d.esc(d.shortHash(r.tx.txid, 6)) + '</span> — ' +
        d.esc(failed) + '</div>';
    }).join('');

    var wrong = v.checks.filter(function (c) { return !c.ok && c.got; });
    var detail = wrong.map(function (c) {
      return '<div class="vote-why">' + d.esc(t('nw.v.check.' + c.key)) + ' · ' +
        d.esc(t('nw.v.got')) + ' <span class="mono">' +
        d.esc(d.shortHash(String(c.got), 8)) + '</span></div>';
    }).join('');

    return '<div class="vote' + (v.ok ? ' yes' : ' no') + '">' +
      '<div class="vote-top">' +
        '<span class="peer-av sm">' + vote.peer.emoji + '</span>' +
        '<b>' + d.esc(t(vote.peer.nameKey)) + '</b>' +
        '<span class="push"></span>' +
        '<span class="tag ' + (v.ok ? 'tag-ok' : 'tag-no') + '">' +
          d.esc(t(v.ok ? 'nw.v.yes' : 'nw.v.no')) + '</span>' +
      '</div>' +
      '<div class="chips">' + blockChips + '</div>' +
      detail + reasons +
    '</div>';
  }

  function paintVotes() {
    var box = d.$('#nwVotes', root);
    if (!lastRound) {
      box.innerHTML = '<div class="empty-note">' + d.esc(t('nw.v.none')) + '</div>';
      return;
    }
    var pct = Math.round(lastRound.yes / lastRound.total * 100);
    box.innerHTML =
      '<div class="quorum">' +
        '<div class="quorum-bar"><i style="width:' + pct + '%" class="' +
          (lastRound.finalized ? 'good' : 'bad') + '"></i>' +
          '<u style="left:' + Math.round(lastRound.quorum / lastRound.total * 100) + '%"></u>' +
        '</div>' +
        '<div class="quorum-txt">' +
          '<b class="' + (lastRound.finalized ? 'ok-txt' : 'no-txt') + '">' +
            d.esc(t(lastRound.finalized ? 'nw.v.finalized' : 'nw.v.rejected')) + '</b> · ' +
          d.esc(t('nw.v.quorum', {
            y: lastRound.yes, t: lastRound.total, q: lastRound.quorum
          })) +
        '</div>' +
      '</div>' +
      '<div class="votes">' + lastRound.votes.map(voteHtml).join('') + '</div>';
  }

  /* ------------------------------------------------------------ tra cứu */
  function paintChain() {
    var head = canonical();
    var blocks = head.chain.toArray();
    var report = head.chain.validateDetailed();

    d.$('#nwChain', root).innerHTML = blocks.map(function (b, i) {
      var entry = report[i];
      var open = !!opened[i];
      var miner = b.miner ? d.esc(b.miner) : d.esc(t('nw.e.genesis'));
      return '<div class="exp' + (entry.valid ? '' : ' bad') + '">' +
        '<div class="exp-top" data-open="' + i + '">' +
          '<span class="exp-no mono">#' + i + '</span>' +
          '<div class="exp-main">' +
            '<span class="digest">' + d.highlightZeros(b.hash, b.difficulty) + '</span>' +
            '<div class="exp-sub mono">' +
              d.esc(t('nw.e.prev')) + ' ' + d.esc(d.shortHash(b.previousHash, 8)) +
              ' · ' + d.esc(t('nw.e.root')) + ' ' + d.esc(d.shortHash(b.merkleRoot, 8)) +
              ' · ' + d.esc(t('nw.e.txs', { n: b.txs.length })) +
              ' · ' + d.esc(t('nw.e.miner')) + ' ' + miner +
            '</div>' +
          '</div>' +
          '<span class="tag ' + (entry.valid ? 'tag-ok' : 'tag-no') + '">' +
            d.esc(t(entry.valid ? 'nw.e.ok' : 'nw.e.bad')) + '</span>' +
          '<span class="exp-caret">' + (open ? '▾' : '▸') + '</span>' +
        '</div>' +
        (open ? '<div class="exp-body">' +
            '<dl class="spec">' +
              '<dt>timestamp</dt><dd class="mono">' + d.esc(d.fmtTime(b.timestamp)) + '</dd>' +
              '<dt>nonce</dt><dd class="mono">' + num(b.nonce) +
                ' (' + d.esc(t('nw.b.diff', { k: b.difficulty })) + ')</dd>' +
              '<dt>merkle_root</dt><dd class="digest">' + d.esc(b.merkleRoot) + '</dd>' +
              '<dt>previous_hash</dt><dd class="digest">' + d.esc(b.previousHash) + '</dd>' +
            '</dl>' +
            '<div class="txs" style="margin-top:12px">' +
              b.txs.map(function (tx) { return txHtml(tx, true); }).join('') +
            '</div>' +
          '</div>' : '') +
      '</div>' +
      (i < blocks.length - 1
        ? '<div class="exp-tie' + (report[i + 1].linkOk ? '' : ' cut') + '"></div>' : '');
    }).join('');
  }

  /* -------------------------------------------------------------- nhật ký */
  function paintFeed() {
    var box = d.$('#nwFeed', root);
    box.innerHTML = feed.length
      ? feed.map(function (row) {
          return '<div class="feed-row ' + row.kind + '">' +
            '<span class="mono feed-at">' +
              d.esc(row.at.toLocaleTimeString(DLU.i18n.locale())) + '</span>' +
            '<span>' + t(row.key, row.params) + '</span>' +
          '</div>';
        }).join('')
      : '<div class="empty-note">' + d.esc(t('nw.g.empty')) + '</div>';
  }

  function paint() {
    if (!root) return;
    paintStats();
    paintFlow();
    paintPeers();
    paintPool();
    paintMerkle();
    paintBlock();
    paintVotes();
    paintChain();
    paintFeed();
  }

  /* =======================================================================
   *  8. DỰNG TRANG
   * ===================================================================== */

  function nodeOptions(selected) {
    return NODE_SPECS.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' +
        d.esc(s.emoji + ' ' + t(s.nameKey)) + '</option>';
    }).join('');
  }

  function render(container) {
    root = container;
    bootNetwork(2);

    root.innerHTML =
      '<div class="page bound zone" style="padding-top:36px">' +

      '<div class="zone-head">' +
        '<span class="kicker">' + d.esc(t('nw.kicker')) + '</span>' +
        '<h2>' + d.esc(t('nw.h')) + ' <span class="hl">' + d.esc(t('nw.h2')) + '</span></h2>' +
        '<p>' + t('nw.p') + '</p>' +
      '</div>' +

      /* ---- dải chỉ số mạng ---- */
      '<div class="stats" id="nwStats"></div>' +

      /* ---- dải quy trình ---- */
      '<ol class="flow" id="nwFlow"></ol>' +

      /* ---- nút mạng + hàng chờ ---- */
      '<div class="rows rows-2" style="margin-bottom:16px;align-items:start">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nw.n.title')) + '</h3>' +
            '<span class="push"></span>' +
            '<button class="act act-line act-xs" data-act="resync">' +
              d.esc(t('nw.v.sync')) + '</button>' +
            '<button class="act act-line act-xs" data-act="reset">' +
              d.esc(t('nw.reset')) + '</button>' +
          '</div>' +
          '<div class="peers" id="nwNodes"></div>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nw.m.title')) + '</h3>' +
            '<span class="push"></span>' +
            '<span class="tag tag-a mono" id="nwPoolCount"></span>' +
          '</div>' +

          '<div class="rows" style="grid-template-columns:1fr 1fr;gap:10px">' +
            '<div class="fld">' +
              '<label for="nwFrom">' + d.esc(t('nw.m.from')) +
                '<span class="mono push" id="nwFromBal"></span></label>' +
              '<select id="nwFrom">' + nodeOptions('N1') + '</select>' +
            '</div>' +
            '<div class="fld">' +
              '<label for="nwTo">' + d.esc(t('nw.m.to')) + '</label>' +
              '<select id="nwTo">' + nodeOptions('N2') + '</select>' +
            '</div>' +
            '<div class="fld">' +
              '<label for="nwAmt">' + d.esc(t('nw.m.amount')) + '</label>' +
              '<input id="nwAmt" type="number" min="0.0001" step="0.5" value="7.5">' +
            '</div>' +
            '<div class="fld">' +
              '<label for="nwMemo">' + d.esc(t('nw.m.memo')) + '</label>' +
              '<input id="nwMemo" type="text" placeholder="' +
                d.esc(t('nw.m.memoPh')) + '" autocomplete="off">' +
            '</div>' +
          '</div>' +

          '<div class="line" style="margin-top:12px">' +
            '<button class="act act-key" data-act="sign">' + d.esc(t('nw.m.sign')) + '</button>' +
            '<button class="act act-alt" data-act="assemble">' +
              d.esc(t('nw.b.assemble')) + '</button>' +
          '</div>' +
          '<div id="nwFlash" class="tip hidden" style="margin-top:12px"></div>' +

          '<div class="fld" style="margin-top:14px">' +
            '<label for="nwProposer">' + d.esc(t('nw.b.proposer')) + '</label>' +
            '<select id="nwProposer">' +
              '<option value="auto">' + d.esc(t('nw.b.auto')) + '</option>' +
              nodeOptions('') +
            '</select>' +
          '</div>' +

          '<div class="slab-sub" style="margin-top:16px">' + d.esc(t('nw.m.queue')) + '</div>' +
          '<div class="txs" id="nwPool"></div>' +
        '</div>' +
      '</div>' +

      /* ---- cây Merkle + khối ứng viên ---- */
      '<div class="rows rows-2" style="margin-bottom:16px;align-items:start">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nw.mk.title')) + '</h3>' +
            '<span class="push"></span>' +
            '<span class="tag tag-b mono" id="nwMerkleTag"></span>' +
          '</div>' +
          '<div class="mk" id="nwMerkle"></div>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('nw.b.title')) + '</h3></div>' +

          '<div class="fld" style="margin-bottom:12px">' +
            '<label for="nwDiff">' + d.esc(t('nw.b.diffLabel')) + '</label>' +
            '<input id="nwDiff" type="range" min="1" max="4" step="1" value="2">' +
            '<span class="mono" id="nwDiffVal" style="font-size:12.5px;color:var(--txt-2)"></span>' +
          '</div>' +

          '<div class="line" style="margin-bottom:12px">' +
            '<button class="act act-key"  data-act="mine">'  + d.esc(t('nw.b.mine'))  + '</button>' +
            '<button class="act act-alt"  data-act="cast">'  + d.esc(t('nw.b.cast'))  + '</button>' +
            '<button class="act act-warn" data-act="forge">' + d.esc(t('nw.b.forge')) + '</button>' +
            '<button class="act act-line" data-act="drop">'  + d.esc(t('nw.b.drop'))  + '</button>' +
          '</div>' +
          '<div id="nwWork" class="tip hidden" style="margin-bottom:12px"></div>' +

          '<div id="nwBlock"></div>' +
        '</div>' +
      '</div>' +

      /* ---- đồng thuận ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nw.v.title')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag tag-a">' + d.esc(t('nw.v.rule')) + '</span>' +
        '</div>' +
        '<div id="nwVotes"></div>' +
      '</div>' +

      /* ---- tra cứu chuỗi ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nw.e.title')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag tag-b">' + d.esc(t('nw.e.rule')) + '</span>' +
        '</div>' +
        '<div class="exps" id="nwChain"></div>' +
      '</div>' +

      /* ---- nhật ký mạng ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nw.g.title')) + '</h3></div>' +
        '<div class="feed" id="nwFeed"></div>' +
      '</div>' +

      /* ---- ghi chú lý thuyết ---- */
      '<div class="slab">' +
        '<div class="slab-bar"><h3>' + d.esc(t('nw.note.title')) + '</h3></div>' +
        '<div class="rows rows-3">' +
          [1, 2, 3].map(function (i) {
            return '<div>' +
              '<b style="color:var(--blue-2);font-size:15px">' + d.esc(t('nw.note.' + i + 'h')) + '</b>' +
              '<p style="font-size:13.5px;color:var(--txt-2);margin-top:6px">' +
                t('nw.note.' + i + 'p') + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="tip" style="margin-top:16px">' + t('nw.note.foot') + '</div>' +
      '</div>' +

      '</div>';

    var acts = {
      sign: signAndBroadcastTx,
      assemble: assemble,
      mine: mine,
      cast: broadcast,
      forge: forgeRoot,
      drop: function () { discardCandidate(false); paint(); },
      resync: resync,
      reset: resetNetwork
    };

    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = acts[btn.getAttribute('data-act')];
      if (fn) fn();
    });
    d.on(root, 'click', '[data-tampertx]', function (ev, btn) {
      tamperTx(btn.getAttribute('data-tampertx'));
    });
    d.on(root, 'click', '[data-droptx]', function (ev, btn) {
      dropTx(btn.getAttribute('data-droptx'));
    });
    d.on(root, 'click', '[data-tamper]', function (ev, btn) {
      tamperNode(btn.getAttribute('data-tamper'));
    });
    d.on(root, 'click', '[data-open]', function (ev, row) {
      var i = row.getAttribute('data-open');
      opened[i] = !opened[i];
      paintChain();
    });

    d.$('#nwFrom', root).addEventListener('change', paintPool);
    d.$('#nwDiff', root).addEventListener('input', function (ev) {
      setDifficulty(ev.target.value);
    });
    d.$('#nwMemo', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') signAndBroadcastTx();
    });

    setDifficulty(2);
    paint();
  }

  function destroy() {
    if (forge) { forge.cancel(); forge = null; }
    mining = false;
    root = null;
  }

  /* Công cụ đối chiếu bằng tay trong Console — chứng minh không có số liệu giả. */
  function debug() {
    var head = canonical();
    return {
      height: head.chain.length,
      valid: head.chain.isValid(),
      blocks: head.chain.toArray().map(function (b, i) {
        return {
          index: i,
          hash: b.hash,
          hashRecomputed: b.computeHash(),
          merkleRoot: b.merkleRoot,
          merkleRecomputed: DLU.merkle.root(b.txs.map(function (x) { return x.txid; })),
          previousHash: b.previousHash,
          txids: b.txs.map(function (x) { return x.txid; })
        };
      }),
      balances: C.stateOf(head.chain).balances,
      mempool: mempool.map(function (tx) {
        return {
          txid: tx.txid,
          txidRecomputed: C.txHash(tx),
          payload: C.txPayload(tx),
          signatureValid: DLU.ecdsa.verify(tx.pub, C.txPayload(tx), tx.sigDer).valid
        };
      })
    };
  }

  DLU.views = DLU.views || {};
  DLU.views.network = { render: render, destroy: destroy, debug: debug };
})(typeof window !== 'undefined' ? window : globalThis);
