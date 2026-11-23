<script setup>
import { sportTotal, latestSleep, streak } from '../stores/local-store.js'
import { sleepAdvice } from '../utils/health.js'
const emit = defineEmits(['record'])
const advice = computed(() => sleepAdvice(latestSleep.value?.duration))
</script>

<template>
  <section class="health-grid" aria-label="健康概览">
    <article class="health-card">
      <div class="health-card-top">
        <span
          ><span class="mini-icon mint"><AppIcon name="walk" :size="17" /></span>今日运动</span
        ><button class="icon-button small" aria-label="记录运动" @click="emit('record', 'sport')">
          <AppIcon name="plus" :size="18" />
        </button>
      </div>
      <div class="health-value">
        {{ sportTotal }}<small>分钟</small
        ><span class="mini-chart" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <p>
        {{ sportTotal ? '每一分钟，都是对自己的投资' : '今天的好状态，从动一动开始'
        }}<span class="pill subtle">目标 30 分钟</span>
      </p>
    </article>
    <article class="health-card">
      <div class="health-card-top">
        <span
          ><span class="mini-icon blue"><AppIcon name="moon" :size="17" /></span>最近睡眠</span
        ><button class="icon-button small" aria-label="记录睡眠" @click="emit('record', 'sleep')">
          <AppIcon name="plus" :size="18" />
        </button>
      </div>
      <div v-if="latestSleep" class="health-value">
        {{ Math.floor(latestSleep.duration / 60) }}<small>小时</small>{{ latestSleep.duration % 60
        }}<small>分钟</small>
      </div>
      <div v-else class="health-value">—<small>昨晚睡得怎么样？</small></div>
      <p>
        {{ latestSleep ? latestSleep.date + ' · ' + advice.title : '记录睡眠，找到自己的舒适节奏'
        }}<AppIcon name="moon" :size="15" />
      </p>
    </article>
    <article class="health-card">
      <div class="health-card-top">
        <span
          ><span class="mini-icon peach"><AppIcon name="flame" :size="17" /></span>连续打卡</span
        ><span class="tiny-label">KEEP GOING</span>
      </div>
      <div class="health-value">
        {{ streak }}<small>天</small
        ><span class="streak-dots" aria-hidden="true"
          ><i v-for="n in 7" :key="n" :class="{ filled: n <= streak }"></i
        ></span>
      </div>
      <p>
        {{ streak ? '把小小的坚持，变成大大的改变' : '每一个新的开始，都值得期待'
        }}<AppIcon name="arrow" :size="15" />
      </p>
    </article>
  </section>
</template>
