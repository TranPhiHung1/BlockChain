# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization


# =====================================================================
# 1. TẠO CẶP KHÓA (Key Pair Generation)
# =====================================================================

# Khởi tạo Private Key trên đường cong SECP256K1 (tiêu chuẩn của mạng lưới Bitcoin)
private_key = ec.generate_private_key(ec.SECP256K1())

# Trích xuất Public Key tương ứng từ Private Key (thực hiện phép nhân điểm trên đường cong)
public_key = private_key.public_key()


# =====================================================================
# 2. ĐỊNH DẠNG KHÓA SANG HEX (Hexadecimal Formatting)
# =====================================================================

# Chuyển đổi giá trị số nguyên của Private Key thành chuỗi Hex 64 ký tự (256-bit)
private_numbers = private_key.private_numbers()
private_hex = format(private_numbers.private_value, '064x')

# Lấy tọa độ (x, y) của Public Key trên mặt phẳng đồ thị Elliptic
public_numbers = public_key.public_numbers()
public_x_hex = format(public_numbers.x, '064x')
public_y_hex = format(public_numbers.y, '064x')

# Định dạng Uncompressed Public Key: Tiền tố "04" (báo hiệu không nén) ghép với tọa độ X và Y
public_key_uncompressed = "04" + public_x_hex + public_y_hex

print("=" * 70)
print("ELLIPTIC CURVE KEY PAIR (SECP256K1)")
print("=" * 70)
print(f"\n[Private Key]:\n  {private_hex}")
print(f"\n[Public Key (Uncompressed - 130 hex characters)]:\n  {public_key_uncompressed}")
print(f"\n  Coordinate X: {public_x_hex}")
print(f"  Coordinate Y: {public_y_hex}")


# =====================================================================
# 3. XUẤT KHÓA THEO TIÊU CHUẨN LƯU TRỮ (PEM Serialization)
# =====================================================================

# Mã hóa Private Key theo chuẩn PKCS#8 (định dạng chứa thông tin thuật toán và cấu trúc khóa)
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Mã hóa Public Key theo chuẩn X.509 SubjectPublicKeyInfo
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

print("\n" + "=" * 70)
print("SERIALIZED PEM FORMAT")
print("=" * 70)
print(f"\n[Private Key PEM]:\n{private_pem.decode()}")
print(f"[Public Key PEM]:\n{public_pem.decode()}")


# =====================================================================
# 4. KÝ SỐ GIAO DỊCH (Transaction Signing)
# =====================================================================

message = b"Alice sends 10 BTC to Bob"

# Tạo chữ ký điện tử bằng thuật toán ECDSA kết hợp với hàm băm SHA-256
signature = private_key.sign(
    message,
    ec.ECDSA(hashes.SHA256())
)

print("=" * 70)
print("ECDSA DIGITAL SIGNATURE")
print("=" * 70)
print(f"\n  Message  : {message.decode()}")
print(f"  Signature: {signature.hex()}")
print(f"  Length   : {len(signature)} bytes")


# =====================================================================
# 5. XÁC MINH CHỮ KÝ (Signature Verification)
# =====================================================================

print("\n" + "=" * 70)
print("SIGNATURE VERIFICATION")
print("=" * 70)

# TH1: Xác thực thành công (sử dụng đúng Public Key và thông điệp gốc)
try:
    public_key.verify(
        signature,
        message,
        ec.ECDSA(hashes.SHA256())
    )
    print("\n  [✓] SUCCESS: Chữ ký hợp lệ. Thông điệp toàn vẹn và xác thực nguồn gốc.")
except Exception:
    print("\n  [✗] FAILED: Chữ ký không hợp lệ.")

# TH2: Xác thực thất bại do thông điệp bị thay đổi (tấn công giả mạo dữ liệu)
fake_message = b"Alice sends 100 BTC to Bob"
try:
    public_key.verify(
        signature,
        fake_message,
        ec.ECDSA(hashes.SHA256())
    )
    print("  [✓] SUCCESS: Chữ ký hợp lệ (Lỗi logic).")
except Exception:
    print(f"  [✗] FAILED: Chữ ký không khớp với thông điệp đã sửa đổi: \"{fake_message.decode()}\"")

# TH3: Xác thực thất bại do ký bằng khóa của người khác (giả mạo chữ ký)
other_private_key = ec.generate_private_key(ec.SECP256K1())
other_public_key = other_private_key.public_key()
try:
    other_public_key.verify(
        signature,
        message,
        ec.ECDSA(hashes.SHA256())
    )
    print("  [✓] SUCCESS: Chữ ký hợp lệ (Lỗi logic).")
except Exception:
    print("  [✗] FAILED: Chữ ký không hợp lệ với khóa công khai của thực thể khác.")

print("\n" + "=" * 70)