import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  ChartNoAxesCombined,
} from "lucide-react";
import api from "../services/api";
export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    buddies: 0,
    bookings: 0,
    transactions: 0,
  });
  const [users, setUsers] = useState([]);
  const [buddies, setBuddies] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");
  async function load() {
    try {
      const [s, u, bp, b] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/buddies"),
        api.get("/admin/bookings"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setBuddies(bp.data);
      setBookings(b.data);
      setMessage("");
    } catch (e) {
      setMessage(
        e.response?.data?.message ||
          "Không tải được dữ liệu Admin. Hãy đăng nhập bằng tài khoản Admin được seed.",
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function changeStatus(id, status) {
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, status } : u)),
      );
    } catch (e) {
      setMessage(e.response?.data?.message || "Không cập nhật được trạng thái");
    }
  }
  async function changeBuddyVerification(id, verified) {
    try {
      await api.patch(`/admin/buddies/${id}/verification`, { verified });
      setBuddies((prev) =>
        prev.map((buddy) =>
          buddy._id === id ? { ...buddy, verified } : buddy,
        ),
      );
      setMessage(
        verified ? "Đã xác minh hồ sơ Buddy." : "Đã bỏ xác minh hồ sơ Buddy.",
      );
    } catch (e) {
      setMessage(
        e.response?.data?.message || "Không cập nhật được xác minh Buddy.",
      );
    }
  }
  async function changeBooking(id, status) {
    try {
      await api.patch(`/admin/bookings/${id}`, { status });
      setBookings((prev) =>
        prev.map((b) => (b._id === id ? { ...b, status } : b)),
      );
    } catch (e) {
      setMessage(e.response?.data?.message || "Không cập nhật được đặt lịch");
    }
  }
  return (
    <div className="container-page py-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="pill">
            <Activity size={12} /> ADMIN COMMAND CENTER
          </span>
          <h1 className="mt-3 text-2xl font-black text-navy sm:text-3xl">
            Bảng điều khiển quản trị
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Theo dõi người dùng, hồ sơ Local Buddy và yêu cầu trải nghiệm.
          </p>
        </div>
        <button className="btn-primary" onClick={load}>
          <RefreshCw size={15} /> Làm mới dữ liệu
        </button>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tổng người dùng", value: stats.users, icon: Users },
          { label: "Local Buddy", value: stats.buddies, icon: ShieldCheck },
          {
            label: "Yêu cầu đặt lịch",
            value: stats.bookings,
            icon: ClipboardList,
          },
          { label: "Giao dịch", value: stats.transactions, icon: Wallet },
        ].map((x) => (
          <div key={x.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {x.label}
              </span>
              <x.icon className="text-brand" size={19} />
            </div>
            <p className="mt-3 text-3xl font-black text-navy">
              {Number(x.value || 0).toLocaleString("vi-VN")}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-700">
              <ChartNoAxesCombined size={12} /> Dữ liệu hiện tại
            </p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-2xl bg-[#056b98] p-6 text-white sm:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-extrabold text-emerald-200">
              QUẢN TRỊ AN TOÀN
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Chủ động kiểm soát cộng đồng
            </h2>
            <p className="mt-2 text-xs leading-5 text-blue-100">
              Quản lý trạng thái tài khoản và yêu cầu trải nghiệm từ một nơi.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Xác minh", "Kiểm tra hồ sơ"],
              ["Điều phối", "Theo dõi yêu cầu"],
              ["Bảo vệ", "Quản lý tài khoản"],
            ].map((x) => (
              <div key={x[0]} className="rounded-xl bg-white/10 p-4">
                <CheckCircle2 size={18} className="text-emerald-200" />
                <p className="mt-3 font-bold">{x[0]}</p>
                <p className="mt-1 text-[11px] text-blue-100">{x[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">Quản lý tài khoản</h2>
            <p className="mt-1 text-xs text-slate-500">
              Duyệt, tạm khóa hoặc kích hoạt tài khoản.
            </p>
          </div>
          <span className="pill">{users.length} tài khoản</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Người dùng</th>
                <th className="p-4">Vai trò</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr className="border-t border-slate-100" key={u._id}>
                  <td className="p-4">
                    <b>{u.fullName}</b>
                    <p className="mt-1 text-slate-500">{u.email}</p>
                  </td>
                  <td className="p-4">{u.role}</td>
                  <td className="p-4">
                    <span className="pill">{u.status}</span>
                  </td>
                  <td className="p-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="p-4">
                    <select
                      className="field !w-32 !py-2"
                      value={u.status}
                      onChange={(e) => changeStatus(u._id, e.target.value)}
                    >
                      <option>Active</option>
                      <option>Pending Approval</option>
                      <option>Rejected</option>
                      <option>Suspended</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              Chưa có dữ liệu tài khoản.
            </p>
          )}
        </div>
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-extrabold">Duyệt hồ sơ Food Buddy</h2>
            <p className="mt-1 text-xs text-slate-500">
              Chỉ hồ sơ đã xác minh mới xuất hiện trong danh sách công khai.
            </p>
          </div>
          <span className="pill">
            {buddies.filter((item) => item.verified).length}/{buddies.length} đã
            xác minh
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Buddy</th>
                <th className="p-4">Sở thích</th>
                <th className="p-4">Khu vực</th>
                <th className="p-4">Trạng thái xác minh</th>
                <th className="p-4">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {buddies.map((buddy) => (
                <tr className="border-t border-slate-100" key={buddy._id}>
                  <td className="p-4">
                    <b>{buddy.fullName}</b>
                    <p className="mt-1 text-slate-500">
                      {buddy.user?.email || "Chưa có email"}
                    </p>
                  </td>
                  <td className="p-4">
                    {(buddy.interests?.length
                      ? buddy.interests
                      : buddy.categories || []
                    ).join(", ") || "Chưa khai báo"}
                  </td>
                  <td className="p-4">{buddy.area}</td>
                  <td className="p-4">
                    <span className="pill">
                      {buddy.verified ? "Đã xác minh" : "Chờ xác minh"}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      className={
                        buddy.verified ? "btn-light !py-2" : "btn-primary !py-2"
                      }
                      onClick={() =>
                        changeBuddyVerification(buddy._id, !buddy.verified)
                      }
                    >
                      {buddy.verified ? "Bỏ xác minh" : "Xác minh hồ sơ"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!buddies.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              Chưa có hồ sơ dịch vụ Local. Local cần lưu hồ sơ để tạo hồ sơ công
              khai.
            </p>
          )}
        </div>
      </section>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-extrabold">Yêu cầu trải nghiệm gần đây</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật trạng thái yêu cầu đặt lịch.
            </p>
          </div>
          <ArrowDownToLine size={18} className="text-brand" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Local Buddy</th>
                <th className="p-4">Ngày / giờ</th>
                <th className="p-4">Chi tiết yêu cầu</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-t border-slate-100">
                  <td className="p-4">
                    <b>{b.customer?.fullName || "Khách hàng"}</b>
                    <p className="mt-1 text-slate-500">
                      {b.customer?.email || ""}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {b.customer?.phone || ""}
                    </p>
                  </td>
                  <td className="p-4">{b.buddy?.fullName || "Local Buddy"}</td>
                  <td className="p-4">
                    {new Date(b.date).toLocaleDateString("vi-VN")}
                    <p className="mt-1 text-slate-500">{b.time}</p>
                  </td>
                  <td className="p-4">
                    {b.guestCount || 1} khách · {b.language || "Tiếng Việt"}
                    <p className="mt-1 text-slate-500">
                      Dịch vụ: {Number(b.price || 0).toLocaleString("vi-VN")}đ
                    </p>
                    <p className="mt-1 text-slate-500">
                      Ăn uống/người:{" "}
                      {Number(b.foodBudget || 0).toLocaleString("vi-VN")}đ
                    </p>
                    {b.message && (
                      <p className="mt-1 max-w-xs whitespace-pre-wrap text-slate-600">
                        Ghi chú: {b.message}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="pill">{b.status}</span>
                  </td>
                  <td className="p-4">
                    <select
                      className="field !w-36 !py-2"
                      value={b.status}
                      onChange={(e) => changeBooking(b._id, e.target.value)}
                    >
                      <option>Pending</option>
                      <option>Confirmed</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bookings.length && (
            <p className="p-8 text-center text-xs text-slate-500">
              Chưa có yêu cầu đặt lịch.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
