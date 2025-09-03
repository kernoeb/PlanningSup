import type { App } from '@api/api'
import { treaty } from '@elysiajs/eden'

export const client = treaty<App>(window.location.origin)
