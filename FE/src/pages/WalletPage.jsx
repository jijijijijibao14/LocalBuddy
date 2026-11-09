import { useCallback, useEffect, useState } from "react";
import { ArrowUpFromLine, QrCode, Wallet } from "lucide-react";
import api from "../services/api";
import WalletTopUpModal from "../components/WalletTopUpModal";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("lb_user") || "{}");
  } catch {
    return {};
  }
}

export default function WalletPage() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const isLocal = user.role === "local";
  const { formatCurrency, formatDateTime, rateError } = useLocale();
  const { t } = useTranslation("common");
  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [withdrawal, setWithdrawal] = useState({
    amount: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
  const [commission, setCommission] = useState({ standard: 10, premium: 5 });
  const [savingCommission, setSavingCommission] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [walletResult, transactionsResult] = await Promise.allSettled([
        api.get("/wallet/overview"),
        api.get("/wallet/transactions"),
      ]);
      const loadErrors = [];
      if (walletResult.status === "fulfilled") {
        setOverview(walletResult.value.data);
        if (walletResult.value.data.commissions) {
          setCommission(walletResult.value.data.commissions);
        }
      } else {
        loadErrors.push(
          walletResult.reason.response?.data?.message || t("errLoadBalance"),
        );
      }
      if (transactionsResult.status === "fulfilled") {
        setTransactions(transactionsResult.value.data.transactions || []);
      } else {
        loadErrors.push(
          transactionsResult.reason.response?.data?.message || t("errLoadTransactions"),
        );
      }
      if (loadErrors.length) setError(loadErrors.join(" "));
    } catch (requestError) {
      setError(requestError.response?.data?.message       || t("errLoadWallet"));
    } finally {
      setLoading(false);
    }
        }, [t]);

  const handleTopUpSuccess = useCallback(async (newBalance) => {
    await load();
    const balanceValue = Number(newBalance);
    if (Number.isFinite(balanceValue)) {
      setOverview((currentOverview) => ({
        ...currentOverview,
        role: currentOverview?.role || user.role,
        balance: balanceValue,
      }));
    }
  }, [load, user.role]);

  useEffect(() => { load(); }, [load]);

  const balance = isAdmin ? overview?.adminBalance : overview?.balance;

  async function submitWithdrawal(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setWithdrawing(true);
    try {
      await api.post("/wallet/withdraw", {
        ...withdrawal,
        amount: Number(withdrawal.amount),
      });
      setWithdrawal({ amount: "", bankName: "", accountNumber: "", accountName: "" });
      setWithdrawOpen(false);
      await load();
      setNotice(t("withdrawalQueued", "Đã gửi yêu cầu rút tiền. Số tiền được giữ cho đến khi Admin xử lý."));
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("errWithdraw"));
    } finally {
      setWithdrawing(false);
    }
  }

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

  async function resolveWithdrawal(transactionId, status) {
    setError("");
    try {
      await api.patch(`/wallet/withdrawals/${transactionId}`, { status });
      setNotice(status === "Completed"
        ? t("withdrawalCompleted", "Đã đánh dấu yêu cầu là đã chuyển tiền.")
        : t("withdrawalRejected", "Đã từ chối yêu cầu và hoàn lại số dư."));
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("errResolveWithdrawal"));
    }
  }

  function transactionTitle(transaction) {
    const titles = {
      TopUp: t("topupType", "Nạp tiền"),
      Booking: t("bookingType", "Thanh toán đặt lịch"),
      Refund: t("refundType", "Hoàn tiền"),
      Escrow: t("escrowType", "Ví hệ thống"),
      Earning: t("earningType", "Thu nhập Local"),
      Commission: t("commissionType", "Hoa hồng"),
      Withdrawal: t("withdrawalType", "Rút tiền"),
    };
    return titles[transaction.type] || transaction.type;
  }

  if (loading && !overview) return <div className="container-page py-12">{t("loading", "Đang tải ví...")}</div>;

  return (
    <div className="container-page space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{t("walletEyebrow", "VÍ LOCAL BUDDY")}</p>
          <h1 className="mt-1 text-3xl font-black text-navy">{t("walletTitle", "Ví và giao dịch")}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("walletDescription", "Số dư được ghi sổ bằng VND; số tiền quy đổi trên màn hình dùng tỷ giá trực tuyến mới nhất.")}
          </p>
        </div>
        <button className="btn-light" onClick={load} type="button">{t("refresh", "Làm mới")}</button>
      </header>

      {rateError && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
          {rateError} {t("rateFallback", "Tạm thời đang hiển thị giá trị gốc VND.")}
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}

      {isAdmin ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: t("systemWallet", "Ví hệ thống"),
              amount: overview?.systemBalance,
              description: t("systemEscrowDescription", "Tiền đặt lịch đang được giữ trong escrow."),
              tone: "from-sky-50 to-cyan-50",
            },
            {
              title: t("adminWallet", "Ví Admin"),
              amount: overview?.adminBalance,
              description: t("adminCommissionDescription", "Hoa hồng được cộng sau khi trải nghiệm hoàn thành."),
              tone: "from-emerald-50 to-teal-50",
            },
          ].map((wallet) => (
            <section key={wallet.title} className={`panel !bg-gradient-to-r ${wallet.tone} p-5 sm:p-6`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-extrabold text-navy">
                  <Wallet size={18} className="text-brand" /> {wallet.title}
                </h2>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-500">{t("availableBalance", "Số dư khả dụng")}</p>
              <p className="mt-1 text-3xl font-black text-brand">{formatCurrency(wallet.amount)}</p>
              <p className="mt-3 text-xs text-slate-500">{wallet.description}</p>
              {wallet.title === t("adminWallet", "Ví Admin") && (
                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/20 bg-white/80 px-4 py-3 text-sm font-extrabold text-brand transition hover:bg-white"
                  onClick={() => setWithdrawOpen(true)}
                >
                  <ArrowUpFromLine size={17} /> {t("withdraw", "Rút tiền")}
                </button>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="panel !bg-gradient-to-r from-sky-50 to-emerald-50 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-extrabold text-navy">
              <Wallet size={18} className="text-brand" />
              {isLocal ? t("localWalletName", "Ví Local Buddy") : t("travelerWalletName", "Ví Traveler")}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-brand">
              <QrCode size={12} /> VNPAY-QR
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">{t("availableBalance", "Số dư khả dụng")}</p>
          <p className="mt-1 text-3xl font-black text-brand">{formatCurrency(balance)}</p>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-700 to-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:brightness-105"
            onClick={() => setTopUpOpen(true)}
          >
            <QrCode size={17} /> {t("topUpViaVnpay", "Nạp tiền qua VNPAY-QR")}
          </button>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/20 bg-white/80 px-4 py-3 text-sm font-extrabold text-brand transition hover:bg-white"
            onClick={() => setWithdrawOpen(true)}
          >
            <ArrowUpFromLine size={17} /> {t("withdraw", "Rút tiền")}
          </button>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {t("vnpayTopupHint", "Hỗ trợ quét QR qua ngân hàng và ví VNPAY. Xác nhận tức thì.")}
          </p>
        </section>
      )}

      {isAdmin && (
        <form className="panel grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]" onSubmit={saveCommission}>
          <div className="sm:col-span-3">
            <h2 className="font-extrabold">{t("commission", "Cấu hình hoa hồng")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("commissionTiming", "Tỷ lệ được chốt tại thời điểm hoàn thành trải nghiệm.")}</p>
          </div>
          <label className="text-sm font-bold">
            {t("standard", "Local thường")} (%)
            <input className="field mt-2" type="number" min="0" max="100" step="0.1" required
              value={commission.standard} onChange={(event) => setCommission((state) => ({ ...state, standard: event.target.value }))} />
          </label>
          <label className="text-sm font-bold">
            {t("premium", "Local Premium (demo)")} (%)
            <input className="field mt-2" type="number" min="0" max="100" step="0.1" required
              value={commission.premium} onChange={(event) => setCommission((state) => ({ ...state, premium: event.target.value }))} />
          </label>
          <button className="btn-primary self-end" disabled={savingCommission} type="submit">
            {savingCommission ? t("saving", "Đang lưu...") : t("save", "Lưu cấu hình")}
          </button>
        </form>
      )}

      <section className="panel overflow-hidden">
        <div className="p-5">
          <h2 className="font-extrabold">{t("history", "Lịch sử giao dịch")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("transactionDetailsHint", "Chọn một giao dịch để xem đầy đủ thông tin.")}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.map((transaction) => (
            <button key={transaction._id} type="button" onClick={() => setSelectedTransaction(transaction)}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50">
              <span>
                <b className="block text-sm">{transactionTitle(transaction)}</b>
                <small className="mt-1 block text-slate-500">{transaction.description}</small>
                <small className="mt-1 block text-slate-400">{formatDateTime(transaction.createdAt)}</small>
              </span>
              <span className="text-right">
                <b className="block text-sm text-navy">{formatCurrency(transaction.amount)}</b>
                <small className="text-slate-500">{t(transaction.status.toLowerCase(), transaction.status)}</small>
              </span>
            </button>
          ))}
          {!transactions.length && <p className="p-8 text-center text-sm text-slate-500">{t("noTransactions", "Chưa có giao dịch.")}</p>}
        </div>
      </section>

      {isAdmin && transactions.some((transaction) => transaction.type === "Withdrawal" && transaction.status === "Pending") && (
        <section className="panel p-5">
          <h2 className="font-extrabold">{t("withdrawalRequests", "Yêu cầu rút tiền cần xử lý")}</h2>
          <div className="mt-3 space-y-3">
            {transactions.filter((transaction) => transaction.type === "Withdrawal" && transaction.status === "Pending").map((transaction) => (
              <div key={transaction._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <b>{transaction.user?.fullName || t("account", "Tài khoản")} · {formatCurrency(transaction.amount)}</b>
                  <p className="text-xs text-slate-500">{transaction.withdrawalDetails?.bankName} · {transaction.withdrawalDetails?.accountNumber} · {transaction.withdrawalDetails?.accountName}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary !py-2" onClick={() => resolveWithdrawal(transaction._id, "Completed")}>{t("markTransferred", "Đã chuyển")}</button>
                  <button className="btn-light !py-2" onClick={() => resolveWithdrawal(transaction._id, "Failed")}>{t("reject", "Từ chối")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {topUpOpen && (
        <WalletTopUpModal
          isOpen={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          currentBalance={overview?.balance || 0}
          onSuccess={handleTopUpSuccess}
        />
      )}
      {withdrawOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-navy/60 p-4"
          role="presentation"
          onClick={() => {
            if (!withdrawing) setWithdrawOpen(false);
          }}
        >
          <section
            className="panel w-full max-w-lg p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{isAdmin ? t("adminWallet", "Ví Admin") : isLocal ? t("localWalletName", "Ví Local Buddy") : t("travelerWalletName", "Ví Traveler")}</p>
                <h2 id="withdraw-title" className="mt-1 text-xl font-black text-navy">
                  {t("requestWithdrawal", "Yêu cầu rút tiền")}
                </h2>
              </div>
              <button
                type="button"
                className="btn-light !py-2"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
              >
                {t("close", "Đóng")}
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {t("withdrawalNotice", "Gửi yêu cầu để Admin xử lý chuyển khoản thủ công. Số dư được giữ trong lúc chờ.")}
            </p>
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            <form className="mt-5 space-y-3" onSubmit={submitWithdrawal}>
              <label className="block text-xs font-bold">
                {t("amount", "Số tiền")} (VND)
                <input
                  className="field mt-1"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={withdrawal.amount}
                  onChange={(event) => setWithdrawal((state) => ({ ...state, amount: event.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold">
                {t("bank", "Ngân hàng")}
                <input
                  className="field mt-1"
                  maxLength="100"
                  required
                  value={withdrawal.bankName}
                  onChange={(event) => setWithdrawal((state) => ({ ...state, bankName: event.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold">
                {t("accountNumber", "Số tài khoản")}
                <input
                  className="field mt-1"
                  maxLength="40"
                  required
                  value={withdrawal.accountNumber}
                  onChange={(event) => setWithdrawal((state) => ({ ...state, accountNumber: event.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold">
                {t("accountName", "Tên chủ tài khoản")}
                <input
                  className="field mt-1"
                  maxLength="100"
                  required
                  value={withdrawal.accountName}
                  onChange={(event) => setWithdrawal((state) => ({ ...state, accountName: event.target.value }))}
                />
              </label>
              <button className="btn-primary w-full" type="submit" disabled={withdrawing}>
                {withdrawing ? t("submitting", "Đang gửi...") : t("submitWithdrawal", "Gửi yêu cầu rút tiền")}
              </button>
            </form>
          </section>
        </div>
      )}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-navy/60 p-4" role="presentation" onClick={() => setSelectedTransaction(null)}>
          <section className="panel w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{t("details", "Chi tiết giao dịch")}</p>
                <h2 id="transaction-detail-title" className="mt-1 text-xl font-black">{transactionTitle(selectedTransaction)}</h2>
              </div>
              <button type="button" className="btn-light !py-2" onClick={() => setSelectedTransaction(null)}>{t("close", "Đóng")}</button>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">{t("amount", "Số tiền")}</dt><dd className="font-bold">{formatCurrency(selectedTransaction.amount)}</dd></div>
              <div><dt className="text-slate-500">{t("status", "Trạng thái")}</dt><dd className="font-bold">{t(selectedTransaction.status.toLowerCase(), selectedTransaction.status)}</dd></div>
              <div><dt className="text-slate-500">{t("transactionId", "Mã giao dịch")}</dt><dd className="break-all font-mono text-xs">{selectedTransaction._id}</dd></div>
              <div><dt className="text-slate-500">{t("paymentMethod", "Phương thức")}</dt><dd className="font-bold">{selectedTransaction.paymentMethod}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">{t("time", "Thời gian")}</dt><dd className="font-bold">{formatDateTime(selectedTransaction.createdAt)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">{t("description", "Nội dung")}</dt><dd className="font-bold">{selectedTransaction.description}</dd></div>
              {selectedTransaction.withdrawalDetails?.bankName && (
                <div className="sm:col-span-2"><dt className="text-slate-500">{t("withdrawalAccount", "Tài khoản nhận")}</dt><dd className="font-bold">{selectedTransaction.withdrawalDetails.bankName} · {selectedTransaction.withdrawalDetails.accountNumber} · {selectedTransaction.withdrawalDetails.accountName}</dd></div>
              )}
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
