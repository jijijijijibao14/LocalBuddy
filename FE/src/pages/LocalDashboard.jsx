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
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { mediaUrl } from "../services/api";
import ConversationList from "../components/ConversationList";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";
import { paginate } from "../utils/pagination";
import Pagination from "../components/Pagination";
import BookingDetailsModal from "../components/BookingDetailsModal";
import TripFeedback from "../components/TripFeedback";

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
  const { t } = useTranslation("localDashboard");
  const { formatCurrency } = useLocale();
  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityDirty, setAvailabilityDirty] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [cancellationPage, setCancellationPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("Pending");
  const [bookingPage, setBookingPage] = useState(1);
  const [profileScore, setProfileScore] = useState(0);
  const [date, setDate] = useState(todayString());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentLocalUser, setCurrentLocalUser] = useState(getStoredUser);
  const [cancellationBooking, setCancellationBooking] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [bookingActionLoading, setBookingActionLoading] = useState(false);

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
      localStorage.setItem(
        "lb_user",
        JSON.stringify({ ...getStoredUser(), ...user }),
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message || t("errors.load"),
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
          error.response?.data?.message || t("errors.refreshAvailability"),
        );
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [availabilityDirty, t]);

  function addAvailability() {
    setMessage("");

    if (!date || endTime <= startTime) {
      setMessage(t("errors.invalidSlot"));
      return;
    }

    if (
      new Date(`${date}T${startTime}:00+07:00`).getTime() <= Date.now()
    ) {
      setMessage(t("errors.pastSlot"));
      return;
    }

    const overlap = availability.some(
      (slot) =>
        slot.date === date &&
        startTime < slot.endTime &&
        endTime > slot.startTime,
    );

    if (overlap) {
      setMessage(t("errors.overlap"));
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
      setMessage(t("messages.saved"));
    } catch (error) {
      setMessage(error.response?.data?.message || t("errors.save"));
    } finally {
      setLoading(false);
    }
  }

  async function updateBooking(id, status, reason) {
    setMessage("");
    setBookingActionLoading(true);

    try {
      const { data } = await api.patch(`/bookings/${id}/local-status`, { status, reason });
      window.dispatchEvent(new Event("lb-bookings-change"));
      await loadData();
      setMessage(
        status === "Confirmed"
          ? t("messages.confirmed")
          : data.message || t("messages.rejected"),
      );
      setCancellationBooking(null);
      setCancellationReason("");
      return true;
    } catch (error) {
      setMessage(
        error.response?.data?.message || t("errors.updateBooking"),
      );
      return false;
    } finally {
      setBookingActionLoading(false);
    }
  }

  function openCancellation(booking) {
    setCancellationBooking(booking);
    setCancellationReason("");
    setSelectedBooking(null);
  }

  const bookingStatusTabs = [
    { status: "Pending", label: t("tabs.pending") },
    { status: "Confirmed", label: t("tabs.confirmed") },
    { status: "Completed", label: t("tabs.completed") },
    { status: "Cancelled", label: t("tabs.cancelled") },
  ];
  const filteredBookings = bookings.filter(
    (booking) => booking.status === bookingStatusFilter,
  );
  const bookingResult = paginate(filteredBookings, bookingPage, 3);
  const cancellationRequests = bookings.filter(
    (booking) => booking.status === "Cancelled",
  );
  const cancellationResult = paginate(cancellationRequests, cancellationPage, 3);

  return (
    <div className="container-page space-y-6 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-[#e2f4ff] via-white to-[#e7fff5] p-6 sm:p-9">
        <span className="pill">
          <MapPin size={13} /> {t("hero.eyebrow")}
        </span>
        <h1 className="mt-4 text-3xl font-black text-navy">{t("hero.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {t("hero.subtitle")}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">
            <Compass size={15} /> {t("hero.home")}
          </Link>
          <Link to="/profile" className="btn-light">
            {t("hero.myProfile")}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: t("stats.profileScore"),
            value: `${profileScore}%`,
            sub: t("stats.profileScoreSub"),
            icon: UserRound,
          },
          {
            label: t("stats.rating"),
            value:
              profile?.rating == null
                ? t("stats.noRating")
                : `${Number(profile.rating).toFixed(1)}/5`,
            sub: t("stats.ratingSub"),
            icon: Star,
          },
          {
            label: t("stats.bookings"),
            value: String(bookings.length),
            sub: t("stats.bookingsSub"),
            icon: CalendarDays,
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

      <section className="panel p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-brand" size={25} />
          <div>
            <h2 className="text-xl font-black text-navy">{t("availability.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("availability.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-bold">
            {t("availability.date")}
            <input
              type="date"
              className="field mt-2"
              min={todayString()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            {t("availability.from")}
            <input
              type="time"
              className="field mt-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            {t("availability.to")}
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
            <CalendarDays size={16} /> {t("availability.add")}
          </button>
          <button
            className="btn-primary"
            onClick={saveAvailability}
            disabled={loading}
          >
            <Save size={16} />
            {loading ? t("availability.saving") : t("availability.save")}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {availability.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {t("availability.empty")}
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
                {t("availability.delete")}
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
              {t("requests.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("requests.subtitle")}
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap gap-2"
          role="tablist"
          aria-label={t("requests.filterLabel")}
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
                onClick={() => {
                  setBookingStatusFilter(tab.status);
                  setBookingPage(1);
                }}
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
                ? t("requests.emptyPending")
                : bookingStatusFilter === "Confirmed"
                  ? t("requests.emptyConfirmed")
                  : bookingStatusFilter === "Completed"
                    ? t("requests.emptyCompleted")
                    : t("requests.emptyCancelled")}
            </p>
          )}

          {bookingResult.items.map((booking) => (
            <button
              key={booking._id}
              type="button"
              onClick={() => setSelectedBooking(booking)}
              className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-brand/40 hover:bg-slate-50"
            >
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-extrabold text-navy">
                    {booking.customer?.fullName || "Traveler"}
                  </span>
                  <span className="text-sm text-slate-500">
                    {t("requests.date", { date: booking.date?.slice(0, 10) })}
                  </span>
                  <span className="pill">
                    {booking.status === "Cancelled"
                      ? t("status.cancelled")
                      : booking.status === "Pending"
                        ? t("status.pending")
                        : booking.status === "Confirmed"
                          ? t("status.confirmed")
                          : t("tabs.completed")}
                  </span>
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  {booking.customer?.email || ""} · {booking.time}
                </span>
                {booking.status === "Cancelled" &&
                  booking.paymentStatus === "Paid" &&
                  booking.escrowStatus === "Released" && (
                    <span className="mt-3 block rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                      {t("refund.noRefundPayout")}
                    </span>
                  )}
            </button>
          ))}
        </div>
        {filteredBookings.length > 3 && (
          <Pagination
            result={bookingResult}
            onChange={setBookingPage}
            previousLabel={t("requests.pagination.previous")}
            nextLabel={t("requests.pagination.next")}
            pageLabel={t("requests.pagination.page", { page: bookingResult.page, total: bookingResult.pageCount })}
          />
        )}
      </section>
      <section className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-navy">
              {t("cancellationRequests.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("cancellationRequests.subtitle")}
            </p>
          </div>
          <span className="pill">{cancellationRequests.length}</span>
        </div>

        {cancellationRequests.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {t("cancellationRequests.empty")}
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {cancellationResult.items.map((booking) => {
              const refundRequest =
                typeof booking.refundRequestId === "object"
                  ? booking.refundRequestId
                  : null;
              const requesterRole = refundRequest?.requestedByRole;

              return (
                <article
                  key={booking._id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-navy">
                        {booking.customer?.fullName || "Traveler"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("cancellationRequests.date", {
                          date: booking.date?.slice(0, 10) || "",
                        })}
                        {booking.time ? ` · ${booking.time}` : ""}
                      </p>
                    </div>
                    <span className="pill">
                      {refundRequest
                        ? t(
                            `cancellationRequests.status${refundRequest.status}`,
                            refundRequest.status,
                          )
                        : t("cancellationRequests.noRefund")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    {t("cancellationRequests.requestedBy")}:{" "}
                    {requesterRole
                      ? t(`cancellationRequests.roles.${requesterRole}`)
                      : t("cancellationRequests.roles.unknown")}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-bold">
                      {t("cancellationRequests.reason")}:
                    </span>{" "}
                    {refundRequest?.reason ||
                      booking.cancellationReason ||
                      t("cancellationRequests.noReason")}
                  </p>
                  {refundRequest && (
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      {t("cancellationRequests.refundAmount")}:{" "}
                      {formatCurrency(refundRequest.amount)} (
                      {refundRequest.percentage}%)
                    </p>
                  )}
                  {refundRequest?.providerRefundId && (
                    <p className="mt-2 break-all text-xs text-slate-500">
                      {t("cancellationRequests.providerRefundId")}:{" "}
                      {refundRequest.providerRefundId}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {cancellationRequests.length > 3 && (
          <Pagination
            result={cancellationResult}
            onChange={setCancellationPage}
            previousLabel={t("requests.pagination.previous")}
            nextLabel={t("requests.pagination.next")}
            pageLabel={t("requests.pagination.page", {
              page: cancellationResult.page,
              total: cancellationResult.pageCount,
            })}
            showPageNumbers
          />
        )}
      </section>
      {selectedBooking && (
        <BookingDetailsModal
          title={t("requests.details")}
          closeLabel={t("requests.close")}
          onClose={() => setSelectedBooking(null)}
          fields={[
            { label: t("requests.customer"), value: selectedBooking.customer?.fullName || "Traveler" },
            { label: t("requests.statusLabel"), value: selectedBooking.status === "Cancelled"
              ? t("status.cancelled")
              : selectedBooking.status === "Pending"
                ? t("status.pending")
                : selectedBooking.status === "Confirmed"
                  ? t("status.confirmed")
                  : t("tabs.completed") },
            { label: t("requests.email"), value: selectedBooking.customer?.email },
            { label: t("requests.dateLabel"), value: selectedBooking.date?.slice(0, 10) },
            { label: t("requests.timeLabel"), value: t("requests.time", {
              start: selectedBooking.startTime,
              end: selectedBooking.endTime,
              count: Number(selectedBooking.durationHours) || 0,
            }) },
            { label: t("requests.guestsLabel"), value: t("requests.guests", { count: selectedBooking.guestCount || 1 }) },
            { label: t("requests.language"), value: selectedBooking.language || t("requests.defaultLanguage") },
            { label: t("requests.foodBudgetLabel"), value: formatCurrency(selectedBooking.foodBudget || 0) },
            { label: t("requests.extraBudgetLabel"), value: formatCurrency(selectedBooking.experienceBudget || 0) },
            { label: t("requests.meetingAddressLabel"), value: selectedBooking.meetingAddress, fullWidth: true },
            { label: t("requests.messageLabel"), value: selectedBooking.message, fullWidth: true },
            { label: t("requests.serviceLabel"), value: formatCurrency(selectedBooking.price || 0) },
            { label: t("requests.paymentLabel"), value: selectedBooking.paymentStatus },
          ]}
        >
          {selectedBooking.status === "Completed" && (
            <TripFeedback
              booking={selectedBooking}
              viewerRole="local"
              onUpdated={(updated) => {
                setSelectedBooking(updated);
                setBookings((current) => current.map((item) => item._id === updated._id ? updated : item));
              }}
            />
          )}
          {selectedBooking.status === "Pending" && (
            <>
              <button type="button" className="btn-primary" onClick={async () => {
                if (await updateBooking(selectedBooking._id, "Confirmed")) setSelectedBooking(null);
              }}>
                <CheckCircle2 size={16} /> {t("actions.confirm")}
              </button>
              <button type="button" className="btn-light" onClick={async () => {
                openCancellation(selectedBooking);
              }}>
                <XCircle size={16} /> {t("actions.reject")}
              </button>
            </>
          )}
          {selectedBooking.status === "Confirmed" && (
            <button
              type="button"
              className="btn-light"
              onClick={() => openCancellation(selectedBooking)}
            >
              <XCircle size={16} /> {t("actions.cancel")}
            </button>
          )}
          {selectedBooking.customer?._id && (
            <button type="button" className="btn-light" onClick={() => {
              const customer = selectedBooking.customer;
              setSelectedBooking(null);
              window.dispatchEvent(new CustomEvent("lb-open-chat", {
                detail: { otherUser: {
                  _id: customer._id,
                  fullName: customer.fullName,
                  avatar: customer.avatar,
                  role: "traveler",
                } },
              }));
            }}>
              {t("actions.messageTraveler")}
            </button>
          )}
        </BookingDetailsModal>
      )}

      {cancellationBooking && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-navy/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-cancellation-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="border-b border-slate-100 px-6 py-5">
              <span className="pill"><CalendarDays size={12} /> {t("cancellation.eyebrow")}</span>
              <h2 id="local-cancellation-title" className="mt-3 text-xl font-black text-navy">
                {t("cancellation.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("cancellation.bookingDetails", {
                  name: cancellationBooking.customer?.fullName || "Traveler",
                  start: cancellationBooking.startTime,
                  end: cancellationBooking.endTime,
                })}
              </p>
            </header>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-extrabold text-emerald-800">
                  {cancellationBooking.paymentStatus === "Paid"
                    ? t("cancellation.refundTitle")
                    : t("cancellation.unpaidTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  {cancellationBooking.paymentStatus === "Paid"
                    ? t("cancellation.refundDescription")
                    : t("cancellation.unpaidDescription")}
                </p>
                {cancellationBooking.paymentStatus === "Paid" && (
                  <p className="mt-2 text-sm font-black text-navy">
                    {t("cancellation.refundAmount", {
                      amount: formatCurrency(cancellationBooking.price || 0),
                    })}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="local-cancellation-reason" className="block text-xs font-extrabold text-slate-700">
                  {t("cancellation.reasonLabel")}
                </label>
                <textarea
                  id="local-cancellation-reason"
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  autoFocus
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
                  placeholder={t("cancellation.reasonPlaceholder")}
                />
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-light justify-center"
                disabled={bookingActionLoading}
                onClick={() => setCancellationBooking(null)}
              >
                {t("cancellation.close")}
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={bookingActionLoading || cancellationReason.trim().length < 3}
                onClick={() => updateBooking(
                  cancellationBooking._id,
                  "Cancelled",
                  cancellationReason,
                )}
              >
                {bookingActionLoading
                  ? t("cancellation.submitting")
                  : t("cancellation.submit")}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* {profile && (
        <section className="panel flex flex-wrap items-center gap-4 p-5">
          <img
            src={mediaUrl(profile.coverImage)}
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
      )} */}

      {message && (
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-brand">
          {message}
        </p>
      )}

      {/* Danh sách tin nhắn trực tiếp */}
      <div className="mt-5">
        <ConversationList currentUser={currentLocalUser} />
      </div>

    </div>
  );
}
