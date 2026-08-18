/* =============================================================================
 *  view-keys.js — Trang Khoá riêng / Khoá công khai / Chữ ký số
 *  Trực quan hoá đúng năm bước của Key.py:
 *    sinh khoá → định dạng hex → xuất PEM → ký ECDSA → xác minh ba tình huống
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var E = DLU.ecdsa;
  var t = function () { return DLU.t.apply(null, arguments); };

  var root = null;
  var keys = null;        // cặp khoá hiện tại
  var otherKeys = null;   // cặp khoá "người khác" cho tình huống 3
  var sig = null;         // chữ ký gần nhất
  var signedMessage = ''; // thông điệp đã ký (để xác minh đúng bản gốc)
  var showPrivate = false;

  /* ------------------------------------------------------- tiện ích nhỏ */

  /** Ô hiển thị chuỗi hex dài kèm nút chép. */
  function hexBox(label, value, id, extraClass) {
    return '<div class="field" style="margin-bottom:12px">' +
      '<label>' + label +
        '<button class="btn btn-ghost btn-sm copy-btn" data-copy="' + id + '">' +
          d.esc(t('ky.copy')) + '</button>' +
      '</label>' +
      '<div class="keybox ' + (extraClass || '') + '" id="' + id + '">' + value + '</div>' +
    '</div>';
  }

  /**
   * Chép vào clipboard. navigator.clipboard chỉ chạy trong ngữ cảnh bảo mật
   * (https / localhost), nên có đường lùi bằng execCommand để trang vẫn hoạt
   * động khi mở trực tiếp bằng file://
   */
  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = t('ky.copied');
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    if (global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* trình duyệt chặn */ }
      document.body.removeChild(ta);
    }
  }

  /* ------------------------------------------------------- 1. CẶP KHOÁ */
  function drawKeys(ms) {
    var box = d.$('#kyKeys', root);
    if (!keys) {
      box.innerHTML = '<p style="color:var(--text-3);font-style:italic">' +
                      d.esc(t('ky.needKeys')) + '</p>';
      return;
    }

    box.innerHTML =
      hexBox(d.esc(t('ky.gen.priv')) +
        '<button class="btn btn-ghost btn-sm" data-toggle="priv" style="margin-left:6px">' +
        d.esc(showPrivate ? t('ky.gen.hide') : t('ky.gen.show')) + '</button>',
        showPrivate ? d.esc(keys.privateHex)
                    : '<span class="masked">' + d.esc(t('ky.gen.hidden')) + '</span>',
        'kyPriv', 'keybox-danger') +

      '<div class="note" style="margin:-4px 0 16px;font-size:12.5px">' +
        d.esc(t('ky.gen.privWarn')) + '</div>' +

      '<div class="formula" style="margin-bottom:14px">' + d.esc(t('ky.gen.derive')) +
        (ms !== undefined ? ' · ' + d.esc(t('ky.gen.time', { n: ms })) : '') + '</div>' +

      hexBox(d.esc(t('ky.gen.pub')), d.esc(keys.uncompressed), 'kyPub', 'keybox-ok') +

      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' +
        hexBox(d.esc(t('ky.gen.x')), d.esc(keys.x), 'kyX') +
        hexBox(d.esc(t('ky.gen.y')), d.esc(keys.y), 'kyY') +
      '</div>' +

      hexBox(d.esc(t('ky.gen.comp')), d.esc(keys.compressed), 'kyComp') +
      '<p style="font-size:12.5px;color:var(--text-2)">' + d.esc(t('ky.gen.compNote')) + '</p>';
  }

  function generate() {
    var btn = d.$('[data-act="gen"]', root);
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = t('ky.gen.working');

    // Nhường một khung hình để nút kịp đổi chữ trước khi tính toán chặn luồng
    setTimeout(function () {
      var t0 = performance.now();
      keys = E.generateKeyPair();
      otherKeys = E.generateKeyPair();
      var ms = Math.round(performance.now() - t0);

      sig = null;
      signedMessage = '';
      showPrivate = false;

      drawKeys(ms);
      drawPem();
      drawSignature();
      drawVerify();

      btn.disabled = false;
      btn.textContent = label;
    }, 20);
  }

  /* ------------------------------------------------------------ 2. PEM */
  function drawPem() {
    var box = d.$('#kyPem', root);
    if (!keys) { box.innerHTML = ''; return; }

    box.innerHTML =
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
        '<div class="field">' +
          '<label>' + d.esc(t('ky.pem.priv')) +
            '<button class="btn btn-ghost btn-sm copy-btn" data-copy="kyPemPriv">' +
              d.esc(t('ky.copy')) + '</button></label>' +
          '<div class="term pem" id="kyPemPriv">' + d.esc(E.privateKeyPem(keys)) + '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>' + d.esc(t('ky.pem.pub')) +
            '<button class="btn btn-ghost btn-sm copy-btn" data-copy="kyPemPub">' +
              d.esc(t('ky.copy')) + '</button></label>' +
          '<div class="term pem" id="kyPemPub">' + d.esc(E.publicKeyPem(keys)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="note" style="margin-top:14px">' + t('ky.pem.note') + '</div>';
  }

  /* ------------------------------------------------------------ 3. KÝ */
  function drawSignature() {
    var box = d.$('#kySig', root);
    if (!sig) {
      box.innerHTML = '<p style="color:var(--text-3);font-style:italic">' +
        d.esc(keys ? t('ky.needSig') : t('ky.needKeys')) + '</p>';
      return;
    }

    box.innerHTML =
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' +
        hexBox(d.esc(t('ky.sign.z')), d.esc(sig.z), 'kyZ') +
        hexBox(d.esc(t('ky.sign.k')), d.esc(sig.k), 'kyK', 'keybox-danger') +
      '</div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' +
        hexBox('r', d.esc(sig.r), 'kyR') +
        hexBox('s', d.esc(sig.s), 'kyS') +
      '</div>' +
      hexBox(d.esc(t('ky.sign.der')) +
        ' <span class="badge">' + d.esc(t('ky.sign.len', { n: sig.bytes })) + '</span>',
        d.esc(sig.der), 'kyDer', 'keybox-ok') +
      '<div class="formula" style="margin-bottom:12px">' + d.esc(t('ky.sign.flow')) + '</div>' +
      '<div class="note">' + t('ky.sign.warn') + '</div>';
  }

  function doSign() {
    if (!keys) return;
    signedMessage = d.$('#kyMsg', root).value;
    sig = E.sign(keys.privateHex, signedMessage);
    drawSignature();
    // Đồng bộ ô "tự thử" về đúng thông điệp vừa ký
    var live = d.$('#kyLiveMsg', root);
    if (live) live.value = signedMessage;
    drawVerify();
  }

  /* ------------------------------------------------------ 4. XÁC MINH */
  function scenarioRow(labelHtml, valid, explainKey) {
    return '<div class="scenario' + (valid ? ' ok' : ' bad') + '">' +
      '<div class="scenario-verdict">' +
        d.esc(valid ? t('ky.ver.ok') : t('ky.ver.fail')) + '</div>' +
      '<div><b>' + labelHtml + '</b>' +
        '<p>' + d.esc(t(explainKey)) + '</p></div>' +
    '</div>';
  }

  function drawVerify() {
    var box = d.$('#kyVer', root);
    if (!sig) {
      box.innerHTML = '<p style="color:var(--text-3);font-style:italic">' +
        d.esc(keys ? t('ky.needSig') : t('ky.needKeys')) + '</p>';
      return;
    }

    var fake = t('ky.fakeMsg');
    var r1 = E.verify(keys.uncompressed, signedMessage, sig.der);
    var r2 = E.verify(keys.uncompressed, fake, sig.der);
    var r3 = E.verify(otherKeys.uncompressed, signedMessage, sig.der);

    box.innerHTML =
      scenarioRow(d.esc(t('ky.ver.c1')), r1.valid, 'ky.ver.e1') +
      scenarioRow(d.esc(t('ky.ver.c2', { m: fake })), r2.valid, 'ky.ver.e2') +
      scenarioRow(d.esc(t('ky.ver.c3')), r3.valid, 'ky.ver.e3') +

      '<div class="formula" style="margin:14px 0">' + t('ky.ver.formula') + '</div>' +

      '<div class="field">' +
        '<label for="kyLiveMsg">' + d.esc(t('ky.ver.live')) + '</label>' +
        '<div class="row" style="align-items:stretch">' +
          '<input id="kyLiveMsg" type="text" style="flex:1;min-width:220px" value="' +
             d.esc(signedMessage) + '">' +
          '<button class="btn btn-primary" data-act="live">' +
             d.esc(t('ky.ver.liveBtn')) + '</button>' +
        '</div>' +
      '</div>' +
      '<div id="kyLiveOut" style="margin-top:12px"></div>';
  }

  function doLiveVerify() {
    var msg = d.$('#kyLiveMsg', root).value;
    var res = E.verify(keys.uncompressed, msg, sig.der);
    d.$('#kyLiveOut', root).innerHTML =
      scenarioRow(d.esc('"' + msg + '"'), res.valid,
                  res.valid ? 'ky.ver.e1' : 'ky.ver.e2');
  }

  /* -------------------------------------------------------------- render */
  function render(container) {
    root = container;
    keys = null; otherKeys = null; sig = null;
    signedMessage = ''; showPrivate = false;

    root.innerHTML =
      '<div class="page wrap section" style="padding-top:44px">' +
      '<div class="section-title" style="text-align:left;margin-bottom:26px">' +
        '<span class="eyebrow">' + d.esc(t('ky.eyebrow')) + '</span>' +
        '<h2 style="margin-top:12px">' + d.esc(t('ky.title')) + '</h2>' +
        '<p style="margin:0">' + t('ky.sub') + '</p>' +
      '</div>' +

      // ---- 1. Sinh khoá ----
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ky.gen.t')) + '</h3>' +
          '<span class="spacer"></span>' +
          '<span class="badge badge-head">' + d.esc(t('ky.gen.curve')) + '</span>' +
        '</div>' +
        '<div class="row" style="margin-bottom:18px">' +
          '<button class="btn btn-primary" data-act="gen">' + d.esc(t('ky.gen.btn')) + '</button>' +
        '</div>' +
        '<div id="kyKeys"></div>' +
      '</div>' +

      // ---- 2. PEM ----
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ky.pem.t')) + '</h3></div>' +
        '<div id="kyPem"></div>' +
      '</div>' +

      // ---- 3. Ký ----
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ky.sign.t')) + '</h3></div>' +
        '<div class="row" style="margin-bottom:18px">' +
          '<div class="field" style="flex:1;min-width:250px">' +
            '<label for="kyMsg">' + d.esc(t('ky.sign.msg')) + '</label>' +
            '<input id="kyMsg" type="text" value="' + d.esc(t('ky.sign.msgVal')) + '">' +
          '</div>' +
          '<button class="btn btn-green" data-act="sign">' + d.esc(t('ky.sign.btn')) + '</button>' +
        '</div>' +
        '<div id="kySig"></div>' +
      '</div>' +

      // ---- 4. Xác minh ----
      '<div class="card" style="margin-bottom:18px">' +
        '<div class="card-head"><h3>' + d.esc(t('ky.ver.t')) + '</h3></div>' +
        '<div id="kyVer"></div>' +
      '</div>' +

      // ---- 5. Giải thích ----
      '<div class="card">' +
        '<div class="card-head"><h3>' + d.esc(t('ky.why.t')) + '</h3></div>' +
        '<div class="grid grid-4">' +
          [1, 2, 3, 4].map(function (i) {
            return '<div>' +
              '<b style="color:var(--dlu-orange-2);font-size:14.5px">' +
                 d.esc(t('ky.why.' + i + 't')) + '</b>' +
              '<p style="font-size:13px;color:var(--text-2);margin-top:6px">' +
                 d.esc(t('ky.why.' + i + 'p')) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '</div>';

    var actions = { gen: generate, sign: doSign, live: doLiveVerify };
    d.on(root, 'click', '[data-act]', function (ev, btn) {
      var fn = actions[btn.getAttribute('data-act')];
      if (fn) fn();
    });

    d.on(root, 'click', '[data-toggle="priv"]', function () {
      showPrivate = !showPrivate;
      drawKeys();
    });

    d.on(root, 'click', '.copy-btn', function (ev, btn) {
      var target = d.$('#' + btn.getAttribute('data-copy'), root);
      if (target) copyText(target.textContent, btn);
    });

    d.$('#kyMsg', root).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') doSign();
    });

    generate();   // có sẵn một cặp khoá ngay khi mở trang
  }

  DLU.views = DLU.views || {};
  DLU.views.keys = { render: render, destroy: function () { root = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
