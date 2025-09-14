import type { Treaty } from '@elysiajs/eden'
import type { client } from './client'

export { authClient } from './auth'
export { client } from './client'

export type { Treaty } from '@elysiajs/eden'

export type Planning = Treaty.Data<ReturnType<typeof client.api.plannings>['get']>
export type PlanningWithEvents = Extract<Planning, { events: unknown }>
export type Events = NonNullable<PlanningWithEvents['events']>
