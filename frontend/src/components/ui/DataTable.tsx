import React, { useState, useMemo } from 'react';

import Button from './Button/Button';
import styles from './DataTable.module.css';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((data: T) => React.ReactNode);
  sortable?: boolean;
  cell?: (data: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  emptyMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | Error;
  rowClassName?: (row: T) => string;
}

/**
 * Generic data table with sorting, pagination, and row click handling
 */
function DataTable<T>({
  data,
  columns,
  keyField,
  emptyMessage = 'No hay datos disponibles',
  pageSize = 10,
  onRowClick,
  loading = false,
  error,
  rowClassName,
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (accessor: keyof T | ((data: T) => React.ReactNode)) => {
    if (typeof accessor === 'function') {
      return;
    }

    if (sortField === accessor) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(accessor);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === bValue) return 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;

      return sortDirection === 'asc' ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
    });
  }, [data, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className={styles.pagination}>
        <Button
          variant="secondary"
          size="small"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className={styles.paginationButton}
        >
          &laquo;
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={styles.paginationButton}
        >
          &lsaquo;
        </Button>

        <span className={styles.paginationInfo}>
          Página {currentPage} de {totalPages}
        </span>

        <Button
          variant="secondary"
          size="small"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={styles.paginationButton}
        >
          &rsaquo;
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={styles.paginationButton}
        >
          &raquo;
        </Button>
      </div>
    );
  };

  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable || typeof column.accessor === 'function') return null;

    if (sortField !== column.accessor) {
      return null;
    }

    return (
      <span
        className={`${styles.sortIcon} ${sortDirection === 'asc' ? styles.sortAsc : styles.sortDesc}`}
      />
    );
  };

  const renderCell = (row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row);
    }

    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }

    const value = row[column.accessor];

    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    return String(value);
  };

  if (loading) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyMessage}>Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyMessage}>
          {typeof error === 'string' ? error : 'Error al cargar los datos'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      {data.length === 0 ? (
        <div className={styles.emptyMessage}>{emptyMessage}</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    onClick={() =>
                      column.sortable &&
                      typeof column.accessor !== 'function' &&
                      handleSort(column.accessor)
                    }
                    className={
                      column.sortable && typeof column.accessor !== 'function'
                        ? styles.sortableColumn
                        : styles.nonSortableColumn
                    }
                  >
                    {column.header}
                    {renderSortIcon(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {paginatedData.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`${onRowClick ? styles.clickableRow : styles.nonClickableRow} ${
                    rowClassName ? rowClassName(row) : ''
                  }`}
                >
                  {columns.map((column, index) => (
                    <td key={index} data-label={column.header}>
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination()}
        </>
      )}
    </div>
  );
}

export default DataTable;
