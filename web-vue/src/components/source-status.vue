<script setup>
import { content } from '../stores/content-store.js'
const props = defineProps({ module: { type: String, required: true } })
const data = computed(() => content.files[props.module])
const status = computed(() => content.meta?.modules?.find((item) => item.name === props.module))
const dateLabel = computed(() =>
  props.module === 'hotNews'
    ? '新闻日期'
    : ['songRank', 'digital'].includes(props.module)
      ? '快照日期'
      : '选编日期',
)
const localTime = computed(() =>
  data.value?.updatedAt
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(data.value.updatedAt))
    : '',
)
</script>

<template>
  <div class="source-status" :class="{ warning: status && !status.ok }">
    <template v-if="data"
      ><span>{{ data.source }}</span
      ><span>{{ dateLabel }} {{ data.date }} · 更新于 {{ localTime }}</span
      ><span v-if="status && !status.ok">更新失败，保留上次成功内容：{{ status.error }}</span
      ><span v-else-if="data.warning">{{ data.warning }}</span></template
    >
    <span v-else>{{ content.loading ? '正在读取本地数据…' : '暂无采集结果 · 当前显示草图示例' }}</span>
  </div>
</template>
