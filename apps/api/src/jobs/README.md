# Jobs System with Quiet Hours

Background jobs system with optional quiet hours (jobs can choose to respect it).

## Environment Variables

| Variable                    | Default            | Description                                    |
| --------------------------- | ------------------ | ---------------------------------------------- |
| `RUN_JOBS`                  | `true`             | Enable/disable the job runner                  |
| `ALLOWED_JOBS`              | `plannings-refresh-worker,plannings-backfill` | Comma-separated job IDs or `*` for all |
| `JOBS_QUIET_HOURS`          | `21:00–06:00`      | Time range when jobs should not run            |
| `JOBS_QUIET_HOURS_TIMEZONE` | `Europe/Paris`     | Timezone for quiet hours evaluation            |

## Quiet Hours

Configure when periodic jobs should not run:

```bash
export JOBS_QUIET_HOURS="21:00–06:00"          # 9 PM to 6 AM (crosses midnight)
export JOBS_QUIET_HOURS="22:30-07:15"          # Custom with minutes
export JOBS_QUIET_HOURS="02:00–04:00"          # Same day range
export JOBS_QUIET_HOURS=""                     # Disabled

export JOBS_QUIET_HOURS_TIMEZONE="Europe/Paris"    # Default timezone
export JOBS_QUIET_HOURS_TIMEZONE="UTC"             # UTC timezone
export JOBS_QUIET_HOURS_TIMEZONE="America/New_York" # US Eastern timezone
```

Quiet hours are evaluated in the configured timezone (default: Europe/Paris).

## Registered jobs

- `plannings-refresh-worker`: drains `plannings_refresh_queue` (user-triggered, low latency)
- `plannings-backfill`: periodically enqueues missing/stale backups into the refresh queue

## Testing

```bash
cd test && bun test jobs.test.ts
```
