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
      <div class="about-prose" v-html="html" />
    </div>
  </div>
</template>

<!-- Not scoped: the markup comes from v-html, and the dark overrides need a
     real `.dark` ancestor selector. -->
<style>
.about-prose h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: theme('colors.gray.900');
  margin-bottom: 1rem;
  line-height: 1.3;
}
.about-prose h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: theme('colors.gray.800');
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}
.about-prose h3 {
  font-size: 1rem;
  font-weight: 600;
  color: theme('colors.gray.700');
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
.about-prose p {
  font-size: 0.875rem;
  color: theme('colors.gray.600');
  line-height: 1.7;
  margin-bottom: 0.75rem;
}
.about-prose ul,
.about-prose ol {
  padding-left: 1.25rem;
  margin-bottom: 1rem;
}
.about-prose ul { list-style: disc; }
.about-prose ol { list-style: decimal; }
.about-prose li {
  font-size: 0.875rem;
  color: theme('colors.gray.600');
  line-height: 1.7;
  margin-bottom: 0.25rem;
}
.about-prose li::marker {
  color: theme('colors.primary.400');
}
.about-prose strong {
  font-weight: 600;
  color: theme('colors.gray.800');
}
.about-prose code {
  font-size: 0.8125rem;
  background: theme('colors.gray.100');
  color: theme('colors.gray.700');
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
.about-prose a {
  color: theme('colors.primary.600');
  text-decoration: none;
  font-weight: 500;
}
.about-prose a:hover {
  text-decoration: underline;
}

.dark .about-prose h1 { color: theme('colors.gray.100'); }
.dark .about-prose h2 { color: theme('colors.gray.200'); }
.dark .about-prose h3 { color: theme('colors.gray.300'); }
.dark .about-prose p,
.dark .about-prose li { color: theme('colors.gray.400'); }
.dark .about-prose strong { color: theme('colors.gray.200'); }
.dark .about-prose code { background: theme('colors.gray.700'); color: theme('colors.gray.300'); }
.dark .about-prose a { color: theme('colors.primary.400'); }
</style>
