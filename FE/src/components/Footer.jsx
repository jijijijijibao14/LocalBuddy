import {
  Compass,
  Facebook,
  Instagram,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
export default function Footer() {
  return (
    <footer id="help" className="mt-16 border-t border-blue-100 bg-[#edf3ff]">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
              <Compass size={20} />
            </span>
            <b className="text-sm text-navy">LOCAL BUDDY</b>
          </Link>
          <p className="mt-4 max-w-xs text-xs leading-6 text-slate-600">
            Khám phá Đà Nẵng cùng người bản địa. Kết nối những trải nghiệm chân
            thật, an toàn và đáng nhớ.
          </p>
          <span className="pill mt-3">
            <ShieldCheck size={12} />
            100% trải nghiệm địa phương
          </span>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">Quận & Huyện hỗ trợ</h3>
          <ul className="space-y-2 text-xs leading-5 text-slate-600">
            <li>Hải Châu & Thanh Khê</li>
            <li>Sơn Trà & Ngũ Hành Sơn</li>
            <li>Liên Chiểu & Hòa Vang</li>
            <li>Hội An và các vùng lân cận</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">An toàn & Pháp lý</h3>
          <ul className="space-y-2 text-xs leading-5 text-slate-600">
            <li>Quy trình xác minh eKYC</li>
            <li>Chính sách bảo mật thông tin</li>
            <li>Điều khoản sử dụng dịch vụ</li>
            <li>Quy định cộng đồng</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">
            Hỗ trợ khách hàng 24/7
          </h3>
          <p className="text-xs leading-5 text-slate-600">
            Đội ngũ hỗ trợ đồng hành cùng bạn trong suốt hành trình.
          </p>
          <a
            className="mt-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-white p-3 text-xs font-bold text-rose-600"
            href="tel:19006836"
          >
            <Phone size={15} />
            HOTLINE HỖ TRỢ: 1900 6836
          </a>
          <div className="mt-3 flex gap-3 text-slate-500">
            <Facebook size={17} />
            <Instagram size={17} />
            <Mail size={17} />
          </div>
        </div>
      </div>
      <div className="border-t border-blue-100">
        <div className="container-page flex flex-wrap justify-between gap-3 py-4 text-[10px] text-slate-500">
          <span>
            © 2026 Local Buddy Đà Nẵng. Nền tảng kết nối trải nghiệm địa phương.
          </span>
          <span>
            Điều khoản dịch vụ · Bảo mật thông tin · Trung tâm trợ giúp
          </span>
        </div>
      </div>
    </footer>
  );
}
