CREATE TABLE "plannings_refresh_queue" (
	"planning_full_id" varchar(255) PRIMARY KEY NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lock_owner" text,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "plannings_refresh_queue" ADD CONSTRAINT "plannings_refresh_queue_planning_full_id_plannings_full_id_fk" FOREIGN KEY ("planning_full_id") REFERENCES "public"."plannings"("full_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plannings_refresh_queue_next_attempt_at_idx" ON "plannings_refresh_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "plannings_refresh_queue_priority_idx" ON "plannings_refresh_queue" USING btree ("priority");