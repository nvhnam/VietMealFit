import type { Language } from "@/features/i18n";
import { computeBmi, bmiCategory } from "@/features/shared/bmi";

/**
 * "Primed with platform-specific knowledge" (plan §1.8) — replaces the
 * paper's third-party Chatling embed, which had no way to know about the
 * app it was embedded in. Deliberately static/templated, not
 * retrieved/dynamic context; keeps it simple and auditable for a research
 * artifact.
 */
const VIETASK_SYSTEM_PROMPT_BASE = `You are VietAsk, the assistant built into VietMealFit, a Vietnamese meal-planning and fitness app.

The app has these modules:
- VietMeal: generates a personalized weekly meal plan from a Vietnamese recipe catalog, based on diet preference, allergies, and calorie goals.
- VietFit: generates a personalized weekly exercise schedule based on experience level, physical limitations, and fitness goals.
- VietLean: a calorie/macronutrient calculator for bulking, lean/maintenance, or cutting phases.
- VietSearch: a dictionary of 526 Vietnamese food items with nutrition facts, sourced from the official 2007 Vietnamese Ministry of Health food composition table.
- VietMeet: a community forum.
- VietSmart: a shared library of fitness resources.

You can help users navigate to the right module for their question, and answer general fitness/nutrition questions. Keep answers concise and practical.

Important constraints:
- You are not a doctor. For anything resembling a medical concern (injury, diagnosed condition, medication interaction), say so plainly and recommend they consult a qualified professional — don't attempt to answer as if you were one.
- You have two tools: lookup_food_nutrition (VietSearch, raw ingredient nutrition facts) and search_meal_ideas (VietMeal's curated recipe catalog, already filtered to exclude anything conflicting with the signed-in user's allergies). Call the relevant tool before naming a specific dish or stating a nutrition figure — never invent a dish name or guess a number. If a tool reports no results, say plainly that you don't have verified data on that item rather than making one up.
- Vary your meal suggestions across the conversation — don't keep repeating a dish you already suggested earlier in this chat unless the user asks to revisit it.`;

// Placed last (recency matters for instruction adherence) and explicit about
// overriding the conversation history: the API route replays the full prior
// transcript on every request, so without the "even if earlier messages..."
// clause the model tends to drift back to whatever language dominates that
// history after a user switches the UI language mid-conversation.
const LANGUAGE_DIRECTIVE: Record<Language, string> = {
  en: "\n- Always respond in English, even if the user writes in Vietnamese or earlier messages in this conversation are in Vietnamese.",
  vi: "\n- Always respond in Vietnamese (tiếng Việt), using natural, conversational Vietnamese — never a stiff word-for-word translation. Respond in Vietnamese even if the user writes in English or earlier messages in this conversation are in English.",
};

/** Subset of the `profiles` row actually needed here — keeps this module decoupled from the full Drizzle schema type. */
export type VietAskProfileInput = {
  age: number | null;
  gender: string | null;
  heightCm: string | number | null;
  weightKg: string | number | null;
  experienceLevel: string | null;
  dietaryPreference: string | null;
  allergies: string[] | null;
  fitnessGoals: string[] | null;
  calorieGoal: number | null;
};

/**
 * Turns the signed-in user's profile into a compact system-prompt fact block
 * so VietAsk's advice is actually personalized (previously it only adapted
 * response language — see project notes). Returns "" for anonymous users or
 * a profile with nothing usable, so the prompt is unchanged in that case.
 *
 * BMI is computed here (not read from a stored value — the schema doesn't
 * cache one) with the same computeBmi/bmiCategory helpers VietMeal/VietFit
 * already use, so the chatbot's read of the user's BMI always agrees with
 * what's shown elsewhere in the app.
 */
export function buildUserProfileContext(profile: VietAskProfileInput | null | undefined): string {
  if (!profile) return "";

  const facts: string[] = [];
  if (profile.age) facts.push(`age ${profile.age}`);
  if (profile.gender) facts.push(profile.gender);

  const heightCm = profile.heightCm ? Number(profile.heightCm) : null;
  const weightKg = profile.weightKg ? Number(profile.weightKg) : null;
  if (heightCm && weightKg) {
    const bmi = computeBmi(heightCm, weightKg);
    facts.push(`${heightCm}cm/${weightKg}kg (BMI ${bmi.toFixed(1)}, ${bmiCategory(bmi)})`);
  }

  if (profile.experienceLevel) facts.push(`experience level: ${profile.experienceLevel}`);
  if (profile.dietaryPreference) facts.push(`dietary preference: ${profile.dietaryPreference}`);
  if (profile.allergies && profile.allergies.length > 0) facts.push(`allergies: ${profile.allergies.join(", ")}`);
  if (profile.fitnessGoals && profile.fitnessGoals.length > 0) {
    facts.push(`fitness goals: ${profile.fitnessGoals.join(", ")}`);
  }
  if (profile.calorieGoal) facts.push(`calorie goal: ${profile.calorieGoal} kcal/day`);

  if (facts.length === 0) return "";

  return `\n\nSigned-in user's profile — use it to tailor advice (e.g. adjust suggestions for their experience level and goals, favor foods that fit their dietary preference): ${facts.join("; ")}. Never suggest a food or ingredient conflicting with their listed allergies. Don't recite these facts back to the user verbatim unless they ask what's on file. If anything the user says in this conversation contradicts the stored profile (e.g. a changed goal), trust the conversation over the stored profile.`;
}

export function buildVietAskSystemPrompt(language: Language, userContext: string = ""): string {
  return VIETASK_SYSTEM_PROMPT_BASE + userContext + LANGUAGE_DIRECTIVE[language];
}
