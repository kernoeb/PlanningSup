<script setup lang="ts">
import { useAuth } from '@web/composables/useAuth'
import { Fingerprint as IconFingerprint, Loader2 as IconLoader, Pencil as IconPencil, Plus as IconPlus, Trash2 as IconTrash, X as IconX } from 'lucide-vue-next'
import { computed, ref } from 'vue'

defineOptions({ name: 'PasskeySettings' })

interface Passkey {
  readonly id: string
  readonly name?: string | undefined
  readonly createdAt: Date
  readonly deviceType: string
}

const { addPasskey, deletePasskey, isPasskeyAvailable, usePasskeyList, passkeySupported, updatePasskey } = useAuth()

// Get the reactive passkey list store
const passkeyListStore = usePasskeyList()

const isAdding = ref(false)
const error = ref<string | null>(null)

// For adding new passkey
const showAddDialog = ref(false)
const newPasskeyName = ref('')

// For editing passkey name
const editingPasskeyId = ref<string | null>(null)
const editingName = ref('')

// For delete confirmation
const deletingPasskeyId = ref<string | null>(null)

const webAuthnSupported = computed(() => isPasskeyAvailable())

// Computed passkey list from the reactive store
const passkeys = computed<readonly Passkey[]>(() => (passkeyListStore.value?.data ?? []) as readonly Passkey[])
const isLoading = computed(() => passkeyListStore.value?.isPending ?? false)

// Refetch passkeys when needed
function refetchPasskeys() {
  passkeyListStore.value?.refetch?.()
}

async function handleAddPasskey() {
  if (!passkeySupported) return

  isAdding.value = true
  error.value = null

  try {
    const name = newPasskeyName.value.trim() || undefined
    const result = await addPasskey(name)
    if (result.error) {
      error.value = result.error.message || 'Impossible d\'ajouter le passkey'
    } else {
      showAddDialog.value = false
      newPasskeyName.value = ''
      refetchPasskeys()
    }
  } catch (e) {
    error.value = 'Erreur lors de l\'ajout du passkey'
    console.error('Error adding passkey:', e)
  } finally {
    isAdding.value = false
  }
}

async function handleDeletePasskey(id: string) {
  if (!passkeySupported) return

  error.value = null

  try {
    const result = await deletePasskey(id)
    if (result.error) {
      error.value = result.error.message || 'Impossible de supprimer le passkey'
    } else {
      deletingPasskeyId.value = null
      refetchPasskeys()
    }
  } catch (e) {
    error.value = 'Erreur lors de la suppression du passkey'
    console.error('Error deleting passkey:', e)
  }
}

async function handleUpdatePasskey() {
  if (!passkeySupported || !editingPasskeyId.value) return

  error.value = null

  try {
    const result = await updatePasskey(editingPasskeyId.value, editingName.value.trim())
    if (result.error) {
      error.value = result.error.message || 'Impossible de renommer le passkey'
    } else {
      editingPasskeyId.value = null
      editingName.value = ''
      refetchPasskeys()
    }
  } catch (e) {
    error.value = 'Erreur lors du renommage du passkey'
    console.error('Error updating passkey:', e)
  }
}

function startEditing(passkey: Passkey) {
  editingPasskeyId.value = passkey.id
  editingName.value = passkey.name || ''
}

function cancelEditing() {
  editingPasskeyId.value = null
  editingName.value = ''
}

