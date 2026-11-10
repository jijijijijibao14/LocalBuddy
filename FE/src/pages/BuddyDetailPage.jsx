import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Languages,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Users,
  Utensils,
  Wallet,
  QrCode,
} from "lucide-react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import BookingPaymentModal from "../components/BookingPaymentModal";
import WalletTopUpModal from "../components/WalletTopUpModal";
import ChatModal from "../components/ChatModal";
import { useLocale } from "../contexts/LocaleContext";
import { useTranslation } from "react-i18next";

const defaultTimes = ["09:00 - 12:00", "13:00 - 16:00", "15:00 - 18:00"];

export default function BuddyDetailPage() {
  const { formatCurrency } = useLocale();
  const { t } = useTranslation("buddy");
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [buddy, setBuddy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(
    searchParams.get("date") || ""
  );

  const [startTime, setStartTime] = useState(
    searchParams.get("startTime") || "09:00"
  );

  const [durationHours, setDurationHours] = useState(
    Number(searchParams.get("durationHours") || 3)
  );
  const [guestCount, setGuestCount] = useState("1");
  const [language, setLanguage] = useState("Tiếng Việt");
  const [foodBudget, setFoodBudget] = useState("150000");
  const [experienceBudget, setExperienceBudget] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const bookingHeadingRef = useRef(null);
  const bookingButtonRef = useRef(null);
  const bookingDialogRef = useRef(null);

  // Trạng thái thanh toán phí giao dịch
  const [paymentMethod, setPaymentMethod] = useState("Wallet"); // 'Wallet' | 'VNPAY_QR' | 'None'
  const [walletBalance, setWalletBalance] = useState(0);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [initialQrData, setInitialQrData] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Chat state
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  useEffect(() => {
    if (searchParams.get("openChat") === "true" || searchParams.get("openChat") === "1") {
      if (buddy && localStorage.getItem("lb_token")) {
        const localUser = {
          _id: buddy.user || buddy._id,
          fullName: buddy.fullName,
          avatar: buddy.coverImage || buddy.avatar || "",
          role: "local",
        };
        window.dispatchEvent(
          new CustomEvent("lb-open-chat", {
            detail: { otherUser: localUser },
          })
        );
      }
    }
  }, [searchParams, buddy]);
  const [isChatOpen, setIsChatOpen] = useState(
    searchParams.get("openChat") === "true" || searchParams.get("openChat") === "1"
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (bookingFormOpen && !isPayModalOpen && !isTopUpOpen && bookingDialogRef.current) {
      if (!bookingDialogRef.current.open) bookingDialogRef.current.showModal();
      bookingHeadingRef.current?.focus();
    }
  }, [bookingFormOpen, isPayModalOpen, isTopUpOpen]);

  function closeBookingForm() {
    if (submitting) return;
    setBookingFormOpen(false);
    bookingButtonRef.current?.focus();
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem("lb_user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      const target = u.user && !u.fullName ? u.user : u;
      if (target && !target._id && target.id) target._id = target.id;
      return target;
    } catch {
      return null;
    }
  }

  const endMinutes = (() => {
    const [hour, minute] = startTime.split(":").map(Number);
    return hour * 60 + minute + Number(durationHours) * 60;
  })();

  const endTime =
    Number.isFinite(endMinutes) && endMinutes <= 24 * 60
      ? `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
      : "";

  // Tính chi phí dịch vụ dự kiến
  const estimatedPrice = buddy?.price
    ? Math.round((Number(buddy.price) / 3) * Number(durationHours))
    : 0;
  const isBalanceEnough = walletBalance >= estimatedPrice;

  // Lấy số dư ví của traveler
  const fetchWallet = () => {
    if (localStorage.getItem("lb_token")) {
      api
        .get("/users/me")
        .then(({ data }) => {
          if (data?.user?.walletBalance != null) {
            setWalletBalance(Number(data.user.walletBalance));
          }
        })
        .catch(() => {
          try {
            const u = JSON.parse(localStorage.getItem("lb_user") || "{}");
            setWalletBalance(Number(u.walletBalance || 0));
          } catch {}
        });
    }
  };

  useEffect(() => {
    fetchWallet();
    const handleAuthChange = () => fetchWallet();
    window.addEventListener("lb-auth-change", handleAuthChange);
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener("lb-auth-change", syncUser);
    return () => {
      window.removeEventListener("lb-auth-change", handleAuthChange);
      window.removeEventListener("lb-auth-change", syncUser);
    };
  }, []);

  const availableSlots = [...(buddy?.availability || [])].sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/buddies/${id}`)
      .then((response) => {
        if (!cancelled) setBuddy(response.data);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error.response?.data?.message ||
              t("loadError"),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function book() {
    if (!localStorage.getItem("lb_token")) {
      setNotice(
        t("loginRequired"),
      );
      return;
    }
    if (!date) {
      setNotice(t("chooseDate"));
      return;
    }
    if (!endTime || endMinutes > 24 * 60) {
      setNotice(t("invalidTime"));
      return;
    }

    if (paymentMethod === "Wallet" && !isBalanceEnough) {
      setNotice(
        t("insufficientWallet", { current: formatCurrency(walletBalance), required: formatCurrency(estimatedPrice) })
      );
      return;
    }

    setSubmitting(true);
    setNotice("");
    setBookingSuccess(false);

    try {
      const response = await api.post("/bookings", {
        buddyId: buddy._id || buddy.id,
        date,
        startTime,
        endTime,
        durationHours: Number(durationHours),
        guestCount: Number(guestCount),
        language,
        foodBudget: Number(foodBudget),
        experienceBudget: Number(experienceBudget || 0),
        message,
        paymentMethod,
      });

      const data = response.data;
      if (data?.booking) {
        setCreatedBooking(data.booking);
      }

      if (paymentMethod === "Wallet") {
        if (data?.newBalance != null) {
          setWalletBalance(data.newBalance);
          try {
            const raw = localStorage.getItem("lb_user");
            if (raw) {
              const u = JSON.parse(raw);
              u.walletBalance = data.newBalance;
              localStorage.setItem("lb_user", JSON.stringify(u));
              window.dispatchEvent(new Event("lb-auth-change"));
            }
          } catch {}
        }
        setBookingSuccess(true);
        setNotice(
          t("bookingSuccessWallet"),
        );
      } else if (paymentMethod === "VNPAY_QR") {
        if (data?.qrData) {
          setInitialQrData(data.qrData);
        }
        setIsPayModalOpen(true);
      } else {
        setBookingSuccess(true);
        setNotice(
          t("requestSent"),
        );
      }
    } catch (error) {
      const errRes = error.response?.data;
      if (errRes?.insufficient) {
        setNotice(
          t("insufficientWalletApi", { current: formatCurrency(errRes.currentBalance || walletBalance), required: formatCurrency(estimatedPrice) })
        );
      } else {
        setNotice(
          errRes?.message ||
            t("submitFailure"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="container-page py-12">{t("loading")}</div>
    );
  if (!buddy) {
    return (
      <div className="container-page py-12">
        <p className="panel p-8 text-center">
          {notice || t("profileNotFound")}
        </p>
        <Link to="/" className="btn-primary mt-4">
          {t("backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft size={14} /> {t("buddyList")}
      </Link>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_350px]">
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="relative">
              <img
                src={buddy.coverImage}
                alt={buddy.fullName}
                className="h-[250px] w-full object-cover sm:h-[340px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4 text-white">
                <div>
                  <span className="pill">
                    <ShieldCheck size={12} className="mr-1 inline" /> {t("verified")}
                  </span>
                  <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                    {buddy.fullName}
                  </h1>
                  <p className="mt-1 flex items-center gap-1 text-xs text-blue-50">
                    <MapPin size={13} />
                    {buddy.area}
                  </p>
                </div>
                <span className="ml-auto hidden rounded-xl bg-white/20 p-3 text-sm font-black backdrop-blur sm:block">
                  <Star
                    size={14}
                    className="mr-1 inline fill-amber-300 text-amber-300"
                  />
                  {Number(buddy.rating || 0).toFixed(1)}/5
                </span>
              </div>
            </div>
            <div className="flex justify-end bg-white p-4">
              <button
                ref={bookingButtonRef}
                type="button"
                className="btn-primary"
                aria-haspopup="dialog"
                onClick={() => setBookingFormOpen(true)}
              >
                {t("bookNow")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
              {(buddy.interests?.length
                ? buddy.interests
                : buddy.categories || []
              ).map((item) => (
                <span
                  className="rounded-full bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="p-5 sm:p-7">
              <p className="eyebrow">{t("introduction")}</p>
              <h2 className="mt-2 text-xl font-extrabold">
                {t("discoverDaNang")}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {buddy.bio || t("bioFallbackDetail")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-blue-50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <Languages size={16} className="text-brand" />
                    {t("communicationLanguages")}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(buddy.languages || ["Tiếng Việt"]).map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-white px-2 py-1.5 text-xs"
                      >
                        {!buddy.languages && item === "Tiếng Việt" ? t("vietnamese") : item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    {t("packageInfo")}
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-600">
                    <li>✓ {t("includedDuration")}</li>
                    <li>✓ {t("adjustedItinerary")}</li>
                    <li>✓ {t("manualConfirmation")}</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-extrabold">{t("sharedPhotos")}</h3>
                {buddy.photos?.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {buddy.photos.map((photo, index) => (
                      <a
                        key={`${photo}-${index}`}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("openPhoto", { index: index + 1, name: buddy.fullName })}
                        className="relative grid aspect-square overflow-hidden rounded-xl bg-slate-100"
                      >
                        <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-slate-500">
                          {t("photoUnavailable")}
                        </span>
                        <img
                          src={photo}
                          alt={t("photoAlt", { index: index + 1, name: buddy.fullName })}
                          className="relative h-full w-full object-cover"
                          loading="lazy"
                          onError={(event) => { event.currentTarget.hidden = true; }}
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">{t("noSharedPhotos")}</p>
                )}
              </div>
              <section className="mt-6 rounded-xl bg-blue-50 p-4" aria-labelledby="local-availability-title">
                <h3 id="local-availability-title" className="flex items-center gap-2 text-sm font-extrabold text-navy">
                  <Clock size={16} className="text-brand" />
                  {t("localAvailability")}
                </h3>
                {availableSlots.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <li key={`${slot.date}-${slot.startTime}-${slot.endTime}`} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-navy">
                        {slot.date} · {slot.startTime} – {slot.endTime}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">{t("noAvailability")}</p>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-500">{t("availabilityBackendCheck")}</p>
              </section>
            </div>
          </section>
          <section className="panel p-5 sm:p-7">
            <h2 className="font-extrabold">
              {t("experiencePackage")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("packageDescription")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-extrabold text-emerald-800">
                  {t("included")}
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>• {t("buddyCompanion")}</li>
                  <li>• {t("itinerarySuggestion")}</li>
                  <li>• {t("localExplorationSupport")}</li>
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-extrabold text-amber-800">
                  {t("notIncluded")}
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>• {t("foodDrinksTickets")}</li>
                  <li>• {t("transportAndExtras")}</li>
                </ul>
                <p className="mt-2 text-xs font-bold leading-5 text-amber-900">
                  {t("travelerPaysExtras")}
                </p>
              </div>
            </div>
          </section>
        </div>
        <aside className="panel p-5 lg:sticky lg:top-[88px]">
          <p className="eyebrow">{t("companionRate")}</p>
          <p className="mt-1 text-3xl font-black text-brand">
            {formatCurrency(Number(
              buddy.pricePerHour ?? Math.round(Number(buddy.price || 0) / 3),
            ))} <span className="text-xs font-medium text-slate-500">{t("perHour")}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {t("priceExcludes")}
          </p>
          {bookingFormOpen && !isPayModalOpen && !isTopUpOpen && (
            <dialog
              ref={bookingDialogRef}
              id="booking-form"
              aria-labelledby="booking-form-title"
              className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-navy shadow-2xl backdrop:bg-navy/60 sm:p-6"
              onCancel={(event) => {
                event.preventDefault();
                closeBookingForm();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeBookingForm();
                }
              }}
            >
          <div className="flex items-center justify-between gap-3">
          <h2 id="booking-form-title" ref={bookingHeadingRef} tabIndex={-1} className="text-xl font-bold text-navy">
            {t("bookingInformation")}
          </h2>
          <button type="button" className="btn-light" disabled={submitting} onClick={closeBookingForm}>
            {t("closeBooking")}
          </button>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-600">{buddy.fullName}</p>
          {notice && (
            <div role="status" className={`mt-3 rounded-lg p-3 text-xs leading-5 ${
              bookingSuccess ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-blue-50 text-brand"
            }`}>
              <p>{notice}</p>
              {bookingSuccess && <Link to="/dashboard" className="mt-2 inline-flex font-bold underline">{t("viewRequestDashboard")}</Link>}
            </div>
          )}
          <label className="text-xs font-bold">
            {t("experienceDate")}
            <input
              className="field mt-2"
              type="date"
              min={new Date().toLocaleDateString("en-CA")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-xs font-bold">
            {t("experienceDuration")}
            <select
              className="field mt-2"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 8, 12].map((hours) => (
                <option key={hours} value={hours}>
                  {t("durationHours", { count: hours })}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-xs font-bold">
            {t("fromHour")}
            <select
              className="field mt-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            >
              {Array.from({ length: 24 }, (_, hour) => hour)
                .filter((hour) => hour + durationHours <= 24)
                .map((hour) => {
                  const value = `${String(hour).padStart(2, "0")}:00`;
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  );
                })}
            </select>
          </label>

          <label className="mt-4 block text-xs font-bold">
            {t("toHour")}
            <div className="field mt-2 flex items-center">
              {endTime || t("invalid")}
            </div>
            <p className="mt-1 text-xs font-normal text-slate-500">
              {t("autoCalculatedTime")}
            </p>
          </label>

          <label className="mt-4 block text-xs font-bold">
            <Users size={13} className="mr-1 inline" />
            {t("guestCountLabel")}
            <select
              className="field mt-2"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {t("guestCount", { count: n })}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            {t("languageLabel")}
            <select
              className="field mt-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {(buddy.languages?.length ? buddy.languages : ["Tiếng Việt"]).map(
                (item) => (
                  <option key={item} value={item}>
                    {!buddy.languages?.length && item === "Tiếng Việt" ? t("vietnamese") : item}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            <Utensils size={13} className="mr-1 inline" />
            {t("foodBudgetLabel")}
            <select
              className="field mt-2"
              value={foodBudget}
              onChange={(e) => setFoodBudget(e.target.value)}
            >
              <option value="0">{t("unspecified")}</option>
              <option value="100000">{formatCurrency(100000)}</option>
              <option value="150000">{formatCurrency(150000)}</option>
              <option value="250000">{formatCurrency(250000)}</option>
              <option value="350000">{formatCurrency(350000)}</option>
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            {t("extraBudgetLabel")}
            <input
              className="field mt-2"
              type="number"
              min="0"
              step="10000"
              value={experienceBudget}
              onChange={(e) => setExperienceBudget(e.target.value)}
              placeholder={t("amountExamplePlaceholder")}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {t("extraBudgetNote")}
            </span>
          </label>
          <label className="mt-4 block text-xs font-bold">
            {t("messageLabel")}
            <textarea
              className="field mt-2 min-h-20"
              maxLength={1000}
              placeholder={t("messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {/* Tổng phí và Lựa chọn phương thức thanh toán */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t("durationSummary", { count: durationHours })}</span>
              <span className="font-semibold text-slate-700">
                {durationHours} × {formatCurrency(Number(buddy.pricePerHour ?? Math.round(Number(buddy.price || 0) / 3)))}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-xs font-bold text-navy">{t("totalServiceCost")}</span>
              <span className="text-base font-black text-brand">
                {formatCurrency(estimatedPrice)}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {t("travelerPaysSeparate")}
            </p>

            <p className="mt-4 text-xs font-bold text-slate-800">
              {t("choosePaymentMethod")}
            </p>

            <div className="mt-2 space-y-2">
              {/* Ví Local Buddy */}
              <label
                onClick={() => setPaymentMethod("Wallet")}
                className={`flex cursor-pointer items-start justify-between rounded-xl border p-3 transition-all ${
                  paymentMethod === "Wallet"
                    ? "border-brand bg-blue-50/60 shadow-xs ring-2 ring-brand/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shrink-0 mt-0.5">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-navy block">{t("buddyWallet")}</span>
                    <span className="text-[11px] text-slate-500">
                      {t("balance")}{" "}
                      <b className={isBalanceEnough ? "text-emerald-600" : "text-amber-600"}>
                        {formatCurrency(walletBalance)}
                      </b>
                    </span>
                    {!isBalanceEnough && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          {t("shortfall", { amount: formatCurrency(estimatedPrice - walletBalance) })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTopUpOpen(true);
                          }}
                          className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                        >
                          {t("topUpNow")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="radio"
                  name="detailPaymentMethod"
                  checked={paymentMethod === "Wallet"}
                  onChange={() => setPaymentMethod("Wallet")}
                  className="mt-1 h-3.5 w-3.5 text-brand"
                />
              </label>

              {/* VNPAY-QR */}
              <label
                onClick={() => setPaymentMethod("VNPAY_QR")}
                className={`flex cursor-pointer items-start justify-between rounded-xl border p-3 transition-all ${
                  paymentMethod === "VNPAY_QR"
                    ? "border-[#005baa] bg-blue-50/60 shadow-xs ring-2 ring-[#005baa]/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#005baa] text-white shrink-0 mt-0.5">
                    <QrCode size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-navy block">{t("scanVnpay")}</span>
                    <span className="text-[11px] text-slate-500">
                      {t("scanWithApps")}
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="detailPaymentMethod"
                  checked={paymentMethod === "VNPAY_QR"}
                  onChange={() => setPaymentMethod("VNPAY_QR")}
                  className="mt-1 h-3.5 w-3.5 text-brand"
                />
              </label>

              {/* Thanh toán sau */}
              <label
                onClick={() => setPaymentMethod("None")}
                className={`flex cursor-pointer items-start justify-between rounded-xl border p-3 transition-all ${
                  paymentMethod === "None"
                    ? "border-slate-500 bg-slate-100 shadow-xs ring-2 ring-slate-400/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-600 text-white shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-navy block">{t("payLater")}</span>
                    <span className="text-[11px] text-slate-500">
                      {t("reservePayLater")}
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="detailPaymentMethod"
                  checked={paymentMethod === "None"}
                  onChange={() => setPaymentMethod("None")}
                  className="mt-1 h-3.5 w-3.5 text-brand"
                />
              </label>
            </div>
          </div>

          <button
            disabled={submitting}
            className={`mt-4 w-full flex items-center justify-center gap-2 cursor-pointer font-bold ${
              paymentMethod === "VNPAY_QR"
                ? "rounded-xl bg-gradient-to-r from-[#005baa] to-emerald-600 px-4 py-3 text-sm text-white shadow-md shadow-blue-900/15 hover:opacity-95"
                : "btn-primary"
            }`}
            onClick={book}
          >
            {paymentMethod === "Wallet" && <Wallet size={16} />}
            {paymentMethod === "VNPAY_QR" && <QrCode size={16} />}
            {paymentMethod === "None" && <CalendarDays size={16} />}
            {submitting
              ? t("processing")
              : paymentMethod === "Wallet"
                ? t("payWithWalletBook")
                : paymentMethod === "VNPAY_QR"
                  ? t("payWithQrBook")
                  : t("sendRequestPayLater")}
          </button>
            </dialog>
          )}

          {/* Nút Chat trực tiếp */}
          {(() => {
            const isLoggedIn = !!localStorage.getItem("lb_token");
            const currentUser = getCurrentUser();
            const currentBuddyUserId = buddy?.user || buddy?._id;

            if (!isLoggedIn) {
              const redirectUrl = encodeURIComponent(`/buddy/${id}?openChat=true`);
              return (
                <div className="mt-2">
                  <Link
                    to={`/login?redirect=${redirectUrl}`}
                    className="btn-green w-full text-center flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={15} /> {t("chatLoginButton")}
                  </Link>
                  <p className="mt-1 text-[11px] text-center text-slate-500">
                    {t("chatLoginNote")}
                  </p>
                </div>
              );
            }

            if (currentUser?._id === currentBuddyUserId) {
              return (
                <div className="mt-2 rounded-xl bg-slate-100 p-2.5 text-center text-xs text-slate-600 font-medium">
                  {t("ownProfile")}
                </div>
              );
            }

            if (currentUser?.role !== "traveler") {
              return (
                <div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-center text-xs text-amber-700 font-medium">
                  {t("chatTravelerOnly")}
                </div>
              );
            }

            return (
              <button
                type="button"
                className="btn-green mt-2 w-full flex items-center justify-center gap-2"
                onClick={() => {
                  const localUser = {
                    _id: buddy.user || buddy._id,
                    fullName: buddy.fullName,
                    avatar: buddy.coverImage || buddy.avatar || "",
                    role: "local",
                  };
                  window.dispatchEvent(
                    new CustomEvent("lb-open-chat", {
                      detail: { otherUser: localUser },
                    })
                  );
                }}
              >
                <MessageCircle size={15} /> {t("chatDirectWith", { name: buddy?.fullName || "Local" })}
              </button>
            );
          })()}

          {notice && (
            <div
              className={`mt-3 rounded-lg p-3 text-xs leading-5 ${
                bookingSuccess
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-blue-50 text-brand"
              }`}
            >
              <p>{notice}</p>
              {bookingSuccess && (
                <Link
                  to="/dashboard"
                  className="mt-2 inline-flex items-center gap-1 font-bold text-emerald-700 underline"
                >
                  {t("viewRequestDashboard")}
                </Link>
              )}
            </div>
          )}

          <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <ShieldCheck size={15} className="mr-1 inline" /> 
            {t("protectedPayment")}
          </div>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <Clock size={13} />
            {t("responseTime")}
          </p>
        </aside>
      </div>

      {/* Modal thanh toán VNPAY-QR / Ví */}
      <BookingPaymentModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        booking={createdBooking}
        initialQrData={initialQrData}
        onSuccess={(updated) => {
          setCreatedBooking(updated);
          setBookingSuccess(true);
          setNotice(t("vnpaySuccess"));
          setIsPayModalOpen(false);
        }}
        onOpenTopUp={() => {
          setIsPayModalOpen(false);
          setIsTopUpOpen(true);
        }}
      />

      {/* Modal Nạp tiền vào Ví Local Buddy */}
      <WalletTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        currentBalance={walletBalance}
        onSuccess={(newBal) => {
          setWalletBalance(newBal);
          try {
            const raw = localStorage.getItem("lb_user");
            if (raw) {
              const u = JSON.parse(raw);
              u.walletBalance = newBal;
              localStorage.setItem("lb_user", JSON.stringify(u));
              window.dispatchEvent(new Event("lb-auth-change"));
            }
          } catch {}
        }}
      />
    </div>
  );
}
