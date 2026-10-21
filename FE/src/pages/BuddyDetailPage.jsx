import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Languages,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Users,
  Utensils,
} from "lucide-react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

const defaultTimes = ["09:00 - 12:00", "13:00 - 16:00", "15:00 - 18:00"];

export default function BuddyDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [buddy, setBuddy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(
    searchParams.get("date") || ""
  );

  const [startTime, setStartTime] = useState(
    searchParams.get("startTime") || "09:00"
  );

  const [durationHours, setDurationHours] = useState(
    Number(searchParams.get("durationHours") || 3)
  );
  const [guestCount, setGuestCount] = useState("1");
  const [language, setLanguage] = useState("Tiếng Việt");
  const [foodBudget, setFoodBudget] = useState("150000");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  
  const endMinutes = (() => {
    const [hour, minute] = startTime.split(":").map(Number);
    return hour * 60 + minute + Number(durationHours) * 60;
  })();

  const endTime =
    Number.isFinite(endMinutes) && endMinutes <= 24 * 60
      ? `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
      : "";

  // Chỉ lấy lịch rảnh đúng ngày và đủ thời lượng đã chọn.
  const availableSlots = (buddy?.availability || [])
    .filter((slot) => {
      if (slot.date !== date) return false;

      const toMinutes = (value) => {
        const [hour, minute] = value.split(":").map(Number);
        return hour * 60 + minute;
      };

      const slotStart = toMinutes(slot.startTime);
      const slotEnd = toMinutes(slot.endTime);
      const selectedStart = toMinutes(startTime);
      const selectedEnd = selectedStart + Number(durationHours) * 60;

      return (
        slotEnd > slotStart &&
        selectedStart >= slotStart &&
        selectedEnd <= slotEnd
      );
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));


  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/buddies/${id}`)
      .then((response) => {
        if (!cancelled) setBuddy(response.data);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error.response?.data?.message ||
              "Không tải được hồ sơ Local Buddy.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function book() {
    if (!localStorage.getItem("lb_token")) {
      setNotice(
        "Vui lòng đăng nhập bằng tài khoản Traveler trước khi gửi yêu cầu.",
      );
      return;
    }
    if (!date) {
      setNotice("Vui lòng chọn ngày trải nghiệm.");
      return;
    }
    if (!endTime || endMinutes > 24 * 60) {
      setNotice("Khung giờ trải nghiệm không hợp lệ.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      await api.post("/bookings", {
        buddyId: buddy._id || buddy.id,
        date,
        startTime,
        endTime,
        durationHours: Number(durationHours),
        guestCount: Number(guestCount),
        language,
        foodBudget: Number(foodBudget),
        message,
      });
      setNotice(
        "Đã gửi yêu cầu đến Local. Bạn có thể theo dõi trạng thái trong phần quản lý lịch đặt.",
      );
    } catch (error) {
      setNotice(
        error.response?.data?.message ||
          "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="container-page py-12">Đang tải hồ sơ Local Buddy...</div>
    );
  if (!buddy) {
    return (
      <div className="container-page py-12">
        <p className="panel p-8 text-center">
          {notice || "Không tìm thấy hồ sơ Local Buddy."}
        </p>
        <Link to="/" className="btn-primary mt-4">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft size={14} /> Danh sách Local Buddy
      </Link>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_350px]">
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="relative">
              <img
                src={buddy.coverImage}
                alt={buddy.fullName}
                className="h-[250px] w-full object-cover sm:h-[340px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4 text-white">
                <div>
                  <span className="pill">
                    <ShieldCheck size={12} className="mr-1 inline" /> Đã xác
                    minh
                  </span>
                  <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                    {buddy.fullName}
                  </h1>
                  <p className="mt-1 flex items-center gap-1 text-xs text-blue-50">
                    <MapPin size={13} />
                    {buddy.area}
                  </p>
                </div>
                <span className="ml-auto hidden rounded-xl bg-white/20 p-3 text-sm font-black backdrop-blur sm:block">
                  <Star
                    size={14}
                    className="mr-1 inline fill-amber-300 text-amber-300"
                  />
                  {Number(buddy.rating || 0).toFixed(1)}/5
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
              {(buddy.interests?.length
                ? buddy.interests
                : buddy.categories || []
              ).map((item) => (
                <span
                  className="rounded-full bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="p-5 sm:p-7">
              <p className="eyebrow">Lời giới thiệu</p>
              <h2 className="mt-2 text-xl font-extrabold">
                Khám phá Đà Nẵng cùng người địa phương
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {buddy.bio || "Local Buddy đang cập nhật phần giới thiệu."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-blue-50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <Languages size={16} className="text-brand" />
                    Ngôn ngữ giao tiếp
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(buddy.languages || ["Tiếng Việt"]).map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-white px-2 py-1.5 text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Thông tin gói
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-600">
                    <li>✓ Thời lượng: 3 giờ</li>
                    <li>✓ Lịch trình điều chỉnh theo sở thích</li>
                    <li>✓ Nhóm vận hành xác nhận lịch thủ công</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
          <section className="panel p-5 sm:p-7">
            <h2 className="font-extrabold">
              Gói trải nghiệm: Khám phá địa phương trong 3 giờ
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Buddy gợi ý quán ăn, quán cà phê hoặc điểm đến dựa trên sở thích
              của bạn. Lịch trình cụ thể sẽ được trao đổi sau khi nhóm vận hành
              kiểm tra yêu cầu.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-extrabold text-emerald-800">
                  ĐÃ BAO GỒM
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>• Đồng hành cùng Local Buddy trong 3 giờ</li>
                  <li>• Gợi ý lịch trình theo sở thích</li>
                  <li>• Hỗ trợ khám phá địa phương</li>
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-extrabold text-amber-800">
                  CHƯA BAO GỒM
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  <li>• Đồ ăn và thức uống</li>
                  <li>• Vé tham quan</li>
                  <li>• Chi phí di chuyển cá nhân</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
        <aside className="panel p-5 lg:sticky lg:top-[88px]">
          <p className="eyebrow">Mức chi phí đồng hành</p>
          <p className="mt-1 text-3xl font-black text-brand">
            {Number(
              buddy.pricePerHour ?? Math.round(Number(buddy.price || 0) / 3),
            ).toLocaleString("vi-VN")}
            đ <span className="text-xs font-medium text-slate-500">/ giờ</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Giá dịch vụ Buddy, chưa bao gồm ăn uống và vé tham quan.
          </p>
          <div className="my-5 border-t border-slate-100" />
          <h1 className="text-xl font-bold to-blue-600">
            Thông tin đặt lịch
          </h1>
          <label className="text-xs font-bold">
            Ngày trải nghiệm
            <input
              className="field mt-2"
              type="date"
              min={new Date().toLocaleDateString("en-CA")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-navy">
              <Clock size={16} className="text-brand" />
              Thời gian Local đang rảnh
            </h3>

            {!date ? (
              <p className="mt-2 text-xs text-slate-600">
                Vui lòng chọn ngày để xem lịch rảnh của Local.
              </p>
            ) : availableSlots.length === 0 ? (
              <p className="mt-2 text-xs leading-5 text-amber-800">
                Chưa có khung giờ rảnh phù hợp với ngày và thời lượng bạn chọn.
                Hãy chọn ngày hoặc thời lượng khác.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                    type="button"
                    onClick={() => setStartTime(slot.startTime)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                      startTime === slot.startTime
                        ? "border-brand bg-brand text-white"
                        : "border-blue-200 bg-white text-navy hover:border-brand"
                    }`}
                  >
                    {slot.startTime} – {slot.endTime}
                  </button>
                ))}
              </div>
            )}

            <p className="mt-3 text-[11px] leading-5 text-slate-500">
              Khung giờ thực tế sẽ được Backend kiểm tra lại khi bạn gửi yêu cầu.
            </p>
          </div>
          
          <label className="mt-4 block text-xs font-bold">
            Thời lượng trải nghiệm
            <select
              className="field mt-2"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 8, 12].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} giờ
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-xs font-bold">
            Từ (giờ)
            <select
              className="field mt-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            >
              {Array.from({ length: 24 }, (_, hour) => hour)
                .filter((hour) => hour + durationHours <= 24)
                .map((hour) => {
                  const value = `${String(hour).padStart(2, "0")}:00`;
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  );
                })}
            </select>
          </label>

          <label className="mt-4 block text-xs font-bold">
            Đến (giờ)
            <div className="field mt-2 flex items-center">
              {endTime || "Không hợp lệ"}
            </div>
            <p className="mt-1 text-xs font-normal text-slate-500">
              Tự tính theo giờ bắt đầu và thời lượng đã chọn.
            </p>
          </label>

          <label className="mt-4 block text-xs font-bold">
            <Users size={13} className="mr-1 inline" />
            Số lượng khách
            <select
              className="field mt-2"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} người
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            Ngôn ngữ
            <select
              className="field mt-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {(buddy.languages?.length ? buddy.languages : ["Tiếng Việt"]).map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            <Utensils size={13} className="mr-1 inline" />
            Ngân sách ăn uống dự kiến / người
            <select
              className="field mt-2"
              value={foodBudget}
              onChange={(e) => setFoodBudget(e.target.value)}
            >
              <option value="0">Chưa xác định</option>
              <option value="100000">100.000đ</option>
              <option value="150000">150.000đ</option>
              <option value="250000">250.000đ</option>
              <option value="350000">350.000đ</option>
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
            Lời nhắn / sở thích / yêu cầu
            <textarea
              className="field mt-2 min-h-20"
              maxLength={1000}
              placeholder="Ví dụ: món chay, dị ứng thực phẩm, điểm muốn ghé..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            disabled={submitting}
            className="btn-primary mt-4 w-full"
            onClick={book}
          >
            <CalendarDays size={15} />{" "}
            {submitting ? "Đang gửi..." : "Gửi yêu cầu trải nghiệm"}
          </button>
          <Link to="/login" className="btn-green mt-2 w-full">
            <MessageCircle size={15} /> Chat trực tiếp (đăng nhập)
          </Link>
          {notice && (
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-brand">
              {notice}
            </p>
          )}
          <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <ShieldCheck size={15} className="mr-1 inline" /> Chưa thanh toán
            online. Nhóm vận hành sẽ kiểm tra lịch Buddy và xác nhận thủ công.
          </div>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <Clock size={13} />
            Phản hồi thường trong vòng 24 giờ
          </p>
        </aside>
      </div>
    </div>
  );
}
