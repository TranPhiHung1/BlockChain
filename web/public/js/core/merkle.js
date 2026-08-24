/* =============================================================================
 *  merkle.js — Cây Merkle & gốc Merkle (Merkle Tree / Merkle Root)
 * -----------------------------------------------------------------------------
 *  Một khối chứa hàng nghìn giao dịch. Nhét cả nghìn giao dịch vào phần đầu khối
 *  (block header) là điều không tưởng, mà bỏ ra ngoài thì lấy gì bảo đảm chúng
 *  không bị đánh tráo? Ralph Merkle (1979) trả lời: băm từng giao dịch thành lá,
 *  rồi băm từng cặp lá lên dần cho tới khi còn ĐÚNG MỘT mã băm — gốc Merkle.
 *
 *        root = H( H(H(tx0)+H(tx1)) + H(H(tx2)+H(tx3)) )
 *
 *  Chỉ cần 32 byte gốc Merkle nằm trong header là toàn bộ tập giao dịch đã bị
 *  khoá chặt: đổi một chữ số của một giao dịch ⇒ lá đổi ⇒ mọi nút cha trên
 *  đường đi đổi ⇒ gốc Merkle đổi ⇒ mã băm khối đổi ⇒ mắt xích gãy.
 *
 *  Số lá lẻ thì lá cuối được nhân đôi để ghép cặp — đúng quy ước của Bitcoin.
 *
 *  Khác biệt so với Bitcoin: Bitcoin băm hai lần trên chuỗi BYTE
 *  (SHA256(SHA256(x))), ở đây băm MỘT lần trên chuỗi HEX vì cả đồ án dùng chung
 *  một hàm băm tự cài trong lib/sha256.js. Tính chất mật mã cần cho bài học —
 *  một bit đổi thì gốc đổi — vẫn giữ nguyên.
 *
 *  Xuất ra: window.DLU.merkle
 * ========================================================================== */
(function (global) {
  'use strict';

  var DLU = (global.DLU = global.DLU || {});
  var sha256 = DLU.sha256;
  var ZERO_HASH = new Array(65).join('0');

  /** Mã băm của một nút cha: H(trái + phải). */
  function hashPair(left, right) {
    return sha256(left + right);
  }

  /**
   * Dựng toàn bộ cây từ danh sách mã băm lá.
   *
   * @param {string[]} leaves mã băm của từng giao dịch (txid)
   * @returns {{levels: string[][], root: string, size: number, depth: number,
   *            duplicated: boolean[]}}
   *   levels[0] là hàng lá, levels[levels.length-1] là hàng gốc (đúng 1 phần tử).
   *   duplicated[i] = true nếu ở tầng i lá/nút cuối phải tự nhân đôi để đủ cặp.
   */
  function build(leaves) {
    leaves = (leaves || []).slice();

    if (!leaves.length) {
      return { levels: [[ZERO_HASH]], root: ZERO_HASH, size: 0, depth: 0, duplicated: [] };
    }

    var levels = [leaves];
    var duplicated = [];
    var current = leaves;

    while (current.length > 1) {
      var odd = current.length % 2 === 1;
      duplicated.push(odd);

      var parents = [];
      for (var i = 0; i < current.length; i += 2) {
        // Lá lẻ ⇒ ghép chính nó với chính nó
        var left = current[i];
        var right = (i + 1 < current.length) ? current[i + 1] : current[i];
        parents.push(hashPair(left, right));
      }
      levels.push(parents);
      current = parents;
    }

    return {
      levels: levels,
      root: current[0],
      size: leaves.length,
      depth: levels.length - 1,
      duplicated: duplicated
    };
  }

  /** Lối tắt: chỉ cần gốc Merkle. */
  function root(leaves) {
    return build(leaves).root;
  }

  /**
   * Đường chứng minh Merkle (Merkle proof / authentication path) cho lá thứ
   * `index`: danh sách các mã băm anh em cần thiết để leo ngược lên gốc.
   *
   * Đây chính là thứ cho phép ví nhẹ (SPV) kiểm chứng "giao dịch của tôi nằm
   * trong khối này" mà không cần tải cả khối — chỉ cần log2(n) mã băm.
   *
   * @returns {Array<{hash: string, side: 'left'|'right'}>}
   */
  function proof(tree, index) {
    var path = [];
    if (!tree || !tree.levels.length || index < 0 || index >= tree.size) return path;

    var idx = index;
    for (var level = 0; level < tree.levels.length - 1; level++) {
      var row = tree.levels[level];
      var isRight = idx % 2 === 1;
      var siblingIdx = isRight ? idx - 1 : idx + 1;
      if (siblingIdx >= row.length) siblingIdx = idx;   // lá lẻ tự ghép với mình
      path.push({
        hash: row[siblingIdx],
        side: isRight ? 'left' : 'right'   // anh em nằm bên nào khi ghép
      });
      idx = Math.floor(idx / 2);
    }
    return path;
  }

  /**
   * Kiểm chứng một đường Merkle: leo từ lá lên, có ra đúng gốc không?
   * @returns {{valid: boolean, computed: string}}
   */
  function verifyProof(leafHash, path, expectedRoot) {
    var acc = leafHash;
    (path || []).forEach(function (step) {
      acc = step.side === 'left' ? hashPair(step.hash, acc) : hashPair(acc, step.hash);
    });
    return { valid: acc === expectedRoot, computed: acc };
  }

  DLU.merkle = {
    build: build,
    root: root,
    proof: proof,
    verifyProof: verifyProof,
    hashPair: hashPair,
    ZERO_HASH: ZERO_HASH
  };
})(typeof window !== 'undefined' ? window : globalThis);
