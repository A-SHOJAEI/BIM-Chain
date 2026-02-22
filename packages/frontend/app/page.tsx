'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import StatusIndicator from '@/components/StatusIndicator';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`);
        setConnected(res.ok);
      } catch {
        setConnected(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">BIM-Chain Dashboard</h1>
          <StatusIndicator connected={connected} pendingCount={0} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm text-gray-500">Total Audit Records</h3>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm text-gray-500">Active Models</h3>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm text-gray-500">Pending Approvals</h3>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <p className="text-gray-500">No recent activity.</p>
        </div>
      </main>
    </div>
  );
}
