import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpFromLine,
  QrCode,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Eye,
  Building2,
  CreditCard,
  User,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Crown,
  Sparkles,
  Zap,
} from "lucide-react";
import api from "../services/api";
import WalletTopUpModal from "../components/WalletTopUpModal";
import WithdrawalModal from "../components/WithdrawalModal";
import WithdrawalDetailModal from "../components/WithdrawalDetailModal";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";
import {
  filterTransactions,
  transactionAmountPrefix,
} from "../utils/walletTransactions";
import { paginate } from "../utils/pagination";
import Pagination from "../components/Pagination";
import BookingDetailsModal from "../components/BookingDetailsModal";
import TripFeedback from "../components/TripFeedback";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("lb_user") || "{}");
  } catch {
    return {};
  }
}

const WITHDRAWAL_STATUS_BADGES = {
  Pending: {
    label: "Chờ duyệt",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
  },
  Processing: {
    label: "Đang xử lý",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
  },
  Completed: {
    label: "Đã chuyển tiền",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  Rejected: {
    label: "Từ chối",
    className: "bg-rose-100 text-rose-800 border-rose-200",
    icon: AlertCircle,
  },
  Cancelled: {
    label: "Đã hủy",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: XCircle,
  },
};

export default function WalletPage() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const isLocal = user.role === "local";
  const { formatCurrency, formatDateTime, rateError } = useLocale();
  const { t } = useTranslation("common");

  // Navigation tab: 'overview' | 'transactions' | 'withdrawals'
  const [activeTab, setActiveTab] = useState("overview");

  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementConfirmation, setSettlementConfirmation] = useState(null);
  const [settling, setSettling] = useState(false);

  // Transactions tab filter & pagination
  const [historyWallet, setHistoryWallet] = useState("System");
  const [historyDate, setHistoryDate] = useState("");
  const [historyDirection, setHistoryDirection] = useState("");
  const [historyType, setHistoryType] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  // Withdrawals tab filter & pagination
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("All");
  const [withdrawalPage, setWithdrawalPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Modals
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Commission settings for Admin
  const [commission, setCommission] = useState({ standard: 15, premium: 10 });
  const [savingCommission, setSavingCommission] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [walletResult, transactionsResult, withdrawalsResult, settlementsResult] =
        await Promise.allSettled([
          api.get("/wallet/overview"),
          api.get("/wallet/transactions"),
          api.get("/wallet/withdrawals/mine"),
          isAdmin ? api.get("/wallet/settlements") : Promise.resolve(null),
        ]);

      const loadErrors = [];
      if (walletResult.status === "fulfilled") {
        setOverview(walletResult.value.data);
        if (walletResult.value.data.commissions) {
          setCommission(walletResult.value.data.commissions);
        }
      } else {
        loadErrors.push(
          walletResult.reason.response?.data?.message || t("errLoadBalance")
        );
      }

      if (transactionsResult.status === "fulfilled") {
        setTransactions(transactionsResult.value.data.transactions || []);
      } else {
        loadErrors.push(
          transactionsResult.reason.response?.data?.message ||
            t("errLoadTransactions")
        );
      }

      if (withdrawalsResult.status === "fulfilled") {
        setMyWithdrawals(withdrawalsResult.value.data.withdrawals || []);
      }

      if (isAdmin && settlementsResult.status === "fulfilled") {
        setPendingSettlements(settlementsResult.value.data || []);
      }

      if (loadErrors.length) setError(loadErrors.join(" "));
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("errLoadWallet"));
    } finally {
      setLoading(false);
    }
  }, [t, isAdmin]);

  const handleTopUpSuccess = useCallback(async () => {
    await load();
  }, [load]);

  const handleWithdrawSuccess = useCallback(async (data) => {
    setNotice(
      `Đã tạo yêu cầu rút ${formatCurrency(
        data?.withdrawal?.amount || 0
      )} thành công. Số tiền đã được tạm giữ an toàn và đang chờ Admin xử lý.`
    );
    await load();
    setActiveTab("withdrawals");
  }, [formatCurrency, load]);

  useEffect(() => {
    load();
  }, [load]);

  // Financial values from backend
  const totalBalance = overview?.walletBalance ?? overview?.balance ?? 0;
  const pendingAmount = overview?.pendingWithdrawalAmount ?? 0;
  const availableBalance =
    overview?.availableBalance ?? Math.max(0, totalBalance - pendingAmount);

  // Filter transactions
  const walletTransactions = isAdmin
    ? transactions.filter((tr) => tr.walletOwner === historyWallet)
    : transactions;

  const filteredTransactions = walletTransactions.filter((tr) => {
    if (historyType && tr.type !== historyType) return false;
    return true;
  });

  const historyResult = paginate(
    filterTransactions(filteredTransactions, {
      date: historyDate,
      direction: historyDirection,
    }),
    historyPage,
    10
  );

  // Filter withdrawals
  const filteredWithdrawals = myWithdrawals.filter((w) => {
    if (withdrawalStatusFilter !== "All" && w.status !== withdrawalStatusFilter)
      return false;
    return true;
  });
  const withdrawalsResult = paginate(filteredWithdrawals, withdrawalPage, 10);

  async function saveCommission(event) {
    event.preventDefault();
    setSavingCommission(true);
    setError("");
    setNotice("");
    try {
      await api.patch("/wallet/commission", {
        standard: Number(commission.standard),
        premium: Number(commission.premium),
      });
      setNotice(t("commissionSaved", "Đã lưu cấu hình hoa hồng."));
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("errCommission"));
    } finally {
      setSavingCommission(false);
    }
  }

  async function confirmSettlement() {
    if (!settlementConfirmation || settling) return;
    setSettling(true);
    setError("");
    try {
      await api.patch(`/wallet/settlements/${settlementConfirmation._id}`);
      setNotice(
        `Đã tất toán ${formatCurrency(
          settlementConfirmation.localEarning
        )} cho ${
          settlementConfirmation.buddy?.user?.fullName || "Local"
        }.`
      );
      setSettlementConfirmation(null);
      setSelectedSettlement(null);
      await load();
      window.dispatchEvent(new Event("lb-notifications-change"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Không thể tất toán cho Local."
      );
    } finally {
      setSettling(false);
    }
  }

  function transactionTitle(transaction) {
    const titles = {
      TopUp: "Nạp tiền ví (PayOS QR)",
      Booking: "Thanh toán đặt lịch",
      Refund: "Hoàn tiền",
      Escrow: "Ví hệ thống",
      Earning: "Thu nhập Local",
      Commission: "Hoa hồng sàn",
      Withdrawal: "Rút tiền về ngân hàng",
      WithdrawalReserved: "Tạm giữ tiền rút",
      WithdrawalCompleted: "Rút tiền thành công",
      WithdrawalReleased: "Hoàn tiền rút về số dư",
      PremiumSubscription: "Đăng ký Local Premium",
    };
    return titles[transaction.type] || transaction.type;
  }

  if (loading && !overview) {
    return (
      <div className="container-page py-16 text-center">
        <RefreshCw size={36} className="mx-auto text-brand animate-spin" />
        <p className="mt-4 text-sm font-bold text-navy">Đang tải thông tin ví...</p>
      </div>
    );
  }

  return (
    <div className="container-page space-y-6 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="pill">
            <Wallet size={13} /> VÍ & TÀI CHÍNH
          </span>
          <h1 className="mt-2 text-3xl font-black text-navy">
            {isAdmin ? "Quản lý ví Admin & Hệ thống" : isLocal ? "Ví Local Buddy" : "Ví Traveler"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Hệ thống quản lý số dư, nạp tiền tự động qua PayOS VietQR và rút tiền về tài khoản ngân hàng thực tế.
          </p>
        </div>
        <button className="btn-light" onClick={load} type="button">
          <RefreshCw size={14} /> Làm mới
        </button>
      </header>

      {/* Notices & Errors */}
      {rateError && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
          {rateError} Tạm thời đang hiển thị giá trị gốc VND.
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          {notice}
        </p>
      )}

      {/* 3 Main Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 sm:space-x-4">
        {[
          { id: "overview", label: "Tổng quan ví" },
          { id: "transactions", label: `Lịch sử giao dịch (${transactions.length})` },
          { id: "withdrawals", label: `Yêu cầu rút tiền (${myWithdrawals.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-3 text-xs sm:text-sm font-black transition border-b-2 flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-navy hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {isAdmin ? (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="panel !bg-gradient-to-r from-sky-50 to-cyan-50 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-extrabold text-navy">
                    <Wallet size={18} className="text-brand" /> Ví hệ thống (Escrow)
                  </h2>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500">Tiền đang giữ trong hệ thống</p>
                <p className="mt-1 text-3xl font-black text-brand">
                  {formatCurrency(overview?.systemBalance || 0)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Tiền đặt cọc booking và thu nhập Local đang chờ tất toán sau tour.
                </p>
              </section>

              <section className="panel !bg-gradient-to-r from-emerald-50 to-teal-50 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-extrabold text-navy">
                    <Wallet size={18} className="text-brand" /> Ví Admin (Doanh thu hoa hồng)
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-500">Tổng số dư</span>
                    <p className="text-2xl font-black text-navy">{formatCurrency(totalBalance)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-emerald-700">Khả dụng để rút</span>
                    <p className="text-2xl font-black text-emerald-600">{formatCurrency(availableBalance)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary mt-5 w-full flex items-center justify-center gap-2"
                  onClick={() => setWithdrawModalOpen(true)}
                >
                  <ArrowUpFromLine size={16} /> Rút tiền từ ví Admin
                </button>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              {/* VIP Member Wallet Banner */}
              {overview?.isPremium && (
                <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#131d2e] to-[#251806] text-white p-6 sm:p-7 shadow-2xl border-2 border-amber-400/50 relative overflow-hidden flex flex-wrap items-center justify-between gap-4">
                  <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 opacity-10 pointer-events-none text-amber-300">
                    <Crown size={220} />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-amber-950 text-xs font-black uppercase tracking-wider mb-2">
                      <Crown size={13} className="fill-amber-950" />
                      Tài khoản Ví VIP Local Premium
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      Đặc quyền Hoa hồng 10% đang có hiệu lực
                    </h3>
                    <p className="mt-1 text-xs text-amber-200/90 max-w-lg leading-relaxed">
                      Bạn được giữ lại 90% doanh thu mỗi chuyến dẫn tour (chỉ nộp 10% hoa hồng thay vì 15% tiêu chuẩn).
                    </p>
                  </div>
                  <div className="relative z-10 flex items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                      <Zap size={14} className="text-yellow-400" /> Tiết kiệm 5% phí sàn
                    </span>
                  </div>
                </div>
              )}

              {/* 3 Metric Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Total Balance */}
                <div className="panel p-5 bg-gradient-to-br from-slate-50 to-white border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Tổng số dư ví</span>
                    <Wallet size={18} className="text-slate-400" />
                  </div>
                  <p className="mt-3 text-2xl sm:text-3xl font-black text-navy">
                    {formatCurrency(totalBalance)}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Bao gồm cả số tiền đang chờ duyệt rút
                  </p>
                </div>

                {/* Reserved / Pending Amount */}
                <div className="panel p-5 bg-gradient-to-br from-amber-50/60 to-white border border-amber-200">
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Đang chờ rút (Tạm giữ)</span>
                    <Clock size={18} className="text-amber-500" />
                  </div>
                  <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-600">
                    {formatCurrency(pendingAmount)}
                  </p>
                  <p className="mt-1.5 text-[11px] text-amber-800/80">
                    Đã giữ để Admin duyệt chuyển khoản
                  </p>
                </div>

                {/* Available Balance */}
                <div className="panel p-5 bg-gradient-to-br from-emerald-50/70 to-white border-2 border-emerald-400 shadow-sm">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-xs font-black uppercase tracking-wider">Số dư khả dụng</span>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <p className="mt-3 text-2xl sm:text-3xl font-black text-emerald-600">
                    {formatCurrency(availableBalance)}
                  </p>
                  <p className="mt-1.5 text-[11px] text-emerald-700 font-semibold">
                    = Tổng số dư - Số tiền chờ rút
                  </p>
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="panel p-6 bg-gradient-to-r from-blue-50/60 via-white to-emerald-50/60 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-navy flex items-center gap-2">
                    <QrCode size={18} className="text-brand" /> Nạp hoặc rút tiền tức thì
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-lg">
                    Nạp tiền tự động qua quét mã PayOS VietQR hoặc gửi yêu cầu rút tiền về tài khoản ngân hàng của bạn.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setTopUpOpen(true)}
                    className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-brand text-white font-black text-xs shadow-md shadow-brand/20 hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    <QrCode size={16} /> Nạp tiền qua PayOS QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(true)}
                    className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-white border border-brand text-brand hover:bg-brand hover:text-white font-black text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    <ArrowUpFromLine size={16} /> Yêu cầu rút tiền
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Settlement Section */}
          {isAdmin && (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-extrabold text-navy">Tất toán cho Local</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Khoản thu nhập sau hoa hồng đang được giữ trong ví hệ thống.
                  </p>
                </div>
                <span className="pill">{pendingSettlements.length} đang chờ</span>
              </div>
              <div className="divide-y divide-slate-100">
                {pendingSettlements.map((booking) => (
                  <button
                    key={booking._id}
                    type="button"
                    onClick={() => setSelectedSettlement(booking)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <span>
                      <b className="block text-sm text-navy">
                        {booking.buddy?.user?.fullName ||
                          booking.buddy?.fullName ||
                          "Local"}
                      </b>
                      <small className="mt-1 block text-slate-500">
                        {booking.buddy?.user?.email || "—"} ·{" "}
                        {booking.date?.slice(0, 10)} · {booking.time}
                      </small>
                    </span>
                    <b className="text-sm text-brand">
                      {formatCurrency(booking.localEarning)}
                    </b>
                  </button>
                ))}
                {!pendingSettlements.length && (
                  <p className="p-7 text-center text-sm text-slate-500">
                    Không có khoản tất toán đang chờ.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Admin Commission Settings */}
          {isAdmin && (
            <form
              className="panel grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={saveCommission}
            >
              <div className="sm:col-span-3">
                <h2 className="font-extrabold">Cấu hình hoa hồng sàn</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tỷ lệ hoa hồng được chốt tại thời điểm hoàn thành trải nghiệm.
                </p>
              </div>
              <label className="text-sm font-bold">
                Local thường (%)
                <input
                  className="field mt-2"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={commission.standard}
                  onChange={(e) =>
                    setCommission((s) => ({ ...s, standard: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-bold">
                Local Premium (%)
                <input
                  className="field mt-2"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={commission.premium}
                  onChange={(e) =>
                    setCommission((s) => ({ ...s, premium: e.target.value }))
                  }
                />
              </label>
              <button
                className="btn-primary self-end"
                disabled={savingCommission}
                type="submit"
              >
                {savingCommission ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: TRANSACTIONS */}
      {activeTab === "transactions" && (
        <section className="panel overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-extrabold text-navy">Lịch sử giao dịch ví</h2>
            <p className="mt-1 text-xs text-slate-500">
              Bao gồm nạp tiền, rút tiền, đặt lịch và thanh toán gói dịch vụ.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="w-full max-w-xs text-xs font-bold text-slate-600">
                Loại giao dịch
                <select
                  className="field mt-1"
                  value={historyType}
                  onChange={(e) => {
                    setHistoryType(e.target.value);
                    setHistoryPage(1);
                  }}
                >
                  <option value="">Tất cả loại giao dịch</option>
                  <option value="TopUp">Nạp tiền</option>
                  <option value="Booking">Đặt lịch tour</option>
                  <option value="WithdrawalReserved">Tạm giữ rút tiền</option>
                  <option value="WithdrawalCompleted">Rút tiền thành công</option>
                  <option value="WithdrawalReleased">Hoàn tiền rút</option>
                  <option value="PremiumSubscription">Local Premium</option>
                  <option value="Earning">Thu nhập</option>
                  <option value="Commission">Hoa hồng</option>
                  <option value="Refund">Hoàn tiền</option>
                </select>
              </label>

              <label className="w-full max-w-xs text-xs font-bold text-slate-600">
                Hướng dòng tiền
                <select
                  className="field mt-1"
                  value={historyDirection}
                  onChange={(e) => {
                    setHistoryDirection(e.target.value);
                    setHistoryPage(1);
                  }}
                >
                  <option value="">Tất cả hướng</option>
                  <option value="in">Tiền vào ví (+)</option>
                  <option value="out">Tiền ra ví (-)</option>
                </select>
              </label>

              <label className="w-full max-w-xs text-xs font-bold text-slate-600">
                Ngày thực hiện
                <input
                  className="field mt-1"
                  type="date"
                  value={historyDate}
                  onChange={(e) => {
                    setHistoryDate(e.target.value);
                    setHistoryPage(1);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {historyResult.items.map((tr) => (
              <button
                key={tr._id}
                type="button"
                onClick={() => setSelectedTransaction(tr)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
              >
                <div>
                  <b className="block text-sm text-navy">{transactionTitle(tr)}</b>
                  <p className="mt-1 text-xs text-slate-500">{tr.description}</p>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {formatDateTime(tr.createdAt)}
                  </span>
                </div>
                <div className="text-right">
                  <b
                    className={`block text-sm ${
                      transactionAmountPrefix(tr) === "+"
                        ? "text-emerald-600"
                        : "text-navy"
                    }`}
                  >
                    {transactionAmountPrefix(tr)}
                    {formatCurrency(tr.amount)}
                  </b>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${
                      tr.status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : tr.status === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tr.status}
                  </span>
                </div>
              </button>
            ))}

            {!historyResult.items.length && (
              <div className="p-12 text-center text-sm text-slate-500">
                Chưa có giao dịch phù hợp với bộ lọc tìm kiếm.
              </div>
            )}
          </div>

          <Pagination
            result={historyResult}
            onChange={setHistoryPage}
            previousLabel="Trang trước"
            nextLabel="Trang sau"
            pageLabel={`Trang ${historyResult.page} / ${historyResult.pageCount}`}
          />
        </section>
      )}

      {/* TAB 3: WITHDRAWAL REQUESTS */}
      {activeTab === "withdrawals" && (
        <section className="panel overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-navy">Danh sách yêu cầu rút tiền của bạn</h2>
              <p className="mt-1 text-xs text-slate-500">
                Theo dõi tiến trình chuyển khoản và lịch sử xử lý của Admin.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={withdrawalStatusFilter}
                onChange={(e) => {
                  setWithdrawalStatusFilter(e.target.value);
                  setWithdrawalPage(1);
                }}
                className="field text-xs font-bold py-2"
              >
                <option value="All">Tất cả trạng thái</option>
                <option value="Pending">Chờ duyệt (Pending)</option>
                <option value="Processing">Đang xử lý (Processing)</option>
                <option value="Completed">Đã chuyển tiền (Completed)</option>
                <option value="Rejected">Từ chối (Rejected)</option>
                <option value="Cancelled">Đã hủy (Cancelled)</option>
              </select>

              <button
                type="button"
                onClick={() => setWithdrawModalOpen(true)}
                className="btn-primary !py-2 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowUpFromLine size={14} /> Tạo yêu cầu rút mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Mã YC</th>
                  <th className="px-5 py-3.5">Ngày tạo</th>
                  <th className="px-5 py-3.5">Số tiền</th>
                  <th className="px-5 py-3.5">Ngân hàng & STK</th>
                  <th className="px-5 py-3.5">Chủ tài khoản</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawalsResult.items.map((w) => {
                  const badge =
                    WITHDRAWAL_STATUS_BADGES[w.status] ||
                    WITHDRAWAL_STATUS_BADGES.Pending;
                  const BadgeIcon = badge.icon;

                  return (
                    <tr
                      key={w._id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedWithdrawal(w)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-600">
                        #{String(w._id).slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDateTime(w.createdAt)}
                      </td>
                      <td className="px-5 py-4 font-black text-brand text-sm">
                        {formatCurrency(w.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-navy block">{w.bankName}</span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          {w.accountNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-navy uppercase">
                        {w.accountName}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badge.className}`}
                        >
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWithdrawal(w);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand/10 text-slate-700 hover:text-brand font-bold text-xs transition"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!withdrawalsResult.items.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      Chưa có yêu cầu rút tiền nào trong danh sách.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            result={withdrawalsResult}
            onChange={setWithdrawalPage}
            previousLabel="Trang trước"
            nextLabel="Trang sau"
            pageLabel={`Trang ${withdrawalsResult.page} / ${withdrawalsResult.pageCount}`}
          />
        </section>
      )}

      {/* TopUp Modal */}
      {topUpOpen && (
        <WalletTopUpModal
          isOpen={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          currentBalance={availableBalance}
          onSuccess={handleTopUpSuccess}
        />
      )}

      {/* Withdrawal Request Modal */}
      {withdrawModalOpen && (
        <WithdrawalModal
          isOpen={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          availableBalance={availableBalance}
          onSuccess={handleWithdrawSuccess}
        />
      )}

      {/* Withdrawal Detail Modal */}
      {selectedWithdrawal && (
        <WithdrawalDetailModal
          isOpen={Boolean(selectedWithdrawal)}
          onClose={() => setSelectedWithdrawal(null)}
          withdrawal={selectedWithdrawal}
          availableBalance={availableBalance}
          isUserView={true}
          onUpdated={async () => {
            await load();
            setSelectedWithdrawal(null);
          }}
        />
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-navy/60 p-4"
          role="presentation"
          onClick={() => setSelectedTransaction(null)}
        >
          <section
            className="panel max-h-[90dvh] w-full max-w-lg overflow-y-auto p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Chi tiết giao dịch</p>
                <h2 id="transaction-detail-title" className="mt-1 text-xl font-black">
                  {transactionTitle(selectedTransaction)}
                </h2>
              </div>
              <button
                type="button"
                className="btn-light !py-2"
                onClick={() => setSelectedTransaction(null)}
              >
                Đóng
              </button>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Số tiền</dt>
                <dd className="font-bold">{formatCurrency(selectedTransaction.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Trạng thái</dt>
                <dd className="font-bold">{selectedTransaction.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Mã giao dịch</dt>
                <dd className="break-all font-mono text-xs">{selectedTransaction._id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Phương thức</dt>
                <dd className="font-bold">{selectedTransaction.paymentMethod}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Thời gian</dt>
                <dd className="font-bold">{formatDateTime(selectedTransaction.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Nội dung</dt>
                <dd className="font-bold">{selectedTransaction.description}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {/* Admin Settlement Details Modal */}
      {selectedSettlement && (
        <BookingDetailsModal
          title="Chi tiết tất toán"
          closeLabel="Đóng"
          onClose={() => setSelectedSettlement(null)}
          fields={[
            {
              label: "Local",
              value:
                selectedSettlement.buddy?.user?.fullName ||
                selectedSettlement.buddy?.fullName,
            },
            {
              label: "Email Local",
              value: selectedSettlement.buddy?.user?.email,
            },
            {
              label: "Traveler",
              value: selectedSettlement.customer?.fullName,
            },
            {
              label: "Email Traveler",
              value: selectedSettlement.customer?.email,
            },
            {
              label: "Ngày và giờ",
              value: `${selectedSettlement.date?.slice(0, 10)} · ${
                selectedSettlement.time
              }`,
            },
            {
              label: "Số tiền tất toán",
              value: formatCurrency(selectedSettlement.localEarning),
            },
          ]}
        >
          <TripFeedback booking={selectedSettlement} viewerRole="admin" />
          <button
            type="button"
            className="btn-primary"
            onClick={() => setSettlementConfirmation(selectedSettlement)}
          >
            Tất toán
          </button>
        </BookingDetailsModal>
      )}

      {/* Settlement Confirmation Modal */}
      {settlementConfirmation && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-navy/60 p-4"
          role="presentation"
        >
          <section
            className="panel w-full max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-confirm-title"
          >
            <h2 id="settlement-confirm-title" className="text-lg font-black text-navy">
              Xác nhận tất toán
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Bạn có chắc chắn muốn thanh toán{" "}
              <b>{formatCurrency(settlementConfirmation.localEarning)}</b> cho{" "}
              <b>
                {settlementConfirmation.buddy?.user?.fullName ||
                  settlementConfirmation.buddy?.fullName ||
                  "Local"}
              </b>{" "}
              không?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-light"
                onClick={() => setSettlementConfirmation(null)}
                disabled={settling}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSettlement}
                disabled={settling}
              >
                {settling ? "Đang tất toán..." : "Đồng ý"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
