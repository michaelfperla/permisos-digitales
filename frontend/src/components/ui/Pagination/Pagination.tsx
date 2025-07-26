import React from 'react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showInfo = false,
}) => {
  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    // First page
    if (start > 1) {
      pages.push(
        <button
          key={1}
          className={styles.paginationItem}
          onClick={() => onPageChange(1)}
        >
          1
        </button>
      );
      if (start > 2) {
        pages.push(
          <span key="ellipsis1" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }
    }

    // Page numbers
    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          className={`${styles.paginationItem} ${
            i === currentPage ? styles.active : ''
          }`}
          onClick={() => onPageChange(i)}
          aria-current={i === currentPage ? 'page' : undefined}
        >
          {i}
        </button>
      );
    }

    // Last page
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className={styles.paginationEllipsis}>
            ...
          </span>
        );
      }
      pages.push(
        <button
          key={totalPages}
          className={styles.paginationItem}
          onClick={() => onPageChange(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        className={`${styles.paginationItem} ${
          currentPage === 1 ? styles.disabled : ''
        }`}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ←
      </button>

      {renderPageNumbers()}

      <button
        className={`${styles.paginationItem} ${
          currentPage === totalPages ? styles.disabled : ''
        }`}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        →
      </button>

      {showInfo && (
        <span className={styles.paginationInfo}>
          Page {currentPage} of {totalPages}
        </span>
      )}
    </nav>
  );
};