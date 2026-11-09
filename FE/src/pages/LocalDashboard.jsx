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
import api from "../services/api";
import ConversationList from "../components/ConversationList";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

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
  const [bookingStatusFilter, setBookingStatusFilter] = useState("Pending");
  const [profileScore, setProfileScore] = useState(0);
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

  async function updateBooking(id, status) {
    setMessage("");

    try {
      await api.patch(`/bookings/${id}/local-status`, { status });
      window.dispatchEvent(new Event("lb-bookings-change"));
      setMessage(
        status === "Confirmed"
          ? t("messages.confirmed")
          : t("messages.rejected"),
      );

      await loadData();
    } catch (error) {
      setMessage(
        error.response?.data?.message || t("errors.updateBooking"),
      );
    }
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                ? t("requests.emptyPending")
                : bookingStatusFilter === "Confirmed"
                  ? t("requests.emptyConfirmed")
                  : bookingStatusFilter === "Completed"
                    ? t("requests.emptyCompleted")
                    : t("requests.emptyCancelled")}
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
                    {t("requests.date", { date: booking.date?.slice(0, 10) })}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("requests.time", {
                      start: booking.startTime,
                      end: booking.endTime,
                      count: Number(booking.durationHours) || 0,
                    })}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("requests.guests", { count: booking.guestCount || 1 })}
                  </p>

                  <p className="mt-1 text-sm">
                    {t("requests.language", {
                      language: booking.language || t("requests.defaultLanguage"),
                    })}
                  </p>

                  <p className="mt-1 text-sm">
                    {t("requests.foodBudget", {
                      amount: formatCurrency(booking.foodBudget || 0),
                    })}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("requests.extraBudget", {
                      amount: formatCurrency(booking.experienceBudget || 0),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("requests.extraNote")}
                  </p>
                  {booking.message && (
                    <p className="mt-2 text-sm text-slate-600">
                      {t("requests.message", { message: booking.message })}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-bold text-brand">
                    {formatCurrency(booking.price || 0)}
                  </p>
                </div>
                <span className="pill">
                  {booking.status === "Cancelled"
                    ? t("status.rejected")
                    : booking.status === "Pending"
                      ? t("status.pending")
                      : booking.status === "Confirmed"
                        ? t("status.confirmed")
                        : booking.status}
                </span>
              </div>

              {booking.status === "Pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => updateBooking(booking._id, "Confirmed")}
                  >
                    <CheckCircle2 size={16} /> {t("actions.confirm")}
                  </button>
                  <button
                    className="btn-light"
                    onClick={() => updateBooking(booking._id, "Cancelled")}
                  >
                    <XCircle size={16} /> {t("actions.reject")}
                  </button>
                </div>
              )}
              {booking.status === "Confirmed" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => updateBooking(booking._id, "Completed")}
                  >
                    <CheckCircle2 size={16} /> {t("actions.complete")}
                  </button>
                </div>
              )}
              {booking.customer?._id && (
                <button
                  className="btn-light mt-3"
                  onClick={() => window.dispatchEvent(new CustomEvent("lb-open-chat", {
                    detail: { otherUser: {
                      _id: booking.customer._id,
                      fullName: booking.customer.fullName,
                      avatar: booking.customer.avatar,
                      role: "traveler",
                    } },
                  }))}
                >
                  {t("actions.messageTraveler")}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* {profile && (
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
