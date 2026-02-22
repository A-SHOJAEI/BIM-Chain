'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import IPReport from '@/components/IPReport';
import { IPRecord, getIPAttribution } from '@/lib/api';

export default function IPPage() {
  const [records, setRecords] = useState<IPRecord[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchIP(elementId: string) {
    if (!elementId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getIPAttribution(elementId);
      // Check if this element is already in the list
      setRecords((prev) => {
        const exists = prev.find((r) => r.elementUniqueId === data.elementUniqueId);
        if (exists) return prev.map((r) => r.elementUniqueId === data.elementUniqueId ? data : r);
        return [...prev, data];
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">IP Attribution</h1>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchIP(searchInput); }}
            placeholder="Enter Element UniqueId"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={() => fetchIP(searchInput)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {loading && <p className="text-gray-500 mb-4">Loading...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <IPReport records={records} />
      </main>
    </div>
  );
}
