import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";

export default function BuddyVerificationGate({ children }) {
  const { t } = useTranslation("ekyc");
  const location = useLocation();
  const token = localStorage.getItem("lb_token");
  const [result, setResult] = useState({ token: null, status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get("/users/me").then(({ data }) => {
      if (active) {
        setResult({
          token,
          status: !data.user?.role ? "error"
            : data.user.role === "traveler" && data.user.kycStatus !== "Verified"
              ? "verify"
              : "allowed",
        });
      }
    }).catch(() => {
      if (active) setResult({ token, status: "error" });
    });
    return () => { active = false; };
  }, [token, attempt]);

  if (!token) return children;
  if (result.token !== token || result.status === "loading") {
    return <div className="container-page py-12">{t("checkingStatus")}</div>;
  }
  if (result.status === "error") {
    return <div className="container-page py-12" role="alert">
      <p>{t("loadError")}</p>
      <button type="button" className="btn-light mt-3" onClick={() => setAttempt((value) => value + 1)}>
        {t("retry")}
      </button>
    </div>;
  }
  if (result.status === "verify") {
    return <Navigate to="/local-safety-ekyc" replace state={{ verificationRequired: true, returnTo: location.pathname + location.search }} />;
  }
  return children;
}
