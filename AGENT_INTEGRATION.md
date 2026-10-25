# 外部 Agent 数据接口

模板只读取配置、渲染页面、处理交互与静态 SEO；不查找游戏、不研究关键词、不检索来源、不生成内容、不调用 AI、不自动发布。外部 Agent 完成资料与素材准备后写入下面的文件即可。

## 单一配置入口

`src/lib/schema.ts` 是字段契约；`src/lib/config.ts` 读取并验证两个 JSON。所有对象拒绝未知字段，错误会包含文件、字段路径和原因。使用 `pnpm check:content` 提前检查。

| 文件 | 必填内容 | 说明 |
| --- | --- | --- |
| `site.config.json` | `gameName/siteName/shortName/domain/description` | 域名只能是主机名，不含协议或路径。 |
| 同上 | `officialUrl/platform/genre/logo/favicon/demo` | 无官方链接时传空字符串，不生成虚假官方入口。 |
| 同上 | `theme` | `defaultMode` 为 dark/light/system；primary/lightPrimary 及深浅 palette 均使用六位十六进制颜色。 |
| 同上 | `languages/defaultLanguage/localeLabels/navigation` | 默认英语；分类 slug 唯一，不得与语言、法律页等保留路径冲突。 |
| 同上 | `seo/integrations/legal` | SEO 图片和 ALT；分析与广告为 false 或有明确 provider 的配置；法律文案需按实际站点替换。 |
| `home.json` | `lastModified` | 明确填写真实修改日期；其他首页区域可省略或留空数组。 |

主题的两个 palette 包含 `background/card/surface/foreground/muted/border`。所有游戏强调色从 JSON 转为 CSS 变量。S/A/B/C 的颜色用于等级语义。没有跨游戏的环境变量品牌覆盖，也不需要运行配置生成器。

`ui.{locale}` 可以覆盖通用界面字符串，缺项回退到英语；`translations.{locale}` 提供站点名称与描述；`navigation[].labels/descriptions` 提供分类译文。新增语言只改 JSON 与内容文件，不改核心组件。

## 生产文章交接门槛

`demo: true` 保留模板演示能力。`demo: false` 的生产站点必须接收验收通过的
文章交接结果：将生产者验收后的 `out/article-handoff.json`
复制为仓库根目录的 `article-manifest.json`，将其文章逐字节导入
`src/content/wiki/`。不要把原始来源包、来源审计日志或凭证复制进公开站点。

保留旧的完整任务契约，也支持在上游冻结并验收后只发布有合格证据的关键词：

| 契约 | 范围 |
| --- | --- |
| `schema_version: 1`, `contract: seoscout-articles-v1`, `mode: full` | 原始全部关键词 × 全部配置语言；原有门槛不变。 |
| `schema_version: 2`, `contract: seoscout-articles-v2`, `mode: evidence_based` | 冻结计划的 selected 关键词 × 全部配置语言。原始 candidates 及有审计依据的 deferred 条目完整保留；有 deferred 时明确报告 `coverage: partial`。 |

两种契约共有的字段为：

| 字段 | 契约 |
| --- | --- |
| `topic` / `created_at` | 目标游戏名，与 `site.config.json.gameName` 一致；带时区的 ISO 时间。 |
| `keywords_sha256` | 生产者验收的原始完整关键词文件字节 SHA-256。 |
| `profile_sha256` / `profile_file_sha256` | 来源规则使用的规范 profile 指纹，以及原始 profile 文件字节 SHA-256。 |
| `validator_version` | `source-policy-v2`，与来源回执版本一致。 |
| `languages` | 完整语言列表，以 `en` 开头，与站点语言及顺序完全一致；默认语言为英语。保留 `pt-br` 等实际语言标签。 |
| `required_keywords` / `keywords` | 本次要求发布的非零关键词数与完整身份条目，每项包含 `keyword/category/slug/translation_key`。v1 是全部关键词；v2 是 selected 子集。category 是实际目录及 frontmatter 使用的规范 slug；translation_key 必须等于 `category/slug`。 |
| `source_gate` | `gate: pass`，required/ready 数均等于 `required_keywords`，`blocked_keywords: 0`，验证器版本及 profile 指纹与顶层一致。v2 还必须声明 `source_scope: selected`。 |
| `articles` | 每个关键词 × 每个语言恰好一条，含 `keyword/locale/path/translation_key/sha256/source_pack_sha256`。path 相对于 `src/content/wiki/`，为 `locale/category/slug.mdx`；哈希对应未修改的文件字节。 |

