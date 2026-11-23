<script setup>
import { news, songs } from '../stores/content-store.js'
import { state, toggleItem } from '../stores/local-store.js'
const recordKind = ref('')
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-intro">
      <section class="welcome-banner">
        <div class="welcome-copy">
          <div class="banner-kicker"><span class="status-dot"></span>把日子过成喜欢的样子</div>
          <h2>生活的节奏，<br />从好好照顾自己开始。</h2>
          <p>记录一点，发现一点。今天的美好，正在发生。</p>
          <div class="banner-actions">
            <button class="button primary" @click="recordKind = 'sport'">
              <AppIcon name="plus" :size="17" />记录今天</button
            ><RouterLink to="/daily" class="text-button"
              >探索每日内容<AppIcon name="right" :size="16"
            /></RouterLink>
          </div>
        </div>
        <BotanicalArt />
        <div class="banner-tag">SLOW DOWN. GROW A LITTLE.</div>
      </section>
      <HealthSummary @record="recordKind = $event" />
    </div>
    <div class="section-heading">
      <div>
        <h2>今天，值得看看<span>DAILY PICKS</span></h2>
        <p>世界的消息，也有属于你的小确幸。</p>
      </div>
      <span class="data-status"><span class="status-dot"></span>来源与日期见各模块</span>
    </div>
    <div class="dashboard-columns">
      <div class="dashboard-column">
        <article class="card news-card">
          <div class="card-head">
            <h2><AppIcon name="compass" :size="18" />每日热点<span class="pill peach">精选</span></h2>
            <RouterLink to="/daily" class="text-button muted"
              >全部热点<AppIcon name="next" :size="15"
            /></RouterLink>
          </div>
          <SourceStatus module="hotNews" />
          <div class="news-list">
            <a
              v-for="(item, n) in news.slice(0, 3)"
              :key="item.id"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="news-item"
              @click="!state.readNews.includes(item.id) && toggleItem('readNews', item.id)"
              ><span class="news-number">0{{ n + 1 }}</span>
              <div>
                <div class="news-title">{{ item.title }}</div>
                <p>
                  <span class="news-category">{{ item.category }}</span>{{ item.source }}<span>·</span
                  >{{ state.readNews.includes(item.id) ? '已读' : item.time }}
                </p>
              </div>
              <AppIcon name="arrow" :size="16"
            /></a>
          </div>
          <div class="inline-notice">昨日新闻按分类精选，仅展示标题与来源，不复制新闻正文。</div>
        </article>
        <PoemCard />
      </div>
      <div class="dashboard-column">
        <WordCard />
        <article class="card music-card">
          <div class="card-head">
            <h2><AppIcon name="music" :size="18" />今日热歌</h2>
            <RouterLink to="/music" class="text-button muted"
              >看看榜单<AppIcon name="next" :size="15"
            /></RouterLink>
          </div>
          <SourceStatus module="songRank" /><SongList :songs="songs.slice(0, 3)" />
          <div class="music-footnote">Apple 中国区歌曲榜 · 支持公开片段试听</div>
        </article>
      </div>
    </div>
    <section class="discovery-strip">
      <div>
        <span class="mini-icon mint"><AppIcon name="leaf" :size="21" /></span>
        <div>
          <h3>给好奇心，留一点时间。</h3>
          <p>一道题、一段科普、一味家常，每天都能遇见新鲜事。</p>
        </div>
      </div>
      <RouterLink to="/food" class="text-button">去发现生活<AppIcon name="right" :size="17" /></RouterLink>
    </section>
    <RecordDialog v-if="recordKind" :kind="recordKind" @close="recordKind = ''" />
  </div>
</template>
