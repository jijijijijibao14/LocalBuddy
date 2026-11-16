import { useState } from "react";
import {
  X,
  Building2,
  CreditCard,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowUpFromLine,
  ShieldAlert,
} from "lucide-react";
import api from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const VIETNAMESE_BANKS = [
  "Vietcombank (VCB)",
  "MB Bank (MB)",
  "Techcombank (TCB)",
  "ACB (Á Châu)",
  "BIDV",
  "VietinBank (CTG)",
  "VPBank",
  "TPBank",
  "Agribank",
  "Sacombank (STB)",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "MSB (Hàng Hải)",
  "Eximbank (EIB)",
  "SeABank",
  "LPBank (Lộc Phát)",
  "Nam A Bank",
  "Bac A Bank",
  "PVcomBank",
  "VietBank",
  "BaoViet Bank",
  "KienlongBank",
  "ABBank",
  "NCB",
  "Saigonbank",
  "Public Bank Việt Nam",
  "Shinhan Bank",
  "Woori Bank",
  "HSBC Việt Nam",
  "Standard Chartered",
];

export default function WithdrawalModal({
  isOpen,
  onClose,
  availableBalance = 0,
  onSuccess,
}) {
  const { formatCurrency } = useLocale();
  const [bankName, setBankName] = useState(VIETNAMESE_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const isAmountValid =
    numAmount >= 1000 && numAmount <= availableBalance;

  function setPercentageAmount(percent) {
    const calculated = Math.floor((availableBalance * percent) / 100);
    setAmount(String(calculated));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!bankName.trim()) {
      setError("Vui lòng chọn ngân hàng.");
      return;
    }
    if (!accountNumber.trim() || !/^\d{6,40}$/.test(accountNumber.trim())) {
      setError("Số tài khoản ngân hàng phải từ 6 đến 40 chữ số.");
      return;
    }
    if (!accountName.trim() || accountName.trim().length < 2) {
      setError("Vui lòng nhập tên chủ tài khoản thụ hưởng.");
      return;
    }
    if (!numAmount || numAmount < 1000) {
      setError("Số tiền rút tối thiểu là 1.000 VNĐ.");
      return;
    }
    if (numAmount > availableBalance) {
      setError("Số tiền rút không được vượt quá số dư khả dụng.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/wallet/withdraw", {
        bankName,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim().toUpperCase(),
        amount: numAmount,
        note: note.trim(),
      });

      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      console.error("Lỗi gửi yêu cầu rút tiền:", err);
      setError(
        err.response?.data?.message ||
          "Không thể tạo yêu cầu rút tiền. Vui lòng thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand/10 text-brand">
              <ArrowUpFromLine size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-navy">
                Yêu cầu rút tiền về tài khoản
              </h3>
              <p className="text-xs text-slate-500">
                Chuyển tiền từ ví LocalBuddy về tài khoản ngân hàng của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance Card */}
        <div className="p-5 sm:p-6 pb-0">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Số dư khả dụng để rút
              </span>
              <p className="text-xl sm:text-2xl font-black text-brand mt-0.5">
                {formatCurrency(availableBalance)}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <span className="font-semibold text-emerald-600 flex items-center gap-1 justify-end">
                <CheckCircle2 size={13} /> Sẵn sàng rút
              </span>
              <span>Xử lý trong 24 giờ</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank selector */}
          <div>
            <label className="block text-xs font-bold text-navy mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-brand" />
              Ngân hàng thụ hưởng
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-navy focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {VIETNAMESE_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-xs font-bold text-navy mb-1.5 flex items-center gap-1.5">
              <CreditCard size={14} className="text-brand" />
              Số tài khoản ngân hàng
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, ""))
              }
              placeholder="Ví dụ: 190365789120"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-navy placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-bold text-navy mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-brand" />
              Tên chủ tài khoản (viết hoa không dấu hoặc có dấu)
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value.toUpperCase())}
              placeholder="Ví dụ: NGUYEN VAN A"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-navy uppercase placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-navy">
                Số tiền muốn rút (VNĐ)
              </label>
              <div className="flex items-center gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentageAmount(pct)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand/10 text-slate-600 hover:text-brand font-bold text-[10px] transition"
                  >
                    {pct === 100 ? "Tối đa" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              required
              min="1000"
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Tối thiểu 1.000 VNĐ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-navy placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-navy mb-1.5">
              Ghi chú thêm (không bắt buộc)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lời nhắn cho Admin nếu có..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-navy placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
            <ShieldAlert size={15} className="shrink-0 text-amber-600 mt-0.5" />
            <span>
              Số tiền rút sẽ được tạm giữ khỏi số dư khả dụng ngay khi bạn gửi yêu
              cầu. Admin sẽ thực hiện chuyển khoản đến số tài khoản này và thông
              báo hoàn tất trong tối đa 24 giờ làm việc.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !isAmountValid}
              className="btn-primary !px-5 !py-2.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Đang gửi yêu cầu..." : "Gửi yêu cầu rút tiền"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