### 有证据的部分发布

v2 必须额外提供 `candidate_keywords`、`selected_keywords`、`deferred_keywords`、
`coverage`、`policy_sha256`、`policy_file_sha256`、`publication_plan_sha256`、
`publication_plan_file_sha256`，以及完整的 `publication_plan` 对象。
计划使用 `schema_version: 1`、`contract: seoscout-publication-plan-v1`、
`mode: evidence_based`，包含原始候选身份、selected 来源包摘要、deferred 证据引用、
事先声明的 policy、任务/profile/policy 摘要、带时区的创建时间以及
`gate: pass, failures: []`。所有对象拒绝未知字段。

模板逐项核对原始 candidates 与 selected/deferred 的严格分区：二者保留原始顺序，
互不重叠，没有遗漏，关键词、分类、slug 和 translation key 均不得变更。
顶层 keywords 恰好等于 selected；每篇文章的来源包摘要必须与该 selected 条目一致。
计数满足 `candidate_keywords = selected_keywords + deferred_keywords`，
`required_keywords = selected_keywords`；只有 deferred 为零时才允许 `coverage: full`。

policy 明确 `min_selected_keywords`、`required_categories` 和 `required_keywords`。
至少选择一个关键词，且满足所有事先声明的要求；不能在文章生成失败后缩减要求。
OpenClaw 默认最低要求是一篇合格文章并包含 `guide` 分类，这是技术上的非空门槛，
不代表 SEO 内容已充分。其他分类规范的项目须在运行前声明相应 policy。
selected 文章的生成、翻译、格式或审核失败仍然阻断，不能改为 deferred 来取得通过。

deferred 的唯一原因是 `no_qualified_evidence`，同时保留实际 `source_gate_reason`、
来源包摘要（不存在时为 null）和已完成有界检索的证据引用。证据包含
32 位小写十六进制 `run_id`、`completed_rounds`、
`source-repair/runs/<run_id>/state.json` 及其摘要，以及同一 run 目录下的
`audit_segments` 相对路径和摘要。绝对路径、目录穿越、重复审计路径或缺失证据会失败。
具体检索是否完成、提供方是否正常返回、审计原文与状态是否真实相符由上游检验；
模板不持有这些生产服务器文件。检索提供方故障或冷却状态不能作为“没有证据”的理由。

`policy_sha256` 和 `publication_plan_sha256` 对嵌入对象重新计算：递归排序对象键、
保留数组顺序、紧凑 JSON、保留 Unicode、UTF-8、无末尾换行。
v2 JSON 中任何层级的重复键（包括转义后重名的键）都会拒绝，数值只接受安全整数。
`*_file_sha256` 绑定上游实际文件原始字节；模板返回这些摘要供编排核对，
不声称独立验过站点外的 policy/plan 原文件。实际导入器负责同时核验原文件与规范摘要。

v2 的 `site.config.json.navigation` 分类集合必须恰好等于 selected 的分类集合。
deferred 不创建 MDX、空页面、导航项或 sitemap 条目；首页、related 与正文链接仍由
内容和构建检查验证，不能指向没有发布的页面。原始候选、deferred 原因和摘要继续留在
计划及运行审计中，原始来源正文与审计日志不进入公开站点。

### 验收回执与失败

