/* =============================================================================
 *  view-desk.js — Phân hệ 03: TRẠM GIAO DỊCH
 * -----------------------------------------------------------------------------
 *  Gộp toàn bộ vòng đời của một giao dịch trên chuỗi khối vào cùng một trang,
 *  đúng thứ tự mà một nút mạng thật sự làm việc:
 *
 *      ví (cặp khoá secp256k1)
 *          → lập phiếu chuyển tiền
 *          → KÝ bằng khoá riêng (ECDSA + SHA-256)
 *          → đẩy vào hàng chờ
 *          → nút mạng KIỂM chữ ký + số dư
 *          → đóng thành khối, nối vào sổ cái
 *
 *  Toàn bộ phép toán gọi thẳng vào lõi: DLU.ecdsa (Key.py) và DLU.Blockchain
 *  (Block_BlockChain.py). Tầng này chỉ lo trình bày, không tự tính mật mã.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var E = DLU.ecdsa;
  var t = function () { return DLU.t.apply(null, arguments); };
  var num = function (v) { return DLU.i18n.num(v); };

  var COIN = 'DLU';
  var OPENING = 100;      // số dư cấp phát cho mỗi ví trong khối gốc

  var root = null;
  var wallets = [];       // [{id, keys, address, reveal, pem}]
  var pool = [];          // giao dịch đang chờ xác nhận
  var confirmed = [];     // giao dịch đã nằm trong khối
  var chain = null;       // sổ cái — dùng lõi DLU.Blockchain
  var blockTx = {};       // { chỉ số khối: [giao dịch] }
  var counter = 0;        // bộ đếm số thứ tự giao dịch (nonce)
  var lastSigned = null;  // giao dịch vừa ký — dùng cho phòng kiểm chứng

  /* =======================================================================
   *  1. VÍ
   * ===================================================================== */

  /**
   * Địa chỉ ví = 40 ký tự hex cuối của SHA-256(khoá công khai).
   * Bitcoin dùng RIPEMD-160(SHA-256(pub)), Ethereum dùng Keccak-256; ở đây rút
   * gọn còn một lần SHA-256 vì đó là hàm băm duy nhất đồ án tự cài đặt.
   */
  function addressOf(keys) {
    return '0x' + DLU.sha256(keys.uncompressed).slice(-40);
  }

  function byId(id) {
    for (var i = 0; i < wallets.length; i++) if (wallets[i].id === id) return wallets[i];
    return null;
  }

  function mint() {
    wallets = ['A', 'B', 'C'].map(function (id) {
      var keys = E.generateKeyPair();
      return { id: id, keys: keys, address: addressOf(keys), reveal: false, pem: false };
    });
  }

  function balanceOf(id) {
    var total = OPENING;
    confirmed.forEach(function (tx) {
      if (tx.from === id) total -= tx.amount;
      if (tx.to === id) total += tx.amount;
    });
    return total;
  }

  function walletHtml(w) {
    var secret = w.reveal
      ? d.esc(w.keys.privateHex)
      : '<span class="veil">' + d.esc(t('wl.w.masked')) + '</span>';

    var pemBlock = w.pem
      ? '<div class="fld" style="margin-top:10px">' +
          '<label>' + d.esc(t('wl.w.pemPriv')) + '</label>' +
          '<div class="pem">' + d.esc(E.privateKeyPem(w.keys)) + '</div>' +
        '</div>' +
        '<div class="fld" style="margin-top:10px">' +
          '<label>' + d.esc(t('wl.w.pemPub')) + '</label>' +
          '<div class="pem">' + d.esc(E.publicKeyPem(w.keys)) + '</div>' +
        '</div>'
      : '';

    return '<div class="wal' + (w.id === 'B' ? ' beta' : '') + '">' +
      '<div class="wal-top">' +
        '<span class="wal-av">' + d.esc(w.id) + '</span>' +
        '<div>' +
          '<b>' + d.esc(t('wl.w.name', { id: w.id })) + '</b>' +
          '<div class="wal-bal">' + num(balanceOf(w.id)) + '<span>' + COIN + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="fld" style="margin-bottom:9px">' +
        '<label>' + d.esc(t('wl.w.addr')) +
          '<button class="act act-line act-xs push" data-copy="' + d.esc(w.address) + '">' +
            d.esc(t('wl.copy')) + '</button></label>' +
        '<div class="vault">' + d.esc(w.address) + '</div>' +
      '</div>' +

      '<div class="fld" style="margin-bottom:9px">' +
        '<label>' + d.esc(t('wl.w.pub')) + '</label>' +
        '<div class="vault vault-open">' + d.esc(d.shortHash(w.keys.uncompressed, 22)) + '</div>' +
      '</div>' +

      '<div class="fld">' +
        '<label>' + d.esc(t('wl.w.priv')) +
          '<button class="act act-line act-xs push" data-peek="' + w.id + '">' +
            d.esc(w.reveal ? t('wl.w.hide') : t('wl.w.show')) + '</button></label>' +
        '<div class="vault vault-secret">' + secret + '</div>' +
      '</div>' +

      '<div class="line" style="margin-top:11px">' +
        '<button class="act act-line act-xs" data-pem="' + w.id + '">' +
          d.esc(w.pem ? t('wl.w.pemOff') : t('wl.w.pemOn')) + '</button>' +
      '</div>' +
      pemBlock +
    '</div>';
  }

  function paintWallets() {
    var box = d.$('#wlVault', root);
    if (box) box.innerHTML = wallets.map(walletHtml).join('');
    refreshFormHints();
  }

  /* =======================================================================
   *  2. GIAO DỊCH & CHỮ KÝ
   * ===================================================================== */

  /**
   * Chuỗi nguyên liệu đem đi ký — được dựng lại từ TRẠNG THÁI HIỆN TẠI của
   * phiếu. Nhờ vậy chỉ cần sửa một con số sau khi ký là chữ ký gãy ngay, đúng
   * như khi một nút mạng phát hiện phiếu bị can thiệp trên đường truyền.
   */
  function payload(tx) {
    return 'DLU-TX/1' +
      '|from=' + tx.fromAddr +
      '|to=' + tx.toAddr +
      '|amount=' + tx.amount.toFixed(4) +
      '|nonce=' + tx.nonce +
      '|memo=' + tx.memo;
  }

  function check(tx) {
    return E.verify(tx.pub, payload(tx), tx.sig.der);
  }

  function draft() {
    var from = d.$('#wlFrom', root).value;
    var to = d.$('#wlTo', root).value;
    var amount = parseFloat(d.$('#wlAmt', root).value);
    var memo = d.$('#wlMemo', root).value.trim();

    if (from === to) return { error: 'wl.err.same' };
    if (!isFinite(amount) || amount <= 0) return { error: 'wl.err.amount' };

    var sender = byId(from);
    var taker = byId(to);
    return {
      tx: {
        id: ++counter,
        from: from, to: to,
        fromAddr: sender.address, toAddr: taker.address,
        amount: Math.round(amount * 10000) / 10000,
        memo: memo || t('wl.memoDefault'),
        nonce: counter,
        stamp: Date.now() / 1000,
        pub: sender.keys.uncompressed,
        sig: null,
        touched: false,
        refused: ''
      }
    };
  }

  function signTx() {
    var made = draft();
    if (made.error) { flash(t(made.error), 'no'); return; }

    var tx = made.tx;
    var sender = byId(tx.from);
    var t0 = performance.now();
    tx.sig = E.sign(sender.keys.privateHex, payload(tx));   // ECDSA + SHA-256
    var ms = Math.round(performance.now() - t0);

    pool.push(tx);
    lastSigned = tx;
    d.$('#wlMemo', root).value = '';
    flash(t('wl.ok.signed', { i: tx.nonce, n: ms }), 'ok');
    paintPool();
    paintProbe();
    refreshFormHints();
  }

  /** Sửa trộm số tiền SAU KHI đã ký — chữ ký cũ lập tức mất hiệu lực. */
  function tamper(tx) {
    tx.amount = Math.round((tx.amount + 5) * 10000) / 10000;
    tx.touched = true;
    tx.refused = '';
    flash(t('wl.ok.tampered', { i: tx.nonce, c: COIN }), 'no');
    paintPool();
    paintProbe();
  }

  function discard(tx) {
    pool = pool.filter(function (p) { return p !== tx; });
    if (lastSigned === tx) lastSigned = pool.length ? pool[pool.length - 1] : null;
    paintPool();
    paintProbe();
  }

  function flash(text, kind) {
    var box = d.$('#wlFlash', root);
    if (!box) return;
    box.className = 'tip';
    box.style.borderLeftColor = kind === 'no' ? 'var(--no)'
                              : (kind === 'ok' ? 'var(--ok)' : 'var(--blue)');
    box.innerHTML = d.esc(text);
    box.classList.remove('hidden');
  }

  /* ---------------------------------------------------------- hàng chờ */
  function dealHtml(tx, place) {
    var verdict = check(tx);
    var cls = place === 'block' ? 'done' : (verdict.valid ? 'signed' : 'void');
    var flag = verdict.valid
      ? '<span class="tag tag-ok">' + d.esc(t('wl.d.sigOk')) + '</span>'
      : '<span class="tag tag-no">' + d.esc(t('wl.d.sigNo')) + '</span>';

    var buttons = place === 'block' ? '' :
      '<div class="deal-acts">' +
        '<button class="act act-warn act-xs" data-tamper="' + tx.id + '">' +
          d.esc(t('wl.d.tamper')) + '</button>' +
        '<button class="act act-line act-xs" data-drop="' + tx.id + '">' +
          d.esc(t('wl.d.drop')) + '</button>' +
      '</div>';

    var refused = tx.refused
      ? '<div class="tip" style="margin-top:9px;border-left-color:var(--no);font-size:12.5px">' +
        d.esc(t(tx.refused)) + '</div>' : '';

    return '<div class="deal ' + cls + '">' +
      '<div class="deal-top">' +
        '<span class="tag tag-a">#' + tx.nonce + '</span>' + flag +
        (tx.touched ? '<span class="tag tag-warn">' + d.esc(t('wl.d.touched')) + '</span>' : '') +
      '</div>' +
      '<div class="deal-flow">' +
        '<b>' + d.esc(t('wl.w.name', { id: tx.from })) + '</b> →' +
        ' <b>' + d.esc(t('wl.w.name', { id: tx.to })) + '</b>' +
        '<span class="amt">' + num(tx.amount) + ' ' + COIN + '</span>' +
      '</div>' +
      '<dl class="deal-grid">' +
        '<dt>' + d.esc(t('wl.d.memo')) + '</dt><dd>' + d.esc(tx.memo) + '</dd>' +
        '<dt>' + d.esc(t('wl.d.payload')) + '</dt>' +
          '<dd class="digest" style="font-size:12px">' + d.esc(payload(tx)) + '</dd>' +
        '<dt>' + d.esc(t('wl.d.digest')) + '</dt>' +
          '<dd class="digest">' + d.esc(d.shortHash(tx.sig.z, 16)) + '</dd>' +
        '<dt>r</dt><dd class="digest">' + d.esc(d.shortHash(tx.sig.r, 14)) + '</dd>' +
        '<dt>s</dt><dd class="digest">' + d.esc(d.shortHash(tx.sig.s, 14)) + '</dd>' +
        '<dt>' + d.esc(t('wl.d.der')) + '</dt>' +
          '<dd class="digest digest-ok">' + d.esc(d.shortHash(tx.sig.der, 20)) +
          ' <span class="tag">' + d.esc(t('wl.d.bytes', { n: tx.sig.bytes })) + '</span></dd>' +
      '</dl>' +
      refused + buttons +
    '</div>';
  }

  function paintPool() {
    var box = d.$('#wlPool', root);
    if (!box) return;
    box.innerHTML = pool.length
      ? pool.map(function (tx) { return dealHtml(tx, 'pool'); }).join('')
      : '<div class="empty-note">' + d.esc(t('wl.pool.empty')) + '</div>';
    d.$('#wlPoolN', root).textContent = pool.length;
    d.$('[data-act="pack"]', root).disabled = !pool.length;
  }

  /* =======================================================================
   *  3. ĐÓNG KHỐI
   * ===================================================================== */

  /**
   * Việc một nút mạng làm trước khi ghi bất cứ thứ gì vào sổ cái:
   *   1. chữ ký có đúng khoá công khai của người gửi không?
   *   2. người gửi có đủ số dư không? (chống tiêu hai lần)
   * Phiếu nào trượt thì bị trả lại hàng chờ kèm lý do.
   */
  function pack() {
    var running = {};
    wallets.forEach(function (w) { running[w.id] = balanceOf(w.id); });

    var taken = [];
    var left = [];

    pool.forEach(function (tx) {
      var verdict = check(tx);
      if (!verdict.valid) {
        tx.refused = 'wl.err.sig';
        left.push(tx);
        return;
      }
      if (running[tx.from] < tx.amount) {
        tx.refused = 'wl.err.funds';
        left.push(tx);
        return;
      }
      running[tx.from] -= tx.amount;
      running[tx.to] += tx.amount;
      tx.refused = '';
      taken.push(tx);
    });

    if (!taken.length) {
      flash(t('wl.err.nothing'), 'no');
      pool = left;
      paintPool();
      return;
    }

    var body = taken.map(function (tx) {
      return tx.from + '->' + tx.to + ':' + tx.amount.toFixed(4);
    }).join(' ; ');

    var block = chain.addBlock(body);
    var index = chain.length - 1;
    blockTx[index] = taken;
    confirmed = confirmed.concat(taken);
    pool = left;

    flash(t('wl.ok.packed', { i: index, n: taken.length, r: left.length }), 'ok');
    paintPool();
    paintChain();
    paintWallets();
    return block;
  }

  function paintChain() {
    var box = d.$('#wlChain', root);
    if (!box) return;
    var report = chain.validateDetailed();

    box.innerHTML = report.map(function (entry, i) {
      var b = entry.block;
      var deals = blockTx[i] || [];
      var tie = i === 0 ? '' : '<div class="tie"></div>';

      var inside = deals.length
        ? '<div class="rows" style="gap:9px;margin-top:11px">' +
            deals.map(function (tx) { return dealHtml(tx, 'block'); }).join('') +
          '</div>'
        : '<div class="tip" style="margin-top:11px;font-size:12.5px">' +
            d.esc(t('wl.c.coinbase', { n: num(OPENING), c: COIN })) + '</div>';

      return tie +
        '<div class="brick' + (i === 0 ? ' root' : '') + '">' +
          '<div class="brick-top">' +
            '<span class="no">' + i + '</span>' +
            '<b>' + d.esc(i === 0 ? t('wl.c.root') : t('wl.c.block', { i: i })) + '</b>' +
            '<span class="tag tag-ok">' + d.esc(t('wl.c.sealed')) + '</span>' +
            '<span class="push"></span>' +
            '<span class="tag">' + d.esc(t('wl.c.deals', { n: deals.length })) + '</span>' +
          '</div>' +
          '<dl class="spec">' +
            '<dt>' + d.esc(t('wl.c.stamp')) + '</dt>' +
              '<dd class="mono" style="font-size:12.5px">' + d.esc(d.fmtTime(b.timestamp)) + '</dd>' +
            '<dt>' + d.esc(t('wl.c.prev')) + '</dt>' +
              '<dd class="digest">' + d.esc(b.previousHash) + '</dd>' +
            '<dt>' + d.esc(t('wl.c.self')) + '</dt>' +
              '<dd class="digest digest-ok">' + d.esc(b.hash) + '</dd>' +
          '</dl>' +
          inside +
        '</div>';
    }).join('');

    d.$('#wlChainN', root).textContent = chain.length;
  }

  /* =======================================================================
   *  4. PHÒNG KIỂM CHỨNG CHỮ KÝ
   * ===================================================================== */
  function probeRow(labelHtml, ok, why) {
    return '<div class="probe ' + (ok ? 'ok' : 'no') + '">' +
      '<div class="probe-out">' + d.esc(ok ? t('wl.v.pass') : t('wl.v.fail')) + '</div>' +
      '<div><b>' + labelHtml + '</b><p>' + d.esc(t(why)) + '</p></div>' +
    '</div>';
  }

  function paintProbe() {
    var box = d.$('#wlProbe', root);
    if (!box) return;

    if (!lastSigned) {
      box.innerHTML = '<div class="empty-note">' + d.esc(t('wl.v.empty')) + '</div>';
      return;
    }

    var tx = lastSigned;
    var message = payload(tx);
    var forged = message.replace(/amount=[\d.]+/, 'amount=999.0000');
    var stranger = wallets.filter(function (w) { return w.id !== tx.from; })[0];

    var r1 = E.verify(tx.pub, message, tx.sig.der);
    var r2 = E.verify(tx.pub, forged, tx.sig.der);
    var r3 = E.verify(stranger.keys.uncompressed, message, tx.sig.der);

    box.innerHTML =
      probeRow(d.esc(t('wl.v.c1')), r1.valid, 'wl.v.e1') +
      probeRow(d.esc(t('wl.v.c2')), r2.valid, 'wl.v.e2') +
      probeRow(d.esc(t('wl.v.c3', { id: stranger.id })), r3.valid, 'wl.v.e3') +

      '<div class="calc" style="margin:13px 0">' + t('wl.v.formula') + '</div>' +

      '<div class="fld">' +
        '<label for="wlTry">' + d.esc(t('wl.v.try')) + '</label>' +
        '<input id="wlTry" type="text" value="' + d.esc(message) + '">' +
      '</div>' +
      '<div class="line" style="margin-top:10px">' +
        '<button class="act act-alt act-xs" data-act="try">' + d.esc(t('wl.v.tryBtn')) + '</button>' +
      '</div>' +
      '<div id="wlTryOut" style="margin-top:11px"></div>';
  }

  function tryVerify() {
    if (!lastSigned) return;
    var message = d.$('#wlTry', root).value;
    var res = E.verify(lastSigned.pub, message, lastSigned.sig.der);
    d.$('#wlTryOut', root).innerHTML =
      probeRow(d.esc(d.shortHash(message, 26)), res.valid, res.valid ? 'wl.v.e1' : 'wl.v.e2');
  }

  /* =======================================================================
   *  5. BẢNG LẬP PHIẾU
   * ===================================================================== */
  function options(selected) {
    return wallets.map(function (w) {
      return '<option value="' + w.id + '"' + (w.id === selected ? ' selected' : '') + '>' +
        d.esc(t('wl.w.name', { id: w.id })) + ' · ' + d.esc(d.shortHash(w.address, 6)) +
      '</option>';
    }).join('');
  }

  /** Cập nhật dòng nhắc dưới bảng lập phiếu: số dư & chuỗi sắp được ký. */
  function refreshFormHints() {
    var from = d.$('#wlFrom', root);
    if (!from) return;
    var sender = byId(from.value);
    var amount = parseFloat(d.$('#wlAmt', root).value);

    d.$('#wlFromBal', root).textContent =
      t('wl.f.balance', { n: num(balanceOf(sender.id)), c: COIN });

    var preview = 'DLU-TX/1|from=' + sender.address +
      '|to=' + byId(d.$('#wlTo', root).value).address +
      '|amount=' + (isFinite(amount) && amount > 0 ? amount.toFixed(4) : '0.0000') +
      '|nonce=' + (counter + 1) +
      '|memo=' + (d.$('#wlMemo', root).value.trim() || t('wl.memoDefault'));

    d.$('#wlPreview', root).textContent = preview;
    d.$('#wlPreviewZ', root).textContent = DLU.sha256(preview);
  }

  function reset() {
    pool = [];
    confirmed = [];
    blockTx = {};
    counter = 0;
    lastSigned = null;
    chain = new DLU.Blockchain({ genesisData: 'DLU-GENESIS | opening balance 100 DLU x 3' });
    mint();
    paintWallets();
    paintPool();
    paintChain();
    paintProbe();
    flash(t('wl.ok.reset'), 'ok');
  }

  /* =======================================================================
   *  6. DỰNG TRANG
   * ===================================================================== */
  function render(container) {
    root = container;
    pool = []; confirmed = []; blockTx = {}; counter = 0; lastSigned = null;
    chain = new DLU.Blockchain({ genesisData: 'DLU-GENESIS | opening balance 100 DLU x 3' });
    mint();

    root.innerHTML =
      '<div class="page bound zone" style="padding-top:40px">' +

      '<div class="zone-head">' +
        '<span class="kicker">' + d.esc(t('wl.kicker')) + '</span>' +
        '<h2>' + d.esc(t('wl.h')) + '</h2>' +
        '<p>' + t('wl.p') + '</p>' +
      '</div>' +

      /* ---- 1. Ví trong phiên ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('wl.vault.t')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag tag-b">secp256k1 · ECDSA</span>' +
          '<button class="act act-line act-xs" data-act="mint">' +
             d.esc(t('wl.vault.mint')) + '</button>' +
        '</div>' +
        '<div class="rows rows-3" id="wlVault"></div>' +
        '<div class="tip" style="margin-top:14px">' + t('wl.vault.tip') + '</div>' +
      '</div>' +

      /* ---- 2. Lập & ký phiếu ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('wl.f.t')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag">' + d.esc(t('wl.f.step')) + '</span>' +
        '</div>' +
        '<div class="rows" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
          '<div class="fld">' +
            '<label for="wlFrom">' + d.esc(t('wl.f.from')) + '</label>' +
            '<select id="wlFrom">' + options('A') + '</select>' +
            '<span class="mono" id="wlFromBal" style="font-size:12px;color:var(--txt-3)"></span>' +
          '</div>' +
          '<div class="fld">' +
            '<label for="wlTo">' + d.esc(t('wl.f.to')) + '</label>' +
            '<select id="wlTo">' + options('B') + '</select>' +
          '</div>' +
          '<div class="fld">' +
            '<label for="wlAmt">' + d.esc(t('wl.f.amount')) + ' (' + COIN + ')</label>' +
            '<input id="wlAmt" type="number" min="0" step="0.5" value="12.5">' +
          '</div>' +
          '<div class="fld">' +
            '<label for="wlMemo">' + d.esc(t('wl.f.memo')) + '</label>' +
            '<input id="wlMemo" type="text" placeholder="' + d.esc(t('wl.f.memoPh')) + '">' +
          '</div>' +
        '</div>' +

        '<div class="fld" style="margin-top:14px">' +
          '<label>' + d.esc(t('wl.f.preview')) + '</label>' +
          '<div class="calc" id="wlPreview"></div>' +
        '</div>' +
        '<div class="fld" style="margin-top:10px">' +
          '<label>' + d.esc(t('wl.f.previewZ')) + '</label>' +
          '<div class="calc" id="wlPreviewZ"></div>' +
        '</div>' +

        '<div class="line" style="margin-top:14px">' +
          '<button class="act act-key" data-act="sign">' + d.esc(t('wl.f.sign')) + '</button>' +
          '<button class="act act-line" data-act="reset">' + d.esc(t('wl.f.reset')) + '</button>' +
        '</div>' +
        '<div id="wlFlash" class="tip hidden" style="margin-top:13px;font-size:13px"></div>' +
      '</div>' +

      /* ---- 3. Hàng chờ + phòng kiểm chứng ---- */
      '<div class="rows rows-2" style="margin-bottom:16px">' +
        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('wl.pool.t')) + '</h3>' +
            '<span class="push"></span>' +
            '<span class="tag tag-warn">' + d.esc(t('wl.pool.waiting')) + ' <b id="wlPoolN">0</b></span>' +
            '<button class="act act-key act-xs" data-act="pack">' +
               d.esc(t('wl.pool.pack')) + '</button>' +
          '</div>' +
          '<div class="rows" style="gap:10px" id="wlPool"></div>' +
        '</div>' +

        '<div class="slab">' +
          '<div class="slab-bar"><h3>' + d.esc(t('wl.v.t')) + '</h3></div>' +
          '<div id="wlProbe"></div>' +
        '</div>' +
      '</div>' +

      /* ---- 4. Sổ cái đã xác nhận ---- */
      '<div class="slab" style="margin-bottom:16px">' +
        '<div class="slab-bar"><h3>' + d.esc(t('wl.c.t')) + '</h3>' +
          '<span class="push"></span>' +
          '<span class="tag tag-a">' + d.esc(t('wl.c.height')) + ' <b id="wlChainN">1</b></span>' +
        '</div>' +
        '<div class="stack" id="wlChain"></div>' +
      '</div>' +

      /* ---- 5. Nguyên lý ---- */
      '<div class="slab">' +
        '<div class="slab-bar"><h3>' + d.esc(t('wl.why.t')) + '</h3></div>' +
        '<div class="rows rows-4">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div>' +
              '<b style="color:var(--blue-2);font-size:14.5px">' + d.esc(t('wl.why.' + i + 'h')) + '</b>' +
              '<p style="font-size:13px;color:var(--txt-2);margin-top:6px">' +
                 d.esc(t('wl.why.' + i + 'p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="tip" style="margin-top:16px">' + t('wl.why.warn') + '</div>' +
      '</div>' +
      '</div>';

    /* ---------------------------------------------------------- sự kiện */
    var acts = {
      sign: signTx,
      pack: pack,
      reset: reset,
      try: tryVerify,
      mint: function () {
        mint();
        pool.forEach(function (tx) { tx.refused = 'wl.err.stale'; });
        lastSigned = null;
        paintWallets();
        paintPool();
        paintProbe();
        flash(t('wl.ok.minted'), 'ok');
      }
    };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = acts[btn.getAttribute('data-act')];
      if (fn) fn();
    });

    d.on(root, 'click', '[data-peek]', function (ev, btn) {
      var w = byId(btn.getAttribute('data-peek'));
      if (w) { w.reveal = !w.reveal; paintWallets(); }
    });
    d.on(root, 'click', '[data-pem]', function (ev, btn) {
      var w = byId(btn.getAttribute('data-pem'));
      if (w) { w.pem = !w.pem; paintWallets(); }
    });
    d.on(root, 'click', '[data-copy]', function (ev, btn) {
      var text = btn.getAttribute('data-copy');
      var label = btn.textContent;
      d.copy(text, function () {
        btn.textContent = t('wl.copied');
        setTimeout(function () { btn.textContent = label; }, 1300);
      });
    });
    d.on(root, 'click', '[data-tamper]', function (ev, btn) {
      var id = parseInt(btn.getAttribute('data-tamper'), 10);
      pool.forEach(function (tx) { if (tx.id === id) tamper(tx); });
    });
    d.on(root, 'click', '[data-drop]', function (ev, btn) {
      var id = parseInt(btn.getAttribute('data-drop'), 10);
      pool.forEach(function (tx) { if (tx.id === id) discard(tx); });
    });

    ['#wlFrom', '#wlTo', '#wlAmt', '#wlMemo'].forEach(function (sel) {
      var el = d.$(sel, root);
      el.addEventListener('input', refreshFormHints);
      el.addEventListener('change', refreshFormHints);
    });
    d.$('#wlMemo', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') signTx();
    });

    paintWallets();
    paintPool();
    paintChain();
    paintProbe();
    refreshFormHints();
  }

  DLU.views = DLU.views || {};
  DLU.views.desk = { render: render, destroy: function () { root = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
