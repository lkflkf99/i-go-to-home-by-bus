import { appTheme, buildMapStyles } from '@/utils'

type TrafficLayerHandle = { setMap: (map: unknown) => void }

type LatLng = { lat: number; lng: number }

type ThemedMapHandle = {
  ready?: boolean
  $el?: ParentNode
  map?: {
    setOptions: (options: Record<string, unknown>) => void
    fitBounds: (bounds: unknown, padding?: number) => void
    getZoom: () => number | undefined
    setCenter: (point: LatLng) => void
    setZoom: (zoom: number) => void
  }
  api?: {
    LatLngBounds: new () => { extend: (point: LatLng) => void }
    event: {
      addListenerOnce: (
        instance: unknown,
        eventName: string,
        handler: () => void
      ) => { remove: () => void }
    }
  }
}

type UseThemedMapOptions = {
  gestureHandling?: 'cooperative' | 'greedy' | 'auto' | 'none'
}

export const GOOGLE_MAPS_API_KEY = 'AIzaSyAd3JuKmaDu5q7FnmlvzjDb4bTd06BGAjY'

export const useThemedMap = (options: UseThemedMapOptions = {}) => {
  const mapRef = ref<ThemedMapHandle | null>(null)
  const mapStyles = computed(() => buildMapStyles(appTheme.value))
  const isMapReady = computed(() => Boolean(mapRef.value?.ready))
  const themeClass = computed(() => `is-theme-${appTheme.value}`)
  const trafficLayer = shallowRef<TrafficLayerHandle | null>(null)
  const trafficTileObserver = shallowRef<MutationObserver | null>(null)
  let fitListener: { remove: () => void } | null = null

  const isTrafficTileSrc = (src: string) => /traffic|ltraffic|mapslt/i.test(src)

  const tagTrafficTile = (img: HTMLImageElement) => {
    if (isTrafficTileSrc(img.currentSrc || img.src || img.getAttribute('src') || '')) {
      img.classList.add('map-traffic-tile')
    }
  }

  const tagTrafficTiles = (root: ParentNode) => {
    root.querySelectorAll('img').forEach((img) => tagTrafficTile(img))
  }

  const clearTrafficTiles = () => {
    trafficTileObserver.value?.disconnect()
    trafficTileObserver.value = null
  }

  const bindTrafficTiles = () => {
    const root = mapRef.value?.$el
    if (!root) {
      return
    }

    tagTrafficTiles(root)
    trafficTileObserver.value?.disconnect()
    trafficTileObserver.value = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
          tagTrafficTile(record.target)
          continue
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            tagTrafficTile(node)
            return
          }
          if (node instanceof Element) {
            tagTrafficTiles(node)
          }
        })
      }
    })
    trafficTileObserver.value.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    })
  }

  const applyTrafficLayer = (map: unknown) => {
    const TrafficLayer = (
      window as Window & { google?: { maps?: { TrafficLayer?: new () => TrafficLayerHandle } } }
    ).google?.maps?.TrafficLayer
    if (!TrafficLayer) {
      return
    }

    if (!trafficLayer.value) {
      trafficLayer.value = new TrafficLayer()
    }
    trafficLayer.value.setMap(map)
    bindTrafficTiles()
  }

  const applyMapOptions = () => {
    const map = mapRef.value?.map
    if (!mapRef.value?.ready || !map) {
      trafficLayer.value?.setMap(null)
      clearTrafficTiles()
      return
    }

    map.setOptions({
      zoomControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      clickableIcons: false,
      keyboardShortcuts: false,
      styles: mapStyles.value,
      backgroundColor:
        getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim() || '#f2f2f7',
      ...(options.gestureHandling ? { gestureHandling: options.gestureHandling } : {}),
    })
    applyTrafficLayer(map)
  }

  const fitFocus = (points: LatLng[], zoom = 16) => {
    fitListener?.remove()
    fitListener = null
    const handle = mapRef.value
    const map = handle?.map
    const api = handle?.api
    if (!handle?.ready || !map || !api || !points.length) {
      return
    }

    if (points.length === 1) {
      map.setCenter(points[0])
      map.setZoom(zoom)
      return
    }

    const bounds = new api.LatLngBounds()
    points.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, 36)
    fitListener = api.event.addListenerOnce(map, 'idle', () => {
      fitListener = null
      const nextZoom = map.getZoom()
      if (typeof nextZoom === 'number' && nextZoom > zoom) {
        map.setZoom(zoom)
      }
    })
  }

  watch([() => mapRef.value?.ready, mapStyles], applyMapOptions)

  onUnmounted(() => {
    fitListener?.remove()
    fitListener = null
    trafficLayer.value?.setMap(null)
    trafficLayer.value = null
    clearTrafficTiles()
  })

  return { mapRef, mapStyles, isMapReady, themeClass, fitFocus }
}
