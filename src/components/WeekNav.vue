<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { addWeeks, mondayOf, today } from '../../shared/week'
import { relativeWeek, weekLabel } from '../format'

// `min` and `max` (Mondays as YYYY-MM-DD) limit navigation; without them the arrows go on indefinitely
const props = defineProps<{ min?: string; max?: string }>()
const week = defineModel<string>({ required: true })

const thisWeek = mondayOf(today(new Date()))
const relative = computed(() => relativeWeek(week.value, thisWeek))
// Mondays as YYYY-MM-DD compare correctly as strings
const canGoBack = computed(() => !props.min || week.value > props.min)
const canGoForward = computed(() => !props.max || week.value < props.max)
</script>

<template>
  <nav class="flex items-center justify-between gap-2">
    <button
      type="button"
      class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:invisible dark:text-neutral-300 dark:hover:bg-neutral-800"
      title="Vorherige Woche"
      :disabled="!canGoBack"
      @click="week = addWeeks(week, -1)"
    >
      <FontAwesomeIcon :icon="faChevronLeft" class="size-5" />
    </button>
    <div class="text-center">
      <div class="font-semibold tabular-nums">{{ weekLabel(week) }}</div>
      <div class="h-5 text-sm text-neutral-500 dark:text-neutral-400">{{ relative }}</div>
    </div>
    <button
      type="button"
      class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:invisible dark:text-neutral-300 dark:hover:bg-neutral-800"
      title="Nächste Woche"
      :disabled="!canGoForward"
      @click="week = addWeeks(week, 1)"
    >
      <FontAwesomeIcon :icon="faChevronRight" class="size-5" />
    </button>
  </nav>
</template>
