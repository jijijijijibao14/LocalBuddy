import { X, CheckCircle2, Crown, Sparkles, TrendingUp, ShieldCheck, Zap } from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";

export default function PremiumBenefitsModal({
  isOpen,
  onClose,
  plan,
  onProceedToPayment,
}) {
  const { formatCurrency } = useLocale();

  if (!isOpen || !plan) return null;

  const keyBenefits = [
    {
      icon: TrendingUp,
      title: "Ưu tiên hiển thị top đầu tìm kiếm",
      description: "Hồ sơ của bạn luôn xuất hiện ở những vị trí đầu tiên khi du khách tìm kiếm Local tại Đà Nẵng, giúp tăng lượng click vượt trội.",
    },
    {
      icon: Crown,
      title: "Huy hiệu vàng 👑 Local Premium",
      description: "Tạo sự uy tín và niềm tin tuyệt đối với du khách nhờ huy hiệu chứng nhận Local Premium trên ảnh đại diện và hồ sơ cá nhân.",
    },
    {
      icon: Zap,
      title: "Giảm phí hoa hồng sàn",
      description: "Chỉ chịu mức hoa hồng 10% thay vì 15% tiêu chuẩn. Tối ưu thu nhập trên mỗi chuyến dẫn tour của bạn.",
    },
    {
      icon: Sparkles,
      title: "Tăng cơ hội nhận booking gấp 3 lần",
      description: "Theo thống kê từ LocalBuddy, các Local sở hữu gói Premium nhận được số lượng tin nhắn và đặt lịch cao gấp 3 lần.",
    },
    {
      icon: ShieldCheck,
      title: "Hỗ trợ riêng 24/7 từ đội ngũ Admin",
      description: "Kênh hỗ trợ ưu tiên giải đáp thắc mắc, tư vấn tối ưu hồ sơ và giải quyết sự cố thần tốc từ ban quản trị.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-amber-100 flex flex-col">
        {/* Header with amber glow */}
        <div className="relative p-6 sm:p-7 bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 text-amber-950 rounded-t-3xl overflow-hidden shrink-0">
          <div className="absolute -right-10 -bottom-10 opacity-15">
            <Crown size={160} />
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 text-amber-950 transition"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/15 text-xs font-black uppercase tracking-wider mb-2">
            <Crown size={14} className="fill-amber-950" />
            Đặc quyền thành viên
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-amber-950">
            Nâng tầm thu nhập cùng Local Premium
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-medium text-amber-900/80">
            Trở thành đối tác Local tiêu biểu được hàng ngàn du khách tin chọn
          </p>
        </div>

        {/* Selected Plan Summary Banner */}
        <div className="mx-6 mt-5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Gói đã chọn</span>
            <p className="text-base font-extrabold text-navy">{plan.name} ({plan.durationDays} ngày)</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 line-through mr-1.5">
              {plan.originalPrice > plan.price ? formatCurrency(plan.originalPrice) : ""}
            </span>
            <span className="text-xl font-black text-amber-600">
              {formatCurrency(plan.price)}
            </span>
          </div>
        </div>

        {/* Benefits List */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Chi tiết các quyền lợi nhận được
          </h3>

          <div className="grid gap-3.5">
            {keyBenefits.map((b, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 hover:bg-amber-50/40 border border-slate-100 hover:border-amber-200 transition"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 shrink-0 shadow-sm mt-0.5">
                  <b.icon size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy flex items-center gap-1.5">
                    {b.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with actions */}
        <div className="p-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-white rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => onProceedToPayment(plan)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 font-black text-xs shadow-lg shadow-amber-400/30 hover:brightness-105 active:scale-95 transition flex items-center gap-2"
          >
            <Crown size={15} className="fill-amber-950" />
            <span>Đăng ký • {formatCurrency(plan.price)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

