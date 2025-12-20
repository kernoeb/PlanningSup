export function getPlausibleAnalyticsProps(): Record<string, string> {
  if (typeof window === 'undefined') return {}

  const planningsRaw = window.localStorage.getItem('plannings')
  if (!planningsRaw) return {}

  try {
    const planningIds = JSON.parse(planningsRaw) as string[]
    const universities = new Set<string>()

    for (const planningId of planningIds) {
      const [university] = planningId.split('.')
      if (university) universities.add(university)
    }

    const primaryUniversity = universities.values().next().value
    if (!primaryUniversity) return {}

    return {
      university: primaryUniversity,
      planningCount: String(planningIds.length),
      universityCount: String(universities.size),
    }
  } catch {
    return {}
  }
}
