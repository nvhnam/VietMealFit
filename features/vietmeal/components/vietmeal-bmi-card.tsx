"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function bmiBadgeVariant(bmi: number): "secondary" | "default" | "destructive" {
  if (bmi < 18.5) return "secondary";
  if (bmi < 25) return "default";
  return "destructive";
}

/** Advanced-mode cross-link card (plan §1.2): BMI feedback + CTAs to VietLean/VietSearch. */
export function VietMealBmiCard() {
  const trpc = useTRPC();
  const { data: profile } = useQuery(trpc.profiles.get.queryOptions());

  const heightCm = profile?.heightCm ? Number(profile.heightCm) : null;
  const weightKg = profile?.weightKg ? Number(profile.weightKg) : null;
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">BMI feedback</h2>
      {bmi ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">BMI {bmi.toFixed(1)}</span>
          <Badge variant={bmiBadgeVariant(bmi)}>{bmiCategory(bmi)}</Badge>
          <span>— informational only, not a diagnosis.</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add your height in the generate form (or your profile) to see BMI feedback.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Link href="/vietlean" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Check calorie needs in VietLean
        </Link>
        <Link href="/vietsearch" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Look up ingredients in VietSearch
        </Link>
      </div>
    </Card>
  );
}
