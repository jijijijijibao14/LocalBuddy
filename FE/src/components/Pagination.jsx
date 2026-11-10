import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ result, onChange, previousLabel, nextLabel, pageLabel }) {
  return (
    <div className="flex items-center justify-end gap-3 p-4 text-sm">
      <button type="button" className="btn-light !p-2" disabled={result.page === 1}
        aria-label={previousLabel} onClick={() => onChange(result.page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span aria-live="polite">{pageLabel}</span>
      <button type="button" className="btn-light !p-2" disabled={result.page === result.pageCount}
        aria-label={nextLabel} onClick={() => onChange(result.page + 1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
