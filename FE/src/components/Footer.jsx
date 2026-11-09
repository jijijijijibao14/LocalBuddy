import {
  Compass,
  Facebook,
  Instagram,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
export default function Footer() {
  const { t } = useTranslation("footer");
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
            {t("description")}
          </p>
          <span className="pill mt-3">
            <ShieldCheck size={12} />
            {t("localExperiences")}
          </span>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">{t("districts")}</h3>
          <ul className="space-y-2 text-xs leading-5 text-slate-600">
            <li>{t("districtHaiChau")}</li>
            <li>{t("districtSonTra")}</li>
            <li>{t("districtLienChieu")}</li>
            <li>{t("districtHoiAn")}</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">{t("safetyLegal")}</h3>
          <ul className="space-y-2 text-xs leading-5 text-slate-600">
            <li>{t("ekyc")}</li>
            <li>{t("privacy")}</li>
            <li>{t("terms")}</li>
            <li>{t("community")}</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold">
            {t("supportTitle")}
          </h3>
          <p className="text-xs leading-5 text-slate-600">
            {t("supportDescription")}
          </p>
          <a
            className="mt-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-white p-3 text-xs font-bold text-rose-600"
            href="tel:19006836"
          >
            <Phone size={15} />
            {t("hotline", { number: "1900 6836" })}
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
            {t("copyright")}
          </span>
          <span>
            {t("footerLinks")}
          </span>
        </div>
      </div>
    </footer>
  );
}
