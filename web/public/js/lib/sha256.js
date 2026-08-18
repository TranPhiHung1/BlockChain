/* =============================================================================
 *  sha256.js — Cài đặt thuật toán băm SHA-256 thuần JavaScript (đồng bộ)
 * -----------------------------------------------------------------------------
 *  Vì sao không dùng crypto.subtle.digest() của trình duyệt?
 *    - crypto.subtle là API BẤT ĐỒNG BỘ (trả về Promise) và chỉ chạy trong
 *      "secure context" (https / localhost). Vòng lặp đào khối Proof-of-Work
 *      cần gọi hàm băm hàng chục nghìn lần/giây nên cần một hàm ĐỒNG BỘ.
 *    - Cài đặt tay cũng giúp người học nhìn thấy toàn bộ thuật toán
 *      (chuẩn FIPS 180-4) thay vì coi nó như hộp đen.
 *
 *  Xuất ra: window.DLU.sha256(text) -> chuỗi hex 64 ký tự
 * ========================================================================== */
(function (global) {
  'use strict';

  // 64 hằng số K: 32 bit đầu của phần thập phân căn bậc ba của 64 số nguyên tố đầu tiên
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  // 8 giá trị băm khởi tạo: 32 bit đầu phần thập phân căn bậc hai của 8 số nguyên tố đầu
  var H0 = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  var HEX = '0123456789abcdef';
  var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  /** Xoay phải (rotate right) một số 32 bit */
  function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  /** Chuyển chuỗi UTF-8 thành mảng byte (có fallback nếu thiếu TextEncoder) */
  function utf8Bytes(str) {
    if (encoder) return encoder.encode(str);
    var utf8 = unescape(encodeURIComponent(str));
    var out = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i);
    return out;
  }

  /**
   * Băm SHA-256 một chuỗi văn bản.
   * @param {string} message dữ liệu đầu vào
   * @returns {string} chuỗi hex 64 ký tự (256 bit)
   */
  function sha256(message) {
    var bytes = utf8Bytes(String(message));
    var len = bytes.length;

    // --- Bước 1: Padding -------------------------------------------------
    // Thêm bit '1' (byte 0x80), thêm các byte 0, và 8 byte cuối là độ dài bit
    var totalLen = ((len + 9 + 63) >> 6) << 6; // bội số 64 gần nhất
    var buf = new Uint8Array(totalLen);
    buf.set(bytes);
    buf[len] = 0x80;

    var view = new DataView(buf.buffer);
    var bitLen = len * 8;
    view.setUint32(totalLen - 8, Math.floor(bitLen / 4294967296)); // 32 bit cao
    view.setUint32(totalLen - 4, bitLen >>> 0);                    // 32 bit thấp

    // --- Bước 2: Nén từng khối 512 bit -----------------------------------
    var H = H0.slice();
    var w = new Uint32Array(64);

    for (var off = 0; off < totalLen; off += 64) {
      // Mở rộng 16 word đầu thành 64 word
      for (var t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4);
      for (t = 16; t < 64; t++) {
        var w15 = w[t - 15], w2 = w[t - 2];
        var s0 = (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) >>> 0;
        var s1 = (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3];
      var e = H[4], f = H[5], g = H[6], h = H[7];

      // 64 vòng nén
      for (t = 0; t < 64; t++) {
        var S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (S0 + maj) >>> 0;

        h = g; g = f; f = e;
        e = (d + temp1) >>> 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    // --- Bước 3: Ghép 8 word thành chuỗi hex 64 ký tự --------------------
    var hex = '';
    for (var i = 0; i < 8; i++) {
      var word = H[i];
      for (var shift = 28; shift >= 0; shift -= 4) {
        hex += HEX[(word >>> shift) & 0x0f];
      }
    }
    return hex;
  }

  global.DLU = global.DLU || {};
  global.DLU.sha256 = sha256;
})(typeof window !== 'undefined' ? window : globalThis);
