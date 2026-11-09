import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ScanText,
  Smartphone,
  ScanFace,
  Eye,
  FileSignature,
  CheckCircle2,
  LockKeyhole,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../services/api";

const STEPS = [
  { key: "ocr", icon: ScanText },
  { key: "nfc", icon: Smartphone },
  { key: "face", icon: ScanFace },
  { key: "liveness", icon: Eye },
  { key: "sign", icon: FileSignature },
];

export default function LocalSafetyEKYC() {
  const { t } = useTranslation("ekyc");
  const [consent, setConsent] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [kycStatus, setKycStatus] = useState("Not Started");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get("/users/me")
      .then(({ data }) => {
        setKycStatus(data.user?.kycStatus || "Not Started");
      })
      .catch(() => {
        setError(t("loadError"));
      });
  }, []);

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;
  const isVerified = kycStatus === "Verified";

  function confirmStep() {
    setCompletedSteps((old) =>
      old.includes(currentStep) ? old : [...old, currentStep],
    );
    setSuccess(t(`steps.${step.key}.demo`));
    setError("");

    if (!isLastStep) {
      setCurrentStep((old) => old + 1);
      setSuccess("");
    }
  }

  async function finishDemo() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.patch("/users/me/kyc-demo/complete", {
        completedSteps,
      });

      setKycStatus(data.user?.kycStatus || "Verified");

      const oldUser = JSON.parse(localStorage.getItem("lb_user") || "{}");

      localStorage.setItem(
        "lb_user",
        JSON.stringify({
          ...oldUser,
          ...data.user,
        }),
      );

      window.dispatchEvent(new Event("lb-auth-change"));
      setSuccess(t("finishSuccess"));
    } catch (e) {
      setError(e.response?.data?.message || t("finishError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-8">
      <Link
        to="/local-dashboard"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} />
        {t("backLocal")}
      </Link>

      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 to-emerald-600 p-6 text-white sm:p-9">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <ShieldCheck size={30} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">
                {t("eyebrow")}
              </p>
              <h1 className="text-2xl font-black sm:text-3xl">
                {t("title")}
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/90">
            {t("intro")}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold">
            <LockKeyhole size={16} />
            {t("status", { status: kycStatus })}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>{t("demoNoteLabel")}</strong> {t("demoNote")}
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-5">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const done = completedSteps.includes(index);

            return (
              <div
                key={item.key}
                className={`rounded-2xl border p-3 ${
                  currentStep === index
                    ? "border-blue-500 bg-blue-50"
                    : done
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon size={20} />
                  {done && (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  )}
                </div>
                <p className="mt-3 text-xs font-extrabold">{t("stepN", { n: index + 1 })}</p>
                <p className="mt-1 text-sm font-bold">{t(`steps.${item.key}.shortTitle`)}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          {isVerified ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={64} className="mx-auto text-emerald-600" />
              <h2 className="mt-4 text-2xl font-black text-navy">
                {t("doneTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t("doneDesc")}
              </p>
              <Link
                to="/local-dashboard"
                className="btn-primary mt-6 inline-flex"
              >
                {t("goLocal")}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <StepIcon size={28} />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                    {t("stepProgress", { current: currentStep + 1, total: STEPS.length })}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-navy">
                    {t(`steps.${step.key}.title`)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(`steps.${step.key}.description`)}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <h3 className="font-extrabold text-navy">{t("simContent")}</h3>
                <ul className="mt-3 space-y-3">
                  {["d1", "d2", "d3"].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm leading-6 text-slate-700"
                    >
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      {t(`steps.${step.key}.${item}`)}
                    </li>
                  ))}
                </ul>
              </div>

              {currentStep === 4 && (
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    {t("consent")}
                  </span>
                </label>
              )}

              {error && (
                <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              {success && (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {success}
                </p>
              )}

              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  className="btn-light"
                  disabled={currentStep === 0 || loading}
                  onClick={() => {
                    setCurrentStep((old) => old - 1);
                    setError("");
                    setSuccess("");
                  }}
                >
                  <ArrowLeft size={16} />
                  {t("back")}
                </button>

                {isLastStep ? (
                  completedSteps.includes(4) ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={loading || !consent}
                      onClick={finishDemo}
                    >
                      <ShieldCheck size={17} />
                      {loading ? t("finishing") : t("finish")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={confirmStep}
                    >
                      {t("confirmLast")}
                      <ArrowRight size={16} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={confirmStep}
                  >
                    {t("confirmContinue")}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-500">
                {t("privacyNote")}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
