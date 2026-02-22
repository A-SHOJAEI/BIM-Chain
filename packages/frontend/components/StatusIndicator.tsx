interface StatusIndicatorProps {
  connected: boolean;
  lastSync?: string;
  pendingCount: number;
}

export default function StatusIndicator({ connected, lastSync, pendingCount }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
      {lastSync && <span className="text-gray-500">Last sync: {lastSync}</span>}
      {pendingCount > 0 && <span className="text-yellow-500">Pending: {pendingCount}</span>}
    </div>
  );
}
