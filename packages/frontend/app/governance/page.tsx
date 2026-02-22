'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import GovernancePanel from '@/components/GovernancePanel';
import { GovernanceProposal, getPendingProposals, approveProposal, rejectProposal } from '@/lib/api';

export default function GovernancePage() {
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [orgInput, setOrgInput] = useState('Org1MSP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchProposals() {
    if (!orgInput) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPendingProposals(orgInput);
      setProposals(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProposals();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchProposals, 10000);
    return () => clearInterval(interval);
  }, [orgInput]);

  async function handleApprove(proposalId: string) {
    try {
      await approveProposal(proposalId, 'Approved via dashboard');
      await fetchProposals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function handleReject(proposalId: string) {
    try {
      await rejectProposal(proposalId, 'Rejected via dashboard');
      await fetchProposals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Governance</h1>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            placeholder="Organization MSP ID"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={fetchProposals}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-gray-500 mb-4">Loading...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <GovernancePanel
          proposals={proposals}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </main>
    </div>
  );
}
