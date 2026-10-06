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
  return DOMPurify.sanitize(marked.parse(md, { async: false }))
}
