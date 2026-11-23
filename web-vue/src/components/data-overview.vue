<script setup>
import { content, loadContent } from '../stores/content-store.js'
const count = computed(() => Object.keys(content.files).length)
const failures = computed(() => content.meta?.modules?.filter((item) => !item.ok).length || 0)
</script>

<template>
  <div class="data-overview">
    <div>
      <AppIcon name="shield" :size="16" /><span
        >{{ count ? `已加载 ${count}/8 类本地内容` : '等待首次采集'
        }}<small>{{
          content.error ||
          (failures ? ` · ${failures} 类最近更新失败，旧内容继续可读` : ' · 每类内容显示实际来源与日期')
        }}</small></span
      >
    </div>
    <button class="text-button" :disabled="content.loading" :aria-busy="content.loading" @click="loadContent">
      <AppIcon name="refresh" :size="15" :class="{ spinning: content.loading }" />{{
        content.loading ? '正在读取…' : '刷新内容'
      }}
    </button>
  </div>
</template>
