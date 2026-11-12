import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  ChartNoAxesCombined,
  MessageCircle,
} from "lucide-react";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";
import { filterAccounts, paginate } from "../utils/adminPagination";
import Pagination from "../components/Pagination";
import BookingDetailsModal from "../components/BookingDetailsModal";

function AdminPagination({ result, onChange, t, showPageNumbers = false }) {
  return (
    <Pagination result={result} onChange={onChange}
      previousLabel={t("pagination.previous")} nextLabel={t("pagination.next")}
      pageLabel={t("pagination.page", { page: result.page, total: result.pageCount })}
      showPageNumbers={showPageNumbers} />
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation("adminDashboard");
  const { formatCurrency, language, languages } = useLocale();
  const locale = languages.find((l) => l.code === language)?.locale || "vi-VN";
  const [stats, setStats] = useState({
    users: 0,
    buddies: 0,
    bookings: 0,
    transactions: 0,
  });
  const [users, setUsers] = useState([]);
  const [buddies, setBuddies] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [refundPage, setRefundPage] = useState(1);
  const [cancellationPolicy, setCancellationPolicy] = useState({
    overSixHoursPercent: 100,
    threeToSixHoursPercent: 75,
    oneToThreeHoursPercent: 50,
    underOneHourPercent: 25,
  });
  const [accountRoleTab, setAccountRoleTab] = useState("local");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [accountPage, setAccountPage] = useState(1);
  const [buddyPage, setBuddyPage] = useState(1);
  const [bookingStatusTab, setBookingStatusTab] = useState("Pending");
  const [bookingPage, setBookingPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [message, setMessage] = useState("");
  const [refundAction, setRefundAction] = useState(null);
  const [refundNote, setRefundNote] = useState("");
  const [providerRefundId, setProviderRefundId] = useState("");
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const accountsResult = paginate(filterAccounts(users, accountRoleTab, accountQuery, accountStatus), accountPage);
  const buddiesResult = paginate(buddies, buddyPage);
  const filteredBookings = bookings.filter((booking) => bookingStatusTab === "Pending"
    ? ["Pending", "Confirmed"].includes(booking.status)
    : booking.status === bookingStatusTab);
  const bookingResult = paginate(filteredBookings, bookingPage, 3);
  const refundResult = paginate(refunds, refundPage, 3);
  async function load() {
    try {
      const [s, u, bp, b, r, policy] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/buddies"),
        api.get("/admin/bookings"),
        api.get("/admin/refunds"),
        api.get("/admin/settings/cancellation-policy"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setBuddies(bp.data);
      setBookings(b.data);
      setRefunds(r.data);
      setCancellationPolicy(policy.data.cancellationPolicy);
      setMessage("");
    } catch (e) {
      setMessage(
        e.response?.data?.message || t("errors.load"),
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function changeStatus(id, status) {
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, status } : u)),
      );
    } catch (e) {
      setMessage(e.response?.data?.message || t("errors.status"));
    }
  }
  async function changePremium(user, isPremium) {
    try {
      const { data } = await api.patch(`/admin/users/${user._id}/premium`, { isPremium });
      setUsers((prev) => prev.map((item) => item._id === user._id ? { ...item, isPremium: data.isPremium } : item));
    } catch (e) {
      setMessage(e.response?.data?.message || t("errors.tier"));
    }
  }
  async function changeBuddyVerification(id, verified) {
    try {
      await api.patch(`/admin/buddies/${id}/verification`, { verified });
      setBuddies((prev) =>
        prev.map((buddy) =>
          buddy._id === id ? { ...buddy, verified } : buddy,
        ),
      );
      setMessage(
        verified ? t("messages.verified") : t("messages.unverified"),
      );
    } catch (e) {
      setMessage(
        e.response?.data?.message || t("errors.verification"),
      );
    }
  }
  async function changeBooking(id, status) {
    try {
      await api.patch(`/admin/bookings/${id}`, { status });
      setBookings((prev) =>
        prev.map((b) => (b._id === id ? { ...b, status } : b)),
      );
    } catch (e) {
      setMessage(e.response?.data?.message || t("errors.booking"));
    }
  }
  function openRefundAction(refund, action) {
    setRefundAction({ refund, action });
    setRefundNote("");
    setProviderRefundId("");
    setMessage("");
  }
  async function submitRefundAction(event) {
    event.preventDefault();
    if (!refundAction || refundActionLoading) return;
    const { refund, action } = refundAction;
    if (action === "EXTERNAL" && (!providerRefundId.trim() || !refundNote.trim())) {
      setMessage("Vui lòng nhập mã giao dịch và ghi chú đối soát.");
      return;
    }

    setRefundActionLoading(true);
    try {
      const { data } = action === "EXTERNAL"
        ? await api.patch(`/admin/refunds/${refund._id}/confirm-external`, {
            providerRefundId: providerRefundId.trim(),
            note: refundNote.trim(),
          })
        : await api.patch(`/admin/refunds/${refund._id}/review`, {
            action,
            note: refundNote.trim(),
          });
      setRefunds((prev) => prev.map((item) => item._id === data._id
        ? {
            ...item,
            ...data,
            booking: item.booking,
            customer: item.customer,
            requestedBy: item.requestedBy,
          }
        : item));
      setMessage(data.status === "NO_REFUND"
        ? t("refunds.noRefundPayout")
        : action === "EXTERNAL"
          ? "Đã ghi nhận giao dịch hoàn PayOS."
          : action === "APPROVE"
            ? "Đã duyệt yêu cầu hoàn tiền."
            : "Đã từ chối yêu cầu hoàn tiền.");
      setRefundAction(null);
    } catch (e) {
      setMessage(e.response?.data?.message || "Không thể xử lý yêu cầu hoàn tiền.");
    } finally {
      setRefundActionLoading(false);
    }
  }
  async function saveCancellationPolicy() {
    try {
      const { data } = await api.patch("/admin/settings/cancellation-policy", { cancellationPolicy });
      setCancellationPolicy(data.cancellationPolicy);
      setMessage("Đã cập nhật chính sách hủy và hoàn tiền.");
    } catch (e) {
      setMessage(e.response?.data?.message || "Không thể lưu chính sách hủy.");
    }
  }
  return (
    <div className="container-page py-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="pill">
            <Activity size={12} /> {t("header.eyebrow")}
          </span>
          <h1 className="mt-3 text-2xl font-black text-navy sm:text-3xl">
            {t("header.title")}
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            {t("header.subtitle")}
          </p>
        </div>
        <button className="btn-primary" onClick={load}>
          <RefreshCw size={15} /> {t("header.refresh")}
        </button>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("stats.users"), value: stats.users, icon: Users },
          { label: t("stats.buddies"), value: stats.buddies, icon: ShieldCheck },
          {
            label: t("stats.bookings"),
            value: stats.bookings,
            icon: ClipboardList,
          },
          { label: t("stats.transactions"), value: stats.transactions, icon: Wallet },
        ].map((x) => (
          <div key={x.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {x.label}
              </span>
              <x.icon className="text-brand" size={19} />
            </div>
            <p className="mt-3 text-3xl font-black text-navy">
              {Number(x.value || 0).toLocaleString(locale)}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-700">
              <ChartNoAxesCombined size={12} /> {t("stats.current")}
            </p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-2xl bg-[#056b98] p-6 text-white sm:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-extrabold text-emerald-200">
              {t("banner.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {t("banner.title")}
            </h2>
            <p className="mt-2 text-xs leading-5 text-blue-100">
              {t("banner.subtitle")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [t("banner.verifyTitle"), t("banner.verifyDesc")],
              [t("banner.coordinateTitle"), t("banner.coordinateDesc")],
              [t("banner.protectTitle"), t("banner.protectDesc")],
            ].map((x) => (
              <div key={x[0]} className="rounded-xl bg-white/10 p-4">
                <CheckCircle2 size={18} className="text-emerald-200" />
                <p className="mt-3 font-bold">{x[0]}</p>
                <p className="mt-1 text-[11px] text-blue-100">{x[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">{t("accounts.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("accounts.subtitle")}
            </p>
          </div>
          <span className="pill">{t("accounts.count", { count: users.length })}</span>
        </div>
        <div className="flex gap-2 px-5 pb-4" role="tablist" aria-label={t("accounts.roleLabel")}>
          {[
            ["local", "Local"],
            ["traveler", "Traveler"],
          ].map(([role, label]) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={accountRoleTab === role}
              onClick={() => { setAccountRoleTab(role); setAccountPage(1); }}
              className={accountRoleTab === role ? "btn-primary" : "btn-light"}
            >
              {label} ({users.filter((user) => user.role === role).length})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <input className="field max-w-sm" type="search" value={accountQuery}
            aria-label={t("accounts.search")} placeholder={t("accounts.search")}
            onChange={(event) => { setAccountQuery(event.target.value); setAccountPage(1); }} />
          <select className="field max-w-xs" value={accountStatus}
            aria-label={t("accounts.filterStatus")}
            onChange={(event) => { setAccountStatus(event.target.value); setAccountPage(1); }}>
            <option value="">{t("accounts.allStatuses")}</option>
            {["Active", "Pending Approval", "Rejected", "Suspended"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">{t("accounts.colUser")}</th>
                <th className="p-4">{t("accounts.colRole")}</th>
                <th className="p-4">{t("accounts.colStatus")}</th>
                <th className="p-4">{t("accounts.colCreated")}</th>
                <th className="p-4">{t("accounts.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {accountsResult.items.map((u) => (
                <tr className="border-t border-slate-100" key={u._id}>
                  <td className="p-4">
                    <b>{u.fullName}</b>
                    <p className="mt-1 text-slate-500">{u.email}</p>
                  </td>
                  <td className="p-4">
                    {u.role === "local" ? (
                      <select
                        className="field !w-32 !py-2"
                        value={u.isPremium ? "premium" : "standard"}
                        onChange={(event) => changePremium(u, event.target.value === "premium")}
                      >
                        <option value="standard">Local</option>
                        <option value="premium">Premium (demo)</option>
                      </select>
                    ) : "Traveler"}
                  </td>
                  <td className="p-4">
                    <span className="pill">{u.status}</span>
                    {u.role === "local" && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        eKYC: {u.kycStatus || "Not Started"}
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                    <select
                      className="field !w-32 !py-2"
                      value={u.status}
                      onChange={(e) => changeStatus(u._id, e.target.value)}
                    >
                      {!["Active", "Suspended"].includes(u.status) && (
                        <option value={u.status} disabled>{u.status}</option>
                      )}
                      <option>Active</option>
                      <option>Suspended</option>
                    </select>
                    <button
                      className="btn-light !px-2 !py-2"
                      type="button"
                      title={t("accounts.chatWith", { name: u.fullName })}
                      onClick={() => window.dispatchEvent(new CustomEvent("lb-open-chat", {
                        detail: { otherUser: { _id: u._id, fullName: u.fullName, avatar: u.avatar, role: u.role } },
                      }))}
                    >
                      <MessageCircle size={14} />
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!accountsResult.items.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              {t("accounts.empty")}
            </p>
          )}
        </div>
        <AdminPagination result={accountsResult} onChange={setAccountPage} t={t} />
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">{t("buddies.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("buddies.subtitle")}
            </p>
          </div>
          <span className="pill">
            {t("buddies.verifiedCount", {
              verified: buddies.filter((item) => item.verified).length,
              total: buddies.length,
            })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Buddy</th>
                <th className="p-4">{t("buddies.colInterests")}</th>
                <th className="p-4">{t("buddies.colArea")}</th>
                <th className="p-4">{t("buddies.colKyc")}</th>
                <th className="p-4">{t("buddies.colVerification")}</th>
                <th className="p-4">{t("accounts.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {buddiesResult.items.map((buddy) => (
                <tr className="border-t border-slate-100" key={buddy._id}>
                  <td className="p-4">
                    <b>{buddy.fullName}</b>
                    <p className="mt-1 text-slate-500">
                      {buddy.user?.email || t("buddies.noEmail")}
                    </p>
                  </td>
                  <td className="p-4">
                    {(buddy.interests?.length
                      ? buddy.interests
                      : buddy.categories || []
                    ).join(", ") || t("buddies.noInterests")}
                  </td>
                  <td className="p-4">{buddy.area}</td>
                  <td className="p-4">{buddy.user?.kycStatus || "Not Started"}</td>
                  <td className="p-4">
                    <span className="pill">
                      {buddy.verified ? t("buddies.verified") : t("buddies.pending")}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      className={
                        buddy.verified ? "btn-light !py-2" : "btn-primary !py-2"
                      }
                      onClick={() =>
                        changeBuddyVerification(buddy._id, !buddy.verified)
                      }
                      disabled={!buddy.verified && buddy.user?.kycStatus !== "Verified"}
                      title={!buddy.verified && buddy.user?.kycStatus !== "Verified" ? t("buddies.needKyc") : undefined}
                    >
                      {buddy.verified ? t("buddies.unverify") : t("buddies.verify")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!buddies.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              {t("buddies.empty")}
            </p>
          )}
        </div>
        <AdminPagination result={buddiesResult} onChange={setBuddyPage} t={t} />
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-extrabold">{t("requests.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("requests.subtitle")}
            </p>
          </div>
          <ArrowDownToLine size={18} className="text-brand" />
        </div>
        <div className="flex flex-wrap gap-2 px-5 pb-4" role="tablist" aria-label={t("requests.statusLabel")}>
          {[
            ["Pending", t("requests.tabNew")],
            ["Completed", t("requests.tabCompleted")],
            ["Cancelled", t("requests.tabCancelled")],
          ].map(([status, label]) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={bookingStatusTab === status}
              onClick={() => { setBookingStatusTab(status); setBookingPage(1); }}
              className={bookingStatusTab === status ? "btn-primary" : "btn-light"}
            >
              {label} ({bookings.filter((booking) => status === "Pending"
                ? ["Pending", "Confirmed"].includes(booking.status)
                : booking.status === status).length})
            </button>
          ))}
        </div>
        <div className="space-y-3 px-5 pb-2">
          {bookingResult.items.map((b) => (
            <button
              key={b._id}
              type="button"
              onClick={() => setSelectedBooking(b)}
              className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-brand/40 hover:bg-slate-50"
            >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-navy">{b.customer?.fullName || t("requests.defaultCustomer")}</span>
                  <span className="text-xs text-slate-500">{b.buddy?.fullName || t("requests.defaultBuddy")}</span>
                  <span className="text-xs text-slate-500">{new Date(b.date).toLocaleDateString(locale)} · {b.time}</span>
                  <span className="pill">{t(`requests.status${b.status}`)}</span>
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  {b.customer?.email || ""} · {b.buddy?.area || ""}
                </span>
            </button>
          ))}
          {!filteredBookings.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              {t("requests.empty")}
            </p>
          )}
        </div>
        {filteredBookings.length > 3 && (
          <AdminPagination result={bookingResult} onChange={setBookingPage} t={t} />
        )}
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">{t("refunds.policyTitle")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("refunds.policySubtitle")}</p>
          </div>
          <button type="button" className="btn-primary" onClick={saveCancellationPolicy}>
            {t("refunds.savePolicy")}
          </button>
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["overSixHoursPercent", t("refunds.overSixHours")],
            ["threeToSixHoursPercent", t("refunds.threeToSixHours")],
            ["oneToThreeHoursPercent", t("refunds.oneToThreeHours")],
            ["underOneHourPercent", t("refunds.underOneHour")],
          ].map(([field, label]) => (
            <label key={field} className="text-xs font-bold text-slate-600">
              {label}
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="field"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={cancellationPolicy[field] ?? ""}
                  onChange={(event) => setCancellationPolicy((current) => ({
                    ...current,
                    [field]: event.target.value === "" ? "" : Number(event.target.value),
                  }))}
                />
                <span>%</span>
              </div>
            </label>
          ))}
        </div>
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">{t("refunds.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("refunds.subtitle")}</p>
          </div>
          <span className="pill">{refunds.length}</span>
        </div>
        <div className="space-y-3 px-5 pb-5">
          {refundResult.items.map((refund) => (
            <article key={refund._id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-navy">
                    {refund.customer?.fullName || t("refunds.unknownCustomer")}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {refund.customer?.email || ""}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {refund.booking?.buddy?.fullName || t("requests.defaultBuddy")}
                    {refund.booking?.date
                      ? ` · ${new Date(refund.booking.date).toLocaleDateString(locale)}`
                      : ""}
                    {refund.booking?.time ? ` · ${refund.booking.time}` : ""}
                  </p>
                </div>
                <span className="pill">{t(`refunds.status${refund.status}`, refund.status)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                <span>{t("refunds.amount")}: <b>{formatCurrency(refund.amount)}</b></span>
                <span>{t("refunds.percentage", { percentage: refund.percentage })}</span>
                <span>{t("refunds.paymentMethod")}: {refund.paymentMethod}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{refund.reason}</p>
              {refund.reviewNote && (
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  {refund.reviewNote}
                </p>
              )}
              {refund.providerRefundId && (
                <p className="mt-2 break-all text-xs text-slate-500">
                  {t("refunds.providerRefundId")}: {refund.providerRefundId}
                </p>
              )}
              {refund.history?.length > 0 && (
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-xs font-bold text-brand">
                    {t("refunds.history")}
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {refund.history.map((entry, index) => (
                      <li key={`${entry.status}-${entry.createdAt || index}`} className="text-xs text-slate-600">
                        <span className="font-bold">
                          {t(`refunds.status${entry.status}`, entry.status)}
                        </span>
                        {entry.createdAt && (
                          <span className="ml-2 text-slate-400">
                            {new Date(entry.createdAt).toLocaleString(locale)}
                          </span>
                        )}
                        {entry.note && <p className="mt-1">{entry.note}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {refund.status === "PENDING" && (
                  <>
                    <button type="button" className="btn-primary !py-2" onClick={() => openRefundAction(refund, "APPROVE")}>
                      {t("refunds.approve")}
                    </button>
                    <button type="button" className="btn-light !py-2" onClick={() => openRefundAction(refund, "REJECT")}>
                      {t("refunds.reject")}
                    </button>
                  </>
                )}
                {refund.status === "PROCESSING" && refund.paymentMethod !== "Wallet" && !refund.providerRefundId && (
                  <button type="button" className="btn-primary !py-2" onClick={() => openRefundAction(refund, "EXTERNAL")}>
                    {t("refunds.confirmExternal")}
                  </button>
                )}
                {refund.status === "PROCESSING" && refund.paymentMethod !== "Wallet" && (
                  <p className="basis-full text-xs text-amber-800">{t("refunds.externalInstructions")}</p>
                )}
              </div>
            </article>
          ))}
          {!refunds.length && (
            <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
              {t("refunds.empty")}
            </p>
          )}
        </div>
        {refunds.length > 3 && (
          <AdminPagination
            result={refundResult}
            onChange={setRefundPage}
            t={t}
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
            { label: t("requests.customer"), value: selectedBooking.customer?.fullName || t("requests.defaultCustomer") },
            { label: t("requests.status"), value: t(`requests.status${selectedBooking.status}`) },
            { label: t("requests.customerEmail"), value: selectedBooking.customer?.email },
            { label: t("requests.customerPhone"), value: selectedBooking.customer?.phone },
            { label: t("requests.buddy"), value: selectedBooking.buddy?.fullName || t("requests.defaultBuddy") },
            { label: t("requests.area"), value: selectedBooking.buddy?.area },
            { label: t("requests.dateTime"), value: `${new Date(selectedBooking.date).toLocaleDateString(locale)} · ${selectedBooking.time}` },
            { label: t("requests.guests", { count: selectedBooking.guestCount || 1 }), value: selectedBooking.language || t("requests.defaultLanguage") },
            { label: t("requests.serviceLabel"), value: formatCurrency(selectedBooking.price || 0) },
            { label: t("requests.foodLabel"), value: formatCurrency(selectedBooking.foodBudget || 0) },
            { label: t("requests.extraLabel"), value: formatCurrency(selectedBooking.experienceBudget || 0) },
            { label: t("requests.paymentLabel"), value: selectedBooking.paymentStatus },
            { label: t("requests.paymentMethodLabel"), value: selectedBooking.paymentMethod },
            { label: t("requests.meetingAddressLabel"), value: selectedBooking.meetingAddress, fullWidth: true },
            { label: t("requests.noteLabel"), value: selectedBooking.message, fullWidth: true },
          ]}
        />
      )}
      {refundAction && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-navy/60 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-action-title"
            onSubmit={submitRefundAction}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="border-b border-slate-100 px-6 py-5">
              <h2 id="refund-action-title" className="text-lg font-black text-navy">
                {t(refundAction.action === "EXTERNAL"
                  ? "refunds.confirmExternal"
                  : refundAction.action === "APPROVE"
                    ? "refunds.approve"
                    : "refunds.reject")}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {refundAction.refund.customer?.fullName || t("refunds.unknownCustomer")}
                {" · "}{formatCurrency(refundAction.refund.amount)}
              </p>
              {refundAction.action === "EXTERNAL" && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {t("refunds.externalInstructions")}
                </p>
              )}
            </header>
            <div className="space-y-4 px-6 py-5">
              {refundAction.action === "EXTERNAL" && (
                <label className="block text-xs font-bold text-slate-700">
                  {t("refunds.providerRefundId")}
                  <input
                    className="field mt-2"
                    value={providerRefundId}
                    onChange={(event) => setProviderRefundId(event.target.value)}
                    maxLength={120}
                    required
                  />
                </label>
              )}
              <label className="block text-xs font-bold text-slate-700">
                {t("refunds.note")}
                <textarea
                  className="field mt-2 min-h-24 resize-y"
                  value={refundNote}
                  onChange={(event) => setRefundNote(event.target.value)}
                  maxLength={500}
                  required={refundAction.action === "EXTERNAL"}
                />
              </label>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-light justify-center"
                disabled={refundActionLoading}
                onClick={() => setRefundAction(null)}
              >
                {t("requests.close")}
              </button>
              <button type="submit" className="btn-primary justify-center" disabled={refundActionLoading}>
                {refundActionLoading ? <RefreshCw size={14} className="animate-spin" /> : t("refunds.submit")}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
