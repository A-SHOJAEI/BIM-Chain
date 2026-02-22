import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">API Endpoint</label>
            <input type="text" defaultValue="http://localhost:3001" className="mt-1 border rounded px-3 py-2 w-full" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Organization</label>
            <input type="text" placeholder="Org1MSP" className="mt-1 border rounded px-3 py-2 w-full" readOnly />
          </div>
        </div>
      </main>
    </div>
  );
}