运行 `pnpm check:import` 可单独进行只读验收。stdout 是一行 JSON；生产通过
返回 `gate: pass, production_ready: true`，演示返回
`gate: demo, production_ready: false`，退出码均为 `0`。缺失、损坏或不一致的
生产交接返回 `gate: blocked`、具体原因以及退出码 `1`；stderr 给出简短状态。
`check:content` 与 `check:site` 也会执行相同检查，`build` 在构建前先执行该门槛。
生产通过的 JSON 还返回根清单原始字节的 `manifest_sha256`，外层必须核对它等于
本次上游成功回执的清单摘要。不能只凭退出码 `0` 把 demo 结果当成生产验收。
v2 成功回执还返回模式、`source_scope: selected`、coverage、三个关键词计数，
以及 policy/plan 的规范摘要和文件字节摘要。`production_ready: true` 表示 selected
计划完整达标；`coverage: partial` 不得被包装为原始全部关键词任务完成。
例如一个候选有证据、另一个有完整审计而暂缓，且配置两种语言时，成功回执应明确保留
`candidate_keywords: 2, selected_keywords: 1, deferred_keywords: 1, required_keywords: 1,
imported_articles: 2, coverage: partial`。所有 selected 文章仍须通过逐篇检查。

验收以交接要求发布的完整关键词和语言乘积为准，拒绝漏文章、漏翻译、额外演示文章、
重复路径、变更后的字节、错误 translationKey、不同语言的日期或来源包不一致、
复制正文、draft/noindex 文章，以及内容边界内的符号链接。生产文章必须显式声明
`draft: false` 和 `noindex: false`。不接受缺文章时自动改为 homepage-only，
也没有环境变量可以绕过生产检查。修改文章后须由上游重新验收并输出新的交接结果。

这个门槛验证生产者的回执、数量、身份映射及原始产物的一致性，不重新检索来源，
不把哈希当作真实性证明，也不能防止有写权限的人手工伪造整份回执。来源相关性、
审计保留和既有 Ebbtide 发布审核仍由上游负责；外层编排还应绑定当前任务的输入
SHA 与交接回执，防止误用其他运行的完整产物。

## 首页数据

支持 `hero/quickStart/updates/explore/aboutGame/featuredGuides/faq/finalCta`。`hero` 无需真人在线数或热度数据，stats 默认为空。若提供 stats，每项必须带 `label/value/source/asOf`。

首页译文放在 `home.json.translations.{locale}`，结构与主语言首页相同，无需另建一套配置文件。没有对应首页数据的语言不生成首页；该语言已有文章的“首页”链接指向真实的默认语言首页。法律页面只需对应的真实法律译文，不依赖首页是否翻译。没有译文的文章不生成 fallback URL。

Explore module 必须有 `id/title/type`，支持 `enabled` 与 `order`。省略 enabled 时默认为 true；空数据不渲染。

| type | 数据 |
| --- | --- |
| `card-list` | `items[].label/detail/href?` |
| `code-cards` | `codes[].code/reward/status/lastVerified` |
| `tier-grid` | `items[].label/detail/image?/alt?`，`basis` |
| `step-by-step` | `items[].label/detail` |
| `timeline` | `items[].label/detail/date?/href?` |
| `video-grid` | `items[].label/detail/href/image/alt`；真实 HTTPS 视频链接与自有缩略图 |
| `table` | `columns[]/rows[][]`，每行列数须一致 |
| `accordion` | `items[].label/detail` |

`featuredGuides` 使用语义键，例如 `guides/first-steps`，不伪称这些文章拥有最高访问量。Recent Updates 始终由该语言已发布且可索引文章的 `lastModified` 排序生成，与手工时间线独立。

## MDX 内容

路径：`src/content/wiki/{enabled-locale}/{configured-category}/{slug}.mdx`。模板演示内容的 slug 可有子目录，译文可用不同 slug；生产交接使用 manifest 中的固定路径及相同 `translationKey`，分类必须与 frontmatter 一致。v2 只导入 selected 的完整语言集合，不为 deferred 创建占位文件。

必填字段：`title/description/category/date/lastModified`。标题最多 80 字符；描述保留上游 40–165 字符约束。日期使用有效 `YYYY-MM-DD`，lastModified 不得早于 date。支持：

