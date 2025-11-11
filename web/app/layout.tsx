import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Kiana Web',
  description: 'Web UI for Kiana Agent with MemFS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

