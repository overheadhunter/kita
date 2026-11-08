<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleHalfStroke, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import type { Role } from './store/api'
import { useSession } from './store/session'
import { useTheme } from './store/theme'
import { TOOLS } from './tools'

const { theme, cycle: cycleTheme } = useTheme()
const themeIcon = computed(() => ({ auto: faCircleHalfStroke, light: faSun, dark: faMoon })[theme.value])
const themeTitle = computed(() => ({ auto: 'Darstellung: automatisch', light: 'Darstellung: hell', dark: 'Darstellung: dunkel' })[theme.value])

const { me, state } = useSession()
const route = useRoute()

const tools = computed(() => (me.value ? TOOLS.filter((tool) => tool.roles.includes(me.value!.role)) : []))
const subtitle = computed(() => (me.value?.role === 'family' ? me.value.name : me.value?.role === 'staff' ? 'Kita-Team' : ''))
// pages without `roles` (start page, 404) are open to every logged-in user
const allowed = computed(() => {
  const roles = route.meta.roles as Role[] | undefined
  return !roles || (me.value !== null && roles.includes(me.value.role))
})
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4">
    <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <RouterLink to="/" class="group">
        <h1 class="text-xl font-bold group-hover:underline">Kita</h1>
        <p class="h-5 text-sm text-neutral-500 dark:text-neutral-400">{{ subtitle }}</p>
      </RouterLink>
      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="tool in tools"
          :key="tool.path"
          :to="tool.path"
          class="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          active-class="bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
        >
          {{ tool.title }}
        </RouterLink>
        <button
          type="button"
          class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          :title="themeTitle"
          @click="cycleTheme"
        >
          <FontAwesomeIcon :icon="themeIcon" class="size-5" />
        </button>
      </nav>
    </header>

    <main>
      <p v-if="state === 'loading'" class="text-center text-neutral-500">Lade …</p>
      <div v-else-if="state === 'invalid'" class="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <p class="font-semibold">Link ungültig</p>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Bitte den vollständigen Link verwenden, den du von der Kita bekommen hast.</p>
      </div>
      <p v-else-if="state === 'error'" class="text-center text-red-600 dark:text-red-400">Die Kita-Daten sind gerade nicht erreichbar. Bitte später erneut versuchen.</p>
      <div v-else-if="!allowed" class="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <p class="font-semibold">Kein Zugriff</p>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Diese Seite ist nur für das Kita-Team. <RouterLink to="/" class="underline">Zur Startseite</RouterLink></p>
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>
