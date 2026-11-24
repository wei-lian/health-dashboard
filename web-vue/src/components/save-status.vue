<script setup>
import { sync, initializePersonalData } from '../stores/local-store.js'
const label = computed(() =>
  sync.mode === 'browser'
    ? sync.saving
      ? '正在保存到浏览器…'
      : sync.checking
        ? '正在读取浏览器记录…'
        : !sync.online
          ? '浏览器存储未就绪 · 本次修改尚未保存'
          : sync.updatedAt
            ? '已保存到当前浏览器 · ' + new Date(sync.updatedAt).toLocaleTimeString('zh-CN')
            : '浏览器存储已就绪 · 请定期下载备份'
    : sync.saving
      ? '正在保存到电脑…'
      : sync.checking
        ? '正在连接本机文件…'
        : !sync.online
          ? '电脑保存服务未连接 · 当前缓存仅供查看'
          : sync.updatedAt
            ? '已自动保存到电脑 · ' + new Date(sync.updatedAt).toLocaleTimeString('zh-CN')
            : '电脑文件已就绪 · 修改后自动保存',
)
</script>
<template>
  <div class="save-status" :class="{ 'save-warning': !sync.online && sync.ready }" role="status">
    <div>
      <AppIcon
        :name="sync.saving || sync.checking ? 'refresh' : 'shield'"
        :class="{ spinning: sync.saving || sync.checking }"
        :size="17"
      /><span
        >{{ label }}<small v-if="sync.error">{{ sync.error }}</small
        ><small v-else-if="sync.message">{{ sync.message }}</small></span
      >
    </div>
    <button
      v-if="!sync.online"
      class="text-button"
      :disabled="sync.checking || sync.saving"
      :aria-busy="sync.checking"
      @click="initializePersonalData"
    >
      {{ sync.checking ? '正在连接…' : '重新连接' }}
    </button>
  </div>
</template>
