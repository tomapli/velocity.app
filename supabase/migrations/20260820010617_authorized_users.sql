CREATE TABLE "authorized_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorized_users_email_key" UNIQUE("email"),
	CONSTRAINT "authorized_users_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "authorized_users_email_format" CHECK (char_length(trim(email)) >= 3 AND email = lower(email) AND email LIKE '%_@_%.%')
);
--> statement-breakpoint
ALTER TABLE "authorized_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authorized_users" ADD CONSTRAINT "authorized_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;