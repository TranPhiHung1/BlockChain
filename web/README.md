# DLU Blockchain Lab

Công cụ trực quan hoá chuỗi khối cho môn **Blockchain** — Khoa Công nghệ Thông tin,
Trường Đại học Đà Lạt. Viết bằng **JavaScript thuần**, không framework, không thư viện ngoài.

Trang web có đúng bốn chức năng, nối tiếp nhau theo mạch suy luận kỹ thuật:

| # | Chức năng | Vấn đề nó giải quyết |
|---|-----------|----------------------|
| 01 | **Danh sách liên kết** | Cấu trúc dữ liệu nền tảng: nút + con trỏ `next` |
| 02 | **Khối & Chuỗi khối** | Khoá cấu trúc bằng con trỏ mật mã `previous_hash` (SHA-256) |
| 03 | **Giao thức đồng thuận** | Buộc cả mạng công nhận một phiên bản lịch sử duy nhất |
| 04 | **Khoá & Chữ ký số** | Chứng minh *ai* tạo ra giao dịch, bằng cặp khoá ECDSA secp256k1 |

---

## 1. Chạy thử

### Cách nhanh nhất — không cần cài gì

Mở trực tiếp tệp:

```
web\public\index.html
```

Trang dùng script cổ điển (không phải ES module) nên chạy tốt với giao thức `file://`.

### Có Node.js

```bash
node server.js
```

Mở http://localhost:3000 — `server.js` chỉ dùng module lõi của Node, **không cần `npm install`**.

### Chỉ có Windows PowerShell

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Mở http://localhost:8080 (đổi cổng bằng `-Port 8081`).

---

## 2. Cấu trúc thư mục

```
web/
├── public/
│   ├── index.html              Khung trang, thanh điều hướng, thứ tự nạp script
│   ├── assets/dlu-logo.png     Logo Trường Đại học Đà Lạt
│   ├── css/style.css           Hệ thống thiết kế: biến màu, thành phần, đáp ứng
│   └── js/
│       ├── lib/sha256.js       SHA-256 tự cài đặt (FIPS 180-4), chạy đồng bộ
│       ├── core/               ← Thuật toán thuần, KHÔNG đụng tới DOM
│       │   ├── linked-list.js  Danh sách liên kết đơn
│       │   ├── blockchain.js   Block & Blockchain
│       │   ├── consensus.js    PoW, PoS, mạng P2P, xác suất tấn công 51%
│       │   └── ecdsa.js        secp256k1, ECDSA, xuất PEM (từ Key.py)
│       ├── ui/                 ← Tầng hiển thị, mỗi trang một tệp
│       │   ├── dom.js          Tiện ích DOM dùng chung
│       │   ├── view-home.js
│       │   ├── view-linkedlist.js
│       │   ├── view-blockchain.js
│       │   ├── view-consensus.js
│       │   ├── view-keys.js
│       │   └── view-about.js
│       ├── i18n.js             Từ điển song ngữ Việt – Anh (toàn bộ câu chữ)
│       ├── config.js           ← Thông tin nhóm, học phần, GitHub (SỬA Ở ĐÂY)
│       └── app.js              Router theo hash + đổi ngôn ngữ + sáng/tối
├── server.js                   Máy chủ tĩnh bằng Node (0 phụ thuộc)
├── serve.ps1                   Máy chủ tĩnh bằng PowerShell
└── package.json
```

Nguyên tắc: **`core/` không bao giờ gọi tới DOM**, `ui/` không bao giờ tự tính toán mật mã.
Nhờ vậy có thể đổi toàn bộ giao diện mà không chạm vào thuật toán, và ngược lại.

---

## 3. Đối chiếu với mã Python gốc của đồ án

Hai chức năng đầu được chuyển ngữ 1-1, giữ nguyên luồng xử lý để dễ đối chiếu khi báo cáo:

