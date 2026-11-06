<script setup lang="ts">
import { computed, ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleHalfStroke, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import HeatmapView from './components/HeatmapView.vue'
import PlanView from './components/PlanView.vue'
import { api, ApiError, forgetToken, hasToken, rememberToken, type Me } from './store/api'
import { useTheme } from './store/theme'

const { theme, cycle: cycleTheme } = useTheme()
const themeIcon = computed(() => ({ auto: faCircleHalfStroke, light: faSun, dark: faMoon })[theme.value])
const themeTitle = computed(() => ({ auto: 'Darstellung: automatisch', light: 'Darstellung: hell', dark: 'Darstellung: dunkel' })[theme.value])

const me = ref<Me | null>(null)
const state = ref<'loading' | 'ready' | 'invalid' | 'error'>(hasToken ? 'loading' : 'invalid')

function invalid() {
  forgetToken()
  state.value = 'invalid'
}

if (hasToken) {
  api
    .me()
    .then((result) => {
      me.value = result
      state.value = 'ready'
      // remembered only once accepted, so a mistyped link does not replace a working one
      rememberToken()
    })
    .catch((e: unknown) => (e instanceof ApiError && e.status === 401 ? invalid() : (state.value = 'error')))
}

const subtitle = computed(() => (me.value?.role === 'family' ? me.value.name : me.value?.role === 'staff' ? 'Wochenübersicht' : ''))
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Kita-Planer</h1>
        <p class="h-5 text-sm text-neutral-500 dark:text-neutral-400">{{ subtitle }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        :title="themeTitle"
        @click="cycleTheme"
      >
        <FontAwesomeIcon :icon="themeIcon" class="size-5" />
      </button>
    </header>

    <main>
      <p v-if="state === 'loading'" class="text-center text-neutral-500">Lade …</p>
      <div v-else-if="state === 'invalid'" class="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <p class="font-semibold">Link ungültig</p>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Bitte den vollständigen Link verwenden, den du von der Kita bekommen hast.</p>
      </div>
      <p v-else-if="state === 'error'" class="text-center text-red-600 dark:text-red-400">Die Kita-Daten sind gerade nicht erreichbar. Bitte später erneut versuchen.</p>
      <PlanView v-else-if="me?.role === 'family'" @unauthorized="invalid" />
      <HeatmapView v-else-if="me?.role === 'staff'" @unauthorized="invalid" />
    </main>
  </div>
</template>
