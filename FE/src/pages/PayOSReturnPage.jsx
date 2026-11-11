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
  Hash,
} from "lucide-react";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { useLocale } from "../contexts/LocaleContext";

export default function PayOSReturnPage() {
  const { formatCurrency } = useLocale();
  const { t } = useTranslation("vnpayReturn");
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function verifyPayment() {
      if (!location.search) {
        setError(t("errNoParams", "Không tìm thấy thông tin phản hồi từ cổng thanh toán."));
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/wallet/payos/return${location.search}`);
        setResult(data);

        // Cập nhật số dư mới vào localStorage nếu là nạp ví
        if (data?.newBalance != null) {
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
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            t("errVerifyFailed", "Không thể xác thực giao dịch."),
        );
        if (err.response?.data) {
          setResult(err.response.data);
        }
      } finally {
        setLoading(false);
      }
    }

    verifyPayment();
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {t("verifying", "Đang xác thực thanh toán với PayOS...")}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              {t("doNotClose", "Vui lòng không đóng trình duyệt trong khi hệ thống xác nhận giao dịch.")}
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
                {t("successBadge", "Thanh toán PayOS thành công")}
              </span>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {result?.message || t("successTitle", "Giao dịch thành công!")}
              </h1>
              <p className="mt-1 text-sm text-emerald-100">
                {t("successDesc", "Hệ thống đã ghi nhận khoản thanh toán của bạn.")}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {result.amount && (
                <div className="rounded-2xl bg-emerald-50/80 p-5 border border-emerald-100 text-center">
                  <p className="text-xs font-bold text-emerald-800">
                    {t("amountToppedUp", "Số tiền thanh toán")}
                  </p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">
                    +{formatCurrency(result.amount || 0)}
                  </p>
                  {result.newBalance != null && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-600">
                      <Wallet size={14} className="text-brand" />
                      <span>{t("currentBalance", "Số dư ví hiện tại:")}</span>
                      <b className="font-extrabold text-navy">
                        {formatCurrency(result.newBalance)}
                      </b>
                    </div>
                  )}
                </div>
              )}

              {/* Thông tin chi tiết */}
              <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Hash size={13} /> {t("systemOrderId", "Mã đơn hàng PayOS")}
                  </span>
                  <span className="font-mono font-bold text-navy">
                    {result.orderCode || result.orderId}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck size={13} /> {t("method", "Phương thức")}
                  </span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <QrCode size={13} /> Cổng thanh toán PayOS / VietQR
                  </span>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={dashboardLink}
                  className="btn-primary flex-1 justify-center !py-3 text-sm font-black"
                >
                  <span>{t("backToProfile", "Về trang điều khiển")}</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/#discover"
                  className="btn-light flex-1 justify-center !py-3 text-sm font-bold"
                >
                  {t("findBuddy", "Khám phá Local Buddy")}
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
                {t("failedTitle", "Thanh toán chưa hoàn tất")}
              </h1>
              <p className="mt-1 text-sm text-red-100">
                {result?.message || t("failedDesc", "Giao dịch qua PayOS đã bị hủy hoặc chưa hoàn tất.")}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100 text-xs text-red-800">
                <p className="font-bold">{t("errorDetails", "Chi tiết")}</p>
                <p className="mt-1 leading-relaxed">
                  {error || result?.message || t("defaultFailure", "Vui lòng thử lại hoặc chọn phương thức thanh toán khác.")}
                </p>
              </div>

              {(result?.orderCode || result?.orderId) && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Mã đơn hàng: <span className="font-mono">{result.orderCode || result.orderId}</span>
                </p>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={dashboardLink}
                  className="btn-primary flex-1 justify-center !py-3 text-sm font-black"
                >
                  <span>{t("backToProfileAgain", "Về trang điều khiển")}</span>
                </Link>
                <button
                  onClick={() => navigate(dashboardLink)}
                  className="btn-light flex-1 justify-center !py-3 text-sm font-bold cursor-pointer"
                >
                  {t("retry", "Thử lại")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

