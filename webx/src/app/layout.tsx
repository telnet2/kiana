import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'webx - File Manager + Terminal',
  description: 'Modern file browser with integrated terminal and LLM agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg-panel text-text">
        {children}
      </body>
    </html>
  );
}
