"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { bmiBadgeVariant, bmiCategory } from "@/features/shared/bmi";

/** Advanced-mode cross-link card (plan §1.2): BMI feedback + CTAs to VietLean/VietSearch. */
export function VietMealBmiCard() {
  const trpc = useTRPC();
  const { t } = useI18n();
  const { data: profile } = useQuery(trpc.profiles.get.queryOptions());

  const heightCm = profile?.heightCm ? Number(profile.heightCm) : null;
  const weightKg = profile?.weightKg ? Number(profile.weightKg) : null;
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">{t.vietmeal.bmiCard.heading}</h2>
      {bmi ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">BMI {bmi.toFixed(1)}</span>
          <Badge variant={bmiBadgeVariant(bmi)}>{t.bmi.category[bmiCategory(bmi)]}</Badge>
          <span>{t.vietmeal.bmiCard.note}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t.vietmeal.bmiCard.noHeight}</p>
      )}
      <div className="mt-3 flex gap-2">
        <Link href="/vietlean" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t.vietmeal.bmiCard.ctaVietLean}
        </Link>
        <Link href="/vietsearch" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t.vietmeal.bmiCard.ctaVietSearch}
        </Link>
      </div>
    </Card>
  );
}
