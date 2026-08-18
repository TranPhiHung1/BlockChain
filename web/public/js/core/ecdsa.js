/* =============================================================================
 *  ecdsa.js — Cặp khoá bất đối xứng & Chữ ký số trên đường cong secp256k1
 * -----------------------------------------------------------------------------
 *  Bản chuyển ngữ của Key.py sang JavaScript.
 *
 *  Vì sao phải tự cài đặt?
 *    Web Crypto API của trình duyệt CHỈ hỗ trợ các đường cong NIST (P-256,
 *    P-384, P-521). Đường cong secp256k1 mà Bitcoin và Ethereum dùng không có
 *    trong danh sách đó, nên muốn làm đúng như Key.py thì buộc phải tự cài.
 *    Toàn bộ số học 256-bit dựa trên kiểu BigInt sẵn có của JavaScript.
 *
 *  Đường cong secp256k1:      y² = x³ + 7   (mod p)
 *
 *  ⚠️ LƯU Ý: đây là mã phục vụ GIẢNG DẠY. Nó không chống tấn công kênh kề
 *     (side-channel) như thư viện thật, nên đừng dùng để giữ tài sản thật.
 *
 *  Xuất ra: window.DLU.ecdsa
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  /* =======================================================================
   *  0. THAM SỐ ĐƯỜNG CONG (chuẩn SEC 2, secp256k1)
   * ===================================================================== */
  var CURVE = {
    // Số nguyên tố xác định trường hữu hạn F_p
    p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
    a: BigInt(0),
    b: BigInt(7),
    // Điểm sinh G — mọi khoá công khai đều là một bội số của điểm này
    Gx: BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
    Gy: BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'),
    // Bậc của G: số điểm sinh ra được. Khoá riêng phải nằm trong [1, n-1]
    n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')
  };

  var ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), THREE = BigInt(3);

  /* =======================================================================
   *  1. SỐ HỌC ĐỒNG DƯ
   * ===================================================================== */

  /** Phép mod luôn trả kết quả không âm (toán tử % của JS giữ dấu). */
  function mod(value, m) {
    m = m || CURVE.p;
    var r = value % m;
    return r >= ZERO ? r : r + m;
  }

  /**
   * Nghịch đảo modulo bằng Euclid mở rộng: tìm x sao cho a·x ≡ 1 (mod m).
   * Đây là phép tốn kém nhất trong tệp, dùng ở mỗi lần cộng điểm.
   */
  function modInv(a, m) {
    m = m || CURVE.p;
    // r  : dãy số dư của thuật toán Euclid
    // s  : hệ số Bézout đi kèm, khi r về 0 thì s chính là nghịch đảo cần tìm
    var oldR = mod(a, m), r = m;
    var oldS = ONE, s = ZERO;
    while (r !== ZERO) {
      var q = oldR / r;                      // BigInt chia lấy phần nguyên
      var tmp = r;  r  = oldR - q * r;  oldR = tmp;
      tmp     = s;  s  = oldS - q * s;  oldS = tmp;
    }
    if (oldR !== ONE) throw new Error('Không tồn tại nghịch đảo modulo');
    return mod(oldS, m);
  }

  /* =======================================================================
   *  2. HÌNH HỌC TRÊN ĐƯỜNG CONG
   *     Điểm biểu diễn bằng { x, y }; giá trị null là điểm vô cực O.
   * ===================================================================== */

  /** Cộng hai điểm: kẻ đường thẳng qua P và Q, lấy giao điểm thứ ba, lật qua trục x. */
  function pointAdd(P, Q) {
    if (P === null) return Q;
    if (Q === null) return P;

    if (P.x === Q.x) {
      // Hai điểm đối xứng qua trục hoành ⇒ tổng là điểm vô cực
      if (mod(P.y + Q.y) === ZERO) return null;
      return pointDouble(P);
    }

    var lam = mod((Q.y - P.y) * modInv(Q.x - P.x));   // hệ số góc
    var x3 = mod(lam * lam - P.x - Q.x);
    return { x: x3, y: mod(lam * (P.x - x3) - P.y) };
  }

  /** Nhân đôi một điểm: dùng tiếp tuyến tại P thay cho cát tuyến. */
  function pointDouble(P) {
    if (P === null || P.y === ZERO) return null;
    var lam = mod((THREE * P.x * P.x + CURVE.a) * modInv(TWO * P.y));
    var x3 = mod(lam * lam - TWO * P.x);
    return { x: x3, y: mod(lam * (P.x - x3) - P.y) };
  }

  /**
   * Nhân vô hướng k·P theo thuật toán "nhân đôi rồi cộng".
   *
   * ĐÂY LÀ CỬA SẬP MỘT CHIỀU của mật mã đường cong elliptic:
   *   • Tính k·G khi biết k: khoảng 256 phép nhân đôi ⇒ vài mili-giây.
   *   • Tìm ngược k khi chỉ biết k·G (bài toán logarit rời rạc): với đường cong
   *     256-bit ước tính cần 2¹²⁸ phép tính — chưa ai làm được.
   * Nhờ vậy mới dám công khai khoá công khai mà không sợ lộ khoá riêng.
   */
  function scalarMult(k, P) {
    var result = null;
    var addend = P;
    k = mod(k, CURVE.n);
    while (k > ZERO) {
      if (k & ONE) result = pointAdd(result, addend);
      addend = pointDouble(addend);
      k >>= ONE;
    }
    return result;
  }

  var G = { x: CURVE.Gx, y: CURVE.Gy };

  /** Điểm có thực sự nằm trên đường cong y² = x³ + 7 không? */
  function isOnCurve(P) {
    if (P === null) return false;
    return mod(P.y * P.y - P.x * P.x * P.x - CURVE.b) === ZERO;
  }

  /* =======================================================================
   *  3. CHUYỂN ĐỔI ĐỊNH DẠNG
   * ===================================================================== */

  /** BigInt → chuỗi hex đệm 0 cho đủ `len` ký tự (mặc định 64 = 256 bit). */
  function toHex(value, len) {
    var hex = value.toString(16);
    len = len || 64;
    while (hex.length < len) hex = '0' + hex;
    return hex;
  }

  function fromHex(hex) {
    return BigInt('0x' + String(hex).replace(/[^0-9a-fA-F]/g, ''));
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return hex;
  }

  /* =======================================================================
   *  4. SINH KHOÁ
   * ===================================================================== */

  /** 32 byte ngẫu nhiên lấy từ nguồn ngẫu nhiên mật mã của trình duyệt. */
  function randomBytes32() {
    var bytes = new Uint8Array(32);
    var webCrypto = global.crypto || global.msCrypto;
    if (webCrypto && webCrypto.getRandomValues) {
      webCrypto.getRandomValues(bytes);
    } else {
      // Dự phòng cho trình duyệt quá cũ — KHÔNG an toàn, chỉ để demo chạy được
      for (var i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  /**
   * Sinh một cặp khoá mới.
   * Tương ứng `ec.generate_private_key(ec.SECP256K1())` trong Key.py.
   */
  function generateKeyPair() {
    var d;
    do {
      d = fromHex(bytesToHex(randomBytes32()));
    } while (d <= ZERO || d >= CURVE.n);   // khoá riêng phải nằm trong [1, n-1]
    return derivePublic(toHex(d));
  }

  /**
   * Suy ra khoá công khai từ khoá riêng — phép nhân điểm Q = d·G.
   * Tương ứng `private_key.public_key()` trong Key.py.
   */
  function derivePublic(privateHex) {
    var d = fromHex(privateHex);
    if (d <= ZERO || d >= CURVE.n) {
      throw new Error('Khoá riêng nằm ngoài khoảng hợp lệ [1, n-1]');
    }

    var Q = scalarMult(d, G);
    var xHex = toHex(Q.x), yHex = toHex(Q.y);

    return {
      privateHex: toHex(d),
      x: xHex,
      y: yHex,
      // Dạng KHÔNG NÉN: tiền tố 04 rồi ghép hai toạ độ ⇒ 130 ký tự hex
      uncompressed: '04' + xHex + yHex,
      // Dạng NÉN: chỉ cần toạ độ x cùng tính chẵn/lẻ của y ⇒ 66 ký tự hex
      compressed: ((Q.y % TWO) === ZERO ? '02' : '03') + xHex,
      point: Q
    };
  }

  /* =======================================================================
   *  5. MÃ HOÁ DER / PEM
   *     PEM = phần DER nhị phân đem mã hoá Base64 rồi bọc trong hai dòng nhãn.
   * ===================================================================== */

  /** Gói một khối DER: <thẻ><độ dài><nội dung>, có xử lý dạng độ dài nhiều byte. */
  function derWrap(tag, contentHex) {
    var len = contentHex.length / 2;
    var lenHex;
    if (len < 0x80) {
      lenHex = toHex(BigInt(len), 2);
    } else if (len < 0x100) {
      lenHex = '81' + toHex(BigInt(len), 2);
    } else {
      lenHex = '82' + toHex(BigInt(len), 4);
    }
    return tag + lenHex + contentHex;
  }

  /** DER INTEGER: bỏ byte 0 thừa ở đầu, thêm 0x00 nếu byte đầu ≥ 0x80 (tránh bị hiểu là số âm). */
  function derInteger(value) {
    var hex = value.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    if (parseInt(hex.substr(0, 2), 16) >= 0x80) hex = '00' + hex;
    return derWrap('02', hex);
  }

  // Định danh đối tượng (OID) đã mã hoá sẵn dưới dạng DER
  var OID_EC_PUBLIC_KEY = '06072a8648ce3d0201';  // 1.2.840.10045.2.1  id-ecPublicKey
  var OID_SECP256K1     = '06052b8104000a';      // 1.3.132.0.10       secp256k1
  var ALGORITHM_ID      = derWrap('30', OID_EC_PUBLIC_KEY + OID_SECP256K1);

  /** Nhị phân → Base64, cắt dòng 64 ký tự, bọc nhãn BEGIN/END. */
  function toPem(derHex, label) {
    var bytes = hexToBytes(derHex);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    var b64 = global.btoa(binary);

    var lines = [];
    for (var j = 0; j < b64.length; j += 64) lines.push(b64.substr(j, 64));
    return '-----BEGIN ' + label + '-----\n' + lines.join('\n') +
           '\n-----END ' + label + '-----';
  }

  /**
   * Khoá riêng theo chuẩn PKCS#8 — giống `PrivateFormat.PKCS8` trong Key.py.
   *
   *   SEQUENCE {
   *     INTEGER 0                                  -- phiên bản
   *     SEQUENCE { OID ecPublicKey, OID secp256k1 }
   *     OCTET STRING {                             -- bọc ECPrivateKey bên trong
   *       SEQUENCE {
   *         INTEGER 1
   *         OCTET STRING (32 byte khoá riêng)
   *         [1] BIT STRING (khoá công khai không nén)
   *       }
   *     }
   *   }
   */
  function privateKeyPem(keys) {
    var pubBits = derWrap('03', '00' + keys.uncompressed);
    var ecPrivateKey = derWrap('30',
      derInteger(ONE) +
      derWrap('04', keys.privateHex) +
      derWrap('a1', pubBits));

    var pkcs8 = derWrap('30',
      derInteger(ZERO) +
      ALGORITHM_ID +
      derWrap('04', ecPrivateKey));

    return toPem(pkcs8, 'PRIVATE KEY');
  }

  /**
   * Khoá công khai theo chuẩn X.509 SubjectPublicKeyInfo —
   * giống `PublicFormat.SubjectPublicKeyInfo` trong Key.py.
   */
  function publicKeyPem(keys) {
    var spki = derWrap('30', ALGORITHM_ID + derWrap('03', '00' + keys.uncompressed));
    return toPem(spki, 'PUBLIC KEY');
  }

  /* =======================================================================
   *  6. KÝ SỐ & XÁC MINH (ECDSA + SHA-256)
   * ===================================================================== */

  /** Băm thông điệp thành số nguyên z — bản "tóm tắt" đem ra ký. */
  function messageHash(message) {
    return fromHex(DLU.sha256(message));
  }

  /**
   * Ký thông điệp bằng khoá riêng.
   * Tương ứng `private_key.sign(message, ec.ECDSA(hashes.SHA256()))` trong Key.py.
   *
   * @returns {{r,s,der,bytes,z,k}} chữ ký kèm các giá trị trung gian để trưng bày
   */
  function sign(privateHex, message) {
    var d = fromHex(privateHex);
    var z = messageHash(message);
    var r, s, k, R;

    do {
      // k phải NGẪU NHIÊN và CHỈ DÙNG MỘT LẦN. Lộ k, hoặc dùng lại k cho hai
      // thông điệp khác nhau, là lộ luôn khoá riêng — đúng lỗi khiến máy chơi
      // game Sony PS3 bị bẻ khoá năm 2010.
      do {
        k = fromHex(bytesToHex(randomBytes32()));
      } while (k <= ZERO || k >= CURVE.n);

      R = scalarMult(k, G);
      r = mod(R.x, CURVE.n);
      if (r === ZERO) continue;

      s = mod(modInv(k, CURVE.n) * (z + r * d), CURVE.n);
    } while (r === ZERO || s === ZERO);

    var der = derWrap('30', derInteger(r) + derInteger(s));

    return {
      r: toHex(r), s: toHex(s),
      der: der,
      bytes: der.length / 2,
      z: toHex(z),
      k: toHex(k)
    };
  }

  /** Đọc ngược cặp (r, s) từ chuỗi DER. Trả về null nếu định dạng hỏng. */
  function parseDer(derHex) {
    try {
      var clean = String(derHex).replace(/[^0-9a-fA-F]/g, '');
      if (clean.length % 2) return null;
      var bytes = hexToBytes(clean);
      if (bytes[0] !== 0x30) return null;

      var i = 2;
      if (bytes[1] > 0x80) i = 2 + (bytes[1] - 0x80);

      if (bytes[i] !== 0x02) return null;
      var rLen = bytes[i + 1];
      var r = fromHex(bytesToHex(bytes.slice(i + 2, i + 2 + rLen)));
      i = i + 2 + rLen;

      if (bytes[i] !== 0x02) return null;
      var sLen = bytes[i + 1];
      var s = fromHex(bytesToHex(bytes.slice(i + 2, i + 2 + sLen)));

      return { r: r, s: s };
    } catch (e) {
      return null;
    }
  }

  /** Đọc điểm khoá công khai từ chuỗi hex dạng không nén (04 + X + Y). */
  function parsePublicKey(pubHex) {
    var clean = String(pubHex).replace(/[^0-9a-fA-F]/g, '');
    if (clean.length !== 130 || clean.substr(0, 2) !== '04') return null;
    var P = { x: fromHex(clean.substr(2, 64)), y: fromHex(clean.substr(66, 64)) };
    return isOnCurve(P) ? P : null;
  }

  /**
   * Xác minh chữ ký bằng khoá công khai.
   * Tương ứng `public_key.verify(...)` trong Key.py — nhưng trả về true/false
   * kèm lý do thất bại, thay vì ném ngoại lệ, để giao diện giải thích cho người học.
   *
   * @returns {{valid: boolean, reason: string}}
   */
  function verify(publicHex, message, derHex) {
    var Q = parsePublicKey(publicHex);
    if (!Q) return { valid: false, reason: 'badKey' };

    var sig = parseDer(derHex);
    if (!sig) return { valid: false, reason: 'badSig' };

    var r = sig.r, s = sig.s;
    if (r <= ZERO || r >= CURVE.n || s <= ZERO || s >= CURVE.n) {
      return { valid: false, reason: 'range' };
    }

    var z = messageHash(message);
    var w = modInv(s, CURVE.n);
    var u1 = mod(z * w, CURVE.n);
    var u2 = mod(r * w, CURVE.n);

    // Điểm khôi phục được phải trùng hoành độ với điểm R lúc ký
    var point = pointAdd(scalarMult(u1, G), scalarMult(u2, Q));
    if (point === null) return { valid: false, reason: 'infinity' };

    var x = mod(point.x, CURVE.n);
    return { valid: x === r, reason: 'checked', recoveredX: toHex(x) };
  }

  DLU.ecdsa = {
    CURVE: CURVE,
    G: G,
    generateKeyPair: generateKeyPair,
    derivePublic: derivePublic,
    privateKeyPem: privateKeyPem,
    publicKeyPem: publicKeyPem,
    sign: sign,
    verify: verify,
    parseDer: parseDer,
    parsePublicKey: parsePublicKey,
    isOnCurve: isOnCurve,
    scalarMult: scalarMult,
    toHex: toHex,
    fromHex: fromHex
  };
})(typeof window !== 'undefined' ? window : globalThis);
