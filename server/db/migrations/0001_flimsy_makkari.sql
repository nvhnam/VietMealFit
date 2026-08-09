ALTER TABLE "exercises" ADD COLUMN "name_vi" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "rep_scheme_vi" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instructions_vi" text;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "library_resources" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "nutrition_items" ADD COLUMN "source_citation_en" text DEFAULT 'Vietnam Food Composition Table, Ministry of Health – National Institute of Nutrition, 2007';--> statement-breakpoint
ALTER TABLE "phase_food_recommendations" ADD COLUMN "food_category_vi" text;--> statement-breakpoint
ALTER TABLE "phase_food_recommendations" ADD COLUMN "recommendation_vi" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instructions_vi" text;