- `draft/noindex`：布尔值，默认 false。draft 没有任何页面；noindex 仍有页面，但不出现在发现入口、sitemap、hreflang 或搜索中。
- `cover/coverAlt`：可选封面；提供图片必须填写 ALT。文章首屏以答案为主，不强制展示大封面。
- `tags`：关联文章与分类筛选用。
- `answer/version`：顶部直接答案、适用游戏版本。
- `related`：同语言已存在且可索引文章的语义键；构建会拒绝不存在或自指的关系。
- `codes`：code/reward/status(active 或 expired)/lastVerified。
- `tiers/rankingBasis`：等级行与明确的评判依据；不得把示例数值冒充测试结果。
- `boss`：hp/weakness/resistant/location/recommendedLevel?/rewards[]。
- `item`：name/type/acquisition/stats[{label,value}]/guides[]。
- `build`：name/scenario/equipment[]/skills[]。
- `faq`：question/answer 数组；空数组不渲染。

可导入复用组件：

```mdx
import Callout from '~/components/mdx/Callout.astro';
import Accordion from '~/components/mdx/Accordion.astro';
import StepByStep from '~/components/home/modules/StepByStep.astro';
import Codes from '~/components/wiki/Codes.astro';
import TierList from '~/components/wiki/TierList.astro';
import Map from '~/components/wiki/Map.astro';
import Gallery from '~/components/wiki/Gallery.astro';
import Video from '~/components/wiki/Video.astro';
import Table from '~/components/wiki/Table.astro';
import Timeline from '~/components/wiki/Timeline.astro';
import VideoGrid from '~/components/wiki/VideoGrid.astro';
```

Markdown 原生支持表格与 H2/H3。Map 使用图片、标记文字与原图链接；不依赖交互地图引擎。Gallery 每张图传 `src/alt/width/height/caption?`。Video 传 `src/title/poster?` 与可选字幕 `captions:{src,label,lang}`，使用原生视频控件，默认不加载视频；没有真实视频时不要伪造示例 URL。

正文必须非空，不能只有注释，也不能包含 `Unable to Generate Article`、
`Missing Source Data`、`No reliable source` 等生成失败占位。正文内 H1、遗留 JS
metadata 和未转义的数字比较同样会失败。

MDX 是可信作者提供、可执行构建代码的内容格式，不适合作为未过滤的公共用户输入。外部 Agent 应只写入已经审阅的内容。

## 图片规范

图片放在 `public/images/`，引用使用 `/images/file.webp`。优先 WebP/AVIF，提供正确 ALT 和尺寸；Hero 是唯一默认高优先级图片，其他图片默认 lazy。新增字体、图片、视频或游戏素材需要保留相应的来源与授权，不复制参考站商标或素材。已有原创演示素材来源见 `ASSET_PROVENANCE.md`。

## 路由与索引

`src/lib/content.ts` 为发布页面、导航、语言替代与 sitemap 提供共享页面清单。英语 `/guides/a/`；中文 `/zh/guides/a/`。分类至少有一篇同语言可索引文章才生成。语言切换只指向相同语义键的真实、可索引页面。

Pagefind 只索引已发布、可索引的文章正文，不收录法律页面、列表导航、相关文章、草稿和 noindex 参考页。搜索在设备本地执行，运行时不依赖搜索服务器。

构建不刷新文章或首页日期。首页 sitemap 日期取配置日期与首页展示文章的最新修改日期；分类/recent 取真实文章日期。没有假译文、假评论、评分、价格或定时更新的承诺。

## 构建验证

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm preview
```

`pnpm build` 已包含生产交接验收、内容前置检查、Astro SSG、Pagefind 和产物检查。正文内链与所有 HTML 锚点在产物阶段核对，不通过时退出非零。`scripts/check-site.ts` 还检查独立标题、唯一 H1、OG/Twitter、JSON-LD、sitemap 与 HTML hreflang 一致性、未翻译页面、禁用首页模块与旧演示品牌残留。

浏览器验证见 README。`validation/` 保存机器结果和截图。仓库带有仅由
`workflow_dispatch` 触发的 `.github/workflows/deploy-workers.yml`；它先运行
`pnpm build`，检查通过后才执行部署。模板构建和内容检查不会触发该工作流。
推送、明确授权的手动部署、内容调研和运营由外部执行者负责。
