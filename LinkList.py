# 1. Lớp Node: Đại diện cho một phần tử (mắt xích) trong danh sách
class Node:
    def __init__(self, data):
        self.data = data  # Chứa dữ liệu của phần tử
        self.next = None  # Con trỏ trỏ đến phần tử tiếp theo (mặc định là None)


# 2. Lớp LinkedList: Quản lý danh sách liên kết đơn
class LinkedList:
    def __init__(self):
        self.head = None  # Nút đầu tiên của danh sách
        self.tail = None  # Nút cuối cùng của danh sách

    # Thêm phần tử vào ĐẦU danh sách
    def insert_First(self, data):
        new_node = Node(data)
        if self.head:
            new_node.next = self.head  # Trỏ nút mới vào nút đầu hiện tại
            self.head = new_node       # Cập nhật nút mới thành head
        else:
            self.head = new_node       # Nếu danh sách rỗng, head và tail đều là nút mới
            self.tail = new_node

    # Thêm phần tử vào CUỐI danh sách
    def insert_Last(self, data):
        new_node = Node(data)
        if self.head:
            self.tail.next = new_node  # Trỏ nút cuối hiện tại sang nút mới
            self.tail = new_node       # Cập nhật nút mới thành tail
        else:
            self.head = new_node       # Nếu danh sách rỗng, head và tail đều là nút mới
            self.tail = new_node

    # Tìm kiếm một giá trị trong danh sách
    def Search(self, data):
        cur_node = self.head
        while cur_node:
            if cur_node.data == data:
                return True            # Tìm thấy -> Trả về True
            cur_node = cur_node.next   # Chuyển sang nút tiếp theo
        return False                   # Duyệt hết danh sách không thấy -> Trả về False

    # In toàn bộ danh sách ra màn hình
    def show(self):
        parts = []
        cur_node = self.head
        while cur_node:
            parts.append(str(cur_node.data))
            cur_node = cur_node.next
        print(" -> ".join(parts) + " -> X")


# 3. Chương trình chính (Chạy thử nghiệm)
if __name__ == "__main__":
    sushi_preparation = LinkedList()

    # Thêm các bước làm sushi
    sushi_preparation.insert_Last("prepare")     # Thêm vào cuối: prepare
    sushi_preparation.insert_Last("roll")        # Thêm vào cuối: roll
    sushi_preparation.insert_First("assemble")   # Thêm vào đầu: assemble

    # In danh sách ra: assemble -> prepare -> roll -> X
    sushi_preparation.show()

    # Kiểm tra tìm kiếm
    print(sushi_preparation.Search("roll"))   # Kết quả: True
    print(sushi_preparation.Search("serve"))  # Kết quả: False