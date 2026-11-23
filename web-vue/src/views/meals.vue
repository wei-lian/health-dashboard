<script setup>
import { state, sync, persist, notify } from '../stores/local-store.js'
import { localDate } from '../utils/health.js'
import { chooseMeal } from '../utils/meals.js'
const name = ref(''),
  meal = ref(new Date().getHours() < 14 ? '午餐' : '晚餐'),
  adding = ref(false),
  drawing = ref(false),
  updating = ref('')
const today = ref(localDate())
const dayTimer = setInterval(() => {
  today.value = localDate()
}, 30000)
onUnmounted(() => clearInterval(dayTimer))
const choices = computed(() =>
  state.mealHistory
    .filter((item) => item.date === today.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)
const selected = computed(() => choices.value.find((item) => item.meal === meal.value))
const recent = computed(() =>
  [...state.mealHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
)
const available = computed(() => state.mealTypes.filter((item) => item.enabled))
const blocked = computed(() => !sync.online || sync.saving)

// 类型与抽签结果都通过本机服务保存，不使用临时演示结果。
async function draw() {
  if (drawing.value || blocked.value) return
  today.value = localDate()
  drawing.value = true
  try {
    const type = chooseMeal(state.mealTypes, recent.value[0]?.typeId)
    const item = {
      id: crypto.randomUUID(),
      date: localDate(),
      meal: meal.value,
      typeId: type.id,
      typeName: type.name,
      createdAt: new Date().toISOString(),
    }
    if (await persist({ mealHistory: [...state.mealHistory, item].slice(-90) }))
      notify('已经选好并保存，今天就试试这个。')
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    drawing.value = false
  }
}
async function addType() {
  if (adding.value || blocked.value) return
  const value = name.value.trim()
  if (!value) return notify('请输入外卖类型，例如麻辣烫、肠粉。', 'error')
  if (state.mealTypes.some((item) => item.name.toLocaleLowerCase() === value.toLocaleLowerCase()))
    return notify('这个类型已经存在。', 'error')
  adding.value = true
  try {
    if (
      await persist({
        mealTypes: [...state.mealTypes, { id: crypto.randomUUID(), name: value, enabled: true }],
      })
    ) {
      name.value = ''
      notify('新类型已保存并加入候选。')
    }
  } finally {
    adding.value = false
  }
}
async function toggleType(type) {
  if (blocked.value) return
  updating.value = type.id
  try {
    await persist({
      mealTypes: state.mealTypes.map((item) =>
        item.id === type.id ? { ...item, enabled: !item.enabled } : item,
      ),
    })
  } finally {
    updating.value = ''
  }
}
</script>
<template>
  <div class="meals-layout">
    <article class="card meal-picker">
      <div class="card-head">
        <h2><AppIcon name="food" :size="20" />今天的外卖，帮我选</h2>
        <span class="pill mint">{{ available.length }} 个可选类型</span>
      </div>
      <div class="meal-picker-body">
        <div class="segmented">
          <button
            v-for="value in ['早餐', '午餐', '晚餐']"
            :key="value"
            :class="{ active: meal === value }"
            @click="meal = value"
          >
            {{ value }}
          </button>
        </div>
        <div class="meal-result" aria-live="polite">
          <span>{{ today }} · {{ meal }}</span
          ><AppIcon name="food" :size="44" />
          <h2>{{ selected?.typeName || '不知道吃什么，就交给这一次随机' }}</h2>
          <p>
            {{
              selected
                ? '结果已保存在电脑，换个浏览器也能看见。'
                : '从你启用的类型中选择，有多个候选时不连续重复。'
            }}
          </p>
        </div>
        <button
          class="button primary"
          :disabled="drawing || blocked || !available.length"
          :aria-busy="drawing"
          @click="draw"
        >
          <AppIcon name="refresh" :class="{ spinning: drawing }" :size="18" />{{
            drawing ? '正在选择并保存…' : selected ? '换一个选择' : '帮我随机选一个'
          }}
        </button>
        <p v-if="!available.length" class="form-error">没有启用的类型，请在右侧或下方启用 / 新增。</p>
        <p class="meal-tip">
          点单小提示：主食之外也搭配蔬菜和蛋白质，按个人过敏、忌口和实际食量选择。这是类型抽签，不包含商家评分或营养计算。
        </p>
      </div>
    </article>
    <article class="card meal-types">
      <div class="card-head">
        <h2>我的外卖类型</h2>
        <span class="pill subtle">可自行新增</span>
      </div>
      <div class="meal-types-body">
        <p>默认类型只是起点。暂时不想吃的类型可以停用，记录会随备份一起带走。</p>
        <form class="meal-add" @submit.prevent="addType">
          <label class="visually-hidden" for="meal-type-name">新增外卖类型</label
          ><input
            id="meal-type-name"
            v-model="name"
            maxlength="40"
            placeholder="例如：肠粉、麻辣烫、海南鸡饭"
            required
          /><button class="button secondary" :disabled="adding || blocked" :aria-busy="adding">
            <AppIcon :name="adding ? 'refresh' : 'plus'" :class="{ spinning: adding }" :size="17" />{{
              adding ? '保存中…' : '新增'
            }}
          </button>
        </form>
        <div class="meal-type-list">
          <button
            v-for="type in state.mealTypes"
            :key="type.id"
            class="meal-type"
            :class="{ enabled: type.enabled }"
            role="switch"
            :aria-label="type.name"
            :aria-checked="type.enabled"
            :disabled="blocked"
            :aria-busy="updating === type.id"
            @click="toggleType(type)"
          >
            <span>{{ type.name }}</span><span
              ><AppIcon v-if="updating === type.id" name="refresh" class="spinning" :size="15" />{{
                type.enabled ? '已加入' : '已停用'
              }}</span
            >
          </button>
        </div>
      </div>
    </article>
    <article class="card meal-history">
      <div class="card-head">
        <h2>最近的菜单选择</h2>
        <span class="pill subtle">自动记录</span>
      </div>
      <div v-if="!recent.length" class="empty-state">
        <h3>第一次选择，等你开始。</h3>
        <p>真实抽签后才会出现记录。</p>
      </div>
      <div v-else class="meal-history-list">
        <div v-for="item in recent" :key="item.id">
          <span>{{ item.date }} · {{ item.meal }}</span
          ><strong>{{ item.typeName }}</strong>
        </div>
      </div>
    </article>
  </div>
</template>
