import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ScanText,
  Smartphone,
  ScanFace,
  Eye,
  FileSignature,
  CheckCircle2,
  LockKeyhole,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import api from "../services/api";

const STEPS = [
  {
    title: "Nhận dạng ký tự quang học (OCR)",
    shortTitle: "OCR CCCD",
    description:
      "Demo đọc và số hóa thông tin trên ảnh CCCD mặt trước và mặt sau.",
    detail: [
      "Đọc họ tên, ngày sinh và số định danh.",
      "Đọc thông tin quê quán, nơi thường trú và đặc điểm nhận dạng.",
      "Kiểm tra thông tin minh họa giữa hai mặt giấy tờ.",
    ],
    icon: ScanText,
    demo: "Đã mô phỏng trích xuất thông tin từ hai mặt CCCD.",
  },
  {
    title: "Đọc chip NFC",
    shortTitle: "NFC",
    description: "Demo quy trình đọc thông tin từ chip gắn trên thẻ căn cước.",
    detail: [
      "Đưa thẻ căn cước đến gần thiết bị có hỗ trợ NFC.",
      "Mô phỏng đọc dữ liệu chip và thông tin được mã hóa.",
      "Mô phỏng bước đối chiếu thông tin định danh.",
    ],
    icon: Smartphone,
    demo: "Đã mô phỏng quy trình đọc chip NFC.",
  },
  {
    title: "Nhận diện khuôn mặt (Face Matching)",
    shortTitle: "So khớp khuôn mặt",
    description:
      "Demo đối chiếu khuôn mặt với ảnh chân dung trên giấy tờ tùy thân.",
    detail: [
      "Mô phỏng lấy ảnh khuôn mặt từ camera.",
      "Mô phỏng so sánh khuôn mặt với ảnh trên giấy tờ.",
      "Hiển thị kết quả so khớp minh họa.",
    ],
    icon: ScanFace,
    demo: "Đã mô phỏng quy trình so khớp khuôn mặt.",
  },
  {
    title: "Phát hiện thể sống (Liveness Detection)",
    shortTitle: "Kiểm tra người thật",
    description: "Demo kiểm tra sự hiện diện của người thật trước camera.",
    detail: [
      "Mô phỏng yêu cầu chớp mắt.",
      "Mô phỏng yêu cầu mỉm cười hoặc quay đầu.",
      "Mô phỏng kiểm tra ảnh tĩnh và video phát lại.",
    ],
    icon: Eye,
    demo: "Đã mô phỏng bước kiểm tra thể sống.",
  },
  {
    title: "Ký điện tử (E-Signature)",
    shortTitle: "Ký điện tử",
    description:
      "Demo xác nhận đồng ý với biểu mẫu và điều khoản trên nền tảng.",
    detail: [
      "Đọc nội dung xác nhận và điều khoản demo.",
      "Xác nhận đồng ý hoàn tất quy trình.",
      "Ghi nhận bước ký điện tử mô phỏng.",
    ],
    icon: FileSignature,
    demo: "Đã mô phỏng xác nhận ký điện tử.",
  },
];

