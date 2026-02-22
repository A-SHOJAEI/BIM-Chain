'use client';

import { useState } from 'react';
import { AuditRecord } from '@/lib/api';

interface AuditTimelineProps {
  records: AuditRecord[];
  onRecordClick?: (record: AuditRecord) => void;
}

const badgeColors: Record<string, string> = {
  ADD: 'bg-green-100 text-green-800',
  MODIFY: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
};

export default function AuditTimeline({ records, onRecordClick }: AuditTimelineProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredRecords = records.filter((r) => {
    if (selectedModel && r.modelId !== selectedModel) return false;
    if (startDate && r.timestamp < startDate) return false;
    if (endDate && r.timestamp > endDate) return false;
    return true;
  });

  const models = Array.from(new Set(records.map(r => r.modelId)));

  if (records.length === 0) {
    return <p className="text-gray-500">No audit records found.</p>;
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="border rounded px-2 py-1"
          aria-label="Filter by model"
        >
          <option value="">All Models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-2 py-1"
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded px-2 py-1"
          aria-label="End date"
        />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Element</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">User</th>
            <th className="text-left p-2">Org</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((record, i) => (
            <tr
              key={`${record.txId || i}`}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => onRecordClick?.(record)}
            >
              <td className="p-2">{record.timestamp}</td>
              <td className="p-2">{record.elementUniqueId}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColors[record.changeType] || ''}`}>
                  {record.changeType}
                </span>
              </td>
              <td className="p-2">{record.userId}</td>
              <td className="p-2">{record.orgMspId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
