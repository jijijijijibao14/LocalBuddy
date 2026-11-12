import { useEffect, useRef } from "react";

export default function BookingDetailsModal({ title, closeLabel, fields, onClose, children }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-navy/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="panel my-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto p-5 sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{title}</p>
            <h2 id="booking-detail-title" className="mt-1 text-xl font-black text-navy">
              {fields[0]?.value}
            </h2>
          </div>
          <button type="button" className="btn-light !py-2" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {fields.slice(1).map((field) => (
            <div key={field.label} className={field.fullWidth ? "sm:col-span-2" : ""}>
              <dt className="text-slate-500">{field.label}</dt>
              <dd className="mt-0.5 break-words font-bold text-navy">{field.value || "—"}</dd>
            </div>
          ))}
        </dl>
        {children && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{children}</div>}
      </section>
    </div>
  );
}
