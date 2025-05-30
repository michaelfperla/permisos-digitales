import React, { useState } from 'react';
import { FaSort, FaSortUp, FaSortDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

import styles from './MobileTable.module.css';
import Icon from '../../../shared/components/ui/Icon';

export interface Column<T> {
  /**
   * Unique identifier for the column
   */
  id: string;
  /**
   * Header text to display
   */
  header: string;
  /**
   * Function to render the cell content
   */
  cell: (item: T) => React.ReactNode;
  /**
   * Whether the column is sortable
   */
  sortable?: boolean;
  /**
   * Label to use in mobile card view (if different from header)
   */
  mobileLabel?: string;
  /**
   * Whether to hide this column in mobile view
   */
  hideMobile?: boolean;
  /**
   * Priority for mobile view (lower numbers appear first)
   */
  mobilePriority?: number;
}

export interface MobileTableProps<T> {
  /**
   * Array of data items to display
   */
  data: T[];
  /**
   * Array of column definitions
   */
  columns: Column<T>[];
  /**
   * Key function to generate unique keys for rows
   */
  keyExtractor: (item: T) => string;
  /**
   * Function called when a row is clicked
   */
  onRowClick?: (item: T) => void;
  /**
   * Whether to enable pagination
   */
  pagination?: boolean;
  /**
   * Number of items per page
   */
  itemsPerPage?: number;
  /**
   * Initial sort column ID
   */
  initialSortColumn?: string;
  /**
   * Initial sort direction
   */
  initialSortDirection?: 'asc' | 'desc';
  /**
   * Text to display when there is no data
   */
  emptyMessage?: string;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileTable Component
 *
 * A responsive table component that transforms into a card-based layout on mobile devices.
 * Optimized for touch interactions and small screens.
 */
function MobileTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  pagination = false,
  itemsPerPage = 10,
  initialSortColumn,
  initialSortDirection = 'asc',
  emptyMessage = 'No hay datos disponibles',
  className = '',
}: MobileTableProps<T>) {
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | undefined>(initialSortColumn);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Handle column header click for sorting
  const handleHeaderClick = (columnId: string, sortable?: boolean) => {
    if (!sortable) return;

    if (sortColumn === columnId) {
      // Toggle direction if already sorting by this column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column and default to ascending
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Sort data based on current sort state
  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a: any, b: any) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  // Apply pagination
  const paginatedData = React.useMemo(() => {
    if (!pagination) return sortedData;

    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, pagination, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get sort icon based on current sort state
  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId)
      return <Icon IconComponent={FaSort} className={styles.sortIcon} size="sm" />;
    return sortDirection === 'asc' ? (
      <Icon IconComponent={FaSortUp} className={`${styles.sortIcon} ${styles.sortAsc}`} size="sm" />
    ) : (
      <Icon
        IconComponent={FaSortDown}
        className={`${styles.sortIcon} ${styles.sortDesc}`}
        size="sm"
      />
    );
  };

  // Sort columns for mobile view based on priority
  const mobilePriorityColumns = [...columns]
    .filter((col) => !col.hideMobile)
    .sort((a, b) => (a.mobilePriority || 999) - (b.mobilePriority || 999));

  return (
    <div className={`${styles.tableContainer} ${className}`}>
      {data.length === 0 ? (
        <div className={styles.emptyMessage}>{emptyMessage}</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={`
                      ${column.sortable ? styles.sortableColumn : styles.nonSortableColumn}
                      ${column.id === 'actions' ? styles.actionsColumnHeader : ''}
                    `}
                    onClick={() => handleHeaderClick(column.id, column.sortable)}
                  >
                    {column.header}
                    {column.sortable && getSortIcon(column.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {paginatedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={onRowClick ? styles.clickableRow : styles.nonClickableRow}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.id} data-label={column.mobileLabel || column.header}>
                      {column.cell(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className={styles.mobileCards}>
            {paginatedData.map((item) => {
              const cardContent = (
                <>
                  {mobilePriorityColumns.map((column) => (
                    <div key={column.id} className={styles.mobileCardItem}>
                      <div className={styles.mobileCardLabel}>
                        {column.mobileLabel || column.header}
                      </div>
                      <div className={styles.mobileCardValue}>{column.cell(item)}</div>
                    </div>
                  ))}
                </>
              );

              return onRowClick ? (
                <button
                  key={keyExtractor(item)}
                  type="button"
                  className={`${styles.mobileCard} ${styles.clickableCard}`}
                  onClick={() => onRowClick(item)}
                >
                  {cardContent}
                </button>
              ) : (
                <div
                  key={keyExtractor(item)}
                  className={styles.mobileCard}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Página anterior"
              >
                <Icon IconComponent={FaChevronLeft} size="sm" />
              </button>

              <span className={styles.paginationInfo}>
                Página {currentPage} de {totalPages}
              </span>

              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Página siguiente"
              >
                <Icon IconComponent={FaChevronRight} size="sm" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MobileTable;
