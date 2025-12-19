import type { JobId } from './ids'

type PokeFn = () => void

const pokes = new Map<JobId, PokeFn>()

export function registerJobPoke(id: JobId, fn: PokeFn) {
  pokes.set(id, fn)
}

export function pokeJob(id: JobId) {
  pokes.get(id)?.()
}
