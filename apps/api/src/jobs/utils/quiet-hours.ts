import config from '@api/config'

export interface QuietHours {
  start: { hour: number, minute: number }
  end: { hour: number, minute: number }
  crossesMidnight: boolean
}

export function parseQuietHours(input: string | undefined | null): QuietHours | null {
  if (!input) return null
  const raw = String(input).trim()
  if (raw === '') return null

  // Support both en dash (–) and hyphen (-) as separator
  const match = /^(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return null

  const startHour = Number(match[1])
  const startMinute = Number(match[2])
  const endHour = Number(match[3])
  const endMinute = Number(match[4])

  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 || startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
    return null
  }

  const start = { hour: startHour, minute: startMinute }
  const end = { hour: endHour, minute: endMinute }

  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const crossesMidnight = startMinutes >= endMinutes

  return { start, end, crossesMidnight }
}

export function isInQuietHours(
  quietHours: QuietHours | null,
  now: Date = new Date(),
  timezone: string = config.jobs.quietHoursTimezone,
): boolean {
  if (!quietHours) return false

  const timeInTimezone = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const currentHour = timeInTimezone.getHours()
  const currentMinute = timeInTimezone.getMinutes()
  const currentMinutes = currentHour * 60 + currentMinute

  const startMinutes = quietHours.start.hour * 60 + quietHours.start.minute
  const endMinutes = quietHours.end.hour * 60 + quietHours.end.minute

  if (quietHours.crossesMidnight) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
}

export function formatQuietHours(quietHours: QuietHours | null): string {
  if (!quietHours) return 'disabled'

  const formatTime = (time: { hour: number, minute: number }) =>
    `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`

  return `${formatTime(quietHours.start)}–${formatTime(quietHours.end)}`
}
