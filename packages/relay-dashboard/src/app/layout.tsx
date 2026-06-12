import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, DM_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Relay — Infrastructure Platform',
  description: 'Event orchestration and observability',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmMono.variable}`}>
      <body className="font-sans bg-bg-root dot-grid min-h-screen antialiased text-ink-primary">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 ml-[220px]">
            <div className="max-w-[1200px] mx-auto px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
