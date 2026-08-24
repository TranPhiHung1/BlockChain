/* =============================================================================
 *  consensus.js — Giao thức đồng thuận (Consensus Protocol)
 * -----------------------------------------------------------------------------
 *  Danh sách liên kết cho ta CẤU TRÚC, hàm băm cho ta TÍNH BẤT BIẾN. Nhưng một
 *  mạng phi tập trung còn thiếu một thứ: làm sao hàng nghìn nút không tin nhau
 *  cùng thống nhất được ĐÂU LÀ CHUỖI THẬT? Đó là việc của giao thức đồng thuận.
 *
 *  Tệp này cài đặt:
 *    1. Proof of Work  — đào khối bất đồng bộ (không treo giao diện)
 *    2. Proof of Stake — chọn người xác thực theo trọng số cổ phần
 *    3. Mạng P2P mô phỏng — phát sóng khối, quy tắc "chuỗi hợp lệ dài nhất"
 *    4. Công thức xác suất tấn công 51% theo Satoshi Nakamoto (Bitcoin, 2008)
 *
 *  Xuất ra: window.DLU.consensus
 * ========================================================================== */
(function (global) {
  'use strict';

  var DLU = (global.DLU = global.DLU || {});
  var Blockchain = DLU.Blockchain;
  var Block = DLU.Block;

  /* =======================================================================
   *  1. PROOF OF WORK — đào khối theo lô để không chặn luồng giao diện
   * ===================================================================== */

  /**
   * Nhường luồng cho trình duyệt rồi gọi lại `fn` ở "vòng lặp sự kiện" kế tiếp.
   *
   * Không dùng setTimeout vì trình duyệt bó thời gian tối thiểu của nó (≈4 ms,
   * và tới ≈1000 ms khi thẻ ở chế độ nền) — điều đó làm tốc độ đào tụt hàng
   * chục lần. Thông điệp của MessageChannel không bị bó như vậy.
   */
  var yieldSoon = (function () {
    if (typeof MessageChannel === 'undefined') {
      return function (fn) { setTimeout(fn, 0); };
    }
    var channel = new MessageChannel();
    var queue = [];
    channel.port1.onmessage = function () {
      var fn = queue.shift();
      if (fn) fn();
    };
    return function (fn) {
      queue.push(fn);
      channel.port2.postMessage(0);
    };
  })();

  /**
   * Đào một khối bất đồng bộ.
   * Thay vì lặp vô hạn (làm treo trình duyệt), ta thử một LÔ nonce rồi trả
   * quyền điều khiển lại cho trình duyệt vẽ khung hình, sau đó thử lô tiếp theo.
   *
   * @param {Block} block khối cần đào
   * @param {number} difficulty số chữ số 0 dẫn đầu yêu cầu
   * @param {object} cb { onProgress(state), onDone(state) }
   * @param {number} [sliceMs] số mili-giây làm việc liên tục trước khi nhường luồng
   * @returns {{cancel: function}} tay cầm để huỷ giữa chừng
   */
  function mineAsync(block, difficulty, cb, sliceMs) {
    cb = cb || {};
    // Mỗi lát làm việc liên tục ~28 ms rồi mới nhường luồng. Chia theo THỜI GIAN
    // (không theo số lần thử cố định) nên máy nhanh hay chậm đều giữ được giao
    // diện mượt, đồng thời ít phụ thuộc vào việc trình duyệt bó chặt setTimeout.
    var SLICE_MS = sliceMs || 28;
    var CHECK_EVERY = 512;   // số lần thử giữa hai lần xem đồng hồ
    var target = new Array(difficulty + 1).join('0');
    var cancelled = false;
    var attempts = 0;
    var startedAt = performance.now();

    block.difficulty = difficulty;   // khối tự ghi nhớ độ khó của mình
    block.nonce = 0;
    block.hash = block.computeHash();

    function state(found) {
      var elapsed = (performance.now() - startedAt) / 1000;
      return {
        nonce: block.nonce,
        hash: block.hash,
        attempts: attempts,
        seconds: elapsed,
        hashrate: elapsed > 0 ? Math.round(attempts / elapsed) : 0,
        found: !!found
      };
    }

    function step() {
      if (cancelled) return;
      var deadline = performance.now() + SLICE_MS;

      do {
        for (var i = 0; i < CHECK_EVERY; i++) {
          if (block.hash.slice(0, difficulty) === target) {
            if (cb.onDone) cb.onDone(state(true));
            return;
          }
          block.nonce++;
          block.hash = block.computeHash();
          attempts++;
        }
      } while (performance.now() < deadline);

      if (cb.onProgress) cb.onProgress(state(false));
      yieldSoon(step);   // nhường luồng để trình duyệt vẽ lại giao diện
    }

    yieldSoon(step);
    return { cancel: function () { cancelled = true; } };
  }

  /** Số phép thử kỳ vọng để tìm được 1 khối ở độ khó d: 16^d */
  function expectedAttempts(difficulty) {
    return Math.pow(16, difficulty);
  }

  /* =======================================================================
   *  2. NÚT MẠNG & MẠNG P2P MÔ PHỎNG
   * ===================================================================== */

  /**
   * Một nút (peer) trong mạng, giữ BẢN SAO RIÊNG của chuỗi khối.
   *
   * Lưu ý về song ngữ: lớp lõi này không chứa câu chữ hiển thị. Tên nút và
   * hành động gần nhất được lưu dưới dạng KHOÁ từ điển ({key, params}) để tầng
   * giao diện dịch lúc vẽ — nhờ vậy đổi ngôn ngữ là cả nhật ký cũ cũng đổi theo.
   *
   * @param {object} cfg { id, nameKey, hashPower, stake, emoji }
   */
  function Peer(cfg) {
    this.id = cfg.id;
    this.nameKey = cfg.nameKey;
    this.emoji = cfg.emoji || '🖥️';
    this.hashPower = cfg.hashPower || 20; // % sức đào — dùng cho PoW
    this.stake = cfg.stake || 100;        // số coin đặt cọc — dùng cho PoS
    this.address = cfg.address || '';     // địa chỉ ví nhận thưởng khối
    this.honest = true;                   // bị đánh dấu false khi gian lận
    this.chain = null;                    // Blockchain riêng của nút
    this.lastAction = { key: 'cs.peer.init' };
  }

  /** Chuỗi của nút này có toàn vẹn không? */
  Peer.prototype.isValid = function () {
    return this.chain ? this.chain.isValid() : false;
  };

  /** Mã băm của khối cuối — "chữ ký" trạng thái sổ cái của nút. */
  Peer.prototype.tip = function () {
    return this.chain && this.chain.tail ? this.chain.tail.hash : '';
  };

  /* ---------------------------------------------------------------------- */

  /**
   * Mạng ngang hàng mô phỏng.
   * @param {object} cfg { peers: Peer[], difficulty: number }
   */
  function Network(cfg) {
    this.peers = cfg.peers;
    this.difficulty = cfg.difficulty || 0;
    this.log = [];
    this.reset(cfg.genesisData || 'Genesis Block — DLU Blockchain', cfg.genesisTxs);
  }

  /**
   * Khởi tạo lại: mọi nút cùng xuất phát từ một chuỗi Genesis giống hệt nhau.
   * @param {string} genesisData nhãn của khối gốc
   * @param {Array} [genesisTxs] các bút toán phát hành ban đầu (coinbase)
   */
  Network.prototype.reset = function (genesisData, genesisTxs) {
    var genesisChain = new Blockchain({
      autoGenesis: false, difficulty: this.difficulty
    });
    // Genesis dùng timestamp cố định để mọi nút có hash y hệt nhau
    var genesis = new Block(genesisData, Blockchain.ZERO_HASH, 1700000000);
    if (genesisTxs && genesisTxs.length) {
      genesis.txs = genesisTxs.slice();
      genesis.merkleRoot = DLU.merkle.root(genesis.txs.map(function (tx) { return tx.txid; }));
      genesis.hash = genesis.computeHash();
    }
    if (this.difficulty) genesisChain.mine(genesis);
    genesisChain.head = genesisChain.tail = genesis;
    genesisChain.length = 1;

    this.peers.forEach(function (p) {
      p.chain = genesisChain.clone();
      p.honest = true;
      p.lastAction = { key: 'cs.peer.init' };
    });
    this.log = [];
    this.write('cs.log.boot', { n: this.peers.length });
  };

  /**
   * Ghi một dòng nhật ký dưới dạng khoá từ điển + tham số.
   * @param {string} key khoá i18n
   * @param {object} [params] tham số thay vào chuỗi
   * @param {string} [kind] info | ok | warn | bad — quyết định màu viền
   */
  Network.prototype.write = function (key, params, kind) {
    this.log.unshift({
      at: new Date(),
      key: key,
      params: params || {},
      kind: kind || 'info'
    });
    if (this.log.length > 60) this.log.pop();
  };

  /**
   * Chọn nút được quyền tạo khối.
   * @param {'pow'|'pos'} mode
   *   pow → xác suất tỉ lệ thuận với sức đào (hash power)
   *   pos → xác suất tỉ lệ thuận với số coin đặt cọc (stake)
   */
  Network.prototype.selectProposer = function (mode) {
    var key = mode === 'pos' ? 'stake' : 'hashPower';
    var total = this.peers.reduce(function (s, p) { return s + p[key]; }, 0);
    if (total <= 0) return this.peers[0];
    var ticket = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < this.peers.length; i++) {
      acc += this.peers[i][key];
      if (ticket <= acc) return this.peers[i];
    }
    return this.peers[this.peers.length - 1];
  };

  /**
   * Một vòng đồng thuận: nút thắng tạo khối rồi PHÁT SÓNG cho cả mạng.
   * Mỗi nút nhận khối sẽ tự kiểm tra trước khi chấp nhận — "đừng tin, hãy kiểm chứng".
   *
   * @param {string} data nội dung giao dịch
   * @param {'pow'|'pos'} mode
   * @param {function} onDone callback nhận { proposer, block, accepted, rejected }
   */
  Network.prototype.proposeBlock = function (data, mode, onDone) {
    var self = this;
    var proposer = this.selectProposer(mode);
    var prevHash = proposer.tip();
    var block = new Block(data, prevHash);

    function broadcast() {
      var accepted = [], rejected = [];
      self.peers.forEach(function (peer) {
        // Nút chỉ chấp nhận khối nếu nó nối đúng vào đỉnh chuỗi của mình
        // và thoả điều kiện độ khó.
        var linksOk = peer.tip() === block.previousHash;
        var powOk = block.meetsDifficulty(self.difficulty);
        var hashOk = block.hash === block.computeHash();
        if (linksOk && powOk && hashOk) {
          var copy = new Block(block.data, block.previousHash, block.timestamp);
          copy.nonce = block.nonce;
          copy.difficulty = block.difficulty;
          copy.hash = block.hash;
          peer.chain.tail.next = copy;
          peer.chain.tail = copy;
          peer.chain.length++;
          peer.lastAction = { key: 'cs.peer.recv', params: { i: peer.chain.length - 1 } };
          accepted.push(peer);
        } else {
          peer.lastAction = { key: 'cs.peer.reject' };
          rejected.push(peer);
        }
      });

      self.write('cs.log.propose', {
        e: proposer.emoji, nameKey: proposer.nameKey, data: data,
        a: accepted.length, t: self.peers.length
      }, rejected.length ? 'warn' : 'ok');

      if (onDone) onDone({
        proposer: proposer, block: block,
        accepted: accepted, rejected: rejected
      });
    }

    if (mode === 'pow' && this.difficulty > 0) {
      // Phải trả "chi phí năng lượng" trước khi được phát sóng
      mineAsync(block, this.difficulty, { onDone: broadcast });
    } else {
      broadcast();  // PoS: không cần đào, chỉ cần được chọn
    }
  };

  /**
   * Nút `peerId` gian lận: sửa dữ liệu khối thứ `index` trong bản sao của nó.
   */
  Network.prototype.tamper = function (peerId, index, newData) {
    var peer = this.find(peerId);
    if (!peer) return;
    peer.chain.tamper(index, newData);
    peer.honest = false;
    peer.lastAction = { key: 'cs.peer.tampered', params: { i: index } };
    this.write('cs.log.tamper',
      { nameKey: peer.nameKey, i: index, data: newData }, 'bad');
  };

  /**
   * ĐỒNG THUẬN: mỗi nút so sánh với hàng xóm và thay chuỗi của mình bằng
   * CHUỖI HỢP LỆ DÀI NHẤT đang được đa số mạng ủng hộ.
   * @returns {{winnerTip: string, replaced: Peer[]}}
   */
  Network.prototype.resolveConflicts = function () {
    // Bước 1: chỉ xét các chuỗi còn hợp lệ
    var valid = this.peers.filter(function (p) { return p.isValid(); });
    if (!valid.length) {
      this.write('cs.log.noValid', {}, 'bad');
      return { winnerTip: '', replaced: [] };
    }

    // Bước 2: gom theo mã băm đỉnh chuỗi để đếm phiếu
    var votes = {};
    valid.forEach(function (p) {
      var tip = p.tip();
      votes[tip] = votes[tip] || { count: 0, length: p.chain.length, peer: p };
      votes[tip].count++;
    });

    // Bước 3: thắng = chuỗi dài nhất; dài bằng nhau thì nhiều phiếu hơn thắng
    var winner = null;
    Object.keys(votes).forEach(function (tip) {
      var v = votes[tip];
      if (!winner || v.length > winner.length ||
         (v.length === winner.length && v.count > winner.count)) {
        winner = v;
        winner.tip = tip;
      }
    });

    // Bước 4: các nút lệch chuẩn bị ghi đè bằng chuỗi thắng cuộc
    var replaced = [];
    this.peers.forEach(function (p) {
      if (p.tip() !== winner.tip || !p.isValid()) {
        p.chain = winner.peer.chain.clone();
        p.honest = true;
        p.lastAction = { key: 'cs.peer.resync' };
        replaced.push(p);
      }
    });

    this.write('cs.log.resolve', {
      len: winner.length, v: winner.count,
      t: this.peers.length, r: replaced.length
    }, replaced.length ? 'ok' : 'info');

    return { winnerTip: winner.tip, replaced: replaced };
  };

  /** Mạng hiện đã thống nhất chưa (mọi nút cùng đỉnh chuỗi và đều hợp lệ)? */
  Network.prototype.inAgreement = function () {
    var first = this.peers[0].tip();
    return this.peers.every(function (p) {
      return p.tip() === first && p.isValid();
    });
  };

  Network.prototype.find = function (peerId) {
    for (var i = 0; i < this.peers.length; i++) {
      if (this.peers[i].id === peerId) return this.peers[i];
    }
    return null;
  };

  /* =======================================================================
   *  3. XÁC SUẤT TẤN CÔNG 51%
   * ===================================================================== */

  /**
   * Xác suất kẻ tấn công nắm `q` phần sức đào đuổi kịp và lật ngược giao dịch
   * đã được xác nhận `z` khối — công thức Poisson trong mục 11 của bạch thư
   * Bitcoin (Satoshi Nakamoto, 2008).
   *
   * @param {number} q tỉ lệ sức đào của kẻ tấn công (0 → 1)
   * @param {number} z số khối xác nhận
   * @returns {number} xác suất thành công (0 → 1)
   */
  function attackSuccessProbability(q, z) {
    if (q >= 0.5) return 1;      // nắm quá bán ⇒ chắc chắn đuổi kịp
    if (q <= 0) return 0;
    var p = 1 - q;
    var lambda = z * (q / p);
    var sum = 1;
    var poisson = Math.exp(-lambda);
    for (var k = 0; k <= z; k++) {
      if (k > 0) poisson *= lambda / k;      // truy hồi: tránh tính giai thừa lớn
      sum -= poisson * (1 - Math.pow(q / p, z - k));
    }
    return Math.max(0, Math.min(1, sum));
  }

  /* =======================================================================
   *  4. GIAO DỊCH & LUẬT XÁC THỰC CỦA MỖI NÚT
   * -----------------------------------------------------------------------
   *  Tới đây mới đủ mảnh ghép cho một mạng thật sự: khối không còn chứa một
   *  dòng chữ, mà chứa một TẬP GIAO DỊCH có chữ ký. Khi nhận được khối, mỗi nút
   *  KHÔNG tin lời người gửi — nó tự tính lại tất cả:
   *
   *    · txid  = SHA256(nội dung phiếu ‖ chữ ký)      → phiếu có bị sửa không
   *    · chữ ký ECDSA phải khớp với khoá công khai     → ai lập phiếu
   *    · địa chỉ ví phải suy ra được từ khoá công khai → đúng chủ tài khoản
   *    · số dư (tính lại từ chuỗi của CHÍNH NÓ) phải đủ
   *    · gốc Merkle dựng lại từ danh sách txid phải khớp header
   *    · mã băm khối băm lại phải khớp, và phải thoả độ khó
   *    · previous_hash phải trỏ đúng đỉnh chuỗi của nó
   *
   *  Chỉ khi TẤT CẢ đều đúng nút mới bỏ phiếu thuận. Không có phiếu nào được
   *  gán sẵn, mọi kết luận đều là kết quả tính toán trên dữ liệu thật.
   * ===================================================================== */

  /** Địa chỉ "kho phát hành" — nguồn tiền của các bút toán coinbase. */
  var COINBASE = '0x' + new Array(41).join('0');

  /** Làm tròn 4 chữ số thập phân để phép cộng dồn số dư không bị trôi. */
  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /**
   * Địa chỉ ví = 40 ký tự hex cuối của SHA-256(khoá công khai).
   * Giữ đúng quy ước đã dùng ở Trạm giao dịch (view-desk.js).
   */
  function addressOf(publicHex) {
    return '0x' + DLU.sha256(publicHex).slice(-40);
  }

  /** Chuỗi nguyên liệu đem đi ký — dựng lại từ trạng thái hiện tại của phiếu. */
  function txPayload(tx) {
    return 'DLU-TX/1' +
      '|from=' + tx.fromAddr +
      '|to=' + tx.toAddr +
      '|amount=' + Number(tx.amount).toFixed(4) +
      '|nonce=' + tx.nonce +
      '|memo=' + tx.memo;
  }

  /** Mã định danh giao dịch: băm cả nội dung LẪN chữ ký (như txid của Bitcoin). */
  function txHash(tx) {
    return DLU.sha256(txPayload(tx) + '|sig=' + (tx.sigDer || 'coinbase'));
  }

  /**
   * Lập một phiếu chuyển tiền và ký ngay bằng khoá riêng của người gửi.
   * @param {object} f { fromAddr, toAddr, amount, nonce, memo, keys }
   *                   keys = cặp khoá do DLU.ecdsa.generateKeyPair() sinh ra
   */
  function makeTx(f) {
    var tx = {
      fromAddr: f.fromAddr,
      toAddr: f.toAddr,
      amount: round4(f.amount),
      nonce: f.nonce,
      memo: f.memo || '',
      stamp: f.stamp || Date.now() / 1000,
      pub: f.keys ? f.keys.uncompressed : '',
      sigDer: '',
      coinbase: false,
      from: f.from || '', to: f.to || ''      // nhãn hiển thị, không đi vào chữ ký
    };
    if (f.keys) {
      tx.sigDer = DLU.ecdsa.sign(f.keys.privateHex, txPayload(tx)).der;
    }
    tx.txid = txHash(tx);
    return tx;
  }

  /** Bút toán phát hành / tiền thưởng khối — không có người gửi nên không có chữ ký. */
  function makeCoinbase(toAddr, amount, nonce, memo, to) {
    var tx = {
      fromAddr: COINBASE, toAddr: toAddr,
      amount: round4(amount), nonce: nonce, memo: memo || '',
      stamp: Date.now() / 1000,
      pub: '', sigDer: '', coinbase: true,
      from: 'COINBASE', to: to || ''
    };
    tx.txid = txHash(tx);
    return tx;
  }

  /**
   * Sửa trộm số tiền SAU KHI đã ký — chữ ký cũ và txid cũ giữ nguyên.
   * Dùng để chứng minh: nút mạng sẽ tự phát hiện, không cần ai mách.
   */
  function tamperTx(tx, newAmount) {
    tx.amount = round4(newAmount);
    tx.tampered = true;
    return tx;
  }

  /**
   * Trạng thái sổ cái theo bản sao chuỗi của MỘT nút: số dư từng địa chỉ và
   * tập txid đã tiêu. Tính lại từ đầu chuỗi, không lưu sẵn ở đâu cả.
   */
  function stateOf(chain) {
    var balances = {};
    var spent = {};
    chain.toArray().forEach(function (block) {
      (block.txs || []).forEach(function (tx) {
        if (tx.fromAddr !== COINBASE) {
          balances[tx.fromAddr] = round4((balances[tx.fromAddr] || 0) - tx.amount);
        }
        balances[tx.toAddr] = round4((balances[tx.toAddr] || 0) + tx.amount);
        spent[tx.txid] = true;
      });
    });
    return { balances: balances, spent: spent };
  }

  /**
   * Soi một giao dịch theo trạng thái sổ cái đang có.
   * @returns {{ok: boolean, checks: Array<{key, ok, got}>}}
   */
  function reviewTx(tx, state, pendingSpend) {
    var recomputedId = txHash(tx);
    var idOk = recomputedId === tx.txid;

    var sigOk = true, ownerOk = true;
    if (!tx.coinbase) {
      sigOk = DLU.ecdsa.verify(tx.pub, txPayload(tx), tx.sigDer).valid;
      ownerOk = addressOf(tx.pub) === tx.fromAddr;
    }

    var amountOk = isFinite(tx.amount) && tx.amount > 0;

    var available = tx.coinbase ? Infinity
      : round4((state.balances[tx.fromAddr] || 0) - (pendingSpend[tx.fromAddr] || 0));
    var fundsOk = tx.coinbase || available >= tx.amount;

    var freshOk = !state.spent[tx.txid];

    var checks = [
      { key: 'txid',   ok: idOk,      got: recomputedId },
      { key: 'sig',    ok: sigOk },
      { key: 'owner',  ok: ownerOk,   got: tx.coinbase ? '' : addressOf(tx.pub) },
      { key: 'amount', ok: amountOk },
      { key: 'funds',  ok: fundsOk,   got: available === Infinity ? '' : available },
      { key: 'replay', ok: freshOk }
    ];

    return {
      ok: checks.every(function (c) { return c.ok; }),
      checks: checks
    };
  }

  /** Số dư của một địa chỉ theo bản sao chuỗi của nút này. */
  Peer.prototype.balanceOf = function (address) {
    return stateOf(this.chain).balances[address] || 0;
  };

  /** Chiều cao chuỗi mà nút đang giữ. */
  Peer.prototype.height = function () {
    return this.chain ? this.chain.length : 0;
  };

  /**
   * NÚT TỰ THẨM ĐỊNH MỘT KHỐI ĐƯỢC PHÁT SÓNG.
   * Không tham số nào quyết định sẵn kết quả: mọi mục đều được tính lại.
   *
   * @param {Block} block khối nhận từ mạng
   * @param {number} difficulty độ khó mà mạng đang quy ước
   * @returns {{ok, checks: Array, txReports: Array}}
   */
  Peer.prototype.review = function (block, difficulty) {
    var state = stateOf(this.chain);
    var pendingSpend = {};   // tiền đã bị tiêu bởi các phiếu đứng trước trong khối
    var txReports = [];
    var allTxOk = true;

    (block.txs || []).forEach(function (tx) {
      var report = reviewTx(tx, state, pendingSpend);
      if (report.ok && !tx.coinbase) {
        pendingSpend[tx.fromAddr] = round4((pendingSpend[tx.fromAddr] || 0) + tx.amount);
      }
      if (!report.ok) allTxOk = false;
      txReports.push({ tx: tx, report: report });
    });

    var recomputedRoot = DLU.merkle.root((block.txs || []).map(function (tx) {
      return tx.txid;
    }));
    var recomputedHash = block.computeHash();

    var checks = [
      { key: 'link',   ok: this.tip() === block.previousHash, got: this.tip() },
      { key: 'merkle', ok: recomputedRoot === block.merkleRoot, got: recomputedRoot },
      { key: 'hash',   ok: block.hash === recomputedHash, got: recomputedHash },
      { key: 'pow',    ok: block.meetsDifficulty(difficulty) },
      { key: 'txs',    ok: allTxOk }
    ];

    return {
      ok: checks.every(function (c) { return c.ok; }),
      checks: checks,
      txReports: txReports
    };
  };

  /** Bản sao độc lập của một khối — mỗi nút cất một bản riêng trong chuỗi của nó. */
  function cloneBlock(block) {
    var copy = new Block(block.data, block.previousHash, block.timestamp);
    copy.nonce = block.nonce;
    copy.difficulty = block.difficulty;
    copy.merkleRoot = block.merkleRoot;
    copy.txs = (block.txs || []).slice();
    copy.miner = block.miner;
    copy.hash = block.hash;
    return copy;
  }

  /** Nối khối vào đuôi chuỗi của một nút. */
  Network.prototype.attach = function (peer, block) {
    var copy = cloneBlock(block);
    if (peer.chain.tail) {
      peer.chain.tail.next = copy;
      peer.chain.tail = copy;
    } else {
      peer.chain.head = peer.chain.tail = copy;
    }
    peer.chain.length++;
    return copy;
  };

  /**
   * PHÁT SÓNG KHỐI & BỎ PHIẾU.
   *
   * Mỗi nút chạy `review` trên bản sao chuỗi của chính nó rồi bỏ một phiếu.
   * Khối chỉ được ghi vào sổ khi số phiếu thuận đạt quá bán (quorum) — quy tắc
   * đa số của mạng, tính từ số phiếu thật chứ không đặt sẵn.
   *
   * @returns {{votes: Array, yes: number, quorum: number, finalized: boolean}}
   */
  Network.prototype.broadcastBlock = function (block) {
    var self = this;
    var votes = this.peers.map(function (peer) {
      var verdict = peer.review(block, self.difficulty);
      peer.lastAction = { key: verdict.ok ? 'cs.peer.voteYes' : 'cs.peer.voteNo' };
      return { peer: peer, verdict: verdict };
    });

    var yes = votes.filter(function (v) { return v.verdict.ok; });
    var quorum = Math.floor(this.peers.length / 2) + 1;   // quá bán
    var finalized = yes.length >= quorum;

    if (finalized) {
      yes.forEach(function (v) {
        self.attach(v.peer, block);
        v.peer.lastAction = { key: 'cs.peer.recv', params: { i: v.peer.chain.length - 1 } };
      });
    }

    return { votes: votes, yes: yes.length, quorum: quorum, finalized: finalized };
  };

  DLU.consensus = {
    mineAsync: mineAsync,
    expectedAttempts: expectedAttempts,
    Peer: Peer,
    Network: Network,
    attackSuccessProbability: attackSuccessProbability,
    COINBASE: COINBASE,
    addressOf: addressOf,
    txPayload: txPayload,
    txHash: txHash,
    makeTx: makeTx,
    makeCoinbase: makeCoinbase,
    tamperTx: tamperTx,
    stateOf: stateOf,
    reviewTx: reviewTx,
    cloneBlock: cloneBlock,
    round4: round4,
    // Danh sách giao thức để dựng bảng so sánh; mọi câu chữ nằm ở js/i18n.js
    // dưới các khoá 'cs.proto.<key>.<trường>'
    PROTOCOL_KEYS: ['pow', 'pos', 'pbft']
  };
})(typeof window !== 'undefined' ? window : globalThis);
