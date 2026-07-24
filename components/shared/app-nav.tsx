"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useExperienceMode } from "@/features/experience-mode";

const CORE_LINKS = [
  { href: "/vietmeal", label: "VietMeal" },
  { href: "/vietfit", label: "VietFit" },
] as const;

const ADVANCED_LINKS = [
  { href: "/vietlean", label: "VietLean" },
  { href: "/vietsearch", label: "VietSearch" },
  { href: "/vietmeet", label: "VietMeet" },
  { href: "/vietsmart", label: "VietSmart" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { mode } = useExperienceMode();
  const links = mode === "advanced" ? [...CORE_LINKS, ...ADVANCED_LINKS] : CORE_LINKS;

  return (
    <nav className="flex items-center gap-1" aria-label="Modules">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
