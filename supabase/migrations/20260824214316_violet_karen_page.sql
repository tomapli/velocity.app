ALTER TABLE "meta_connections" DROP CONSTRAINT "meta_connections_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "meta_connections" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;