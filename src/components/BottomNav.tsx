"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/groups", label: "Groups", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-2 px-2 py-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl py-2 text-xs font-semibold transition-colors",
                  active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
