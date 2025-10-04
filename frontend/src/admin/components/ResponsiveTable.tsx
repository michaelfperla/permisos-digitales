import React from 'react';
import { FaEye, FaChevronRight } from 'react-icons/fa';

import Button from '../../components/ui/Button/Button';
import useResponsive from '../../hooks/useResponsive';

interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  mobileHide?: boolean;
  sortable?: boolean;
}

interface ResponsiveTableProps {
  columns: TableColumn[];
  data: any[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Professional responsive table component for admin panel
 * Automatically switches to card layout on mobile devices
 */
const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  className = ''
}) => {
  const { isMdDown } = useResponsive();

  if (loading) {
    return (
      <div className="responsive-table-loading">
        <div className="loading-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              {columns.map((col, j) => (
                <div key={j} className="skeleton-cell" />
              ))}
            </div>
          ))}
        </div>
        <style jsx>{`
          .responsive-table-loading {
            padding: 1rem;
          }
          .loading-skeleton {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          .skeleton-row {
            display: flex;
            gap: 1rem;
            align-items: center;
          }
          .skeleton-cell {
            height: 1rem;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 4px;
            flex: 1;
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p className="empty-message">{emptyMessage}</p>
        <style jsx>{`
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1rem;
            text-align: center;
            color: #6c757d;
          }
          .empty-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }
          .empty-message {
            font-size: 1.125rem;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  // Mobile card layout
  if (isMdDown) {
    return (
      <div className={`responsive-cards ${className}`}>
        {data.map((row, index) => (
          <div
            key={index}
            className={`mobile-card ${onRowClick ? 'clickable' : ''}`}
            onClick={() => onRowClick?.(row)}
          >
            <div className="card-content">
              {columns
                .filter(col => !col.mobileHide)
                .map((column) => (
                  <div key={column.key} className="card-field">
                    <span className="field-label">{column.label}:</span>
                    <span className="field-value">
                      {column.render ? column.render(row[column.key], row) : row[column.key] || 'N/A'}
                    </span>
                  </div>
                ))}
            </div>
            {onRowClick && (
              <div className="card-action">
                <FaChevronRight />
              </div>
            )}
          </div>
        ))}

        <style jsx>{`
          .responsive-cards {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }

          .mobile-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .mobile-card.clickable {
            cursor: pointer;
          }

          .mobile-card.clickable:hover {
            border-color: #a72b31;
            box-shadow: 0 4px 12px rgba(167, 43, 49, 0.15);
            transform: translateY(-1px);
          }

          .card-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .card-field {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0;
          }

          .field-label {
            font-weight: 600;
            color: #495057;
            font-size: 0.875rem;
            min-width: 80px;
          }

          .field-value {
            color: #212529;
            text-align: right;
            flex: 1;
            font-size: 0.875rem;
          }

          .card-action {
            color: #a72b31;
            display: flex;
            align-items: center;
            padding: 0.5rem;
          }

          @media (max-width: 480px) {
            .responsive-cards {
              padding: 0.5rem;
            }
            
            .mobile-card {
              padding: 0.75rem;
            }
            
            .card-field {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.25rem;
            }
            
            .field-value {
              text-align: left;
            }
          }
        `}</style>
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className={`responsive-table ${className}`}>
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.sortable ? 'sortable' : ''}>
                  {column.label}
                </th>
              ))}
              {onRowClick && <th className="actions-header">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr 
                key={index} 
                className={onRowClick ? 'clickable-row' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row[column.key], row) : row[column.key] || 'N/A'}
                  </td>
                ))}
                {onRowClick && (
                  <td className="actions-cell">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(row);
                      }}
                    >
                      <FaEye /> Ver
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .responsive-table {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .table-container {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .admin-table th {
          background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          color: #495057;
          font-weight: 600;
          padding: 1rem;
          text-align: left;
          border-bottom: 2px solid #dee2e6;
          white-space: nowrap;
        }

        .admin-table th.sortable {
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .admin-table th.sortable:hover {
          background: linear-gradient(135deg, #e9ecef, #dee2e6);
        }

        .admin-table td {
          padding: 1rem;
          border-bottom: 1px solid #f1f3f4;
          color: #212529;
          vertical-align: middle;
        }

        .admin-table tr:hover {
          background-color: #f8f9fa;
        }

        .admin-table tr.clickable-row {
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .admin-table tr.clickable-row:hover {
          background-color: #fff3f3;
        }

        .actions-header {
          width: 120px;
          text-align: center;
        }

        .actions-cell {
          text-align: center;
        }

        /* Ensure table is responsive on smaller screens */
        @media (max-width: 1024px) {
          .admin-table th,
          .admin-table td {
            padding: 0.75rem 0.5rem;
            font-size: 0.8125rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ResponsiveTable;