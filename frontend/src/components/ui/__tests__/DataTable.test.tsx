import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import DataTable, { Column } from '../DataTable';

// Define a test data type
interface TestData {
  id: number;
  name: string;
  age: number;
  active: boolean;
  createdAt: Date;
}

// Sample test data
const testData: TestData[] = [
  { id: 1, name: 'John Doe', age: 30, active: true, createdAt: new Date('2023-01-01') },
  { id: 2, name: 'Jane Smith', age: 25, active: false, createdAt: new Date('2023-02-15') },
  { id: 3, name: 'Bob Johnson', age: 40, active: true, createdAt: new Date('2023-03-20') },
  { id: 4, name: 'Alice Brown', age: 35, active: true, createdAt: new Date('2023-04-10') },
  { id: 5, name: 'Charlie Wilson', age: 28, active: false, createdAt: new Date('2023-05-05') },
];

// Define columns for the test
const testColumns: Column<TestData>[] = [
  { header: 'ID', accessor: 'id', sortable: true },
  { header: 'Name', accessor: 'name', sortable: true },
  { header: 'Age', accessor: 'age', sortable: true },
  {
    header: 'Status',
    accessor: 'active',
    sortable: true,
    cell: (data) => (data.active ? 'Active' : 'Inactive'),
  },
  {
    header: 'Created',
    accessor: 'createdAt',
    sortable: true,
    cell: (data) => data.createdAt.toLocaleDateString(),
  },
  { header: 'Actions', accessor: (data) => <button>View {data.id}</button> },
];

describe('DataTable Component', () => {
  it('renders the table with correct headers', () => {
    render(<DataTable data={testData} columns={testColumns} keyField="id" />);

    // Check that all headers are rendered
    testColumns.forEach((column) => {
      expect(screen.getByText(column.header)).toBeInTheDocument();
    });
  });

  it('renders the table with correct data', () => {
    render(<DataTable data={testData} columns={testColumns} keyField="id" />);

    // Check that data is rendered correctly
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getAllByText('Active')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Inactive')[0]).toBeInTheDocument();
    expect(screen.getByText('View 1')).toBeInTheDocument();
  });

  it('displays empty message when no data is provided', () => {
    render(
      <DataTable
        data={[]}
        columns={testColumns}
        keyField="id"
        emptyMessage="No data available for testing"
      />,
    );

    expect(screen.getByText('No data available for testing')).toBeInTheDocument();
  });

  it('sorts data when clicking on sortable column headers', () => {
    render(<DataTable data={testData} columns={testColumns} keyField="id" />);

    // Get the Age header and click it to sort
    const ageHeader = screen.getByText('Age');
    fireEvent.click(ageHeader);

    // Get all rows in the table body
    const rows = screen.getAllByRole('row').slice(1); // Skip header row

    // Extract age values from the sorted rows
    const ageValues = rows.map((row) => {
      const cells = within(row).getAllByRole('cell');
      return Number(cells[2].textContent); // Age is in the third column (index 2)
    });

    // Check that ages are in ascending order
    const isSorted = ageValues.every((val, i) => i === 0 || val >= ageValues[i - 1]);
    expect(isSorted).toBe(true);

    // Click again to sort in descending order
    fireEvent.click(ageHeader);

    // Get rows again after second click
    const rowsAfterSecondClick = screen.getAllByRole('row').slice(1);

    // Extract age values again
    const ageValuesAfterSecondClick = rowsAfterSecondClick.map((row) => {
      const cells = within(row).getAllByRole('cell');
      return Number(cells[2].textContent);
    });

    // Check that ages are in descending order
    const isSortedDesc = ageValuesAfterSecondClick.every(
      (val, i) => i === 0 || val <= ageValuesAfterSecondClick[i - 1],
    );
    expect(isSortedDesc).toBe(true);
  });

  it('handles row click events', () => {
    const handleRowClick = vi.fn();

    render(
      <DataTable data={testData} columns={testColumns} keyField="id" onRowClick={handleRowClick} />,
    );

    // Find a row and click it
    const firstRow = screen.getByText('John Doe').closest('tr');
    if (firstRow) {
      fireEvent.click(firstRow);
    }

    // Check that the click handler was called with the correct data
    expect(handleRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it('paginates data correctly', () => {
    // Create more test data to test pagination
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      age: 20 + i,
      active: i % 2 === 0,
      createdAt: new Date(`2023-01-${i + 1}`),
    }));

    render(<DataTable data={manyItems} columns={testColumns} keyField="id" pageSize={5} />);

    // Check that pagination controls are rendered
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    // Check that only the first page of data is visible
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('Person 5')).toBeInTheDocument();
    expect(screen.queryByText('Person 6')).not.toBeInTheDocument();

    // Click next page button
    const nextPageButton = screen.getByText('›');
    fireEvent.click(nextPageButton);

    // Check that second page data is now visible
    expect(screen.queryByText('Person 1')).not.toBeInTheDocument();
    expect(screen.getByText('Person 6')).toBeInTheDocument();
    expect(screen.getByText('Person 10')).toBeInTheDocument();
    expect(screen.queryByText('Person 11')).not.toBeInTheDocument();

    // Check that pagination info is updated
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('handles special cell values correctly', () => {
    const specialData = [
      { id: 1, name: null, age: undefined, active: true, createdAt: new Date() },
    ];

    render(<DataTable data={specialData} columns={testColumns} keyField="id" />);

    // Check that null and undefined values are displayed as '-'
    const cells = screen.getAllByRole('cell');
    expect(cells[1].textContent).toBe('-'); // null name
    expect(cells[2].textContent).toBe('-'); // undefined age
  });
});
