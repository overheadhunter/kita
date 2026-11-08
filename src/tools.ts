import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCalendarWeek, faUsersGear } from '@fortawesome/free-solid-svg-icons'
import type { RouteRecordRaw } from 'vue-router'
import type { Role } from './store/api'

/** A page of the site, shown on the start page and in the navigation for the listed roles. */
export type Tool = {
  path: string
  title: string
  description: Record<Role, string>
  icon: IconDefinition
  roles: Role[]
  component: RouteRecordRaw['component']
}

// add new tools here; each one gets a route, a tile on the start page and a navigation entry
export const TOOLS: Tool[] = [
  {
    path: '/anwesenheiten',
    title: 'Anwesenheiten',
    description: {
      family: 'Eintragen, wann euer Kind diese Woche in der Kita ist.',
      staff: 'Wann sind wie viele Kinder da? Wochenübersicht als Heatmap.',
    },
    icon: faCalendarWeek,
    roles: ['family', 'staff'],
    component: () => import('./anwesenheiten/AnwesenheitenPage.vue'),
  },
  {
    path: '/verwaltung',
    title: 'Verwaltung',
    description: {
      family: '',
      staff: 'Familien anlegen und entfernen, persönliche Links verteilen.',
    },
    icon: faUsersGear,
    roles: ['staff'],
    component: () => import('./pages/VerwaltungPage.vue'),
  },
]
