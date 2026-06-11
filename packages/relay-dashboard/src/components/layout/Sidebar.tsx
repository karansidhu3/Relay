'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: '◈' },
  { href: '/events', label: 'Events', icon: '⚡' },
  { href: '/dlq', label: 'Dead Letters', icon: '⚠' },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-bg-surface border-r border-border-base flex flex-col z-20">
      {/* Wordmark */}
      <Link
        href="/"
        className="flex items-center h-14 px-5 border-b border-border-base flex-shrink-0"
      >
        <span className="font-mono text-sm font-medium text-ink-primary tracking-tight">
          relay<span className="text-cyan-accent">.</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-colors duration-150
                ${
                  isActive
                    ? 'bg-cyan-dim text-cyan-accent font-medium'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-hover'
                }
              `}
            >
              <span className="text-xs w-4 text-center flex-shrink-0">{icon}</span>
              <span className="font-mono">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-base flex-shrink-0">
        <span className="text-2xs font-mono text-ink-muted">infrastructure</span>
      </div>
    </aside>
  );
}
