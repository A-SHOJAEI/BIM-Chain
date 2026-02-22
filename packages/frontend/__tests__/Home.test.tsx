import { render, screen } from '@testing-library/react';
import Home from '../app/page';

// Mock fetch for the health check
global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

describe('Home page', () => {
  it('renders the dashboard heading', () => {
    render(<Home />);
    expect(screen.getByText('BIM-Chain Dashboard')).toBeTruthy();
  });

  it('renders stat cards', () => {
    render(<Home />);
    expect(screen.getByText('Total Audit Records')).toBeTruthy();
    expect(screen.getByText('Active Models')).toBeTruthy();
    expect(screen.getByText('Pending Approvals')).toBeTruthy();
  });

  it('renders recent activity section', () => {
    render(<Home />);
    expect(screen.getByText('Recent Activity')).toBeTruthy();
  });
});
