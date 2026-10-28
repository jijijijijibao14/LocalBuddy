import { useEffect, useState } from "react";
import {
  MapPin,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Compass,
  UserRound,
  Star,
  Wallet,
  QrCode,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import WalletTopUpModal from "../components/WalletTopUpModal";
import ConversationList from "../components/ConversationList";

function todayString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isAvailabilityFuture(slot, now = Date.now()) {
  const endTime = new Date(`${slot.date}T${slot.endTime}:00+07:00`).getTime();
  return Number.isFinite(endTime) && endTime > now;
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("lb_user") || "{}");
  } catch {
    return {};
  }
}

function getProfileScore(user) {
  const fields = [
    Boolean(user.fullName?.trim()),
    Boolean(user.phone?.trim()),
    Boolean(user.city?.trim()),
    Boolean(user.bio?.trim()),
    user.languages?.length > 0,
    user.interests?.length > 0,
  ];

  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function LocalDashboard() {
  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityDirty, setAvailabilityDirty] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("Pending");
  const [profileScore, setProfileScore] = useState(0);
  const [walletBalance, setWalletBalance] = useState(
    Number(getStoredUser().walletBalance || 0),
  );
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [date, setDate] = useState(todayString());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentLocalUser, setCurrentLocalUser] = useState(getStoredUser);

  async function loadData() {
    try {
      const [buddyResponse, bookingResponse, userResponse] = await Promise.all([
        api.get("/users/me/buddy-profile"),
        api.get("/bookings/local"),
        api.get("/users/me"),
      ]);

      const user = userResponse.data.user;
      const mine = buddyResponse.data;

      setProfile(mine || null);
      setAvailability(
        (mine?.availability || []).filter((slot) => isAvailabilityFuture(slot)),
      );
      setAvailabilityDirty(false);
      setBookings(bookingResponse.data || []);
      setProfileScore(getProfileScore(user));
      setCurrentLocalUser({ ...getStoredUser(), ...user });
      setWalletBalance(Number(user.walletBalance || 0));
      localStorage.setItem(
        "lb_user",
        JSON.stringify({ ...getStoredUser(), ...user }),
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Không tải được dữ liệu Local.",
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const { data } = await api.get("/users/me/buddy-profile");
        if (availabilityDirty) {
          setAvailability((old) =>
            old.filter((slot) => isAvailabilityFuture(slot)),
          );
        } else {
          setAvailability(
            (data.availability || []).filter((slot) =>
              isAvailabilityFuture(slot),
            ),
          );
        }
      } catch (error) {
        setMessage(
          error.response?.data?.message || "Không thể cập nhật lịch rảnh.",
        );
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [availabilityDirty]);

  function addAvailability() {
    setMessage("");

    if (!date || endTime <= startTime) {
      setMessage("Vui lòng chọn ngày và khung giờ hợp lệ.");
      return;
    }

    if (
      new Date(`${date}T${startTime}:00+07:00`).getTime() <= Date.now()
    ) {
      setMessage("Không thể thêm khung giờ đã bắt đầu hoặc trong quá khứ.");
      return;
    }

    const overlap = availability.some(
      (slot) =>
        slot.date === date &&
        startTime < slot.endTime &&
        endTime > slot.startTime,
    );

    if (overlap) {
      setMessage("Khung giờ này bị trùng với lịch rảnh đã thêm.");
      return;
    }

    setAvailability((old) =>
      [...old, { date, startTime, endTime }].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      ),
    );
    setAvailabilityDirty(true);
  }

  async function saveAvailability() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await api.patch("/buddies/mine/availability", {
        availability,
      });

      setAvailability(data.availability || []);
      setAvailabilityDirty(false);
      setMessage("Đã lưu lịch rảnh thành công.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Không thể lưu lịch rảnh.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBooking(id, status) {
    setMessage("");

    try {
      await api.patch(`/bookings/${id}/local-status`, { status });
      window.dispatchEvent(new Event("lb-bookings-change"));
      setMessage(
        status === "Confirmed" ? "Đã xác nhận yêu cầu." : "Đã từ chối yêu cầu.",
      );

      await loadData();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Không thể cập nhật yêu cầu.",
      );
    }
  }

  const bookingStatusTabs = [
    { status: "Pending", label: "Yêu cầu" },
    { status: "Confirmed", label: "Đã xác nhận" },
    { status: "Cancelled", label: "Đã từ chối" },
  ];
  const filteredBookings = bookings.filter(
    (booking) => booking.status === bookingStatusFilter,
  );

  return (
    <div className="container-page space-y-6 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-[#e2f4ff] via-white to-[#e7fff5] p-6 sm:p-9">
        <span className="pill">
          <MapPin size={13} /> KHÔNG GIAN LOCAL BUDDY
        </span>
        <h1 className="mt-4 text-3xl font-black text-navy">Xin chào, Local!</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Quản lý lịch rảnh để Traveler tìm được thời gian phù hợp và gửi yêu
          cầu trải nghiệm trực tiếp đến bạn.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">
            <Compass size={15} /> Xem trang chủ
          </Link>
          <Link to="/profile" className="btn-light">
            Hồ sơ của tôi
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Điểm hồ sơ",
            value: `${profileScore}%`,
            sub: "Mức độ hoàn thiện hồ sơ Local",
            icon: UserRound,
          },
          {
            label: "Đánh giá",
            value:
              profile?.rating == null
                ? "Chưa có"
                : `${Number(profile.rating).toFixed(1)}/5`,
            sub: "Điểm đánh giá hồ sơ Buddy",
            icon: Star,
          },
          {
            label: "Yêu cầu đặt lịch",
            value: String(bookings.length),
            sub: "Tất cả yêu cầu gửi đến bạn",
            icon: CalendarDays,
          },
          {
            label: "Số dư ví",
            value: `${walletBalance.toLocaleString("vi-VN")}đ`,
            sub: "Ví Local Buddy",
            icon: Wallet,
          },
        ].map((item) => (
          <div key={item.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {item.label}
              </span>
              <item.icon size={18} className="text-brand" />
            </div>
            <p className="mt-3 text-2xl font-black text-navy">{item.value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{item.sub}</p>
          </div>
        ))}
      </section>

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
        <p className="mt-4 text-xs font-medium text-slate-500">Số dư khả dụng</p>
        <p className="mt-1 text-3xl font-black text-brand">
          {walletBalance.toLocaleString("vi-VN")} đ
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setIsTopUpOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-blue-900/15 hover:opacity-95 transition-opacity cursor-pointer"
          >
            <QrCode size={15} />
            <span>Nạp tiền qua VNPAY-QR</span>
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Nạp tiền nhanh chóng qua cổng VNPAY-QR để sẵn sàng chi trả các dịch vụ và trải nghiệm.
        </p>
      </section>

      <section className="panel p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-brand" size={25} />
          <div>
            <h2 className="text-xl font-black text-navy">Lịch rảnh của tôi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Thêm nhiều ngày và khung giờ bạn có thể nhận khách.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-bold">
            Ngày rảnh
            <input
              type="date"
              className="field mt-2"
              min={todayString()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            Từ giờ
            <input
              type="time"
              className="field mt-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            Đến giờ
            <input
              type="time"
              className="field mt-2"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-light" onClick={addAvailability}>
            <CalendarDays size={16} /> Thêm ngày và giờ
          </button>
          <button
            className="btn-primary"
            onClick={saveAvailability}
            disabled={loading}
          >
            <Save size={16} />
            {loading ? "Đang lưu..." : "Lưu lịch rảnh"}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {availability.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Bạn chưa thêm lịch rảnh nào.
            </p>
          )}

          {availability.map((slot, index) => (
            <div
              key={`${slot.date}-${slot.startTime}-${index}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
            >
              <div>
                <p className="font-bold text-navy">{slot.date}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <Clock size={15} />
                  {slot.startTime} – {slot.endTime}
                </p>
              </div>
              <button
                className="btn-light"
                onClick={() => {
                  setAvailability((old) => old.filter((_, i) => i !== index));
                  setAvailabilityDirty(true);
                }}
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-brand" size={24} />
          <div>
            <h2 className="text-xl font-black text-navy">
              Yêu cầu trải nghiệm
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Các yêu cầu gửi đến hồ sơ Local của bạn.
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Lọc yêu cầu trải nghiệm"
        >
          {bookingStatusTabs.map((tab) => {
            const count = bookings.filter(
              (booking) => booking.status === tab.status,
            ).length;

            return (
              <button
                key={tab.status}
                id={`booking-tab-${tab.status}`}
                type="button"
                role="tab"
                aria-selected={bookingStatusFilter === tab.status}
                aria-controls="booking-list"
                onClick={() => setBookingStatusFilter(tab.status)}
                className={
                  bookingStatusFilter === tab.status
                    ? "btn-primary"
                    : "btn-light"
                }
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div
          id="booking-list"
          role="tabpanel"
          aria-labelledby={`booking-tab-${bookingStatusFilter}`}
          className="mt-5 space-y-4"
        >
          {filteredBookings.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {bookingStatusFilter === "Pending"
                ? "Chưa có yêu cầu trải nghiệm nào đang chờ xác nhận."
                : bookingStatusFilter === "Confirmed"
                  ? "Chưa có yêu cầu trải nghiệm nào đã xác nhận."
                  : "Chưa có yêu cầu trải nghiệm nào đã từ chối."}
            </p>
          )}

          {filteredBookings.map((booking) => (
            <article
              key={booking._id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-navy">
                    {booking.customer?.fullName || "Traveler"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.customer?.email || ""}
                  </p>
                  <p className="mt-3 text-sm">
                    Ngày: {booking.date?.slice(0, 10)}
                  </p>
                  <p className="mt-1 text-sm">
                    Giờ: {booking.startTime} – {booking.endTime} (
                    {booking.durationHours} giờ)
                  </p>
                  <p className="mt-1 text-sm">
                    Số khách: {booking.guestCount || 1} người
                  </p>

                  <p className="mt-1 text-sm">
                    Ngôn ngữ: {booking.language || "Tiếng Việt"}
                  </p>

                  <p className="mt-1 text-sm">
                    Ngân sách ăn uống/người:{" "}
                    {Number(booking.foodBudget || 0).toLocaleString("vi-VN")}đ
                  </p>
                  {booking.message && (
                    <p className="mt-2 text-sm text-slate-600">
                      Lời nhắn: {booking.message}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-bold text-brand">
                    {Number(booking.price || 0).toLocaleString("vi-VN")}đ
                  </p>
                </div>
                <span className="pill">
                  {booking.status === "Cancelled"
                    ? "Đã từ chối"
                    : booking.status === "Pending"
                      ? "Chờ xác nhận"
                      : booking.status === "Confirmed"
                        ? "Đã xác nhận"
                        : booking.status}
                </span>
              </div>

              {booking.status === "Pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => updateBooking(booking._id, "Confirmed")}
                  >
                    <CheckCircle2 size={16} /> Xác nhận
                  </button>
                  <button
                    className="btn-light"
                    onClick={() => updateBooking(booking._id, "Cancelled")}
                  >
                    <XCircle size={16} /> Từ chối
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {profile && (
        <section className="panel flex flex-wrap items-center gap-4 p-5">
          <img
            src={profile.coverImage}
            alt={profile.fullName}
            className="h-20 w-28 rounded-xl object-cover"
          />
          <div>
            <h2 className="font-extrabold">{profile.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">{profile.area}</p>
          </div>
          <Link to={`/buddy/${profile._id}`} className="btn-light ml-auto">
            Xem hồ sơ
          </Link>
        </section>
      )}

      {message && (
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-brand">
          {message}
        </p>
      )}

      {/* Danh sách tin nhắn trực tiếp */}
      <div className="mt-5">
        <ConversationList currentUser={currentLocalUser} />
      </div>

      <WalletTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        currentBalance={walletBalance}
        onSuccess={(newBal) => {
          setWalletBalance(newBal);
          const u = getStoredUser();
          const updated = { ...u, walletBalance: newBal };
          localStorage.setItem("lb_user", JSON.stringify(updated));
          window.dispatchEvent(new Event("lb-auth-change"));
        }}
      />
    </div>
  );
}
