<template>
  <div class="flex justify-center px-4">
    <div
      v-if="isCollapsed"
      class="run-ticker-island relative flex size-11 items-center justify-center overflow-hidden rounded-full border shadow-sm backdrop-blur-xl transition-all duration-300 ease-out supports-[backdrop-filter]:bg-background/45"
      :class="collapsedShellClass"
      :data-run-ticker="'compact'"
      :data-run-status="props.snapshot.status"
    >
      <div class="pointer-events-none absolute inset-x-2 top-0 h-px bg-white/45 opacity-80" />
      <span class="text-base font-semibold leading-none" :class="collapsedGlyphClass">✓</span>
    </div>
    <div
      v-else
      class="run-ticker-island relative w-full max-w-[38rem] overflow-hidden rounded-[26px] border px-3.5 py-2.5 shadow-[0_18px_56px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-all duration-300 ease-out supports-[backdrop-filter]:bg-background/45"
      :class="activeShellClass"
      :data-run-ticker="'active'"
      :data-run-status="props.snapshot.status"
    >
      <div class="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/45 opacity-80" />
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full border shadow-inner"
          :class="orbClass"
        >
          <span class="size-2 rounded-full" :class="[dotClass, pulseClass]" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground/95">
            <span
              class="mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/75"
            >
              {{ statusLabel }}
            </span>
            {{ summaryText }}
          </p>
        </div>
        <div
          class="shrink-0 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80"
        >
          {{ stageLabel }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RunSnapshot, RunStage, RunStatus } from '@shared/types/agent-interface'

const props = defineProps<{
  snapshot: RunSnapshot
}>()

const summaryText = computed(
  () =>
    props.snapshot.blockerSummary ||
    props.snapshot.tickerSummary ||
    props.snapshot.goal ||
    props.snapshot.title
)

const isCollapsed = computed(
  () => props.snapshot.status === 'ready' || props.snapshot.status === 'completed'
)

const activeShellClass = computed(() => {
  switch (props.snapshot.status) {
    case 'failed':
      return 'border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-50'
    case 'aborted':
      return 'border-slate-500/25 bg-slate-500/10 text-slate-950 dark:text-slate-50'
    case 'waiting_permission':
    case 'waiting_external':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50'
    default:
      return 'border-border/70 bg-background/70'
  }
})

const collapsedShellClass = computed(() => {
  switch (props.snapshot.status) {
    case 'ready':
    case 'completed':
      return 'border-emerald-500/35 bg-emerald-500/12'
    case 'failed':
      return 'border-red-500/35 bg-red-500/12'
    case 'aborted':
      return 'border-slate-500/30 bg-slate-500/12'
    case 'waiting_permission':
    case 'waiting_external':
      return 'border-amber-500/35 bg-amber-500/12'
    default:
      return 'border-sky-500/35 bg-sky-500/12'
  }
})

const orbClass = computed(() => {
  switch (props.snapshot.status) {
    case 'failed':
      return 'border-red-500/25 bg-red-500/10'
    case 'aborted':
      return 'border-slate-500/20 bg-slate-500/10'
    case 'waiting_permission':
    case 'waiting_external':
      return 'border-amber-500/25 bg-amber-500/10'
    default:
      return 'border-border/70 bg-background/55'
  }
})

const dotClass = computed(() => {
  switch (props.snapshot.status) {
    case 'ready':
    case 'completed':
      return 'bg-emerald-500'
    case 'failed':
      return 'bg-red-500'
    case 'aborted':
      return 'bg-slate-500'
    case 'waiting_permission':
    case 'waiting_external':
      return 'bg-amber-500'
    default:
      return 'bg-sky-500'
  }
})

const collapsedGlyphClass = computed(() => {
  switch (props.snapshot.status) {
    case 'ready':
    case 'completed':
      return 'text-emerald-600 dark:text-emerald-300'
    case 'failed':
      return 'text-red-600 dark:text-red-300'
    case 'aborted':
      return 'text-slate-600 dark:text-slate-300'
    case 'waiting_permission':
    case 'waiting_external':
      return 'text-amber-600 dark:text-amber-300'
    default:
      return 'text-sky-600 dark:text-sky-300'
  }
})

const pulseClass = computed(() => {
  if (
    props.snapshot.status === 'ready' ||
    props.snapshot.status === 'completed' ||
    props.snapshot.status === 'failed' ||
    props.snapshot.status === 'aborted'
  ) {
    return ''
  }

  return 'animate-pulse'
})

const formatLabel = (value: string) =>
  value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

const statusToLabel = (status: RunStatus) => {
  if (status === 'waiting_permission') {
    return 'Waiting'
  }

  if (status === 'completed' || status === 'ready') {
    return 'Done'
  }

  return formatLabel(status)
}

const stageToLabel = (stage: RunStage) => formatLabel(stage)

const statusLabel = computed(() => statusToLabel(props.snapshot.status))
const stageLabel = computed(() => stageToLabel(props.snapshot.stage))
</script>
