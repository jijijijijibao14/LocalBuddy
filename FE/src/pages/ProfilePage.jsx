import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Save,
  UserRound,
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api, { API_BASE_URL } from "../services/api";

const AREAS = [
  "Hải Châu",
  "Thanh Khê",
  "Sơn Trà",
  "Ngũ Hành Sơn",
  "Liên Chiểu",
  "Cẩm Lệ",
  "Hòa Vang",
  "Hoàng Sa",
];
const LANGUAGES = [
  "Tiếng Việt",
  "Tiếng Anh",
  "Tiếng Pháp",
  "Tiếng Đức",
  "Tiếng Nhật",
  "Tiếng Hàn",
  "Tiếng Trung",
  "Tiếng Tây Ban Nha",
  "Tiếng Ý",
  "Tiếng Nga",
  "Tiếng Thái",
  "Tiếng Indonesia",
];
const INTERESTS = [
  { value: "Ẩm thực", labelKey: "interests.food" },
  { value: "cà phê", labelKey: "interests.coffee" },
  { value: "du lịch", labelKey: "interests.travel" },
];
const uploadUrl = (url) =>
  !url
    ? ""
    : url.startsWith("http")
      ? url
      : `${API_BASE_URL.replace(/\/api\/?$/, "")}${url}`;

