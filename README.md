# 每日一屏 DailyDash

[**打开每日一屏网页 →**](https://wei-lian.github.io/health-dashboard/)

Vue 3 + Vite 生活仪表盘，包含运动睡眠记录、8 类每日内容、英文发音和歌曲试听。提供 GitHub Pages 在线版和 Node.js 本机版，无需数据库。

## 在线访问与登录

- **网页入口**：[https://wei-lian.github.io/health-dashboard/](https://wei-lian.github.io/health-dashboard/)。点击即可使用，不需要在电脑上启动项目。
- **登录账号**：`admin`；**密码**：`123456`。未登录访问任意业务页面会跳转登录，成功后返回原页面；右上角可退出登录。
- 登录状态保存在当前标签页的会话存储中，刷新页面保留，最长 12 小时；关闭会话或退出后需要重新登录。密码不写入会话存储。
- 在线个人记录保存在**当前浏览器、当前网站**的 localStorage，不上传 GitHub，也不会读取本机 `.dailydash` 文件。不同设备和浏览器不自动同步，换设备请在「设置与备份」下载 / 导入 JSON。清除网站数据或关闭无痕窗口可能丢失记录。
- **访问限制**：GitHub Pages 是公开静态托管，此处实现的是前端登录门槛，并非服务端身份认证。公开源码、构建资源和内容 JSON 可直接访问，不能用于保密访问控制。如需真正限制未授权访问，需要部署带服务端鉴权的后端或接入身份认证服务。

### GitHub 自动发布

`.github/workflows/pages.yml` 在推送 `main` 时安装依赖、执行 lint / 格式 / 测试、构建后发布到 GitHub Pages，也可在 Actions 手动运行。仓库 **Settings → Pages → Source** 应为 **GitHub Actions**。

线上构建使用 `npm run build:pages`，自动适配 `/health-dashboard/` 子目录和浏览器存储模式。普通 `npm run dev` / `npm run build` / `npm start` 仍使用本机文件保存。

线上内容使用 `site-content/` 中已校验的公开采集快照和其引用的图片、语音，页面会显示实际采集日期；部署不会自动联网采集。更新线上内容：

```powershell
npm run crawler
npm run pages:snapshot
git add site-content
git commit -m "Update public content snapshot"
git push origin main
```

快照脚本只读取八类公开内容和相关媒体，不读取运动、睡眠或其他个人记录。将来迁移到其他仓库时，可通过 `PAGES_BASE_PATH` 指定部署路径。

## 启动与首次采集

需要 Node.js 20.19+ 或 22.12+（推荐 24 LTS）。在 PowerShell 执行：

```powershell
cd "C:\Users\jlz\Desktop\爬取数据\vibe coding\health-dashboard"
npm ci
npm run crawler
npm run dev
```

打开终端给出的本地地址。当前电脑已完成一轮实际采集；全新检出没有运行时数据，采集前会显示明确标注的草图示例。健康记录初始为空，仅由用户录入。

日常使用：首次 `npm run build`，然后 `npm start`，打开 `http://127.0.0.1:4173/`；保留终端运行。`npm run preview` 也提供相同本机保存服务。采集会更新开发目录和已存在的 `dist/data`、`dist/media`，正常情况下无需每天重新构建。只重新读取页面文件可点击顶部刷新；该按钮不会启动本机采集。

## 本机版自动保存、下载备份与换电脑

运动、睡眠、收藏、掌握、答题、已读和外卖菜单通过 Node.js 本机接口自动写入当前 Windows 用户的文件：

```text
C:\Users\jlz\.dailydash\personal-data.json
```

其他电脑的默认位置是其用户目录下的 `.dailydash/personal-data.json`，可通过 `DAILYDASH_DATA_DIR` 环境变量指定目录。相同数据目录下，内置浏览器、Chrome / Edge，以及开发端口 5173 和日常端口 4173 共用同一份文件；每 5 秒检查新版本，回到页面时立即检查。不同 Windows 用户默认不共用。

- **原有记录**：首次打开新版页面会把该浏览器以前保存的 v1 记录合并入电脑文件，同 ID 和同一睡眠日期以电脑已有记录为准；迁移原件另存 `.dailydash/recoveries/`。其他旧浏览器也要打开一次新版才能迁移其独有数据。
- **确认保存**：录入表单点击保存后，只有电脑文件写入成功才关闭；顶部显示保存时间。保存失败保留表单并提示。多窗口同时修改发生版本冲突时读入最新记录，表单仍在，可核对后重试。
- **历史备份**：每次修改前自动备份前一版本到 `.dailydash/backups/`，最多保留 30 份。损坏文件会报错，不会被当成空记录覆盖。历史文件也可用设置页导入。
- **换电脑**：设置与备份 → 下载 JSON 备份；另一台电脑复制项目、安装 Node.js、执行 `npm ci`、`npm run build`、`npm start`，再从设置页选择备份。先预览数量，默认合并，也可完整替换；替换前自动保存本机前版。下载文件包含健康记录、学习状态、自定义外卖类型和选择历史，兼容旧 v1 文件。
- **服务要保持运行**：这不是纯静态网页，直接双击 `dist/index.html` 或只用普通静态服务器无法写电脑文件。关闭 Node 服务后，页面缓存仅供查看，重新运行 `npm start` / `npm run dev` 并连接后才能保存。数据保留在电脑文件中，关闭浏览器不会删除。
- **本地处理**：健康记录不会发送给内容来源或外部 AI。接口只接受本机同源请求，不对局域网或公网开放。

命令行脚本与网页共用保存校验、文件锁和备份机制：

```powershell
npm run personal:path
npm run personal:export -- "C:\Users\jlz\Downloads\DailyDash-备份.json"
npm run personal:import -- "C:\Users\jlz\Downloads\DailyDash-备份.json"
# 完整替换（原本机版本先备份）
npm run personal:import -- "C:\Users\jlz\Downloads\DailyDash-备份.json" --replace
```

## 我的记录建议与每日菜单

“运动与睡眠”页按实际保存的近 7 天数据计算运动次数、天数、总时长和睡眠均值，逐条展示触发依据；新保存或同步记录后自动更新。未填写日期不补成 0 小时睡眠，也不推断为没有运动。短睡眠、作息波动、近期运动分布等触发对应建议；超过一天的旧睡眠不用于推断今天的恢复情况。方法是可验证的本地计算与规则，没有伪装成外部大模型分析；页面附一般成年人参考来源，不能代替个体医疗评估。

“每日菜单”可选择早餐、午餐、晚餐，新增自己喜欢的外卖类型，启用 / 停用候选。随机只从启用类型中抽，有多个候选时避免连续重复同一类型；结果和自定义类型保存到电脑并纳入备份。提供的是类型选择，不虚构商家、评分、营养或点单结果。

## 采集逻辑与真实来源

1. 以 `Asia/Shanghai` 计算昨天，取得进程锁；同一天同一目标日期成功生成过的模块跳过，文件丢失或损坏会重新采集。
2. 串行运行 8 个模块，按域名排队，两次请求至少间隔 2.2 秒。HTML 站点先检查 robots；公共 API 按接口调用。超时 20 秒，网络错误与 5xx 重试一次，403 / 429 不重试。
3. 解析并校验字段、非空内容与大小，用临时文件原子替换。单个模块失败保留上次文件，其他模块继续；退出码为 1，日志记录原因。
4. 输出到 `crawler/output`，同步至 `web-vue/public/data`；`meta.json` 提供日期、耗时、失败原因和保留状态。前端使用同一份数据契约校验，坏文件不会覆盖已加载内容。

| 模块 | 当前来源 / 选择方式                                                           | 日期与限制                                             |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 新闻 | 中国新闻网昨日归档，分类精选 8 条标题和原文链接                               | 真正按昨日归档；不是全网热搜排名，不编造摘要           |
| 热歌 | Apple Music 中国区公开热门 100 首，前 20 首尝试按相同歌曲 ID 关联 iTunes 试听 | 有昨日快照时显示昨日 Top10；首次显示实际当日快照       |
| 英语 | 30 个本地双语词条日期轮转，每日 10 个；Free Dictionary 补音标和英文释义       | 中文释义、例句来自本地编辑词表，并非网络翻译           |
| 诗词 | chinese-poetry 的唐诗三百首，日期轮转 3 首                                    | 原文可用，缺少人工译注时如实标明；失败回退本地诗集     |
| 答题 | 97 道本地原创编辑题库，每日 3 题                                              | 同日稳定，30 天窗口内不重复，不冒充网络采集            |
| 科普 | 中国数字科技馆公开文章短摘录及原文链接                                        | 来源可能是科普活动资讯；失败回退标明的本地知识         |
| 美食 | HowToCook 开放 Markdown 菜谱，提取实际用料、操作步骤                          | 失败回退本地菜谱；地方饮食文化条目非遗级别仍待官方核验 |
| 数码 | ZOL 手机和笔记本列表，分别 5 / 6 款公开报价                                   | 当时可见报价，非昨日历史价格；单个报价不虚构区间       |

月榜、年榜是**本机累计榜**，不是平台官方月年榜。单日第 1 名 100 分、第 2 名 99 分，依次递减；同日重跑覆盖快照，不重复计分。仅显示实际存档月份，从首次采集开始积累，不能回填 2026 年 1 月以来不存在的数据。

诗词统一以简体中文显示，使用 OpenCC 转换标题、作者、正文与译注；已有繁体采集文件也会在载入时转换，无需重新采集。

`--date` 指定新闻归档与每日轮转内容的目标日期，**不会让当前榜单或价格接口返回历史数据**。快照仍使用实际采集日期。历史状态在 `crawler/state`；请保留该目录，删除后会丢失歌曲累计和题目去重记录。

## 英文发音与音乐

单词支持正常发音、慢速朗读、读例句。词典真人音频可用时缓存到本地；Windows 使用已安装的英语声线生成离线 WAV（此电脑验证为 Microsoft Zira Desktop），再由浏览器播放。缺少英语语音包或生成失败时，回退词典音频 / 浏览器 TTS。换电脑若没有英语声线，可在 Windows 设置中安装英语语音包。

部分开放词典返回的 MP3 已失效，因此页面会显示降级信息，但本机生成的正常、慢速、例句 WAV 仍可使用。只要本机网页服务已启动，生成的 WAV 可断网播放；歌曲试听需要联网。

歌曲有公开片段时点击播放，可暂停、继续、调整进度；没有片段的按钮置灰。播放器一次只播放一个音源，切换单词与歌曲会停止前一个。试听是平台公开片段（通常约 30 秒），**不是整首歌曲**；完整收听通过平台入口，可能需要平台账号、订阅或受地域影响。没有下载整曲或歌词。

## 设置每天自动采集（Windows）

在项目目录执行：

```powershell
# 先检查路径、账号和执行时间，不注册任务
npm run schedule:preview

# 注册每日 07:30 的任务
npm run schedule:install

# 或设为每天 08:00，同名任务会更新
npm run schedule:install -- -At 08:00
```

任务名称：`DailyDash-DailyCrawler`。安装脚本固定 Node 完整路径、脚本绝对路径和项目工作目录，路径含中文 / 空格也可使用。普通当前用户权限运行，不要求管理员；如果系统策略禁止当前用户注册任务，请按终端错误调整本机策略或在任务计划程序中手动设置。

**时间按 Windows 系统时区**；本电脑为北京时间。电脑需开机、联网且当前用户已登录；关闭网页不影响采集。错过时间会在后续可运行时补执行，不会在关机状态采集，也不设置唤醒。运行被中断或网络未恢复时，查看日志并手动重试。脚本最多运行 30 分钟，同名任务禁止重叠。

查看和手动触发任务：

```powershell
Get-ScheduledTask -TaskName DailyDash-DailyCrawler
Get-ScheduledTaskInfo -TaskName DailyDash-DailyCrawler
Start-ScheduledTask -TaskName DailyDash-DailyCrawler
```

取消自动采集：

```powershell
npm run schedule:remove
```

**本轮仅验证了配置预览，尚未在系统中注册每日任务。** 运行安装命令后才启用。首次安装后可手动触发一次，再查看任务结果与 `crawler/logs`；之后需留意实际每日运行记录。

## 手动重试与排查

```powershell
npm run crawler                              # 同日已成功的模块跳过
npm run crawler -- --force                    # 全部强制重跑
npm run crawler -- --module=englishWord --force # 单独重试英文
npm run crawler -- --module=hotNews --date=2026-11-18 --force
npm run data:validate                        # 检查 8 个内容文件
npm run data:publish                         # 只同步，不访问外站
```

模块名：`hotNews`、`quiz`、`knowledge`、`songRank`、`food`、`poetry`、`englishWord`、`digital`。

- 采集结果：`crawler/output/*.json`；状态：`crawler/output/meta.json`。
- 每日逐模块日志：`crawler/logs/YYYY-MM-DD.log`；`ok: false` 的记录含原因。`mode: curated` 是明确的本地内容；`degraded` 是部分联网补全失败但已有可用内容。
- 页面仍显示旧日期：先看源站与日志，再单模块重试，最后点击页面刷新。
- 提示正在运行：等待现有进程。异常结束遗留的锁会自动核对 PID；不要在有采集进程时手动删除锁。
- Windows 任务 `LastTaskResult = 0` 表示脚本没有失败模块；如出现降级仍需看 `meta.json` 的 warning。没有注册任务时查看命令会报告找不到任务，这是正常的。
- 网络或源站变更可能影响每日更新；当前仅完成单日实测，未声称已连续多日稳定运行。

## 项目目录

```text
crawler/
  cron-run.js         # CLI 统一入口
  src/runner.js       # 锁、日幂等、隔离、日志、同步
  src/*.js            # 8 个实际内容采集模块
  src/utils/          # 请求限流、存储、语音、日期
  data/               # 原创题库和本地双语 / 兜底内容
  output/             # 生成的 JSON（忽略）
  state/              # 日快照、去重、运行锁（忽略）
  logs/               # 按日日志（忽略）
scripts/
  install-schedule.ps1 # 注册 / 预览 / 移除每日任务
  synthesize-words.ps1 # Windows 英语 WAV 生成
  personal-data.js     # 本机个人文件导出 / 导入 / 路径
server/                # 同源 API、版本冲突、文件锁、自动历史备份
shared/               # 前后端统一内容校验
web-vue/src/          # 页面、组件、内容与音频 store
web-vue/public/       # 本地资源和生成的 JSON / 音频
 tests/               # 健康边界、解析器、去重、锁、原子写入和播放状态测试
```

本机版采集内容保存在项目运行目录；健康和个人状态保存在用户目录文件，浏览器 localStorage 仅用作查看缓存和旧版迁移。在线版的个人记录仅保存在浏览器。两种模式均需要登录，无数据库。

## 验证

```powershell
npm run lint
npm run format:check
npm test
npm run data:validate
npm run build
npm run schedule:preview
git diff --check
```

PRD 原冻结验收清单保留，实际追加需求与实现口径见 `PRD.md` 第 16–17 章及本文的在线部署说明。仍待补充：正式非遗名录核验、更多词汇和题库、进一步的个体健康分析、连续多日调度观测、PWA。在线版通过 GitHub Actions 发布到 Pages。

## 声明

个人学习自用，禁止商用与二次分发。只读取公开页面与公开接口，不绕过登录、验证码或加密接口；第三方内容归原作者与来源所有。健康信息为通用科普提示，不构成医疗诊断。
这个数据需要运行本机采集脚本更新，页面的“刷新”按钮只会重新读取采集结果。

## 运行

在项目终端（PowerShell）执行：
cd "C:\Users\jlz\Desktop\爬取数据\vibe coding\health-dashboard"
npm run crawler
等采集结束，再点击页面顶部的刷新即可，通常不用重新构建或重启。

如果提示“今天已生成”，但还想重新采集：
npm run crawler -- --force
想每天自动更新，执行一次：
npm run schedule:install
会设置为每天早上 07:30采集，需要电脑开机、联网且当前用户已登录。

默认新闻采集的是昨天的内容，所以今天更新后，新闻日期显示昨天属于正常情况。
