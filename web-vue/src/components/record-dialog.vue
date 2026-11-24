<script setup>
import { localDate, sleepMinutes } from '../utils/health.js'
import { state, persist, notify, sync } from '../stores/local-store.js'
const props = defineProps({
  kind: { type: String, default: 'sport' },
  record: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const form = reactive({
  date: localDate(),
  type: '跑步',
  duration: 30,
  intensity: '适中',
  note: '',
  bed: '23:00',
  wake: '07:00',
  quality: 4,
  ...props.record,
  durationOverride: props.kind === 'sleep' && props.record ? props.record.duration : '',
})
const error = ref('')
const saving = ref(false)
const duration = computed(() => sleepMinutes(form.bed, form.wake))
const firstInput = ref(null)
const dialog = ref(null)
let previousFocus

// 保存真实记录，不将演示内容混入用户数据。
async function save() {
  if (saving.value) return
  error.value = ''
  if (!form.date || form.date > localDate()) {
    error.value = '请选择今天或之前的日期。'
    return
  }
  const minutes =
    props.kind === 'sleep' ? Number(form.durationOverride || duration.value) : Number(form.duration)
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > (props.kind === 'sleep' ? 1440 : 600)) {
    error.value = props.kind === 'sleep' ? '睡眠时长需为 1–1440 分钟。' : '运动时长需为 1–600 分钟。'
    return
  }
  const field = props.kind === 'sleep' ? 'sleeps' : 'sports'
  const id = props.record?.id || crypto.randomUUID()
  const record = { ...form, id, duration: minutes }
  const records = state[field].filter(
    (item) => item.id !== id && (field !== 'sleeps' || item.date !== form.date),
  )
  saving.value = true
  if (await persist({ [field]: [...records, record] })) {
    notify(props.record ? '记录已更新' : '记录已保存，今天也在好好生活。')
    emit('close')
  }
  saving.value = false
}

// 模态窗口内保持键盘焦点，关闭后恢复到触发按钮。
function onKey(event) {
  if (event.key === 'Escape') emit('close')
  if (event.key !== 'Tab') return
  const nodes = [...dialog.value.querySelectorAll('button, input, select, textarea')].filter(
    (el) => !el.disabled,
  )
  const first = nodes[0],
    last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
onMounted(() => {
  previousFocus = document.activeElement
  document.body.classList.add('modal-open')
  firstInput.value?.focus()
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.body.classList.remove('modal-open')
  document.removeEventListener('keydown', onKey)
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body"
    ><div class="modal-backdrop" @click.self="emit('close')">
      <section
        ref="dialog"
        class="record-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-title"
      >
        <div class="dialog-head">
          <div>
            <div class="eyebrow">A NOTE TO YOURSELF</div>
            <h2 id="record-title">
              {{ record ? '编辑记录' : kind === 'sleep' ? '记录昨晚睡眠' : '记一笔运动' }}
            </h2>
          </div>
          <button class="icon-button" aria-label="关闭" @click="emit('close')">
            <AppIcon name="close" />
          </button>
        </div>
        <form @submit.prevent="save">
          <label
            >日期
            <span>{{
              kind === 'sleep' ? '按起床日记录，同日保存将更新原记录' : '支持补录以前的运动'
            }}</span><input
              ref="firstInput"
              v-model="form.date"
              type="date"
              :max="localDate()"
              required /></label
          ><template v-if="kind === 'sport'"
            ><label
              >运动类型<select v-model="form.type">
                <option
                  v-for="type in [
                    '跑步',
                    '健走',
                    '骑行',
                    '游泳',
                    '力量训练',
                    '跳操',
                    '瑜伽',
                    '球类',
                    '爬山',
                    '其他',
                  ]"
                  :key="type"
                >
                  {{ type }}
                </option>
              </select></label
            ><label
              >运动时长（分钟）<input v-model="form.duration" type="number" min="1" max="600" required
            /></label>
            <div class="quick-values">
              <button
                v-for="minute in [15, 30, 45, 60]"
                :key="minute"
                type="button"
                :class="{ selected: Number(form.duration) === minute }"
                @click="form.duration = minute"
              >
                {{ minute }} 分钟
              </button>
            </div>
            <label
              >运动强度<select v-model="form.intensity">
                <option>轻松</option>
                <option>适中</option>
                <option>吃力</option>
              </select></label
            ></template
          ><template v-else
            ><div class="form-row">
              <label>入睡时间<input v-model="form.bed" type="time" required /></label
              ><label>起床时间<input v-model="form.wake" type="time" required /></label>
            </div>
            <div class="sleep-calculation">
              <AppIcon name="moon" />自动计算
              <strong>{{ Math.floor(duration / 60) }} 小时 {{ duration % 60 }} 分钟</strong>
            </div>
            <label
              >实际睡眠时长（分钟，可选）<input
                v-model="form.durationOverride"
                type="number"
                min="1"
                max="1440"
                :placeholder="String(duration)" /></label
            ><label
              >主观睡眠质量<select v-model="form.quality">
                <option v-for="n in 5" :key="n" :value="n">
                  {{ '★'.repeat(n) }} · {{ ['很差', '较差', '一般', '不错', '很好'][n - 1] }}
                </option>
              </select></label
            ></template
          ><label
            >备注（可选）<textarea
              v-model="form.note"
              maxlength="50"
              rows="2"
              placeholder="留一句话给今天的自己"
            ></textarea>
          </label>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button
            type="submit"
            class="button primary full"
            :disabled="saving || !sync.online"
            :aria-busy="saving"
          >
            <AppIcon :name="saving ? 'refresh' : 'check'" :class="{ spinning: saving }" :size="18" />{{
              saving ? '正在保存…' : '保存记录'
            }}
          </button>
          <p class="form-privacy">
            <AppIcon name="shield" :size="13" />{{
              sync.mode === 'browser'
                ? '记录仅保存在当前浏览器，换设备请先下载备份'
                : '保存后自动写入电脑文件，其他浏览器也能读取'
            }}
          </p>
        </form>
      </section>
    </div></Teleport
  >
</template>
