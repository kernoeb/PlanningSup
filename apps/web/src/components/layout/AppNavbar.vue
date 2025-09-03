<script lang="ts" setup>
import PlanningPicker from '@web/components/planning/PlanningPicker.vue'
import { usePlanningData } from '@web/composables/usePlanningData'

const { title } = usePlanningData()
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm px-3">
    <div class="flex-1 flex items-center gap-3">
      <a class="text-xl flex items-center gap-1 font-bold">
        <div class="avatar">
          <div class="w-8 rounded">
            <img
              alt="Tailwind-CSS-Avatar-component"
              src="@web/assets/icon.png"
            >
          </div>
        </div>
        PlanningSup
      </a>
      <div class="sm:flex items-center gap-2">
        <span class="badge truncate max-w-[22rem] h-6">{{ title }}</span>
        <PlanningPicker>
          <template #trigger="{ open }">
            <button class="btn btn-secondary h-6 min-h-6" type="button" @click="open">
              Changer de planning
            </button>
          </template>
        </PlanningPicker>
      </div>
    </div>
    <div class="flex-none">
      <div class="dropdown dropdown-end">
        <div class="btn btn-ghost btn-circle avatar" role="button" tabindex="0">
          <div class="w-10 rounded-full">
            <img
              alt="Tailwind CSS Navbar component"
              src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
            >
          </div>
        </div>
        <ul class="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow" tabindex="0">
          <li>
            <a class="justify-between">
              Profile
              <span class="badge">New</span>
            </a>
          </li>
          <li><a>Settings</a></li>
          <li><a>Logout</a></li>
        </ul>
      </div>
    </div>
  </div>
</template>
