"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Portfolio" },
  { href: "/scanner", label: "Scanner" },
  { href: "/history", label: "History" },
  { href: "/calibration", label: "Calibration" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-card-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono font-bold text-accent-blue text-lg">ALPHA</span>
            <span className="text-muted text-sm">paper trading</span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "text-foreground bg-background"
                      : "text-muted hover:text-foreground hover:bg-background"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
