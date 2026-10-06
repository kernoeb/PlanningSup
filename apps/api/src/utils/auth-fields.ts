import type { BetterAuthOptions } from 'better-auth'
import * as z from 'zod'
import { colorsInput, customGroupsInput, eventFiltersInput, planningsInput, prefsMetaInput } from './auth-validators'

// Kept apart from auth.ts so the schema generator can load it without a database.
// Every preference is optional, so its column stays nullable.
export const userAdditionalFields = {
  theme: {
    type: 'string',
    required: false,
    validator: {
      input: z.enum(['dark', 'light', 'dracula', 'auto']).optional(),
    },
  },
  highlightTeacher: {
    type: 'boolean',
    required: false,
    validator: { input: z.boolean().optional() },
  },
  showWeekends: {
    type: 'boolean',
    required: false,
    validator: { input: z.boolean().optional() },
  },
  mergeDuplicates: {
    type: 'boolean',
    required: false,
    validator: { input: z.boolean().optional() },
  },
  blocklist: {
    type: 'string[]',
    required: false,
    validator: { input: z.array(z.string()).optional() },
  },
  plannings: {
    type: 'string[]',
    required: false,
    validator: {
      input: planningsInput,
    },
  },
  customGroups: {
    // Stored as a JSON string for type stability across clients.
    // Shape: Array<{ id: string; name: string; plannings: string[] }>
    type: 'string',
    required: false,
    validator: {
      input: customGroupsInput,
    },
  },
  eventFilters: {
    // Stored as a JSON string, like customGroups.
    // Shape: { teachers: string[]; rooms: string[]; slots: TimeSlot[]; hidden: HiddenEvent[] } (see @libs/event-filters)
    type: 'string',
    required: false,
    validator: {
      input: eventFiltersInput,
    },
  },
  colors: {
    type: 'string',
    required: false,
    validator: {
      // Record<string, string>
      input: colorsInput,
    },
  },
  prefsMeta: {
    type: 'string',
    required: false,
    validator: {
      // Authoritative server-side timestamping:
      // - Allowed keys only
      // - If value is a number, keep it as-is
      // - If value is not a number, stamp with Date.now()
      // - Always return normalized JSON string
      // Shape: Record<'theme' | 'highlightTeacher' | 'showWeekends' | 'mergeDuplicates' | 'blocklist' | 'colors' | 'plannings' | 'customGroups' | 'eventFilters', number>
      input: prefsMetaInput,
    },
  },
} satisfies NonNullable<BetterAuthOptions['user']>['additionalFields']
