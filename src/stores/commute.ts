import { defineStore } from 'pinia'
import type { BusRoute, SavedPlace } from '@/model'
import { isSameRoute, withCompany } from '@/utils'

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const useCommuteStore = defineStore({
  id: 'commute',
  state: () => ({
    favRoutes: readJson<BusRoute[]>('favRoutes', []),
    homePlace: readJson<SavedPlace | null>('homePlace', null),
    workPlace: readJson<SavedPlace | null>('workPlace', null),
  }),
  actions: {
    persistFavs() {
      localStorage.setItem('favRoutes', JSON.stringify(this.favRoutes))
    },
    isFav(route: BusRoute) {
      return this.favRoutes.some((item) => isSameRoute(item, route))
    },
    toggleFav(route: BusRoute) {
      if (this.isFav(route)) {
        this.favRoutes = this.favRoutes.filter((item) => !isSameRoute(item, route))
      } else {
        this.favRoutes = this.favRoutes.concat(withCompany(route))
      }
      this.persistFavs()
    },
    removeFav(route: BusRoute) {
      this.favRoutes = this.favRoutes.filter((item) => !isSameRoute(item, route))
      this.persistFavs()
    },
    setHome(place: SavedPlace | null) {
      this.homePlace = place
      if (place) {
        localStorage.setItem('homePlace', JSON.stringify(place))
      } else {
        localStorage.removeItem('homePlace')
      }
    },
    setWork(place: SavedPlace | null) {
      this.workPlace = place
      if (place) {
        localStorage.setItem('workPlace', JSON.stringify(place))
      } else {
        localStorage.removeItem('workPlace')
      }
    },
  },
})
