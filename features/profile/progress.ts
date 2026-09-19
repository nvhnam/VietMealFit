import { macroTargets } from "@/features/vietlean/calculate";

export type DayGroup<T> = {
  /** Local calendar day as YYYY-MM-DD, or null for rows with no recorded tick time. */
  key: string | null;
  items: T[];
};

/** YYYY-MM-DD in the viewer's own timezone, not UTC. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a localDateKey back into local midnight of that day. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Groups items by the local day they were ticked, keeping the input order
 * (the server sends newest first, undated last) both across and within groups.
 */
export function groupByLocalDay<T extends { completedAt: Date | null }>(items: readonly T[]): DayGroup<T>[] {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.completedAt ? localDateKey(item.completedAt) : null;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, list]) => ({ key, items: list }));
}

export type DailyTargets = {
  calories: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
};

/**
 * Daily targets from what the profile actually holds. The calorie target is the
 * user's own goal; protein and fat use VietLean's maintenance ("lean") ratios
 * for their weight, and carbs fill the calories left over — the same split
 * VietLean shows. The profile stores no phase or activity level, so nothing
 * more specific can be derived without inventing inputs.
 */
export function dailyTargets(profile: {
  calorieGoal: number | null;
  weightKg: string | number | null;
}): DailyTargets {
  const calories = profile.calorieGoal && profile.calorieGoal > 0 ? profile.calorieGoal : null;
  const weightKg = profile.weightKg == null ? null : Number(profile.weightKg);
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { calories, proteinG: null, carbG: null, fatG: null };
  }
  const macros = macroTargets(weightKg, calories ?? 0, "lean");
  return {
    calories,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    // Carbs are only defined as "what's left of the calorie goal".
    carbG: calories ? macros.carbG : null,
  };
}

export type MacroTotals = { calories: number; proteinG: number; carbG: number; fatG: number };

export function sumMacros(
  recipes: readonly { calories: number; proteinG: string | number; carbG: string | number; fatG: string | number }[],
): MacroTotals {
  const totals = { calories: 0, proteinG: 0, carbG: 0, fatG: 0 };
  for (const r of recipes) {
    totals.calories += r.calories;
    totals.proteinG += Number(r.proteinG);
    totals.carbG += Number(r.carbG);
    totals.fatG += Number(r.fatG);
  }
  return {
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG),
    carbG: Math.round(totals.carbG),
    fatG: Math.round(totals.fatG),
  };
}
