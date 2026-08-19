/* =============================================================================
 *  config.js — HỒ SƠ ĐỀ TÀI & DANH SÁCH NHÓM THỰC HIỆN
 * -----------------------------------------------------------------------------
 *  👉 ĐÂY LÀ TỆP DUY NHẤT CẦN SỬA khi thay đổi thông tin nhóm hoặc học phần.
 *     Sửa xong chỉ việc tải lại trang, không phải biên dịch gì cả.
 *
 *  Chỗ nào đánh dấu  ← SỬA  là dữ liệu tạm, hãy thay bằng thông tin thật.
 *  Trường có dạng { vi: '…', en: '…' } thì điền cho cả hai ngôn ngữ.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  DLU.config = {

    /* ---------------------------------------------------------------------
     *  1. KHO MÃ NGUỒN
     * ------------------------------------------------------------------- */
    github: {
      url:   'https://github.com/TranPhiHung1/BlockChain',
      clone: 'git clone https://github.com/TranPhiHung1/BlockChain.git'
    },

    /* ---------------------------------------------------------------------
     *  2. HỌC PHẦN
     * ------------------------------------------------------------------- */
    course: {
      subject:  { vi: 'Blockchain', en: 'Blockchain' },
      lecturer: { vi: 'ThS. Nguyễn Văn A', en: 'Nguyen Van A, M.Sc.' },        // ← SỬA
      faculty:  { vi: 'Khoa Công nghệ Thông tin', en: 'Faculty of Information Technology' },
      school:   { vi: 'Trường Đại học Đà Lạt', en: 'Dalat University' },
      className:{ vi: 'CTK47 — Công nghệ Thông tin', en: 'CTK47 — Information Technology' }, // ← SỬA
      year:     { vi: '2025 – 2026', en: '2025 – 2026' },
      term:     { vi: 'Học kỳ I', en: 'Semester I' }
    },

    /* ---------------------------------------------------------------------
     *  3. NHÓM THỰC HIỆN
     *     lead: true  → đánh dấu nhóm trưởng (thẻ đổi màu và có nhãn riêng)
     *     email / github — để chuỗi rỗng '' nếu không muốn công khai
     * ------------------------------------------------------------------- */
    team: [
      {
        name: 'Trần Phi Hùng',
        id: '2312628',
        lead: true,
        role: { vi: 'Nhóm trưởng · Kiến trúc hệ thống & tích hợp các phân hệ',
                en: 'Team lead · System architecture & module integration' },
        email: '',
        github: ''
      },
      {
        name: 'Nguyễn Hữu Quốc Việt',
        id: '2312798',
        role: { vi: 'Lõi mật mã: hàm băm SHA-256 và chữ ký ECDSA secp256k1',
                en: 'Cryptographic core: SHA-256 hashing and secp256k1 ECDSA signatures' },
        email: '',
        github: ''
      },
      {
        name: 'Trần Minh Tiến',
        id: '2312773',
        role: { vi: 'Cấu trúc dữ liệu: mắt xích liên kết và sổ cái khối',
                en: 'Data structures: the linked chain and the block ledger' },
        email: '',
        github: ''
      },
      {
        name: 'Nguyễn Đặng Nhật Tiên',
        id: '2312767',
        role: { vi: 'Giao diện, trải nghiệm sử dụng và biên soạn nội dung song ngữ',
                en: 'Interface, user experience and bilingual content authoring' },
        email: '',
        github: ''
      }
    ]
  };

  /**
   * Lấy giá trị theo ngôn ngữ đang chọn.
   * Nhận cả chuỗi thường lẫn đối tượng { vi, en }.
   */
  DLU.tr = function (value) {
    if (value && typeof value === 'object') {
      return value[DLU.i18n.getLang()] || value.vi || value.en || '';
    }
    return value == null ? '' : String(value);
  };
})(typeof window !== 'undefined' ? window : globalThis);
