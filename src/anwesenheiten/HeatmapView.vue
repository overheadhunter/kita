<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Counts } from '../../shared/anwesenheiten/heatmap'
import { defaultWeek, weekdays } from '../../shared/anwesenheiten/week'
import { dayLabel, hourLabel } from './format'
import { RouterLink } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faUsersGear } from '@fortawesome/free-solid-svg-icons'
import { api } from '../store/api'
import { useTheme } from '../store/theme'
import WeekGrid from './WeekGrid.vue'
import WeekNav from './WeekNav.vue'

const { dark } = useTheme()

const week = ref(defaultWeek(new Date()))
const counts = ref<Counts | null>(null)
const families = ref(0)
const totalFamilies = ref(0)
const failed = ref(false)

let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  try {
    const heatmap = await api.anwesenheiten.getHeatmap(week.value)
    if (seq !== loadSeq) return
    counts.value = heatmap.counts
    families.value = heatmap.families
    totalFamilies.value = heatmap.totalFamilies
    failed.value = false
  } catch {
    // a 401 is handled globally (store/session.ts)
    if (seq === loadSeq) failed.value = true
  }
}
watch(week, load, { immediate: true })

const max = computed(() => Math.max(0, ...(counts.value?.flat() ?? [])))

// one-hue sequential ramp (blue), light to dark; in dark mode the order flips so that more children always means more contrast against the surface
const LIGHT_RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
const DARK_RAMP = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4']

function cellStyle(count: number): Record<string, string> {
  if (count === 0 || max.value === 0) return {}
  const ramp = dark.value ? DARK_RAMP : LIGHT_RAMP
  const index = Math.round((count / max.value) * (ramp.length - 1))
  // dark ink on the light steps, white ink on the dark ones (the ramps' midpoints are where contrast flips)
  const lightStep = dark.value ? index >= 7 : index <= 5
  return { backgroundColor: ramp[index]!, color: lightStep ? '#0b0b0b' : '#ffffff' }
}

const dayLabels = computed(() => weekdays(week.value).map(dayLabel))

function cellTitle(day: number, slot: number, count: number): string {
  const label = dayLabels.value[day]!
  return `${label.weekday} ${label.date}, ${hourLabel(slot)} Uhr: ${count} ${count === 1 ? 'Kind' : 'Kinder'}`
}

// swatches for the legend, without numbers: the counts themselves are only shown on hover
const legend = computed(() => {
  const steps = Math.min(max.value, 5)
  return Array.from({ length: steps }, (_, i) => Math.max(1, Math.round(((i + 1) / steps) * max.value)))
})

// share of all families (as configured on /verwaltung) that entered data for this week
const confidence = computed(() => (totalFamilies.value > 0 ? Math.min(1, families.value / totalFamilies.value) : 0))
</script>

<template>
  <div class="flex flex-col gap-4">
    <WeekNav v-model="week" />

    <p v-if="failed" class="text-center text-sm text-red-600 dark:text-red-400">Daten konnten nicht geladen werden.</p>

    <section class="flex flex-col gap-1.5 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800" :class="{ 'opacity-50': !counts }">
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold">Aussagekraft</span>
        <span class="flex items-center gap-2">
          <span class="font-semibold tabular-nums">{{ Math.round(confidence * 100) }} %</span>
          <RouterLink
            to="/verwaltung"
            class="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Familien verwalten"
          >
            <FontAwesomeIcon :icon="faUsersGear" class="size-4" />
          </RouterLink>
        </span>
      </div>
      <div
        class="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
        role="meter"
        aria-label="Aussagekraft"
        :aria-valuenow="Math.round(confidence * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="h-full rounded-full bg-blue-600 transition-[width] dark:bg-blue-400" :style="{ width: `${confidence * 100}%` }"></div>
      </div>
      <p class="text-neutral-600 tabular-nums dark:text-neutral-300">{{ families }} von {{ totalFamilies }} Familien haben für diese Woche eingetragen.</p>
    </section>

    <WeekGrid :week="week" :class="{ 'opacity-50': !counts }">
      <template #cell="{ day, slot }">
        <!-- the count is only revealed on hover, or on focus for keyboard and touch users -->
        <div
          tabindex="0"
          class="group flex size-full items-center justify-center rounded-sm text-sm font-medium tabular-nums outline-offset-2"
          :class="{ 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400': !counts?.[day]?.[slot] }"
          :style="cellStyle(counts?.[day]?.[slot] ?? 0)"
          :aria-label="cellTitle(day, slot, counts?.[day]?.[slot] ?? 0)"
        >
          <span class="opacity-0 group-hover:opacity-100 group-focus:opacity-100">{{ counts?.[day]?.[slot] ?? 0 }}</span>
        </div>
      </template>
    </WeekGrid>

    <div v-if="legend.length" class="flex items-center justify-center gap-1 text-sm text-neutral-600 dark:text-neutral-300">
      <span>wenige Kinder</span>
      <span v-for="n in legend" :key="n" class="size-5 rounded-sm" :style="cellStyle(n)"></span>
      <span>viele Kinder</span>
    </div>
  </div>
</template>
