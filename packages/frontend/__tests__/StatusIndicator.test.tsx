import { render, screen } from '@testing-library/react';
import StatusIndicator from '../components/StatusIndicator';

describe('StatusIndicator', () => {
  it('shows connected status', () => {
    render(<StatusIndicator connected={true} pendingCount={0} />);
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('shows disconnected status', () => {
    render(<StatusIndicator connected={false} pendingCount={0} />);
    expect(screen.getByText('Disconnected')).toBeTruthy();
  });

  it('shows last sync time', () => {
    render(<StatusIndicator connected={true} lastSync="2025-01-15 10:00" pendingCount={0} />);
    expect(screen.getByText('Last sync: 2025-01-15 10:00')).toBeTruthy();
  });

  it('shows pending count when greater than 0', () => {
    render(<StatusIndicator connected={true} pendingCount={5} />);
    expect(screen.getByText('Pending: 5')).toBeTruthy();
  });

  it('hides pending count when 0', () => {
    render(<StatusIndicator connected={true} pendingCount={0} />);
    expect(screen.queryByText(/Pending/)).toBeNull();
  });
});
