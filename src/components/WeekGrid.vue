<script setup lang="ts">
import { computed } from 'vue'
import { SLOT_COUNT } from '../../shared/plan'
import { weekdays } from '../../shared/week'
import { dayLabel, hourLabel } from '../format'

// layout shared by the parent grid and the heatmap: hours as rows, Monday to Friday as columns; the cells come from the `cell` slot
const props = defineProps<{ week: string }>()
defineSlots<{
  cell(props: { day: number; slot: number }): unknown
  'day-action'?(props: { day: number }): unknown
}>()

const days = computed(() => weekdays(props.week).map(dayLabel))
const slots = Array.from({ length: SLOT_COUNT }, (_, slot) => slot)
</script>

<template>
  <div class="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-0.5">
    <div></div>
    <div v-for="(label, day) in days" :key="day" class="flex flex-col items-center pb-1 text-sm">
      <span class="font-semibold">{{ label.weekday }}</span>
      <span class="text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{{ label.date }}</span>
      <slot name="day-action" :day="day" />
    </div>
    <template v-for="slot in slots" :key="slot">
      <div class="flex items-center pr-2 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{{ hourLabel(slot) }}</div>
      <div v-for="(_, day) in days" :key="day" class="h-10">
        <slot name="cell" :day="day" :slot="slot" />
      </div>
    </template>
  </div>
</template>
