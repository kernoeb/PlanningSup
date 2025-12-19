CREATE TABLE "plannings_refresh_state" (
	"planning_full_id" varchar(255) PRIMARY KEY NOT NULL,
	"disabled_until" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_failure_kind" text,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plannings_refresh_state" ADD CONSTRAINT "plannings_refresh_state_planning_full_id_plannings_full_id_fk" FOREIGN KEY ("planning_full_id") REFERENCES "public"."plannings"("full_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plannings_refresh_state_disabled_until_idx" ON "plannings_refresh_state" USING btree ("disabled_until");