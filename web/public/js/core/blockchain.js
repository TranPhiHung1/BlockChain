/* =============================================================================
 *  blockchain.js — Khối (Block) & Chuỗi khối (Blockchain)
 * -----------------------------------------------------------------------------
 *  Bản chuyển ngữ từ Block_BlockChain.py sang JavaScript.
 *
 *  Điểm mấu chốt: Blockchain kế thừa nguyên cấu trúc danh sách liên kết đơn
 *  (xem linked-list.js) — có head, có tail, mỗi khối trỏ tới khối kế tiếp qua
 *  `next`. Điều làm nên "chuỗi khối" là con trỏ NGƯỢC bằng mật mã:
 *
 *        hash = SHA256( previous_hash + timestamp + data + nonce )
 *
 *  Sửa `data` của một khối ⇒ hash khối đó đổi ⇒ `previous_hash` của khối sau
 *  không còn khớp ⇒ toàn bộ phần đuôi của chuỗi gãy. Đó là tính bất biến.
 *
 *  Ghi chú về `nonce`: bản Python không có trường này. Khi nonce = 0 (mặc định,
 *  độ khó = 0) công thức băm ở đây trùng khớp hoàn toàn với bản Python; nonce
 *  chỉ được dùng tới ở trang Giao thức đồng thuận (Proof-of-Work).
 *
 *  Xuất ra: window.DLU.Block, window.DLU.Blockchain
 * ========================================================================== */
