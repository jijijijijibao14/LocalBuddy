# LocalBuddy — Concierge MVP

Dự án gồm frontend React + Vite + Tailwind CSS và backend Express + MongoDB/Mongoose + JWT.

## Giới thiệu và quy mô dự án
LocalBuddy là nền tảng kết nối **Traveler** (du khách) với **Local Buddy** (người địa phương) để đặt các trải nghiệm Ẩm thực, Cà phê, Du lịch. Hệ thống có 3 vai trò: Traveler, Local và Admin.

| Thành phần | Quy mô |
|---|---|
| Frontend (`FE/`) | SPA React 18 + Vite + Tailwind CSS; 10 trang (Trang chủ, Đăng nhập/Đăng ký, Chi tiết Buddy, Hồ sơ, Ví, eKYC, Dashboard Traveler/Local/Admin, VNPay return) và 10 component dùng chung; đa ngôn ngữ vi/en/fr/ja/ko (i18next); biểu đồ Recharts; chat realtime qua socket.io-client |
| Backend (`BE/`) | REST API Express 4 + Socket.IO; 6 model chính (User, BuddyProfile, Booking, Message, Transaction, WalletSettings) và 7 nhóm route (auth, users, buddies, bookings, wallet, chat, admin) với ~50 endpoint; JWT, rate limit, upload file bằng multer |
| Cơ sở dữ liệu | MongoDB (Mongoose) |
| Triển khai | Frontend trên Vercel, backend trên Render (xem mục Triển khai production) |

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

## Chạy trên Expo Go (LocalBuddyMobile)

App Expo chỉ là một WebView mở frontend. URL lấy từ `LocalBuddyMobile/.env` (`EXPO_PUBLIC_WEB_URL`, xem `.env.example`).

Chung:
- `BE/.env`: `CLIENT_URL=http://localhost:5173,http://10.0.2.2:5173,http://<IP Wi-Fi>:5173`
- `FE/.env`: `VITE_API_URL=http://<IP Wi-Fi>:3001/api` (đổi xong phải restart Vite). Khi `npm run build`, Vite dùng `FE/.env.production` (API deploy).
- Chạy backend (`npm run dev` trong `BE`) và frontend `npm run dev:host` trong `FE` (Vite lắng nghe `0.0.0.0:5173`).

**Giả lập Android (BlueStacks/AVD):** đặt `EXPO_PUBLIC_WEB_URL=http://10.0.2.2:5173`, rồi trong `LocalBuddyMobile` chạy `npx expo start -c` và mở trên Expo Go.

**iPhone thật:**
1. Lấy IP Wi-Fi của laptop bằng `ipconfig` (IPv4 Address), iPhone và laptop phải cùng mạng Wi-Fi.
2. Mở Windows Firewall cho các cổng TCP 5173, 3001, 8081 (PowerShell admin: `New-NetFirewallRule -DisplayName "LocalBuddy dev" -Direction Inbound -Protocol TCP -LocalPort 5173,3001,8081 -Action Allow`).
3. Đặt `EXPO_PUBLIC_WEB_URL=http://<IP Wi-Fi>:5173` trong `LocalBuddyMobile/.env`, đảm bảo IP đó có trong `CLIENT_URL` và `VITE_API_URL`.
4. Trong `LocalBuddyMobile` chạy `npx expo start -c`, quét QR bằng Camera/Expo Go.

## Triển khai production
- Backend: cấu hình `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` và `CLIENT_URL` trong nền tảng host. `CLIENT_URL` phải là origin của frontend (ví dụ `https://your-app.vercel.app`), không có `/` cuối; có thể khai báo nhiều origin, phân tách bằng dấu phẩy.
- Frontend: cấu hình `VITE_API_URL` thành URL backend đầy đủ, có `/api` ở cuối (ví dụ `https://your-api.example.com/api`) trong môi trường build của nền tảng frontend. Vite nhúng biến này vào bundle lúc build, vì vậy cần build/deploy lại sau khi thay đổi.
- Không dùng URL `localhost` hoặc URL frontend Vercel làm `VITE_API_URL` production. Nếu thiếu biến này, frontend production sẽ báo lỗi cấu hình rõ ràng thay vì gửi API request nhầm host.
- Ảnh đại diện, ảnh bổ sung và chứng chỉ mới tải lên được lưu trong MongoDB (tối đa 5 MB mỗi tệp), và được phục vụ qua `/media/:id`; lưu ý các URL này có thể truy cập công khai, không tải tài liệu nhạy cảm lên. Cần duy trì MongoDB và sao lưu dữ liệu.
- Các ảnh cũ trong `BE/uploads` vẫn dùng đường dẫn cũ, chưa được tự động chuyển vào MongoDB. Trên host có filesystem tạm thời, ảnh cũ có thể đã mất sau khi deploy; nếu không còn file gốc, người dùng cần tải lại ảnh/chứng chỉ.
- Trang chi tiết Buddy yêu cầu Traveler đăng nhập hoàn thành eKYC demo trước khi xem. eKYC trong dự án chỉ là mô phỏng, không phải xác minh danh tính thật.

