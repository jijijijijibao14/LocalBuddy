import {
  Compass,
  Menu,
  UserRound,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  MapPin,
  Search,
  MessageCircle,
  Wallet,
  Languages,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { disconnectSocket } from "../utils/socket";
import NotificationBell from "./NotificationBell";
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);
  const navigate = useNavigate();
  const { language, languages, setLanguage } = useLocale();
  const { t } = useTranslation("common");
  const token = localStorage.getItem("lb_token");
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("lb_user") || "null");
  } catch {}
  const role = user?.role;
  useEffect(() => {
    const update = () => setAuthVersion((v) => v + 1);
    window.addEventListener("lb-auth-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("lb-auth-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    if (role !== "local" || !token) {
      setPendingBookings(0);
      return;
    }

    let cancelled = false;

    async function loadPendingBookings() {
      try {
        const { data } = await api.get("/bookings/local");

        if (!cancelled) {
          setPendingBookings(
            (Array.isArray(data) ? data : []).filter(
              (booking) => booking.status === "Pending"
            ).length
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(t("pendingBookingsError"), error);
        }
      }
    }

    loadPendingBookings();

    window.addEventListener("lb-bookings-change", loadPendingBookings);

    return () => {
      cancelled = true;
      window.removeEventListener("lb-bookings-change", loadPendingBookings);
    };
  }, [role, token, authVersion]);
  const homeLink =
    role === "admin"
      ? "/admin"
      : role === "local"
        ? "/local-dashboard"
        : "/dashboard";
  function logout() {
    disconnectSocket();
    localStorage.removeItem("lb_token");
    localStorage.removeItem("lb_user");
    window.dispatchEvent(new Event("lb-auth-change"));
    navigate("/");
  }
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="container-page flex h-[70px] items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
            <Compass size={22} />
          </span>
          <span className="leading-tight">
            <b className="block text-[17px] tracking-tight text-navy">
              LOCAL BUDDY
            </b>
            <small className="text-[10px] font-semibold text-emerald-600">
              ĐÀ NẴNG CITY
            </small>
          </span>
        </Link>
        <nav
          onClick={(event) => {
            if (event.target.closest("a, button")) setOpen(false);
          }}
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-[70px] max-h-[calc(100dvh-70px)] flex-col gap-4 overflow-y-auto border-b bg-white p-5 md:static md:max-h-none md:overflow-visible md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`}
        >
          <NavLink className="nav-link" to="/">
            {t("home")}
          </NavLink>
          {(!role || role === "traveler") && (
            <>
              <a className="nav-link" href="/#discover">
                {t("explore")}
              </a>
              <Link className="nav-link" to="/local-safety-ekyc">
                {t("safety")}
              </Link>
            </>
          )}

          {role === "local" && (
            <>
              <Link className="nav-link inline-flex items-center gap-2"
                to="/local-dashboard"
              >
                {t("services")}

                {pendingBookings > 0 && (
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white">
                    {pendingBookings > 99 ? "99+" : pendingBookings}
                  </span>
                )}
              </Link>
              <Link className="nav-link" to="/local-safety-ekyc">
                {t("safety")}
              </Link>
            </>
          )}

          {role === "traveler" && (
            <Link className="nav-link" to="/dashboard">
              <span>{t("bookings")}</span>
            </Link>
          )}

          {token && user && (
            <Link className="nav-link inline-flex items-center gap-1.5" to="/wallet">
              <span>{t("wallet")}</span>
            </Link>
          )}

          {token && user && (role === "local" || role === "traveler") && (
            <Link className="nav-link" to="/profile">
              {t("profile")}
            </Link>
          )}

          {role === "admin" && (
            <Link className="nav-link" to="/admin">
              {t("admin")}
            </Link>
          )}
          {token && role !== "admin" && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("lb-open-chat", { detail: { support: true } }))}
              className="nav-link cursor-pointer"
            >
              {t("help")}
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="sr-only">{t("language")}</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
              aria-label={t("language")}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {languages.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
        </nav>
        <div className="flex items-center gap-2">
          {token && user ? (
            <>
              <NotificationBell onNavigate={() => setOpen(false)} />
              <Link to={homeLink} className="btn-light hidden sm:flex">
                {role === "admin" ? (
                  <ShieldCheck size={15} />
                ) : role === "local" ? (
                  <MapPin size={15} />
                ) : (
                  <LayoutDashboard size={15} />
                )}
                <span>
                  {role === "admin"
                    ? "Admin"
                    : role === "local"
                      ? "Local"
                      : "Traveler"}{" "}
                  · {user.fullName?.split(" ")[0] || t("account")}
                </span>
              </Link>
              <button
                className="btn-light hidden sm:flex"
                onClick={logout}
                title={t("logout")}
              >
                <LogOut size={15} /> {t("logout")}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-xs font-bold text-slate-600 sm:block"
              >
                {t("login")}
              </Link>
              <Link to="/register" className="btn-primary !px-3 !py-2.5">
                {t("start")}
              </Link>
            </>
          )}
          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={t("openMenu")}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
