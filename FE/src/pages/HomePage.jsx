import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import BuddyCard from "../components/BuddyCard";
import api from "../services/api";
import {
  filterBuddies,
  normalizeLanguage,
} from "../utils/buddyFilters";

const LANGUAGES = [
  { value: "Tiếng Việt", key: "languageVietnamese" },
  { value: "Tiếng Anh", key: "languageEnglish" },
  { value: "Tiếng Pháp", key: "languageFrench" },
  { value: "Tiếng Đức", key: "languageGerman" },
  { value: "Tiếng Nhật", key: "languageJapanese" },
  { value: "Tiếng Hàn", key: "languageKorean" },
  { value: "Tiếng Trung", key: "languageChinese" },
  { value: "Tiếng Tây Ban Nha", key: "languageSpanish" },
  { value: "Tiếng Ý", key: "languageItalian" },
  { value: "Tiếng Nga", key: "languageRussian" },
  { value: "Tiếng Thái", key: "languageThai" },
  { value: "Tiếng Indonesia", key: "languageIndonesian" },
];
const AREAS = [
  { value: "Hải Châu", key: "areaHaiChau" },
  { value: "Thanh Khê", key: "areaThanhKhe" },
  { value: "Sơn Trà", key: "areaSonTra" },
  { value: "Ngũ Hành Sơn", key: "areaNguHanhSon" },
  { value: "Liên Chiểu", key: "areaLienChieu" },
  { value: "Cẩm Lệ", key: "areaCamLe" },
  { value: "Hòa Vang", key: "areaHoaVang" },
  { value: "Hoàng Sa", key: "areaHoangSa" },
];