## Chức năng theo vai trò
- **Traveler**: đăng ký/đăng nhập, tìm và lọc Buddy, đặt lịch, thanh toán trước (ví, VNPay/QR), nạp tiền và rút tiền, chat với Local/Admin, quản lý hồ sơ.
- **Local**: hoàn tất eKYC demo, quản lý hồ sơ (khu vực, ngôn ngữ, chứng chỉ, ảnh, giá theo giờ), cập nhật lịch rảnh, xác nhận/từ chối/hoàn thành booking, nhận thu nhập vào ví.
- **Admin**: thống kê, duyệt hồ sơ Local, quản lý người dùng và booking, cấu hình hoa hồng/Premium demo, hỗ trợ qua chat.

## Chức năng MVP
- Landing page giới thiệu quy trình và 3 gói trải nghiệm: Ẩm thực, Cà phê, Du lịch.
- Danh sách công khai chỉ hiển thị hồ sơ Buddy đang hoạt động và đã được Admin xác minh.
- Hồ sơ Buddy lấy từ MongoDB; không dùng dữ liệu mẫu dự phòng trong trang chi tiết.
- Form yêu cầu trải nghiệm gồm ngày, khung giờ, số khách, ngôn ngữ, ngân sách phát sinh dự kiến và ghi chú; chi phí ăn uống/đi lại trong chuyến đi do Traveler thanh toán riêng.
- Booking chỉ được gửi đến Local sau khi Traveler thanh toán trước bằng số dư ví hoặc luồng QR demo. Tiền được giữ trong ví hệ thống; Local từ chối sẽ hoàn tiền, hoàn thành sẽ chia hoa hồng và chuyển phần còn lại vào ví Local. Backend kiểm tra mỗi phút theo giờ Việt Nam: lịch đã xác nhận được tự động hoàn thành sau giờ kết thúc; lịch còn chờ sẽ bị hủy và hoàn tiền nếu đã thanh toán. Khi backend dừng, các lịch quá hạn được xử lý lại lúc khởi động.
- Booking cũ đã thanh toán nhưng không có giao dịch giữ tiền cần được Admin đối soát thủ công; hệ thống không tự quyết toán hoặc xác nhận các lịch thiếu trạng thái giữ tiền hợp lệ.
- Ngăn tạo yêu cầu trùng khung giờ đang được giữ hoặc đã xác nhận; Admin và Local cũng kiểm tra xung đột trước khi xác nhận.
- Admin duyệt hồ sơ Local sau khi Local hoàn tất eKYC demo, quản lý riêng Local/Traveler, cấu hình trạng thái Premium demo và cập nhật trạng thái đặt lịch.
- Hồ sơ Local có thể chọn nhiều khu vực hoạt động và thêm tối đa 10 ảnh hồ sơ; Traveler chọn một khu vực. Cả hai role có thể tải ảnh đại diện, thêm nhiều ngôn ngữ và tải chứng chỉ ảnh/PDF không bắt buộc.
- Chat realtime hỗ trợ hội thoại Traveler–Local và hộp thư hỗ trợ với Admin; tin nhắn có thể được trả lời, còn người gửi có thể chỉnh sửa hoặc xóa tin của mình.
- Navbar có lựa chọn Tiếng Việt, Anh, Pháp, Nhật và Hàn; giao diện ví hiển thị quy đổi theo tỷ giá trực tuyến. Số dư, ghi sổ và thanh toán vẫn giữ VND.
- Trang “Ví và giao dịch” dùng chung cho Local, Traveler và Admin. Admin có ví hệ thống và ví Admin; Local thường và Premium demo có thể dùng tỷ lệ hoa hồng riêng.
- Lịch sử Traveler chỉ gồm nạp, rút, thanh toán đặt lịch và hoàn tiền của tài khoản đó; Local chỉ gồm nạp, rút và thu nhập của mình. Lịch sử Admin được chia thành tab ví hệ thống và ví Admin dùng chung. Giao dịch hoàn tiền cũ không tự tạo thêm bản ghi ví hệ thống.
- Rút tiền là demo: chọn ngân hàng Việt Nam, nhập số tài khoản và số tiền VND; giao dịch hoàn tất ngay, không có kết nối chuyển khoản thực. Các yêu cầu cũ đã chờ duyệt vẫn hiện riêng cho Admin xử lý.
- Ví và tự động quyết toán chỉ phục vụ demo; chưa có giao dịch MongoDB nguyên tử hoặc xử lý phục hồi đầy đủ khi tiến trình dừng giữa chừng, không sử dụng với tiền thật.
- Local có thể khai báo giá dịch vụ theo giờ; Traveler lọc theo sở thích, khu vực, ngôn ngữ, ngày/giờ bắt đầu và ngân sách tối đa mỗi giờ. Thời lượng trải nghiệm được dùng khi đặt lịch và tính giá, không dùng để lọc danh sách.
- Hồ sơ cá nhân của Local được đồng bộ sang `BuddyProfile`; tài khoản Local cũ được đồng bộ khi Admin mở danh sách hồ sơ.

