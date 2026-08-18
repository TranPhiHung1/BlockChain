/* =============================================================================
 *  linked-list.js — Danh sách liên kết đơn (Singly Linked List)
 * -----------------------------------------------------------------------------
 *  Bản chuyển ngữ 1-1 từ LinkList.py của đồ án sang JavaScript, có bổ sung
 *  phần "vết thực thi" (trace) để giao diện có thể diễn hoạt từng bước.
 *
 *  Vì sao môn Blockchain lại học danh sách liên kết trước?
 *    Blockchain CHÍNH LÀ một danh sách liên kết đơn, chỉ khác ở chỗ con trỏ
 *    `next` được thay bằng con trỏ mật mã `previous_hash`. Hiểu cấu trúc này
 *    là hiểu vì sao chuỗi khối không thể bị sửa mà không bị phát hiện.
 *
 *  Xuất ra: window.DLU.LinkedList, window.DLU.LLNode
 * ========================================================================== */
(function (global) {
  'use strict';

  var DLU = (global.DLU = global.DLU || {});
  var nodeCounter = 0;

  /**
   * Một nút (mắt xích) trong danh sách.
   * @param {*} data dữ liệu của phần tử
   */
  function LLNode(data) {
    this.id = ++nodeCounter;                 // khoá định danh cho DOM
    this.data = data;                        // dữ liệu chứa trong nút
    this.next = null;                        // con trỏ tới nút kế tiếp
    // Địa chỉ ô nhớ "giả lập" — chỉ để minh hoạ khái niệm con trỏ trên giao diện
    this.addr = '0x' + (0x1000 + this.id * 0x28).toString(16).toUpperCase();
  }

  /** Danh sách liên kết đơn có giữ cả head lẫn tail (giống bản Python). */
  function LinkedList() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  /* --------------------------------------------------------------------- */
  /*  Các thao tác gốc có trong LinkList.py                                  */
  /* --------------------------------------------------------------------- */

  /**
   * Thêm phần tử vào ĐẦU danh sách — độ phức tạp O(1).
   * Tương ứng `insert_First` trong bản Python.
   */
  LinkedList.prototype.insertFirst = function (data) {
    var newNode = new LLNode(data);
    if (this.head) {
      newNode.next = this.head;  // nút mới trỏ vào head cũ
      this.head = newNode;       // nút mới trở thành head
    } else {
      this.head = newNode;       // danh sách rỗng: head và tail là một
      this.tail = newNode;
    }
    this.length++;
    return newNode;
  };

  /**
   * Thêm phần tử vào CUỐI danh sách — O(1) nhờ có sẵn con trỏ tail.
   * Tương ứng `insert_Last` trong bản Python.
   */
  LinkedList.prototype.insertLast = function (data) {
    var newNode = new LLNode(data);
    if (this.head) {
      this.tail.next = newNode;  // nút cuối hiện tại trỏ sang nút mới
      this.tail = newNode;       // nút mới trở thành tail
    } else {
      this.head = newNode;
      this.tail = newNode;
    }
    this.length++;
    return newNode;
  };

  /**
   * Tìm kiếm tuyến tính — O(n).
   * Tương ứng `Search` trong bản Python, nhưng trả thêm đường đi đã duyệt
   * để giao diện tô sáng từng bước.
   * @returns {{found: boolean, steps: number[], index: number}}
   */
  LinkedList.prototype.search = function (data) {
    var visited = [];
    var current = this.head;
    var index = 0;
    while (current) {
      visited.push(current.id);
      if (String(current.data) === String(data)) {
        return { found: true, steps: visited, index: index };
      }
      current = current.next;
      index++;
    }
    return { found: false, steps: visited, index: -1 };
  };

  /**
   * Duyệt và trả về mảng chuỗi để in ra — tương ứng `show` trong bản Python.
   * @returns {string} ví dụ: "assemble -> prepare -> roll -> X"
   */
  LinkedList.prototype.show = function () {
    var parts = [];
    var current = this.head;
    while (current) {
      parts.push(String(current.data));
      current = current.next;
    }
    parts.push('X'); // ký hiệu con trỏ null kết thúc danh sách
    return parts.join(' -> ');
  };

  /* --------------------------------------------------------------------- */
  /*  Phần mở rộng phục vụ trực quan hoá (không có trong bản Python)         */
  /* --------------------------------------------------------------------- */

  /** Xoá nút đầu tiên mang giá trị `data`. @returns {boolean} đã xoá hay chưa */
  LinkedList.prototype.remove = function (data) {
    var current = this.head;
    var prev = null;
    while (current) {
      if (String(current.data) === String(data)) {
        if (prev) {
          prev.next = current.next;          // nối tắt qua nút bị xoá
        } else {
          this.head = current.next;          // xoá đúng head
        }
        if (current === this.tail) this.tail = prev; // xoá đúng tail
        this.length--;
        return true;
      }
      prev = current;
      current = current.next;
    }
    return false;
  };

  /** Đảo ngược danh sách tại chỗ — O(n), kinh điển trong phỏng vấn. */
  LinkedList.prototype.reverse = function () {
    var prev = null;
    var current = this.head;
    this.tail = this.head;
    while (current) {
      var nextTmp = current.next;
      current.next = prev;
      prev = current;
      current = nextTmp;
    }
    this.head = prev;
  };

  /** Xoá sạch danh sách. */
  LinkedList.prototype.clear = function () {
    this.head = null;
    this.tail = null;
    this.length = 0;
  };

  /** Trả về mảng các nút theo thứ tự duyệt — dùng để render. */
  LinkedList.prototype.toArray = function () {
    var out = [];
    var current = this.head;
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };

  DLU.LLNode = LLNode;
  DLU.LinkedList = LinkedList;
})(typeof window !== 'undefined' ? window : globalThis);
