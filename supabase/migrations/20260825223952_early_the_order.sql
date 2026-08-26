ALTER TABLE "ig_account_insights" DROP CONSTRAINT "ig_account_insights_group_id_key";--> statement-breakpoint
ALTER TABLE "ig_account_insights" ADD COLUMN "period_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "ig_account_insights" ADD CONSTRAINT "ig_account_insights_group_period_key" UNIQUE("group_id","period_days");