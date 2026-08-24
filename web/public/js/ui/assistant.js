/* =============================================================================
 *  assistant.js (tầng hiển thị) — Khung trò chuyện của "Trạm hỏi đáp"
 * -----------------------------------------------------------------------------
 *  Khác mọi tệp view-*.js còn lại, khung này KHÔNG nằm trong thẻ <main id="stage">.
 *  Lý do: app.js thay hẳn thẻ <main> mỗi lần chuyển trang, nên thứ gì đặt trong
 *  đó cũng bị dựng lại từ đầu. Trợ lý phải sống xuyên suốt các trang để người
 *  dùng hỏi giữa chừng mà không mất đoạn hội thoại đang dở, nên nó được gắn
 *  thẳng vào <body> và tự theo dõi địa chỉ trang bằng sự kiện hashchange.
 *
 *  Toàn bộ phần "hiểu câu hỏi" nằm ở js/core/assistant.js. Tệp này chỉ lo vẽ.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});
  var d = DLU.dom;
  var t = function () { return DLU.t.apply(null, arguments); };

  var host = null;      // khung bao ngoài, con trực tiếp của <body>
  var panel = null;     // hộp thoại
  var logEl = null;     // vùng cuộn chứa các bong bóng chat
  var chipsEl = null;   // hàng nút gợi ý phía trên ô nhập
  var inputEl = null;
  var launcher = null;  // nút tròn nổi ở góc màn hình
  var isOpen = false;
  var busy = false;     // đang "tra cứu", chặn gửi chồng câu hỏi

  /* Hàng gợi ý đang ở dạng nào: 'suggest' là gợi ý chung theo trang, 'more' là
     những mục nên đọc tiếp sau câu vừa trả lời. Chuyển trang chỉ được phép làm
     mới loại thứ nhất — loại thứ hai là mạch đọc của người dùng, đạp lên thì
     họ mất dấu chỗ đang theo. */
  var chipsMode = 'suggest';

  /** Địa chỉ trang đang xem, dạng '#/ledger' — dùng làm ngữ cảnh cho bộ tìm. */
  function route() {
    var hash = global.location.hash || '#/';
    return hash === '#' ? '#/' : hash;
  }

  /* ---------------------------------------------------------------- vẽ chat */

  /**
   * Thêm một bong bóng vào khung trò chuyện.
   * @param {string} who 'you' | 'ai'
   * @param {string} html nội dung; phía người dùng phải escape trước khi gọi
   */
  function bubble(who, html) {
    var row = document.createElement('div');
    row.className = 'bot-msg bot-msg-' + who;
    row.innerHTML =
      '<span class="bot-who">' + d.esc(t(who === 'you' ? 'bot.you' : 'bot.me')) + '</span>' +
      '<div class="bot-say">' + html + '</div>';
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
    return row;
  }

  /**
   * Dựng các nút gợi ý. Mỗi nút mang sẵn id của mục kiến thức, bấm vào là hỏi
   * luôn mục đó — khỏi phải gõ, và chắc chắn khớp đúng mục.
   */
  function renderChips(label, items, mode) {
    chipsMode = mode || 'suggest';
    if (!items || !items.length) { chipsEl.innerHTML = ''; return; }
    chipsEl.innerHTML =
      '<span class="bot-chip-lb">' + d.esc(label) + '</span>' +
      items.map(function (k) {
        return '<button type="button" class="bot-chip" data-kb="' + d.esc(k.id) + '">' +
               d.esc(k.q[DLU.i18n.getLang()]) + '</button>';
      }).join('');
  }

  /** Gợi ý mặc định: bám theo trang người dùng đang đứng. */
  function defaultChips() {
    renderChips(t('bot.suggest'), DLU.assistant.suggest(route(), 4));
  }

  /* ------------------------------------------------------------ trả lời */

  /** Dựng phần thân câu trả lời cho một mục kiến thức. */
  function answerHTML(item) {
    var lang = DLU.i18n.getLang();
    var head =
      '<div class="bot-head">' +
        '<b>' + d.esc(item.q[lang]) + '</b>' +
        '<span class="bot-tag">' +
          d.esc(t(item.tag === 'guide' ? 'bot.tagGuide' : 'bot.tagConcept')) +
        '</span>' +
      '</div>';

    // Chỉ mời sang trang khác khi người dùng chưa đứng sẵn ở đó.
    var go = '';
    if (item.route && item.route !== route()) {
      go = '<a class="act act-alt act-xs bot-go" href="' + d.esc(item.route) + '">' +
           d.esc(t('bot.goto')) + '</a>';
    }
    return head + '<div class="bot-body">' + item.a[lang] + '</div>' + go;
  }

  /** Trả lời rồi cập nhật hàng gợi ý theo những mục nên đọc tiếp. */
  function replyWith(item) {
    bubble('ai', answerHTML(item));
    var next = DLU.assistant.related(item);
    if (next.length) renderChips(t('bot.more'), next, 'more');
    else defaultChips();
  }

  /**
   * Xử lý một câu hỏi: hiện bong bóng của người dùng, chờ một nhịp ngắn cho
   * cảm giác "đang tra", rồi hiện kết quả.
   */
  function handle(text) {
    if (busy) return;
    text = String(text || '').trim();
    if (!text) return;

    busy = true;
    bubble('you', d.esc(text));
    inputEl.value = '';
    chipsEl.innerHTML = '';

    var wait = bubble('ai', '<span class="bot-dots"><i></i><i></i><i></i></span>');

    var result = DLU.assistant.ask(text, { lang: DLU.i18n.getLang(), route: route() });

    setTimeout(function () {
      logEl.removeChild(wait);

      if (result.kind === 'answer') {
        replyWith(result.entry);
      } else if (result.kind === 'greet') {
        bubble('ai', '<p>' + d.esc(t('bot.greet')) + '</p>');
        defaultChips();
      } else if (result.kind === 'thanks') {
        bubble('ai', '<p>' + d.esc(t('bot.thanks')) + '</p>');
        defaultChips();
      } else {
        // Không đủ chắc chắn: nói thẳng là chưa biết, kèm những mục gần nhất.
        var alts = result.alts || [];
        bubble('ai', '<p>' + d.esc(t(alts.length ? 'bot.unsure' : 'bot.unsureBare')) + '</p>');
        renderChips(t('bot.suggest'), alts.length ? alts : DLU.assistant.suggest(route(), 4));
      }

      busy = false;
      logEl.scrollTop = logEl.scrollHeight;
    }, 260);
  }

  /** Câu chào mở màn, dựng lại mỗi khi xoá hội thoại hoặc đổi ngôn ngữ. */
  function greet() {
    logEl.innerHTML = '';
    bubble('ai', '<p>' + t('bot.hello') + '</p>');
    defaultChips();
  }

  /* -------------------------------------------------------------- đóng mở */

  function setOpen(next) {
    isOpen = next;
    host.classList.toggle('on', isOpen);
    launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) inputEl.focus();
  }

  /* ------------------------------------------------------- dựng khung một lần */

  function chrome() {
    return '' +
      '<button type="button" class="bot-orb" id="botOrb" aria-expanded="false"' +
             ' aria-controls="botPanel">' +
        '<span class="bot-orb-ic" aria-hidden="true">?</span>' +
        '<span class="bot-orb-tx"></span>' +
      '</button>' +

      '<section class="bot-panel" id="botPanel" role="dialog" aria-modal="false" aria-hidden="true">' +
        '<header class="bot-bar">' +
          '<div class="bot-id">' +
            '<b class="bot-name"></b>' +
            '<span class="bot-sub"></span>' +
          '</div>' +
          '<button type="button" class="bot-icon" id="botWipe"></button>' +
          '<button type="button" class="bot-icon" id="botShut" aria-label="close">✕</button>' +
        '</header>' +

        '<div class="bot-log" id="botLog" role="log" aria-live="polite"></div>' +
        '<div class="bot-chips" id="botChips"></div>' +

        '<form class="bot-ask" id="botAsk">' +
          '<input type="text" id="botIn" autocomplete="off" spellcheck="false">' +
          '<button type="submit" class="act act-key act-xs bot-send" id="botSend"></button>' +
        '</form>' +
      '</section>';
  }

  /** Đổ lại mọi câu chữ tĩnh của khung — gọi lúc dựng và mỗi lần đổi ngôn ngữ. */
  function relabel() {
    d.$('.bot-orb-tx', host).textContent = t('bot.launch');
    launcher.title = t('bot.launch');
    launcher.setAttribute('aria-label', t('bot.launch'));
    d.$('.bot-name', host).textContent = t('bot.title');
    d.$('.bot-sub', host).textContent = t('bot.sub');
    d.$('#botWipe', host).textContent = t('bot.clear');
    d.$('#botWipe', host).title = t('bot.clear');
    d.$('#botShut', host).title = t('bot.close');
    inputEl.placeholder = t('bot.ph');
    d.$('#botSend', host).textContent = t('bot.send');
  }

  function mount() {
    if (host) return;                      // đề phòng gọi hai lần

    host = document.createElement('div');
    host.className = 'bot';
    host.innerHTML = chrome();
    document.body.appendChild(host);

    launcher = d.$('#botOrb', host);
    panel = d.$('#botPanel', host);
    logEl = d.$('#botLog', host);
    chipsEl = d.$('#botChips', host);
    inputEl = d.$('#botIn', host);

    relabel();
    greet();

    launcher.addEventListener('click', function () { setOpen(!isOpen); });
    d.$('#botShut', host).addEventListener('click', function () { setOpen(false); });
    d.$('#botWipe', host).addEventListener('click', function () { greet(); inputEl.focus(); });

    d.$('#botAsk', host).addEventListener('submit', function (ev) {
      ev.preventDefault();
      handle(inputEl.value);
    });

    // Bấm một nút gợi ý = hỏi đúng mục đó, không phải đoán lại từ câu chữ.
    d.on(chipsEl, 'click', '[data-kb]', function (ev, btn) {
      var item = DLU.assistant.byId(btn.getAttribute('data-kb'));
      if (!item) return;
      busy = false;
      bubble('you', d.esc(item.q[DLU.i18n.getLang()]));
      chipsEl.innerHTML = '';
      replyWith(item);
      logEl.scrollTop = logEl.scrollHeight;
    });

    // Liên kết "mở trang liên quan" nằm trong bong bóng chat: đi tới nơi rồi
    // thu gọn khung lại để người dùng nhìn được trang vừa mở.
    d.on(logEl, 'click', '.bot-go', function () { setOpen(false); });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && isOpen) setOpen(false);
    });

    // Đổi trang ⇒ gợi ý bám theo trang mới, trừ khi đang bày mạch "đọc tiếp".
    global.addEventListener('hashchange', function () {
      if (chipsMode === 'suggest') defaultChips();
    });

    /* Đổi ngôn ngữ: dịch lại khung và mở hội thoại mới. Không cố dịch những
       câu đã trả lời — trộn hai thứ tiếng trong cùng một đoạn chat khó đọc
       hơn nhiều so với việc bắt đầu lại. */
    DLU.i18n.onChange(function () { relabel(); greet(); });
  }

  DLU.assistantUI = { mount: mount, open: function () { setOpen(true); }, ask: handle };
})(typeof window !== 'undefined' ? window : globalThis);
