<script setup>
import { state, persist, notify, sync, refreshPersonalData } from '../stores/local-store.js'
import { localDate } from '../utils/health.js'
import { parsePersonalBackup, mergePersonalData } from '../../../shared/personal-schema.js'
const fileInput = ref(null),
  importing = ref(false),
  exporting = ref(false),
  restoring = ref(false),
  preview = ref(null),
  importMode = ref('merge')

// 下载磁盘的最新版本，文件可在另一台安装本项目的电脑导入。
async function exportData() {
  if (exporting.value || sync.saving) return
  exporting.value = true
  try {
    if (!(await refreshPersonalData())) throw new Error('请先连接本机保存服务，再下载最新备份')
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data: state }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = `DailyDash-备份-${localDate()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('备份已下载，包含健康记录、学习状态和外卖菜单。')
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    await new Promise((done) => setTimeout(done, 400))
    exporting.value = false
  }
}

// 导入先校验并预览，确认后才写电脑文件；旧版备份兼容。
async function importData(event) {
  const file = event.target.files?.[0]
  if (!file || importing.value) return
  importing.value = true
  try {
    if (file.size > 10_000_000) throw new Error('请选择小于 10MB 的备份文件')
    preview.value = parsePersonalBackup(JSON.parse(await file.text()))
    importMode.value = 'merge'
  } catch (error) {
    notify(error instanceof SyntaxError ? '文件不是有效的 JSON' : error.message, 'error')
  } finally {
    importing.value = false
    event.target.value = ''
  }
}

// 默认合并保留本机同 ID / 同睡眠日数据；完整替换前服务端自动留历史备份。
async function restore() {
  if (restoring.value || !preview.value) return
  restoring.value = true
  try {
    const data =
      importMode.value === 'merge' && sync.revision > 0
        ? mergePersonalData(state, preview.value)
        : preview.value
    if (await persist(data)) {
      preview.value = null
      notify('备份已写入电脑，其他浏览器将自动同步。')
    }
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    restoring.value = false
  }
}
</script>

<template>
  <div class="settings-layout">
    <article class="card">
      <div class="card-head">
        <h2><AppIcon name="shield" :size="20" />数据与备份</h2>
        <span class="pill mint">仅本地存储</span>
      </div>
      <div class="settings-body">
        <h3>把生活的记录，好好留住。</h3>
        <p>
          运动、睡眠、学习状态和外卖菜单会自动保存到电脑文件，同一台电脑的不同浏览器共用。下载备份后，可在另一台电脑启动本项目并导入。
        </p>
        <p class="storage-path">{{ sync.file || '用户目录/.dailydash/personal-data.json' }}</p>
        <p class="muted">
          每次保存保留前一版本，最多留 30 份；原浏览器迁移原件另存 recoveries。浏览器缓存用于断开服务时查看。
        </p>
        <div class="backup-counts">
          <div>
            <strong>{{ state.sports.length }}</strong><span>运动记录</span>
          </div>
          <div>
            <strong>{{ state.sleeps.length }}</strong><span>睡眠记录</span>
          </div>
          <div>
            <strong>{{ state.favorites.length }}</strong><span>诗词收藏</span>
          </div>
        </div>
        <div class="button-group">
          <button
            class="button primary"
            :disabled="exporting || sync.saving || !sync.online"
            :aria-busy="exporting"
            @click="exportData"
          >
            <AppIcon
              :name="exporting ? 'refresh' : 'download'"
              :class="{ spinning: exporting }"
              :size="18"
            />{{ exporting ? '正在读取备份…' : '下载 JSON 备份' }}</button
          ><button
            class="button secondary"
            :disabled="importing || restoring"
            :aria-busy="importing"
            @click="fileInput.click()"
          >
            <AppIcon name="upload" :size="18" />{{ importing ? '正在读取…' : '从备份恢复' }}</button
          ><input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept=".json,application/json"
            aria-label="选择备份文件"
            @change="importData"
          />
        </div>
        <div v-if="preview" class="import-preview" role="status">
          <h4>准备恢复这份备份</h4>
          <p>
            {{ preview.sports.length }} 条运动 · {{ preview.sleeps.length }} 条睡眠 ·
            {{ preview.mealTypes.length }} 个外卖类型、{{ preview.mealHistory.length }}
            次菜单选择。合并时本机同 ID 或同睡眠日的记录优先；原文件可完整保留。
          </p>
          <label class="import-mode"
            >导入方式<select v-model="importMode" :disabled="restoring">
              <option value="merge">合并，保留本机已有记录</option>
              <option value="replace">完整替换，本机原版本自动备份</option>
            </select></label
          >
          <div class="button-group">
            <button
              class="button primary"
              :disabled="restoring || sync.saving || !sync.online"
              :aria-busy="restoring"
              @click="restore"
            >
              <AppIcon v-if="restoring" name="refresh" class="spinning" :size="17" />{{
                restoring ? '正在写入…' : '确认导入电脑'
              }}</button
            ><button class="button secondary" :disabled="restoring" @click="preview = null">取消</button>
          </div>
        </div>
      </div>
    </article>
    <article class="card">
      <div class="card-head">
        <h2>关于每日一屏</h2>
        <span class="tiny-label">LOCAL DAILY DASHBOARD</span>
      </div>
      <div class="settings-body">
        <p>一个陪你记录身体状态、发现每日内容的个人生活仪表盘。</p>
        <div class="about-row"><span>当前阶段</span><strong>本地采集与音频播放已接入</strong></div>
        <div class="about-row"><span>前端技术</span><strong>Vue 3 + Vite</strong></div>
        <div class="about-row"><span>内容数据</span><strong>公开来源 + 明确标注的本地编辑内容</strong></div>
        <div class="about-row">
          <span>每日采集</span><strong>运行 npm run schedule:install 后每日 07:30</strong>
        </div>
        <div class="about-row">
          <span>采集日期</span><strong>昨日内容；歌曲和报价按实际快照日期展示</strong>
        </div>
        <div class="about-row"><span>音乐播放</span><strong>公开试听片段 · 完整版前往平台</strong></div>
        <div class="about-row"><span>账号与数据库</span><strong>无需账号 · 无数据库</strong></div>
        <p class="disclaimer">
          个人学习自用，禁止商用与二次分发。以上为通用睡眠卫生建议，不构成医疗诊断；持续失眠或伴随其他症状请就医。
        </p>
      </div>
    </article>
    <article class="card">
      <div class="card-head">
        <h2>内容采集状态</h2>
        <span class="pill subtle">8 个模块</span>
      </div>
      <div class="settings-body">
        <p>刷新按钮重新读取采集文件；采集脚本由本机 Node.js 或任务计划程序执行。</p>
        <SourceStatus
          v-for="name in [
            'hotNews',
            'quiz',
            'knowledge',
            'songRank',
            'food',
            'poetry',
            'englishWord',
            'digital',
          ]"
          :key="name"
          :module="name"
        />
      </div>
    </article>
  </div>
</template>
