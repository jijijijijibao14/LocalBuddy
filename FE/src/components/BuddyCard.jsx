import { MapPin, Star, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function BuddyCard({
  buddy,
  experienceDate = "",
  experienceStart = "09:00",
  durationHours = "3",
}) {
  const buddyId = buddy.id || buddy._id;

  // Giữ nguyên bộ lọc Traveler đã chọn khi mở hồ sơ Local.
  const params = new URLSearchParams();

  if (experienceDate) params.set("date", experienceDate);
  if (experienceStart) params.set("startTime", experienceStart);
  if (durationHours) params.set("durationHours", String(durationHours));

  const detailUrl = `/buddy/${buddyId}?${params.toString()}`;

  return (
    <article className="panel group overflow-hidden transition hover:-translate-y-1 hover:shadow-soft">
      <Link to={detailUrl} className="block">
        <div className="relative overflow-hidden">
          <img
            className="buddy-image transition duration-300 group-hover:scale-[1.02]"
            src={buddy.coverImage || "/placeholder.jpg"}
            alt={buddy.fullName || "Local Buddy"}
          />

          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-brand">
            ✦ Local Mate
          </span>

          <span className="absolute bottom-3 right-3 rounded-lg bg-slate-900/70 px-2 py-1 text-xs font-bold text-white">
            <Star size={12} className="mr-1 inline fill-amber-300 text-amber-300" />
            {Number(buddy.rating ?? 5).toFixed(1)}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-extrabold text-navy">{buddy.fullName}</h3>
            <span className="pill shrink-0">
              <ShieldCheck size={11} />
              Đã xác minh
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} />
            {buddy.area || "Đà Nẵng, Việt Nam"}
          </p>

          <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">
            {buddy.bio || "Cùng bạn khám phá những góc Đà Nẵng thú vị như người bản địa."}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(buddy.interests?.length ? buddy.interests : buddy.categories || [])
              .slice(0, 2)
              .map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
                >
                  {item}
                </span>
              ))}
          </div>

          <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
            <div>
              <span className="text-[10px] text-slate-500">Chi phí dịch vụ</span>
              <p className="mt-0.5 text-base font-black text-brand">
                {Number(
                  buddy.pricePerHour ?? Math.round(Number(buddy.price || 300000) / 3)
                ).toLocaleString("vi-VN")}
                đ{" "}
                <span className="text-[10px] font-medium text-slate-500">/ giờ</span>
              </p>
            </div>
            <span className="btn-primary !px-3 !py-2">Xem hồ sơ</span>
          </div>
        </div>
      </Link>
    </article>
  );
}