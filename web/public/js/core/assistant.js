/* =============================================================================
 *  assistant.js — Bộ não của trợ lý "Trạm hỏi đáp"
 * -----------------------------------------------------------------------------
 *  Đây là một trợ lý CHẠY HOÀN TOÀN TRONG TRÌNH DUYỆT: không gọi máy chủ, không
 *  khoá API, không gửi một byte nào ra ngoài — đúng cam kết in ở chân trang.
 *
 *  Cách nó hiểu câu hỏi, gồm ba lớp:
 *
 *    1. CHUẨN HOÁ  — bỏ dấu tiếng Việt, hạ chữ thường, cắt dấu câu. Nhờ vậy
 *       "Hàm băm là gì?", "ham bam la gi" và "HÀM BĂM" đều về cùng một dạng,
 *       người dùng gõ không dấu vẫn tra được.
 *
 *    2. CHẤM ĐIỂM  — mỗi mục kiến thức có ba vùng chữ: từ khoá, câu hỏi mẫu và
 *       phần thân. Từ nào của câu hỏi rơi vào vùng nào thì cộng điểm theo trọng
 *       số của vùng đó, nhân thêm IDF — từ càng hiếm trong kho thì càng nhiều
 *       thông tin ("merkle" đáng giá hơn "khối" rất nhiều).
 *
 *    3. NGỮ CẢNH   — đang đứng ở trang nào thì các mục thuộc trang đó được cộng
 *       thêm điểm, nên câu hỏi cụt ngủn vẫn ra đúng phần người dùng đang xem.
 *
 *  Điểm cao nhất mà vẫn dưới ngưỡng ⇒ trợ lý thành thật nói "chưa chắc", kèm
 *  vài mục gần đúng nhất, thay vì bịa ra một câu trả lời.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  /* =========================================================================
   *  1. KHO TRI THỨC
   * -----------------------------------------------------------------------
   *  Mỗi mục:
   *    id    — mã duy nhất, dùng để nối các mục với nhau
   *    tag   — nhóm: 'concept' (kiến thức) hoặc 'guide' (hướng dẫn thao tác)
   *    route — trang liên quan; trợ lý sẽ mời người dùng bấm sang trang đó
   *    kw    — từ khoá tra cứu, viết thoáng tay, càng nhiều cách gọi càng tốt
   *    q     — câu hỏi mẫu, hiện trên các nút gợi ý
   *    a     — câu trả lời (cho phép thẻ HTML đơn giản)
   *    next  — id các mục nên đọc tiếp
   * ======================================================================= */
  var KB = [

  /* ------------------------------------------------------------------------
   *  1.1 KIẾN THỨC NỀN
   * --------------------------------------------------------------------- */
  {
    id: 'blockchain', tag: 'concept', route: '#/ledger',
    kw: { vi: 'blockchain chuỗi khối sổ cái phân tán là gì khái niệm định nghĩa tổng quan',
          en: 'blockchain chain of blocks distributed ledger what is definition overview' },
    q:  { vi: 'Blockchain là gì?', en: 'What is a blockchain?' },
    a:  { vi: '<p><b>Blockchain là một cuốn sổ ghi chép mà ai cũng giữ một bản, và không ai sửa lén được.</b></p>' +
              '<p>Về mặt cấu trúc dữ liệu, nó là một danh sách liên kết đặc biệt: mỗi khối chép lại <b>mã băm của khối liền trước</b> thay vì chép địa chỉ ô nhớ. Mã băm ấy được tính từ chính nội dung khối trước, nên sửa một chữ ở khối cũ là mã băm đổi, mắt nối với khối sau đứt, và toàn bộ phần đuôi mất hiệu lực.</p>' +
              '<p>Ba trụ đỡ làm nên tính chất đó: <b>hàm băm</b> (chống sửa), <b>chữ ký số</b> (chứng minh quyền sở hữu) và <b>đồng thuận</b> (cả mạng cùng công nhận một bản sổ).</p>',
          en: '<p><b>A blockchain is a ledger everyone holds a copy of, and nobody can quietly edit.</b></p>' +
              '<p>Structurally it is a special linked list: each block records the <b>hash of the previous block</b> instead of a memory address. That hash is computed from the previous block’s own content, so changing one character in an old block changes its hash, breaks the link to the next block, and invalidates the entire tail.</p>' +
              '<p>Three pillars hold it up: <b>hashing</b> (tamper evidence), <b>digital signatures</b> (ownership) and <b>consensus</b> (the network agreeing on one copy).</p>' },
    next: ['block', 'hash', 'immutable', 'g-tour']
  },
  {
    id: 'block', tag: 'concept', route: '#/ledger',
    kw: { vi: 'khối block gồm những gì cấu tạo thành phần header tiêu đề trường dữ liệu',
          en: 'block contains fields structure header components anatomy' },
    q:  { vi: 'Một khối gồm những gì?', en: 'What is inside a block?' },
    a:  { vi: '<p>Trong xưởng này, mỗi khối mang sáu trường:</p><ul>' +
              '<li><b>index</b> — số thứ tự của khối trong sổ</li>' +
              '<li><b>timestamp</b> — thời điểm đóng khối</li>' +
              '<li><b>data</b> — nội dung ghi vào (một dòng chữ, hoặc cả tập giao dịch)</li>' +
              '<li><b>previous_hash</b> — dấu niêm phong của khối liền trước</li>' +
              '<li><b>nonce</b> — con số dò được khi đào</li>' +
              '<li><b>hash</b> — dấu niêm phong của chính khối này</li></ul>' +
              '<p>Công thức: <span class="mono">hash = SHA256(previous_hash + timestamp + data + nonce)</span>. Năm trường đầu là nguyên liệu, trường cuối là kết quả — nên đụng vào bất kỳ trường nào cũng làm <b>hash</b> đổi.</p>',
          en: '<p>In this studio every block carries six fields:</p><ul>' +
              '<li><b>index</b> — its position in the ledger</li>' +
              '<li><b>timestamp</b> — when it was sealed</li>' +
              '<li><b>data</b> — the payload (a line of text, or a whole transaction set)</li>' +
              '<li><b>previous_hash</b> — the seal of the block before it</li>' +
              '<li><b>nonce</b> — the number found while mining</li>' +
              '<li><b>hash</b> — this block’s own seal</li></ul>' +
              '<p>The formula is <span class="mono">hash = SHA256(previous_hash + timestamp + data + nonce)</span>. The first five fields are the ingredients, the last is the result — so touching any of them changes <b>hash</b>.</p>' },
    next: ['prevhash', 'nonce', 'sha256', 'g-ledger']
  },
  {
    id: 'hash', tag: 'concept', route: '#/',
    kw: { vi: 'hàm băm hash băm dấu niêm phong digest tóm tắt là gì',
          en: 'hash function digest fingerprint what is hashing' },
    q:  { vi: 'Hàm băm là gì?', en: 'What is a hash function?' },
    a:  { vi: '<p>Hàm băm mật mã nhận vào <b>dữ liệu dài bao nhiêu cũng được</b> và trả ra một chuỗi <b>dài cố định</b> — với SHA-256 là 64 ký tự hex, tức 256 bit.</p>' +
              '<p>Coi nó như dấu vân tay của dữ liệu: cùng một dữ liệu luôn cho cùng một dấu, dữ liệu khác gần như chắc chắn cho dấu khác. Bốn tính chất khiến nó dùng được cho sổ cái:</p><ul>' +
              '<li><b>Đầu ra cố định</b> — một ký tự hay một gigabyte cũng ra 64 ký tự hex.</li>' +
              '<li><b>Một chiều</b> — cầm dấu niêm phong không lần ngược ra dữ liệu gốc.</li>' +
              '<li><b>Thác đổ</b> — đổi một bit đầu vào, khoảng một nửa bit đầu ra lật theo.</li>' +
              '<li><b>Khó đụng hàng</b> — nặn hai dữ liệu cho cùng một dấu là bất khả thi trên thực tế.</li></ul>' +
              '<p>Muốn thấy tận mắt thì gõ thử vào <b>Bàn thử hàm băm</b> ở trang Tổng quan.</p>',
          en: '<p>A cryptographic hash function takes input of <b>any length</b> and returns a <b>fixed-length</b> string — for SHA-256, 64 hex characters, i.e. 256 bits.</p>' +
              '<p>Think of it as a fingerprint of the data: the same input always yields the same fingerprint, different input almost certainly yields a different one. Four properties make it usable for a ledger:</p><ul>' +
              '<li><b>Fixed output</b> — one character or one gigabyte both give 64 hex characters.</li>' +
              '<li><b>One-way</b> — holding the seal does not get you back to the data.</li>' +
              '<li><b>Avalanche</b> — flip one input bit and about half the output bits flip.</li>' +
              '<li><b>Collision resistance</b> — crafting two inputs with the same seal is infeasible in practice.</li></ul>' +
              '<p>To see it live, type into the <b>hash bench</b> on the Overview page.</p>' },
    next: ['sha256', 'avalanche', 'oneway', 'g-hashlab']
  },
  {
    id: 'sha256', tag: 'concept', route: '#/',
    kw: { vi: 'sha256 sha-256 fips 180-4 256 bit 64 hex thuật toán băm chuẩn',
          en: 'sha256 sha-256 fips 180-4 256 bit 64 hex standard algorithm' },
    q:  { vi: 'SHA-256 là gì?', en: 'What is SHA-256?' },
    a:  { vi: '<p><b>SHA-256</b> là hàm băm mật mã theo chuẩn NIST FIPS 180-4, cho đầu ra 256 bit — viết dưới dạng 64 ký tự hex. Đây chính là hàm Bitcoin dùng để niêm phong khối.</p>' +
              '<p>Cách nó chạy, nói vắn tắt: đệm dữ liệu cho tròn bội số 512 bit, cắt thành từng khối 512 bit, rồi cho mỗi khối chạy 64 vòng trộn gồm phép cộng modulo 2³², xoay bit và các hàm logic, liên tục nhào vào tám thanh ghi trạng thái. Nối tám thanh ghi ấy lại là ra mã băm.</p>' +
              '<p>Trong đồ án này, SHA-256 được <b>tự cài bằng JavaScript thuần</b> ở tệp <span class="mono">js/lib/sha256.js</span>, đã đối chiếu khớp với WebCrypto trên các vector chuẩn. Phải tự cài vì vòng dò nonce cần gọi hàm băm hàng chục nghìn lần mỗi giây theo kiểu đồng bộ, trong khi WebCrypto chỉ chạy bất đồng bộ.</p>',
          en: '<p><b>SHA-256</b> is the NIST FIPS 180-4 cryptographic hash function producing 256 bits — written as 64 hex characters. It is exactly what Bitcoin uses to seal blocks.</p>' +
              '<p>Briefly, how it runs: pad the input to a multiple of 512 bits, split into 512-bit chunks, then run each chunk through 64 mixing rounds of modulo-2³² addition, bit rotation and logic functions, continually stirring eight state registers. Concatenating those registers gives the digest.</p>' +
              '<p>Here SHA-256 is <b>hand-implemented in plain JavaScript</b> in <span class="mono">js/lib/sha256.js</span>, checked against WebCrypto on the standard vectors. It had to be hand-written because the nonce search calls it tens of thousands of times per second synchronously, while WebCrypto is async only.</p>' },
    next: ['hash', 'avalanche', 'pow', 'g-hashlab']
  },
  {
    id: 'avalanche', tag: 'concept', route: '#/',
    kw: { vi: 'thác đổ avalanche đổi một ký tự một bit lật nửa nhạy cảm thay đổi',
          en: 'avalanche effect one bit change half output flips sensitivity' },
    q:  { vi: 'Hiệu ứng thác đổ là gì?', en: 'What is the avalanche effect?' },
    a:  { vi: '<p>Thêm hay bớt <b>đúng một ký tự</b> ở đầu vào, chừng <b>một nửa số bit đầu ra</b> sẽ lật — và không có cách nào đoán trước bit nào lật.</p>' +
              '<p>Đây là tính chất khiến việc sửa trộm sổ sách lộ ra ngay lập tức: kẻ gian không thể "sửa nhè nhẹ" để dấu niêm phong chỉ lệch chút ít. Hoặc là đúng y nguyên, hoặc là khác hoàn toàn, không có vùng xám ở giữa.</p>' +
              '<p>Hãy tự kiểm: mở <b>Bàn thử hàm băm</b> ở trang Tổng quan, gõ một câu rồi thêm một dấu chấm vào cuối.</p>',
          en: '<p>Add or remove <b>a single character</b> from the input and roughly <b>half the output bits</b> flip — with no way to predict which ones.</p>' +
              '<p>This is what makes ledger tampering instantly visible: an attacker cannot nudge the data so the seal only shifts slightly. It is either identical or completely different, with no grey zone.</p>' +
              '<p>Check it yourself: open the <b>hash bench</b> on the Overview page, type a sentence, then add one full stop at the end.</p>' },
    next: ['hash', 'immutable', 'g-ledger-tamper']
  },
  {
    id: 'oneway', tag: 'concept',
    kw: { vi: 'một chiều one way không lần ngược giải mã hàm băm khác mã hoá encrypt',
          en: 'one way irreversible cannot decrypt hash versus encryption preimage' },
    q:  { vi: 'Băm có phải là mã hoá không?', en: 'Is hashing the same as encryption?' },
    a:  { vi: '<p><b>Không.</b> Mã hoá là con đường hai chiều: có khoá thì giải ra được bản gốc. Băm là đường một chiều, đi rồi không quay lại.</p>' +
              '<p>Từ một mã băm 256 bit, cách duy nhất để tìm lại dữ liệu gốc là <b>dò cạn kiệt</b>: thử từng đầu vào cho tới khi ra đúng mã ấy. Không gian cần dò là 2²⁵⁶ — lớn hơn số nguyên tử trong vũ trụ quan sát được.</p>' +
              '<p>Chính vì thế mã băm dùng để <b>đối chiếu</b> chứ không dùng để <b>cất giữ</b>: sổ cái không giấu nội dung khối, nó chỉ chứng minh nội dung ấy chưa bị đụng vào.</p>',
          en: '<p><b>No.</b> Encryption is a two-way street: with the key you recover the original. Hashing is one-way — once through, there is no way back.</p>' +
              '<p>Given a 256-bit digest, the only route back to the input is <b>brute force</b>: try inputs until one matches. The search space is 2²⁵⁶ — larger than the number of atoms in the observable universe.</p>' +
              '<p>That is why hashes are for <b>checking</b>, not for <b>storing</b>: a ledger does not hide block contents, it proves they have not been touched.</p>' },
    next: ['hash', 'collision', 'privkey']
  },
  {
    id: 'collision', tag: 'concept',
    kw: { vi: 'đụng độ collision trùng mã băm hai dữ liệu cùng hash sinh nhật',
          en: 'collision two inputs same hash birthday attack resistance' },
    q:  { vi: 'Hai dữ liệu khác nhau có thể trùng mã băm không?', en: 'Can two inputs share a hash?' },
    a:  { vi: '<p>Về lý thuyết <b>có</b> — đầu vào là vô hạn còn đầu ra chỉ có 2²⁵⁶ giá trị, nên theo nguyên lý chuồng bồ câu, đụng độ chắc chắn tồn tại.</p>' +
              '<p>Nhưng <b>tìm ra</b> một cặp đụng độ lại là chuyện khác. Theo nghịch lý ngày sinh, cần khoảng 2¹²⁸ phép thử. Nếu cả hành tinh gom máy lại băm liên tục từ vụ nổ Big Bang tới nay, xác suất tìm được vẫn gần bằng không.</p>' +
              '<p>Đó là lý do người ta nói SHA-256 <b>chống đụng độ trên thực tế</b>, dù không phải trên lý thuyết. Ngược lại, MD5 và SHA-1 đã bị tìm ra đụng độ thật nên không còn được dùng cho mục đích bảo mật.</p>',
          en: '<p>In theory <b>yes</b> — inputs are infinite while outputs number only 2²⁵⁶, so by the pigeonhole principle collisions must exist.</p>' +
              '<p>But <b>finding</b> one is another matter. By the birthday bound you need around 2¹²⁸ attempts. If the whole planet hashed non-stop since the Big Bang, the odds would still be effectively zero.</p>' +
              '<p>Hence SHA-256 is called <b>collision resistant in practice</b>, if not in theory. MD5 and SHA-1, by contrast, have had real collisions found and are retired from security use.</p>' },
    next: ['hash', 'sha256', 'oneway']
  },
  {
    id: 'linkedlist', tag: 'concept', route: '#/nodes',
    kw: { vi: 'danh sách liên kết mắt xích linked list node con trỏ next head tail cấu trúc dữ liệu',
          en: 'linked list node pointer next head tail data structure' },
    q:  { vi: 'Danh sách liên kết là gì?', en: 'What is a linked list?' },
    a:  { vi: '<p>Mỗi <b>mắt xích</b> giữ hai thứ: một mẩu dữ liệu, và <b>địa chỉ của mắt xích kế tiếp</b> (con trỏ <span class="mono">next</span>). Mắt cuối trỏ về <span class="mono">null</span>.</p>' +
              '<p>Khác mảng, các mắt xích <b>không cần nằm liền nhau trong bộ nhớ</b> — muốn chèn thêm chỉ việc đổi vài con trỏ, không phải dời cả dãy. Đổi lại, muốn lấy phần tử thứ i thì phải lần từ đầu, mất O(n).</p>' +
              '<p>Giữ sẵn con trỏ <b>tail</b> là mẹo đổi bộ nhớ lấy tốc độ: nhờ nó, nối vào đuôi chỉ tốn O(1) thay vì rà hết dây.</p>' +
              '<p>Đây chính là bộ xương mà sổ cái khối mượn lại — chỉ khác ở chỗ con trỏ <span class="mono">next</span> được thay bằng dấu niêm phong mật mã.</p>',
          en: '<p>Each <b>node</b> holds two things: a piece of data, and the <b>address of the next node</b> (the <span class="mono">next</span> pointer). The last node points at <span class="mono">null</span>.</p>' +
              '<p>Unlike an array, nodes <b>need not sit next to each other in memory</b> — inserting means rewiring a couple of pointers, not shifting the whole run. The trade-off: reaching element i means walking from the head, costing O(n).</p>' +
              '<p>Keeping a <b>tail</b> pointer trades memory for speed: with it, appending costs O(1) instead of scanning the whole chain.</p>' +
              '<p>This is exactly the skeleton the block ledger borrows — except the <span class="mono">next</span> pointer is replaced by a cryptographic seal.</p>' },
    next: ['list-vs-chain', 'blockchain', 'g-nodes']
  },
  {
    id: 'list-vs-chain', tag: 'concept', route: '#/nodes',
    kw: { vi: 'khác nhau so sánh danh sách liên kết và blockchain sổ cái khối phân biệt',
          en: 'difference compare linked list versus blockchain block ledger' },
    q:  { vi: 'Mắt xích và sổ cái khối khác nhau chỗ nào?', en: 'Linked list vs blockchain — what differs?' },
    a:  { vi: '<p>Cùng một bộ xương, khác nhau ở thứ dùng làm mắt nối:</p>' +
              '<ul><li><b>Danh sách liên kết</b> nối bằng <b>địa chỉ ô nhớ</b>. Địa chỉ không nói gì về nội dung, nên sửa dữ liệu ở giữa dây là chuyện O(1) và <b>không ai biết</b>.</li>' +
              '<li><b>Sổ cái khối</b> nối bằng <b>mã băm của khối trước</b>. Mã băm được tính TỪ nội dung, nên sửa nội dung là mắt nối gãy ngay và <b>ai kiểm cũng thấy</b>.</li></ul>' +
              '<p>Nói cách khác: danh sách liên kết cho ta <b>thứ tự</b>; hàm băm biến thứ tự đó thành <b>bằng chứng</b>. Bảng "Chi phí thao tác" ở trang Mắt xích đặt hai cột cạnh nhau để bạn tự đối chiếu.</p>',
          en: '<p>Same skeleton, different glue:</p>' +
              '<ul><li>A <b>linked list</b> links by <b>memory address</b>. An address says nothing about content, so editing data mid-chain is O(1) and <b>nobody notices</b>.</li>' +
              '<li>A <b>block ledger</b> links by the <b>previous block’s hash</b>. That hash is computed FROM the content, so editing content snaps the link and <b>every checker sees it</b>.</li></ul>' +
              '<p>Put differently: the linked list gives us <b>order</b>; hashing turns that order into <b>proof</b>. The "operation cost" table on the Nodes page puts both columns side by side.</p>' },
    next: ['linkedlist', 'immutable', 'prevhash']
  },
  {
    id: 'genesis', tag: 'concept', route: '#/ledger',
    kw: { vi: 'khối gốc genesis block đầu tiên khối số 0 previous hash rỗng',
          en: 'genesis block first block index zero empty previous hash' },
    q:  { vi: 'Khối gốc (genesis) là gì?', en: 'What is the genesis block?' },
    a:  { vi: '<p>Là khối <b>đầu tiên</b> của sổ cái, mang chỉ số 0. Nó đặc biệt ở chỗ <b>không có khối nào đứng trước</b>, nên trường <span class="mono">previous_hash</span> được gán một giá trị quy ước — thường là chuỗi rỗng hoặc 64 số 0.</p>' +
              '<p>Mọi khối sau đều truy ngược được về nó, nên khối gốc là <b>mỏ neo tin cậy</b> của cả chuỗi: hai nút mạng chỉ có thể so sánh sổ với nhau nếu cùng xuất phát từ một khối gốc.</p>' +
              '<p>Ở trang Trạm giao dịch, khối gốc còn kiêm thêm việc <b>cấp phát ban đầu</b> cho các ví — vai trò giống giao dịch coinbase trong khối Bitcoin đầu tiên.</p>',
          en: '<p>The <b>first</b> block of the ledger, index 0. It is special because <b>nothing precedes it</b>, so its <span class="mono">previous_hash</span> gets a conventional value — usually an empty string or 64 zeros.</p>' +
              '<p>Every later block traces back to it, making the genesis block the chain’s <b>anchor of trust</b>: two nodes can only compare ledgers if they start from the same genesis.</p>' +
              '<p>On the Transaction desk page the genesis block doubles as the <b>initial allocation</b> to the wallets — the role coinbase plays in Bitcoin’s first block.</p>' },
    next: ['block', 'prevhash', 'coinbase']
  },
  {
    id: 'prevhash', tag: 'concept', route: '#/ledger',
    kw: { vi: 'previous hash previous_hash mắt nối liên kết khối trước trỏ về đứt gãy',
          en: 'previous hash prev_hash link between blocks chaining broken' },
    q:  { vi: 'previous_hash để làm gì?', en: 'What is previous_hash for?' },
    a:  { vi: '<p>Nó là <b>sợi dây nối</b> khối này với khối liền trước — và cũng là thứ biến một đống khối rời rạc thành một <b>lịch sử có thứ tự</b>.</p>' +
              '<p>Vì <span class="mono">previous_hash</span> nằm trong nguyên liệu băm của khối hiện tại, mỗi khối vừa <b>chép lại</b> dấu niêm phong của khối trước, vừa <b>gói</b> dấu ấy vào dấu niêm phong của chính mình. Kết quả là hiệu ứng đô-mi-nô: sửa khối #3 thì hash khối #3 đổi, previous_hash ghi trong khối #4 không còn khớp, khối #5, #6… hỏng theo.</p>' +
              '<p>Muốn sửa thật thì phải <b>đào lại từ chỗ đó tới cuối sổ</b> — và trên mạng thật, phải chạy nhanh hơn cả phần còn lại của mạng.</p>',
          en: '<p>It is the <b>link</b> from this block to the one before — and what turns a pile of blocks into an ordered <b>history</b>.</p>' +
              '<p>Because <span class="mono">previous_hash</span> is part of the current block’s hashing input, each block both <b>copies</b> the previous seal and <b>wraps</b> it into its own. Hence the domino effect: edit block #3 and its hash changes, the previous_hash stored in #4 no longer matches, and #5, #6… fall too.</p>' +
              '<p>To make an edit stick you must <b>re-mine from there to the tip</b> — and on a real network, outrun everyone else while doing it.</p>' },
    next: ['immutable', 'pow', 'g-ledger-tamper']
  },
  {
    id: 'immutable', tag: 'concept', route: '#/ledger',
    kw: { vi: 'bất biến immutable không sửa được chống sửa toàn vẹn tại sao an toàn tamper',
          en: 'immutable tamper evident integrity why cannot be changed' },
    q:  { vi: 'Vì sao blockchain khó sửa?', en: 'Why is a blockchain hard to tamper with?' },
    a:  { vi: '<p>Ba tầng khoá chồng lên nhau:</p>' +
              '<ol><li><b>Dữ liệu dính chặt dấu niêm phong.</b> Nội dung khối là nguyên liệu đưa vào hàm băm, đụng vào nội dung là đổi hash, không có cách nào tránh.</li>' +
              '<li><b>Hỏng một khối là hỏng cả phần đuôi.</b> Khối sau chép lại hash khối trước, nên một chỗ sửa lan thành đô-mi-nô tới khối cuối cùng.</li>' +
              '<li><b>Bằng chứng công việc làm việc sửa trở nên đắt đỏ.</b> Mỗi khối phải dò lại nonce hợp lệ; sửa một khối cũ nghĩa là đào lại từ đó tới cuối, chi phí tăng theo cấp số nhân.</li></ol>' +
              '<p>Thêm tầng thứ tư trên mạng thật: các nút khác giữ bản sao riêng và <b>từ chối</b> bản sổ hỏng, nên sửa được máy mình cũng vô nghĩa.</p>' +
              '<p>Muốn thấy tận mắt, sang trang Sổ cái bấm <b>“Sửa trộm thử”</b>.</p>',
          en: '<p>Three locks stacked on each other:</p>' +
              '<ol><li><b>Data is welded to the seal.</b> Block content is the hashing input, so touching content changes the hash — unavoidably.</li>' +
              '<li><b>Break one block, break the tail.</b> Each block copies the previous hash, so one edit dominoes to the last block.</li>' +
              '<li><b>Proof of work makes editing expensive.</b> Every block needs a valid nonce; editing an old block means re-mining from there to the tip, at exponential cost.</li></ol>' +
              '<p>On a real network there is a fourth lock: other nodes hold their own copies and <b>reject</b> a broken ledger, so tampering with your own machine achieves nothing.</p>' +
              '<p>To watch it happen, go to the Ledger page and press <b>“Tamper”</b>.</p>' },
    next: ['prevhash', 'pow', 'g-ledger-tamper', 'attack51']
  },
  {
    id: 'nonce', tag: 'concept', route: '#/ledger',
    kw: { vi: 'nonce số dò con số thay đổi đào tìm là gì number once',
          en: 'nonce number used once counter mining search what is' },
    q:  { vi: 'Nonce là gì?', en: 'What is a nonce?' },
    a:  { vi: '<p><b>Nonce</b> (number used once) là con số duy nhất trong khối mà thợ đào <b>được phép đổi thoải mái</b>.</p>' +
              '<p>Nội dung giao dịch không đổi được, thời gian không đổi được, previous_hash không đổi được — nên muốn ra một mã băm khác, cách duy nhất là tăng nonce lên rồi băm lại. Cứ thế 0, 1, 2, 3… cho tới khi mã băm thoả điều kiện độ khó.</p>' +
              '<p>Vì hàm băm không đoán trước được, không có mẹo nào để "tính ra" nonce đúng — chỉ có dò. Chính công sức dò đó là thứ được gọi là <b>bằng chứng công việc</b>.</p>' +
              '<p>Khi độ khó bằng 0 thì nonce = 0 và công thức băm trùng khớp hoàn toàn với bản Python gốc của đồ án.</p>',
          en: '<p>The <b>nonce</b> (number used once) is the one field in a block a miner is <b>free to change at will</b>.</p>' +
              '<p>Transaction content is fixed, the timestamp is fixed, previous_hash is fixed — so the only way to get a different digest is to bump the nonce and hash again. 0, 1, 2, 3… until the digest meets the difficulty condition.</p>' +
              '<p>Since hash output is unpredictable there is no trick to “compute” the right nonce — only search. That search effort is precisely what <b>proof of work</b> means.</p>' +
              '<p>With difficulty 0 the nonce is 0 and the hashing formula matches the project’s original Python exactly.</p>' },
    next: ['pow', 'difficulty', 'mining']
  },
  {
    id: 'pow', tag: 'concept', route: '#/network',
    kw: { vi: 'bằng chứng công việc proof of work pow công sức chi phí đào tại sao cần',
          en: 'proof of work pow computational cost why needed' },
    q:  { vi: 'Bằng chứng công việc là gì?', en: 'What is proof of work?' },
    a:  { vi: '<p>Là luật buộc: <b>muốn ghi một khối vào sổ thì phải trả một khoản công sức tính toán có thật</b>, và khoản đó phải kiểm tra được trong tích tắc.</p>' +
              '<p>Cụ thể: thợ đào phải dò nonce sao cho mã băm khối bắt đầu bằng đủ số chữ số 0 mà mạng quy định. Dò thì tốn hàng triệu phép băm; nhưng người kiểm chỉ cần băm <b>một lần</b> để xác nhận. Bất đối xứng đó là toàn bộ ý tưởng.</p>' +
              '<p>Nó giải quyết hai việc cùng lúc:</p><ul>' +
              '<li><b>Chống spam</b> — không ai đẩy khối rác vào mạng miễn phí được.</li>' +
              '<li><b>Neo lịch sử</b> — muốn viết lại quá khứ thì phải trả lại toàn bộ công sức đã đổ vào phần đuôi, lại còn phải nhanh hơn cả mạng.</li></ul>',
          en: '<p>A rule that says: <b>to write a block you must burn real computation</b>, and that burn must be verifiable in an instant.</p>' +
              '<p>Concretely, a miner searches for a nonce making the block hash start with the required number of zeros. Searching costs millions of hashes; verifying costs <b>one</b>. That asymmetry is the whole idea.</p>' +
              '<p>It solves two problems at once:</p><ul>' +
              '<li><b>Spam resistance</b> — nobody pushes junk blocks for free.</li>' +
              '<li><b>Anchoring history</b> — rewriting the past means repaying all the work poured into the tail, faster than the whole network.</li></ul>' },
    next: ['nonce', 'difficulty', 'attack51', 'consensus']
  },
  {
    id: 'difficulty', tag: 'concept', route: '#/ledger',
    kw: { vi: 'độ khó difficulty số 0 dẫn đầu chỉnh tăng giảm bao lâu thanh trượt',
          en: 'difficulty leading zeros target adjust harder slider' },
    q:  { vi: 'Độ khó ảnh hưởng thế nào?', en: 'How does difficulty work?' },
    a:  { vi: '<p>Độ khó <b>k</b> nghĩa là mã băm khối phải bắt đầu bằng <b>k chữ số 0</b> ở dạng hex.</p>' +
              '<p>Mỗi ký tự hex có 16 giá trị, nên mỗi lần tăng độ khó thêm 1, số lần dò trung bình <b>nhân lên 16 lần</b>: k=1 cần khoảng 16 lần băm, k=2 cần 256, k=3 cần 4.096, k=4 cần 65.536…</p>' +
              '<p>Bitcoin dùng cơ chế tương tự nhưng mịn hơn (so sánh với một số đích thay vì đếm số 0), và <b>tự chỉnh lại độ khó sau mỗi 2016 khối</b> để giữ nhịp trung bình 10 phút một khối, bất kể tổng sức đào của mạng tăng hay giảm.</p>' +
              '<p>Ở trang Sổ cái, kéo thanh độ khó rồi bấm niêm phong để tự cảm nhận chi phí.</p>',
          en: '<p>Difficulty <b>k</b> means the block hash must begin with <b>k hex zeros</b>.</p>' +
              '<p>Each hex character has 16 values, so every extra step of difficulty multiplies the average search by <b>16</b>: k=1 needs about 16 hashes, k=2 needs 256, k=3 needs 4,096, k=4 needs 65,536…</p>' +
              '<p>Bitcoin uses a finer version of the same idea (comparing against a target number rather than counting zeros) and <b>retargets every 2016 blocks</b> to hold a ten-minute average, whatever the network hash rate does.</p>' +
              '<p>On the Ledger page, drag the difficulty slider and seal a block to feel the cost.</p>' },
    next: ['pow', 'nonce', 'mining']
  },
  {
    id: 'mining', tag: 'concept', route: '#/network',
    kw: { vi: 'đào mining thợ đào miner khai thác quá trình tìm nonce phần thưởng',
          en: 'mining miner process finding nonce reward' },
    q:  { vi: 'Đào khối là làm gì?', en: 'What does mining actually do?' },
    a:  { vi: '<p>"Đào" nghe như tìm vàng, thực ra là <b>quay số kiên trì</b>. Một vòng đào gồm:</p>' +
              '<ol><li>Gom giao dịch từ hàng chờ, dựng cây Merkle, lấy gốc Merkle.</li>' +
              '<li>Lắp header khối: previous_hash + gốc Merkle + thời điểm + nonce.</li>' +
              '<li>Băm header. Chưa đủ số 0 dẫn đầu ⇒ tăng nonce, băm lại.</li>' +
              '<li>Trúng ⇒ phát khối cho cả mạng để các nút thẩm định và bỏ phiếu.</li></ol>' +
              '<p>Người trúng được <b>thưởng khối</b> (giao dịch coinbase) cộng phí giao dịch — đó là động lực kinh tế để họ bỏ tiền điện ra bảo vệ mạng.</p>' +
              '<p>Ở trang Mạng lưới, bấm <b>“Đào — tìm nonce”</b> để xem tốc độ băm và nonce chạy thật.</p>',
          en: '<p>“Mining” sounds like digging for gold; it is really <b>patient dice-rolling</b>. One round:</p>' +
              '<ol><li>Pull transactions from the mempool, build the Merkle tree, take the root.</li>' +
              '<li>Assemble the header: previous_hash + Merkle root + timestamp + nonce.</li>' +
              '<li>Hash the header. Not enough leading zeros? Bump the nonce, hash again.</li>' +
              '<li>A hit? Broadcast the block so nodes can validate and vote.</li></ol>' +
              '<p>The winner takes the <b>block reward</b> (the coinbase transaction) plus fees — the economic reason anyone spends electricity defending the network.</p>' +
              '<p>On the Network page press <b>“Mine — find nonce”</b> to watch the real hash rate and nonce climb.</p>' },
    next: ['pow', 'coinbase', 'consensus', 'g-network']
  },
  {
    id: 'merkle', tag: 'concept', route: '#/network',
    kw: { vi: 'cây merkle merkle tree băm từng cặp lá tầng dựng cây',
          en: 'merkle tree hash pairs leaves levels build' },
    q:  { vi: 'Cây Merkle là gì?', en: 'What is a Merkle tree?' },
    a:  { vi: '<p>Là cách gói <b>cả một tập giao dịch</b> vào đúng <b>một mã băm 256 bit</b>.</p>' +
              '<p>Cách dựng: lấy txid của từng giao dịch làm <b>lá</b>. Băm từng cặp lá kề nhau để ra tầng trên: <span class="mono">H(trái + phải)</span>. Lặp lại cho tới khi còn đúng một nút — đó là <b>gốc Merkle</b>. Nếu một tầng có số phần tử lẻ thì phần tử cuối được nhân đôi cho đủ cặp, đúng quy ước Bitcoin.</p>' +
              '<p>Hệ quả: đổi một ký tự trong bất kỳ phiếu nào ⇒ lá của nó đổi ⇒ mọi nút cha trên đường lên đổi ⇒ gốc Merkle đổi ⇒ mã băm khối đổi ⇒ mắt xích gãy.</p>',
          en: '<p>A way to pack <b>an entire transaction set</b> into exactly <b>one 256-bit hash</b>.</p>' +
              '<p>How it is built: each transaction’s txid becomes a <b>leaf</b>. Hash adjacent pairs to form the level above: <span class="mono">H(left + right)</span>. Repeat until one node remains — the <b>Merkle root</b>. If a level has an odd count the last element is duplicated to complete the pair, per Bitcoin’s convention.</p>' +
              '<p>Consequence: change one character in any transaction ⇒ its leaf changes ⇒ every parent up the path changes ⇒ the Merkle root changes ⇒ the block hash changes ⇒ the chain snaps.</p>' },
    next: ['merkleroot', 'block', 'g-network']
  },
  {
    id: 'merkleroot', tag: 'concept', route: '#/network',
    kw: { vi: 'gốc merkle root spv ví nhẹ chứng minh đường proof log2 tại sao cần',
          en: 'merkle root spv light wallet proof path why useful' },
    q:  { vi: 'Gốc Merkle dùng để làm gì?', en: 'Why does the Merkle root matter?' },
    a:  { vi: '<p>Header khối chỉ mang <b>đúng một mã băm 256 bit</b>, nhưng nhờ cây Merkle, mã băm ấy ràng buộc toàn bộ giao dịch bên trong. Header vì thế luôn nhỏ gọn dù khối chứa hàng nghìn phiếu.</p>' +
              '<p>Lợi ích lớn nhất là <b>chứng minh gọn nhẹ (SPV)</b>: muốn chứng minh "phiếu của tôi nằm trong khối này", bạn không cần tải cả khối — chỉ cần khoảng <b>log₂(n)</b> mã băm dọc đường từ lá lên gốc. Khối 1024 giao dịch chỉ tốn 10 mã băm thay vì cả megabyte.</p>' +
              '<p>Đó là cách ví trên điện thoại kiểm được giao dịch của mình mà không phải chứa cả blockchain.</p>',
          en: '<p>A block header carries <b>just one 256-bit hash</b>, yet through the Merkle tree that hash binds every transaction inside. The header stays tiny even when the block holds thousands of entries.</p>' +
              '<p>The big win is <b>compact proofs (SPV)</b>: to show “my transaction is in this block” you need not download the block — only about <b>log₂(n)</b> hashes along the path from leaf to root. A 1024-transaction block costs 10 hashes instead of a megabyte.</p>' +
              '<p>That is how a phone wallet verifies its own payments without storing the whole chain.</p>' },
    next: ['merkle', 'node', 'g-network']
  },
  {
    id: 'ecdsa', tag: 'concept', route: '#/desk',
    kw: { vi: 'ecdsa chữ ký số elliptic curve đường cong elliptic thuật toán ký',
          en: 'ecdsa elliptic curve digital signature algorithm' },
    q:  { vi: 'ECDSA là gì?', en: 'What is ECDSA?' },
    a:  { vi: '<p><b>ECDSA</b> — Elliptic Curve Digital Signature Algorithm — là thuật toán ký số dựa trên số học điểm trên đường cong elliptic.</p>' +
              '<p>Ký một phiếu, tóm tắt gọn:</p>' +
              '<ol><li>Băm nội dung phiếu ra tóm tắt <span class="mono">z</span>.</li>' +
              '<li>Bốc ngẫu nhiên số <span class="mono">k</span> dùng đúng một lần, tính điểm <span class="mono">R = k·G</span>, lấy <span class="mono">r = R.x mod n</span>.</li>' +
              '<li>Tính <span class="mono">s = k⁻¹(z + r·d) mod n</span>, với <span class="mono">d</span> là khoá riêng.</li>' +
              '<li>Chữ ký là cặp số <b>(r, s)</b>.</li></ol>' +
              '<p>Điểm hay: khoá riêng <b>không bao giờ rời khỏi ví</b>. Thứ gửi đi chỉ là cặp (r, s), mà cặp ấy lại gắn chặt với đúng một nội dung.</p>' +
              '<p>Trong đồ án, ECDSA được cài thẳng bằng BigInt ở <span class="mono">js/core/ecdsa.js</span> để nhìn rõ từng phép toán.</p>',
          en: '<p><b>ECDSA</b> — Elliptic Curve Digital Signature Algorithm — signs using point arithmetic on an elliptic curve.</p>' +
              '<p>Signing, in short:</p>' +
              '<ol><li>Hash the payload into a digest <span class="mono">z</span>.</li>' +
              '<li>Draw a one-time random <span class="mono">k</span>, compute <span class="mono">R = k·G</span>, take <span class="mono">r = R.x mod n</span>.</li>' +
              '<li>Compute <span class="mono">s = k⁻¹(z + r·d) mod n</span>, where <span class="mono">d</span> is the private key.</li>' +
              '<li>The signature is the pair <b>(r, s)</b>.</li></ol>' +
              '<p>The elegance: the private key <b>never leaves the wallet</b>. Only (r, s) travels — and it is welded to one exact payload.</p>' +
              '<p>Here ECDSA is written directly with BigInt in <span class="mono">js/core/ecdsa.js</span> so every operation stays visible.</p>' },
    next: ['secp256k1', 'signature', 'verify', 'g-desk']
  },
  {
    id: 'secp256k1', tag: 'concept', route: '#/desk',
    kw: { vi: 'secp256k1 đường cong elliptic curve bitcoin tham số điểm G bậc n',
          en: 'secp256k1 curve parameters generator point order bitcoin' },
    q:  { vi: 'secp256k1 là đường cong gì?', en: 'What is the secp256k1 curve?' },
    a:  { vi: '<p>Là đường cong elliptic <span class="mono">y² = x³ + 7</span> tính trên trường hữu hạn modulo một số nguyên tố 256 bit. Bitcoin và Ethereum đều dùng nó.</p>' +
              '<p>Đường cong có một <b>điểm sinh G</b> cố định. Nhân G với một số nguyên là phép tính nhanh; nhưng từ kết quả lần ngược ra số nhân đó — <b>bài toán logarit rời rạc</b> — thì bất khả thi. Toàn bộ độ an toàn nằm ở sự lệch pha này.</p>' +
              '<p>Lưu ý kỹ thuật đáng nhớ: Web Crypto của trình duyệt <b>chỉ có các đường cong NIST</b> (P-256, P-384…), không có secp256k1 — nên đồ án phải tự cài số học điểm bằng BigInt.</p>',
          en: '<p>The elliptic curve <span class="mono">y² = x³ + 7</span> over a finite field modulo a 256-bit prime. Both Bitcoin and Ethereum use it.</p>' +
              '<p>The curve has a fixed <b>generator point G</b>. Multiplying G by an integer is fast; recovering that integer from the result — the <b>discrete logarithm problem</b> — is infeasible. All the security lives in that gap.</p>' +
              '<p>A worthwhile technical note: browser Web Crypto ships <b>only NIST curves</b> (P-256, P-384…), not secp256k1 — which is why this project implements point arithmetic in BigInt itself.</p>' },
    next: ['ecdsa', 'privkey', 'pubkey']
  },
  {
    id: 'privkey', tag: 'concept', route: '#/desk',
    kw: { vi: 'khoá riêng khóa bí mật private key d 256 bit giữ bí mật mất khoá',
          en: 'private key secret key 256 bit keep safe lost' },
    q:  { vi: 'Khoá riêng là gì?', en: 'What is a private key?' },
    a:  { vi: '<p>Chỉ là <b>một con số 256 bit bốc ngẫu nhiên</b> — không hơn. Nhưng ai giữ con số đó thì người ấy <b>tiêu được tiền trong ví</b>.</p>' +
              '<p>Khoá riêng <b>chính là quyền sở hữu</b>, không phải mật khẩu đăng nhập. Không có máy chủ nào giữ bản sao, nên cũng không có nút "quên mật khẩu": <b>mất là mất hẳn</b>, lộ là mất sạch.</p>' +
              '<p>Ở trang Trạm giao dịch, khoá riêng mặc định bị che, bấm <b>“Hiện”</b> mới xem được — cố ý dựng vậy để nhắc thói quen đúng. Dĩ nhiên đây là ví mô phỏng, không giữ tài sản thật.</p>',
          en: '<p>Just <b>a randomly drawn 256-bit number</b> — nothing more. But whoever holds it can <b>spend the wallet</b>.</p>' +
              '<p>A private key <b>is ownership</b>, not a login password. No server keeps a copy, so there is no “forgot password”: <b>lose it and it is gone</b>, leak it and the funds are gone.</p>' +
              '<p>On the Transaction desk the private key is masked by default; press <b>“Show”</b> to reveal it — deliberately built that way to reinforce the habit. These are simulated wallets, of course, holding nothing real.</p>' },
    next: ['pubkey', 'address', 'signature', 'nonce-k']
  },
  {
    id: 'pubkey', tag: 'concept', route: '#/desk',
    kw: { vi: 'khoá công khai public key danh tính chia sẻ được sinh ra từ khoá riêng',
          en: 'public key identity shareable derived from private key' },
    q:  { vi: 'Khoá công khai từ đâu ra?', en: 'Where does the public key come from?' },
    a:  { vi: '<p>Khoá công khai là điểm <span class="mono">Q = d·G</span> trên đường cong secp256k1: lấy điểm sinh <b>G</b> nhân với khoá riêng <b>d</b>.</p>' +
              '<p><b>Suy xuôi thì dễ</b> — máy tính nhân điểm trong tích tắc. <b>Lần ngược thì bất khả thi</b> — biết Q và G vẫn không tìm ra d. Nhờ vậy bạn công bố Q thoải mái mà vẫn an toàn.</p>' +
              '<p>Vai trò của nó là <b>danh tính</b>: cả mạng dùng Q để kiểm chữ ký của bạn. Ở dạng chưa nén, Q được viết là <span class="mono">04 + X + Y</span> — byte 04 báo hiệu "đây là dạng đầy đủ", theo sau là hai toạ độ.</p>',
          en: '<p>The public key is the point <span class="mono">Q = d·G</span> on secp256k1: the generator <b>G</b> multiplied by the private key <b>d</b>.</p>' +
              '<p><b>Forward is easy</b> — a computer multiplies points instantly. <b>Backward is infeasible</b> — knowing Q and G does not yield d. So you can publish Q freely.</p>' +
              '<p>Its role is <b>identity</b>: the network uses Q to check your signatures. Uncompressed, Q is written <span class="mono">04 + X + Y</span> — the 04 byte flags “full form”, followed by both coordinates.</p>' },
    next: ['privkey', 'address', 'verify']
  },
  {
    id: 'address', tag: 'concept', route: '#/desk',
    kw: { vi: 'địa chỉ ví address wallet 40 ký tự hex sinh ra từ đâu tài khoản',
          en: 'wallet address derive from public key account' },
    q:  { vi: 'Địa chỉ ví sinh ra thế nào?', en: 'How is a wallet address derived?' },
    a:  { vi: '<p>Trong xưởng này, địa chỉ ví là <b>40 ký tự hex cuối của SHA-256(khoá công khai)</b>.</p>' +
              '<p>Vì sao phải băm chứ không dùng thẳng khoá công khai? Ba lý do: <b>ngắn gọn</b> hơn nhiều nên dễ chép tay; <b>che bớt</b> khoá công khai cho tới lúc bạn thực sự tiêu tiền; và thêm một lớp <b>dự phòng</b> nếu ngày nào đó đường cong elliptic bị suy yếu.</p>' +
              '<p>Bitcoin làm kỹ hơn: băm SHA-256 rồi RIPEMD-160, thêm byte phiên bản và bốn byte checksum, cuối cùng mã Base58Check hoặc Bech32 để tránh nhầm ký tự khi chép tay.</p>',
          en: '<p>Here the wallet address is the <b>last 40 hex characters of SHA-256(public key)</b>.</p>' +
              '<p>Why hash rather than use the public key directly? Three reasons: it is far <b>shorter</b> to copy; it <b>conceals</b> the public key until you actually spend; and it adds a <b>fallback layer</b> should elliptic curves ever weaken.</p>' +
              '<p>Bitcoin goes further: SHA-256 then RIPEMD-160, plus a version byte and four checksum bytes, finally Base58Check or Bech32 encoding to prevent transcription mistakes.</p>' },
    next: ['pubkey', 'tx', 'g-desk']
  },
  {
    id: 'signature', tag: 'concept', route: '#/desk',
    kw: { vi: 'chữ ký số ký signature der ký phiếu chứng minh quyền sở hữu',
          en: 'digital signature sign der prove ownership' },
    q:  { vi: 'Chữ ký số chứng minh được điều gì?', en: 'What does a signature prove?' },
    a:  { vi: '<p>Một chữ ký hợp lệ chứng minh <b>hai điều cùng lúc</b>:</p>' +
              '<ul><li><b>Đúng người</b> — người ký nắm giữ khoá riêng ứng với khoá công khai này.</li>' +
              '<li><b>Đúng nội dung</b> — phiếu chưa bị sửa một ký tự nào kể từ lúc ký.</li></ul>' +
              '<p>Điều nó <b>không</b> chứng minh: người ký là ai ngoài đời, và phiếu có đủ tiền hay không. Hai việc ấy do tầng khác lo — danh tính do luật pháp, số dư do nút mạng tính lại từ lịch sử sổ cái.</p>' +
              '<p>Chữ ký là <b>bằng chứng, không phải mật khẩu</b>: nó không bí mật, ai cũng đọc được, nhưng không ai giả được nếu không có khoá riêng.</p>',
          en: '<p>A valid signature proves <b>two things at once</b>:</p>' +
              '<ul><li><b>The right signer</b> — they hold the private key matching this public key.</li>' +
              '<li><b>The right content</b> — not one character of the payload changed since signing.</li></ul>' +
              '<p>What it does <b>not</b> prove: who the signer is in real life, or whether the payment is funded. Other layers handle those — identity by law, balances by nodes recomputing from ledger history.</p>' +
              '<p>A signature is <b>evidence, not a password</b>: it is public and readable by anyone, yet unforgeable without the private key.</p>' },
    next: ['verify', 'ecdsa', 'g-desk-verify']
  },
  {
    id: 'verify', tag: 'concept', route: '#/desk',
    kw: { vi: 'xác minh kiểm chữ ký verify công thức chấp nhận từ chối kiểm chứng',
          en: 'verify signature check formula accept reject validation' },
    q:  { vi: 'Xác minh chữ ký hoạt động ra sao?', en: 'How is a signature verified?' },
    a:  { vi: '<p>Người kiểm chỉ cần ba thứ: <b>nội dung phiếu</b>, <b>chữ ký (r, s)</b> và <b>khoá công khai Q</b>. Không cần khoá riêng.</p>' +
              '<p>Phép kiểm: <span class="mono">w = s⁻¹ mod n</span> · <span class="mono">u₁ = z·w</span> · <span class="mono">u₂ = r·w</span> · <span class="mono">(x, y) = u₁·G + u₂·Q</span>, rồi <b>chấp nhận nếu x mod n = r</b>.</p>' +
              '<p>Ý nghĩa hình học: nếu chữ ký thật, phép tính trên khôi phục lại đúng điểm R mà người ký đã dùng. Sai một chi tiết — sửa nội dung nên z đổi, hay đem nhầm khoá công khai — thì kết quả rơi vào một điểm hoàn toàn khác trên đường cong, và không bao giờ về đúng chỗ.</p>' +
              '<p>Trang Trạm giao dịch có hẳn <b>Phòng kiểm chứng chữ ký</b> bày sẵn ba tình huống để bạn so.</p>',
          en: '<p>A verifier needs three things: the <b>payload</b>, the <b>signature (r, s)</b> and the <b>public key Q</b>. No private key involved.</p>' +
              '<p>The check: <span class="mono">w = s⁻¹ mod n</span> · <span class="mono">u₁ = z·w</span> · <span class="mono">u₂ = r·w</span> · <span class="mono">(x, y) = u₁·G + u₂·Q</span>, then <b>accept if x mod n = r</b>.</p>' +
              '<p>Geometrically: if the signature is genuine, this recovers the very point R the signer used. Change one detail — edit the payload so z shifts, or bring the wrong public key — and the result lands somewhere else entirely on the curve, never back on target.</p>' +
              '<p>The Transaction desk has a dedicated <b>signature lab</b> laying out three cases side by side.</p>' },
    next: ['signature', 'ecdsa', 'g-desk-verify']
  },
  {
    id: 'nonce-k', tag: 'concept', route: '#/desk',
    kw: { vi: 'số ngẫu nhiên k dùng một lần lặp lại lộ khoá playstation sony rfc 6979',
          en: 'random k reuse leaks private key playstation sony rfc 6979' },
    q:  { vi: 'Vì sao số k phải dùng đúng một lần?', en: 'Why must k be used only once?' },
    a:  { vi: '<p>Vì <b>lặp k là lộ khoá riêng</b> — không phải "yếu đi", mà lộ hẳn, tính ra bằng vài dòng đại số.</p>' +
              '<p>Ký hai phiếu khác nhau với cùng một k, ta có hai phương trình <span class="mono">s₁ = k⁻¹(z₁ + r·d)</span> và <span class="mono">s₂ = k⁻¹(z₂ + r·d)</span> chung r. Trừ nhau khử được d, rút ra <span class="mono">k = (z₁ − z₂)/(s₁ − s₂)</span>, có k rồi thì thay ngược lại là ra <b>d</b>.</p>' +
              '<p>Đây đúng là sai lầm khiến máy <b>PlayStation 3 bị bẻ khoá năm 2010</b>: Sony dùng một hằng số cố định thay cho k ngẫu nhiên. Ngày nay các thư viện dùng <b>RFC 6979</b> — sinh k một cách tất định từ khoá riêng và nội dung phiếu, khỏi phụ thuộc nguồn ngẫu nhiên của máy.</p>',
          en: '<p>Because <b>reusing k leaks the private key</b> — not “weakens” it, leaks it outright, recoverable in a few lines of algebra.</p>' +
              '<p>Sign two different payloads with the same k and you get <span class="mono">s₁ = k⁻¹(z₁ + r·d)</span> and <span class="mono">s₂ = k⁻¹(z₂ + r·d)</span> sharing r. Subtracting cancels d, giving <span class="mono">k = (z₁ − z₂)/(s₁ − s₂)</span>; with k in hand, substitute back for <b>d</b>.</p>' +
              '<p>This is precisely the mistake that <b>broke the PlayStation 3 in 2010</b>: Sony used a fixed constant instead of a random k. Modern libraries use <b>RFC 6979</b> — deriving k deterministically from the private key and the message, removing reliance on the machine’s randomness.</p>' },
    next: ['ecdsa', 'privkey', 'signature']
  },
  {
    id: 'tx', tag: 'concept', route: '#/desk',
    kw: { vi: 'giao dịch transaction phiếu chuyển tiền gồm gì vòng đời',
          en: 'transaction payment fields lifecycle contains' },
    q:  { vi: 'Một giao dịch gồm những gì?', en: 'What makes up a transaction?' },
    a:  { vi: '<p>Trong xưởng này một phiếu mang: <b>bên chuyển</b>, <b>bên nhận</b>, <b>số tiền</b>, <b>lời nhắn</b>, <b>thời điểm</b>, kèm <b>khoá công khai</b> và <b>chữ ký</b> của bên chuyển.</p>' +
              '<p>Vòng đời trọn vẹn, đúng như trên mạng thật:</p>' +
              '<ol><li><b>Mở ví</b> — sinh cặp khoá secp256k1.</li>' +
              '<li><b>Lập phiếu</b> — điền nội dung, hệ thống dựng chuỗi nguyên liệu.</li>' +
              '<li><b>Ký</b> bằng khoá riêng.</li>' +
              '<li><b>Đẩy vào hàng chờ</b> (mempool) để phát tán.</li>' +
              '<li><b>Nút mạng kiểm</b> chữ ký và số dư.</li>' +
              '<li><b>Đóng thành khối</b> nối vào sổ cái.</li></ol>',
          en: '<p>Here a transaction carries: <b>sender</b>, <b>recipient</b>, <b>amount</b>, <b>memo</b>, <b>timestamp</b>, plus the sender’s <b>public key</b> and <b>signature</b>.</p>' +
              '<p>Its full lifecycle, as on a real network:</p>' +
              '<ol><li><b>Open a wallet</b> — generate a secp256k1 key pair.</li>' +
              '<li><b>Draft</b> — fill the fields; the system assembles the payload string.</li>' +
              '<li><b>Sign</b> with the private key.</li>' +
              '<li><b>Push to the mempool</b> for broadcast.</li>' +
              '<li><b>Nodes validate</b> signature and balance.</li>' +
              '<li><b>Pack into a block</b> appended to the ledger.</li></ol>' },
    next: ['txid', 'mempool', 'balance', 'g-desk']
  },
  {
    id: 'txid', tag: 'concept', route: '#/network',
    kw: { vi: 'txid mã giao dịch id băm phiếu định danh',
          en: 'txid transaction id hash identifier' },
    q:  { vi: 'txid là gì?', en: 'What is a txid?' },
    a:  { vi: '<p><b>txid</b> là mã băm của chính nội dung giao dịch — vừa là <b>tên gọi</b> của phiếu, vừa là <b>dấu niêm phong</b> của nó.</p>' +
              '<p>Vì txid sinh ra từ nội dung, sửa bất cứ trường nào là txid đổi. Nút mạng luôn <b>băm lại phiếu và so với txid ghi kèm</b>; lệch là loại ngay, chưa cần đụng tới chữ ký.</p>' +
              '<p>txid cũng chính là <b>lá của cây Merkle</b>, nên một phiếu bị sửa sẽ kéo theo gốc Merkle đổi và mã băm khối đổi.</p>',
          en: '<p>A <b>txid</b> is the hash of the transaction’s own content — both its <b>name</b> and its <b>seal</b>.</p>' +
              '<p>Since the txid derives from content, editing any field changes it. Nodes always <b>re-hash the transaction and compare against the stated txid</b>; a mismatch is rejected before the signature is even examined.</p>' +
              '<p>The txid is also the <b>Merkle leaf</b>, so a tampered transaction drags the Merkle root and the block hash along with it.</p>' },
    next: ['merkle', 'tx', 'g-network']
  },
  {
    id: 'mempool', tag: 'concept', route: '#/desk',
    kw: { vi: 'hàng chờ mempool phiếu chờ chưa xác nhận pending đóng khối',
          en: 'mempool pending queue unconfirmed transactions' },
    q:  { vi: 'Hàng chờ (mempool) là gì?', en: 'What is the mempool?' },
    a:  { vi: '<p>Là <b>phòng chờ</b> của các giao dịch đã ký và đã phát tán, nhưng <b>chưa được đóng vào khối nào</b> — tức chưa có xác nhận.</p>' +
              '<p>Mỗi nút giữ một mempool riêng, tự lọc bỏ phiếu sai chữ ký hoặc quá số dư. Thợ đào bốc từ đây để lắp khối; trên mạng thật họ thường <b>ưu tiên phiếu trả phí cao</b>, nên phí giao dịch quyết định bạn chờ nhanh hay chậm.</p>' +
              '<p>Ở trang Trạm giao dịch và trang Mạng lưới, hàng chờ hiện ngay dưới bảng ký, có nút <b>“Đóng khối”</b> để gom vào khối. Phiếu nào không qua vòng kiểm sẽ bị trả lại hàng chờ.</p>',
          en: '<p>The <b>waiting room</b> for transactions that are signed and broadcast but <b>not yet in any block</b> — unconfirmed.</p>' +
              '<p>Every node keeps its own mempool, discarding entries with bad signatures or insufficient funds. Miners draw from it to assemble blocks; on real networks they <b>favour higher fees</b>, so the fee decides how long you wait.</p>' +
              '<p>On the Transaction desk and Network pages the queue sits under the signing panel with a <b>“Pack block”</b> button. Entries failing validation are returned to the queue.</p>' },
    next: ['tx', 'mining', 'g-desk']
  },
  {
    id: 'coinbase', tag: 'concept', route: '#/network',
    kw: { vi: 'coinbase thưởng khối phần thưởng tiền mới phát hành thợ đào nhận halving',
          en: 'coinbase block reward newly minted coins miner receives halving' },
    q:  { vi: 'Thưởng khối / coinbase là gì?', en: 'What is the coinbase reward?' },
    a:  { vi: '<p>Là giao dịch <b>đặc biệt đứng đầu mỗi khối</b>, không có bên chuyển: nó tạo ra tiền mới và trao cho nút đào được khối đó.</p>' +
              '<p>Coinbase làm hai việc: <b>phát hành</b> đồng tiền theo lịch định sẵn, và <b>trả công</b> cho thợ đào đã bỏ điện ra bảo vệ mạng. Ở Bitcoin, phần thưởng này giảm một nửa sau mỗi 210.000 khối — sự kiện quen gọi là "halving".</p>' +
              '<p>Ở trang Mạng lưới, mỗi khối được đóng đều kèm một dòng <span class="mono">COINBASE → nút đề xuất</span>. Còn ở trang Trạm giao dịch, khối gốc đóng vai trò tương tự khi cấp vốn ban đầu cho các ví.</p>',
          en: '<p>A <b>special transaction at the head of every block</b> with no sender: it mints new coins and awards them to the node that mined the block.</p>' +
              '<p>Coinbase does two jobs: <b>issuance</b> on a fixed schedule, and <b>payment</b> to miners spending electricity to defend the network. In Bitcoin the reward halves every 210,000 blocks — the familiar “halloing” event.</p>' +
              '<p>On the Network page every sealed block carries a <span class="mono">COINBASE → proposer</span> line. On the Transaction desk the genesis block plays the same role, funding the wallets initially.</p>' },
    next: ['mining', 'genesis', 'balance']
  },
  {
    id: 'node', tag: 'concept', route: '#/network',
    kw: { vi: 'nút mạng node peer ngang hàng p2p bản sao sổ cái vai trò',
          en: 'node peer p2p network copy of ledger role' },
    q:  { vi: 'Nút mạng làm những việc gì?', en: 'What does a node do?' },
    a:  { vi: '<p>Mỗi <b>nút</b> là một máy giữ <b>bản sao sổ cái của riêng mình</b> và không tin lời ai cả. Công việc của nó:</p>' +
              '<ul><li><b>Nhận</b> giao dịch và khối từ các nút khác.</li>' +
              '<li><b>Thẩm định</b> — băm lại header, dựng lại cây Merkle, kiểm từng chữ ký, tính lại số dư trên bản sao của chính mình.</li>' +
              '<li><b>Bỏ phiếu</b> thuận hoặc chống với khối vừa nhận.</li>' +
              '<li><b>Phát tán</b> tiếp cho hàng xóm.</li>' +
              '<li><b>Đồng bộ</b> — nếu thấy chuỗi hợp lệ dài hơn thì chép lại theo.</li></ul>' +
              '<p>Không có máy chủ trung tâm nào ra lệnh. Trang Mạng lưới dựng bốn nút — Lâm Viên, Xuân Hương, Cam Ly, Prenn — mỗi nút có sức đào và bản sao riêng.</p>',
          en: '<p>Each <b>node</b> is a machine holding <b>its own copy of the ledger</b> and trusting nobody. Its duties:</p>' +
              '<ul><li><b>Receive</b> transactions and blocks from peers.</li>' +
              '<li><b>Validate</b> — re-hash the header, rebuild the Merkle tree, check every signature, recompute balances against its own copy.</li>' +
              '<li><b>Vote</b> for or against the incoming block.</li>' +
              '<li><b>Relay</b> onward to neighbours.</li>' +
              '<li><b>Sync</b> — adopt any longer valid chain it sees.</li></ul>' +
              '<p>No central server issues orders. The Network page runs four nodes — Lâm Viên, Xuân Hương, Cam Ly, Prenn — each with its own hash power and ledger copy.</p>' },
    next: ['consensus', 'fork', 'g-network']
  },
  {
    id: 'consensus', tag: 'concept', route: '#/network',
    kw: { vi: 'đồng thuận consensus bỏ phiếu quá bán thống nhất cả mạng công nhận',
          en: 'consensus voting majority quorum agreement network accepts' },
    q:  { vi: 'Đồng thuận hoạt động thế nào?', en: 'How does consensus work?' },
    a:  { vi: '<p><b>Đồng thuận là phép đếm, không phải lời hứa.</b> Không nút nào tin lời nút khác.</p>' +
              '<p>Nhận được một khối, mỗi nút tự kiểm năm điều trên bản sao của chính mình:</p>' +
              '<ol><li><span class="mono">previous_hash</span> có khớp đỉnh chuỗi của nó không.</li>' +
              '<li>Gốc Merkle dựng lại từ danh sách txid có khớp header không.</li>' +
              '<li>Băm lại header có ra đúng mã băm khối không.</li>' +
              '<li>Có đủ bằng chứng công việc (đủ số 0 dẫn đầu) không.</li>' +
              '<li>Mọi giao dịch bên trong có hợp lệ không — txid, chữ ký, quyền sở hữu, số dư.</li></ol>' +
              '<p>Qua hết thì bỏ phiếu thuận. Khối chỉ được ghi vào sổ khi <b>số phiếu thuận đạt quá bán</b>.</p>',
          en: '<p><b>Consensus is arithmetic, not a promise.</b> No node takes another’s word.</p>' +
              '<p>On receiving a block, each node checks five things against its own copy:</p>' +
              '<ol><li>Does <span class="mono">previous_hash</span> match its chain tip?</li>' +
              '<li>Does the Merkle root rebuilt from the txid list match the header?</li>' +
              '<li>Does re-hashing the header reproduce the stated block hash?</li>' +
              '<li>Is there enough proof of work (leading zeros)?</li>' +
              '<li>Is every contained transaction valid — txid, signature, ownership, funds?</li></ol>' +
              '<p>All clear, it votes yes. The block enters the ledger only when the <b>yes votes pass the majority threshold</b>.</p>' },
    next: ['node', 'longest', 'fork', 'g-network']
  },
  {
    id: 'longest', tag: 'concept', route: '#/network',
    kw: { vi: 'chuỗi dài nhất longest chain quy tắc chọn nhánh thắng nhiều công sức nhất',
          en: 'longest chain rule heaviest most work wins' },
    q:  { vi: 'Vì sao chọn chuỗi dài nhất?', en: 'Why does the longest chain win?' },
    a:  { vi: '<p>Vì <b>chuỗi dài nhất là chuỗi đã tiêu tốn nhiều công sức nhất</b> — và công sức thì không giả được.</p>' +
              '<p>Nói cho chuẩn, Bitcoin chọn chuỗi <b>nặng nhất</b> (tổng độ khó tích luỹ lớn nhất), không đơn thuần là đếm số khối. Cùng ý tưởng: nhánh nào được đa số sức đào của mạng ủng hộ thì nhánh đó thắng.</p>' +
              '<p>Quy tắc này biến việc chọn nhánh thành một phép <b>đo lường khách quan</b> mà mọi nút tự tính ra được, khỏi cần bỏ phiếu theo danh tính — vốn là thứ giả mạo dễ dàng trên Internet.</p>' +
              '<p>Ở trang Mạng lưới, bảng "Tra cứu sổ cái" luôn hiển thị chuỗi hợp lệ dài nhất của mạng.</p>',
          en: '<p>Because <b>the longest chain is the one that burned the most work</b> — and work cannot be faked.</p>' +
              '<p>Strictly, Bitcoin picks the <b>heaviest</b> chain (greatest cumulative difficulty), not simply the most blocks. Same idea: whichever branch the majority of hash power backs, wins.</p>' +
              '<p>The rule turns branch selection into an <b>objective measurement</b> every node can compute alone, with no identity-based voting — which is trivially forged on the internet.</p>' +
              '<p>On the Network page, the ledger explorer always shows the network’s longest valid chain.</p>' },
    next: ['fork', 'consensus', 'attack51']
  },
  {
    id: 'fork', tag: 'concept', route: '#/network',
    kw: { vi: 'phân nhánh fork lệch nhau chia đôi chuỗi hai khối cùng lúc mồ côi soft hard',
          en: 'fork branch split two blocks same time orphan stale soft hard' },
    q:  { vi: 'Fork (phân nhánh) là gì?', en: 'What is a fork?' },
    a:  { vi: '<p>Là lúc mạng <b>tạm thời có hai bản sổ khác nhau</b>, cùng hợp lệ.</p>' +
              '<p>Nguyên nhân thường gặp: hai thợ đào ở hai đầu thế giới tìm ra khối gần như cùng lúc. Mỗi nửa mạng nhận được khối gần mình trước và nối vào sổ của mình, thế là chuỗi chẻ đôi.</p>' +
              '<p>Fork loại này <b>tự lành</b>: khối tiếp theo được đào lên một nhánh sẽ khiến nhánh đó dài hơn, cả mạng chuyển sang theo nó, còn khối ở nhánh thua thành <b>khối mồ côi</b> và các giao dịch trong đó quay lại hàng chờ. Đó là lý do người ta khuyên <b>đợi vài xác nhận</b> trước khi coi giao dịch là chắc chắn.</p>' +
              '<p>Ngoài ra còn fork do đổi luật: <b>soft fork</b> (siết luật, nút cũ vẫn theo được) và <b>hard fork</b> (đổi luật không tương thích, mạng chia hẳn).</p>',
          en: '<p>A moment when the network <b>temporarily holds two different ledgers</b>, both valid.</p>' +
              '<p>The usual cause: two miners on opposite sides of the world find a block at nearly the same instant. Each half of the network sees the nearer block first and appends it, so the chain splits.</p>' +
              '<p>Such forks <b>heal themselves</b>: the next block mined on one branch makes it longer, everyone switches, and the losing block becomes an <b>orphan</b> with its transactions returning to the mempool. Hence the advice to <b>wait for several confirmations</b> before treating a payment as final.</p>' +
              '<p>There are also rule-change forks: a <b>soft fork</b> (tightened rules, old nodes still follow) and a <b>hard fork</b> (incompatible rules, the network splits for good).</p>' },
    next: ['longest', 'consensus', 'g-network-fork']
  },
  {
    id: 'attack51', tag: 'concept', route: '#/network',
    kw: { vi: 'tấn công 51 phần trăm chiếm đa số sức đào viết lại lịch sử kẻ tấn công',
          en: '51 percent attack majority hash power rewrite history attacker' },
    q:  { vi: 'Tấn công 51% là gì?', en: 'What is a 51% attack?' },
    a:  { vi: '<p>Là tình huống một bên nắm <b>quá nửa sức đào</b> của mạng. Khi đó họ luôn đào nhanh hơn phần còn lại, nên có thể dựng một nhánh riêng rồi khiến nó dài hơn nhánh công khai — cả mạng buộc phải chuyển sang theo.</p>' +
              '<p>Họ <b>làm được</b>: đảo ngược giao dịch gần đây của chính mình (tiêu hai lần), và chặn giao dịch của người khác vào khối.</p>' +
              '<p>Họ <b>không làm được</b>: tiêu tiền trong ví người khác (không có khoá riêng), tạo tiền ngoài luật phát hành, hay đảo ngược những khối đã chôn quá sâu — chi phí đào lại tăng theo cấp số nhân.</p>' +
              '<p>Nói cách khác, an toàn của blockchain là <b>an toàn kinh tế</b>: không phải "không thể phá", mà là "phá thì lỗ nặng hơn lợi thu về".</p>',
          en: '<p>A situation where one party controls <b>more than half the hash power</b>. They then always out-mine everyone else, so they can build a private branch, make it longer than the public one, and force the network to switch.</p>' +
              '<p>What they <b>can</b> do: reverse their own recent transactions (double spend) and censor others’ transactions from blocks.</p>' +
              '<p>What they <b>cannot</b> do: spend from other people’s wallets (no private keys), mint coins outside the issuance rules, or reverse blocks buried deep — re-mining cost grows exponentially.</p>' +
              '<p>Blockchain security is therefore <b>economic security</b>: not “unbreakable”, but “breaking it costs more than it earns”.</p>' },
    next: ['doublespend', 'pow', 'longest']
  },
  {
    id: 'doublespend', tag: 'concept', route: '#/network',
    kw: { vi: 'tiêu hai lần double spend xài trùng gian lận vấn đề cốt lõi satoshi',
          en: 'double spend spending twice core problem fraud satoshi' },
    q:  { vi: 'Vấn đề tiêu hai lần là gì?', en: 'What is the double-spend problem?' },
    a:  { vi: '<p>Tiền số chỉ là dữ liệu, mà dữ liệu thì <b>chép được vô hạn</b>. Vậy điều gì ngăn tôi gửi cùng một đồng cho hai người cùng lúc?</p>' +
              '<p>Trước Bitcoin, câu trả lời luôn là "một ngân hàng trung gian giữ sổ và nói ai đúng". Đóng góp của Satoshi Nakamoto năm 2008 là giải bài này <b>mà không cần trung gian</b>.</p>' +
              '<p>Lời giải gồm ba mảnh ghép: sổ cái <b>công khai</b> để ai cũng thấy đồng nào đã tiêu; <b>thứ tự thời gian</b> do chuỗi khối áp đặt, ai vào trước thì được; và <b>bằng chứng công việc</b> khiến việc viết lại thứ tự đó trở nên quá đắt.</p>' +
              '<p>Chữ ký số một mình <b>không</b> giải được — nó chứng minh ai ký, nhưng không nói phiếu nào ký trước.</p>',
          en: '<p>Digital money is just data, and data <b>copies infinitely</b>. So what stops me sending the same coin to two people at once?</p>' +
              '<p>Before Bitcoin the answer was always “a bank in the middle keeps the book and rules”. Satoshi Nakamoto’s 2008 contribution was solving it <b>without the middleman</b>.</p>' +
              '<p>Three pieces: a <b>public</b> ledger so everyone sees which coins are spent; a <b>time order</b> imposed by the chain, first in wins; and <b>proof of work</b> making that order too expensive to rewrite.</p>' +
              '<p>Signatures alone <b>cannot</b> solve it — they prove who signed, not which payment came first.</p>' },
    next: ['attack51', 'consensus', 'blockchain']
  },
  {
    id: 'pow-vs-pos', tag: 'concept',
    kw: { vi: 'pos proof of stake cổ phần so sánh pow khác nhau ethereum tiết kiệm điện',
          en: 'proof of stake pos versus pow compare ethereum energy' },
    q:  { vi: 'Proof of Stake khác Proof of Work chỗ nào?', en: 'How does Proof of Stake differ?' },
    a:  { vi: '<p>Cả hai đều trả lời cùng một câu hỏi: <b>lấy gì làm thứ khan hiếm để không ai giả mạo hàng loạt danh tính?</b></p>' +
              '<ul><li><b>PoW</b> đặt cược vào <b>điện năng</b>. Muốn có tiếng nói thì phải đốt điện thật. Tốn kém, nhưng chi phí nằm ngoài hệ thống nên rất khó gian lận.</li>' +
              '<li><b>PoS</b> đặt cược vào <b>vốn ký quỹ</b>. Nút phải khoá một lượng tiền làm cọc; gian lận thì bị <b>tịch thu cọc</b> (slashing). Tốn ít điện hơn hàng nghìn lần.</li></ul>' +
              '<p>Ethereum chuyển từ PoW sang PoS năm 2022 và giảm khoảng 99,9% điện năng tiêu thụ. Đổi lại, PoS bị phê bình là dễ khiến quyền lực tụ về người sẵn có nhiều vốn.</p>' +
              '<p>Trang Mạng lưới có hiển thị cả <b>sức đào</b> lẫn <b>cổ phần</b> của từng nút để bạn thấy hai mô hình cạnh nhau.</p>',
          en: '<p>Both answer the same question: <b>what scarce resource stops anyone forging identities en masse?</b></p>' +
              '<ul><li><b>PoW</b> bets on <b>electricity</b>. A voice costs real energy. Expensive, but the cost sits outside the system, making it hard to game.</li>' +
              '<li><b>PoS</b> bets on <b>staked capital</b>. Nodes lock up funds as collateral; cheating gets the stake <b>slashed</b>. Thousands of times less energy.</li></ul>' +
              '<p>Ethereum moved from PoW to PoS in 2022, cutting energy use by roughly 99.9%. The common criticism is that PoS concentrates influence with those already holding capital.</p>' +
              '<p>The Network page shows each node’s <b>hash power</b> and <b>stake</b> side by side so you can compare the two models.</p>' },
    next: ['pow', 'consensus', 'node']
  },
  {
    id: 'balance', tag: 'concept', route: '#/desk',
    kw: { vi: 'số dư balance tính thế nào tiền trong ví lấy đâu ra utxo',
          en: 'balance how computed wallet funds utxo' },
    q:  { vi: 'Số dư của ví được tính thế nào?', en: 'How is a wallet balance computed?' },
    a:  { vi: '<p>Số dư <b>không được lưu ở đâu cả</b> — nó được <b>tính lại</b> mỗi lần cần, bằng cách quét toàn bộ lịch sử sổ cái: cộng mọi khoản nhận vào, trừ mọi khoản đã chuyển đi.</p>' +
              '<p>Đó là lý do nút mạng phải giữ cả cuốn sổ chứ không chỉ giữ khối mới nhất: không có lịch sử thì không tính được ai có bao nhiêu.</p>' +
              '<p>Bitcoin dùng biến thể gọn hơn gọi là <b>UTXO</b> — chỉ theo dõi những khoản chi ra <i>chưa được tiêu</i>, số dư là tổng các khoản ấy. Ethereum thì giữ thẳng số dư trong một bảng tài khoản. Xưởng này dùng cách quét lịch sử cho dễ nhìn.</p>' +
              '<p>Ở trang Trạm giao dịch, nút mạng sẽ <b>từ chối</b> phiếu nào vượt quá số dư khả dụng của bên chuyển.</p>',
          en: '<p>A balance is <b>stored nowhere</b> — it is <b>recomputed</b> on demand by scanning the ledger: add everything received, subtract everything sent.</p>' +
              '<p>That is why nodes keep the whole book rather than just the latest block: without history there is no way to know who holds what.</p>' +
              '<p>Bitcoin uses a tighter variant called <b>UTXO</b> — tracking only outputs <i>not yet spent</i>, with the balance being their sum. Ethereum instead stores balances directly in an account table. This studio scans history because it is easier to see.</p>' +
              '<p>On the Transaction desk, a node will <b>reject</b> any transaction exceeding the sender’s available balance.</p>' },
    next: ['tx', 'coinbase', 'node']
  },

  /* ------------------------------------------------------------------------
   *  1.2 HƯỚNG DẪN SỬ DỤNG TRANG
   * --------------------------------------------------------------------- */
  {
    id: 'g-tour', tag: 'guide', route: '#/',
    kw: { vi: 'trang web này có gì bắt đầu từ đâu giới thiệu hướng dẫn tổng quan dùng thế nào lộ trình học',
          en: 'what is this site where to start guide overview how to use tour' },
    q:  { vi: 'Trang web này có gì? Bắt đầu từ đâu?', en: 'What is on this site? Where do I start?' },
    a:  { vi: '<p>Xưởng gồm <b>bốn phân hệ</b>, xếp theo đúng thứ tự một kỹ sư cần hiểu — mỗi phân hệ vá đúng lỗ hổng mà phân hệ trước để lại:</p>' +
              '<ol><li><b>Mắt xích dữ liệu</b> — có thứ tự, nhưng ai sửa cũng được và không ai biết.</li>' +
              '<li><b>Sổ cái khối</b> — thay con trỏ bằng dấu niêm phong SHA-256, sửa là lộ ngay.</li>' +
              '<li><b>Trạm giao dịch</b> — chữ ký ECDSA trả lời ai mới có quyền ghi vào sổ.</li>' +
              '<li><b>Mạng lưới</b> — cây Merkle, bằng chứng công việc và phép đếm phiếu quá bán.</li></ol>' +
              '<p>Thêm trang <b>Hồ sơ</b> ghi thông tin học phần, nhóm thực hiện và bản đồ mã nguồn.</p>' +
              '<p>Nếu mới lần đầu, cứ đi từ phân hệ 01 theo đúng thứ tự. Nếu chỉ muốn xem thứ ấn tượng nhất thì vào thẳng <b>Mạng lưới</b>.</p>',
          en: '<p>The studio has <b>four modules</b>, ordered the way an engineer needs to understand them — each patching the gap the previous one leaves:</p>' +
              '<ol><li><b>Data nodes</b> — ordered, but anyone can edit and nobody notices.</li>' +
              '<li><b>Block ledger</b> — pointers become SHA-256 seals, so edits show instantly.</li>' +
              '<li><b>Transaction desk</b> — ECDSA signatures answer who may write to the book.</li>' +
              '<li><b>Network</b> — Merkle trees, proof of work and majority voting.</li></ol>' +
              '<p>Plus a <b>Dossier</b> page with course details, the team and a source map.</p>' +
              '<p>First time? Walk modules 01 to 04 in order. Just want the spectacle? Go straight to <b>Network</b>.</p>' },
    next: ['g-nodes', 'g-ledger', 'g-desk', 'g-network']
  },
  {
    id: 'g-nav', tag: 'guide',
    kw: { vi: 'đổi ngôn ngữ tiếng anh nền tối sáng theme menu điều hướng nút trên cùng thanh',
          en: 'change language english dark light theme menu navigation top bar' },
    q:  { vi: 'Đổi ngôn ngữ và nền sáng/tối ở đâu?', en: 'Where do I change language and theme?' },
    a:  { vi: '<p>Ba nút nhỏ ở <b>góc phải thanh trên cùng</b>:</p>' +
              '<ul><li><b>EN / VI</b> — đổi qua lại tiếng Anh và tiếng Việt. Toàn trang dịch lại ngay, kể cả trợ lý này.</li>' +
              '<li><b>◐</b> — đổi giữa nền tối và nền sáng.</li>' +
              '<li><b>≡</b> — mở danh sách trang khi màn hình hẹp (điện thoại).</li></ul>' +
              '<p>Cả ngôn ngữ lẫn chế độ nền đều được <b>nhớ lại ở lần mở sau</b> nhờ localStorage của trình duyệt.</p>',
          en: '<p>Three small buttons at the <b>right of the top bar</b>:</p>' +
              '<ul><li><b>EN / VI</b> — switch between English and Vietnamese. Everything re-renders immediately, this assistant included.</li>' +
              '<li><b>◐</b> — toggle dark and light background.</li>' +
              '<li><b>≡</b> — open the page list on narrow screens.</li></ul>' +
              '<p>Both language and theme are <b>remembered for next time</b> via the browser’s localStorage.</p>' },
    next: ['g-tour', 'g-privacy']
  },
  {
    id: 'g-hashlab', tag: 'guide', route: '#/',
    kw: { vi: 'bàn thử hàm băm ô nhập trang chủ gõ thử băm trực tiếp',
          en: 'hash bench overview page input try hashing live' },
    q:  { vi: 'Bàn thử hàm băm dùng thế nào?', en: 'How do I use the hash bench?' },
    a:  { vi: '<p>Ở giữa trang <b>Tổng quan</b>, mục "Nền móng mật mã", có một ô nhập tên là <b>Bàn thử hàm băm</b>.</p>' +
              '<p>Gõ bất cứ gì vào đó, mã băm SHA-256 bên dưới cập nhật <b>ngay từng phím</b> — băm thật, không phải chuỗi trang trí.</p>' +
              '<p>Thí nghiệm đáng thử nhất: gõ một câu, ghi nhớ vài ký tự đầu của mã băm, rồi <b>thêm đúng một dấu chấm</b> vào cuối câu. Mã băm đổi hoàn toàn — đó là hiệu ứng thác đổ.</p>' +
              '<p>Chú ý dòng "Độ dài đầu ra" luôn là <b>64 hex · 256 bit</b> dù bạn gõ một chữ hay cả đoạn văn.</p>',
          en: '<p>Midway down the <b>Overview</b> page, in the “cryptographic foundation” section, there is an input called the <b>hash bench</b>.</p>' +
              '<p>Type anything and the SHA-256 digest below updates <b>on every keystroke</b> — genuinely hashed, not decorative.</p>' +
              '<p>The experiment worth doing: type a sentence, memorise the first few characters of the digest, then <b>add a single full stop</b> at the end. The digest changes completely — that is the avalanche effect.</p>' +
              '<p>Note the “output length” line stays <b>64 hex · 256 bit</b> whether you type one letter or a paragraph.</p>' },
    next: ['avalanche', 'sha256', 'hash']
  },
  {
    id: 'g-nodes', tag: 'guide', route: '#/nodes',
    kw: { vi: 'trang mắt xích dùng thế nào móc vào đầu nối vào đuôi lần theo tháo lộn ngược nút bấm hướng dẫn',
          en: 'nodes page how to use push front append tail traverse remove reverse buttons' },
    q:  { vi: 'Trang Mắt xích dùng thế nào?', en: 'How do I use the Nodes page?' },
    a:  { vi: '<p>Gõ nội dung vào ô <b>“Nội dung mắt xích”</b> rồi chọn một thao tác trong <b>Bảng lệnh</b>:</p>' +
              '<ul><li><b>Móc vào đầu</b> — chèn trước head, O(1).</li>' +
              '<li><b>Nối vào đuôi</b> — thêm sau tail, O(1) nhờ giữ sẵn con trỏ tail. Gõ xong nhấn <b>Enter</b> là chạy luôn lệnh này.</li>' +
              '<li><b>Lần theo tìm</b> — chạy hoạt ảnh đi từng bước từ head, cho thấy vì sao truy cập là O(n).</li>' +
              '<li><b>Tháo mắt xích</b> — gỡ một mắt và nối tắt hai bên.</li>' +
              '<li><b>Lộn ngược dây</b> — đảo chiều toàn bộ con trỏ, head và tail đổi chỗ.</li>' +
              '<li><b>Nạp mẫu LinkList.py</b> / <b>Dọn sạch</b> — về dữ liệu mẫu hoặc về dây rỗng.</li></ul>' +
              '<p>Vừa làm vừa nhìn ba bảng bên dưới: <b>Bảng chỉ số</b> (size, head, tail), <b>Bản đồ ô nhớ</b> và <b>Nhật ký thao tác</b>. Cuối trang có bảng so chi phí giữa dây mắt xích, mảng và sổ cái khối.</p>',
          en: '<p>Type into the <b>“node content”</b> field, then pick an operation from the <b>command deck</b>:</p>' +
              '<ul><li><b>Push front</b> — insert before the head, O(1).</li>' +
              '<li><b>Append</b> — add after the tail, O(1) thanks to the kept tail pointer. Pressing <b>Enter</b> runs this one.</li>' +
              '<li><b>Traverse</b> — animates a step-by-step walk from the head, showing why access is O(n).</li>' +
              '<li><b>Remove</b> — unlink one node and splice its neighbours.</li>' +
              '<li><b>Reverse</b> — flip every pointer; head and tail swap.</li>' +
              '<li><b>Load LinkList.py sample</b> / <b>Clear</b> — back to the sample data or to an empty chain.</li></ul>' +
              '<p>Watch the three panels below as you go: <b>state table</b> (size, head, tail), <b>memory map</b> and <b>operation journal</b>. The bottom table compares costs across linked list, array and block ledger.</p>' },
    next: ['linkedlist', 'list-vs-chain', 'g-ledger']
  },
  {
    id: 'g-ledger', tag: 'guide', route: '#/ledger',
    kw: { vi: 'trang sổ cái dùng thế nào niêm phong khối thêm khối dựng sổ mới hướng dẫn',
          en: 'ledger page how to use seal block add new ledger' },
    q:  { vi: 'Trang Sổ cái dùng thế nào?', en: 'How do I use the Ledger page?' },
    a:  { vi: '<p>Ở <b>Xưởng đóng khối</b>, gõ nội dung rồi bấm <b>“Niêm phong khối”</b>. Khối mới sẽ nối vào đuôi sổ, mang theo dấu niêm phong của khối liền trước.</p>' +
              '<p>Kéo <b>thanh độ khó</b> trước khi niêm phong để thấy chi phí đào: độ khó 0 thì băm một phát là xong; tăng lên, trang sẽ hiện số lần dò nonce và tốc độ băm mỗi giây theo thời gian thực.</p>' +
              '<p>Bốn nút chính:</p>' +
              '<ul><li><b>Niêm phong khối</b> — đóng khối mới.</li>' +
              '<li><b>Sửa trộm thử</b> — sửa nội dung khối #1 mà không tính lại hash, để xem sổ gãy.</li>' +
              '<li><b>Vá lại toàn sổ</b> — tính lại hash và đào lại nonce cho từng khối.</li>' +
              '<li><b>Dựng sổ mới</b> — về trạng thái ban đầu.</li></ul>' +
              '<p>Bảng <b>Tình trạng sổ cái</b> chạy đúng hai điều kiện của hàm <span class="mono">is_Valid</span> bản Python: hash lưu trong khối có khớp nội dung hiện tại không, và khối sau có trỏ đúng về khối trước không.</p>',
          en: '<p>In the <b>block workshop</b>, type content and press <b>“Seal block”</b>. The new block appends to the ledger carrying the previous block’s seal.</p>' +
              '<p>Drag the <b>difficulty slider</b> before sealing to feel the mining cost: at 0 a single hash suffices; raise it and the page shows live nonce attempts and hashes per second.</p>' +
              '<p>Four main buttons:</p>' +
              '<ul><li><b>Seal block</b> — close a new block.</li>' +
              '<li><b>Tamper</b> — edit block #1 without recomputing its hash, to watch the chain break.</li>' +
              '<li><b>Rebuild</b> — recompute hashes and re-mine every nonce.</li>' +
              '<li><b>New ledger</b> — back to the starting state.</li></ul>' +
              '<p>The <b>ledger status</b> panel runs exactly the two conditions of the Python <span class="mono">is_Valid</span>: does the stored hash match current content, and does each block point correctly at its predecessor?</p>' },
    next: ['g-ledger-tamper', 'difficulty', 'block', 'g-desk']
  },
  {
    id: 'g-ledger-tamper', tag: 'guide', route: '#/ledger',
    kw: { vi: 'sửa trộm thử phá sổ cái thí nghiệm gãy mắt nối hỏng vá lại cách thử tấn công',
          en: 'tamper experiment break the ledger broken link rebuild try attack' },
    q:  { vi: 'Làm sao thử phá sổ cái?', en: 'How do I try breaking the ledger?' },
    a:  { vi: '<p>Đây là thí nghiệm đáng giá nhất của cả xưởng. Làm theo bốn bước:</p>' +
              '<ol><li>Niêm phong <b>vài khối</b> để sổ đủ dài.</li>' +
              '<li>Bấm <b>“Sửa trộm thử”</b>, hoặc bấm nút <b>Sửa trộm</b> ngay trên một khối bất kỳ.</li>' +
              '<li>Nhìn xuống: khối bị sửa hiện nhãn <b>“nội dung bị sửa”</b>, dòng <i>băm lại thì ra</i> cho thấy mã băm mới khác hẳn mã đang lưu, và <b>mắt nối phía sau đứt</b> — kéo theo mọi khối còn lại hỏng theo.</li>' +
              '<li>Bấm <b>“Vá lại toàn sổ”</b> để tính lại từ đầu.</li></ol>' +
              '<p>Mẹo: làm thí nghiệm này <b>hai lần</b> — một lần với độ khó 0, một lần với độ khó 3 trở lên. Lần đầu vá sổ gần như miễn phí; lần sau phải đào lại từng khối. Đó chính là lý do một sổ cái không có chi phí đào thì vô nghĩa.</p>',
          en: '<p>The single most worthwhile experiment here. Four steps:</p>' +
              '<ol><li>Seal <b>a few blocks</b> so the ledger has length.</li>' +
              '<li>Press <b>“Tamper”</b>, or the <b>tamper</b> button on any individual block.</li>' +
              '<li>Look down: the edited block shows a <b>“content altered”</b> flag, the <i>re-hash</i> line reveals a digest quite unlike the stored one, and the <b>link behind it snaps</b> — taking every later block with it.</li>' +
              '<li>Press <b>“Rebuild”</b> to recompute from scratch.</li></ol>' +
              '<p>Tip: run this <b>twice</b> — once at difficulty 0, once at difficulty 3 or above. The first rebuild is nearly free; the second re-mines every block. That is exactly why a ledger without mining cost is meaningless.</p>' },
    next: ['immutable', 'prevhash', 'pow', 'g-network-fork']
  },
  {
    id: 'g-desk', tag: 'guide', route: '#/desk',
    kw: { vi: 'trang trạm giao dịch dùng thế nào tạo ví phát ví ký phiếu đóng khối hướng dẫn thao tác pem',
          en: 'transaction desk page how to use create wallet sign pack block pem' },
    q:  { vi: 'Trang Trạm giao dịch dùng thế nào?', en: 'How do I use the Transaction desk?' },
    a:  { vi: '<p>Đi theo đúng vòng đời của một giao dịch:</p>' +
              '<ol><li><b>Ví trong phiên làm việc</b> — trang tự phát sẵn ba ví. Bấm <b>“Hiện”</b> để xem khoá riêng, <b>“Xuất khoá dạng PEM”</b> để xem định dạng chuẩn PKCS#8 / X.509, hoặc <b>“Phát ví mới”</b> để sinh bộ khoá khác.</li>' +
              '<li><b>Lập phiếu &amp; ký</b> — chọn bên chuyển, bên nhận, số tiền, lời nhắn. Trang hiện luôn <b>chuỗi nguyên liệu sắp đem đi ký</b> và tóm tắt <span class="mono">z</span>. Bấm <b>“Ký &amp; đẩy vào hàng chờ”</b>.</li>' +
              '<li><b>Hàng chờ (mempool)</b> — xem phiếu vừa ký, kèm chữ ký DER. Thử nút <b>“Sửa trộm số tiền”</b> để thấy chữ ký gãy ngay.</li>' +
              '<li><b>Đóng khối</b> — gom các phiếu hợp lệ vào một khối nối vào sổ cái. Phiếu sai chữ ký hoặc thiếu số dư sẽ bị trả lại.</li></ol>' +
              '<p>Bấm <b>“Dựng lại phiên”</b> bất cứ lúc nào để làm lại từ đầu.</p>',
          en: '<p>Follow a transaction’s full lifecycle:</p>' +
              '<ol><li><b>Session wallets</b> — three are generated for you. Press <b>“Show”</b> to reveal a private key, <b>“Export PEM”</b> for standard PKCS#8 / X.509 form, or <b>“Mint wallets”</b> for a fresh set.</li>' +
              '<li><b>Draft &amp; sign</b> — pick sender, recipient, amount, memo. The page shows the exact <b>payload about to be signed</b> and its digest <span class="mono">z</span>. Press <b>“Sign &amp; queue”</b>.</li>' +
              '<li><b>Mempool</b> — inspect the queued entry and its DER signature. Try <b>“Tamper with the amount”</b> to watch the signature break instantly.</li>' +
              '<li><b>Pack block</b> — gather valid entries into a block appended to the ledger. Bad signatures or insufficient funds get returned.</li></ol>' +
              '<p>Press <b>“Reset session”</b> at any point to start over.</p>' },
    next: ['g-desk-verify', 'tx', 'signature', 'privkey']
  },
  {
    id: 'g-desk-verify', tag: 'guide', route: '#/desk',
    kw: { vi: 'phòng kiểm chứng chữ ký ba tình huống chấp nhận từ chối thử kiểm chuỗi',
          en: 'signature lab three cases accept reject verify string' },
    q:  { vi: 'Phòng kiểm chứng chữ ký để làm gì?', en: 'What is the signature lab for?' },
    a:  { vi: '<p>Nằm cuối trang <b>Trạm giao dịch</b>, nó lấy chữ ký bạn vừa tạo rồi đem kiểm trong <b>ba tình huống</b> đặt cạnh nhau:</p>' +
              '<ol><li><b>Đúng phiếu gốc, đúng khoá công khai</b> ⇒ CHẤP NHẬN. Điểm khôi phục từ (r, s) trùng với điểm R lúc ký.</li>' +
              '<li><b>Vẫn chữ ký ấy, nhưng số tiền bị nâng lên 999</b> ⇒ TỪ CHỐI. Đổi nội dung là đổi tóm tắt z, phép kiểm ra một điểm khác hẳn.</li>' +
              '<li><b>Đúng phiếu gốc, nhưng đem khoá công khai của ví khác</b> ⇒ TỪ CHỐI. Chữ ký chỉ khớp với đúng một khoá công khai.</li></ol>' +
              '<p>Ba tình huống này chứng minh gọn ghẽ hai điều một chữ ký bảo đảm: <b>đúng người</b> và <b>đúng nội dung</b>. Bên dưới còn ô cho bạn tự sửa một ký tự bất kỳ rồi bấm <b>“Kiểm chuỗi này”</b>.</p>',
          en: '<p>At the foot of the <b>Transaction desk</b>, it takes the signature you just made and verifies it under <b>three cases</b> side by side:</p>' +
              '<ol><li><b>Original payload, correct public key</b> ⇒ ACCEPT. The point recovered from (r, s) matches the R used when signing.</li>' +
              '<li><b>Same signature, amount raised to 999</b> ⇒ REJECT. Changed content means a changed digest z, so the check lands elsewhere.</li>' +
              '<li><b>Original payload, another wallet’s public key</b> ⇒ REJECT. A signature matches exactly one public key.</li></ol>' +
              '<p>Together they demonstrate the two guarantees of a signature: <b>right signer</b> and <b>right content</b>. Below there is a field where you can alter any character yourself and press <b>“Verify this string”</b>.</p>' },
    next: ['verify', 'signature', 'ecdsa']
  },
  {
    id: 'g-network', tag: 'guide', route: '#/network',
    kw: { vi: 'trang mạng lưới dùng thế nào bốn nút phát tán đóng gói đào phát sóng bỏ phiếu hướng dẫn',
          en: 'network page how to use four nodes broadcast assemble mine vote' },
    q:  { vi: 'Trang Mạng lưới dùng thế nào?', en: 'How do I use the Network page?' },
    a:  { vi: '<p>Trang này chạy trọn một vòng của mạng thật. Trình tự sáu bước:</p>' +
              '<ol><li><b>Trạm phát giao dịch</b> — chọn nút chuyển, nút nhận, số tiền, bấm <b>“Ký &amp; phát tán”</b>. Làm vài lần cho hàng chờ có việc.</li>' +
              '<li><b>Cây Merkle</b> — xem trước cây dựng từ các phiếu đang chờ, từ lá lên tới gốc.</li>' +
              '<li><b>Khối ứng viên</b> — bấm <b>“Đóng gói khối”</b>. Chọn nút đề xuất, hoặc để mạng tự chọn theo sức đào.</li>' +
              '<li><b>Đào</b> — bấm <b>“Đào — tìm nonce”</b> và xem nonce cùng tốc độ băm chạy thật cho tới khi đủ số 0 dẫn đầu.</li>' +
              '<li><b>Phát sóng &amp; lấy phiếu</b> — mỗi nút tự thẩm định năm điều rồi bỏ phiếu. Đạt quá bán thì khối vào sổ.</li>' +
              '<li><b>Tra cứu sổ cái</b> — xem chuỗi hợp lệ dài nhất; <b>Nhật ký mạng</b> ghi lại toàn bộ sự kiện.</li></ol>' +
              '<p>Bấm <b>“Dựng lại mạng”</b> để bắt đầu lại từ khối gốc.</p>',
          en: '<p>This page runs a full network cycle. Six steps:</p>' +
              '<ol><li><b>Broadcast station</b> — pick sender node, recipient, amount, press <b>“Sign &amp; broadcast”</b>. Do it a few times to fill the queue.</li>' +
              '<li><b>Merkle tree</b> — preview the tree built from pending transactions, leaves up to root.</li>' +
              '<li><b>Candidate block</b> — press <b>“Assemble block”</b>. Choose a proposer, or let the network pick by hash power.</li>' +
              '<li><b>Mine</b> — press <b>“Mine — find nonce”</b> and watch the real nonce and hash rate climb until the leading zeros appear.</li>' +
              '<li><b>Broadcast &amp; collect votes</b> — each node runs its five checks and votes. Pass the majority and the block lands.</li>' +
              '<li><b>Ledger explorer</b> — view the longest valid chain; the <b>network log</b> records every event.</li></ol>' +
              '<p>Press <b>“Reset network”</b> to start again from genesis.</p>' },
    next: ['g-network-fork', 'merkle', 'consensus', 'mining']
  },
  {
    id: 'g-network-fork', tag: 'guide', route: '#/network',
    kw: { vi: 'sửa trộm nút tạo fork lệch nhau đổi trộm gốc merkle giả mạo thí nghiệm đồng bộ',
          en: 'tamper node create fork forge merkle root experiment sync' },
    q:  { vi: 'Làm sao tạo fork và thử tấn công?', en: 'How do I create a fork and attack?' },
    a:  { vi: '<p>Trang Mạng lưới có sẵn <b>ba nút phá hoại</b> để bạn thử vai kẻ tấn công:</p>' +
              '<ul><li><b>“Sửa trộm sổ của nút này”</b> (trong Danh bạ nút mạng) — sửa một khối trong bản sao riêng của một nút. Nút đó lập tức bị đánh dấu <b>“Sổ đã gãy”</b>, trạng thái mạng chuyển sang <b>ĐANG LỆCH NHAU</b>, và phiếu của nút đó không còn giá trị. Cần sổ có ít nhất một khối ngoài khối gốc.</li>' +
              '<li><b>“Sửa trộm số tiền”</b> (trong hàng chờ) — nâng số tiền sau khi đã ký. Phiếu hiện nhãn <b>Chữ ký gãy</b> và bị loại khi đóng khối.</li>' +
              '<li><b>“Đổi trộm gốc Merkle”</b> (trong khối ứng viên) — thay gốc Merkle trong header. Khi phát sóng, mọi nút dựng lại cây từ danh sách txid, thấy không khớp và <b>bỏ phiếu chống</b>.</li></ul>' +
              '<p>Sau khi phá xong, bấm <b>“Đồng bộ mạng”</b>: các nút hỏng buộc phải chép lại chuỗi thắng cuộc. Đó là cách mạng tự chữa lành.</p>',
          en: '<p>The Network page ships <b>three sabotage buttons</b> so you can play attacker:</p>' +
              '<ul><li><b>“Tamper with this node’s ledger”</b> (in the node directory) — edit a block in one node’s private copy. That node is flagged <b>“ledger broken”</b>, network status flips to <b>FORKED</b>, and its votes stop counting. Needs at least one block beyond genesis.</li>' +
              '<li><b>“Tamper with the amount”</b> (in the mempool) — raise an amount after signing. The entry shows <b>broken signature</b> and is dropped when packing.</li>' +
              '<li><b>“Forge the Merkle root”</b> (in the candidate block) — swap the root in the header. On broadcast every node rebuilds the tree from the txid list, sees the mismatch and <b>votes no</b>.</li></ul>' +
              '<p>When you are done, press <b>“Sync network”</b>: broken nodes must copy the winning chain. That is the network healing itself.</p>' },
    next: ['fork', 'attack51', 'consensus', 'merkleroot']
  },
  {
    id: 'g-dossier', tag: 'guide', route: '#/dossier',
    kw: { vi: 'hồ sơ trang nhóm thành viên ai làm đề tài giảng viên lớp mã nguồn github tham khảo',
          en: 'dossier page team members topic lecturer class source github references' },
    q:  { vi: 'Trang Hồ sơ có gì?', en: 'What is on the Dossier page?' },
    a:  { vi: '<p>Trang <b>Hồ sơ</b> là phần báo cáo của đồ án, gồm:</p>' +
              '<ul><li><b>Tên đề tài</b> và sáu ô: bối cảnh, mục tiêu, phạm vi, cách làm, kết quả, hướng mở rộng.</li>' +
              '<li><b>Học phần</b> — môn, giảng viên, lớp, học kỳ, khoa, trường.</li>' +
              '<li><b>Nhóm thực hiện</b> — bốn thành viên và phần việc từng người.</li>' +
              '<li><b>Kho mã nguồn</b> — liên kết GitHub và lệnh <span class="mono">git clone</span>.</li>' +
              '<li><b>Mạch bài</b>, <b>gốc gác từ mã Python</b>, <b>nền tảng kỹ thuật</b>, <b>bản đồ tệp nguồn</b> và <b>tài liệu tham khảo</b>.</li></ul>' +
              '<p>Muốn sửa thông tin nhóm hay học phần thì mở tệp <span class="mono">js/config.js</span> — đó là tệp duy nhất cần sửa, không phải biên dịch gì cả.</p>',
          en: '<p>The <b>Dossier</b> page is the project’s written report:</p>' +
              '<ul><li><b>Topic title</b> plus six panels: context, aim, scope, method, outcome, future work.</li>' +
              '<li><b>Course</b> — subject, lecturer, class, term, faculty, university.</li>' +
              '<li><b>The team</b> — four members and who did what.</li>' +
              '<li><b>Repository</b> — GitHub link and the <span class="mono">git clone</span> command.</li>' +
              '<li><b>Learning path</b>, <b>Python origins</b>, <b>technical basis</b>, <b>source map</b> and <b>references</b>.</li></ul>' +
              '<p>To change team or course details, edit <span class="mono">js/config.js</span> — the only file you need to touch, with nothing to compile.</p>' },
    next: ['g-tour', 'g-offline']
  },
  {
    id: 'g-privacy', tag: 'guide',
    kw: { vi: 'riêng tư dữ liệu gửi đi đâu lưu ở đâu an toàn bảo mật thu thập theo dõi',
          en: 'privacy data sent stored safe security collect tracking' },
    q:  { vi: 'Dữ liệu tôi nhập có bị gửi đi đâu không?', en: 'Is my data sent anywhere?' },
    a:  { vi: '<p><b>Không.</b> Mọi phép băm, mọi cặp khoá và mọi chữ ký đều được tính <b>ngay trong trình duyệt của bạn</b>. Không có máy chủ nào nhận dữ liệu, không có cơ sở dữ liệu, không có tài khoản đăng nhập.</p>' +
              '<p>Trang chỉ ghi vào <b>localStorage</b> đúng hai thứ nhỏ: ngôn ngữ bạn chọn và chế độ nền sáng/tối. Ngoài ra không lưu gì.</p>' +
              '<p>Trợ lý này cũng vậy — nó là một kho tri thức viết sẵn nằm trong tệp <span class="mono">js/core/assistant.js</span>, <b>không gọi API</b>, không cần mạng, không gửi câu hỏi của bạn đi đâu cả.</p>' +
              '<p>Thứ duy nhất tải từ ngoài vào là bộ chữ JetBrains Mono từ Google Fonts; mất mạng thì trang tự lùi về bộ chữ hệ thống và vẫn chạy đủ.</p>',
          en: '<p><b>No.</b> Every hash, key pair and signature is computed <b>inside your browser</b>. No server receives anything, there is no database and no login.</p>' +
              '<p>The page writes just two small things to <b>localStorage</b>: your chosen language and the light/dark setting. Nothing else is stored.</p>' +
              '<p>This assistant is the same — a hand-written knowledge base living in <span class="mono">js/core/assistant.js</span>, with <b>no API calls</b>, no network need, and no transmission of your questions.</p>' +
              '<p>The only external fetch is the JetBrains Mono webfont from Google Fonts; offline, the page falls back to system fonts and still works fully.</p>' },
    next: ['g-offline', 'g-bot', 'g-nav']
  },
  {
    id: 'g-offline', tag: 'guide',
    kw: { vi: 'chạy offline không mạng mở file máy chủ server node cài đặt chạy thế nào npm',
          en: 'offline no internet open file protocol server node install run npm' },
    q:  { vi: 'Chạy trang này thế nào? Có cần cài gì không?', en: 'How do I run this? Any install needed?' },
    a:  { vi: '<p><b>Không cần cài gì cả.</b> Có hai cách chạy:</p>' +
              '<ul><li><b>Mở thẳng tệp</b> — bấm đúp vào <span class="mono">public/index.html</span>. Trang dùng script cổ điển chứ không phải ES module, nên chạy được qua giao thức <span class="mono">file://</span>.</li>' +
              '<li><b>Dựng máy chủ tĩnh</b> — chạy <span class="mono">node server.js</span> rồi mở <span class="mono">http://localhost:3000</span>. Cách này cho chức năng chép vào bộ nhớ tạm hoạt động mượt hơn, vì API clipboard chỉ chạy trong ngữ cảnh bảo mật.</li></ul>' +
              '<p>Không có bước biên dịch, không phụ thuộc npm — <span class="mono">package.json</span> có mục dependencies rỗng.</p>' +
              '<p>Mất mạng vẫn chạy đủ chức năng; chỉ riêng bộ chữ JetBrains Mono không tải được và trang tự lùi về Consolas hoặc bộ chữ máy của hệ điều hành.</p>',
          en: '<p><b>Nothing to install.</b> Two ways to run it:</p>' +
              '<ul><li><b>Open the file directly</b> — double-click <span class="mono">public/index.html</span>. The page uses classic scripts rather than ES modules, so <span class="mono">file://</span> works.</li>' +
              '<li><b>Serve it statically</b> — run <span class="mono">node server.js</span> and open <span class="mono">http://localhost:3000</span>. Copy-to-clipboard behaves better this way, since the clipboard API needs a secure context.</li></ul>' +
              '<p>No build step, no npm dependencies — <span class="mono">package.json</span> has an empty dependencies block.</p>' +
              '<p>Offline everything still works; only the JetBrains Mono webfont fails to load and the page falls back to Consolas or your system monospace.</p>' },
    next: ['g-privacy', 'g-dossier']
  },
  {
    id: 'g-console', tag: 'guide', route: '#/network',
    kw: { vi: 'console kiểm chứng debug tự kiểm tra lệnh devtools soát từ điển',
          en: 'console verify debug devtools command audit dictionary' },
    q:  { vi: 'Tự kiểm chứng bằng Console thế nào?', en: 'How do I verify things in the Console?' },
    a:  { vi: '<p>Mở Console của trình duyệt (phím <b>F12</b>) rồi gõ:</p>' +
              '<ul><li><span class="mono">DLU.views.network.debug()</span> — in ra mã băm đang lưu đặt cạnh mã băm băm lại, gốc Merkle đang lưu đặt cạnh gốc dựng lại từ danh sách txid, cùng kết quả kiểm chữ ký của từng phiếu. Đây là cách chứng minh không con số nào trên trang được gán sẵn.</li>' +
              '<li><span class="mono">DLU.i18n.audit()</span> — soát từ điển song ngữ, trả về những khoá thiếu ở một trong hai ngôn ngữ.</li>' +
              '<li><span class="mono">DLU.sha256("thử")</span> — gọi thẳng hàm băm để đối chiếu với công cụ khác.</li>' +
              '<li><span class="mono">DLU.assistant.audit()</span> — thống kê kho tri thức của trợ lý này.</li></ul>',
          en: '<p>Open the browser Console (<b>F12</b>) and type:</p>' +
              '<ul><li><span class="mono">DLU.views.network.debug()</span> — prints stored hashes beside freshly recomputed ones, the stored Merkle root beside one rebuilt from the txid list, and each signature’s verification result. This is how you prove no number on the page is hard-coded.</li>' +
              '<li><span class="mono">DLU.i18n.audit()</span> — audits the bilingual dictionary, listing keys missing from either language.</li>' +
              '<li><span class="mono">DLU.sha256("test")</span> — call the hash directly to compare against other tools.</li>' +
              '<li><span class="mono">DLU.assistant.audit()</span> — statistics on this assistant’s knowledge base.</li></ul>' },
    next: ['g-network', 'sha256', 'g-privacy']
  },
  {
    id: 'g-bot', tag: 'guide',
    kw: { vi: 'bạn là ai trợ lý bot ai làm được gì hoạt động thế nào chatgpt có thông minh không',
          en: 'who are you assistant bot what can you do how do you work chatgpt' },
    q:  { vi: 'Bạn là ai và làm được gì?', en: 'Who are you and what can you do?' },
    a:  { vi: '<p>Mình là <b>trợ lý của xưởng DLU Ledger Studio</b> — một chương trình nhỏ chạy hoàn toàn trong trình duyệt của bạn.</p>' +
              '<p>Mình <b>không phải</b> mô hình ngôn ngữ lớn và không gọi API nào. Bên trong là một kho tri thức viết tay cùng một bộ tìm kiếm: câu hỏi của bạn được bỏ dấu, tách từ, rồi chấm điểm với từng mục theo trọng số và độ hiếm của từ. Mục điểm cao nhất chính là câu trả lời.</p>' +
              '<p>Vì thế mình <b>chỉ trả lời trong phạm vi</b> kiến thức blockchain của học phần và cách dùng bốn phân hệ trên trang này. Hỏi ngoài phạm vi, mình sẽ nói thẳng là chưa biết thay vì bịa.</p>' +
              '<p>Bù lại, mình có ba điểm mạnh: <b>chạy được khi mất mạng</b>, <b>không gửi câu hỏi của bạn đi đâu</b>, và câu trả lời <b>khớp đúng với đồ án này</b> chứ không chung chung.</p>',
          en: '<p>I am the <b>DLU Ledger Studio assistant</b> — a small program running entirely inside your browser.</p>' +
              '<p>I am <b>not</b> a large language model and I call no API. Inside is a hand-written knowledge base plus a search engine: your question is stripped of diacritics, tokenised, then scored against each entry by field weight and term rarity. The top-scoring entry is the answer.</p>' +
              '<p>So I <b>only answer within scope</b>: the course’s blockchain material and how to use the four modules on this site. Ask outside that and I will say I do not know rather than invent something.</p>' +
              '<p>In exchange I offer three things: I <b>work offline</b>, I <b>send your questions nowhere</b>, and my answers <b>match this specific project</b> rather than being generic.</p>' },
    next: ['g-tour', 'g-privacy', 'blockchain']
  }
  ];

  /* =========================================================================
   *  2. CHUẨN HOÁ & TÁCH TỪ
   * ======================================================================= */

  /* Những từ quá phổ biến, có mặt ở mọi câu nên không giúp phân biệt mục nào
     với mục nào. Loại chúng ra để điểm số phản ánh đúng phần "có nội dung"
     của câu hỏi. Cố ý KHÔNG loại các từ như "khối", "băm", "khoá". */
  var STOP = (
    'la gi the nao cua va co khong cho toi ban minh mot cai nay do thi ma den tu ve hay ' +
    'duoc se bi nhu voi ra vao len xuong khi neu con nen phai lam sao vay ho nhung cac moi ' +
    'rang day kia ay nhi nhe oi xin vui long giup hoi cau tra loi noi biet hieu ' +
    'what is the an of and or how do does did you it me my your to in on at for with ' +
    'can could would should this that these those there here about tell explain show give ' +
    'please help question answer know understand mean means are was were be been being ' +
    'why when where who which if then than so such just also very much many some any'
  ).split(' ');

  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = true; });

  /**
   * Bỏ dấu tiếng Việt, hạ chữ thường, cắt dấu câu.
   *
   * Dùng normalize('NFD') để tách chữ cái khỏi dấu thanh rồi xoá dải dấu
   * kết hợp U+0300–U+036F. Riêng chữ đ/Đ không phải là "d + dấu" nên
   * Unicode không tách được, phải thay tay.
   */
  function norm(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tách câu thành mảng từ có nghĩa: bỏ từ dừng và từ một ký tự. */
  function words(text) {
    return norm(text).split(' ').filter(function (w) {
      return w.length > 1 && !STOPSET[w];
    });
  }

  /** Gỡ thẻ HTML để lấy phần chữ thuần đem đi lập chỉ mục. */
  function strip(html) {
    return String(html).replace(/<[^>]*>/g, ' ');
  }

  /* =========================================================================
   *  3. LẬP CHỈ MỤC
   * -----------------------------------------------------------------------
   *  Chỉ mục được dựng riêng cho từng ngôn ngữ, và chỉ dựng một lần rồi giữ
   *  lại trong bộ nhớ — kho tri thức không đổi trong suốt phiên làm việc.
   * ======================================================================= */

  /* Trọng số ba vùng chữ. Từ khoá là vùng do người viết chọn lọc kỹ nhất nên
     đáng tin nhất; phần thân dài nên dễ chứa từ trùng ngẫu nhiên, cho điểm thấp. */
  var W_KW = 6, W_Q = 3, W_BODY = 1;

  var index = {};      // { vi: {...}, en: {...} }

  function buildIndex(lang) {
    var entries = KB.map(function (item) {
      var bag = {};

      function add(text, weight) {
        words(text).forEach(function (w) {
          bag[w] = (bag[w] || 0) + weight;
        });
      }

      add(item.kw[lang], W_KW);
      add(item.q[lang], W_Q);
      add(strip(item.a[lang]), W_BODY);

      return {
        item: item,
        bag: bag,
        keys: Object.keys(bag),
        // Dạng đã chuẩn hoá của câu hỏi mẫu và của vùng từ khoá, tính sẵn một
        // lần để mỗi lượt hỏi khỏi phải chuẩn hoá lại toàn kho.
        qn: words(item.q[lang]).join(' '),
        kwn: norm(item.kw[lang])
      };
    });

    // Tần suất tài liệu: một từ xuất hiện ở bao nhiêu mục trong kho.
    var df = {};
    entries.forEach(function (e) {
      e.keys.forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });

    // IDF trơn: từ càng hiếm điểm càng cao, nhưng không bao giờ âm.
    var n = entries.length;
    var idf = {};
    Object.keys(df).forEach(function (w) {
      idf[w] = Math.log(1 + n / df[w]);
    });

    return { entries: entries, idf: idf };
  }

  function getIndex(lang) {
    if (!index[lang]) index[lang] = buildIndex(lang);
    return index[lang];
  }

  /* =========================================================================
   *  4. HỎI ĐÁP
   * ======================================================================= */

  /* Dưới ngưỡng này thì thà nhận "chưa biết" còn hơn trả lời bừa. Con số rút ra
     từ việc thử tay trên cả hai ngôn ngữ: câu hỏi đúng phạm vi thường vượt xa
     mốc này, còn câu lạc đề — chỉ tình cờ trùng một hai từ — rơi xuống dưới. */
  var FLOOR = 6;

  /* Câu chào và lời cảm ơn — bắt riêng để trợ lý không lôi kiến thức ra đáp. */
  var HELLO = /^(hi|hey|hello|chao|xin chao|alo|yo|good morning|good evening)\b/;
  var THANKS = /^(cam on|thanks|thank you|thank|tks|oke|ok|okay)\b/;

  /**
   * Trả lời một câu hỏi.
   *
   * @param {string} query câu người dùng gõ
   * @param {object} [opts] { lang: 'vi'|'en', route: '#/ledger' }
   * @returns {object} { kind, entry, score, alts }
   *   kind = 'answer'   — đủ chắc chắn, có entry
   *        | 'unsure'   — không đủ điểm, alts là các mục gần đúng nhất
   *        | 'greet' | 'thanks' | 'empty'
   */
  function ask(query, opts) {
    opts = opts || {};
    var lang = opts.lang || (DLU.i18n ? DLU.i18n.getLang() : 'vi');
    if (!KB.length) return { kind: 'empty', alts: [] };

    var flat = norm(query);
    if (!flat) return { kind: 'empty', alts: [] };
    if (HELLO.test(flat)) return { kind: 'greet', alts: pick(['g-tour', 'blockchain', 'g-nav']) };
    if (THANKS.test(flat) && flat.split(' ').length <= 4) {
      return { kind: 'thanks', alts: pick(['g-tour', 'blockchain']) };
    }

    var idx = getIndex(lang);

    /* Bỏ từ dừng xong mà câu rỗng — "who are you", "cái này là gì" — thì lấy
       lại nguyên câu. Thà chấm điểm bằng từ tầm thường còn hơn không có gì. */
    var qw = words(query);
    if (!qw.length) {
      qw = flat.split(' ').filter(function (w) { return w.length > 1; });
    }
    if (!qw.length) return { kind: 'unsure', alts: pick(['g-tour', 'blockchain', 'g-nav']) };

    var qjoin = qw.join(' ');

    var scored = idx.entries.map(function (e) {
      var raw = 0, hits = 0;

      qw.forEach(function (w) {
        var weight = e.bag[w];

        // Không khớp nguyên từ thì thử khớp tiền tố — cứu các trường hợp
        // "sign"/"signature", "merkle"/"merkletree", "khoa"/"khoacongkhai".
        if (!weight) {
          for (var i = 0; i < e.keys.length; i++) {
            var k = e.keys[i];
            if (w.length >= 4 && k.indexOf(w) === 0) { weight = e.bag[k] * 0.6; break; }
            if (k.length >= 4 && w.indexOf(k) === 0) { weight = e.bag[k] * 0.5; break; }
          }
        }
        if (weight) { raw += weight * (idx.idf[w] || 1); hits++; }
      });

      /* Điểm trung bình mỗi từ, rồi nhân với ĐỘ PHỦ — tỉ lệ từ trong câu hỏi
         thực sự tìm thấy ở mục này. Không có bước này, một câu lạc đề dài chỉ
         cần tình cờ trùng đúng một từ hiếm là đã đủ điểm để được trả lời. */
      var coverage = hits / qw.length;
      var score = (raw / qw.length) * (0.35 + 0.65 * coverage);

      // Trùng khít câu hỏi mẫu ⇒ gần như chắc chắn đúng mục. Đây là thứ tách
      // "hàm băm là gì" (khái niệm) khỏi "bàn thử hàm băm" (hướng dẫn).
      if (e.qn) {
        if (e.qn === qjoin) score += 14;
        else if (qjoin.length > 4 && (e.qn.indexOf(qjoin) >= 0 || qjoin.indexOf(e.qn) >= 0)) score += 6;
      }

      // Cả cụm người dùng gõ nằm gọn trong vùng từ khoá.
      if (flat.length > 6 && e.kwn.indexOf(flat) >= 0) score += 6;

      /* Ngữ cảnh trang: nhân thêm chứ không cộng thêm, để mức ưu tiên giữ
         nguyên tỉ lệ dù điểm gốc lớn hay nhỏ. */
      if (opts.route && e.item.route === opts.route) score *= 1.35;

      return { item: e.item, score: score };
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    var best = scored[0];

    if (!best || best.score < FLOOR) {
      return {
        kind: 'unsure',
        score: best ? best.score : 0,
        alts: scored.slice(0, 3).filter(function (s) { return s.score > 1; })
                    .map(function (s) { return s.item; })
      };
    }

    return {
      kind: 'answer',
      entry: best.item,
      score: best.score,
      alts: scored.slice(1, 4).filter(function (s) { return s.score > FLOOR * 0.45; })
                  .map(function (s) { return s.item; })
    };
  }

  /* ------------------------------------------------------------- tiện ích */

  function byId(id) {
    for (var i = 0; i < KB.length; i++) if (KB[i].id === id) return KB[i];
    return null;
  }

  /** Lấy danh sách mục theo mảng id, bỏ qua id không tồn tại. */
  function pick(ids) {
    return ids.map(byId).filter(Boolean);
  }

  /** Các mục nên đọc tiếp sau một mục. */
  function related(item) {
    return item && item.next ? pick(item.next) : [];
  }

  /**
   * Gợi ý mở màn: ưu tiên các mục thuộc trang đang xem, rồi bù thêm cho đủ.
   * Nhờ vậy mở trợ lý ở trang Sổ cái sẽ thấy câu hỏi về khối, không phải về ví.
   */
  function suggest(route, limit) {
    limit = limit || 4;
    var out = KB.filter(function (k) { return route && k.route === route; });
    pick(['g-tour', 'blockchain', 'hash', 'g-bot']).forEach(function (k) {
      if (out.length < limit && out.indexOf(k) < 0) out.push(k);
    });
    return out.slice(0, limit);
  }

  /** Thống kê kho tri thức — gõ DLU.assistant.audit() trong Console. */
  function audit() {
    var langs = ['vi', 'en'];
    var report = { entries: KB.length, missing: [] };
    KB.forEach(function (k) {
      langs.forEach(function (l) {
        if (!k.kw[l] || !k.q[l] || !k.a[l]) report.missing.push(k.id + ' · ' + l);
      });
      (k.next || []).forEach(function (id) {
        if (!byId(id)) report.missing.push(k.id + ' → ' + id + ' (không có mục này)');
      });
    });
    langs.forEach(function (l) { report[l + 'Terms'] = Object.keys(getIndex(l).idf).length; });
    return report;
  }

  DLU.assistant = {
    ask: ask, byId: byId, pick: pick, related: related, suggest: suggest,
    audit: audit, KB: KB, norm: norm
  };
})(typeof window !== 'undefined' ? window : globalThis);
