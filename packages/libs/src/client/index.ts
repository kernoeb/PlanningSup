import type { App } from '@api/api'
import { treaty } from '@elysiajs/eden'

export const client = treaty<App>(import.meta.env.VITE_BACKEND_URL || window.location.origin)
