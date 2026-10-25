# 迁移与减法记录

审计日期：2026-10-21。源仓库：`jjasnek-ops/gameforge-template`，固定提交 `7b68c2f121b82ec02c472956335a1749b0e2e400`。源仓库通过已连接 GitHub 账户只读检查，并在独立临时目录克隆用于审计；没有改动源仓库，没有复制 `.git`。新项目使用开始时为空的 `D:/CursorProjects/example_wiki`。

完整文件清单与四类处置记录在 `SOURCE_AUDIT.json`，每个文件记录原始 Git blob SHA。清单覆盖全部源文件；相关 UI、SEO、路由、配置、内容与依赖代码已读取分析。没有声称逐行审阅所有被排除的历史运营文档。

共登记 566 个文件：KEEP 20、EXTRACT 118、SIMPLIFY 169、REMOVE 259。四类记录描述提取和改造决策，没有修改或删除源仓库文件。

## KEEP：实际复用

| 上游 | 新项目处理 |
| --- | --- |
| `LICENSE` | 原文保留 AnvilWiki contributors 的 MIT 版权与免责条款，另分发至 `public/licenses/site-software.txt`。 |
| `JsonLd.astro` | 原文复用 `<` 转义，防止 JSON-LD 字符串提前结束 script。 |
| `Callout.astro`、`Accordion.astro` | 原文复用静态提示框与原生 details 交互；颜色通过新 Tailwind token 接入配置。 |
| `BossStatCard.astro`、`StatBar.astro` | 保留结构化属性卡和可视化条；StatBar 仅替换旧游戏示例注释。 |
| `TierGrid.astro`、`StepByStep.astro` | 复用等级与步骤渲染结构；步骤列表增加 not-prose 标记以隔离文章排版。 |
| `content-utils.ts` | 保留路径解析、CJK 阅读时间、稳定排序与去重关联选择；移除未使用的旧分类过期规则。 |
| `CodeBlock/CodesTable` | 复用按状态分组与原生 clipboard 的设计与流程，新增明确验证日期、键盘按钮、aria-live 与复制失败提示。 |
| `TableOfContents` | 复用基于 Astro render() 真实 heading 的桌面/移动目录与滚动高亮策略，删除旧断点配置和品牌颜色来源。 |
| `url.ts`、`seo.ts` | 保留无默认语言前缀、统一尾斜杠、规范链接与六类 JSON-LD 构造规则；改为读取统一配置与共享页面清单。 |
| Astro/MDX/Collections/Pagefind | 保持源仓库 Astro 7.3.2、MDX 8.0.1 与 Pagefind 1.5.2 架构，无 Next.js 或 React 迁移。 |

## EXTRACT：交还外部 Agent

不带入 `.agent/skills`、`tools/anvil-ops`、AI 草稿、事实检索、机会研究、关键词、内容生成、游戏配置生成、内容 PR、自动发布、IndexNow 提交、定时任务、Cloudflare 与 GitHub 自动编排。新项目没有上述运行入口、密钥或 SDK。

## SIMPLIFY：减少重复与耦合

- 多份品牌、首页、语言和生成配置合并成 `site.config.json` 与 `home.json`，不在运行前重写 TypeScript。
- 删除配置层对 `.gameforge/site.json` 与 evidence 运营状态的依赖；页面渲染不接管事实调研。
- 一个静态页面清单覆盖首页、真实分类、文章、recent、法律页面；sitemap 与 HTML 使用同一语义键生成语言关系。
- 不生成未翻译 fallback 页面，因此无需维护重复页面的索引补丁。没有正文的分类根本不产生页面。
- 不再在 Astro 配置中正则扫描 frontmatter 来猜测 sitemap 日期；日期来自已通过内容 Schema 的文章与首页配置。
- 保留 Tailwind 3.4.17。上游 `@astrojs/tailwind` 的 peer 范围只覆盖 Astro 3–5，改由 Astro 支持的 PostCSS 管线接入现有 Tailwind，消除 peer 冲突。未升级到另一套 CSS 框架。
- Pagefind 延迟加载，且只索引文章。广告保留一个按配置渲染的 AdSense slot，分析保留可选 Cloudflare beacon，均默认关闭。
- 必要质量检查统一为内容前置检查与构建产物检查；保留独立的单元、浏览器和性能验证。
- 浏览器测试发现 Astro/Vite 对内联动态 import 的预加载占位处理异常。搜索改用原生 ES module 延迟导入构建后的 Pagefind，产物检查禁止残留占位符；搜索闭环已实际验证。

## REMOVE：没有带入的内容

旧演示游戏的文章、Logo、图标身份、封面与截图；AnvilWiki 营销落地页、手册、社区展示、赞助与微信素材；历史教程、测试夹具、旧运营说明、失效依赖、原站验证文件、广告示例 HTML、原部署与 PR 工作流。它们在新项目中没有引用，因此选择性提取时未复制；没有对源仓库执行批量删除。

## UI 改进

参考 [Anvil 示例站](https://anvil.wiki/demo/) 的组件与内容入口，研究 [VV Ultimatum](https://vvultimatum.net/) 的导航、分类、攻略目录与信息密度。另检查了 `.sbs` 版本与 `libin257/vvultimatum_cloudflare` 仓库；参考仓库使用 Next.js，仅参考设计思路，没有复制其源码、Logo、图片或迁移技术栈。

新布局提供固定桌面 Wiki 导航、紧凑横幅、四个入门入口、精选文章、四种默认 Explore 模块、真实文章更新时间侧栏；更多演示模块默认隐藏。六个分类按真实内容自动显示数量。文章首屏包含摘要、直接答案、修改日期和阅读时间，避免大封面挤走正文。移动端为原生模态抽屉、可折叠目录、横向表格和单列正文。深浅主题均从配置生成。

Hero 强调色、封面标签与按钮文字对比色也读取或计算自配置，未将默认金色主题固定在组件里；只改配置即可换成另一套游戏配色。

所有虚构玩法、代码验证记录和数值均明确标注为演示；页面不声称拥有真实玩家数、流量排名、实测评分或官方身份。原创插画由本任务生成，地图和武器示意图原创制作。软件版权声明及第三方许可保留，品牌残留检查不把合法许可声明当作错误。