export default function HomePage() {
  const { t } = useTranslation("home");
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem("lb_user") || "null");
  } catch {}
  const role = currentUser?.role;
  // Lắng nghe sự kiện khi thông tin người dùng được cập nhật.
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const updateUser = () => {
      setAuthVersion((version) => version + 1);
    };

    window.addEventListener("lb-auth-change", updateUser);

    return () => {
      window.removeEventListener("lb-auth-change", updateUser);
    };
  }, []);

  // Đọc lại thông tin mới nhất từ localStorage.
  let latestUser = null;

  try {
    latestUser = JSON.parse(localStorage.getItem("lb_user") || "null");
  } catch {
    latestUser = null;
  }

  const [buddies, setBuddies] = useState([]);
  const [category, setCategory] = useState("Tất cả");
  const [area, setArea] = useState("Tất cả khu vực");
  const [language, setLanguage] = useState("Tất cả ngôn ngữ");
  const [maxPrice, setMaxPrice] = useState("");
  const [experienceDate, setExperienceDate] = useState("");
  const [experienceStart, setExperienceStart] = useState("09:00");
  const [durationHours, setDurationHours] = useState("3");
  const [loadingBuddies, setLoadingBuddies] = useState(true);
  const [buddyError, setBuddyError] = useState("");

  // Tải dữ liệu BuddyProfile thật từ MongoDB thông qua API.
  useEffect(() => {
    let cancelled = false;

    async function loadBuddies() {
      setLoadingBuddies(true);
      setBuddyError("");

      try {
        const response = await api.get("/buddies");

        if (!cancelled) {
          setBuddies(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setBuddies([]);
          setBuddyError(
            error.response?.data?.message || "loadLocalsError",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingBuddies(false);
        }
      }
    }

    loadBuddies();

    return () => {
      cancelled = true;
    };
  }, []);

  // Lấy danh sách ngôn ngữ có trong dữ liệu Local đã tải.
  const availableLanguages = useMemo(
    () => {
      const languages = new Map();
      for (const item of [
        ...LANGUAGES.map(({ value }) => value),
        ...buddies.flatMap((buddy) =>
          Array.isArray(buddy.languages) ? buddy.languages : [],
        ),
      ]) {
        const key = normalizeLanguage(item);
        if (!languages.has(key)) languages.set(key, item);
      }
      return [...languages.values()].sort();
    },
    [buddies],
  );

  // Đối chiếu sở thích, khu vực, ngôn ngữ và giờ bắt đầu với hồ sơ/lịch Local.
  const filtered = useMemo(
    () =>
      filterBuddies(buddies, {
        category,
        area,
        language,
        maxPrice,
        date: experienceDate,
        startTime: experienceStart,
      }),
    [
      buddies,
      category,
      area,
      language,
      maxPrice,
      experienceDate,
      experienceStart,
    ],
  );

  return (
    <>
      <section className="container-page pt-7">
        <div className="rounded-2xl bg-gradient-to-r from-[#e2f4ff] via-white to-[#e7fff5] px-5 py-8 sm:px-10 sm:py-12">
          <div className="grid items-center gap-7 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <span className="pill">
                <Sparkles size={12} />
                {t("heroBadge")}
              </span>
              <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight text-navy sm:text-5xl">
                <Trans ns="home" i18nKey="heroTitle" components={[<span className="text-brand" />]} />
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600">
                {t("heroDescription")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#discover" className="btn-primary">
                  {t("exploreLocal")} <ArrowRight size={16} />
                </a>
                <a href="#how" className="btn-light">
                  {t("howItWorks")}
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  {t("verifiedProfiles")}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={15} className="text-emerald-600" />
                  {t("friendlyCommunity")}
                </span>
              </div>
            </div>
            <div className="relative">
              <img
                className="h-64 w-full rounded-2xl object-cover shadow-soft sm:h-80"
                src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1100&q=85"
                alt={t("cityImageAlt")}
              />
              <div className="absolute -bottom-3 left-3 rounded-xl bg-white p-3 shadow-soft sm:left-5">
                <p className="text-xs font-bold text-navy">
                  {t("localLike")}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {t("safeCloseMemorable")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="container-page pt-12">
        <div className="panel grid gap-6 p-6 md:grid-cols-3 md:p-8">
          {[
            {
              n: "01",
              titleKey: "stepDiscover",
              descKey: "stepDiscoverDescription",
            },
            {
              n: "02",
              titleKey: "stepConnect",
              descKey: "stepConnectDescription",
            },
            {
              n: "03",
              titleKey: "stepEnjoy",
              descKey: "stepEnjoyDescription",
            },
          ].map((x) => (
            <div key={x.n} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 font-black text-brand">
                {x.n}
              </span>
              <div>
                <h3 className="font-extrabold">{t(x.titleKey)}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t(x.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {role === "traveler" && (
        <section className="container-page pt-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 border-l-4 border-brand p-5">
            <div>
              <span className="pill">TRAVELER SPACE</span>
              <h2 className="mt-2 text-lg font-black text-navy">
                {t("travelerReady")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("travelerDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/profile" className="btn-light">
                {t("myProfile")}
              </Link>
              <Link to="/dashboard" className="btn-primary">
                {t("myBookingsWallet")} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {role === "local" && !latestUser?.profileComplete && (
        <section className="container-page pt-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 border-l-4 border-amber-400 p-5">
            <div>
              <span className="pill">LOCAL SPACE</span>
              <h2 className="mt-2 text-lg font-black text-navy">
                {t("welcomeLocal")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("completeProfileDescription")}
              </p>
            </div>

            <Link to="/profile" className="btn-green">
              {t("completeProfile")} <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}

      {role === "admin" && (
        <section className="container-page pt-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 border-l-4 border-violet-500 p-5">
            <div>
              <span className="pill">ADMIN COMMAND CENTER</span>
              <h2 className="mt-2 text-lg font-black text-navy">
                {t("helloAdmin", { name: currentUser?.fullName || "Admin" })}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("manageAdmin")}
              </p>
            </div>
            <Link to="/admin" className="btn-primary">
              {t("openAdmin")} <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
      {(!role || role === "traveler") && (
        <>
          <section className="container-page -mt-1">
            <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">
                {t("categoryPrompt")}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="Tất cả">{t("allCategories")}</option>
                  <option value="Ẩm thực">{t("food")}</option>
                  <option value="cà phê">{t("coffee")}</option>
                  <option value="du lịch">{t("travel")}</option>
                </select>
              </label>

              <label className="text-xs font-bold text-slate-600">
                {t("areaLabel")}
                <span className="mt-2 flex items-center gap-2">
                  <MapPin size={15} className="text-brand" />
                  <select
                    className="field"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option value="Tất cả khu vực">{t("allAreas")}</option>
                    {AREAS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {t(item.key)}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <label className="text-xs font-bold text-slate-600">
                {t("languageLabel")}
                <select
                  className="field mt-2"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="Tất cả ngôn ngữ">{t("allLanguages")}</option>
                  {availableLanguages.map((item) => {
                    const language = LANGUAGES.find((option) => option.value === item);
                    return (
                      <option key={item} value={item}>
                        {language ? t(language.key) : item}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-xs font-bold text-slate-600">
                {t("budgetLabel")}
                <select
                  className="field mt-2"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                >
                  <option value="">{t("unlimited")}</option>
                  <option value="50000">{t("hourlyRate", { amount: "50.000đ" })}</option>
                  <option value="100000">{t("hourlyRate", { amount: "100.000đ" })}</option>
                  <option value="150000">{t("hourlyRate", { amount: "150.000đ" })}</option>
                  <option value="200000">{t("hourlyRate", { amount: "200.000đ" })}</option>
                  <option value="300000">{t("hourlyRate", { amount: "300.000đ" })}</option>
                </select>
              </label>
            
              <label className="text-xs font-bold text-slate-600">
                {t("experienceDate")}
                <input
                  type="date"
                  className="field mt-2"
                  min={new Date().toISOString().slice(0, 10)}
                  value={experienceDate}
                  onChange={(e) => setExperienceDate(e.target.value)}
                />
              </label>

              <label className="text-xs font-bold text-slate-600">
                {t("startTime")}
                <select
                  className="field mt-2"
                  value={experienceStart}
                  onChange={(e) => setExperienceStart(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, i) => i)
                    .filter((hour) => hour < 24 - Number(durationHours))
                    .map((hour) => {
                      const time = `${String(hour).padStart(2, "0")}:00`;
                      return <option key={time} value={time}>{time}</option>;
                    })}
                </select>
              </label>

              <label className="text-xs font-bold text-slate-600">
                {t("duration")}
                <select
                  className="field mt-2"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 8, 12].map((hours) => (
                    <option key={hours} value={hours}>
                      {t("durationHours", { count: hours })}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn-primary self-end"
                onClick={() =>
                  document
                    .getElementById("discover")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Search size={15} /> {t("viewMatches")}
              </button>
            </div>
          </section>
          <section id="discover" className="container-page pt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{t("discoverEyebrow")}</p>
                <h2 className="section-title mt-1">
                  {t("resultsTitle", { count: filtered.length, duration: t("durationHours", { count: Number(durationHours) }) })}
                </h2>
                <p className="mt-2 text-xs text-slate-500">
                  {t("resultDescription")}
                </p>
              </div>
              <span className="btn-light">
                <ShieldCheckIcon /> {t("verifiedProfilesBadge")}
              </span>
            </div>
            {loadingBuddies && (
              <div className="panel mt-5 p-8 text-center text-sm text-slate-500">
                {t("loadingLocals")}
              </div>
            )}

            {buddyError && (
              <div className="panel mt-5 p-8 text-center">
                <p className="font-bold text-red-600">{buddyError === "loadLocalsError" ? t(buddyError) : buddyError}</p>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={() => window.location.reload()}
                >
                  {t("retry")}
                </button>
              </div>
            )}
            {!loadingBuddies && !buddyError && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((b) => (
                  <BuddyCard
                    key={b._id || b.id}
                    buddy={b}
                    experienceDate={experienceDate}
                    experienceStart={experienceStart}
                    durationHours={durationHours}
                  />
                ))}
              </div>
            )}

            {!loadingBuddies && !buddyError && filtered.length === 0 && (
              <div className="panel mt-5 p-10 text-center">
                <p className="font-bold">
                  {buddies.length === 0
                    ? t("noActiveProfiles")
                    : t("noMatches")}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                {buddies.length === 0
                  ? t("localsApproval")
                  : t("broadenSearch")}
                </p>
                {buddies.length > 0 && (
                  <button
                    type="button"
                    className="btn-light mt-4"
                    onClick={() => {
                      setCategory("Tất cả");
                      setArea("Tất cả khu vực");
                      setLanguage("Tất cả ngôn ngữ");
                      setMaxPrice("");
                    }}
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <section id="experiences" className="container-page pt-10">
        <div className="mb-5">
          <p className="eyebrow">{t("packagesEyebrow")}</p>
          <h2 className="section-title mt-1">{t("chooseExperience")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {t("packagesDescription")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              titleKey: "foodBuddyTitle",
              categoryValue: "Ẩm thực",
              emoji: "🍜",
              descKey: "foodDescription",
              planKey: "foodPlan",
            },
            {
              titleKey: "coffeeTitle",
              categoryValue: "cà phê",
              emoji: "☕",
              descKey: "coffeeDescription",
              planKey: "coffeePlan",
            },
            {
              titleKey: "cityTourTitle",
              categoryValue: "du lịch",
              emoji: "🏝️",
              descKey: "cityTourDescription",
              planKey: "cityTourPlan",
            },
          ].map((item) => (
            <article key={item.categoryValue} className="panel p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-2xl">
                {item.emoji}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-navy">
                {t(item.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t(item.descKey)}
              </p>
              <p className="mt-3 text-xs font-bold text-brand">{t(item.planKey)}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("packageInclusions")}
              </p>
              <button
                type="button"
                className="btn-light mt-4"
                onClick={() => {
                  setCategory(item.categoryValue);
                  document
                    .getElementById("discover")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {t("findBuddy")} <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section id="safety" className="container-page pt-8">
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#075f88] p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-bold text-emerald-200">
              {t("safetyEyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {t("safetyTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-blue-100">
              {t("safetyDescription")}
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-xs font-extrabold text-brand"
          >
            {t("joinLocalBuddy")} <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
function ShieldCheckIcon() {
  return <CheckCircle2 size={14} />;
}
