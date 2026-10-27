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

const PRESET_AMOUNTS = [
  50000, 100000, 200000, 500000, 1000000, 2000000,
];

export default function WalletTopUpModal({
  isOpen,
  onClose,
  currentBalance = 0,
  onSuccess,
}) {
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
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  if (!isOpen) return null;

  function resetModal() {
    setStep("input");
    setQrData(null);
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
      setError("Số tiền nạp tối thiểu là 10.000 đ");
    } else if (num > 50000000) {
      setError("Số tiền nạp tối đa mỗi lần là 50.000.000 đ");
    } else {
      setError("");
    }
  }

  async function handleCreateVNPayQR() {
    if (amount < 10000) {
      setError("Vui lòng nạp tối thiểu 10.000 đ");
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
        setError("Không nhận được mã thanh toán từ máy chủ.");
      }
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Không thể khởi tạo mã QR thanh toán. Vui lòng thử lại sau.",
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
        if (onSuccess) onSuccess(data.newBalance);
        setStep("success");
      }
    } catch (e) {
      setError(
        e.response?.data?.message || "Không thể xác nhận giao dịch. Vui lòng thử lại.",
      );
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleSimulateTopUp() {
    if (amount < 10000) {
      setError("Vui lòng nạp tối thiểu 10.000 đ");
      return;
    }
    setError("");
    setSimulateLoading(true);

    try {
      const { data } = await api.post("/wallet/simulate-topup", { amount });
      if (data?.success) {
        if (onSuccess) onSuccess(data.newBalance);
        handleClose();
        alert(
          `🎉 ${data.message}\nSố dư ví mới: ${Number(data.newBalance).toLocaleString("vi-VN")} đ`,
        );
      }
    } catch (e) {
      setError(e.response?.data?.message || "Lỗi mô phỏng nạp tiền.");
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
            title="Đóng"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
              <QrCode size={22} className="text-white" />
            </span>
            <div>
              <h2 className="text-xl font-black">Nạp tiền vào Ví Local Buddy</h2>
              <p className="text-xs text-white/80">
                Thanh toán an toàn, tức thì qua cổng VNPAY-QR
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs text-white/90">Số dư hiện tại</span>
            <span className="text-lg font-black text-amber-300">
              {Number(currentBalance).toLocaleString("vi-VN")} đ
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
                <QrCode size={14} /> Nạp tiền qua VNPAY-QR
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex items-center gap-1.5 pb-2 text-xs font-bold transition-colors cursor-pointer ${
                  tab === "history"
                    ? "border-b-2 border-white text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <History size={14} /> Lịch sử giao dịch ví
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
                  Chọn nhanh số tiền nạp:
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
                        {val.toLocaleString("vi-VN")} đ
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom input */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Hoặc nhập số tiền tùy chọn:
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
                    placeholder="VD: 500.000"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-extrabold text-navy outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    VND
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tối thiểu: 10.000 đ · Tối đa: 50.000.000 đ
                </p>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Phương thức thanh toán:
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
                            Quét mã VNPAY-QR / VietQR
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Khuyên dùng
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Mở app Ngân hàng (VCB, MB, BIDV, Techcombank...) hoặc Ví VNPAY quét mã tức thì
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
                          Cổng VNPAY Đa phương thức (Web)
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Chuyển sang trang VNPAY (Thẻ ATM nội địa, Visa/Mastercard)
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
                    <span>Đang tạo mã QR thanh toán...</span>
                  ) : (
                    <>
                      <QrCode size={18} />
                      <span>Tạo mã VNPAY-QR nạp {amount.toLocaleString("vi-VN")} đ</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading || simulateLoading || !!error || amount < 10000}
                  onClick={handleSimulateTopUp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Test nạp tiền ngay lập tức mà không cần quét mã thật"
                >
                  <Sparkles size={14} className="text-emerald-600" />
                  {simulateLoading ? (
                    "Đang nạp thử nghiệm..."
                  ) : (
                    "Nạp nhanh thử nghiệm (Sandbox Test 1s)"
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
                  <ArrowLeft size={14} /> Quay lại
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                  <Clock size={13} />
                  <span>Hết hạn sau: {timeFormatted}</span>
                </div>
              </div>

              {/* VNPAY-QR Branding Header */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-xs font-extrabold text-[#005baa]">
                  CỔNG THANH TOÁN VNPAY-QR
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Mở app Ngân hàng hoặc Ví VNPAY để quét mã thanh toán
                </p>
              </div>

              {/* QR Code Container */}
              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#005baa]/30 bg-white p-4 shadow-inner max-w-[280px]">
                <img
                  src={qrData.qrCodeUrl}
                  alt="Mã QR VNPAY Local Buddy"
                  className="h-56 w-56 rounded-xl object-contain shadow-sm"
                />
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Mã QR mã hóa chuẩn VNPAY-QR</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Số tiền nạp:</span>
                  <span className="text-base font-black text-emerald-600">
                    {Number(qrData.amount).toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Mã đơn hàng:</span>
                  <span className="font-mono font-bold text-navy">
                    {qrData.orderId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Nội dung chuyển khoản:</span>
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
                  Tôi đã mở app Ngân hàng / Ví VNPAY và <b>hoàn tất chuyển khoản đúng số tiền và nội dung</b> ở trên.
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
                    <span>Đang kiểm tra giao dịch...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Đã chuyển tiền, xác nhận nạp ví</span>
                    </>
                  )}
                </button>

                {!hasTransferred && (
                  <p className="text-[11px] text-slate-400">
                    Vui lòng quét mã chuyển khoản trước khi nhấn xác nhận.
                  </p>
                )}

                {qrData.paymentUrl && (
                  <a
                    href={qrData.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span>Mở cổng VNPAY trên trình duyệt</span>
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
                  Nạp tiền thành công!
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Số tiền đã được cộng trực tiếp vào ví Local Buddy của bạn.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-bold text-emerald-800">
                  Số tiền vừa nạp
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  +{Number(amount).toLocaleString("vi-VN")} đ
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Số dư ví mới:{" "}
                  <b className="font-extrabold text-navy">
                    {(Number(currentBalance) + Number(amount)).toLocaleString("vi-VN")} đ
                  </b>
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl bg-brand py-3 text-sm font-black text-white shadow-md hover:bg-brand/90 transition-colors cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          )}

          {/* TAB LỊCH SỬ GIAO DỊCH */}
          {step === "input" && tab === "history" && (
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Đang tải lịch sử giao dịch...
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
                          {tx.description || "Nạp tiền ví"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleString("vi-VN")} · Mã:{" "}
                          <span className="font-mono">{tx.orderId || tx._id}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600">
                        +{Number(tx.amount).toLocaleString("vi-VN")} đ
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
                          ? "Thành công"
                          : tx.status === "Pending"
                            ? "Đang chờ"
                            : "Thất bại"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có giao dịch ví nào.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
