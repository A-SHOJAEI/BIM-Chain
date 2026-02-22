'use client';

import { GovernanceProposal } from '@/lib/api';

interface GovernancePanelProps {
  proposals: GovernanceProposal[];
  onApprove?: (proposalId: string) => void;
  onReject?: (proposalId: string) => void;
}

export default function GovernancePanel({ proposals, onApprove, onReject }: GovernancePanelProps) {
  if (proposals.length === 0) {
    return <p className="text-gray-500">No pending proposals.</p>;
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => {
        const approvalCount = proposal.approvals.length;
        const requiredCount = proposal.requiredOrgs.length;
        const progressPercent = requiredCount > 0 ? (approvalCount / requiredCount) * 100 : 0;

        return (
          <div key={proposal.proposalId} className="border rounded-lg p-4">
            <h3 className="font-semibold">{proposal.description}</h3>
            <p className="text-sm text-gray-500">Model: {proposal.modelId}</p>
            <p className="text-sm text-gray-500">Status: {proposal.status}</p>

            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Approval Progress</span>
                <span>{approvalCount}/{requiredCount} orgs</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            {proposal.status === 'PROPOSED' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onApprove?.(proposal.proposalId)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject?.(proposal.proposalId)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
