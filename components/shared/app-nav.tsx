"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Dumbbell,
  Library,
  Search,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExperienceMode } from "@/features/experience-mode";

const CORE_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/vietmeal", label: "VietMeal", icon: UtensilsCrossed },
  { href: "/vietfit", label: "VietFit", icon: Dumbbell },
];

const ADVANCED_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/vietlean", label: "VietLean", icon: Calculator },
  { href: "/vietsearch", label: "VietSearch", icon: Search },
  { href: "/vietmeet", label: "VietMeet", icon: Users },
  { href: "/vietsmart", label: "VietSmart", icon: Library },
];

export function AppNav() {
  const pathname = usePathname();
  const { mode } = useExperienceMode();
  const links = mode === "advanced" ? [...CORE_LINKS, ...ADVANCED_LINKS] : CORE_LINKS;

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Modules"
    >
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
