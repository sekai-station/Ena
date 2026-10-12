import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Links always open in a new tab
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Render markdown to sanitized HTML, safe to pass to v-html. */
export function renderMarkdown(md: string): string {
  const template = document.createElement('template')
  template.innerHTML = DOMPurify.sanitize(marked.parse(md, { async: false }))
  // Keep wide tables scrollable without making the whole page overflow.
  for (const table of template.content.querySelectorAll('table')) {
    const wrapper = document.createElement('div')
    wrapper.className = 'markdown-table'
    wrapper.tabIndex = 0
    table.replaceWith(wrapper)
    wrapper.append(table)
  }
  return template.innerHTML
}
