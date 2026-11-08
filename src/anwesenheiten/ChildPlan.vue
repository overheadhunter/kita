<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { click, covers, type DayState, type Days } from '../../shared/anwesenheiten/plan'
import { api, type Plan } from '../store/api'
import WeekGrid from './WeekGrid.vue'

// the editable week grid of one child; `plan` is null while the week is loading
const props = defineProps<{ week: string; child: number; plan: Plan | null }>()

const states = ref<DayState[]>([])
const draft = ref(false) // the shown days were copied from the previous week and are not saved yet
const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

watch(
  () => props.plan,
  (plan) => {
    states.value = (plan?.days ?? []).map((range) => ({ range, pending: null }))
    draft.value = plan?.source === 'prefill'
    status.value = 'idle'
  },
  { immediate: true },
)

const pending = computed(() => states.value.some((s) => s.pending !== null))

// after the first click on a day, the range the second click would select follows the pointer (or keyboard focus)
const hover = ref<{ day: number; slot: number } | null>(null)
const preview = computed(() => {
  if (!hover.value) return null
  const state = states.value[hover.value.day]
  if (state?.pending == null) return null
  return { day: hover.value.day, range: click(state, hover.value.slot).range }
})

// saves run one after another, so the server always ends up with the latest state; a 401 is handled globally (store/session.ts)
let queue = Promise.resolve()
function save() {
  const target = props.week
  const days: Days = states.value.map((s) => s.range)
  draft.value = false
  status.value = 'saving'
  queue = queue.then(async () => {
    try {
      await api.anwesenheiten.putPlan(target, props.child, days)
      if (target === props.week) status.value = 'saved'
    } catch {
      status.value = 'error'
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
  if (!props.plan) return 'Lade …'
  if (pending.value) return 'Jetzt das Ende wählen …'
  switch (status.value) {
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
  <div class="flex flex-col gap-3">
    <div
      v-if="draft"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-blue-400 bg-blue-50 px-3 py-2 text-sm dark:border-blue-500 dark:bg-blue-950"
    >
      <span>Vorschlag aus der Vorwoche – noch nicht gespeichert.</span>
      <button type="button" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700" @click="save">Übernehmen</button>
    </div>

    <WeekGrid :week="week" :class="{ 'pointer-events-none opacity-50': !plan }" @mouseleave="hover = null">
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