export default function LocalSafetyEKYC() {
  const [consent, setConsent] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [kycStatus, setKycStatus] = useState("Not Started");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get("/users/me")
      .then(({ data }) => {
        setKycStatus(data.user?.kycStatus || "Not Started");
      })
      .catch(() => {
        setError("Không tải được trạng thái eKYC.");
      });
  }, []);

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;
  const isVerified = kycStatus === "Verified";

  function confirmStep() {
    setCompletedSteps((old) =>
      old.includes(currentStep) ? old : [...old, currentStep],
    );
    setSuccess(step.demo);
    setError("");

    if (!isLastStep) {
      setCurrentStep((old) => old + 1);
      setSuccess("");
    }
  }

  async function finishDemo() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.patch("/users/me/kyc-demo/complete");

      setKycStatus(data.user?.kycStatus || "Verified");

      const oldUser = JSON.parse(localStorage.getItem("lb_user") || "{}");

      localStorage.setItem(
        "lb_user",
        JSON.stringify({
          ...oldUser,
          ...data.user,
        }),
      );

      window.dispatchEvent(new Event("lb-auth-change"));
      setSuccess(
        "Hoàn thành quy trình eKYC demo! Trạng thái tài khoản đã được cập nhật.",
      );
    } catch (e) {
      setError(e.response?.data?.message || "Không thể hoàn thành eKYC demo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-8">
      <Link
        to="/local-dashboard"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft size={16} />
        Quay lại trang Local
      </Link>

      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 to-emerald-600 p-6 text-white sm:p-9">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <ShieldCheck size={30} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">
                LOCAL BUDDY · TRUST & SAFETY
              </p>
              <h1 className="text-2xl font-black sm:text-3xl">
                An toàn và xác minh eKYC
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/90">
            Hoàn thành các bước xác minh demo để trải nghiệm quy trình bảo vệ
            danh tính dành cho Local trên nền tảng.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold">
            <LockKeyhole size={16} />
            Trạng thái: {kycStatus}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>Lưu ý về bản demo:</strong> Các bước bên dưới chỉ mô phỏng
          thao tác và kết quả. Không tải hoặc gửi CCCD thật, không đọc chip NFC
          thật, không đối chiếu dữ liệu với Bộ Công an/VNeID, không phân tích
          khuôn mặt và không tạo chữ ký số có giá trị pháp lý.
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-5">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const done = completedSteps.includes(index);

            return (
              <div
                key={item.shortTitle}
                className={`rounded-2xl border p-3 ${
                  currentStep === index
                    ? "border-blue-500 bg-blue-50"
                    : done
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon size={20} />
                  {done && (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  )}
                </div>
                <p className="mt-3 text-xs font-extrabold">Bước {index + 1}</p>
                <p className="mt-1 text-sm font-bold">{item.shortTitle}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          {isVerified ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={64} className="mx-auto text-emerald-600" />
              <h2 className="mt-4 text-2xl font-black text-navy">
                Demo eKYC đã hoàn thành
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Tài khoản đang có trạng thái Verified. Đây là trạng thái demo,
                không phải kết quả xác minh danh tính thực tế.
              </p>
              <Link
                to="/local-dashboard"
                className="btn-primary mt-6 inline-flex"
              >
                Về trang Local
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <StepIcon size={28} />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                    BƯỚC {currentStep + 1}/{STEPS.length}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-navy">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <h3 className="font-extrabold text-navy">Nội dung mô phỏng</h3>
                <ul className="mt-3 space-y-3">
                  {step.detail.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm leading-6 text-slate-700"
                    >
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {currentStep === 4 && (
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    Tôi xác nhận đồng ý hoàn tất quy trình eKYC demo và hiểu
                    rằng các thao tác xác minh ở đây chỉ là mô phỏng.
                  </span>
                </label>
              )}

              {error && (
                <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              {success && (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {success}
                </p>
              )}

              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  className="btn-light"
                  disabled={currentStep === 0 || loading}
                  onClick={() => {
                    setCurrentStep((old) => old - 1);
                    setError("");
                    setSuccess("");
                  }}
                >
                  <ArrowLeft size={16} />
                  Quay lại
                </button>

                {isLastStep ? (
                  completedSteps.includes(4) ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={loading || !consent}
                      onClick={finishDemo}
                    >
                      <ShieldCheck size={17} />
                      {loading ? "Đang hoàn thành..." : "Hoàn thành xác minh"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={confirmStep}
                    >
                      Xác nhận bước cuối
                      <ArrowRight size={16} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={confirmStep}
                  >
                    Xác nhận & tiếp tục
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-500">
                Bản demo không lưu ảnh CCCD, dữ liệu chip, ảnh khuôn mặt hoặc
                chữ ký. Chỉ trạng thái hoàn thành demo được cập nhật trên tài
                khoản.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
