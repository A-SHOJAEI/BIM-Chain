'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuditTimeline from '@/components/AuditTimeline';
import { AuditRecord, getAuditTrail } from '@/lib/api';

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [modelId, setModelId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchRecords(model: string) {
    if (!model) return;
    setLoading(true);
    setError('');
    try {
      const data = await getAuditTrail(model);
      setRecords(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (modelId) fetchRecords(modelId);
  }, [modelId]);

  // Auto-refresh every 5 seconds when a model is selected
  useEffect(() => {
    if (!modelId) return;
    const interval = setInterval(() => fetchRecords(modelId), 5000);
    return () => clearInterval(interval);
  }, [modelId]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Audit Trail</h1>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setModelId(searchInput); }}
            placeholder="Enter Model ID (e.g. revit-test-model)"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={() => setModelId(searchInput)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {loading && <p className="text-gray-500 mb-4">Loading...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <AuditTimeline records={records} />
      </main>
    </div>
  );
}
