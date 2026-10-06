<script setup lang="ts">
import RoomList from '@/components/room/RoomList.vue'
import FilterBar from '@/components/room/FilterBar.vue'
</script>

<template>
  <div class="w-full max-w-4xl mx-auto">
    <div class="bg-white/[0.86] dark:bg-gray-900/[0.86] min-h-screen">
      <FilterBar />
      <RoomList />
    </div>
  </div>
</template>
