<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { click, covers, type DayState, type Days } from '../../shared/plan'
import { addWeeks, defaultWeek } from '../../shared/week'
import { ApiError, api } from '../store/api'
import WeekGrid from './WeekGrid.vue'
import WeekNav from './WeekNav.vue'

const emit = defineEmits<{ unauthorized: [] }>()

// families only need the preselected week and one week either side
const initialWeek = defaultWeek(new Date())
const week = ref(initialWeek)
const states = ref<DayState[]>([])
const draft = ref(false) // the shown days were copied from the previous week and are not saved yet
const status = ref<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading')

const pending = computed(() => states.value.some((s) => s.pending !== null))

// after the first click on a day, the range the second click would select follows the pointer (or keyboard focus)
const hover = ref<{ day: number; slot: number } | null>(null)
const preview = computed(() => {
  if (!hover.value) return null
  const state = states.value[hover.value.day]
  if (state?.pending == null) return null
  return { day: hover.value.day, range: click(state, hover.value.slot).range }
})

function fail(e: unknown) {
  if (e instanceof ApiError && e.status === 401) emit('unauthorized')
  else status.value = 'error'
}

// a newer load wins over an older one still in flight, e.g. when the user clicks through weeks quickly
let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  status.value = 'loading'
  try {
    const plan = await api.getPlan(week.value)
    if (seq !== loadSeq) return
    states.value = plan.days.map((range) => ({ range, pending: null }))
    draft.value = plan.source === 'prefill'
    status.value = 'idle'
  } catch (e) {
    if (seq === loadSeq) fail(e)
  }
}
watch(week, load, { immediate: true })

// saves run one after another, so the server always ends up with the latest state
let queue = Promise.resolve()
function save() {
  const target = week.value
  const days: Days = states.value.map((s) => s.range)
  draft.value = false
  status.value = 'saving'
  queue = queue.then(async () => {
    try {
      await api.putPlan(target, days)
      if (target === week.value) status.value = 'saved'
    } catch (e) {
      fail(e)
    }
  })
}

function onCell(day: number, slot: number) {
  const next = click(states.value[day]!, slot)
  states.value[day] = next
  if (next.pending === null) save()
}

function clearDay(day: number) {
  states.value[day] = { range: null, pending: null }
  save()
}

function cellClass(day: number, slot: number): string {
  const state = states.value[day]
  if (!state) return 'bg-neutral-100 dark:bg-neutral-800'
  if (state.pending === slot) return 'bg-blue-400 ring-2 ring-inset ring-blue-700 dark:bg-blue-600 dark:ring-blue-300'
  if (preview.value?.day === day && covers(preview.value.range, slot)) return 'bg-blue-300 dark:bg-blue-800'
  if (covers(state.range, slot)) {
    return draft.value
      ? 'bg-blue-100 border-2 border-dashed border-blue-400 dark:bg-blue-950 dark:border-blue-500'
      : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400'
  }
  return 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
}

const statusText = computed(() => {
  if (pending.value) return 'Jetzt das Ende wählen …'
  switch (status.value) {
    case 'loading':
      return 'Lade …'
    case 'saving':
      return 'Speichere …'
    case 'saved':
      return 'Gespeichert'
    case 'error':
      return 'Fehler – bitte Seite neu laden'
    default:
      return 'Pro Tag Beginn und Ende antippen.'
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <WeekNav v-model="week" :min="addWeeks(initialWeek, -1)" :max="addWeeks(initialWeek, 1)" />

    <div
      v-if="draft"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-blue-400 bg-blue-50 px-3 py-2 text-sm dark:border-blue-500 dark:bg-blue-950"
    >
      <span>Vorschlag aus der Vorwoche – noch nicht gespeichert.</span>
      <button type="button" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700" @click="save">Übernehmen</button>
    </div>

    <WeekGrid :week="week" :class="{ 'pointer-events-none opacity-50': status === 'loading' }" @mouseleave="hover = null">
      <template #day-action="{ day }">
        <button
          type="button"
          class="mt-1 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:invisible dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title="Tag leeren (kein Kita-Besuch)"
          :disabled="!states[day]?.range && states[day]?.pending === null"
          @click="clearDay(day)"
        >
          <FontAwesomeIcon :icon="faXmark" class="size-3.5" />
        </button>
      </template>
      <template #cell="{ day, slot }">
        <button
          type="button"
          class="size-full rounded-sm transition-colors"
          :class="cellClass(day, slot)"
          @click="onCell(day, slot)"
          @mouseenter="hover = { day, slot }"
          @focus="hover = { day, slot }"
        ></button>
      </template>
    </WeekGrid>

    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400" :class="{ 'text-red-600 dark:text-red-400': status === 'error' }">{{ statusText }}</p>
  </div>
</template>