(function (global) {
  'use strict';

  var DLU = (global.DLU = global.DLU || {});
  var sha256 = DLU.sha256;
  var ZERO_HASH = new Array(65).join('0'); // 64 số 0 — "khối trước" của Genesis

  /**
   * Một khối trong chuỗi.
   * @param {string} data dữ liệu/giao dịch chứa trong khối
   * @param {string} previousHash mã băm của khối liền trước
   * @param {number} [timestamp] mốc thời gian (giây, có phần thập phân)
   */
  function Block(data, previousHash, timestamp) {
    this.data = data;
    this.previousHash = previousHash;
    // time.time() của Python trả về giây kiểu float — giữ 3 chữ số thập phân
    this.timestamp = typeof timestamp === 'number' ? timestamp : Date.now() / 1000;
    this.nonce = 0;
    // Độ khó mà khối này ĐÃ được đào — giống trường `bits`/target trong header
    // khối Bitcoin. Nhờ lưu riêng từng khối, việc chỉnh độ khó của chuỗi chỉ
    // ảnh hưởng tới các khối tạo sau, không làm mất hiệu lực khối cũ.
    this.difficulty = 0;
    // Gốc Merkle của tập giao dịch trong khối (xem core/merkle.js). Trang Sổ cái
    // và trang Mắt xích không dùng tới nên để rỗng — khi rỗng, chuỗi nguyên liệu
    // băm trùng khớp y hệt bản Python. Trang Mạng lưới thì gán gốc Merkle thật
    // và chính nó khoá toàn bộ giao dịch vào mã băm của khối.
    this.merkleRoot = '';
    this.txs = [];                    // danh sách giao dịch (nếu khối có mang)
    this.miner = '';                  // nút đã đóng được khối này
    this.next = null;                 // con trỏ danh sách liên kết
    this.hash = this.computeHash();   // vân tay SHA-256 của khối
  }

  /**
   * Chuỗi nguyên liệu được đưa vào hàm băm — hiển thị nguyên văn trên giao diện.
   * Tương ứng phần đầu khối (block header) của Bitcoin:
   *     previous_hash ‖ timestamp ‖ data ‖ merkle_root ‖ nonce
   */
  Block.prototype.headerString = function () {
    return '' + this.previousHash + this.timestamp + this.data +
           (this.merkleRoot || '') + (this.nonce || '');
  };

  /** Tính lại mã băm từ nội dung hiện tại của khối. */
  Block.prototype.computeHash = function () {
    return sha256(this.headerString());
  };

  /**
   * Khối đã thoả độ khó chưa (hash bắt đầu bằng `difficulty` số 0)?
   * Bỏ trống tham số ⇒ kiểm theo độ khó đã ghi trong chính khối.
   */
  Block.prototype.meetsDifficulty = function (difficulty) {
    var k = (difficulty === undefined || difficulty === null) ? this.difficulty : difficulty;
    if (!k) return true;
    return this.hash.slice(0, k) === new Array(k + 1).join('0');
  };

  /* ---------------------------------------------------------------------- */

  /**
   * Chuỗi khối — quản lý danh sách liên kết các Block.
   * @param {object} [opts] { genesisData, difficulty, autoGenesis }
   */
  function Blockchain(opts) {
    opts = opts || {};
    this.head = null;
    this.tail = null;
    this.length = 0;
    this.difficulty = opts.difficulty || 0;
    if (opts.autoGenesis !== false) {
      this.addBlock(opts.genesisData || 'Genesis Block');
    }
  }

  Blockchain.ZERO_HASH = ZERO_HASH;

  /**
   * Thêm một khối mới vào cuối chuỗi.
   * @param {string} data nội dung khối
   * @returns {Block} khối vừa tạo
   */
  Blockchain.prototype.addBlock = function (data) {
    // Khối đầu tiên không có khối trước ⇒ previous_hash là 64 số 0
    var previousHash = this.tail ? this.tail.hash : ZERO_HASH;
    var newBlock = new Block(data, previousHash);

    if (this.difficulty) this.mine(newBlock); // đào tại chỗ nếu bật độ khó

    if (this.head) {
      this.tail.next = newBlock;
      this.tail = newBlock;
    } else {
      this.head = newBlock;
      this.tail = newBlock;
    }
    this.length++;
    return newBlock;
  };

  /**
   * Đào khối đồng bộ: tăng nonce tới khi hash bắt đầu bằng đủ số 0.
   * (Bản bất đồng bộ, không chặn giao diện, nằm ở consensus.js)
   * @returns {number} số lần thử
   */
  Blockchain.prototype.mine = function (block, difficulty) {
    var k = difficulty || this.difficulty;
    var target = new Array(k + 1).join('0');
    var attempts = 0;
    block.difficulty = k;
    block.nonce = 0;
    block.hash = block.computeHash();
    while (block.hash.slice(0, target.length) !== target) {
      block.nonce++;
      block.hash = block.computeHash();
      attempts++;
    }
    return attempts;
  };

  /**
   * Kiểm tra tính toàn vẹn của toàn chuỗi — tương ứng `is_Valid` bản Python.
   * @returns {boolean}
   */
  Blockchain.prototype.isValid = function () {
    var current = this.head;
    while (current) {
      // ĐK1: dữ liệu khối có bị sửa không? (hash lưu trữ ≠ hash tính lại)
      if (current.hash !== current.computeHash()) return false;
      // ĐK2: mắt xích với khối sau có còn khớp không?
      if (current.next && current.next.previousHash !== current.hash) return false;
      current = current.next;
    }
    return true;
  };

  /**
   * Bản kiểm tra "chi tiết": trả về trạng thái từng khối để giao diện tô màu.
   *
   * Khác biệt nhỏ so với isValid(): mắt xích được đối chiếu với hash TÍNH LẠI
   * của khối trước (`prev.computeHash()`) thay vì hash đang lưu. Nhờ vậy khi
   * người dùng sửa dữ liệu khối i, giao diện chỉ đúng được vị trí sợi xích đứt
   * là giữa khối i và i+1. Kết luận hợp lệ/không hợp lệ của cả chuỗi thì không
   * đổi, vì khối bị sửa đã tự vi phạm điều kiện `dataOk`.
   *
   * @returns {Array<{block: Block, index: number, dataOk: boolean,
   *                  linkOk: boolean, powOk: boolean, valid: boolean}>}
   */
  Blockchain.prototype.validateDetailed = function () {
    var report = [];
    var current = this.head;
    var index = 0;
    var prev = null;
    while (current) {
      var dataOk = current.hash === current.computeHash();
      var linkOk = prev ? current.previousHash === prev.computeHash()
                        : current.previousHash === ZERO_HASH;
      var powOk = current.meetsDifficulty();   // theo độ khó ghi trong chính khối
      report.push({
        block: current, index: index,
        dataOk: dataOk, linkOk: linkOk, powOk: powOk,
        valid: dataOk && linkOk && powOk
      });
      prev = current;
      current = current.next;
      index++;
    }
    return report;
  };

  /**
   * Sửa dữ liệu một khối mà KHÔNG cập nhật hash — mô phỏng kẻ gian lận.
   * Giống dòng `chain.head.next.data = "Alice gui 100 BTC cho Bob"` bản Python.
   */
  Blockchain.prototype.tamper = function (index, newData) {
    var block = this.at(index);
    if (!block) return null;
    block.data = newData;
    return block;
  };

  /**
   * "Vá" lại chuỗi từ vị trí `index`: tính lại hash và nối lại các mắt xích.
   * Đây chính là việc kẻ tấn công phải làm — và với PoW thì phải đào lại toàn bộ.
   * @returns {number} tổng số lần thử băm đã tốn
   */
  Blockchain.prototype.recomputeFrom = function (index) {
    var blocks = this.toArray();
    var attempts = 0;
    for (var i = Math.max(0, index); i < blocks.length; i++) {
      blocks[i].previousHash = i === 0 ? ZERO_HASH : blocks[i - 1].hash;
      if (this.difficulty) {
        attempts += this.mine(blocks[i]);
      } else {
        blocks[i].hash = blocks[i].computeHash();
      }
    }
    return attempts;
  };

  /** Lấy khối thứ `index` (0-based). */
  Blockchain.prototype.at = function (index) {
    var current = this.head;
    var i = 0;
    while (current) {
      if (i === index) return current;
      current = current.next;
      i++;
    }
    return null;
  };

  /** Mảng các khối theo thứ tự chuỗi. */
  Blockchain.prototype.toArray = function () {
    var out = [];
    var current = this.head;
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };

  /** Chuỗi văn bản mô tả toàn chuỗi — tương ứng `show` bản Python. */
  Blockchain.prototype.show = function () {
    var lines = [];
    this.toArray().forEach(function (b, i) {
      lines.push('Block ' + i + ': ' + b.data);
      lines.push('  prev: ' + b.previousHash);
      lines.push('  hash: ' + b.hash);
    });
    return lines.join('\n');
  };

  /** Bản sao độc lập của chuỗi (mỗi nút mạng giữ một bản sao riêng). */
  Blockchain.prototype.clone = function () {
    var copy = new Blockchain({ autoGenesis: false, difficulty: this.difficulty });
    this.toArray().forEach(function (b) {
      var nb = new Block(b.data, b.previousHash, b.timestamp);
      nb.nonce = b.nonce;
      nb.difficulty = b.difficulty;
      nb.merkleRoot = b.merkleRoot;
      nb.txs = b.txs.slice();         // cùng tham chiếu giao dịch, khác mảng
      nb.miner = b.miner;
      nb.hash = b.hash;               // sao chép nguyên trạng, kể cả khi đã hỏng
      if (copy.tail) { copy.tail.next = nb; copy.tail = nb; }
      else { copy.head = nb; copy.tail = nb; }
      copy.length++;
    });
    return copy;
  };

  DLU.Block = Block;
  DLU.Blockchain = Blockchain;
})(typeof window !== 'undefined' ? window : globalThis);
