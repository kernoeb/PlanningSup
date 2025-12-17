CREATE INDEX "plannings_refresh_queue_pick_idx" ON "plannings_refresh_queue" USING btree ("next_attempt_at","priority","requested_at");
