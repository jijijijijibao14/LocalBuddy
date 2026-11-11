import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { mediaUrl } from "../services/api";

export default function CertificateModal({ certificate, onClose, t }) {
  const dialogRef = useRef(null);
  const [useDocumentPreview, setUseDocumentPreview] = useState(false);
  const url = mediaUrl(certificate.certificateUrl);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  function close() {
    dialogRef.current.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="certificate-dialog-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl backdrop:bg-navy/70 sm:p-6"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="certificate-dialog-title" className="font-extrabold text-navy">
          {t("certificateAlt", { language: certificate.language })}
        </h2>
        <button type="button" className="btn-light !p-2" onClick={close} aria-label={t("closeCertificate")}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {useDocumentPreview ? (
        <object
          data={url}
          aria-label={t("certificateAlt", { language: certificate.language })}
          className="mx-auto block h-[65dvh] max-h-[70dvh] w-full rounded-lg"
        >
          <p className="p-4 text-center text-sm text-slate-600">{t("certificatePreviewUnavailable")}</p>
        </object>
      ) : (
        <div className="flex max-h-[70dvh] justify-center" onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <img
            src={url}
            alt={t("certificateAlt", { language: certificate.language })}
            className="max-h-[70dvh] max-w-full object-contain"
            onError={() => setUseDocumentPreview(true)}
          />
        </div>
      )}
    </dialog>
  );
}
