import React from 'react';

import styles from './SkeletonTable.module.css';

const SkeletonTable: React.FC = () => {
  // Number of placeholder rows to display
  const rowCount = 5;

  return (
    <div className={styles.skeletonContainer}>
      <table className={styles.skeletonTable}>
        <thead>
          <tr>
            <th className={styles.skeletonHeader}>
              <div className={`${styles.skeletonHeaderCell} ${styles.autoCell}`}></div>
            </th>
            <th className={styles.skeletonHeader}>
              <div className={`${styles.skeletonHeaderCell} ${styles.dateCell}`}></div>
            </th>
            <th className={styles.skeletonHeader}>
              <div className={`${styles.skeletonHeaderCell} ${styles.statusCell}`}></div>
            </th>
            <th className={styles.skeletonHeader}>
              <div className={`${styles.skeletonHeaderCell} ${styles.actionsCell}`}></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, index) => (
            <tr key={index} className={styles.skeletonRow}>
              <td>
                <div className={`${styles.skeletonCell} ${styles.autoCell}`}></div>
              </td>
              <td>
                <div className={`${styles.skeletonCell} ${styles.dateCell}`}></div>
              </td>
              <td>
                <div className={`${styles.skeletonCell} ${styles.statusCell}`}></div>
              </td>
              <td>
                <div className={`${styles.skeletonCell} ${styles.actionsCell}`}></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SkeletonTable;
