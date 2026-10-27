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

export default function BookingPaymentModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
  onOpenTopUp,
  initialQrData = null,
  initialStep = "select",
}) {
  const [method, setMethod] = useState("Wallet"); // 'Wallet' | 'VNPAY_QR'
  const [step, setStep] = useState(initialStep); // 'select' | 'qr_view' | 'success'
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState(initialQrData);
  const [copied, setCopied] = useState(false);
  const [hasTransferred, setHasTransferred] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialQrData) {
        setStep("qr_view");
        setQrData(initialQrData);
        setMethod("VNPAY_QR");
      } else {
        setStep(initialStep || "select");
        setQrData(null);
      }
      setError("");
      setHasTransferred(false);
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
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

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
        err.response?.data?.message || "Không thể thanh toán bằng ví lúc này.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleInitVNPayQR() {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post(`/bookings/${booking._id}/pay-vnpay-qr`);
      if (data?.success) {
        setQrData(data);
        setStep("qr_view");
        setTimeLeft(900);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể tạo mã VNPAY-QR thanh toán.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmVNPayQR() {
    if (!qrData?.orderId) return;
    setConfirmLoading(true);
    setError("");

    try {
      const { data } = await api.post(
        `/bookings/${booking._id}/confirm-vnpay-qr`,
        { orderId: qrData.orderId },
      );
      if (data?.success) {
        setStep("success");
        if (onSuccess) onSuccess(data.booking);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Lỗi xác nhận thanh toán VNPAY-QR.",
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
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#075f88] via-[#0e7490] to-[#059669] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>

          <h2 className="text-xl font-black">Thanh toán phí đặt lịch</h2>
          <p className="mt-1 text-xs text-white/80">
            Trải nghiệm cùng Local:{" "}
            <b>{booking.buddy?.fullName || "Local Buddy"}</b>
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs text-white/90">Chi phí dịch vụ:</span>
            <span className="text-lg font-black text-amber-300">
              {price.toLocaleString("vi-VN")} đ
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6">
          {/* STEP 1: CHỌN PHƯƠNG THỨC */}
          {step === "select" && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Chọn phương thức thanh toán:
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
                      Ví Local Buddy
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      Số dư hiện có:{" "}
                      <b
                        className={
                          isBalanceEnough
                            ? "text-emerald-600 font-extrabold"
                            : "text-amber-600 font-extrabold"
                        }
                      >
                        {walletBalance.toLocaleString("vi-VN")} đ
                      </b>
                    </p>
                    {!isBalanceEnough && (
                      <span className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Thiếu {(price - walletBalance).toLocaleString("vi-VN")} đ
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

              {/* Lựa chọn 2: Quét mã VNPAY-QR */}
              <label
                onClick={() => setMethod("VNPAY_QR")}
                className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 transition-all ${
                  method === "VNPAY_QR"
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
                        Quét mã VNPAY-QR
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Tức thì
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Quét mã QR qua ứng dụng Ngân hàng (VCB, MB, Techcom, BIDV...) hoặc Ví VNPAY
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="bookingPayMethod"
                  checked={method === "VNPAY_QR"}
                  onChange={() => setMethod("VNPAY_QR")}
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
                          ? "Đang xử lý..."
                          : `Xác nhận trừ ví ${price.toLocaleString("vi-VN")} đ`}
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
                        <span>Nạp thêm tiền vào ví ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("VNPAY_QR")}
                        className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Hoặc chuyển sang quét mã VNPAY-QR
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleInitVNPayQR}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-[#004a8b] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <QrCode size={18} />
                    <span>
                      {loading
                        ? "Đang tạo mã QR..."
                        : `Tạo mã VNPAY-QR thanh toán ${price.toLocaleString("vi-VN")} đ`}
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
                  ← Đổi phương thức
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                  <Clock size={13} />
                  <span>Hết hạn: {timeFormatted}</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#005baa]/30 bg-white p-4 shadow-inner max-w-[270px]">
                <img
                  src={qrData.qrCodeUrl}
                  alt="Mã QR VNPAY"
                  className="h-52 w-52 rounded-xl object-contain shadow-sm"
                />
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Mã QR thanh toán đặt lịch VNPAY</span>
                </div>
              </div>

              {/* Chi tiết thanh toán */}
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Số tiền:</span>
                  <span className="text-sm font-black text-emerald-600">
                    {price.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Mã giao dịch:</span>
                  <span className="font-mono font-bold text-navy">
                    {qrData.orderId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Nội dung:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#005baa]">
                      LOCALBUDDY {qrData.orderId}
                    </span>
                    <button
                      onClick={() => handleCopy(`LOCALBUDDY ${qrData.orderId}`)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 cursor-pointer"
                      title="Sao chép nội dung"
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

              {/* Checkbox xác nhận */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left cursor-pointer transition-colors hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={hasTransferred}
                  onChange={(e) => setHasTransferred(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 select-none">
                  Tôi đã mở app Ngân hàng / Ví VNPAY và <b>hoàn tất thanh toán</b> cho lịch đặt này.
                </span>
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={!hasTransferred || confirmLoading}
                  onClick={handleConfirmVNPayQR}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-white transition-all ${
                    hasTransferred && !confirmLoading
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 shadow-lg shadow-emerald-900/20 hover:opacity-95 cursor-pointer"
                      : "bg-slate-300 cursor-not-allowed opacity-70"
                  }`}
                >
                  {confirmLoading ? (
                    <span>Đang kiểm tra giao dịch...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Đã chuyển tiền, xác nhận đặt lịch</span>
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
                  Thanh toán thành công!
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Khoản phí đặt lịch đã được ghi nhận. Local Buddy sẽ liên hệ và chuẩn bị trải nghiệm cho bạn.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-bold text-emerald-800">
                  Số tiền đã thanh toán
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  {price.toLocaleString("vi-VN")} đ
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Phương thức:{" "}
                  <b>
                    {method === "Wallet" ? "Ví Local Buddy" : "Cổng VNPAY-QR"}
                  </b>
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-brand py-3 text-sm font-black text-white shadow-md hover:bg-brand/90 transition-colors cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
