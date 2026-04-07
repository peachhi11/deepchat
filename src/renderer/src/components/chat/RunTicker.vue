<template>
  <div class="px-6 pb-2 pt-3">
    <div class="mx-auto w-full max-w-5xl">
      <div
        class="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-2.5 shadow-sm backdrop-blur"
      >
        <div
          class="inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          :class="badgeClass"
        >
          <span class="size-1.5 rounded-full" :class="dotClass" />
          <span>{{ props.snapshot.status }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground/90">
            {{ summaryText }}
          </p>
        </div>
        <div class="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
          {{ props.snapshot.stage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RunSnapshot } from '@shared/types/agent-interface'

const props = defineProps<{
  snapshot: RunSnapshot
}>()

const summaryText = computed(
  () => props.snapshot.tickerSummary || props.snapshot.goal || props.snapshot.title
)

const badgeClass = computed(() => {
  switch (props.snapshot.status) {
    case 'ready':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
    case 'failed':
      return 'bg-red-500/12 text-red-700 dark:text-red-300'
    case 'aborted':
      return 'bg-slate-500/12 text-slate-700 dark:text-slate-300'
    case 'waiting_permission':
    case 'waiting_external':
      return 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
    default:
      return 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
  }
})

const dotClass = computed(() => {
  switch (props.snapshot.status) {
    case 'ready':
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
</script>
