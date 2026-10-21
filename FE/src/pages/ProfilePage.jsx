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
  { value: "Ẩm thực", label: "Ẩm thực (Food)" },
  { value: "cà phê", label: "Cà phê" },
  { value: "du lịch", label: "Du lịch" },
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
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    bio: "",
    city: "Sơn Trà",
    languages: ["Tiếng Việt"],
    interests: ["du lịch"],
    avatar: "",
    languageCertificates: [],
    pricePerHour: 100000,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [certificateFiles, setCertificateFiles] = useState({});
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
          languages: user.languages?.length ? user.languages : ["Tiếng Việt"],
          interests: user.interests || [],
          avatar: user.avatar || "",
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
        setError(e.response?.data?.message || "Không tải được hồ sơ."),
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
        languageCertificates:
          response.data.user.languageCertificates || old.languageCertificates,
      }));
      setAvatarFile(null);
      setCertificateFiles({});
      setMessage(
        response.data.user.profileComplete
          ? "Đã lưu hồ sơ thành công!"
          : "Đã lưu hồ sơ. Hãy bổ sung thông tin để hoàn thiện hồ sơ.",
      );
    } catch (e) {
      setError(e.response?.data?.message || "Cập nhật hồ sơ thất bại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="container-page py-12">Đang tải hồ sơ...</div>;
  return (
    <div className="container-page py-8">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} /> Về trang chủ
      </Link>
      <div className="mx-auto max-w-3xl panel p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-brand">
            <UserRound />
          </div>
          <div>
            <p className="eyebrow">HỒ SƠ CÁ NHÂN · {role.toUpperCase()}</p>
            <h1 className="text-2xl font-black text-navy">
              Xem và chỉnh sửa hồ sơ
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {role === "local"
            ? "Cập nhật khu vực hoạt động, ảnh đại diện, ngôn ngữ, chứng chỉ và trải nghiệm bạn tự tin."
            : "Cập nhật thông tin cá nhân, ảnh đại diện và các ngôn ngữ bạn sử dụng."}
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Họ và tên
            <input
              className="field mt-2"
              name="fullName"
              value={form.fullName}
              onChange={change}
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Số điện thoại
            <input
              className="field mt-2"
              name="phone"
              value={form.phone}
              onChange={change}
              placeholder="09xxxxxxxx"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Khu vực tại Đà Nẵng
            <select
              className="field mt-2"
              name="city"
              value={form.city}
              onChange={change}
              required
            >
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm font-bold text-slate-700">
            Ảnh đại diện
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-600">
              <Upload size={16} />{" "}
              {avatarFile?.name || "Chọn ảnh (JPG, PNG, WEBP)"}
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
                  avatarFile
                    ? URL.createObjectURL(avatarFile)
                    : uploadUrl(form.avatar)
                }
                alt="Ảnh đại diện"
              />
            )}
          </div>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Giới thiệu bản thân
            <textarea
              className="field mt-2 min-h-24"
              name="bio"
              value={form.bio}
              onChange={change}
              placeholder="Chia sẻ đôi nét về bạn..."
            />
          </label>
          {role === "local" ? (
            <>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold text-navy">
                    Ngôn ngữ và chứng chỉ
                  </h2>
                  <span className="text-xs font-normal text-slate-500">
                    Chứng chỉ không bắt buộc
                  </span>
                </div>
                {form.languageCertificates.map((row, index) => (
                  <div
                    key={index}
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <label className="text-xs font-bold text-slate-600">
                      Ngôn ngữ
                      <select
                        className="field mt-1"
                        value={row.language || ""}
                        onChange={(e) => changeLanguage(index, e.target.value)}
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang}>{lang}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Ảnh/PDF chứng chỉ (không bắt buộc)
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
                            "Đã có chứng chỉ tải lên"}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      className="btn-light !px-3"
                      onClick={() => removeLanguage(index)}
                      aria-label="Xóa ngôn ngữ"
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
                  <Plus size={15} /> Add ngôn ngữ
                </button>
                {!form.languageCertificates.length && (
                  <p className="mt-2 text-xs font-normal text-slate-500">
                    Chưa thêm ngôn ngữ. Nhấn “Add ngôn ngữ” để thêm.
                  </p>
                )}
              </div>
              <div className="text-sm font-bold text-slate-700 sm:col-span-2">
                <span>Trải nghiệm bạn tự tin (có thể chọn nhiều)</span>
                <MultiSelectDropdown
                  options={INTERESTS}
                  value={form.interests}
                  onChange={(value, checked) =>
                    changeMulti("interests", value, checked)
                  }
                  placeholder="Chọn trải nghiệm"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Chọn một hoặc nhiều trải nghiệm phù hợp với bạn.
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-slate-700 sm:col-span-2">
              <span>Ngôn ngữ bạn sử dụng</span>
              <MultiSelectDropdown
                options={LANGUAGES.map((language) => ({
                  value: language,
                  label: language,
                }))}
                value={form.languages}
                onChange={(value, checked) =>
                  changeMulti("languages", value, checked)
                }
                placeholder="Chọn ngôn ngữ"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Chọn một hoặc nhiều ngôn ngữ bạn sử dụng.
              </span>
            </div>
          )}
          {role === "local" && (
            <label className="text-sm font-bold text-slate-700">
              Giá dịch vụ mỗi giờ (VNĐ)
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
                Traveler sẽ dùng giá này để lọc ngân sách theo giờ.
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
              {saving ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
            <button
              type="button"
              className="btn-light"
              onClick={() => navigate("/")}
            >
              Xem HomePage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
