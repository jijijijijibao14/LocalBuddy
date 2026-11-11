import { useState, useEffect } from "react";
import {
  Wallet,
  QrCode,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";
import { useTranslation, Trans } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

export default function BookingPaymentModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
  onOpenTopUp,
  initialQrData = null,
  initialStep = "select",
}) {
  const { formatCurrency } = useLocale();
  const { t } = useTranslation("payment");
  const [method, setMethod] = useState("Wallet"); // 'Wallet' | 'PAYOS_QR' | 'VNPAY_QR'
  const [step, setStep] = useState(initialStep); // 'select' | 'qr_view' | 'success'
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState(initialQrData);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialQrData) {
        setStep("qr_view");
        setQrData(initialQrData);
        setMethod("PAYOS_QR");
      } else {
        setStep(initialStep || "select");
        setQrData(null);
      }
      setError("");
      setTimeLeft(900);

      // Lấy số dư ví mới nhất
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
  }, [isOpen, booking, initialQrData, initialStep]);

  useEffect(() => {
    let timer;
    if (step === "qr_view" && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Tự động kiểm tra trạng thái thanh toán PayOS (Polling mỗi 2 giây)
  useEffect(() => {
    if (step !== "qr_view" || !qrData || !booking?._id) return;
    const code = qrData.orderCode || qrData.orderId;
    if (!code) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/bookings/${booking._id}/payos-status/${code}`);
        if (!active) return;
        if (data?.completed || data?.booking?.paymentStatus === "Paid") {
          clearInterval(interval);
          setStep("success");
          if (onSuccess) onSuccess(data.booking || booking);
        }
      } catch (e) {
        // bỏ qua lỗi tạm thời khi polling
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, qrData, booking, onSuccess]);

  if (!isOpen || !booking) return null;

  const price = Number(booking.price || 0);
  const isBalanceEnough = walletBalance >= price;

  async function handlePayWithWallet() {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post(`/bookings/${booking._id}/pay-wallet`);
      if (data?.success) {
        // Cập nhật số dư trong localStorage
        try {
          const raw = localStorage.getItem("lb_user");
          if (raw) {
            const u = JSON.parse(raw);
            u.walletBalance = data.newBalance;
            localStorage.setItem("lb_user", JSON.stringify(u));
            window.dispatchEvent(new Event("lb-auth-change"));
          }
        } catch {}

        setStep("success");
        if (onSuccess) onSuccess(data.booking);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || t("errWalletPay"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleInitPayOSQR() {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post(`/bookings/${booking._id}/pay-payos-qr`);
      if (data?.success) {
        setQrData(data);
        setStep("qr_view");
        setTimeLeft(900);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || t("errCreateBookingQr"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPayOSQR() {
    if (!qrData?.orderId && !qrData?.orderCode) return;
    setConfirmLoading(true);
    setError("");

    try {
      const { data } = await api.post(
        `/bookings/${booking._id}/confirm-payos-qr`,
        { orderId: qrData.orderId, orderCode: qrData.orderCode },
      );
      if (data?.success) {
        setStep("success");
        if (onSuccess) onSuccess(data.booking);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || t("errConfirmBookingQr"),
      );
    } finally {
      setConfirmLoading(false);
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
      <div className="relative w-full max-h-[90dvh] max-w-md overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#075f88] via-[#0e7490] to-[#059669] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
            title={t("close")}
          >
            <X size={18} />
          </button>

          <h2 className="text-xl font-black">{t("bookingPayTitle")}</h2>
          <p className="mt-1 text-xs text-white/80">
            <Trans
              t={t}
              i18nKey="experienceWith"
              values={{ name: booking.buddy?.fullName || "Local Buddy" }}
              components={{ bold: <b /> }}
            />
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs text-white/90">{t("servicePrice")}</span>
            <span className="text-lg font-black text-amber-300">
              {formatCurrency(price)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6">
          {/* STEP 1: CHỌN PHƯƠNG THỨC */}
          {step === "select" && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                {t("selectMethod")}
              </label>

              {/* Lựa chọn 1: Ví Local Buddy */}
              <label
                onClick={() => setMethod("Wallet")}
                className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 transition-all ${
                  method === "Wallet"
                    ? "border-brand bg-blue-50/70 shadow-sm ring-2 ring-brand/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shrink-0 mt-0.5">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-navy">
                      {t("walletName")}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      <Trans
                        t={t}
                        i18nKey="currentBalanceIs"
                        values={{ amount: formatCurrency(walletBalance) }}
                        components={{
                          bold: (
                            <b
                              className={
                                isBalanceEnough
                                  ? "text-emerald-600 font-extrabold"
                                  : "text-amber-600 font-extrabold"
                              }
                            />
                          ),
                        }}
                      />
                    </p>
                    {!isBalanceEnough && (
                      <span className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {t("shortBy", { amount: formatCurrency(price - walletBalance) })}
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="radio"
                  name="bookingPayMethod"
                  checked={method === "Wallet"}
                  onChange={() => setMethod("Wallet")}
                  className="h-4 w-4 text-brand mt-1"
                />
              </label>

              {/* Lựa chọn 2: Quét mã PayOS / VietQR */}
              <label
                onClick={() => setMethod("PAYOS_QR")}
                className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 transition-all ${
                  method === "PAYOS_QR" || method === "VNPAY_QR"
                    ? "border-[#005baa] bg-blue-50/70 shadow-sm ring-2 ring-[#005baa]/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#005baa] text-white shrink-0 mt-0.5">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-navy">
                        {t("scanQr", "Quét mã VietQR / PayOS")}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {t("instant", "Tự động")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("scanQrHint", "Mở app Ngân hàng (MB, VCB, Techcombank...) quét mã thanh toán tức thì")}
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="bookingPayMethod"
                  checked={method === "PAYOS_QR" || method === "VNPAY_QR"}
                  onChange={() => setMethod("PAYOS_QR")}
                  className="h-4 w-4 text-[#005baa] mt-1"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Nút hành động */}
              <div className="pt-2 space-y-2">
                {method === "Wallet" ? (
                  isBalanceEnough ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handlePayWithWallet}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-brand/90 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Wallet size={16} />
                      <span>
                        {loading
                          ? t("processing")
                          : t("confirmWalletPay", { amount: formatCurrency(price) })}
                      </span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenTopUp) onOpenTopUp();
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3.5 text-sm font-black text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer"
                      >
                        <Wallet size={16} />
                        <span>{t("topUpNow")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("PAYOS_QR")}
                        className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {t("switchToQr")}
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleInitPayOSQR}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-[#004a8b] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <QrCode size={18} />
                    <span>
                      {loading
                        ? t("creatingQr")
                        : t("createQrPay", { amount: formatCurrency(price) })}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: QUÉT MÃ QR */}
          {step === "qr_view" && qrData && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("select")}
                  className="text-xs font-bold text-slate-500 hover:text-navy cursor-pointer"
                >
                  {t("changeMethod")}
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                  <Clock size={13} />
                  <span>{t("expiresIn", { time: timeFormatted })}</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#005baa]/30 bg-white p-4 shadow-inner max-w-[270px]">
                <img
                  src={qrData.qrCodeUrl}
                  alt={t("qrAlt")}
                  className="h-52 w-52 rounded-xl object-contain shadow-sm"
                />
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>{t("bookingQrCaption")}</span>
                </div>
              </div>

              {/* Chi tiết thanh toán */}
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("amountLabel")}</span>
                  <span className="text-sm font-black text-emerald-600">
                    {formatCurrency(price)}
                  </span>
                </div>
                {qrData.accountNumber && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Số tài khoản / Ngân hàng</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-navy">
                        {qrData.accountNumber} ({qrData.bin === "970422" ? "MBBank" : "VietQR"})
                      </span>
                      <button
                        onClick={() => handleCopy(qrData.accountNumber)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200 cursor-pointer"
                        title="Sao chép số tài khoản"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                )}
                {qrData.accountName && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Chủ tài khoản</span>
                    <span className="font-bold text-slate-700">{qrData.accountName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">{t("transactionId")}</span>
                  <span className="font-mono font-bold text-navy">
                    {qrData.orderCode || qrData.orderId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">{t("contentLabel")}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#005baa]">
                      {qrData.description || `LB BK ${qrData.orderId}`}
                    </span>
                    <button
                      onClick={() => handleCopy(qrData.description || `LB BK ${qrData.orderId}`)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 cursor-pointer"
                      title={t("copyContent")}
                    >
                      {copied ? (
                        <Check size={13} className="text-emerald-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Nút mở trang PayOS trực tiếp nếu có */}
              {qrData.checkoutUrl && (
                <a
                  href={qrData.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 py-2.5 text-xs font-bold text-[#005baa] hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>Mở cổng thanh toán PayOS trên trình duyệt</span>
                </a>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Tự động nhận diện thanh toán */}
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 text-left">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="leading-snug">
                  Đang chờ thanh toán... Hệ thống tự động nhận diện và xác nhận đặt lịch ngay khi bạn chuyển khoản thành công.
                </span>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={handleConfirmPayOSQR}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {confirmLoading ? (
                    <span>{t("checkingTransaction")}</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>{t("confirmBooking")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: THÀNH CÔNG */}
          {step === "success" && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 size={44} />
              </div>

              <div>
                <h3 className="text-2xl font-black text-navy">
                  {t("bookingSuccessTitle")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t("bookingSuccessDesc")}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-bold text-emerald-800">
                  {t("amountPaid")}
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  {formatCurrency(price)}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  <Trans
                    t={t}
                    i18nKey="methodIs"
                    values={{ method: method === "Wallet" ? t("walletName") : t("methodQrGateway") }}
                    components={{ bold: <b /> }}
                  />
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-brand py-3 text-sm font-black text-white shadow-md hover:bg-brand/90 transition-colors cursor-pointer"
              >
                {t("done")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
