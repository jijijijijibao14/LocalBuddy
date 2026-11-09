import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Compass,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  UserRound,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../services/api";

export default function AuthPage({ mode = "login" }) {
  const { t } = useTranslation("auth");
  const register = mode === "register";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "traveler",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const payload = register
        ? form
        : { email: form.email, password: form.password };
      const { data } = await api.post(
        `/auth/${register ? "register" : "login"}`,
        payload,
      );
      if (register) {
        setSuccess(true);
        setError(t("registerSuccess"));
        setTimeout(() => navigate("/login", { replace: true }), 900);
      } else {
        localStorage.setItem("lb_token", data.token);
        localStorage.setItem("lb_user", JSON.stringify(data.user));
        // Mọi role đều về cùng HomePage; nội dung được render theo role.
        const redirectTo = searchParams.get("redirect") || "/";
        navigate(redirectTo, { replace: true });
        window.dispatchEvent(new Event("lb-auth-change"));
      }
    } catch (e) {
      setError(
        e.response?.data?.message ||
          t("connectError"),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="grid items-stretch gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <section className="relative hidden overflow-hidden rounded-2xl bg-[#075f88] p-8 text-white lg:block">
          <img
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1000&q=85"
            alt={t("heroAlt")}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
                <Compass />
              </span>
              <b>LOCAL BUDDY</b>
            </div>
            <span className="mt-16 w-fit rounded-full bg-emerald-300/20 px-3 py-1 text-[10px] font-extrabold text-emerald-100">
              {t("communityBadge")}
            </span>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              {t("heroTitleLine1")}
              <br />
              {t("heroTitleLine2")}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">
              {t("heroDesc")}
            </p>
            <div className="mt-auto grid grid-cols-3 gap-3 pt-12">
              {[
                ["12.5K+", "statUsers"],
                ["98.5%", "statSatisfied"],
                ["24/7", "statSupport"],
              ].map((x) => (
                <div
                  className="rounded-xl bg-white/15 p-3 backdrop-blur"
                  key={x[0]}
                >
                  <b className="text-xl">{x[0]}</b>
                  <p className="mt-1 text-[10px] text-blue-100">{t(x[1])}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel mx-auto w-full max-w-2xl p-5 sm:p-8">
          <div className="text-center">
            <span className="eyebrow">{t("startJourney")}</span>
            <h2 className="mt-2 text-2xl font-black text-navy">
              {register
                ? t("registerTitle")
                : t("loginTitle")}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              {register
                ? t("registerSubtitle")
                : t("loginSubtitle")}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <Link
              className={`rounded-lg py-2.5 text-center text-xs font-bold ${!register ? "bg-white text-brand shadow-sm" : "text-slate-500"}`}
              to="/login"
            >
              {t("tabLogin")}
            </Link>
            <Link
              className={`rounded-lg py-2.5 text-center text-xs font-bold ${register ? "bg-white text-brand shadow-sm" : "text-slate-500"}`}
              to="/register"
            >
              {t("tabRegister")}
            </Link>
          </div>
          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs text-slate-600">
            <ShieldCheck size={16} className="mr-2 inline text-brand" />
            {t("adminNotice")}
          </div>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            {register && (
              <>
                <label className="block text-xs font-bold">
                  {t("fullName")}
                  <input
                    className="field mt-2"
                    name="fullName"
                    value={form.fullName}
                    onChange={change}
                    placeholder={t("fullNamePlaceholder")}
                    required
                  />
                </label>
                <label className="block text-xs font-bold">
                  {t("rolePrompt")}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "traveler" })}
                    className={`rounded-xl border p-4 text-left ${form.role === "traveler" ? "border-brand bg-blue-50 ring-1 ring-brand" : "border-slate-200 bg-white"}`}
                  >
                    <UserRound className="text-brand" size={20} />
                    <b className="mt-2 block text-sm">Traveler</b>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                      {t("travelerDesc")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "local" })}
                    className={`rounded-xl border p-4 text-left ${form.role === "local" ? "border-brand bg-blue-50 ring-1 ring-brand" : "border-slate-200 bg-white"}`}
                  >
                    <MapPin className="text-emerald-600" size={20} />
                    <b className="mt-2 block text-sm">Local</b>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                      {t("localDesc")}
                    </span>
                  </button>
                </div>
              </>
            )}
            <label className="block text-xs font-bold">
              Email
              <input
                className="field mt-2"
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="example@gmail.com"
                required
              />
            </label>
            {register && (
              <label className="block text-xs font-bold">
                {t("phone")}
                <input
                  className="field mt-2"
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  placeholder="09xxxxxxxx"
                  pattern="0[0-9]{9}"
                  title={t("phoneTitle")}
                  required
                />
              </label>
            )}
            <label className="block text-xs font-bold">
              {t("password")}
              <span className="relative mt-2 block">
                <input
                  className="field pr-10"
                  type={show ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={change}
                  placeholder={register ? t("passwordPlaceholderRegister") : t("passwordPlaceholderLogin")}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-3 text-slate-400"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {register && (
              <p className="text-[11px] text-slate-500">
                <CheckCircle2
                  size={13}
                  className="mr-1 inline text-emerald-600"
                />
                {t("passwordMin")}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className={`rounded-lg p-3 text-xs leading-5 ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
              >
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60"
            >
              {loading
                ? t("processing")
                : register
                  ? t("createAccount")
                  : t("login")}{" "}
              →
            </button>
          </form>
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">
            {t("terms")}
          </p>
        </section>
      </div>
    </div>
  );
}
