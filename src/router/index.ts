import NProgress from 'nprogress'
import { createRouter, createWebHistory } from 'vue-router'

export const TAB_PATHS = ['/fav', '/route', '/plan-route', '/map', '/setting']

const isTabPath = (path: string) => TAB_PATHS.includes(path)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/fav',
    },
    {
      path: '/route',
      name: 'Search',
      component: () => import('../views/Search.vue'),
    },
    {
      path: '/route/details',
      name: 'Bus Stops',
      component: () => import('../views/RouteDetails.vue'),
    },
    {
      path: '/plan-route',
      name: 'Plan',
      component: () => import('../views/RoutePlanning.vue'),
    },
    {
      path: '/fav',
      name: 'Favorites',
      component: () => import('../views/Fav.vue'),
    },
    {
      path: '/setting',
      name: 'Settings',
      component: () => import('../views/Setting.vue'),
    },
    {
      path: '/map',
      name: 'Map',
      component: () => import('../views/Map.vue'),
    },
  ],
})

router.beforeEach((to, from) => {
  if (from.name && !(isTabPath(to.path) && isTabPath(from.path))) {
    NProgress.start()
  }
})
router.afterEach(() => {
  NProgress.done()
})

export default router
