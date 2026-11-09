import { useState, useEffect } from "react";
import {
  Wallet,
  QrCode,
  CreditCard,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  History,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Copy,
  Check,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";
import { useTranslation, Trans } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

const PRESET_AMOUNTS = [
  50000, 100000, 200000, 500000, 1000000, 2000000,
];

export default function WalletTopUpModal({
  isOpen,
  onClose,
  currentBalance = 0,
  onSuccess,
}) {
  const { formatCurrency } = useLocale();
  const { t } = useTranslation("payment");
  const [step, setStep] = useState("input"); // 'input' | 'qr_view' | 'success'
  const [amount, setAmount] = useState(100000);
  const [customAmount, setCustomAmount] = useState("100000");
  const [method, setMethod] = useState("VNPAYQR"); // 'VNPAYQR' | 'ALL'
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("topup"); // 'topup' | 'history'
  const [transactions, setTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [balanceAfterTopUp, setBalanceAfterTopUp] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hasTransferred, setHasTransferred] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 phút

  useEffect(() => {
    if (isOpen && tab === "history") {
      loadHistory();
    }
  }, [isOpen, tab]);

  useEffect(() => {
    let timer;
    if (step === "qr_view" && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  if (!isOpen) return null;

  function resetModal() {
    setStep("input");
    setQrData(null);
    setBalanceAfterTopUp(null);
    setError("");
    setCopied(false);
    setHasTransferred(false);
    setTimeLeft(900);
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const { data } = await api.get("/wallet/transactions");
      setTransactions(data.transactions || []);
    } catch (e) {
      console.error("Không tải được lịch sử giao dịch:", e);
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleSelectPreset(val) {
    setAmount(val);
    setCustomAmount(String(val));
    setError("");
  }

  function handleCustomChange(e) {
    const raw = e.target.value.replace(/\D/g, "");
    setCustomAmount(raw);
    const num = Number(raw);
    setAmount(num);
    if (num < 10000) {
      setError(t("errMinAmount"));
    } else if (num > 50000000) {
      setError(t("errMaxAmount"));
    } else {
      setError("");
    }
  }

  async function handleCreateVNPayQR() {
    if (amount < 10000) {
      setError(t("errPleaseMin"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/wallet/vnpay/create-url", {
        amount,
        bankCode: method === "VNPAYQR" ? "VNPAYQR" : "",
      });

      if (data?.orderId) {
        setQrData(data);
        setStep("qr_view");
        setTimeLeft(900);
      } else {
        setError(t("errNoOrder"));
      }
    } catch (e) {
      setError(
        e.response?.data?.message ||
          t("errCreateTopUpQr"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPayment() {
    if (!qrData?.orderId) return;
    setConfirmLoading(true);
    setError("");

    try {
      const { data } = await api.post("/wallet/confirm-deposit", {
        orderId: qrData.orderId,
      });

      if (data?.success) {
        setBalanceAfterTopUp(Number(data.newBalance));
        if (onSuccess) await onSuccess(data.newBalance);
        setStep("success");
      }
    } catch (e) {
      setError(
        e.response?.data?.message || t("errConfirmTopUp"),
      );
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleSimulateTopUp() {
    if (amount < 10000) {
      setError(t("errPleaseMin"));
      return;
    }
    setError("");
    setSimulateLoading(true);

    try {
      const { data } = await api.post("/wallet/simulate-topup", { amount });
      if (data?.success) {
        setBalanceAfterTopUp(Number(data.newBalance));
        if (onSuccess) await onSuccess(data.newBalance);
        handleClose();
        alert(
          t("simulateAlert", {
            message: data.message,
            amount: formatCurrency(data.newBalance),
          }),
        );
      }
    } catch (e) {
      setError(e.response?.data?.message || t("errSimulate"));
    } finally {
      setSimulateLoading(false);
    }
  }

  function handleCopy(text) {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header gradient */}
        <div className="relative bg-gradient-to-r from-[#075f88] via-[#0e7490] to-[#059669] p-6 text-white">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
            title={t("close")}
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
              <QrCode size={22} className="text-white" />
            </span>
            <div>
              <h2 className="text-xl font-black">{t("topUpTitle")}</h2>
              <p className="text-xs text-white/80">
                {t("topUpSubtitle")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs text-white/90">{t("currentBalanceLabel")}</span>
            <span className="text-lg font-black text-amber-300">
              {formatCurrency(currentBalance)}
            </span>
          </div>

          {step === "input" && (
            <div className="mt-4 flex gap-2 border-b border-white/20 pb-1">
              <button
                onClick={() => setTab("topup")}
                className={`flex items-center gap-1.5 pb-2 text-xs font-bold transition-colors cursor-pointer ${
                  tab === "topup"
                    ? "border-b-2 border-white text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <QrCode size={14} /> {t("tabTopUp")}
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex items-center gap-1.5 pb-2 text-xs font-bold transition-colors cursor-pointer ${
                  tab === "history"
                    ? "border-b-2 border-white text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <History size={14} /> {t("tabHistory")}
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6">
          {/* STEP 1: NHẬP SỐ TIỀN */}
          {step === "input" && tab === "topup" && (
            <div className="space-y-5">
              {/* Preset buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t("quickPick")}
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((val) => {
                    const isSelected = amount === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSelectPreset(val)}
                        className={`rounded-xl border py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                          isSelected
                            ? "border-brand bg-brand/10 text-brand shadow-sm ring-2 ring-brand/30"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {formatCurrency(val)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom input */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t("customAmount")}
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    value={
                      customAmount
                        ? Number(customAmount).toLocaleString("vi-VN")
                        : ""
                    }
                    onChange={handleCustomChange}
                    placeholder={t("customPlaceholder")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-extrabold text-navy outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    VND
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("amountLimits")}
                </p>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t("paymentMethodLabel")}
                </label>
                <div className="mt-2 space-y-2">
                  <label
                    onClick={() => setMethod("VNPAYQR")}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all ${
                      method === "VNPAYQR"
                        ? "border-[#005baa] bg-blue-50/70 shadow-sm ring-2 ring-[#005baa]/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#005baa] text-white">
                        <QrCode size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-navy">
                            {t("qrOrVietqr")}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {t("recommended")}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {t("qrOrVietqrHint")}
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={method === "VNPAYQR"}
                      onChange={() => setMethod("VNPAYQR")}
                      className="h-4 w-4 text-[#005baa]"
                    />
                  </label>

                  <label
                    onClick={() => setMethod("ALL")}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all ${
                      method === "ALL"
                        ? "border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-extrabold text-navy">
                          {t("gatewayAll")}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {t("gatewayAllHint")}
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={method === "ALL"}
                      onChange={() => setMethod("ALL")}
                      className="h-4 w-4 text-emerald-600"
                    />
                  </label>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={loading || simulateLoading || !!error || amount < 10000}
                  onClick={handleCreateVNPayQR}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-[#004a8b] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <span>{t("creatingQrPayment")}</span>
                  ) : (
                    <>
                      <QrCode size={18} />
                      <span>{t("createQrTopUp", { amount: formatCurrency(amount) })}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading || simulateLoading || !!error || amount < 10000}
                  onClick={handleSimulateTopUp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                  title={t("simulateHint")}
                >
                  <Sparkles size={14} className="text-emerald-600" />
                  {simulateLoading ? (
                    t("simulating")
                  ) : (
                    t("simulate")
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: MÀN HÌNH QUÉT MÃ QR */}
          {step === "qr_view" && qrData && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("input")}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                >
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                  <Clock size={13} />
                  <span>{t("expiresAfter", { time: timeFormatted })}</span>
                </div>
              </div>

              {/* VNPAY-QR Branding Header */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-xs font-extrabold text-[#005baa]">
                  {t("gatewayBanner")}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {t("gatewayBannerHint")}
                </p>
              </div>

              {/* QR Code Container */}
              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#005baa]/30 bg-white p-4 shadow-inner max-w-[280px]">
                <img
                  src={qrData.qrCodeUrl}
                  alt={t("qrAltLocalBuddy")}
                  className="h-56 w-56 rounded-xl object-contain shadow-sm"
                />
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>{t("qrEncrypted")}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("topUpAmountLabel")}</span>
                  <span className="text-base font-black text-emerald-600">
                    {formatCurrency(qrData.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("orderId")}</span>
                  <span className="font-mono font-bold text-navy">
                    {qrData.orderId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">{t("transferContent")}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#005baa]">
                      LOCALBUDDY {qrData.orderId}
                    </span>
                    <button
                      onClick={() => handleCopy(`LOCALBUDDY ${qrData.orderId}`)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 cursor-pointer"
                      title={t("copyContent")}
                    >
                      {copied ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Checkbox xác nhận đã chuyển khoản */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left cursor-pointer transition-colors hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={hasTransferred}
                  onChange={(e) => setHasTransferred(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 select-none">
                  <Trans t={t} i18nKey="topUpTransferredConfirm" components={{ bold: <b /> }} />
                </span>
              </label>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={!hasTransferred || confirmLoading}
                  onClick={handleConfirmPayment}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-white transition-all ${
                    hasTransferred && !confirmLoading
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 shadow-lg shadow-emerald-900/20 hover:opacity-95 cursor-pointer"
                      : "bg-slate-300 cursor-not-allowed opacity-70"
                  }`}
                >
                  {confirmLoading ? (
                    <span>{t("checkingTransaction")}</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>{t("confirmTopUp")}</span>
                    </>
                  )}
                </button>

                {!hasTransferred && (
                  <p className="text-[11px] text-slate-400">
                    {t("scanFirst")}
                  </p>
                )}

                {qrData.paymentUrl && (
                  <a
                    href={qrData.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span>{t("openGateway")}</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: NẠP TIỀN THÀNH CÔNG */}
          {step === "success" && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 size={44} />
              </div>

              <div>
                <h3 className="text-2xl font-black text-navy">
                  {t("topUpSuccessTitle")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t("topUpSuccessDesc")}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-bold text-emerald-800">
                  {t("amountToppedUp")}
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  +{formatCurrency(amount)}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  <Trans
                    t={t}
                    i18nKey="newBalanceIs"
                    values={{
                      amount: formatCurrency(
                        Number.isFinite(balanceAfterTopUp)
                          ? balanceAfterTopUp
                          : Number(currentBalance) + Number(amount),
                      ),
                    }}
                    components={{ bold: <b className="font-extrabold text-navy" /> }}
                  />
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl bg-brand py-3 text-sm font-black text-white shadow-md hover:bg-brand/90 transition-colors cursor-pointer"
              >
                {t("done")}
              </button>
            </div>
          )}

          {/* TAB LỊCH SỬ GIAO DỊCH */}
          {step === "input" && tab === "history" && (
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {t("loadingHistory")}
                </div>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-9 w-9 place-items-center rounded-xl ${
                          tx.status === "Completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : tx.status === "Pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tx.status === "Completed" ? (
                          <CheckCircle2 size={16} />
                        ) : tx.status === "Pending" ? (
                          <Clock size={16} />
                        ) : (
                          <X size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-navy">
                          {tx.description || t("defaultTxDescription")}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          <Trans
                            t={t}
                            i18nKey="txMeta"
                            values={{
                              date: new Date(tx.createdAt).toLocaleString("vi-VN"),
                              id: tx.orderId || tx._id,
                            }}
                            components={{ mono: <span className="font-mono" /> }}
                          />
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600">
                        +{formatCurrency(tx.amount)}
                      </span>
                      <p
                        className={`text-[10px] font-bold ${
                          tx.status === "Completed"
                            ? "text-emerald-600"
                            : tx.status === "Pending"
                              ? "text-amber-600"
                              : "text-red-500"
                        }`}
                      >
                        {tx.status === "Completed"
                          ? t("statusSuccess")
                          : tx.status === "Pending"
                            ? t("statusPending")
                            : t("statusFailed")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t("noWalletTx")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
