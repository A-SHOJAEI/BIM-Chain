'use client';

import { useState } from 'react';
import { IPRecord } from '@/lib/api';

interface IPReportProps {
  records: IPRecord[];
  onElementClick?: (record: IPRecord) => void;
}

export default function IPReport({ records, onElementClick }: IPReportProps) {
  const [orgFilter, setOrgFilter] = useState<string>('');

  const orgs = Array.from(new Set(records.map(r => r.creatorOrgMspId)));

  const filteredRecords = orgFilter
    ? records.filter(r => r.creatorOrgMspId === orgFilter)
    : records;

  const sorted = Array.from(filteredRecords).sort(
    (a, b) => a.creationTimestamp.localeCompare(b.creationTimestamp)
  );

  return (
    <div>
      <div className="mb-4">
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="border rounded px-2 py-1"
          aria-label="Filter by organization"
        >
          <option value="">All Organizations</option>
          {orgs.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Element</th>
            <th className="text-left p-2">Creator</th>
            <th className="text-left p-2">Organization</th>
            <th className="text-left p-2">Created</th>
            <th className="text-left p-2">Contributions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((record) => (
            <tr
              key={record.elementUniqueId}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => onElementClick?.(record)}
            >
              <td className="p-2">{record.elementUniqueId}</td>
              <td className="p-2">{record.creatorUserId}</td>
              <td className="p-2">{record.creatorOrgMspId}</td>
              <td className="p-2">{record.creationTimestamp}</td>
              <td className="p-2">{record.contributions.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
