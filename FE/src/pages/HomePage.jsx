import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import BuddyCard from "../components/BuddyCard";
import api from "../services/api";
import {
  filterBuddies,
  normalizeLanguage,
} from "../utils/buddyFilters";

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

export default function HomePage() {
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
            error.response?.data?.message ||
              "Không thể tải danh sách Local. Vui lòng thử lại.",
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
        ...LANGUAGES,
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
                100% LOCAL BUDDY ĐỊA PHƯƠNG
              </span>
              <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight text-navy sm:text-5xl">
                Tìm <span className="text-brand">“Bạn Đồng Hành”</span> bản địa
                khám phá Đà Nẵng
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600">
                Chạm vào nhịp sống địa phương, thưởng thức món ngon và khám phá
                những góc thành phố theo cách riêng của bạn.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#discover" className="btn-primary">
                  Khám phá Local Buddy <ArrowRight size={16} />
                </a>
                <a href="#how" className="btn-light">
                  Cách hoạt động
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  Hồ sơ xác minh
                </span>
                <span className="flex items-center gap-1">
                  <Users size={15} className="text-emerald-600" />
                  Cộng đồng thân thiện
                </span>
              </div>
            </div>
            <div className="relative">
              <img
                className="h-64 w-full rounded-2xl object-cover shadow-soft sm:h-80"
                src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1100&q=85"
                alt="Khám phá thành phố Đà Nẵng"
              />
              <div className="absolute -bottom-3 left-3 rounded-xl bg-white p-3 shadow-soft sm:left-5">
                <p className="text-xs font-bold text-navy">
                  Trải nghiệm như người bản địa
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  An toàn · Gần gũi · Đáng nhớ
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
              title: "Khám phá",
              desc: "Tìm người bạn địa phương theo sở thích, khu vực và ngân sách.",
            },
            {
              n: "02",
              title: "Kết nối",
              desc: "Xem hồ sơ, đọc đánh giá và gửi yêu cầu trải nghiệm.",
            },
            {
              n: "03",
              title: "Tận hưởng",
              desc: "Gặp gỡ an toàn, khám phá Đà Nẵng theo cách của riêng bạn.",
            },
          ].map((x) => (
            <div key={x.n} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 font-black text-brand">
                {x.n}
              </span>
              <div>
                <h3 className="font-extrabold">{x.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {x.desc}
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
                Sẵn sàng cho trải nghiệm tiếp theo?
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Tìm Local phù hợp, gửi yêu cầu đặt lịch và theo dõi chuyến đi
                của bạn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/profile" className="btn-light">
                Hồ sơ của tôi
              </Link>
              <Link to="/dashboard" className="btn-primary">
                Lịch đặt & ví của tôi <ArrowRight size={15} />
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
                Chào mừng đến với LocalBuddy, Bước đầu bạn hãy hoàn thiện
                profile nha!
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Hoàn thiện thông tin cá nhân để khách hàng hiểu bạn hơn và có
                thể tìm thấy bạn.
              </p>
            </div>

            <Link to="/profile" className="btn-green">
              Hoàn thiện profile <ArrowRight size={15} />
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
                Xin chào quản trị viên, {currentUser?.fullName || "Admin"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Quản lý tài khoản, Local Buddy và yêu cầu đặt lịch từ khu vực
                quản trị.
              </p>
            </div>
            <Link to="/admin" className="btn-primary">
              Mở bảng quản trị <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
      {(!role || role === "traveler") && (
        <>
          <section className="container-page -mt-1">
            <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">
                Bạn muốn khám phá gì?
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="Ẩm thực">Ẩm thực</option>
                  <option value="cà phê">Cà phê</option>
                  <option value="du lịch">Du lịch</option>
                </select>
              </label>

              <label className="text-xs font-bold text-slate-600">
                Khu vực trải nghiệm
                <span className="mt-2 flex items-center gap-2">
                  <MapPin size={15} className="text-brand" />
                  <select
                    className="field"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option>Tất cả khu vực</option>
                    {AREAS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <label className="text-xs font-bold text-slate-600">
                Ngôn ngữ
                <select
                  className="field mt-2"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option>Tất cả ngôn ngữ</option>
                  {availableLanguages.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold text-slate-600">
                Ngân sách tối đa / giờ
                <select
                  className="field mt-2"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                >
                  <option value="">Không giới hạn</option>
                  <option value="50000">50.000đ/giờ</option>
                  <option value="100000">100.000đ/giờ</option>
                  <option value="150000">150.000đ/giờ</option>
                  <option value="200000">200.000đ/giờ</option>
                  <option value="300000">300.000đ/giờ</option>
                </select>
              </label>
            
              <label className="text-xs font-bold text-slate-600">
                Ngày trải nghiệm
                <input
                  type="date"
                  className="field mt-2"
                  min={new Date().toISOString().slice(0, 10)}
                  value={experienceDate}
                  onChange={(e) => setExperienceDate(e.target.value)}
                />
              </label>

              <label className="text-xs font-bold text-slate-600">
                Giờ bắt đầu
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
                Thời lượng
                <select
                  className="field mt-2"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 8, 12].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} giờ
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
                <Search size={15} /> Xem Local phù hợp
              </button>
            </div>
          </section>
          {/* <section id="categories" className="container-page pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Trải nghiệm theo sở thích</p>
                <h2 className="section-title mt-1">Chọn phong cách của bạn</h2>
              </div>
              <SlidersHorizontal size={19} className="text-slate-400" />
            </div>
            <div className="mt-4 max-w-md">
              <label className="block text-xs font-bold text-slate-600">
                Chọn sở thích trải nghiệm
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="field mt-2"
                >
                  <option value="Tất cả">Tất cả sở thích</option>
                  <option value="Ẩm thực">Ẩm thực (Food)</option>
                  <option value="cà phê">Cà phê</option>
                  <option value="du lịch">Du lịch</option>
                </select>
              </label>
            </div>
          </section> */}
          <section id="discover" className="container-page pt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Kết nối với người địa phương</p>
                <h2 className="section-title mt-1">
                  Tìm thấy {filtered.length} Local Buddy phù hợp · Bạn muốn trải
                  nghiệm {durationHours} giờ
                </h2>
                <p className="mt-2 text-xs text-slate-500">
                  Kết quả dựa trên sở thích, khu vực, ngôn ngữ, ngân sách và
                  lịch rảnh tại ngày/giờ bạn chọn. Thời lượng chỉ dùng để tính
                  giá khi đặt trải nghiệm. Danh sách chỉ hiển thị Local đang
                  hoạt động và đã được Admin xác minh.
                </p>
              </div>
              <span className="btn-light">
                <ShieldCheckIcon /> Hồ sơ đã xác minh
              </span>
            </div>
            {loadingBuddies && (
              <div className="panel mt-5 p-8 text-center text-sm text-slate-500">
                Đang tìm Local phù hợp...
              </div>
            )}

            {buddyError && (
              <div className="panel mt-5 p-8 text-center">
                <p className="font-bold text-red-600">{buddyError}</p>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={() => window.location.reload()}
                >
                  Thử tải lại
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
                    ? "Hiện chưa có hồ sơ Local đang hoạt động và đã xác minh"
                    : "Chưa tìm thấy Local Buddy phù hợp"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                {buddies.length === 0
                  ? "Local cần được quản trị viên xác minh và kích hoạt thì mới xuất hiện."
                  : "Hãy thử đổi sở thích, khu vực, ngôn ngữ, ngày/giờ bắt đầu hoặc mở rộng ngân sách. Hồ sơ Local mới chỉ xuất hiện sau khi Admin xác minh."}
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
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <section id="experiences" className="container-page pt-10">
        <div className="mb-5">
          <p className="eyebrow">GÓI TRẢI NGHIỆM MVP</p>
          <h2 className="section-title mt-1">Chọn trải nghiệm theo sở thích</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Các gói được thiết kế cho nhóm nhỏ. Giá dịch vụ cụ thể hiển thị trên
            hồ sơ từng Buddy; chi phí ăn uống, vé tham quan và di chuyển cá nhân
            chưa bao gồm.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Food Buddy",
              category: "Ẩm thực",
              emoji: "🍜",
              desc: "Khám phá món ngon địa phương, quán ăn gia đình và chợ truyền thống.",
              plan: "3 giờ · lịch trình theo khẩu vị",
            },
            {
              title: "Cà phê địa phương",
              category: "cà phê",
              emoji: "☕",
              desc: "Ghé quán cà phê bản địa, tìm góc thư giãn và trò chuyện cùng người địa phương.",
              plan: "3 giờ · linh hoạt điểm dừng",
            },
            {
              title: "Dạo quanh Đà Nẵng",
              category: "du lịch",
              emoji: "🏝️",
              desc: "Khám phá khu vực, điểm tham quan và các góc thành phố theo sở thích.",
              plan: "3 giờ · điều chỉnh lịch trình",
            },
          ].map((item) => (
            <article key={item.category} className="panel p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-2xl">
                {item.emoji}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-navy">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.desc}
              </p>
              <p className="mt-3 text-xs font-bold text-brand">{item.plan}</p>
              <p className="mt-2 text-xs text-slate-500">
                Bao gồm: đồng hành cùng Buddy và gợi ý lịch trình. Chưa bao gồm:
                đồ ăn, thức uống, vé tham quan và chi phí cá nhân.
              </p>
              <button
                type="button"
                className="btn-light mt-4"
                onClick={() => {
                  setCategory(item.category);
                  document
                    .getElementById("discover")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Tìm Buddy phù hợp <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section id="safety" className="container-page pt-8">
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#075f88] p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-bold text-emerald-200">
              LOCAL BUDDY · AN TOÀN LÀ ƯU TIÊN
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Gặp gỡ địa phương, an tâm trải nghiệm
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-blue-100">
              Hồ sơ, đánh giá cộng đồng và quy trình xác minh giúp bạn lựa chọn
              người đồng hành phù hợp hơn.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-xs font-extrabold text-brand"
          >
            Tham gia Local Buddy <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
function ShieldCheckIcon() {
  return <CheckCircle2 size={14} />;
}
