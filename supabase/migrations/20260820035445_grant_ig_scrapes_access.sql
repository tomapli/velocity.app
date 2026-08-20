-- Custom SQL migration file, put your code below! --
-- Supabase Data API grants are independent of RLS policies.
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_scrapes" TO "authenticated";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_posts" TO "authenticated";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_scrapes" TO "service_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_posts" TO "service_role";
