<script setup lang="ts">
import RoomList from '@/components/room/RoomList.vue'
import FilterBar from '@/components/room/FilterBar.vue'
</script>

<template>
  <div class="w-full max-w-4xl mx-auto">
    <div class="bg-white/[0.86] dark:bg-gray-900/[0.86] min-h-screen">
      <header class="px-4 pt-3 pb-2">
        <h1 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ $t('seo.title') }}</h1>
        <p class="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ $t('seo.description') }}</p>
      </header>
      <FilterBar />
      <RoomList />
    </div>
  </div>
</template>
