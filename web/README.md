# DLU Ledger Studio

Xưởng mô phỏng sổ cái phân tán cho môn **Blockchain** — Khoa Công nghệ Thông tin,
Trường Đại học Đà Lạt. Viết bằng **JavaScript thuần**: không framework, không thư
viện ngoài, không bước biên dịch.

Trang gồm đúng bốn phân hệ, nối nhau theo mạch suy luận kỹ thuật:

| # | Phân hệ | Lỗ hổng nó vá |
|---|---------|---------------|
| 01 | **Mắt xích dữ liệu** | Cấu trúc nền: một nút giữ dữ liệu + địa chỉ nút kế tiếp |
| 02 | **Sổ cái khối** | Khoá cấu trúc lại bằng dấu niêm phong `previous_hash` (SHA-256) |
| 03 | **Trạm giao dịch** | Chứng minh *ai* lập ra bút toán, bằng cặp khoá ECDSA secp256k1 |
| 04 | **Mạng lưới** | Nhiều nút không tin nhau: cây Merkle, bằng chứng công việc và đồng thuận quá bán |

---

## 1. Chạy thử

### Cách nhanh nhất — không cần cài gì

Mở thẳng tệp:

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
│   ├── index.html              Khung trang, thanh điều khiển, thứ tự nạp script
│   ├── assets/dlu-logo.png     Phù hiệu Trường Đại học Đà Lạt
│   ├── css/style.css           Hệ thiết kế: bảng màu đen–lam, thành phần, đáp ứng
│   └── js/
│       ├── lib/sha256.js       SHA-256 tự cài (FIPS 180-4), chạy đồng bộ
│       ├── core/               ← Thuật toán thuần, KHÔNG đụng tới DOM
│       │   ├── linked-list.js  Dây mắt xích (danh sách liên kết đơn)
│       │   ├── blockchain.js   Block & Blockchain (header có cả merkle_root)
│       │   ├── merkle.js       Cây Merkle: gốc Merkle & đường chứng minh
│       │   ├── ecdsa.js        secp256k1, ECDSA, xuất PEM (từ Key.py)
│       │   └── consensus.js    Dò nonce, nút mạng, giao dịch, luật xác thực, bỏ phiếu
│       ├── ui/                 ← Tầng hiển thị, mỗi trang một tệp
│       │   ├── dom.js          Tiện ích DOM dùng chung
│       │   ├── view-open.js       Tổng quan
│       │   ├── view-nodes.js      Phân hệ 01 — Mắt xích dữ liệu
│       │   ├── view-ledger.js     Phân hệ 02 — Sổ cái khối
│       │   ├── view-desk.js       Phân hệ 03 — Trạm giao dịch
│       │   ├── view-network.js    Phân hệ 04 — Mạng lưới
│       │   └── view-dossier.js    Hồ sơ đồ án
│       ├── i18n.js             Từ điển song ngữ Việt – Anh (toàn bộ câu chữ)
│       ├── config.js           ← Thông tin nhóm, học phần, GitHub (SỬA Ở ĐÂY)
│       └── app.js              Định tuyến theo hash + đổi ngôn ngữ + nền tối/sáng
├── server.js                   Máy chủ tĩnh bằng Node (0 phụ thuộc)
├── serve.ps1                   Máy chủ tĩnh bằng PowerShell
└── package.json
```

Nguyên tắc: **`core/` không bao giờ gọi tới DOM**, `ui/` không bao giờ tự tính mật mã.
Nhờ vậy đổi toàn bộ giao diện mà không phải chạm vào thuật toán, và ngược lại.

---

## 3. Trạm giao dịch làm những gì

Phân hệ 03 gói trọn vòng đời một giao dịch, đúng thứ tự một nút mạng thật sự làm:

1. **Ví** — ba cặp khoá secp256k1 sinh ngay trong trình duyệt; địa chỉ ví là 40 ký tự
   hex cuối của `SHA-256(khoá công khai)`; xuất được khoá dạng PEM (PKCS#8 và X.509).
2. **Lập phiếu** — chọn bên chuyển / bên nhận / số tiền / lời nhắn; trang hiện đúng
   chuỗi nguyên liệu sắp ký và tóm tắt `z = SHA-256(chuỗi đó)`.
3. **Ký** — `ecdsa.sign` trả về `(r, s)` cùng chữ ký mã hoá DER.
4. **Hàng chờ** — mỗi phiếu tự kiểm chữ ký lại mỗi lần vẽ; nút **Sửa trộm số tiền**
   cộng thêm 5 DLU mà không ký lại để thấy chữ ký gãy ngay.
5. **Đóng khối** — nút mạng lọc hai vòng: chữ ký phải khớp *và* số dư phải đủ. Phiếu
   trượt bị trả lại hàng chờ kèm lý do; phiếu đạt được gói vào một khối mới của sổ cái.
6. **Phòng kiểm chứng** — ba tình huống đối chứng (đúng phiếu / sửa số tiền / sai khoá)
   cộng một ô cho tự sửa chuỗi rồi kiểm lại.

---

## 4. Mạng lưới làm những gì

Phân hệ 04 là nơi mọi mảnh ghép chạy cùng nhau, đúng thứ tự của một blockchain thật:

> Nút mạng → Giao dịch → Cây Merkle → Gốc Merkle → Khối → Mã băm → `previous_hash`
> → Đồng thuận → Khối chung cuộc

1. **Bốn nút** — mỗi nút có một cặp khoá secp256k1 riêng, một mức sức đào, một mức cổ
   phần và **một bản sao sổ cái riêng**. Số dư ban đầu nằm trong khối Genesis dưới dạng
   bút toán coinbase, không phải một biến đếm rời.
2. **Giao dịch** — chọn bên chuyển / bên nhận / số tiền, phiếu được ký ngay bằng khoá
   riêng của nút gửi; `txid = SHA256(nội dung ‖ chữ ký)`.
3. **Cây Merkle** — dựng từ danh sách `txid` thật, số lá lẻ thì lá cuối nhân đôi (quy
   ước Bitcoin). Trang vẽ đủ các tầng từ lá lên gốc.
4. **Khối** — header gồm `previous_hash` (lấy từ đỉnh chuỗi của chính nút đề xuất),
   `merkle_root`, `timestamp`, `nonce`. Trang hiện nguyên văn chuỗi đưa vào SHA-256.
5. **Bằng chứng công việc** — dò nonce bằng `mineAsync`, hiện nonce và tốc độ băm theo
   thời gian thực.
6. **Đồng thuận** — khối được phát sóng, **mỗi nút tự chạy `Peer.review()`** trên bản
   sao chuỗi của chính nó: băm lại header, dựng lại gốc Merkle, kiểm từng chữ ký, tính
   lại số dư, đối chiếu `previous_hash` và độ khó. Khối chỉ vào sổ khi số phiếu thuận
   đạt quá bán.
7. **Bảng tra cứu** — hiển thị chuỗi hợp lệ dài nhất, mở từng khối ra xem giao dịch bên
   trong; nút **Đồng bộ mạng** áp dụng quy tắc chuỗi hợp lệ dài nhất.

Bốn tình huống đối chứng, tất cả đều bị bắt bằng phép tính chứ không phải bằng cờ dựng
sẵn: phát sóng khối **chưa đào** (trượt `pow`), **sửa trộm số tiền** sau khi ký (trượt
`txid` và `sig`), **đổi trộm gốc Merkle** trong header (trượt `merkle`), và một nút
**sửa trộm sổ của chính nó** (chuỗi gãy, phải chép lại chuỗi thắng cuộc).

### Không có dữ liệu giả — cách tự kiểm chứng

Mở Console của trình duyệt tại trang Mạng lưới rồi gõ:

```js
DLU.views.network.debug()
```

Kết quả in ra, với mỗi khối, mã băm **đang lưu** đặt cạnh mã băm **băm lại**, gốc Merkle
đang lưu đặt cạnh gốc **dựng lại** từ danh sách `txid`, toàn bộ số dư tính lại từ chuỗi,
và kết quả kiểm chữ ký của từng phiếu trong hàng chờ. Hai cột phải khớp nhau từng ký tự.

---

## 5. Đối chiếu với mã Python gốc của đồ án

| Python | JavaScript | Ghi chú |
|--------|-----------|---------|
| `LinkList.py` → `insert_First` | `LinkedList.insertFirst` | O(1) |
| `LinkList.py` → `insert_Last` | `LinkedList.insertLast` | O(1) nhờ con trỏ `tail` |
| `LinkList.py` → `Search` | `LinkedList.search` | Trả thêm đường duyệt để làm hoạt ảnh |
| `LinkList.py` → `show` | `LinkedList.show` | Trả chuỗi thay vì `print` |
| `Block_BlockChain.py` → `compute_hash` | `Block.computeHash` | `SHA256(prev + timestamp + data + nonce)` |
| `Block_BlockChain.py` → `add_Block` | `Blockchain.addBlock` | |
| `Block_BlockChain.py` → `is_Valid` | `Blockchain.isValid` | Giữ nguyên hai điều kiện kiểm tra |
| `Block_BlockChain.py` → `show` | `Blockchain.show` | |
| `Key.py` → `generate_private_key` | `ecdsa.generateKeyPair` | secp256k1, khoá riêng 256 bit |
| `Key.py` → `public_key()` | `ecdsa.derivePublic` | Q = d·G, trả cả dạng nén và không nén |
| `Key.py` → `private_bytes` | `ecdsa.privateKeyPem` | PKCS#8, đã đối chiếu đúng từng byte DER |
| `Key.py` → `public_bytes` | `ecdsa.publicKeyPem` | X.509 SubjectPublicKeyInfo |
| `Key.py` → `sign` | `ecdsa.sign` | ECDSA + SHA-256, chữ ký mã hoá DER |
| `Key.py` → `verify` | `ecdsa.verify` | Trả `{valid, reason}` thay vì ném ngoại lệ |

Trường `nonce` không có trong bản Python. Khi độ khó bằng 0 thì `nonce = 0` và công thức
băm trùng khớp hoàn toàn với bản Python; `nonce` chỉ có tác dụng khi kéo thanh độ khó ở
phân hệ 02.

---

## 6. Ghi chú kỹ thuật

**SHA-256 tự cài đặt.** Không dùng `crypto.subtle.digest()` vì API đó bất đồng bộ và chỉ
chạy trong secure context, trong khi vòng lặp dò nonce cần một hàm băm đồng bộ, gọi được
hàng chục nghìn lần mỗi giây. Bản cài đặt đã đối chiếu khớp với WebCrypto trên các vector
chuẩn, gồm cả các mốc padding 55/56/64 byte.

**Dò nonce không làm treo trình duyệt.** `mineAsync` làm việc theo từng lát ~28 ms rồi
nhường luồng cho trình duyệt vẽ lại. Việc nhường luồng dùng `MessageChannel` thay vì
`setTimeout` — `setTimeout` bị trình duyệt bó thời gian tối thiểu (≈4 ms, và tới ≈1000 ms
khi thẻ ở chế độ nền), đo thực tế cho thấy khác biệt khoảng **20 lần** về tốc độ.

**Mỗi khối tự ghi nhớ độ khó của mình** (giống trường target trong header khối Bitcoin),
nên chỉnh thanh độ khó chỉ ảnh hưởng tới các khối tạo sau, không làm mất hiệu lực các
khối đã đóng trước đó.

**ECDSA trên secp256k1 cũng phải tự cài.** Web Crypto API chỉ hỗ trợ các đường cong NIST
(P-256/384/521), không có secp256k1 — đường cong mà Bitcoin và Ethereum dùng, cũng là
đường cong trong `Key.py`. Vì vậy `ecdsa.js` cài số học đường cong elliptic bằng `BigInt`.
Đã kiểm chứng bằng các vector chuẩn (`1·G` … `5·G`, `(n−1)·G = −G`, một vector khoá lớn),
và phần xuất PEM đã đối chiếu khớp từng byte với tiền tố DER chuẩn của PKCS#8 /
SubjectPublicKeyInfo cho secp256k1. Đây là mã phục vụ giảng dạy: không chống tấn công
kênh kề, đừng dùng giữ tài sản thật.

**Bộ chữ chọn theo tiêu chí đọc được, không theo tiêu chí lạ mắt.** Giao diện dùng
**Inter**, chữ máy dùng **JetBrains Mono** — cả hai đều có bộ dấu tiếng Việt đầy đủ nên
một câu tiếng Việt không bị rơi sang bộ chữ dự phòng ở giữa chừng (thủ phạm quen thuộc
làm dòng chữ trông lệch và mờ). Trang cũng **không** đặt `-webkit-font-smoothing:
antialiased`: trên Windows nó tắt khử răng cưa theo điểm ảnh phụ, làm nét chữ mảnh đi
trông như bị nhoè. Mọi cỡ chữ đều từ 11px trở lên, khoảng giãn chữ của nhãn viết hoa
được thu lại, và những hiệu ứng đổ bóng hay nháy độ mờ trên chữ đã được thay bằng hiệu
ứng trên viền và nền.

**Mỗi lần chuyển trang, thẻ `<main>` được dựng mới.** Các trang gắn sự kiện theo kiểu uỷ
quyền lên chính thẻ chứa, nên nếu chỉ xoá nội dung bên trong thì trình xử lý cũ vẫn bám
lại và một cú bấm sẽ chạy nhiều lần sau vài lượt qua lại.

---

## 7. Triển khai lên Render

1. Đẩy thư mục `web/` lên một kho Git.
2. Tạo **New → Web Service**, chọn kho vừa đẩy.
3. Cấu hình:
   - Environment: **Node**
   - Build Command: *(để trống)*
   - Start Command: `node server.js`

`server.js` tự đọc cổng từ biến môi trường `PORT` mà Render cấp.

---

## 8. Tài liệu tham khảo

- Satoshi Nakamoto (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System*.
- Fabian Schär, Aleksander Berentsen. *Bitcoin, Blockchain and Cryptoassets*.
- NIST FIPS 180-4. *Secure Hash Standard*.
- SEC 2. *Recommended Elliptic Curve Domain Parameters* (secp256k1) và NIST FIPS 186-4 (ECDSA).
