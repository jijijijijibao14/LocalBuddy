import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Wallet,
  ArrowRight,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Calendar,
  Hash,
} from "lucide-react";
import api from "../services/api";

function formatVnPayDate(dateStr) {
  if (!dateStr || dateStr.length !== 14) return dateStr || "";
  // YYYYMMDDHHmmss -> DD/MM/YYYY HH:mm:ss
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = dateStr.slice(8, 10);
  const minute = dateStr.slice(10, 12);
  const second = dateStr.slice(12, 14);
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

export default function VNPayReturnPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function verifyPayment() {
      if (!location.search) {
        setError("Không tìm thấy thông tin phản hồi từ cổng thanh toán VNPAY.");
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/wallet/vnpay/return${location.search}`);
        setResult(data);

        // Cập nhật số dư mới vào localStorage
        try {
          const rawUser = localStorage.getItem("lb_user");
          if (rawUser) {
            const user = JSON.parse(rawUser);
            user.walletBalance = data.newBalance;
            localStorage.setItem("lb_user", JSON.stringify(user));
            window.dispatchEvent(new Event("lb-auth-change"));
          }
        } catch (e) {
          console.warn("Không thể lưu cache user:", e);
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Xác thực thanh toán thất bại hoặc giao dịch đã bị hủy.",
        );
        if (err.response?.data) {
          setResult(err.response.data);
        }
      } finally {
        setLoading(false);
      }
    }

    verifyPayment();
  }, [location.search]);

  // Xác định đường dẫn dashboard theo role
  let dashboardLink = "/dashboard";
  try {
    const u = JSON.parse(localStorage.getItem("lb_user") || "{}");
    if (u?.role === "local") dashboardLink = "/local-dashboard";
    else if (u?.role === "admin") dashboardLink = "/admin";
  } catch {}

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-xl">
        {loading ? (
          <div className="panel p-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-brand animate-spin">
              <RefreshCw size={28} />
            </div>
            <h2 className="mt-5 text-xl font-black text-navy">
              Đang xác thực thanh toán với VNPAY...
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Vui lòng không tắt hoặc tải lại trang trong khi hệ thống đang xử lý.
            </p>
          </div>
        ) : result?.success ? (
          /* Trạng thái THÀNH CÔNG */
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl border border-emerald-100">
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-[#075f88] p-8 text-center text-white">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20 shadow-inner">
                <CheckCircle2 size={44} className="text-white" />
              </div>
              <span className="mt-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-emerald-100">
                Thanh toán VNPAY-QR thành công
              </span>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Nạp tiền thành công!
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                Số tiền đã được cộng trực tiếp vào ví Local Buddy của bạn.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {/* Card số tiền */}
              <div className="rounded-2xl bg-emerald-50/80 p-5 border border-emerald-100 text-center">
                <p className="text-xs font-bold text-emerald-800">
                  Số tiền đã nạp
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-700">
                  +{Number(result.amount || 0).toLocaleString("vi-VN")} đ
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-600">
                  <Wallet size={14} className="text-brand" />
                  <span>Số dư ví hiện tại:</span>
                  <b className="font-extrabold text-navy">
                    {Number(result.newBalance || 0).toLocaleString("vi-VN")} đ
                  </b>
                </div>
              </div>

              {/* Thông tin chi tiết */}
              <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Hash size={13} /> Mã giao dịch hệ thống:
                  </span>
                  <span className="font-mono font-bold text-navy">
                    {result.orderId}
                  </span>
                </div>

                {result.transactionNo && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <QrCode size={13} /> Mã giao dịch VNPAY:
                    </span>
                    <span className="font-mono font-bold text-navy">
                      {result.transactionNo}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck size={13} /> Phương thức:
                  </span>
                  <span className="font-bold text-navy">
                    {result.bankCode === "VNPAYQR"
                      ? "Cổng VNPAY-QR"
                      : `VNPAY (${result.bankCode || "Thẻ/Ví"})`}
                  </span>
                </div>

                {result.payDate && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar size={13} /> Thời gian giao dịch:
                    </span>
                    <span className="font-bold text-slate-700">
                      {formatVnPayDate(result.payDate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Nút hành động */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={dashboardLink}
                  className="btn-primary flex-1 justify-center !py-3 text-sm font-black"
                >
                  <span>Quay về trang cá nhân</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/#discover"
                  className="btn-light flex-1 justify-center !py-3 text-sm font-bold"
                >
                  Tìm Local Buddy ngay
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Trạng thái THẤT BẠI / HỦY */
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl border border-red-100">
            <div className="bg-gradient-to-br from-red-600 via-rose-600 to-amber-700 p-8 text-center text-white">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20 shadow-inner">
                <XCircle size={44} className="text-white" />
              </div>
              <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">
                Giao dịch chưa hoàn tất
              </h1>
              <p className="mt-1 text-sm text-red-100">
                Giao dịch nạp tiền qua VNPAY đã bị hủy hoặc không thành công.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100 text-xs text-red-800">
                <p className="font-bold">Chi tiết lỗi:</p>
                <p className="mt-1 leading-relaxed">
                  {error ||
                    result?.message ||
                    "Giao dịch không thành công hoặc bạn đã hủy trong quá trình thanh toán."}
                </p>
              </div>

              {result?.orderId && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Mã giao dịch: <span className="font-mono">{result.orderId}</span>
                </p>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={dashboardLink}
                  className="btn-primary flex-1 justify-center !py-3 text-sm font-black"
                >
                  <span>Quay lại trang cá nhân</span>
                </Link>
                <button
                  onClick={() => navigate(dashboardLink)}
                  className="btn-light flex-1 justify-center !py-3 text-sm font-bold"
                >
                  Thử nạp lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
