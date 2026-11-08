<script setup lang="ts">
import { useSession } from '../store/session'
import HeatmapView from './HeatmapView.vue'
import PlanView from './PlanView.vue'

// families enter their week, staff see the heatmap
const { me } = useSession()
</script>

<template>
  <PlanView v-if="me?.role === 'family'" />
  <HeatmapView v-else-if="me?.role === 'staff'" />
</template>
