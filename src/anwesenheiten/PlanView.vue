<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addWeeks, defaultWeek } from '../../shared/anwesenheiten/week'
import { api, type Plan } from '../store/api'
import { useSession } from '../store/session'
import ChildPlan from './ChildPlan.vue'
import WeekNav from './WeekNav.vue'

const { me } = useSession()
const children = computed(() => (me.value?.role === 'family' ? me.value.children : 1))

// families only need the preselected week and one week either side
const initialWeek = defaultWeek(new Date())
const week = ref(initialWeek)
const plans = ref<Plan[] | null>(null)
const failed = ref(false)

// a newer load wins over an older one still in flight, e.g. when the user clicks through weeks quickly; a 401 is handled globally (store/session.ts)
let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  plans.value = null
  try {
    const result = await api.anwesenheiten.getPlans(week.value)
    if (seq !== loadSeq) return
    plans.value = result.children
    failed.value = false
  } catch {
    if (seq === loadSeq) failed.value = true
  }
}
watch(week, load, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <WeekNav v-model="week" :min="addWeeks(initialWeek, -1)" :max="addWeeks(initialWeek, 1)" />

    <p v-if="failed" class="text-center text-sm text-red-600 dark:text-red-400">Daten konnten nicht geladen werden – bitte Seite neu laden.</p>

    <!-- one grid per child; without names, so headings only distinguish several children -->
    <section v-for="child in children" :key="child" class="flex flex-col gap-2">
      <h2 v-if="children > 1" class="font-semibold">Kind {{ child }}</h2>
      <ChildPlan :week="week" :child="child" :plan="plans?.[child - 1] ?? null" />
    </section>
  </div>
</template>
