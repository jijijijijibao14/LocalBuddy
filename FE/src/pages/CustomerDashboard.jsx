import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CalendarDays,
  MapPin,
  Clock,
  ArrowUpRight,
  UserRound,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";
import { Link } from "react-router-dom";
import BookingPaymentModal from "../components/BookingPaymentModal";
import WalletTopUpModal from "../components/WalletTopUpModal";
import ConversationList from "../components/ConversationList";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";
import { paginate } from "../utils/pagination";
import Pagination from "../components/Pagination";
import BookingDetailsModal from "../components/BookingDetailsModal";

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
  const { t } = useTranslation("customerDashboard");
  const { formatCurrency, language, languages } = useLocale();
  const locale = languages.find((l) => l.code === language)?.locale || "vi-VN";
  const [user, setUser] = useState(getStoredUser);
  const [walletBalance, setWalletBalance] = useState(() => Number(getStoredUser().walletBalance || 0));
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [selectedBookingForPay, setSelectedBookingForPay] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isBookingPayOpen, setIsBookingPayOpen] = useState(false);
  const [bookingStatusTab, setBookingStatusTab] = useState("Pending");
  const [bookingPage, setBookingPage] = useState(1);
  const bookingTabs = [
    ["Pending", t("status.pending")],
    ["Confirmed", t("status.confirmed")],
    ["Completed", t("status.completed")],
    ["Cancelled", t("status.cancelled")],
  ];
  const filteredBookings = bookings.filter((booking) => booking.status === bookingStatusTab);
  const bookingResult = paginate(filteredBookings, bookingPage, 3);
  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((r) => setBookings(r.data))
      .catch(() =>
        setError(t("errors.bookings")),
      );
    api.get("/bookings/refunds/mine")
      .then((r) => setRefunds(r.data))
      .catch(() => setError("Không thể tải lịch sử hoàn tiền."));
    api
      .get("/users/me")
      .then(({ data }) => {
        const profile = data.user;
        const updatedUser = { ...getStoredUser(), ...profile };
        setUser(updatedUser);
        setWalletBalance(Number(updatedUser.walletBalance || 0));
        localStorage.setItem("lb_user", JSON.stringify(updatedUser));
      })
      .catch(() =>
        setProfileError(t("errors.profile")),
      );
  }, [t]);

  async function startCancellation(booking) {
    try {
        setRefundNotice("");
        const { data } = await api.get(`/bookings/${booking._id}/refund-quote`);
        setSelectedBookingForCancellation(booking);
        setRefundQuote(data);
        setCancellationReason("");
    } catch (e) {
        setError(e.response?.data?.message || "Không thể tính số tiền hoàn dự kiến.");
    }
  }

  async function submitCancellation() {
    if (!selectedBookingForCancellation) return;
    setCancellationLoading(true);
    setError("");
    try {
        const { data } = await api.post(
          `/bookings/${selectedBookingForCancellation._id}/cancel`,
          { reason: cancellationReason },
        );
        setBookings((prev) =>
          prev.map((item) => item._id === data.booking._id ? { ...item, ...data.booking } : item),
        );
        if (data.refund) setRefunds((prev) => [data.refund, ...prev]);
        setRefundNotice(data.message);
        setSelectedBookingForCancellation(null);
        setRefundQuote(null);
    } catch (e) {
        setError(e.response?.data?.message || "Không thể gửi yêu cầu hủy lịch.");
    } finally {
        setCancellationLoading(false);
    }
  }
  return (
    <div className="container-page py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-black text-navy sm:text-3xl">
            {t("welcome", {
              name: user.fullName?.split(" ").slice(-1)[0] || t("defaultName"),
            })}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("subtitle")}
          </p>
        </div>
        <span className="pill">
          <ShieldCheck size={12} />
          {t("accountPill")}
        </span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: t("stats.profileScore"),
            value: "98.5%",
            sub: t("stats.profileScoreSub"),
            icon: UserRound,
          },
          {
            label: t("stats.rating"),
            value: "4.96/5",
            sub: t("stats.ratingSub"),
            icon: ShieldCheck,
          },
          {
            label: t("stats.bookings"),
            value: String(bookings.length),
            sub: t("stats.bookingsSub"),
            icon: CalendarDays,
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
              <h2 className="font-extrabold">{t("profile.title")}</h2>
              <Link to="/profile" className="btn-light !py-2">
                {t("profile.update")}
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
                  {user.fullName || t("profile.defaultUser")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {user.email || t("profile.noEmail")}
                </p>
                <span className="pill mt-2">
                  <ShieldCheck size={11} />
                  {user.kycStatus || t("profile.kycDefault")}
                </span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">{t("profile.phone")}</p>
                <p className="mt-1 text-sm font-bold">
                  {user.phone || t("profile.notUpdated")}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">{t("profile.role")}</p>
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
              <h2 className="font-extrabold">{t("bookings.title")}</h2>
              <button
                className="btn-light !py-2"
                onClick={() => Promise.all([
                  api.get("/bookings/mine").then((r) => setBookings(r.data)),
                  api.get("/bookings/refunds/mine").then((r) => setRefunds(r.data)),
                ]).catch((e) => setError(e.response?.data?.message || "Không thể tải dữ liệu đặt lịch."))}
              >
                <RefreshCw size={13} /> {t("bookings.refresh")}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-amber-700">{error}</p>}
            {refundNotice && <p className="mt-3 text-xs text-emerald-700" role="status">{refundNotice}</p>}
            {bookings.length ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t("bookings.filterLabel")}>
                  {bookingTabs.map(([status, label]) => {
                    const count = bookings.filter((booking) => booking.status === status).length;
                    return (
                      <button
                        key={status}
                        type="button"
                        role="tab"
                        aria-selected={bookingStatusTab === status}
                        onClick={() => { setBookingStatusTab(status); setBookingPage(1); }}
                        className={bookingStatusTab === status ? "btn-primary" : "btn-light"}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
                {bookingResult.items.length ? (
                  <div className="mt-4 space-y-3">
                    {bookingResult.items.map((b) => (
                      <div key={b._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelectedBooking(b)}
                          >
                              <span className="font-extrabold text-navy">{b.buddy?.fullName || t("bookings.defaultBuddy")}</span>
                              <span className="ml-2 text-xs text-slate-500">
                                <CalendarDays size={12} className="mr-1 inline" />
                                {new Date(b.date).toLocaleDateString(locale)} · {b.time}
                              </span>
                              <span className="ml-2 pill">{t(`status.${b.status.toLowerCase()}`)}</span>
                          </button>
                          {b.paymentStatus !== "Paid" && b.status !== "Cancelled" && (
                            <button
                              onClick={() => { setSelectedBookingForPay(b); setIsBookingPayOpen(true); }}
                              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:opacity-95"
                              title={t("bookings.payTitle")}
                            >
                              <QrCode size={13} /> <span>{t("bookings.payNow")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-blue-50 p-5 text-center text-sm text-slate-600">{t("bookings.emptyStatus")}</p>
                )}
                {filteredBookings.length > 3 && (
                  <Pagination
                    result={bookingResult}
                    onChange={setBookingPage}
                    previousLabel={t("bookings.previous")}
                    nextLabel={t("bookings.next")}
                    pageLabel={t("bookings.page", { page: bookingResult.page, total: bookingResult.pageCount })}
                  />
                )}
              </>
            ) : (
              <div className="mt-4 rounded-xl bg-blue-50 p-6 text-center">
                <CalendarDays className="mx-auto text-brand" size={25} />
                <p className="mt-2 text-sm font-bold">
                  {t("empty.title")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("empty.desc")}
                </p>
                <Link to="/" className="btn-primary mt-4">
                  {t("empty.cta")} <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </section>
        </div>
        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="font-extrabold">{t("explore.title")}</h2>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: "Coffee & Chill",
                  sub: t("explore.coffee"),
                  emoji: "☕",
                },
                {
                  title: "Food & Street Food",
                  sub: t("explore.food"),
                  emoji: "🍜",
                },
                {
                  title: "Travel & Danh Lam",
                  sub: t("explore.travel"),
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
            <h2 className="font-extrabold">{t("support.title")}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {t("support.body")}
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-brand">
              <Clock size={14} />
              {t("support.hotline")}
            </p>
          </section>
        </div>
      </div>

      {selectedBookingForCancellation && refundQuote && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="flex items-start gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
                <CalendarDays size={20} />
              </span>
              <div>
                <h2 id="cancel-booking-title" className="text-lg font-black text-navy">
                  Xác nhận hủy lịch
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(selectedBookingForCancellation.date).toLocaleDateString(locale)} · {selectedBookingForCancellation.time}
                </p>
              </div>
            </header>

            <div className="space-y-5 px-6 py-5 sm:px-7">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-navy">Chính sách hoàn tiền</h3>
                  {refundQuote.hoursUntilExperience != null && refundQuote.hoursUntilExperience > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-brand">
                      <Clock size={12} />
                      Còn {refundQuote.hoursUntilExperience.toLocaleString(locale, { maximumFractionDigits: 1 })} giờ
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Hơn 6 tiếng", refundQuote.policy.overSixHoursPercent],
                    ["3–6 tiếng", refundQuote.policy.threeToSixHoursPercent],
                    ["1–3 tiếng", refundQuote.policy.oneToThreeHoursPercent],
                    ["Dưới 1 tiếng", refundQuote.policy.underOneHourPercent],
                  ].map(([label, percent]) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <p className="text-[11px] font-medium text-slate-500">{label}</p>
                      <p className="mt-1 text-lg font-black text-navy">{percent}%</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Từ lúc trải nghiệm bắt đầu: <b className="text-slate-700">0%</b>
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 sm:p-5">
                <p className="text-xs font-semibold text-red-800">Số tiền hoàn dự kiến</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-2xl font-black tracking-tight text-navy sm:text-3xl">
                    {formatCurrency(refundQuote.amount)}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-red-700 ring-1 ring-red-100">
                    {refundQuote.percentage}% hoàn
                  </span>
                </div>
                {refundQuote.paid && selectedBookingForCancellation.paymentMethod !== "Wallet" && refundQuote.amount > 0 && (
                  <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-amber-800">
                    Khoản PayOS cần Admin xử lý trên cổng thanh toán; trạng thái chỉ hoàn tất sau khi đối soát mã giao dịch.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700" htmlFor="cancellation-reason">
                  Lý do hủy <span className="font-medium text-slate-400">(ít nhất 3 ký tự)</span>
                </label>
                <textarea
                  id="cancellation-reason"
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-100"
                  placeholder="Chia sẻ ngắn gọn lý do bạn muốn hủy..."
                />
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                className="btn-light justify-center"
                disabled={cancellationLoading}
                onClick={() => setSelectedBookingForCancellation(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-red-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm shadow-red-900/15 transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-80"
                disabled={cancellationLoading || cancellationReason.trim().length < 3}
                onClick={submitCancellation}
              >
                {cancellationLoading ? "Đang gửi..." : "Xác nhận hủy"}
              </button>
            </footer>
          </section>
        </div>
      )}

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
          const updatedUser = getStoredUser();
          setUser(updatedUser);
          setWalletBalance(Number(updatedUser.walletBalance || 0));
          setIsBookingPayOpen(false);
        }}
        onOpenTopUp={() => {
          setIsBookingPayOpen(false);
          setIsTopUpOpen(true);
        }}
      />
      {selectedBooking && (
        <BookingDetailsModal
          title={t("bookings.details")}
          closeLabel={t("bookings.close")}
          onClose={() => setSelectedBooking(null)}
          fields={[
            { label: t("bookings.buddy"), value: selectedBooking.buddy?.fullName || t("bookings.defaultBuddy") },
            { label: t("bookings.status"), value: t(`status.${selectedBooking.status.toLowerCase()}`) },
            { label: t("bookings.dateTime"), value: `${new Date(selectedBooking.date).toLocaleDateString(locale)} · ${selectedBooking.time}` },
            { label: t("bookings.guestsLabel"), value: `${selectedBooking.guestCount || 1} · ${selectedBooking.language || t("bookings.defaultLanguage")}` },
            { label: t("bookings.service"), value: formatCurrency(selectedBooking.price || 0) },
            { label: t("bookings.payment"), value: selectedBooking.paymentStatus === "Paid"
              ? t("bookings.paid", { method: selectedBooking.paymentMethod === "Wallet" ? t("bookings.methodWallet") : "VNPAY-QR" })
              : t("bookings.unpaid") },
            ...(selectedBooking.foodBudget > 0 ? [{ label: t("bookings.foodBudgetLabel"), value: t("bookings.foodBudget", { amount: Number(selectedBooking.foodBudget).toLocaleString(locale) }) }] : []),
            { label: t("bookings.meetingAddressLabel"), value: selectedBooking.meetingAddress, fullWidth: true },
            { label: t("bookings.message"), value: selectedBooking.message, fullWidth: true },
          ]}
        >
          {selectedBooking.paymentStatus !== "Paid" && selectedBooking.status !== "Cancelled" && (
            <button type="button" className="btn-primary" onClick={() => {
              setSelectedBookingForPay(selectedBooking);
              setSelectedBooking(null);
              setIsBookingPayOpen(true);
            }}>
              <QrCode size={14} /> {t("bookings.payNow")}
            </button>
          )}
        </BookingDetailsModal>
      )}

      <WalletTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        currentBalance={walletBalance}
        onSuccess={(newBalance) => {
          const updatedUser = { ...getStoredUser(), walletBalance: Number(newBalance) };
          setWalletBalance(Number(newBalance));
          setUser(updatedUser);
        }}
      />

      {/* Danh sách tin nhắn trực tiếp */}
      <div className="mt-5">
        <ConversationList currentUser={user} />
      </div>
    </div>
  );
}
