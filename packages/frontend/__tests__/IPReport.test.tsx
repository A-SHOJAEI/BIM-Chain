import { render, screen, fireEvent } from '@testing-library/react';
import IPReport from '../components/IPReport';
import { IPRecord } from '../lib/api';

const mockRecords: IPRecord[] = [
  { elementUniqueId: 'elem-1', creatorUserId: 'arch1', creatorOrgMspId: 'ArchOrg', creationTimestamp: '2025-01-15T09:00:00Z', contributions: [{ userId: 'eng1', orgMspId: 'EngOrg', timestamp: '2025-01-16T10:00:00Z' }] },
  { elementUniqueId: 'elem-2', creatorUserId: 'arch2', creatorOrgMspId: 'ArchOrg', creationTimestamp: '2025-01-14T09:00:00Z', contributions: [] },
  { elementUniqueId: 'elem-3', creatorUserId: 'eng1', creatorOrgMspId: 'EngOrg', creationTimestamp: '2025-01-16T09:00:00Z', contributions: [{ userId: 'a1', orgMspId: 'ArchOrg', timestamp: '2025-01-17T10:00:00Z' }, { userId: 'a2', orgMspId: 'ArchOrg', timestamp: '2025-01-18T10:00:00Z' }] },
];

describe('IPReport', () => {
  it('renders IP attribution table', () => {
    render(<IPReport records={mockRecords} />);
    expect(screen.getByText('elem-1')).toBeTruthy();
    expect(screen.getByText('elem-2')).toBeTruthy();
    expect(screen.getByText('elem-3')).toBeTruthy();
  });

  it('shows contribution counts per org', () => {
    render(<IPReport records={mockRecords} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('sorts by creation date', () => {
    render(<IPReport records={mockRecords} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(4);
  });

  it('filters by organization', () => {
    render(<IPReport records={mockRecords} />);
    const select = screen.getByLabelText('Filter by organization');
    fireEvent.change(select, { target: { value: 'EngOrg' } });
    expect(screen.queryByText('elem-1')).toBeNull();
    expect(screen.getByText('elem-3')).toBeTruthy();
  });

  it('clicking element shows full contribution history', () => {
    const onClick = jest.fn();
    render(<IPReport records={mockRecords} onElementClick={onClick} />);
    fireEvent.click(screen.getByText('elem-1'));
    expect(onClick).toHaveBeenCalledWith(mockRecords[0]);
  });
});
