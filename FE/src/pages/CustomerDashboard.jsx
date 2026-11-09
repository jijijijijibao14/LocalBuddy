import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CalendarDays,
  MapPin,
  Clock,
  ArrowUpRight,
  UserRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";
import { Link } from "react-router-dom";
import BookingPaymentModal from "../components/BookingPaymentModal";
import ConversationList from "../components/ConversationList";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

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
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [selectedBookingForPay, setSelectedBookingForPay] = useState(null);
  const [isBookingPayOpen, setIsBookingPayOpen] = useState(false);
  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((r) => setBookings(r.data))
      .catch(() =>
        setError(t("errors.bookings")),
      );
    api
      .get("/users/me")
      .then(({ data }) => {
        const profile = data.user;
        const updatedUser = { ...getStoredUser(), ...profile };
        setUser(updatedUser);
        localStorage.setItem("lb_user", JSON.stringify(updatedUser));
      })
      .catch(() =>
        setProfileError(t("errors.profile")),
      );
  }, [t]);
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
                onClick={() =>
                  api
                    .get("/bookings/mine")
                    .then((r) => setBookings(r.data))
                    .catch(() => {})
                }
              >
                <RefreshCw size={13} /> {t("bookings.refresh")}
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
                          {b.buddy?.fullName || t("bookings.defaultBuddy")}
                        </p>
                        {b.paymentStatus === "Paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} />{" "}
                            {t("bookings.paid", {
                              method:
                                b.paymentMethod === "Wallet"
                                  ? t("bookings.methodWallet")
                                  : "VNPAY-QR",
                            })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200">
                            <AlertCircle size={11} /> {t("bookings.unpaid")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <CalendarDays size={12} className="mr-1 inline" />
                        {new Date(b.date).toLocaleDateString(locale)} ·{" "}
                        {b.time}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("bookings.guests", { count: b.guestCount || 1 })} ·{" "}
                        {b.language || t("bookings.defaultLanguage")} ·{" "}
                        {t("bookings.service")}{" "}
                        <b className="text-slate-800 font-bold">
                          {formatCurrency(b.price || 0)}
                        </b>
                      </p>
                      {b.foodBudget > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t("bookings.foodBudget", {
                            amount: Number(b.foodBudget).toLocaleString(locale),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill">
                        {b.status === "Pending"
                          ? t("status.pending")
                          : b.status === "Confirmed"
                            ? t("status.confirmed")
                            : b.status === "Completed"
                              ? t("status.completed")
                              : t("status.cancelled")}
                      </span>

                      {b.paymentStatus !== "Paid" && b.status !== "Cancelled" && (
                        <button
                          onClick={() => {
                            setSelectedBookingForPay(b);
                            setIsBookingPayOpen(true);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
                          title={t("bookings.payTitle")}
                        >
                          <QrCode size={13} />
                          <span>{t("bookings.payNow")}</span>
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
