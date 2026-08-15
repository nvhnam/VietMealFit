import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Supabase manages the `auth` schema. We reference `auth.users` for FKs
 * (profiles.id) without owning or migrating that table ourselves.
 */
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const experienceModeEnum = pgEnum("experience_mode", ["basic", "advanced"]);
export const mealTypeEnum = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);
export const leanPhaseEnum = pgEnum("lean_phase", ["bulking", "lean", "cutting"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "system"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Cross-cutting: profiles (§1.1, §1.9, §4)
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("user"),
  gender: text("gender"),
  age: smallint("age"),
  heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
  experienceLevel: text("experience_level"),
  fitnessGoals: text("fitness_goals").array(),
  dietaryPreference: text("dietary_preference"),
  allergies: text("allergies").array(),
  calorieGoal: integer("calorie_goal"),
  experienceMode: experienceModeEnum("experience_mode").notNull().default("advanced"),
  ...timestamps,
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ many }) => ({
  mealPlans: many(mealPlans),
  exercisePlans: many(exercisePlans),
  forumThreads: many(forumThreads),
  forumComments: many(forumComments),
  libraryResources: many(libraryResources),
  chatSessions: many(chatSessions),
  threadLikes: many(threadLikes),
  commentLikes: many(commentLikes),
}));

// ---------------------------------------------------------------------------
// VietMeal (§1.2)
// ---------------------------------------------------------------------------

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en"),
  mealType: mealTypeEnum("meal_type").notNull(),
  dietTags: text("diet_tags").array().notNull().default(sql`'{}'::text[]`),
  calories: integer("calories").notNull(),
  proteinG: numeric("protein_g", { precision: 6, scale: 2 }).notNull(),
  carbG: numeric("carb_g", { precision: 6, scale: 2 }).notNull(),
  fatG: numeric("fat_g", { precision: 6, scale: 2 }).notNull(),
  // Array of { name_vi, name_en, amount_vi, amount_en } — jsonb, so this
  // shape isn't schema-enforced; see data/seed/recipes.json for the source.
  ingredients: jsonb("ingredients").notNull(),
  instructions: text("instructions").notNull(), // English
  instructionsVi: text("instructions_vi"), // Vietnamese; nullable during backfill
  allergenTags: text("allergen_tags").array().notNull().default(sql`'{}'::text[]`),
  source: text("source"),
  ...timestamps,
});

export const mealPlans = pgTable("meal_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  params: jsonb("params").notNull(),
  ...timestamps,
});

export const mealPlanItems = pgTable("meal_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  day: smallint("day").notNull(), // 0-6, week-relative
  mealType: mealTypeEnum("meal_type").notNull(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "restrict" }),
  completed: boolean("completed").notNull().default(false),
});

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  owner: one(profiles, { fields: [mealPlans.userId], references: [profiles.id] }),
  items: many(mealPlanItems),
}));

export const mealPlanItemsRelations = relations(mealPlanItems, ({ one }) => ({
  plan: one(mealPlans, { fields: [mealPlanItems.planId], references: [mealPlans.id] }),
  recipe: one(recipes, { fields: [mealPlanItems.recipeId], references: [recipes.id] }),
}));

// ---------------------------------------------------------------------------
// VietFit (§1.3)
// ---------------------------------------------------------------------------

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // English; kept as-is for backward compat, see nameEn
  nameVi: text("name_vi"),
  nameEn: text("name_en"),
  muscleGroups: text("muscle_groups").array().notNull().default(sql`'{}'::text[]`),
  equipment: text("equipment"),
  difficulty: difficultyEnum("difficulty").notNull().default("beginner"),
  defaultSets: smallint("default_sets").notNull(),
  repScheme: text("rep_scheme").notNull(), // English, e.g. "10-15 reps"
  repSchemeVi: text("rep_scheme_vi"), // e.g. "10-15 lần"
  videoUrl: text("video_url"),
  videoUrlVi: text("video_url_vi"),
  instructions: text("instructions").notNull(), // English
  instructionsVi: text("instructions_vi"),
  limitationTags: text("limitation_tags").array().notNull().default(sql`'{}'::text[]`),
  ...timestamps,
});

export const exercisePlans = pgTable("exercise_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  params: jsonb("params").notNull(),
  goal: text("goal").notNull(),
  ...timestamps,
});

export const exercisePlanItems = pgTable("exercise_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => exercisePlans.id, { onDelete: "cascade" }),
  day: smallint("day").notNull(),
  order: smallint("order").notNull(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "restrict" }),
  sets: smallint("sets").notNull(),
  repScheme: text("rep_scheme").notNull(),
  completed: boolean("completed").notNull().default(false),
});

export const exercisePlansRelations = relations(exercisePlans, ({ one, many }) => ({
  owner: one(profiles, { fields: [exercisePlans.userId], references: [profiles.id] }),
  items: many(exercisePlanItems),
}));

export const exercisePlanItemsRelations = relations(exercisePlanItems, ({ one }) => ({
  plan: one(exercisePlans, { fields: [exercisePlanItems.planId], references: [exercisePlans.id] }),
  exercise: one(exercises, { fields: [exercisePlanItems.exerciseId], references: [exercises.id] }),
}));

// ---------------------------------------------------------------------------
// VietLean (§1.4) — pure computation + static reference table
// ---------------------------------------------------------------------------

