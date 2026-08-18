import hashlib  # Thư viện dùng để mã hóa dữ liệu theo chuẩn SHA-256
import time     # Thư viện dùng để lấy mốc thời gian thực (timestamp)


# 1. LỚP BLOCK: Đại diện cho một khối chứa dữ liệu trong Blockchain
class Block:
    def __init__(self, data, previous_hash):
        self.data = data                    # Nội dung giao dịch lưu trong khối
        self.previous_hash = previous_hash  # Mã hash của khối phía trước (mắt xích liên kết)
        self.timestamp = time.time()        # Mốc thời gian tạo khối (tính bằng giây)
        self.hash = self.compute_hash()     # Mã hash SHA-256 duy nhất nhận diện khối này
        self.next = None                    # Con trỏ trỏ tới khối tiếp theo (Cấu trúc danh sách liên kết)

    # Hàm tính toán mã hash đại diện cho toàn bộ nội dung của khối
    def compute_hash(self):
        # Ghép chuỗi gồm: Hash khối trước + Thời gian tạo + Nội dung giao dịch
        noi_dung = f"{self.previous_hash}{self.timestamp}{self.data}"
        # Mã hóa chuỗi thành chuỗi hexa 64 ký tự bằng thuật toán SHA-256
        return hashlib.sha256(noi_dung.encode()).hexdigest()


# 2. LỚP BLOCKCHAIN: Quản lý danh sách liên kết chứa các khối Block
class Blockchain:
    def __init__(self):
        self.head = None  # Quản lý khối đầu tiên trong chuỗi
        self.tail = None  # Quản lý khối cuối cùng trong chuỗi
        # Khởi tạo chuỗi bằng cách tự động tạo khối khởi đầu (Genesis Block)
        self.add_Block("Genesis Block")

    # Hàm thêm một khối giao dịch mới vào Blockchain
    def add_Block(self, data):
        # Nếu đã có khối trong chuỗi, lấy hash của khối cuối (tail) làm previous_hash cho khối mới
        if self.tail:
            previous_hash = self.tail.hash
        else:
            previous_hash = "0" * 64  # Khối Genesis không có khối trước nên dùng 64 số 0

        # Tạo đối tượng khối mới
        new_block = Block(data, previous_hash)

        # Nối khối mới vào danh sách liên kết đơn
        if self.head:
            self.tail.next = new_block  # Khối cuối hiện tại trỏ tới khối mới
            self.tail = new_block       # Cập nhật khối mới thành khối cuối
        else:
            self.head = new_block       # Chuỗi rỗng -> khối mới vừa là head vừa là tail
            self.tail = new_block

    # Hàm kiểm tra tính hợp lệ và toàn vẹn của dữ liệu trong Blockchain
    def is_Valid(self):
        current = self.head
        while current:
            # Điều kiện 1: Kiểm tra xem dữ liệu khối hiện tại có bị sửa không
            # Nếu data bị sửa, compute_hash() sẽ khác với current.hash ban đầu -> Trả về False
            if current.hash != current.compute_hash():
                return False

            # Điều kiện 2: Kiểm tra liên kết giữa 2 khối kế tiếp
            # Mã previous_hash của khối sau phải trùng khớp tuyệt đối với hash của khối trước
            if current.next and current.next.previous_hash != current.hash:
                return False

            current = current.next  # Chuyển sang khối kế tiếp
        return True                 # Nếu tất cả các khối đều hợp lệ -> Trả về True

    # Hàm hiển thị thông tin các khối trong chuỗi ra màn hình
    def show(self):
        current = self.head
        i = 0
        while current:
            print(f"Block {i}: {current.data}")
            print(f"  prev: {current.previous_hash}")   # In 16 ký tự đầu của hash trước
            print(f"  hash: {current.hash}")     # In 16 ký tự đầu của hash khối này
            current = current.next
            i += 1


# 3. CHƯƠNG TRÌNH CHÍNH (Thực thi và thử nghiệm)
if __name__ == "__main__":
    # Khởi tạo một chuỗi Blockchain mới
    chain = Blockchain()

    # Thêm các giao dịch mới vào chuỗi
    chain.add_Block("Alice gui 0.27 BTC cho Bob")
    chain.add_Block("Bob gui 0.1 BTC cho Charlie")

    # In toàn bộ danh sách khối
    chain.show()

    # Kiểm tra tính hợp lệ của chuỗi ban đầu (Kỳ vọng: True)
    print("Chuoi hop le?", chain.is_Valid())

    # Cố tình sửa đổi dữ liệu của Block 1 (Gian lận số tiền)
    chain.head.next.data = "Alice gui 100 BTC cho Bob"

    # Kiểm tra lại tính hợp lệ sau khi bị gian lận (Kỳ vọng: False)
    print("Sau khi sua block 1:", chain.is_Valid())