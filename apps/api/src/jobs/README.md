# Jobs System with Quiet Hours

Background jobs system with automatic quiet hours functionality.

## Environment Variables

| Variable             | Default            | Description                                    |
| -------------------- | ------------------ | ---------------------------------------------- |
| `RUN_JOBS`           | `true`             | Enable/disable the job runner                  |
| `DELAY_BETWEEN_JOBS` | `60000`            | Delay between cycles (ms, or `60s`, `1m`, etc) |
| `ALLOWED_JOBS`       | `plannings-backup` | Comma-separated job IDs or `*` for all         |
| `JOBS_QUIET_HOURS`   | `21:00–06:00`      | Time range when jobs should not run            |

## Quiet Hours

Configure when jobs should not run:

```bash
export JOBS_QUIET_HOURS="21:00–06:00"  # 9 PM to 6 AM (crosses midnight)
export JOBS_QUIET_HOURS="22:30-07:15"  # Custom with minutes
export JOBS_QUIET_HOURS="02:00–04:00"  # Same day range
export JOBS_QUIET_HOURS=""             # Disabled
```

**Behavior:**

- Jobs are skipped if started during quiet hours
- Running jobs receive abort signal when quiet hours begin
- Supports ranges crossing midnight or within same day

## Writing Jobs

```typescript
import type { Database } from '@api/db'
import { jobsLogger } from '@api/utils/logger'

export async function run(db: Database, signal?: AbortSignal) {
  for (const item of items) {
    // Check for abort signal (quiet hours or shutdown)
    if (signal?.aborted) {
      jobsLogger.info('Job aborted: {reason}', { reason: signal.reason })
      return
    }

    await processItem(item)
  }
}
```

Add to `JOB_REGISTRY` in `index.ts`:

```typescript
const _JOB_REGISTRY: Record<string, JobModule['run']> = {
  'plannings-backup': runPlanningsBackup,
  'my-job': runMyJob,
}
```

## Testing

```bash
cd test && bun test jobs.test.ts
```
