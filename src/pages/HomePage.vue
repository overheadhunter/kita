<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSession } from '../store/session'
import { TOOLS } from '../tools'

const { me } = useSession()
const tools = computed(() => (me.value ? TOOLS.filter((tool) => tool.roles.includes(me.value!.role)) : []))
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <RouterLink
      v-for="tool in tools"
      :key="tool.path"
      :to="tool.path"
      class="flex gap-3 rounded-xl border border-neutral-200 p-4 hover:border-blue-400 hover:bg-blue-50 dark:border-neutral-800 dark:hover:border-blue-500 dark:hover:bg-blue-950"
    >
      <FontAwesomeIcon :icon="tool.icon" class="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div>
        <div class="font-semibold">{{ tool.title }}</div>
        <div class="text-sm text-neutral-600 dark:text-neutral-300">{{ tool.description[me!.role] }}</div>
      </div>
    </RouterLink>
  </div>
</template>
