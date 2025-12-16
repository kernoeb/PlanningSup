import { shallowRef } from 'vue'

export interface PlanningPickerHandle {
  open: () => void
}

const handleRef = shallowRef<PlanningPickerHandle | null>(null)

export function usePlanningPickerController() {
  function register(handle: PlanningPickerHandle | null) {
    handleRef.value = handle
  }

  function open() {
    handleRef.value?.open()
  }

  return { open, register }
}
