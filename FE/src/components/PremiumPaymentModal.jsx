import { useEffect, useState, useRef } from "react";
import {
  X,
  Crown,
  QrCode,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";
import api from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export default function PremiumPaymentModal({
  isOpen,
  onClose,
  plan,
  commissions = { standard: 15, premium: 10 },
  onSuccess,
}) {
  const { formatCurrency } = useLocale();
  const standardRate = commissions?.standard ?? plan?.commissions?.standard ?? 15;
  const premiumRate = commissions?.premium ?? plan?.commissions?.premium ?? 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentData, setPaymentData] = useState(null);
  const [copiedField, setCopiedField] = useState("");
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [pollingStatus, setPollingStatus] = useState("idle"); // idle | checking | completed
  const pollTimerRef = useRef(null);

  // Khởi tạo đơn thanh toán
  async function createPayment() {
    if (!plan) return;
    setLoading(true);
    setError("");
    setPaymentData(null);
    setIsPaidSuccess(false);

    try {
      const res = await api.post("/premium/subscribe", {
        packageId: plan.id,
      });
      setPaymentData(res.data);
    } catch (err) {
      console.error("Lỗi tạo đơn thanh toán Premium:", err);
      setError(
        err.response?.data?.message ||
          "Không thể tạo mã thanh toán PayOS. Vui lòng thử lại sau ít phút."
      );
    } finally {
      setLoading(false);
    }
  }

  // Khởi chạy khi modal mở
  useEffect(() => {
    if (isOpen && plan) {
      createPayment();
    } else {
      setPaymentData(null);
      setIsPaidSuccess(false);
      setError("");
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, plan]);

  // Polling tự động kiểm tra trạng thái thanh toán
  useEffect(() => {
    if (!paymentData?.orderCode || isPaidSuccess) return;

    async function checkStatus() {
      try {
        setPollingStatus("checking");
        const res = await api.get(`/premium/status/${paymentData.orderCode}`);
        if (res.data?.completed || res.data?.status === "PAID") {
          setIsPaidSuccess(true);
          setPollingStatus("completed");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (onSuccess) {
            onSuccess(res.data);
          }
        }
      } catch (e) {
        // im lặng bỏ qua lỗi mạng tạm thời trong lúc poll
      } finally {
        setPollingStatus("idle");
      }
    }

    pollTimerRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [paymentData?.orderCode, isPaidSuccess, onSuccess]);

  function copyToClipboard(text, fieldName) {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(""), 2000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-amber-200 flex flex-col">
        {/* Header */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-amber-950 rounded-t-3xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-950/15">
              <Crown size={20} className="fill-amber-950" />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-950 leading-tight">
                Thanh toán Local Premium
              </h3>
              <p className="text-xs font-semibold text-amber-900/80">
                {plan?.name} • {formatCurrency(plan?.price || 0)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-amber-950 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {loading && (
            <div className="py-14 text-center">
              <RefreshCw
                size={36}
                className="mx-auto text-amber-500 animate-spin"
              />
              <p className="mt-4 text-sm font-bold text-navy">
                Đang khởi tạo mã QR thanh toán PayOS...
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng đợi trong giây lát
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
              <p className="text-sm font-bold text-rose-800">{error}</p>
              <button
                type="button"
                onClick={createPayment}
                className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
              >
                Thử tạo lại mã thanh toán
              </button>
            </div>
          )}

          {isPaidSuccess && (
            <div className="py-8 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-xl font-black text-navy">
                  Kích hoạt Local Premium thành công!
                </h4>
                <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
                  Chúc mừng bạn! Hồ sơ Local của bạn đã nhận được huy hiệu vàng 👑
                  và được ưu tiên hiển thị top đầu kết quả tìm kiếm ngay lập tức.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 inline-block text-left text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <ShieldCheck size={16} className="text-amber-600" />
                  <span>Hoa hồng sàn áp dụng: {premiumRate}% (tiết kiệm so với {standardRate}% thông thường)</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Zap size={16} className="text-amber-600" />
                  <span>Ưu tiên tìm kiếm: Kích hoạt</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-brand text-white font-bold text-xs shadow-md hover:bg-brand-dark transition"
                >
                  Xác nhận & Hoàn tất
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !isPaidSuccess && paymentData && (
            <>
              {/* QR Code Container */}
              <div className="text-center p-5 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white border-2 border-amber-200/80 shadow-inner">
                <div className="inline-block p-3 rounded-2xl bg-white shadow-md border border-slate-100">
                  {paymentData.qrCodeUrl ? (
                    <img
                      src={paymentData.qrCodeUrl}
                      alt="VietQR PayOS"
                      className="w-56 h-56 mx-auto object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                      <QrCode size={48} />
                      <span className="text-xs mt-2">Chưa tải được mã QR</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <p className="text-xs font-bold text-slate-700">
                    Hệ thống đang tự động nhận diện thanh toán...
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mở ứng dụng Ngân hàng bất kỳ để quét mã VietQR ở trên
                </p>
              </div>

              {/* Bank Details Table */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold text-navy">
                    {paymentData.bin === "970422" || paymentData.bin === "MB"
                      ? "MB Bank (Ngân hàng Quân Đội)"
                      : "Ngân hàng thụ hưởng"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5 font-bold text-navy">
                    <span>{paymentData.accountNumber}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(paymentData.accountNumber, "acc")
                      }
                      className="p-1 hover:text-amber-600 transition"
                      title="Sao chép"
                    >
                      {copiedField === "acc" ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Tên người thụ hưởng:</span>
                  <span className="font-bold text-navy">
                    {paymentData.accountName || "CONG TY LOCALBUDDY"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Số tiền:</span>
                  <div className="flex items-center gap-1.5 font-black text-amber-600 text-sm">
                    <span>{formatCurrency(paymentData.amount)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(paymentData.amount, "amount")
                      }
                      className="p-1 hover:text-amber-600 transition text-slate-500"
                      title="Sao chép số tiền"
                    >
                      {copiedField === "amount" ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                  <span className="text-amber-800 font-medium">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 font-mono">
                    <span>{paymentData.description}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(paymentData.description, "desc")
                      }
                      className="p-1 hover:text-amber-600 transition text-amber-900"
                      title="Sao chép nội dung"
                    >
                      {copiedField === "desc" ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Checkout link button */}
              {paymentData.checkoutUrl && (
                <div className="pt-1">
                  <a
                    href={paymentData.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/40 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <span>Mở cổng thanh toán PayOS trên trình duyệt</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-200/60 transition"
          >
            Hủy & Đóng
          </button>

          {!isPaidSuccess && paymentData && (
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await api.get(
                    `/premium/status/${paymentData.orderCode}`
                  );
                  if (res.data?.completed || res.data?.status === "PAID") {
                    setIsPaidSuccess(true);
                    if (onSuccess) onSuccess(res.data);
                  } else {
                    alert(
                      "Chưa nhận được thanh toán từ PayOS. Vui lòng hoàn tất chuyển khoản hoặc chờ thêm vài giây."
                    );
                  }
                } catch {
                  alert("Không thể kiểm tra giao dịch lúc này.");
                } finally {
                  setLoading(false);
                }
              }}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Kiểm tra giao dịch</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

