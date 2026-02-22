import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BIM-Chain Dashboard',
  description: 'Hyperledger Fabric + Revit BIM Governance System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
