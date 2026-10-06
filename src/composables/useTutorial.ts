import { ref } from 'vue'

export type TutorialPhase = 'off' | 'welcome' | 'steps'

// The example room embedded in the guide's box; it never enters the feed
export const TUTORIAL_KEY = 'tutorial-demo'
export const TUTORIAL_ROOM_ID = '00000'

const STORAGE_KEY = 'pjsk-onboarding'

const phase = ref<TutorialPhase>('off')
// Bumped when the example room's number is copied; the guide watches it
const copyCount = ref(0)
// The example's pin lives here, never in the saved pinned rooms
const examplePinned = ref(false)

function seen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return true
  }
}

function remember(result: 'done' | 'skipped') {
  try {
    localStorage.setItem(STORAGE_KEY, result)
  } catch {
    // Storage unavailable: the welcome box may show again next visit
  }
}

export function useTutorial() {
  return {
    phase,
    copyCount,
    examplePinned,
    /** Shows the welcome box unless this browser has answered it before. */
    showOnFirstVisit() {
      if (phase.value === 'off' && !seen()) phase.value = 'welcome'
    },
    openWelcome() {
      phase.value = 'welcome'
    },
    start() {
      phase.value = 'steps'
    },
    close(result: 'done' | 'skipped') {
      remember(result)
      phase.value = 'off'
    },
    notifyCopy() {
      copyCount.value++
    },
  }
}
