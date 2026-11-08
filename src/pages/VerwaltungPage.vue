<script setup lang="ts">
import { ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons'
import { MAX_CHILDREN, MAX_FAMILY_NAME_LENGTH } from '../../shared/families'
import { api, linkFor, type Family } from '../store/api'

const CHILDREN_OPTIONS = Array.from({ length: MAX_CHILDREN }, (_, i) => i + 1)

const families = ref<Family[] | null>(null)
const newName = ref('')
const newChildren = ref(1)
const error = ref('')
const confirming = ref<number | null>(null) // id of the family whose remove button currently asks "Sicher?"
const copied = ref<number | null>(null)

// a 401 is handled globally (store/session.ts)
api.families
  .list()
  .then((list) => (families.value = list))
  .catch(() => (error.value = 'Familien konnten nicht geladen werden.'))

async function add() {
  const name = newName.value.trim()
  if (!name) return
  error.value = ''
  try {
    const family = await api.families.add(name, newChildren.value)
    families.value = [...(families.value ?? []), family].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) || a.id - b.id)
    newName.value = ''
    newChildren.value = 1
  } catch {
    error.value = 'Familie konnte nicht hinzugefügt werden.'
  }
}

async function setChildren(family: Family, event: Event) {
  const select = event.target as HTMLSelectElement
  const children = Number(select.value)
  // fewer children: the dropped children's entries from this week on are deleted by the server, so ask first
  if (children < family.children) {
    const dropped = children + 1 === family.children ? `Kind ${family.children}` : `Kind ${children + 1}–${family.children}`
    if (!confirm(`${family.name}: Einträge von ${dropped} ab dieser Woche werden gelöscht. Fortfahren?`)) {
      select.value = String(family.children)
      return
    }
  }
  error.value = ''
  try {
    const updated = await api.families.setChildren(family.id, children)
    family.children = updated.children
  } catch {
    select.value = String(family.children)
    error.value = 'Anzahl der Kinder konnte nicht geändert werden.'
  }
}

// first click arms the button ("Sicher?"), second click removes
async function remove(family: Family) {
  if (confirming.value !== family.id) {
    confirming.value = family.id
    return
  }
  confirming.value = null
  error.value = ''
  try {
    await api.families.remove(family.id)
    families.value = families.value?.filter((f) => f.id !== family.id) ?? null
  } catch {
    error.value = 'Familie konnte nicht entfernt werden.'
  }
}

async function copy(family: Family) {
  try {
    await navigator.clipboard.writeText(linkFor(family.token))
    copied.value = family.id
    setTimeout(() => copied.value === family.id && (copied.value = null), 1500)
  } catch {
    error.value = 'Kopieren nicht möglich – bitte den Link markieren und manuell kopieren.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-lg font-semibold">Familien</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Jede Familie meldet sich mit ihrem persönlichen Link an; er gilt für alle Bereiche. Beim Entfernen einer Familie werden ihr Link
        ungültig und alle ihre Einträge gelöscht, auch die vergangener Wochen.
      </p>
    </div>

    <form class="flex gap-2" @submit.prevent="add">
      <input
        v-model="newName"
        :maxlength="MAX_FAMILY_NAME_LENGTH"
        placeholder="Name der neuen Familie"
        class="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
      />
      <label class="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300">
        Kinder
        <select v-model.number="newChildren" class="rounded border border-neutral-300 bg-transparent px-1 py-1 dark:border-neutral-700 dark:bg-neutral-950">
          <option v-for="n in CHILDREN_OPTIONS" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <button type="submit" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50" :disabled="!newName.trim()">
        Hinzufügen
      </button>
    </form>

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <p v-if="!families" class="py-4 text-center text-sm text-neutral-500">Lade …</p>
    <p v-else-if="!families.length" class="py-4 text-center text-sm text-neutral-500">Noch keine Familien.</p>
    <ul v-else class="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      <li v-for="family in families" :key="family.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <span class="min-w-32 flex-1 font-medium">{{ family.name }}</span>
        <label class="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300" :title="`Anzahl der Kinder von ${family.name}`">
          Kinder
          <select
            :value="family.children"
            class="rounded border border-neutral-300 bg-transparent px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-950"
            @change="setChildren(family, $event)"
          >
            <option v-for="n in CHILDREN_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <span class="flex min-w-0 flex-[2] items-center gap-1">
          <input
            readonly
            :value="linkFor(family.token)"
            class="min-w-0 flex-1 truncate rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            :title="copied === family.id ? 'Kopiert' : 'Link kopieren'"
            @click="copy(family)"
          >
            <FontAwesomeIcon :icon="copied === family.id ? faCheck : faCopy" class="size-3.5" />
          </button>
        </span>
        <button
          type="button"
          class="w-20 rounded px-2 py-1 text-sm"
          :class="confirming === family.id ? 'bg-red-600 font-medium text-white hover:bg-red-700' : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'"
          @click="remove(family)"
          @blur="confirming === family.id && (confirming = null)"
          @mouseleave="confirming === family.id && (confirming = null)"
        >
          {{ confirming === family.id ? 'Sicher?' : 'Entfernen' }}
        </button>
      </li>
    </ul>
  </div>
</template>
