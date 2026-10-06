import { createRouter, createWebHashHistory } from 'vue-router'
// The room list is the first thing everyone sees; ship it with the main bundle
import RoomListPage from '@/pages/RoomListPage.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'rooms', component: RoomListPage },
    { path: '/about', name: 'about', component: () => import('@/pages/AboutPage.vue') },
    { path: '/status', name: 'status', component: () => import('@/pages/StatusPage.vue') },
  ],
})
