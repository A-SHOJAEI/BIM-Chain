import { render, screen, fireEvent } from '@testing-library/react';
import GovernancePanel from '../components/GovernancePanel';
import { GovernanceProposal } from '../lib/api';

const mockProposals: GovernanceProposal[] = [
  {
    proposalId: 'prop-1',
    modelId: 'model-1',
    description: 'Add new wing section',
    status: 'PROPOSED',
    requiredOrgs: ['Org1', 'Org2', 'Org3'],
    approvals: [{ orgMspId: 'Org1', userId: 'user1' }, { orgMspId: 'Org2', userId: 'user2' }],
    rejections: [],
  },
  {
    proposalId: 'prop-2',
    modelId: 'model-2',
    description: 'Modify structural supports',
    status: 'PROPOSED',
    requiredOrgs: ['Org1'],
    approvals: [],
    rejections: [],
  },
];

describe('GovernancePanel', () => {
  it('renders pending proposals list', () => {
    render(<GovernancePanel proposals={mockProposals} />);
    expect(screen.getByText('Add new wing section')).toBeTruthy();
    expect(screen.getByText('Modify structural supports')).toBeTruthy();
  });

  it('approve button calls API and updates status', () => {
    const onApprove = jest.fn();
    render(<GovernancePanel proposals={mockProposals} onApprove={onApprove} />);
    const approveButtons = screen.getAllByText('Approve');
    fireEvent.click(approveButtons[0]);
    expect(onApprove).toHaveBeenCalledWith('prop-1');
  });

  it('reject button calls handler', () => {
    const onReject = jest.fn();
    render(<GovernancePanel proposals={mockProposals} onReject={onReject} />);
    const rejectButtons = screen.getAllByText('Reject');
    fireEvent.click(rejectButtons[0]);
    expect(onReject).toHaveBeenCalledWith('prop-1');
  });

  it('shows approval progress (2/3 orgs approved)', () => {
    render(<GovernancePanel proposals={mockProposals} />);
    expect(screen.getByText('2/3 orgs')).toBeTruthy();
  });

  it('empty state shows no pending proposals message', () => {
    render(<GovernancePanel proposals={[]} />);
    expect(screen.getByText('No pending proposals.')).toBeTruthy();
  });
});