## Tài khoản seed
- Admin: dùng email/mật khẩu đã cấu hình trong `BE/.env`.
- Buddy mẫu: `nam.buddy@localbuddy.vn`, `my.buddy@localbuddy.vn`, `bao.buddy@localbuddy.vn`, `dung.buddy@localbuddy.vn`; mật khẩu seed là `Buddy@12345` (chỉ dành cho môi trường demo).
- Người dùng có thể đăng ký Traveler hoặc Local từ giao diện.

## API chính
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/buddies`, `GET /api/buddies/:id`
- `PATCH /api/buddies/mine/availability`
- `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/local`, `PATCH /api/bookings/:id/local-status`
- `POST /api/bookings/:id/pay-wallet`, `POST /api/bookings/:id/pay-vnpay-qr`, `POST /api/bookings/:id/confirm-vnpay-qr`
- `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/me/buddy-profile`, `PATCH /api/users/me/kyc-demo/complete`
- `POST /api/wallet/vnpay/create-url`, `GET /api/wallet/vnpay/return`, `GET /api/wallet/vnpay/ipn`, `POST /api/wallet/confirm-deposit`
- `PATCH /api/admin/users/:id/premium`
- `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`
- `GET /api/admin/buddies`, `PATCH /api/admin/buddies/:id/verification`
- `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id`
- `GET /api/wallet/overview`, `GET /api/wallet/transactions`, `GET /api/wallet/exchange-rates`
- `POST /api/wallet/withdraw`, `PATCH /api/wallet/withdrawals/:id`, `PATCH /api/wallet/commission`
- `GET /api/wallet/withdrawals` (Admin: danh sách yêu cầu rút đang chờ)
- `GET /api/chat/conversations`, `GET /api/chat/support`, `GET/POST /api/chat/:otherUserId/messages`
- `PATCH/DELETE /api/chat/messages/:messageId`

## Lưu ý
- eKYC, xác nhận QR đặt lịch và thanh toán QR trong phiên bản này là luồng demo; chưa kết nối nhà cung cấp xác minh hoặc cổng thanh toán để xác thực giao dịch thực. Không sử dụng cho tiền thật trước khi tích hợp và kiểm thử nhà cung cấp.
- Yêu cầu rút tiền chỉ được ghi nhận và xử lý thủ công bởi Admin; chưa có tích hợp ngân hàng. Tỷ giá hiển thị lấy từ dịch vụ bên ngoài và không làm thay đổi số dư VND.
- Email/SMS thông báo và lịch đồng bộ bên ngoài chưa được tích hợp.
- Đổi secret và mật khẩu demo trước khi triển khai. Không đưa file `.env` có thông tin bí mật lên GitHub.
