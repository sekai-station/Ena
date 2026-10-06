<script setup lang="ts">
import { useDocumentVisibility } from '@vueuse/core'

const visibility = useDocumentVisibility()

// y: lane across the flight layer (% of its height; 30–70 stays on screen at
// common aspect ratios). rest: where the plane sits when motion is reduced.
const PLANES = [
  { y: 31, size: 32, duration: 46, delay: -6, rest: 62 },
  { y: 40, size: 24, duration: 38, delay: -21, rest: 38 },
  { y: 49, size: 37, duration: 52, delay: -40, rest: 70 },
  { y: 57, size: 26, duration: 41, delay: -12, rest: 45 },
  { y: 66, size: 30, duration: 49, delay: -31, rest: 56 },
  { y: 36, size: 22, duration: 35, delay: -28, rest: 30 },
]
</script>

<template>
  <div class="app-bg" :class="{ paused: visibility === 'hidden' }" aria-hidden="true">
    <div class="flight">
      <span
        v-for="(p, i) in PLANES"
        :key="i"
        class="plane"
        :style="{ '--y': `${p.y}%`, '--w': `${p.size}px`, '--d': `${p.duration}s`, '--delay': `${p.delay}s`, '--rest': `${p.rest}cqw` }"
      >
        <!-- A paper plane seen from above and in front of its left wing (camera raised
             25°, swung 35° towards the nose), projected from a small 3D model and levelled
             so the nose and the tail notch sit on the flight line. Far wing, keel, near wing. -->
        <svg viewBox="0 0 64.0 30.37">
          <path d="M62.0 18.56 L13.79 18.56 L22.39 2.0 Z" fill="currentColor" fill-opacity="0.45" />
          <path d="M62.0 18.56 L13.79 18.56 L21.52 28.37 Z" fill="currentColor" fill-opacity="0.85" />
          <path d="M62.0 18.56 L2.0 24.33 L13.79 18.56 Z" fill="currentColor" fill-opacity="1.0" />
        </svg>
      </span>
    </div>
  </div>
</template>

<style scoped>
.app-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Planes fly along this layer's x-axis. Tilting the whole layer, rather than
   each plane, keeps nose, trail and flight path on one line at any aspect ratio. */
.flight {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 130vmax;
  height: 130vmax;
  transform: translate(-50%, -50%) rotate(-20deg);
  container-type: size;
}

.plane {
  position: absolute;
  left: 0;
  top: var(--y);
  width: var(--w);
  aspect-ratio: 64.0 / 30.37;
  color: var(--plane-color);
  opacity: var(--plane-opacity);
  will-change: transform;
  animation: fly var(--d) linear var(--delay) infinite;
}

.plane svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* Dashed trail leaving from the tail notch (21.5% across, 61.1% down the drawing) */
.plane::before {
  content: "";
  position: absolute;
  right: 78.5%;
  top: 61.1%;
  width: calc(var(--w) * 4);
  border-top: 1.5px dashed currentColor;
  transform: translateY(-50%);
  -webkit-mask: linear-gradient(to left, #000, transparent);
  mask: linear-gradient(to left, #000, transparent);
}

@keyframes fly {
  from { transform: translateX(-8cqw); }
  to { transform: translateX(108cqw); }
}

.paused .plane {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .plane {
    animation: none;
    transform: translateX(var(--rest));
  }
}
</style>