| Python | JavaScript | Ghi chú |
|--------|-----------|---------|
| `LinkList.py` → `insert_First` | `LinkedList.insertFirst` | O(1) |
| `LinkList.py` → `insert_Last` | `LinkedList.insertLast` | O(1) nhờ con trỏ `tail` |
| `LinkList.py` → `Search` | `LinkedList.search` | Trả thêm đường duyệt để làm hoạt ảnh |
| `LinkList.py` → `show` | `LinkedList.show` | Trả chuỗi thay vì `print` |
| `Block_BlockChain.py` → `compute_hash` | `Block.computeHash` | `SHA256(prev + timestamp + data + nonce)` |
| `Block_BlockChain.py` → `add_Block` | `Blockchain.addBlock` | |
| `Block_BlockChain.py` → `is_Valid` | `Blockchain.isValid` | Giữ nguyên 2 điều kiện kiểm tra |
| `Block_BlockChain.py` → `show` | `Blockchain.show` | |
| `Key.py` → `generate_private_key` | `ecdsa.generateKeyPair` | secp256k1, khoá riêng 256 bit |
| `Key.py` → `public_key()` | `ecdsa.derivePublic` | Q = d·G, trả cả dạng nén và không nén |
| `Key.py` → `private_bytes` | `ecdsa.privateKeyPem` | PKCS#8, đã đối chiếu đúng từng byte DER |
| `Key.py` → `public_bytes` | `ecdsa.publicKeyPem` | X.509 SubjectPublicKeyInfo |
| `Key.py` → `sign` | `ecdsa.sign` | ECDSA + SHA-256, chữ ký mã hoá DER |
| `Key.py` → `verify` | `ecdsa.verify` | Trả `{valid, reason}` thay vì ném ngoại lệ |
| — | `consensus.js` | Phần **mới** bổ sung cho bản web |

Trường `nonce` không có trong bản Python. Khi độ khó bằng 0 thì `nonce = 0` và công thức
băm trùng khớp hoàn toàn với bản Python; `nonce` chỉ có tác dụng khi bật Proof-of-Work.

---

## 4. Ghi chú kỹ thuật

**SHA-256 tự cài đặt.** Không dùng `crypto.subtle.digest()` vì API đó bất đồng bộ và chỉ chạy
trong secure context, trong khi vòng lặp đào khối cần một hàm băm đồng bộ, gọi được hàng chục
nghìn lần mỗi giây. Bản cài đặt đã được đối chiếu khớp với WebCrypto trên các vector chuẩn,
bao gồm các mốc padding 55/56/64 byte.

**Đào khối không làm treo trình duyệt.** `mineAsync` làm việc theo từng lát ~28 ms rồi nhường
luồng cho trình duyệt vẽ lại. Việc nhường luồng dùng `MessageChannel` thay vì `setTimeout` —
`setTimeout` bị trình duyệt bó thời gian tối thiểu (≈4 ms, và tới ≈1000 ms khi thẻ ở chế độ
nền), đo thực tế cho thấy khác biệt khoảng **20 lần** về tốc độ đào.

**Mỗi khối tự ghi nhớ độ khó của mình** (giống trường target trong header khối Bitcoin), nên
việc chỉnh thanh trượt độ khó chỉ ảnh hưởng tới các khối tạo sau, không làm mất hiệu lực các
khối đã đào trước đó.

**Xác suất tấn công 51%** dùng đúng công thức Poisson ở mục 11 bạch thư Bitcoin. Kết quả khớp
bảng số của Nakamoto: `q = 10%, z = 6` → `0,0243%`.

**ECDSA trên secp256k1 cũng phải tự cài.** Web Crypto API chỉ hỗ trợ các đường cong NIST
(P-256/384/521), không có secp256k1 — đường cong mà Bitcoin và Ethereum dùng, cũng là đường
cong trong `Key.py`. Vì vậy `ecdsa.js` cài số học đường cong elliptic bằng `BigInt`. Đã kiểm
chứng bằng các vector chuẩn (`1·G` … `5·G`, `(n−1)·G = −G`, một vector khoá lớn), và phần
xuất PEM đã đối chiếu khớp từng byte với tiền tố DER chuẩn của PKCS#8 / SubjectPublicKeyInfo
cho secp256k1. Đây là mã phục vụ giảng dạy: không chống tấn công kênh kề, đừng dùng giữ tài
sản thật.

---

## 5. Triển khai lên Render

1. Đẩy thư mục `web/` lên một kho Git.
2. Tạo **New → Web Service**, chọn kho vừa đẩy.
3. Cấu hình:
   - Environment: **Node**
   - Build Command: *(để trống)*
   - Start Command: `node server.js`

`server.js` tự đọc cổng từ biến môi trường `PORT` mà Render cấp.

---

## 6. Tài liệu tham khảo

- Satoshi Nakamoto (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System* — mục 11.
- Fabian Schär, Aleksander Berentsen. *Bitcoin, Blockchain and Cryptoassets*.
- NIST FIPS 180-4. *Secure Hash Standard*.
- Lamport, Shostak, Pease (1982). *The Byzantine Generals Problem*.
