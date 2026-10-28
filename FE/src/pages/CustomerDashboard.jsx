import { useEffect, useState } from "react";
import {
  Wallet,
  ShieldCheck,
  CalendarDays,
  MapPin,
  Clock,
  ArrowUpRight,
  UserRound,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";
import { Link } from "react-router-dom";
import WalletTopUpModal from "../components/WalletTopUpModal";
import BookingPaymentModal from "../components/BookingPaymentModal";
import ConversationList from "../components/ConversationList";

function getStoredUser() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("lb_user") || "{}");
    return storedUser.user && !storedUser.fullName
      ? storedUser.user
      : storedUser;
  } catch {
    return {};
  }
}

export default function CustomerDashboard() {
  const [user, setUser] = useState(getStoredUser);
  const [bookings, setBookings] = useState([]);
  const [balance, setBalance] = useState(user.walletBalance || 0);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [selectedBookingForPay, setSelectedBookingForPay] = useState(null);
  const [isBookingPayOpen, setIsBookingPayOpen] = useState(false);
  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((r) => setBookings(r.data))
      .catch(() =>
        setError(
          "Chưa tải được yêu cầu đặt lịch. Bạn vẫn có thể xem thông tin hồ sơ.",
        ),
      );
    api
      .get("/users/me")
      .then(({ data }) => {
        const profile = data.user;
        const updatedUser = { ...getStoredUser(), ...profile };
        setUser(updatedUser);
        setBalance(profile.walletBalance || 0);
        localStorage.setItem("lb_user", JSON.stringify(updatedUser));
      })
      .catch(() =>
        setProfileError("Chưa tải được thông tin hồ sơ mới nhất của bạn."),
      );
  }, []);
  return (
    <div className="container-page py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Không gian cá nhân</p>
          <h1 className="mt-1 text-2xl font-black text-navy sm:text-3xl">
            Chào mừng trở lại, {user.fullName?.split(" ").slice(-1)[0] || "bạn"}
            ! 👋
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Quản lý hồ sơ, ví và những trải nghiệm sắp tới của bạn.
          </p>
        </div>
        <span className="pill">
          <ShieldCheck size={12} />
          Tài khoản Local Buddy
        </span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Điểm hồ sơ",
            value: "98.5%",
            sub: "Thông tin đã cập nhật",
            icon: UserRound,
          },
          {
            label: "Đánh giá",
            value: "4.96/5",
            sub: "Từ cộng đồng",
            icon: ShieldCheck,
          },
          {
            label: "Yêu cầu đặt lịch",
            value: String(bookings.length),
            sub: "Tất cả yêu cầu",
            icon: CalendarDays,
          },
          {
            label: "Số dư ví",
            value: `${Number(balance).toLocaleString("vi-VN")}đ`,
            sub: "Ví Local Buddy",
            icon: Wallet,
          },
        ].map((x) => (
          <div key={x.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {x.label}
              </span>
              <x.icon size={18} className="text-brand" />
            </div>
            <p className="mt-3 text-2xl font-black text-navy">{x.value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{x.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">Hồ sơ cá nhân</h2>
              <Link to="/profile" className="btn-light !py-2">
                Cập nhật hồ sơ
              </Link>
            </div>
            {profileError && (
              <p className="mt-3 text-xs text-amber-700" role="status">
                {profileError}
              </p>
            )}
            <div className="mt-5 flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-brand">
                <UserRound size={25} />
              </div>
              <div>
                <p className="font-extrabold">
                  {user.fullName || "Người dùng Local Buddy"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {user.email || "Chưa có email"}
                </p>
                <span className="pill mt-2">
                  <ShieldCheck size={11} />
                  {user.kycStatus || "Chưa xác minh eKYC"}
                </span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">Số điện thoại</p>
                <p className="mt-1 text-sm font-bold">
                  {user.phone || "Chưa cập nhật"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">Vai trò tài khoản</p>
                <p className="mt-1 text-sm font-bold">
                  {user.role === "traveler"
                    ? "Traveler"
                    : user.role === "local"
                      ? "Local"
                      : user.role === "admin"
                        ? "Admin"
                        : user.role}
                </p>
              </div>
            </div>
          </section>
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">Yêu cầu trải nghiệm của bạn</h2>
              <button
                className="btn-light !py-2"
                onClick={() =>
                  api
                    .get("/bookings/mine")
                    .then((r) => setBookings(r.data))
                    .catch(() => {})
                }
              >
                <RefreshCw size={13} /> Làm mới
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-amber-700">{error}</p>}
            {bookings.length ? (
              <div className="mt-4 space-y-3">
                {bookings.map((b) => (
                  <div
                    key={b._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-navy">
                          {b.buddy?.fullName || "Local Buddy"}
                        </p>
                        {b.paymentStatus === "Paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> Đã thanh toán ({b.paymentMethod === "Wallet" ? "Ví Local" : "VNPAY-QR"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200">
                            <AlertCircle size={11} /> Chưa thanh toán phí
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <CalendarDays size={12} className="mr-1 inline" />
                        {new Date(b.date).toLocaleDateString("vi-VN")} ·{" "}
                        {b.time}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {b.guestCount || 1} khách · {b.language || "Tiếng Việt"}{" "}
                        · Dịch vụ{" "}
                        <b className="text-slate-800 font-bold">
                          {Number(b.price || 0).toLocaleString("vi-VN")} đ
                        </b>
                      </p>
                      {b.foodBudget > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ngân sách ăn uống dự kiến:{" "}
                          {Number(b.foodBudget).toLocaleString("vi-VN")}đ/người
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill">
                        {b.status === "Pending"
                          ? "Chờ xác nhận"
                          : b.status === "Confirmed"
                            ? "Đã xác nhận"
                            : b.status === "Completed"
                              ? "Hoàn thành"
                              : "Đã hủy"}
                      </span>

                      {b.paymentStatus !== "Paid" && b.status !== "Cancelled" && (
                        <button
                          onClick={() => {
                            setSelectedBookingForPay(b);
                            setIsBookingPayOpen(true);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
                          title="Thanh toán phí dịch vụ bằng Ví hoặc VNPAY-QR"
                        >
                          <QrCode size={13} />
                          <span>Thanh toán ngay</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-blue-50 p-6 text-center">
                <CalendarDays className="mx-auto text-brand" size={25} />
                <p className="mt-2 text-sm font-bold">
                  Bạn chưa có yêu cầu trải nghiệm
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Khám phá người bạn địa phương phù hợp với mình.
                </p>
                <Link to="/" className="btn-primary mt-4">
                  Tìm Local Buddy <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </section>
        </div>
        <div className="space-y-5">
          <section className="rounded-2xl bg-gradient-to-br from-[#e3f5ff] via-sky-50 to-[#e7fff5] p-5 shadow-sm border border-sky-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="text-brand" size={19} />
                <h2 className="font-extrabold text-navy">Ví Local Buddy</h2>
              </div>
              <span className="rounded-full bg-[#005baa]/10 px-2.5 py-0.5 text-[10px] font-extrabold text-[#005baa] flex items-center gap-1">
                <QrCode size={11} /> VNPAY-QR
              </span>
            </div>
            <p className="mt-4 text-xs text-slate-500 font-medium">Số dư khả dụng</p>
            <p className="mt-1 text-3xl font-black text-brand">
              {Number(balance).toLocaleString("vi-VN")} đ
            </p>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-900/15 hover:opacity-95 transition-opacity cursor-pointer"
              onClick={() => setIsTopUpOpen(true)}
            >
              <QrCode size={16} />
              <span>Nạp tiền qua VNPAY-QR</span>
            </button>
            <p className="mt-3 text-[10px] leading-4 text-slate-500">
              Hỗ trợ quét QR mọi ngân hàng & ví VNPAY. Xác nhận tức thì.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-extrabold">Bắt đầu khám phá</h2>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: "Coffee & Chill",
                  sub: "Quán cà phê, góc sống chậm",
                  emoji: "☕",
                },
                {
                  title: "Food & Street Food",
                  sub: "Hương vị địa phương",
                  emoji: "🍜",
                },
                {
                  title: "Travel & Danh Lam",
                  sub: "Biển, núi và điểm đến",
                  emoji: "🏝",
                },
              ].map((x) => (
                <Link
                  key={x.title}
                  to="/"
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 hover:bg-blue-50"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl">
                    {x.emoji}
                  </span>
                  <span>
                    <b className="block text-xs">{x.title}</b>
                    <small className="mt-1 block text-[10px] text-slate-500">
                      {x.sub}
                    </small>
                  </span>
                  <ArrowUpRight className="ml-auto text-slate-400" size={15} />
                </Link>
              ))}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="font-extrabold">Hỗ trợ & an toàn</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Không chia sẻ mật khẩu hoặc thông tin thanh toán. Liên hệ hỗ trợ
              nếu bạn gặp vấn đề với đặt lịch.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-brand">
              <Clock size={14} />
              Hỗ trợ khách hàng 24/7
            </p>
          </section>
        </div>
      </div>

      <WalletTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        currentBalance={balance}
        onSuccess={(newBal) => {
          setBalance(newBal);
          const updated = { ...user, walletBalance: newBal };
          setUser(updated);
          localStorage.setItem("lb_user", JSON.stringify(updated));
          window.dispatchEvent(new Event("lb-auth-change"));
        }}
      />

      <BookingPaymentModal
        isOpen={isBookingPayOpen}
        onClose={() => setIsBookingPayOpen(false)}
        booking={selectedBookingForPay}
        onSuccess={(updatedBooking) => {
          setBookings((prev) =>
            prev.map((item) =>
              item._id === updatedBooking._id ? { ...item, ...updatedBooking } : item
            )
          );
          api
            .get("/users/me")
            .then(({ data }) => {
              if (data?.user?.walletBalance != null) {
                setBalance(data.user.walletBalance);
                const updated = { ...user, walletBalance: data.user.walletBalance };
                setUser(updated);
                localStorage.setItem("lb_user", JSON.stringify(updated));
                window.dispatchEvent(new Event("lb-auth-change"));
              }
            })
            .catch(() => {});
          setIsBookingPayOpen(false);
        }}
        onOpenTopUp={() => {
          setIsBookingPayOpen(false);
          setIsTopUpOpen(true);
        }}
      />

      {/* Danh sách tin nhắn trực tiếp */}
      <div className="mt-5">
        <ConversationList currentUser={user} />
      </div>
    </div>
  );
}
