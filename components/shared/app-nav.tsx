"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Dumbbell,
  Search,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExperienceMode } from "@/features/experience-mode";
import { useI18n } from "@/features/i18n";

const CORE_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/vietmeal", label: "VietMeal", icon: UtensilsCrossed },
  { href: "/vietfit", label: "VietFit", icon: Dumbbell },
];

const ADVANCED_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/vietlean", label: "VietLean", icon: Calculator },
  { href: "/vietsearch", label: "VietSearch", icon: Search },
];

export function AppNav() {
  const pathname = usePathname();
  const { mode } = useExperienceMode();
  const { t } = useI18n();
  const links = mode === "advanced" ? [...CORE_LINKS, ...ADVANCED_LINKS] : CORE_LINKS;

  return (
    <nav
      className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:order-2 sm:w-auto sm:flex-1 [&::-webkit-scrollbar]:hidden"
      aria-label={t.common.modulesNavLabel}
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
