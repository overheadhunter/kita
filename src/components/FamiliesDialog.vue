<script setup lang="ts">
import { ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCheck, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons'
import { MAX_FAMILY_NAME_LENGTH } from '../../shared/plan'
import { ApiError, api, linkFor, type Family } from '../store/api'

const emit = defineEmits<{ changed: []; unauthorized: [] }>()

const dialog = ref<HTMLDialogElement>()
const families = ref<Family[] | null>(null)
const newName = ref('')
const error = ref('')
const confirming = ref<number | null>(null) // id of the family whose remove button currently asks "Sicher?"
const copied = ref<number | null>(null)

function fail(e: unknown, message: string) {
  if (e instanceof ApiError && e.status === 401) emit('unauthorized')
  else error.value = message
}

async function load() {
  try {
    families.value = await api.listFamilies()
  } catch (e) {
    fail(e, 'Familien konnten nicht geladen werden.')
  }
}

/** Opens the dialog and loads the current list. */
function open() {
  error.value = ''
  confirming.value = null
  families.value = null
  dialog.value?.showModal()
  void load()
}
defineExpose({ open })

async function add() {
  const name = newName.value.trim()
  if (!name) return
  error.value = ''
  try {
    const family = await api.addFamily(name)
    families.value = [...(families.value ?? []), family].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) || a.id - b.id)
    newName.value = ''
    emit('changed')
  } catch (e) {
    fail(e, 'Familie konnte nicht hinzugefügt werden.')
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
    await api.removeFamily(family.id)
    families.value = families.value?.filter((f) => f.id !== family.id) ?? null
    emit('changed')
  } catch (e) {
    fail(e, 'Familie konnte nicht entfernt werden.')
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
  <dialog
    ref="dialog"
    class="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40 dark:bg-neutral-900 dark:text-neutral-100"
    @click.self="dialog?.close()"
  >
    <div class="flex max-h-[85dvh] flex-col">
      <header class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 class="font-semibold">Familien verwalten</h2>
        <button type="button" class="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Schließen" @click="dialog?.close()">
          <FontAwesomeIcon :icon="faXmark" class="size-4" />
        </button>
      </header>

      <div class="overflow-y-auto px-4 py-2">
        <p v-if="!families" class="py-4 text-center text-sm text-neutral-500">Lade …</p>
        <p v-else-if="!families.length" class="py-4 text-center text-sm text-neutral-500">Noch keine Familien.</p>
        <ul v-else class="divide-y divide-neutral-200 dark:divide-neutral-800">
          <li v-for="family in families" :key="family.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span class="min-w-32 flex-1 font-medium">{{ family.name }}</span>
            <span class="flex min-w-0 flex-[2] items-center gap-1">
              <input
                readonly
                :value="linkFor(family.token)"
                class="min-w-0 flex-1 truncate rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
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

      <footer class="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <form class="flex gap-2" @submit.prevent="add">
          <input
            v-model="newName"
            :maxlength="MAX_FAMILY_NAME_LENGTH"
            placeholder="Name der neuen Familie"
            class="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
          />
          <button type="submit" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50" :disabled="!newName.trim()">
            Hinzufügen
          </button>
        </form>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Entfernte Familien können sich nicht mehr anmelden; ihre bisherigen Einträge bleiben in der Übersicht vergangener Wochen erhalten.
        </p>
      </footer>
    </div>
  </dialog>
</template>
