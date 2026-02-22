import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/audit', label: 'Audit Trail' },
  { href: '/ip', label: 'IP Attribution' },
  { href: '/governance', label: 'Governance' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <h2 className="text-xl font-bold mb-6">BIM-Chain</h2>
      <nav>
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block px-3 py-2 rounded hover:bg-gray-700">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
