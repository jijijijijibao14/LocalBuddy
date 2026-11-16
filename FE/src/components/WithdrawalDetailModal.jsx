import { useState } from "react";
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Building2,
  CreditCard,
  User,
  Calendar,
  FileText,
  Edit2,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import api from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const STATUS_BADGES = {
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
    label: "Đã hoàn tất",
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

export default function WithdrawalDetailModal({
  isOpen,
  onClose,
  withdrawal,
  availableBalance = 0,
  isUserView = true,
  onUpdated,
}) {
  const { formatCurrency, formatDateTime } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    amount: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !withdrawal) return null;

  const currentStatus = STATUS_BADGES[withdrawal.status] || STATUS_BADGES.Pending;
  const StatusIcon = currentStatus.icon;

  function startEdit() {
    setEditData({
      bankName: withdrawal.bankName || "",
      accountNumber: withdrawal.accountNumber || "",
      accountName: withdrawal.accountName || "",
      amount: String(withdrawal.amount || ""),
      note: withdrawal.note || "",
    });
    setError("");
    setIsEditing(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.patch(`/wallet/withdrawals/${withdrawal._id}`, {
        bankName: editData.bankName,
        accountNumber: editData.accountNumber.trim(),
        accountName: editData.accountName.trim().toUpperCase(),
        amount: Number(editData.amount),
        note: editData.note.trim(),
      });
      setIsEditing(false);
      if (onUpdated) onUpdated(res.data.withdrawal);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể cập nhật yêu cầu rút tiền."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!window.confirm("Bạn có chắc chắn muốn hủy yêu cầu rút tiền này? Số tiền tạm giữ sẽ được hoàn lại ngay vào số dư khả dụng.")) {
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await api.patch(`/wallet/withdrawals/${withdrawal._id}/cancel`, {
        reason: "Người dùng hủy yêu cầu rút tiền",
      });
      if (onUpdated) onUpdated(res.data.withdrawal);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể hủy yêu cầu rút tiền.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${currentStatus.className}`}
            >
              <StatusIcon size={14} />
              {currentStatus.label}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              #{String(withdrawal._id).slice(-6).toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Display */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Số tiền rút
              </span>
              <p className="text-2xl font-black text-brand mt-0.5">
                {formatCurrency(withdrawal.amount)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <span>Ngày tạo:</span>
              <p className="font-semibold text-navy mt-0.5">
                {formatDateTime(withdrawal.createdAt)}
              </p>
            </div>
          </div>

          {/* Edit Form or Information Card */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-3.5 p-4 rounded-2xl border border-amber-200 bg-amber-50/30">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">
                Chỉnh sửa thông tin nhận tiền
              </h4>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">Ngân hàng</label>
                <input
                  type="text"
                  required
                  value={editData.bankName}
                  onChange={(e) => setEditData({ ...editData, bankName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">Số tài khoản</label>
                <input
                  type="text"
                  required
                  value={editData.accountNumber}
                  onChange={(e) => setEditData({ ...editData, accountNumber: e.target.value.replace(/\D/g, "") })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">Tên chủ tài khoản</label>
                <input
                  type="text"
                  required
                  value={editData.accountName}
                  onChange={(e) => setEditData({ ...editData, accountName: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Số tiền muốn rút (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  max={availableBalance + withdrawal.amount}
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">Ghi chú</label>
                <input
                  type="text"
                  value={editData.note}
                  onChange={(e) => setEditData({ ...editData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy sửa
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary !px-4 !py-1.5 text-xs font-bold"
                >
                  {loading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Ngân hàng</span>
                  <span className="font-bold text-navy flex items-center gap-1.5">
                    <Building2 size={13} className="text-brand" />
                    {withdrawal.bankName}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Số tài khoản</span>
                  <span className="font-bold text-navy flex items-center gap-1.5 font-mono">
                    <CreditCard size={13} className="text-brand" />
                    {withdrawal.accountNumber}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <span className="text-slate-400 block mb-0.5">Chủ tài khoản thụ hưởng</span>
                  <span className="font-black text-navy uppercase flex items-center gap-1.5">
                    <User size={13} className="text-brand" />
                    {withdrawal.accountName}
                  </span>
                </div>
              </div>

              {withdrawal.note && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 block mb-0.5">Ghi chú của bạn</span>
                  <p className="text-slate-700 italic">"{withdrawal.note}"</p>
                </div>
              )}
            </div>
          )}

          {/* Transfer Confirmation Details for Completed */}
          {withdrawal.status === "Completed" && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-black text-emerald-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Chuyển khoản thành công từ Ban quản trị LocalBuddy</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-emerald-950">
                <div>
                  <span className="text-emerald-700 block">Mã giao dịch ngân hàng:</span>
                  <span className="font-mono font-bold">{withdrawal.bankTransactionCode || "Đã xác nhận"}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block">Ngày chuyển tiền:</span>
                  <span className="font-bold">{formatDateTime(withdrawal.transferDate || withdrawal.completedAt)}</span>
                </div>
              </div>
              {withdrawal.adminNote && (
                <div className="pt-1 text-emerald-800">
                  <span className="font-semibold">Ghi chú Admin: </span>
                  <span>{withdrawal.adminNote}</span>
                </div>
              )}
            </div>
          )}

          {/* Rejection Details for Rejected */}
          {withdrawal.status === "Rejected" && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-black text-rose-900">
                <AlertCircle size={16} className="text-rose-600" />
                <span>Yêu cầu rút tiền bị từ chối</span>
              </div>
              <p className="text-rose-800">
                <span className="font-bold">Lý do từ chối: </span>
                {withdrawal.rejectionReason}
              </p>
              <p className="text-[11px] text-rose-700/80">
                Số tiền {formatCurrency(withdrawal.amount)} đã được hoàn lại đầy đủ vào số dư khả dụng của bạn.
              </p>
            </div>
          )}

          {/* Audit History Timeline */}
          {withdrawal.history?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Lịch sử xử lý yêu cầu
              </h4>
              <div className="space-y-2.5">
                {withdrawal.history.map((h, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5"></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy">{h.action}</span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(h.timestamp)}
                        </span>
                      </div>
                      {h.note && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{h.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 rounded-b-3xl">
          {/* User actions while Pending */}
          {isUserView && withdrawal.status === "Pending" && !isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand text-slate-700 hover:text-brand font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Edit2 size={13} />
                <span>Chỉnh sửa</span>
              </button>
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Trash2 size={13} />
                <span>Hủy yêu cầu</span>
              </button>
            </div>
          ) : (
            <div></div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition ml-auto"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

