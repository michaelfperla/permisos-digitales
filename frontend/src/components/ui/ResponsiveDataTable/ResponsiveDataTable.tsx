import React from 'react';

import useResponsive from '../../../hooks/useResponsive';
import DataTable, { DataTableProps } from '../DataTable';
import MobileDataCards, { DataField, CardAction } from '../MobileDataCards/MobileDataCards';

export interface ResponsiveDataTableProps<T = any> extends DataTableProps<T> {
  // Mobile-specific props
  mobileTitle: (item: T) => string;
  mobileSubtitle?: (item: T) => string;
  mobileStatus?: (item: T) => {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  mobileFields: (item: T) => DataField[];
  mobileActions?: CardAction[];
  mobileExpandable?: boolean;
  mobileExpandedContent?: (item: T) => React.ReactNode;
}

/**
 * Responsive data table that switches between table and card view based on screen size
 */
function ResponsiveDataTable<T = any>({
  // Table props
  columns,
  data,
  keyField,
  loading,
  error,
  emptyMessage,
  onRowClick,
  rowClassName,
  pageSize,
  // Mobile props
  mobileTitle,
  mobileSubtitle,
  mobileStatus,
  mobileFields,
  mobileActions,
  mobileExpandable,
  mobileExpandedContent,
}: ResponsiveDataTableProps<T>) {
  const { isMdDown } = useResponsive();

  // On mobile, use card view
  if (isMdDown) {
    return (
      <MobileDataCards
        data={data}
        title={mobileTitle}
        subtitle={mobileSubtitle}
        status={mobileStatus}
        fields={mobileFields}
        actions={mobileActions}
        expandable={mobileExpandable}
        expandedContent={mobileExpandedContent}
        loading={loading}
        emptyState={
          emptyMessage
            ? {
                title: 'Sin resultados',
                description: emptyMessage,
              }
            : undefined
        }
      />
    );
  }

  // On desktop, use table view
  return (
    <DataTable
      columns={columns}
      data={data}
      keyField={keyField}
      loading={loading}
      error={error}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      pageSize={pageSize}
    />
  );
}

export default ResponsiveDataTable;