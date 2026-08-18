/* =============================================================================
 *  config.js — THÔNG TIN ĐỀ TÀI & NHÓM SINH HIỆN
 * -----------------------------------------------------------------------------
 *  👉 ĐÂY LÀ TỆP DUY NHẤT BẠN CẦN SỬA để điền thông tin thật của nhóm.
 *     Sửa xong chỉ cần tải lại trang, không cần biên dịch gì cả.
 *
 *  Những chỗ đánh dấu  ← SỬA  là dữ liệu mẫu, hãy thay bằng thông tin của bạn.
 *  Trường nào có dạng { vi: '…', en: '…' } thì điền cả hai ngôn ngữ.
 * ========================================================================== */
(function (global) {
  'use strict';
  var DLU = (global.DLU = global.DLU || {});

  DLU.config = {

    /* ---------------------------------------------------------------------
     *  1. KHO MÃ NGUỒN
     * ------------------------------------------------------------------- */
    github: {
      // Đường dẫn kho GitHub của đồ án
      url: 'https://github.com/tiennhathuynh/BlockChain',   // ← SỬA
      // Dòng lệnh hiển thị ở nút "Tải về bằng Git"
      clone: 'git clone https://github.com/tiennhathuynh/BlockChain.git' // ← SỬA
    },

    /* ---------------------------------------------------------------------
     *  2. THÔNG TIN HỌC PHẦN
     * ------------------------------------------------------------------- */
    course: {
      subject:  { vi: 'Blockchain', en: 'Blockchain' },
      lecturer: { vi: 'ThS. Nguyễn Văn A', en: 'Nguyen Van A, M.Sc.' },        // ← SỬA
      faculty:  { vi: 'Khoa Công nghệ Thông tin', en: 'Faculty of Information Technology' },
      school:   { vi: 'Trường Đại học Đà Lạt', en: 'Dalat University' },
      className:{ vi: 'CTK46 — Công nghệ Thông tin', en: 'CTK46 — Information Technology' }, // ← SỬA
      year:     { vi: '2025 – 2026', en: '2025 – 2026' },                      // ← SỬA
      term:     { vi: 'Học kỳ I', en: 'Semester I' }                           // ← SỬA
    },

    /* ---------------------------------------------------------------------
     *  3. DANH SÁCH SINH VIÊN
     *     Thêm/bớt phần tử tuỳ số thành viên. Giao diện tự dàn lại lưới.
     *       emoji  — ảnh đại diện dạng biểu tượng (hoặc để '' thì hiện chữ cái đầu)
     *       email, github — để chuỗi rỗng '' nếu không muốn hiện
     * ------------------------------------------------------------------- */
    team: [                                                                    // ← SỬA cả khối
      {
        name: 'Nguyễn Đăng Nhật Tiến',
        id: '2012345',
        emoji: '🌲',
        role: { vi: 'Trưởng nhóm · Kiến trúc & Giao thức đồng thuận',
                en: 'Team lead · Architecture & consensus protocols' },
        email: '',   // ← điền email nếu muốn hiện công khai trên trang Giới thiệu
        github: ''
      },
      {
        name: 'Thành viên 2',
        id: '2012346',
        emoji: '🌊',
        role: { vi: 'Cấu trúc dữ liệu & Chuỗi khối',
                en: 'Data structures & blockchain' },
        email: '',
        github: ''
      },
      {
        name: 'Thành viên 3',
        id: '2012347',
        emoji: '🏙️',
        role: { vi: 'Giao diện & Trải nghiệm người dùng',
                en: 'Interface & user experience' },
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
