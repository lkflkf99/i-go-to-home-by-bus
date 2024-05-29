import NProgress from 'nprogress'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/fav',
    },
    {
      path: '/route',
      name: 'Bus Routes',
      component: () => import('../views/Search.vue'),
    },
    {
      path: '/route/details',
      name: 'Bus Stops',
      component: () => import('../views/RouteDetails.vue'),
    },
    {
      path: '/fav',
      name: 'Favorite',
      component: () => import('../views/Fav.vue'),
    },
    {
      path: '/setting',
      name: 'Setting',
      component: () => import('../views/Setting.vue'),
    },
    {
      path: '/map',
      name: 'Map',
      component: () => import('../views/Map.vue'),
    },
  ],
})

router.beforeEach(() => {
  NProgress.start()
})
router.afterEach(() => {
  NProgress.done()
})

export default router
