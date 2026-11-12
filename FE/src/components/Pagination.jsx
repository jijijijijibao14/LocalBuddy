import { ChevronLeft, ChevronRight } from "lucide-react";

function getVisiblePages(page, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount]);
  for (let current = Math.max(2, page - 1); current <= Math.min(pageCount - 1, page + 1); current += 1) {
    pages.add(current);
  }

  const visiblePages = [];
  let previousPage = 0;
  [...pages].sort((a, b) => a - b).forEach((current) => {
    if (current - previousPage === 2) {
      visiblePages.push(current - 1);
    } else if (current - previousPage > 2) {
      visiblePages.push(null);
    }
    visiblePages.push(current);
    previousPage = current;
  });
  return visiblePages;
}

export default function Pagination({
  result,
  onChange,
  previousLabel,
  nextLabel,
  pageLabel,
  showPageNumbers = false,
}) {
  const visiblePages = showPageNumbers
    ? getVisiblePages(result.page, result.pageCount)
    : [];

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 p-4 text-sm">
      <button type="button" className="btn-light !p-2" disabled={result.page === 1}
        aria-label={previousLabel} onClick={() => onChange(result.page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {visiblePages.map((page, index) => page === null ? (
        <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
          ...
        </span>
      ) : (
        <button
          key={page}
          type="button"
          className={result.page === page ? "btn-primary !px-3 !py-2" : "btn-light !px-3 !py-2"}
          aria-current={result.page === page ? "page" : undefined}
          onClick={() => onChange(page)}
        >
          {page}
        </button>
      ))}
      <span aria-live="polite">{pageLabel}</span>
      <button type="button" className="btn-light !p-2" disabled={result.page === result.pageCount}
        aria-label={nextLabel} onClick={() => onChange(result.page + 1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
