<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ABOUT } from 'virtual:locales'
import type { AppLocale } from '@/i18n'
import { renderMarkdown } from '@/utils/markdown'

const { t, locale } = useI18n()
const html = ref('')

// One Markdown file per language (src/assets/about_<language>.md), loaded when needed
watch(locale, async code => {
  const load = ABOUT[code as AppLocale]
  if (!load) return
  const md = (await load()).default
  // Ignore it if the language changed again while it loaded
  if (code === locale.value) html.value = renderMarkdown(md)
}, { immediate: true })
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- Page header -->
    <div class="px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 select-none">{{ t('sidebar.about') }}</h1>
    </div>

    <!-- Markdown content -->
    <div class="bg-white dark:bg-gray-900 px-4 sm:px-6 py-6">
      <div class="about-prose prose prose-sm prose-gray dark:prose-invert max-w-none prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-code:font-mono prose-pre:font-mono" v-html="html" />
    </div>
  </div>
</template>

<!-- v-html content needs unscoped selectors. Typography supplies the prose styles. -->
<style>
.about-prose {
  min-width: 0;
  overflow-wrap: anywhere;
}
.about-prose pre {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre;
  overflow-wrap: normal;
  tab-size: 2;
}
.about-prose .markdown-table {
  max-width: 100%;
  overflow-x: auto;
  margin: 1.5em 0;
}
.about-prose .markdown-table:focus-visible {
  outline: 2px solid theme('colors.primary.500');
  outline-offset: 2px;
}
.about-prose .markdown-table table {
  min-width: 36rem;
  margin: 0;
}
.about-prose td code { white-space: nowrap; }
</style>