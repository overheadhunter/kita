import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import { TOOLS } from './tools'

// deep links like /anwesenheiten work because the Worker serves index.html for unknown paths (not_found_handling in wrangler.jsonc)
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage, meta: { title: 'Kita' } },
    ...TOOLS.map((tool) => ({ path: tool.path, component: tool.component!, meta: { title: tool.title, roles: tool.roles } })),
    { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue'), meta: { title: 'Nicht gefunden' } },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title && title !== 'Kita' ? `${title} · Kita` : 'Kita'
})
