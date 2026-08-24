ALTER POLICY "Authenticated users can insert ig posts for their scrapes" ON "ig_posts" TO authenticated WITH CHECK (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
ALTER POLICY "Authenticated users can update ig posts for their scrapes" ON "ig_posts" TO authenticated USING (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
ALTER POLICY "Authenticated users can insert their own scheduled scrapes" ON "scheduled_scrapes" TO authenticated WITH CHECK (EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
ALTER POLICY "Authenticated users can update their own scheduled scrapes" ON "scheduled_scrapes" TO authenticated USING (EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP CONSTRAINT "scheduled_scrapes_requested_post_count_non_negative";--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP CONSTRAINT "scheduled_scrapes_ig_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP CONSTRAINT "scheduled_scrapes_started_by_fkey";
--> statement-breakpoint
DROP INDEX "scheduled_scrapes_created_at_idx";--> statement-breakpoint
DROP INDEX "scheduled_scrapes_ig_profile_id_idx";--> statement-breakpoint
DROP INDEX "scheduled_scrapes_started_by_idx";--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ADD CONSTRAINT "scheduled_scrapes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP COLUMN "ig_profile_id";--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP COLUMN "started_by";--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP COLUMN "requested_post_count";--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" DROP COLUMN "since_when";
