import { render, screen, fireEvent } from '@testing-library/react';
import AuditTimeline from '../components/AuditTimeline';
import { AuditRecord } from '../lib/api';

const mockRecords: AuditRecord[] = [
  { docType: 'audit', modelId: 'model-A', elementUniqueId: 'elem-1', changeType: 'ADD', elementHash: 'h1', userId: 'user1', orgMspId: 'Org1', timestamp: '2025-01-15T10:00:00Z', txId: 'tx1' },
  { docType: 'audit', modelId: 'model-A', elementUniqueId: 'elem-2', changeType: 'MODIFY', elementHash: 'h2', userId: 'user2', orgMspId: 'Org2', timestamp: '2025-01-15T11:00:00Z', txId: 'tx2' },
  { docType: 'audit', modelId: 'model-B', elementUniqueId: 'elem-3', changeType: 'DELETE', elementHash: 'h3', userId: 'user3', orgMspId: 'Org1', timestamp: '2025-01-15T12:00:00Z', txId: 'tx3' },
];

describe('AuditTimeline', () => {
  it('renders timeline with audit records', () => {
    render(<AuditTimeline records={mockRecords} />);
    expect(screen.getByText('elem-1')).toBeTruthy();
    expect(screen.getByText('elem-2')).toBeTruthy();
    expect(screen.getByText('elem-3')).toBeTruthy();
  });

  it('filters records by model selection', () => {
    render(<AuditTimeline records={mockRecords} />);
    const select = screen.getByLabelText('Filter by model');
    fireEvent.change(select, { target: { value: 'model-A' } });
    expect(screen.getByText('elem-1')).toBeTruthy();
    expect(screen.getByText('elem-2')).toBeTruthy();
    expect(screen.queryByText('elem-3')).toBeNull();
  });

  it('filters records by date range', () => {
    render(<AuditTimeline records={mockRecords} />);
    const startDate = screen.getByLabelText('Start date');
    fireEvent.change(startDate, { target: { value: '2025-01-15' } });
    expect(screen.getByText('elem-1')).toBeTruthy();
  });

  it('shows change type badges (ADD=green, MODIFY=yellow, DELETE=red)', () => {
    render(<AuditTimeline records={mockRecords} />);
    const addBadge = screen.getByText('ADD');
    const modifyBadge = screen.getByText('MODIFY');
    const deleteBadge = screen.getByText('DELETE');
    expect(addBadge.className).toContain('green');
    expect(modifyBadge.className).toContain('yellow');
    expect(deleteBadge.className).toContain('red');
  });

  it('clicking record shows detail panel', () => {
    const onClick = jest.fn();
    render(<AuditTimeline records={mockRecords} onRecordClick={onClick} />);
    fireEvent.click(screen.getByText('elem-1'));
    expect(onClick).toHaveBeenCalledWith(mockRecords[0]);
  });

  it('empty state shows appropriate message', () => {
    render(<AuditTimeline records={[]} />);
    expect(screen.getByText('No audit records found.')).toBeTruthy();
  });
});