function MultiSelectDropdown({ options, value, onChange, placeholder }) {
  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <details className="group relative mt-2">
      <summary className="field flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className={selectedLabels.length ? "truncate" : "truncate text-slate-400"}>
          {selectedLabels.length ? selectedLabels.join(", ") : placeholder}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-normal hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={(event) => onChange(option.value, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    bio: "",
    city: "Sơn Trà",
    areas: ["Sơn Trà"],
    languages: ["Tiếng Việt"],
    interests: ["du lịch"],
    avatar: "",
    profilePhotos: [],
    languageCertificates: [],
    pricePerHour: 100000,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [certificateFiles, setCertificateFiles] = useState({});

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    const urls = profilePhotoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [profilePhotoFiles]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("traveler");

  useEffect(() => {
    api
      .get("/users/me")
      .then(({ data }) => {
        const user = data.user;
        setRole(user.role);
        setForm({
          fullName: user.fullName || "",
          phone: user.phone || "",
          bio: user.bio || "",
          city: AREAS.includes(user.city) ? user.city : "Sơn Trà",
          areas: user.areas?.length
            ? user.areas.filter((area) => AREAS.includes(area))
            : [AREAS.includes(user.city) ? user.city : "Sơn Trà"],
          languages: user.languages?.length ? user.languages : ["Tiếng Việt"],
          interests: user.interests || [],
          avatar: user.avatar || "",
          profilePhotos: user.profilePhotos || [],
          languageCertificates:
            user.role === "local"
              ? user.languageCertificates?.length
                ? user.languageCertificates
                : (user.languages || []).map((language) => ({
                    language,
                    certificateUrl: "",
                  }))
              : [],
          pricePerHour: user.pricePerHour || 100000,
        });
      })
      .catch((e) =>
        setError(e.response?.data?.message || t("loadError")),
      )
      .finally(() => setLoading(false));
  }, []);

  const change = (e) =>
    setForm((old) => ({ ...old, [e.target.name]: e.target.value }));
  const changeMulti = (field, value, checked) =>
    setForm((old) => ({
      ...old,
      [field]: checked
        ? [...new Set([...old[field], value])]
        : old[field].filter((item) => item !== value),
    }));
  const changeLanguage = (index, language) =>
    setForm((old) => {
      const rows = [...old.languageCertificates];
      rows[index] = { ...(rows[index] || {}), language };
      const languages = [
        ...new Set(rows.map((row) => row.language).filter(Boolean)),
      ];
      return { ...old, languageCertificates: rows, languages };
    });
  const addLanguage = () =>
    setForm((old) => ({
      ...old,
      languageCertificates: [
        ...old.languageCertificates,
        { language: "Tiếng Anh", certificateUrl: "" },
      ],
    }));
  const removeLanguage = (index) => {
    setForm((old) => {
      const rows = old.languageCertificates.filter((_, i) => i !== index);
      return {
        ...old,
        languageCertificates: rows,
        languages: [
          ...new Set(rows.map((row) => row.language).filter(Boolean)),
        ],
      };
    });
    setCertificateFiles((old) => {
      const next = { ...old };
      delete next[index];
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      ["fullName", "phone", "bio", "city"].forEach((key) =>
        data.append(key, String(form[key] ?? "")),
      );
      data.append(
        "areas",
        JSON.stringify(role === "local" ? form.areas : [form.city]),
      );
      if (role === "local") {
        data.append("pricePerHour", String(form.pricePerHour ?? ""));
      }
      data.append(
        "languages",
        JSON.stringify([
          ...new Set(
            (role === "local"
              ? form.languageCertificates.map((row) => row.language)
              : form.languages
            ).filter(Boolean),
          ),
        ]),
      );
      if (role === "local") {
        data.append("interests", JSON.stringify(form.interests));
        data.append(
          "languageCertificates",
          JSON.stringify(
            form.languageCertificates.map(({ language, certificateUrl }) => ({
              language,
              certificateUrl: certificateUrl || "",
            })),
          ),
        );
      }
      if (avatarFile) data.append("avatarFile", avatarFile);
      if (role === "local") {
        profilePhotoFiles.forEach((file) => data.append("profilePhotoFiles", file));
      }
      if (role === "local") {
        Object.entries(certificateFiles).forEach(([index, file]) => {
          if (file) data.append(`certificate_${index}`, file);
        });
      }
      const response = await api.patch("/users/me", data);
      localStorage.setItem(
        "lb_user",
        JSON.stringify({
          ...JSON.parse(localStorage.getItem("lb_user") || "{}"),
          ...response.data.user,
        }),
      );
      window.dispatchEvent(new Event("lb-auth-change"));
      setForm((old) => ({
        ...old,
        avatar: response.data.user.avatar || old.avatar,
        languages: response.data.user.languages || old.languages,
        interests: response.data.user.interests || old.interests,
        areas: response.data.user.areas || old.areas,
        city: response.data.user.city || old.city,
        profilePhotos: response.data.user.profilePhotos || old.profilePhotos,
        languageCertificates:
          response.data.user.languageCertificates || old.languageCertificates,
      }));
      setAvatarFile(null);
      setProfilePhotoFiles([]);
      setCertificateFiles({});
      setMessage(
        response.data.user.profileComplete
          ? t("saveSuccess")
          : t("saveIncomplete"),
      );
    } catch (e) {
      setError(e.response?.data?.message || t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="container-page py-12">{t("loading")}</div>;
  return (
    <div className="container-page py-8">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} /> {t("backHome")}
      </Link>
      <div className="mx-auto max-w-3xl panel p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-brand">
            <UserRound />
          </div>
          <div>
            <p className="eyebrow">{t("eyebrow", { role: role.toUpperCase() })}</p>
            <h1 className="text-2xl font-black text-navy">
              {t("title")}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {role === "local"
            ? t("introLocal")
            : t("introTraveler")}
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            {t("fullName")}
            <input
              className="field mt-2"
              name="fullName"
              value={form.fullName}
              onChange={change}
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            {t("phone")}
            <input
              className="field mt-2"
              name="phone"
              value={form.phone}
              onChange={change}
              placeholder="09xxxxxxxx"
              required
            />
          </label>
          {role === "local" ? (
            <div className="text-sm font-bold text-slate-700">
              {t("areasLocal")}
              <MultiSelectDropdown
                options={AREAS.map((area) => ({ value: area, label: t(`areas.${area}`) }))}
                value={form.areas}
                onChange={(value, checked) => changeMulti("areas", value, checked)}
                placeholder={t("areasPlaceholder")}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {t("areasHint")}
              </span>
            </div>
          ) : (
            <label className="text-sm font-bold text-slate-700">
              {t("areaTraveler")}
              <select
                className="field mt-2"
                name="city"
                value={form.city}
                onChange={change}
                required
              >
                {AREAS.map((area) => (
                  <option key={area} value={area}>{t(`areas.${area}`)}</option>
                ))}
              </select>
            </label>
          )}
          <div className="text-sm font-bold text-slate-700">
            {t("avatar")}
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-600">
              <Upload size={16} />{" "}
              {avatarFile?.name || t("chooseImage")}
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              />
            </label>
            {(avatarFile || form.avatar) && (
              <img
                className="mt-2 h-24 w-24 rounded-xl object-cover"
                src={
                  avatarFile ? avatarPreview : uploadUrl(form.avatar)
                }
                alt={t("avatar")}
              />
            )}
          </div>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            {t("bio")}
            <textarea
              className="field mt-2 min-h-24"
              name="bio"
              value={form.bio}
              onChange={change}
              placeholder={t("bioPlaceholder")}
            />
          </label>
          {role === "local" ? (
            <>
              <div className="text-sm font-bold text-slate-700 sm:col-span-2">
                {t("extraPhotos")}
                <input
                  className="field mt-2"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) =>
                    setProfilePhotoFiles(Array.from(event.target.files || []).slice(0, 10))
                  }
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {t("extraPhotosHint")}
                </span>
                {(profilePhotoFiles.length > 0 || form.profilePhotos?.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(form.profilePhotos || []).map((photo, index) => (
                      <img
                        key={`${photo}-${index}`}
                        className="h-20 w-20 rounded-lg object-cover"
                        src={uploadUrl(photo)}
                        alt={t("photoAlt", { index: index + 1 })}
                      />
                    ))}
                    {profilePhotoFiles.map((photo, index) => (
                      <img
                        key={`${photo.name}-${index}`}
                        className="h-20 w-20 rounded-lg object-cover"
                        src={photoPreviews[index]}
                        alt={t("newPhotoAlt", { index: index + 1 })}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold text-navy">
                    {t("langCertTitle")}
                  </h2>
                  <span className="text-xs font-normal text-slate-500">
                    {t("certOptional")}
                  </span>
                </div>
                {form.languageCertificates.map((row, index) => (
                  <div
                    key={index}
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <label className="text-xs font-bold text-slate-600">
                      {t("language")}
                      <select
                        className="field mt-1"
                        value={row.language || ""}
                        onChange={(e) => changeLanguage(index, e.target.value)}
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {t(`languages.${lang}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      {t("certFile")}
                      <input
                        className="field mt-1 text-xs"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(e) =>
                          setCertificateFiles((old) => ({
                            ...old,
                            [index]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      {(certificateFiles[index] || row.certificateUrl) && (
                        <span className="mt-1 block font-normal text-emerald-700">
                          {certificateFiles[index]?.name ||
                            t("certUploaded")}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      className="btn-light !px-3"
                      onClick={() => removeLanguage(index)}
                      aria-label={t("removeLanguage")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-light mt-3"
                  onClick={addLanguage}
                >
                  <Plus size={15} /> {t("addLanguage")}
                </button>
                {!form.languageCertificates.length && (
                  <p className="mt-2 text-xs font-normal text-slate-500">
                    {t("noLanguages")}
                  </p>
                )}
              </div>
              <div className="text-sm font-bold text-slate-700 sm:col-span-2">
                <span>{t("experiences")}</span>
                <MultiSelectDropdown
                  options={INTERESTS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
                  value={form.interests}
                  onChange={(value, checked) =>
                    changeMulti("interests", value, checked)
                  }
                  placeholder={t("experiencesPlaceholder")}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {t("experiencesHint")}
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-slate-700 sm:col-span-2">
              <span>{t("languagesUsed")}</span>
              <MultiSelectDropdown
                options={LANGUAGES.map((language) => ({
                  value: language,
                  label: t(`languages.${language}`),
                }))}
                value={form.languages}
                onChange={(value, checked) =>
                  changeMulti("languages", value, checked)
                }
                placeholder={t("languagesPlaceholder")}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {t("languagesHint")}
              </span>
            </div>
          )}
          {role === "local" && (
            <label className="text-sm font-bold text-slate-700">
              {t("pricePerHour")}
              <input
                className="field mt-2"
                type="number"
                min="0"
                step="10000"
                name="pricePerHour"
                value={form.pricePerHour}
                onChange={change}
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {t("priceHint")}
              </span>
            </label>
          )}
          {error && (
            <p className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          {message && (
            <p className="sm:col-span-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button disabled={saving} className="btn-primary" type="submit">
              <Save size={16} />
              {saving ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className="btn-light"
              onClick={() => navigate("/")}
            >
              {t("viewHome")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
