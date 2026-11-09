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

## Triển khai production
- Backend: cấu hình `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` và `CLIENT_URL` trong nền tảng host. `CLIENT_URL` phải là origin của frontend (ví dụ `https://your-app.vercel.app`), không có `/` cuối; có thể khai báo nhiều origin, phân tách bằng dấu phẩy.
- Frontend: cấu hình `VITE_API_URL` thành URL backend đầy đủ, có `/api` ở cuối (ví dụ `https://your-api.example.com/api`) trong môi trường build của nền tảng frontend. Vite nhúng biến này vào bundle lúc build, vì vậy cần build/deploy lại sau khi thay đổi.
- Không dùng URL `localhost` hoặc URL frontend Vercel làm `VITE_API_URL` production. Nếu thiếu biến này, frontend production sẽ báo lỗi cấu hình rõ ràng thay vì gửi API request nhầm host.
- Thư mục `BE/uploads` là ổ đĩa cục bộ; trên host có filesystem tạm thời, file tải lên có thể mất khi service khởi động lại hoặc deploy. Dùng object storage bền vững trước khi cần giữ ảnh/chứng chỉ production.

## Chức năng MVP
- Landing page giới thiệu quy trình và 3 gói trải nghiệm: Ẩm thực, Cà phê, Du lịch.
- Danh sách công khai chỉ hiển thị hồ sơ Buddy đang hoạt động và đã được Admin xác minh.
- Hồ sơ Buddy lấy từ MongoDB; không dùng dữ liệu mẫu dự phòng trong trang chi tiết.
- Form yêu cầu trải nghiệm gồm ngày, khung giờ, số khách, ngôn ngữ, ngân sách phát sinh dự kiến và ghi chú; chi phí ăn uống/đi lại trong chuyến đi do Traveler thanh toán riêng.
- Booking chỉ được gửi đến Local sau khi Traveler thanh toán trước bằng số dư ví hoặc luồng QR demo. Tiền được giữ trong ví hệ thống; Local từ chối sẽ hoàn tiền, Local đánh dấu hoàn thành sẽ chia hoa hồng và chuyển phần còn lại vào ví Local.
- Ngăn tạo yêu cầu trùng khung giờ đang được giữ hoặc đã xác nhận; Admin và Local cũng kiểm tra xung đột trước khi xác nhận.
- Admin duyệt hồ sơ Local sau khi Local hoàn tất eKYC demo, quản lý riêng Local/Traveler, cấu hình trạng thái Premium demo và cập nhật trạng thái đặt lịch.
- Hồ sơ Local có thể chọn nhiều khu vực hoạt động và thêm tối đa 10 ảnh hồ sơ; Traveler chọn một khu vực. Cả hai role có thể tải ảnh đại diện, thêm nhiều ngôn ngữ và tải chứng chỉ ảnh/PDF không bắt buộc.
- Chat realtime hỗ trợ hội thoại Traveler–Local và hộp thư hỗ trợ với Admin; tin nhắn có thể được trả lời, còn người gửi có thể chỉnh sửa hoặc xóa tin của mình.
- Navbar có lựa chọn Tiếng Việt, Anh, Pháp, Nhật và Hàn; giao diện ví hiển thị quy đổi theo tỷ giá trực tuyến. Số dư, ghi sổ và thanh toán vẫn giữ VND.
- Trang “Ví và giao dịch” dùng chung cho Local, Traveler và Admin. Admin có ví hệ thống và ví Admin; Local/Traveler/Admin có thể gửi yêu cầu rút tiền, Admin xử lý thủ công. Local thường và Premium demo có thể dùng tỷ lệ hoa hồng riêng.
- Local có thể khai báo giá dịch vụ theo giờ; Traveler lọc theo sở thích, khu vực, ngôn ngữ, ngày/giờ bắt đầu và ngân sách tối đa mỗi giờ. Thời lượng trải nghiệm được dùng khi đặt lịch và tính giá, không dùng để lọc danh sách.
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
- `GET /api/wallet/overview`, `GET /api/wallet/transactions`, `GET /api/wallet/exchange-rates`
- `POST /api/wallet/withdraw`, `PATCH /api/wallet/withdrawals/:id`, `PATCH /api/wallet/commission`
- `GET /api/chat/conversations`, `GET /api/chat/support`, `GET/POST /api/chat/:otherUserId/messages`
- `PATCH/DELETE /api/chat/messages/:messageId`

## Lưu ý
- eKYC, xác nhận QR đặt lịch và thanh toán QR trong phiên bản này là luồng demo; chưa kết nối nhà cung cấp xác minh hoặc cổng thanh toán để xác thực giao dịch thực. Không sử dụng cho tiền thật trước khi tích hợp và kiểm thử nhà cung cấp.
- Yêu cầu rút tiền chỉ được ghi nhận và xử lý thủ công bởi Admin; chưa có tích hợp ngân hàng. Tỷ giá hiển thị lấy từ dịch vụ bên ngoài và không làm thay đổi số dư VND.
- Email/SMS thông báo và lịch đồng bộ bên ngoài chưa được tích hợp.
- Đổi secret và mật khẩu demo trước khi triển khai. Không đưa file `.env` có thông tin bí mật lên GitHub.
