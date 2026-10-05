<template>
  <li class="route-row">
    <el-skeleton animated class="route-skel">
      <template #template>
        <div v-if="variant === 'route'" class="listing-route">
          <div class="listing-title-row">
            <el-skeleton-item variant="text" class="route-skel-badge" />
            <el-skeleton-item variant="text" class="route-skel-title is-route" />
          </div>
          <div class="listing-detail-row">
            <div class="min-w-0 flex-auto">
              <el-skeleton-item
                v-for="line in lineCount"
                :key="line"
                variant="text"
                class="route-skel-meta"
              />
            </div>
            <div class="eta-stack">
              <el-skeleton-item variant="text" class="eta-skeleton-primary" />
              <el-skeleton-item
                v-for="eta in etaCount"
                :key="eta"
                variant="text"
                class="eta-skeleton-secondary"
              />
            </div>
          </div>
        </div>
        <template v-else>
          <div class="flex min-w-0 flex-1 gap-x-3">
            <div class="min-w-0 flex-auto">
              <el-skeleton-item variant="text" class="route-skel-title is-stop" />
              <el-skeleton-item
                v-for="line in lineCount"
                :key="line"
                variant="text"
                class="route-skel-meta"
              />
            </div>
          </div>
          <div class="eta-stack">
            <el-skeleton-item variant="text" class="eta-skeleton-primary" />
            <el-skeleton-item
              v-for="eta in etaCount"
              :key="eta"
              variant="text"
              class="eta-skeleton-secondary"
            />
          </div>
        </template>
      </template>
    </el-skeleton>
  </li>
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    variant?: 'route' | 'stop'
    lines?: number
    etas?: number
  }>(),
  {
    variant: 'route',
  }
)

const lineCount = computed(() => props.lines ?? (props.variant === 'stop' ? 1 : 2))
const etaCount = computed(() => Math.max(0, (props.etas ?? (props.variant === 'stop' ? 3 : 2)) - 1))
</script>
