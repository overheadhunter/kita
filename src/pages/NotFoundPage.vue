<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
    <p class="font-semibold">Seite nicht gefunden</p>
    <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400"><RouterLink to="/" class="underline">Zur Startseite</RouterLink></p>
  </div>
</template>
