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

function AdminPagination({ result, onChange, t }) {
  return (
    <Pagination result={result} onChange={onChange}
      previousLabel={t("pagination.previous")} nextLabel={t("pagination.next")}
      pageLabel={t("pagination.page", { page: result.page, total: result.pageCount })} />
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
  const [message, setMessage] = useState("");
  const [refundAction, setRefundAction] = useState(null);
  const [refundNote, setRefundNote] = useState("");
  const [providerRefundId, setProviderRefundId] = useState("");
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const accountsResult = paginate(filterAccounts(users, accountRoleTab, accountQuery, accountStatus), accountPage);
  const buddiesResult = paginate(buddies, buddyPage);
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
    setRefundNote(action === "EXTERNAL" ? "Đã xác nhận hoàn tiền thành công trên PayOS." : "");
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
      setRefunds((prev) => prev.map((item) => item._id === data._id ? data : item));
      setMessage(action === "EXTERNAL"
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
              onClick={() => setBookingStatusTab(status)}
              className={bookingStatusTab === status ? "btn-primary" : "btn-light"}
            >
              {label} ({bookings.filter((booking) => status === "Pending"
                ? ["Pending", "Confirmed"].includes(booking.status)
                : booking.status === status).length})
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">{t("requests.colCustomer")}</th>
                <th className="p-4">{t("requests.colBuddy")}</th>
                <th className="p-4">{t("requests.colDateTime")}</th>
                <th className="p-4">{t("requests.colDetails")}</th>
                <th className="p-4">{t("accounts.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.filter((booking) => bookingStatusTab === "Pending"
                ? ["Pending", "Confirmed"].includes(booking.status)
                : booking.status === bookingStatusTab).map((b) => (
                <tr key={b._id} className="border-t border-slate-100">
                  <td className="p-4">
                    <b>{b.customer?.fullName || t("requests.defaultCustomer")}</b>
                    <p className="mt-1 text-slate-500">
                      {b.customer?.email || ""}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {b.customer?.phone || ""}
                    </p>
                  </td>
                  <td className="p-4">{b.buddy?.fullName || t("requests.defaultBuddy")}</td>
                  <td className="p-4">
                    {new Date(b.date).toLocaleDateString(locale)}
                    <p className="mt-1 text-slate-500">{b.time}</p>
                  </td>
                  <td className="p-4">
                    {t("requests.guests", { count: b.guestCount || 1 })} ·{" "}
                    {b.language || t("requests.defaultLanguage")}
                    <p className="mt-1 text-slate-500">
                      {t("requests.service", { amount: formatCurrency(b.price || 0) })}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {t("requests.food", { amount: formatCurrency(b.foodBudget || 0) })}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {t("requests.extra", { amount: formatCurrency(b.experienceBudget || 0) })}
                    </p>
                    {b.message && (
                      <p className="mt-1 max-w-xs whitespace-pre-wrap text-slate-600">
                        {t("requests.note", { message: b.message })}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="pill">{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bookings.some((booking) => bookingStatusTab === "Pending"
            ? ["Pending", "Confirmed"].includes(booking.status)
            : booking.status === bookingStatusTab) && (
            <p className="p-8 text-center text-xs text-slate-500">
              {t("requests.empty")}
            </p>
          )}
        </div>
      </section>
      <section className="panel mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold">Chính sách hủy và hoàn tiền</h2>
            <p className="mt-1 text-xs text-slate-500">
              Các tỷ lệ được tính ở backend theo thời điểm gửi yêu cầu.
            </p>
          </div>
          <button type="button" className="btn-primary !py-2" onClick={saveCancellationPolicy}>
            Lưu chính sách
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["overSixHoursPercent", "Trước hơn 6 tiếng"],
            ["threeToSixHoursPercent", "Trước 3–6 tiếng"],
            ["oneToThreeHoursPercent", "Trước 1–3 tiếng"],
            ["underOneHourPercent", "Trước dưới 1 tiếng"],
          ].map(([field, label]) => (
            <label key={field} className="text-xs font-bold text-slate-700">
              {label} (%)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={cancellationPolicy[field]}
                onChange={(event) => setCancellationPolicy((prev) => ({
                  ...prev,
                  [field]: event.target.value === "" ? "" : Number(event.target.value),
                }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Từ thời điểm bắt đầu trải nghiệm trở đi: hoàn 0%.</p>
      </section>

      <section className="panel mt-6 overflow-hidden">
        <div className="p-5">
          <h2 className="font-extrabold">Yêu cầu hoàn tiền ({refunds.length})</h2>
          <p className="mt-1 text-xs text-slate-500">
            PayOS không hỗ trợ hoàn tiền qua SDK hiện tại; xử lý trên Merchant Portal rồi nhập mã xác nhận tại đây.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {refunds.map((refund) => (
            <div key={refund._id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-[220px]">
                <p className="font-bold text-navy">
                  {refund.customer?.fullName || "Traveler"} · {refund.booking?.buddy?.fullName || "Local"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {refund.reason} · {refund.percentage}% · {formatCurrency(refund.amount || 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {refund.paymentMethod} · {refund.booking?.time || ""}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  {refund.status}{refund.providerRefundId ? ` · ${refund.providerRefundId}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {refund.status === "PENDING" && (
                  <>
                    <button className="btn-primary !py-2" onClick={() => openRefundAction(refund, "APPROVE")}>
                      Duyệt
                    </button>
                    <button className="btn-light !py-2" onClick={() => openRefundAction(refund, "REJECT")}>
                      Từ chối
                    </button>
                  </>
                )}
                {refund.status === "PROCESSING" && refund.paymentMethod !== "Wallet" && !refund.providerRefundId && (
                  <button className="btn-primary !py-2" onClick={() => openRefundAction(refund, "EXTERNAL")}>
                    Ghi nhận PayOS đã hoàn
                  </button>
                )}
              </div>
            </div>
          ))}
          {!refunds.length && <p className="p-8 text-center text-xs text-slate-500">Chưa có yêu cầu hoàn tiền.</p>}
        </div>
      </section>

      {refundAction && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-navy/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !refundActionLoading) setRefundAction(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-action-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="border-b border-slate-100 px-6 py-5">
              <span className="pill">
                <Wallet size={12} /> Quản lý hoàn tiền
              </span>
              <h2 id="refund-action-title" className="mt-3 text-xl font-black text-navy">
                {refundAction.action === "EXTERNAL"
                  ? "Ghi nhận hoàn tiền PayOS"
                  : refundAction.action === "APPROVE"
                    ? "Duyệt yêu cầu hoàn tiền"
                    : "Từ chối yêu cầu hoàn tiền"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {refundAction.refund.customer?.fullName || "Traveller"} · {formatCurrency(refundAction.refund.amount || 0)}
              </p>
            </header>
            <form onSubmit={submitRefundAction}>
              <div className="space-y-4 px-6 py-5">
                {refundAction.action === "EXTERNAL" && (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700" htmlFor="provider-refund-id">
                      Mã giao dịch hoàn tiền PayOS
                    </label>
                    <input
                      id="provider-refund-id"
                      value={providerRefundId}
                      onChange={(event) => setProviderRefundId(event.target.value)}
                      maxLength={200}
                      required
                      autoFocus
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
                      placeholder="Nhập mã giao dịch đã xác nhận"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700" htmlFor="refund-action-note">
                    {refundAction.action === "REJECT" ? "Lý do từ chối" : "Ghi chú"}
                    {refundAction.action === "APPROVE" && (
                      <span className="ml-1 font-medium text-slate-400">(không bắt buộc)</span>
                    )}
                  </label>
                  <textarea
                    id="refund-action-note"
                    value={refundNote}
                    onChange={(event) => setRefundNote(event.target.value)}
                    maxLength={500}
                    rows={3}
                    required={refundAction.action === "EXTERNAL"}
                    autoFocus={refundAction.action !== "EXTERNAL"}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
                    placeholder={refundAction.action === "REJECT"
                      ? "Nhập lý do từ chối..."
                      : "Nhập ghi chú nếu cần..."}
                  />
                </div>
                {message && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
                    {message}
                  </p>
                )}
              </div>
              <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="btn-light justify-center"
                  disabled={refundActionLoading}
                  onClick={() => setRefundAction(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={refundAction.action === "REJECT"
                    ? "rounded-xl bg-red-700 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-800 disabled:opacity-60"
                    : "btn-primary"}
                  disabled={refundActionLoading}
                >
                  {refundActionLoading
                    ? "Đang xử lý..."
                    : refundAction.action === "EXTERNAL"
                      ? "Xác nhận đã hoàn"
                      : refundAction.action === "APPROVE"
                        ? "Duyệt hoàn tiền"
                        : "Xác nhận từ chối"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
