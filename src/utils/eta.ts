export const formatEta = (eta: string | Date | null | undefined) => {
  if (!eta) {
    return '-'
  }

  const time = new Date(eta).getTime()
  if (Number.isNaN(time)) {
    return '-'
  }

  const mins = Math.round((time - Date.now()) / 60000)
  if (mins <= 0) {
    return 'Due'
  }
  return `${mins} min`
}

export const formatMeters = (meters: number | null | undefined) => {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) {
    return ''
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}