function formatDate(date: Date | null): string {
  if (!date) return 'Date inconnue'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getDefaultPasskeyName(): string {
  const nums = passkeys.value
    .map(p => p.name?.match(/^Passkey (\d+)$/)?.[1])
    .filter((n): n is string => n != null)
    .map(Number)
  return `Passkey ${nums.length > 0 ? Math.max(...nums) + 1 : 1}`
}

// The reactive store auto-fetches when accessed, but we can manually refetch if needed
// No onMounted needed - the store handles it
</script>

<template>
  <section v-if="passkeySupported">
    <h4 class="font-semibold mb-2">
      Passkeys
    </h4>

    <!-- WebAuthn not supported warning -->
    <div v-if="!webAuthnSupported" class="alert alert-warning text-sm">
      <span>Votre navigateur ne supporte pas les passkeys (WebAuthn).</span>
    </div>

    <template v-else>
      <!-- Error message -->
      <div v-if="error" class="alert alert-error text-sm mb-3">
        <span>{{ error }}</span>
        <button class="btn btn-ghost btn-xs" type="button" @click="error = null">
          <IconX class="size-4" />
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading && passkeys.length === 0" class="flex items-center gap-2 text-base-content/60 py-4">
        <IconLoader class="size-5 animate-spin" />
        <span>Chargement...</span>
      </div>

      <!-- Passkeys list -->
      <div v-else class="space-y-2">
        <div
          v-for="passkey in passkeys"
          :key="passkey.id"
          class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
        >
          <!-- Editing mode -->
          <template v-if="editingPasskeyId === passkey.id">
            <input
              v-model="editingName"
              class="input input-sm input-bordered flex-1 mr-2"
              placeholder="Nom du passkey"
              type="text"
              @keyup.enter="handleUpdatePasskey"
              @keyup.escape="cancelEditing"
            >
            <div class="flex gap-1">
              <button
                class="btn btn-sm btn-primary"
                :disabled="isLoading"
                type="button"
                @click="handleUpdatePasskey"
              >
                OK
              </button>
              <button
                class="btn btn-sm btn-ghost"
                type="button"
                @click="cancelEditing"
              >
                <IconX class="size-4" />
              </button>
            </div>
          </template>

          <!-- Delete confirmation mode -->
          <template v-else-if="deletingPasskeyId === passkey.id">
            <span class="text-sm text-error">Confirmer la suppression ?</span>
            <div class="flex gap-1">
              <button
                class="btn btn-sm btn-error"
                :disabled="isLoading"
                type="button"
                @click="handleDeletePasskey(passkey.id)"
              >
                Supprimer
              </button>
              <button
                class="btn btn-sm btn-ghost"
                type="button"
                @click="deletingPasskeyId = null"
              >
                Annuler
              </button>
            </div>
          </template>

          <!-- Normal display mode -->
          <template v-else>
            <div class="flex items-center gap-3">
              <IconFingerprint class="size-5 text-primary" />
              <div>
                <div class="font-medium">
                  {{ passkey.name || 'Passkey sans nom' }}
                </div>
                <div class="text-xs text-base-content/60">
                  {{ formatDate(passkey.createdAt) }} - {{ passkey.deviceType === 'singleDevice' ? 'Cet appareil' : 'Multi-appareils' }}
                </div>
              </div>
            </div>
            <div class="flex gap-1">
              <button
                aria-label="Renommer"
                class="btn btn-sm btn-ghost"
                title="Renommer"
                type="button"
                @click="startEditing(passkey)"
              >
                <IconPencil class="size-4" />
              </button>
              <button
                aria-label="Supprimer"
                class="btn btn-sm btn-ghost text-error"
                title="Supprimer"
                type="button"
                @click="deletingPasskeyId = passkey.id"
              >
                <IconTrash class="size-4" />
              </button>
            </div>
          </template>
        </div>

        <!-- Empty state -->
        <div v-if="passkeys.length === 0 && !isLoading" class="text-sm text-base-content/60 py-2">
          Aucun passkey enregistré. Ajoutez-en un pour vous connecter plus rapidement.
        </div>
      </div>

      <!-- Add passkey button -->
      <div class="mt-3">
        <button
          v-if="!showAddDialog"
          class="btn btn-sm btn-outline gap-2"
          :disabled="isLoading"
          type="button"
          @click="showAddDialog = true; newPasskeyName = getDefaultPasskeyName()"
        >
          <IconPlus class="size-4" />
          Ajouter un passkey
        </button>

        <!-- Add passkey form -->
        <div v-else class="flex items-center gap-2">
          <input
            v-model="newPasskeyName"
            class="input input-sm input-bordered flex-1"
            placeholder="Nom du passkey (optionnel)"
            type="text"
            @keyup.enter="handleAddPasskey"
            @keyup.escape="showAddDialog = false"
          >
          <button
            class="btn btn-sm btn-primary"
            :disabled="isAdding"
            type="button"
            @click="handleAddPasskey"
          >
            <IconLoader v-if="isAdding" class="size-4 animate-spin" />
            <template v-else>
              Ajouter
            </template>
          </button>
          <button
            class="btn btn-sm btn-ghost"
            :disabled="isAdding"
            type="button"
            @click="showAddDialog = false"
          >
            <IconX class="size-4" />
          </button>
        </div>
      </div>

      <p class="text-xs text-base-content/60 mt-2">
        Les passkeys vous permettent de vous connecter rapidement avec votre empreinte, Face ID ou un code PIN, sans passer par Discord ou GitHub.
      </p>
    </template>
  </section>
</template>