export const phaseFoodRecommendations = pgTable("phase_food_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: leanPhaseEnum("phase").notNull(),
  foodCategory: text("food_category").notNull(), // English
  foodCategoryVi: text("food_category_vi"),
  recommendation: text("recommendation").notNull(), // English
  recommendationVi: text("recommendation_vi"),
});

// ---------------------------------------------------------------------------
// VietSearch (§1.5, §4.1) — resolved D3, seeded from data_v2.csv
// ---------------------------------------------------------------------------

export const nutritionItems = pgTable("nutrition_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  foodCode: text("food_code").notNull().unique(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en"),
  category: text("category"), // classification pass, Phase 1 (see §4.1)
  energyKcal: numeric("energy_kcal", { precision: 8, scale: 2 }),
  proteinG: numeric("protein_g", { precision: 8, scale: 2 }),
  fatG: numeric("fat_g", { precision: 8, scale: 2 }),
  carbohydrateG: numeric("carbohydrate_g", { precision: 8, scale: 2 }),
  fiberG: numeric("fiber_g", { precision: 8, scale: 2 }),
  // Vitamins, minerals, fatty-acid panel, amino-acid panel — preserved losslessly.
  // NULL means "not measured in the 2007 table", never coerced to 0 (§4.1 data-quality note).
  extendedNutrients: jsonb("extended_nutrients").notNull().default(sql`'{}'::jsonb`),
  sourceCitation: text("source_citation")
    .notNull()
    .default("Bảng thành phần thực phẩm Việt Nam, Bộ Y Tế – Viện Dinh dưỡng, 2007"),
  // English gloss of sourceCitation, shown in English UI mode. Citations
  // otherwise stay in their original language — see features/i18n plan.
  sourceCitationEn: text("source_citation_en").default(
    "Vietnam Food Composition Table, Ministry of Health – National Institute of Nutrition, 2007",
  ),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// VietMeet (§1.6) — real shared persistence, fixing the paper's localStorage flaw
// ---------------------------------------------------------------------------

export const forumThreads = pgTable("forum_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  // Not auto-detected or enforced — reserved for future author-declared
  // language tagging/filtering. User content is not machine-translated
  // (see features/i18n plan §8); the UI instead discloses that content
  // appears in its original language.
  language: text("language"),
  likeCount: integer("like_count").notNull().default(0), // denormalized, kept in sync by app logic
  ...timestamps,
});

export const forumComments = pgTable("forum_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => forumThreads.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  language: text("language"),
  ...timestamps,
});

export const threadLikes = pgTable(
  "thread_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => forumComments.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

export const forumAttachments = pgTable("forum_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").references(() => forumThreads.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => forumComments.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(), // Supabase Storage key (§2.6)
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  ...timestamps,
});

export const forumThreadsRelations = relations(forumThreads, ({ one, many }) => ({
  author: one(profiles, { fields: [forumThreads.authorId], references: [profiles.id] }),
  comments: many(forumComments),
  likes: many(threadLikes),
  attachments: many(forumAttachments),
}));

export const forumCommentsRelations = relations(forumComments, ({ one, many }) => ({
  thread: one(forumThreads, { fields: [forumComments.threadId], references: [forumThreads.id] }),
  author: one(profiles, { fields: [forumComments.authorId], references: [profiles.id] }),
  likes: many(commentLikes),
  attachments: many(forumAttachments),
}));

// Drizzle's relational query API (db.query.x.findFirst({ with: {...} }))
// needs both sides of a relation declared, not just the FK — this was
// missing and broke forumThreads/forumComments' `attachments: true` (caught
// by scripts/test-vietmeet-router.ts, not by tsc, since it's a runtime-only
// relational-query-builder check).
export const forumAttachmentsRelations = relations(forumAttachments, ({ one }) => ({
  thread: one(forumThreads, { fields: [forumAttachments.threadId], references: [forumThreads.id] }),
  comment: one(forumComments, { fields: [forumAttachments.commentId], references: [forumComments.id] }),
}));

export const threadLikesRelations = relations(threadLikes, ({ one }) => ({
  user: one(profiles, { fields: [threadLikes.userId], references: [profiles.id] }),
  thread: one(forumThreads, { fields: [threadLikes.threadId], references: [forumThreads.id] }),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  user: one(profiles, { fields: [commentLikes.userId], references: [profiles.id] }),
  comment: one(forumComments, { fields: [commentLikes.commentId], references: [forumComments.id] }),
}));

// ---------------------------------------------------------------------------
// VietSmart (§1.7) — real shared persistence, files offloaded to Cloudflare R2
// ---------------------------------------------------------------------------

export const libraryResources = pgTable("library_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  language: text("language"), // see forumThreads.language comment
  storagePath: text("storage_path").notNull(), // R2 object key (§2.6)
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  downloadCount: integer("download_count").notNull().default(0),
  ...timestamps,
});

export const libraryResourcesRelations = relations(libraryResources, ({ one }) => ({
  uploader: one(profiles, { fields: [libraryResources.uploaderId], references: [profiles.id] }),
}));

// ---------------------------------------------------------------------------
// VietAsk (§1.8) — first-party AI, replacing the paper's Chatling embed
// ---------------------------------------------------------------------------

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }), // nullable: anonymous chat allowed (D2)
  ...timestamps,
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  ...timestamps,
});

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(profiles, { fields: [chatSessions.userId], references: [profiles.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }),
}));
