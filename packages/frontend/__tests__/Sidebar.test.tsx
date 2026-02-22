import { render, screen } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

describe('Sidebar', () => {
  it('renders the BIM-Chain title', () => {
    render(<Sidebar />);
    expect(screen.getByText('BIM-Chain')).toBeTruthy();
  });

  it('renders all navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Audit Trail')).toBeTruthy();
    expect(screen.getByText('IP Attribution')).toBeTruthy();
    expect(screen.getByText('Governance')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('has correct navigation links', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5);
  });
});
