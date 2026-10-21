# LocalBuddy — Concierge MVP

Dự án gồm frontend React + Vite + Tailwind CSS và backend Express + MongoDB/Mongoose + JWT.

## Yêu cầu
- Node.js 20 LTS trở lên
- MongoDB local hoặc MongoDB Atlas
- VS Code

## 1. Cấu hình và chạy backend

Backend sử dụng `multer` để nhận ảnh đại diện và file chứng chỉ. Lệnh `npm install` sẽ cài đặt dependency cần thiết.
```bash
cd BE
npm install
```
Sao chép `BE/.env.example` thành `BE/.env`, sau đó điền `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL` và `ADMIN_PASSWORD`.

Tạo tài khoản Admin cùng 4 hồ sơ Buddy mẫu đã được đánh dấu xác minh:
```bash
npm run seed
```
Chạy API:
```bash
npm run dev
```
Kiểm tra API tại `http://localhost:3001/api/health`.

## 2. Cấu hình và chạy frontend
Mở terminal khác:
```bash
cd FE
npm install
```
Sao chép `FE/.env.example` thành `FE/.env` nếu cần thay URL API, sau đó chạy:
```bash
npm run dev
```
Mở `http://localhost:5173`.

## Chức năng MVP
- Landing page giới thiệu quy trình và 3 gói trải nghiệm: Ẩm thực, Cà phê, Du lịch.
- Danh sách công khai chỉ hiển thị hồ sơ Buddy đang hoạt động và đã được Admin xác minh.
- Hồ sơ Buddy lấy từ MongoDB; không dùng dữ liệu mẫu dự phòng trong trang chi tiết.
- Form yêu cầu trải nghiệm gồm ngày, khung giờ, số khách, ngôn ngữ, ngân sách ăn uống và ghi chú.
- Booking được lưu với trạng thái `Pending`; Admin kiểm tra lịch và xác nhận thủ công.
- Ngăn tạo yêu cầu trùng cùng Buddy/ngày/khung giờ khi đã có yêu cầu Pending hoặc Confirmed; Admin cũng kiểm tra xung đột trước khi xác nhận.
- Admin duyệt hồ sơ Buddy, quản lý tài khoản và cập nhật trạng thái đặt lịch.
- Hồ sơ Local/Traveler cho phép chọn khu vực Đà Nẵng, tải ảnh đại diện, thêm nhiều ngôn ngữ và tải chứng chỉ ảnh/PDF không bắt buộc.
- Local có thể khai báo giá dịch vụ theo giờ; Traveler lọc Local theo số giờ trải nghiệm và ngân sách tối đa mỗi giờ.
- Hồ sơ cá nhân của Local được đồng bộ sang `BuddyProfile`; tài khoản Local cũ được đồng bộ khi Admin mở danh sách hồ sơ.

## Tài khoản seed
- Admin: dùng email/mật khẩu đã cấu hình trong `BE/.env`.
- Buddy mẫu: `nam.buddy@localbuddy.vn`, `my.buddy@localbuddy.vn`, `bao.buddy@localbuddy.vn`, `dung.buddy@localbuddy.vn`; mật khẩu seed là `Buddy@12345` (chỉ dành cho môi trường demo).
- Người dùng có thể đăng ký Traveler hoặc Local từ giao diện.

## API chính
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/buddies`, `GET /api/buddies/:id`
- `POST /api/bookings`, `GET /api/bookings/mine`
- `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/me/buddy-profile`
- `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`
- `GET /api/admin/buddies`, `PATCH /api/admin/buddies/:id/verification`
- `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id`

## Lưu ý
- Xác minh Buddy trong MVP là thao tác duyệt thủ công của Admin, chưa tích hợp nhà cung cấp eKYC.
- Thanh toán trực tuyến, chat realtime, email/SMS thông báo và lịch đồng bộ bên ngoài chưa được tích hợp. Admin cần liên hệ khách qua thông tin yêu cầu để xác nhận.
- Đổi secret và mật khẩu demo trước khi triển khai. Không đưa file `.env` có thông tin bí mật lên GitHub.
