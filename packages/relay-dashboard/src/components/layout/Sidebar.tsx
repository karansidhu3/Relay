'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/events', label: 'Events' },
  { href: '/dlq', label: 'Dead Letters' },
  { href: '/projects', label: 'Projects' },
  { href: '/analytics', label: 'Analytics' },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-bg-surface border-r border-border-base flex flex-col z-20">
      {/* Wordmark */}
      <Link
        href="/"
        className="flex items-center h-14 px-5 border-b border-border-base flex-shrink-0 group"
      >
        <span className="font-sans text-[15px] font-semibold text-ink-primary tracking-tight transition-opacity group-hover:opacity-80">
          relay<span className="text-amber-accent">.</span>
        </span>
      </Link>

      {/* Nav — spring-animated active indicator via layoutId */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <LayoutGroup>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive =
                href === '/'
                  ? pathname === '/'
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    relative flex items-center px-2.5 py-2 rounded text-sm transition-colors duration-150
                    ${isActive
                      ? 'text-amber-accent font-medium'
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-hover'
                    }
                  `}
                >
                  {isActive && (
                    <>
                      <motion.div
                        layoutId="nav-bg"
                        className="absolute inset-0 rounded bg-amber-dim"
                        transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                      />
                      <motion.div
                        layoutId="nav-pip"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] bg-amber-accent"
                        style={{ borderRadius: '0 2px 2px 0' }}
                        transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                      />
                    </>
                  )}
                  <span className="relative z-10 font-sans">{label}</span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </nav>
    </aside>
  );
}
