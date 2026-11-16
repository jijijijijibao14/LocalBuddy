import { useState, useEffect } from "react";
import { Crown, Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import api from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import PremiumBenefitsModal from "./PremiumBenefitsModal";
import PremiumPaymentModal from "./PremiumPaymentModal";

export default function PremiumPackageCard({
  isCurrentPremium = false,
  premiumExpiresAt = null,
  onSubscriptionSuccess,
}) {
  const { formatCurrency } = useLocale();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanForBenefits, setSelectedPlanForBenefits] = useState(null);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await api.get("/premium/plans");
        if (res.data?.plans) {
          setPlans(res.data.plans);
        }
      } catch (err) {
        console.error("Lỗi tải danh sách gói Premium:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  function handleSelectPlan(plan) {
    setSelectedPlanForBenefits(plan);
  }

  function handleProceedToPayment(plan) {
    setSelectedPlanForBenefits(null);
    setSelectedPlanForPayment(plan);
  }

  function handlePaymentDone(result) {
    if (onSubscriptionSuccess) {
      onSubscriptionSuccess(result);
    }
  }

  if (loading) {
    return (
      <div className="panel p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded mb-4"></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        {plans.map((plan) => {
          const isPopular = plan.isPopular;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 transition duration-300 flex flex-col justify-between ${
                isPopular
                  ? "bg-gradient-to-b from-amber-500/10 via-amber-50/40 to-white border-2 border-amber-400 shadow-xl shadow-amber-500/10 scale-[1.02]"
                  : "bg-white border border-slate-200 hover:border-amber-300 hover:shadow-lg"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                  <Sparkles size={12} className="fill-amber-950" />
                  Khuyên dùng nhiều nhất
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800">
                    <Crown size={22} className="fill-amber-600 text-amber-700" />
                  </div>
                  {plan.discountBadge && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                      {plan.discountBadge}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black text-navy">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                  {plan.description}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-navy">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="text-xs text-slate-500">
                      / {plan.durationDays} ngày
                    </span>
                  </div>
                  {plan.originalPrice > plan.price && (
                    <p className="text-xs text-slate-400 line-through mt-0.5">
                      {formatCurrency(plan.originalPrice)}
                    </p>
                  )}
                </div>

                {/* Benefits mini checklist */}
                <div className="mt-5 space-y-2.5 text-xs text-slate-700">
                  {plan.benefits.slice(0, 4).map((b, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-full p-0.5 bg-amber-100 text-amber-700 shrink-0">
                        <Check size={11} strokeWidth={3} />
                      </div>
                      <span className="leading-snug">{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4">
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs transition duration-200 flex items-center justify-center gap-2 shadow-sm ${
                    isPopular
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 hover:brightness-105 shadow-amber-400/30"
                      : "bg-slate-900 hover:bg-navy text-white"
                  }`}
                >
                  <Crown size={14} />
                  <span>{isCurrentPremium ? "Gia hạn thêm gói này" : "Xem quyền lợi & Đăng ký"}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Benefits Modal */}
      <PremiumBenefitsModal
        isOpen={Boolean(selectedPlanForBenefits)}
        onClose={() => setSelectedPlanForBenefits(null)}
        plan={selectedPlanForBenefits}
        onProceedToPayment={handleProceedToPayment}
      />

      {/* Payment Modal */}
      <PremiumPaymentModal
        isOpen={Boolean(selectedPlanForPayment)}
        onClose={() => setSelectedPlanForPayment(null)}
        plan={selectedPlanForPayment}
        onSuccess={handlePaymentDone}
      />
    </div>
  );
}

