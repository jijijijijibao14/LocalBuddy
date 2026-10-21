import {
  Compass,
  Menu,
  UserRound,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  MapPin,
  Search,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);
  const navigate = useNavigate();
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
          console.error("Không tải được số yêu cầu đang chờ:", error);
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
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-[70px] flex-col gap-4 border-b bg-white p-5 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`}
        >
          <NavLink className="nav-link" to="/">
            Trang chủ
          </NavLink>
          {(!role || role === "traveler") && (
            <>
              <a className="nav-link" href="/#discover">
                Khám phá Buddy
              </a>
              <a className="nav-link" href="/#categories">
                Trải nghiệm
              </a>
              <Link className="nav-link" to="/local-safety-ekyc">
                An toàn & eKYC
              </Link>
            </>
          )}
          {token && user && (
            <Link className="nav-link" to="/profile">
              Hồ sơ của tôi
            </Link>
          )}

          {role === "local" && (
            <>
              <Link className="nav-link inline-flex items-center gap-2"
                to="/local-dashboard"
              >
                Quản lý dịch vụ

                {pendingBookings > 0 && (
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white">
                    {pendingBookings > 99 ? "99+" : pendingBookings}
                  </span>
                )}
              </Link>
              <Link className="nav-link" to="/local-safety-ekyc">
                An toàn & eKYC
              </Link>
            </>
          )}

          {role === "admin" && (
            <Link className="nav-link" to="/admin">
              Quản trị hệ thống
            </Link>
          )}
          <a className="nav-link" href="/#help">
            Trợ giúp
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {token && user ? (
            <>
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
                  · {user.fullName?.split(" ")[0] || "Tài khoản"}
                </span>
              </Link>
              <button
                className="btn-light hidden sm:flex"
                onClick={logout}
                title="Đăng xuất"
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-xs font-bold text-slate-600 sm:block"
              >
                Đăng nhập
              </Link>
              <Link to="/register" className="btn-primary !px-3 !py-2.5">
                Bắt đầu miễn phí
              </Link>
            </>
          )}
          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
