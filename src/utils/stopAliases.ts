const STORAGE_KEY = 'stopAliases'

export type StopAliasMap = Record<string, string[]>

let memory: StopAliasMap | null = null

const readAliases = (): StopAliasMap => {
  if (memory) {
    return memory
  }

  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as StopAliasMap
  } catch {
    memory = {}
  }

  return memory
}

export const saveStopAliases = (aliases: StopAliasMap) => {
  memory = aliases
  localStorage.setItem(STORAGE_KEY, JSON.stringify(aliases))
}

export const resetStopAliasCache = () => {
  memory = null
}

export const hasStopAliases = () => {
  return Object.keys(readAliases()).length > 0
}

export const getAliasedStopIds = (stopId: string) => {
  return [stopId, ...(readAliases()[stopId] || [])]
}

export const expandStopIds = (ids: Iterable<string>) => {
  const next = new Set<string>()
  Array.from(ids).forEach((id) => {
    getAliasedStopIds(id).forEach((alias) => next.add(alias))
  })
  return next
}

export const stopsSharePole = (a: string, b: string) => {
  if (a === b) {
    return true
  }
  return (readAliases()[a] || []).includes(b)
}
