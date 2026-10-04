export type MapStyle = {
  featureType?: string
  elementType?: string
  stylers: Array<Record<string, string | number>>
}

export type MapTheme = 'default' | 'blackPink'

const hideExtras: MapStyle[] = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
]

const lightStyles: MapStyle[] = [
  ...hideExtras,
  { elementType: 'geometry', stylers: [{ color: '#f2f2f7' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f2f2f7' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f2f2f7' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#ececf2' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6ebe4' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5ea' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d1d1d6' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e3f5' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
]

const darkStyles: MapStyle[] = [
  ...hideExtras,
  { elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#141416' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
]

const blackPinkStyles: MapStyle[] = [
  ...darkStyles,
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#24161b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2a1820' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d2a31' }] },
]

export const buildMapStyles = (theme: MapTheme): MapStyle[] =>
  theme === 'blackPink' ? blackPinkStyles : lightStyles
