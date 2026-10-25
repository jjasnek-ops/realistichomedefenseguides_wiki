# 验证报告

验证日期：2026-10-21（Asia/Shanghai）。对象为 `example_wiki` 本地生产构建；没有推送远程、部署 Cloudflare 或修改源仓库。

## 环境

- Windows 11，系统版本 `10.0.22621`，AMD Ryzen 7 5800H，16 GB 内存。
- Node.js `22.19.0`，pnpm `12.11.2`；锁文件安装成功，无 peer dependency 冲突。
- Astro `7.3.2`、MDX `8.0.1`、Tailwind `3.4.17`、Pagefind `1.5.2`。
- Playwright `1.64.1`、已安装的 Chrome `155.0.8059.85`、axe `4.14.0`、Lighthouse `13.5.0`。
- 本地 Astro preview 实际地址 `http://127.0.0.1:4326/`，Node HTTP 与浏览器均确认返回 200。预览端口由占用情况决定。

`validation/` 中的原始 JSON、HTML 报告、日志与截图是本地验证产物，未纳入 Git；重新运行检查可以生成对应产物。

## 必要检查结果

| 检查 | 结果与证据 |
| --- | --- |
| 依赖安装 | `pnpm install --frozen-lockfile` 成功；`pnpm peers check` 无冲突。 |
| Lint | `pnpm lint` 成功。 |
| Typecheck | `pnpm typecheck` 成功，54 个文件，0 errors / 0 warnings / 0 hints。 |
| 单元测试 | `pnpm test`，12/12 通过；覆盖 Schema 拒绝无效数据、日期、嵌套路径、语言前缀、阅读时间、关联去重、稳定排序与 SEO 索引策略。 |
| Astro SSG | 生成 28 个 HTML 页面，无 SSR Worker，无数据库或长期运行的生产 Node 服务。 |
| 配置与内容 | 11 个 MDX 文件：9 篇可索引文章、1 篇 noindex 参考页、1 篇 draft；英语 8 篇可索引文章、中文 1 篇真实译文，英语 6 个分类。 |
| 内链和资源 | 1,144 个链接、锚点与静态资源引用检查通过，无失效引用。 |
| SEO | 唯一标题、唯一 H1、描述、canonical、OG、Twitter、图片 ALT 与尺寸、可解析 JSON-LD 均通过。 |
| Sitemap | 26 个可索引页面；排除 404、draft 与 noindex。文章 lastmod 与 MDX 字段一致，未使用构建时间替换内容日期。 |
| i18n | 66 个 HTML alternate 声明检查通过；与 sitemap 一致且互相对应，不生成缺失的 Boss 中文页或无内容分类。 |
| Draft / Noindex | draft URL 实际返回 404；noindex 页面有真实 HTML 和 noindex meta，但无发现入口、sitemap 或 Pagefind 收录。 |
| Pagefind | 实际生成并搜索 2 种语言、9 篇文章。英语搜索找到 Boss；中文搜索返回中文文章；两条排除验证词均无搜索结果。 |
| 品牌与授权 | 发布 UI 无旧演示游戏或参考站身份残留。保留的许可证与来源报告不视为品牌错误。 |
| 静态部署输出 | 包含 `404.html`、`robots.txt`、`sitemap.xml`、Pagefind、图片、许可及 Cloudflare `_headers`。 |

最终 `pnpm validate` 全链通过。原始结果：`validation-all.log`、`validation/site-check.json`、`validation/browser-check.json`。

MIT 主许可证与公开分发副本 SHA-256 均为 `66a7943308a74e32788b272b1d30faa5b87f250d1750f7a901765cad79b1f9ae`，与源声明一致。源仓库固定于 `7b68c2f121b82ec02c472956335a1749b0e2e400`，工作区保持干净。

## 浏览器与视觉检查

52 项浏览器检查通过，无页面 JavaScript 错误或意外的本地失败请求。9 个 axe 扫描覆盖 WCAG 2 A/AA、2.1 A/AA、2.2 AA，未发现违规。覆盖首页深浅主题、分类页、英语/中文文章、Boss、地图和移动端。

实际操作验证了主题切换和持久化、分类标题/标签筛选、无匹配状态、桌面目录跳转、语义一致的语言切换、兑换码准确复制、中英文搜索、草稿/noindex 排除、Escape 关闭搜索与抽屉、移动目录展开，以及真实 HTTP 404。对首页、分类、Boss、Tier 页面分别检查了 320、360、390、768、1024、1920px，无横向页面溢出；桌面主截图为 1440×1000，移动主截图为 390×844。

关键截图已生成并实际打开进行视觉审查：

| 页面 | 本地截图 |
| --- | --- |
| 桌面首页与首屏 | `validation/screenshots/home-desktop-dark.png`、`home-desktop-fold.png` |
| 浅色首页 | `validation/screenshots/home-desktop-light.png` |
| 移动首页与抽屉 | `validation/screenshots/home-mobile-dark.png`、`home-mobile-fold.png`、`navigation-mobile.png` |
| 分类 | `validation/screenshots/category-desktop.png`、`category-mobile.png` |
| 文章与译文 | `validation/screenshots/article-desktop.png`、`article-chinese.png`、`article-mobile.png`、`article-mobile-light.png` |
| 游戏组件 | `validation/screenshots/codes-desktop.png`、`boss-desktop.png`、`tiers-desktop.png`、`map-desktop.png`、`map-mobile.png` |
| 搜索与 404 | `validation/screenshots/search-desktop.png`、`404-mobile.png` |

发现并修复了移动端最后一张精选卡片的布局覆盖、步骤列表受到 Markdown 段落样式影响、Tailwind 透明色 token 的适配、原生搜索框吞掉第一次 Escape、品牌可访问名称不包含可见文字，以及 Astro/Vite 内联动态导入残留占位符导致搜索失败的问题。产物检查现会拒绝残留的 `__VITE_PRELOAD__`。

## 数据变体检查

另执行 10 项边界断言：只通过 JSON 切换为紫色主题，暂时启用无文章的日语、移除中文首页而保留真实中文文章/法律译文，并新增只有 noindex 文章的分类。生产构建与完整链接检查仍通过：Hero 强调色随配置改变；不生成假日语页面或中文首页；真实译文保留；首页导航指向真实的默认首页；法律译文不依赖首页；noindex-only 分类无列表，也无指向缺失分类的面包屑。

完成后恢复两个 JSON 原始字节并删除临时文章，再次执行 `pnpm validate`。最终首页与文章 HTML 的 SHA-256 与测试页面逐字节一致；清理未使用的派生配置和重复 XML 转义后，另外确认了 32 个 HTML/CSS 文件字节完全不变。结果与临时复现脚本在 `validation/variant-check.json`、`validation/variant-check.mjs`、`validation/variant-build.log`、`validation/cleanup-proof.json`。

## Lighthouse 实测

以下均为本地生产预览的实验室结果，使用冷缓存及 Lighthouse 默认模拟节流。最终测试时间为 2026-10-21 12:56–12:57（Asia/Shanghai）。移动端为 150ms RTT、约 1.6Mbps、4× CPU slowdown；桌面为 desktop preset，40ms RTT、10Mbps、1× CPU。

| 页面 / 模式 | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 首页 / mobile | 100 | 100 | 100 | 100 | 1.880s | 0 | 0ms |
| 首页 / desktop | 100 | 100 | 100 | 100 | 0.425s | 0 | 0ms |
| 文章 / mobile | 100 | 100 | 100 | 100 | 0.905s | 0 | 0ms |
| 文章 / desktop | 100 | 100 | 100 | 100 | 0.245s | 0 | 0ms |

原始文件为 `validation/lighthouse-{home,article}-{mobile,desktop}.report.{json,html}`，汇总为 `validation/performance-summary.json`。命令示例：

```sh
pnpm exec lighthouse http://127.0.0.1:4326/ --chrome-flags="--headless=new" --only-categories=performance,accessibility,best-practices,seo --output=json --output=html --output-path=validation/lighthouse-home-mobile --no-enable-error-reporting --quiet
```

桌面增加 `--preset=desktop`；通过 `CHROME_PATH` 选择本机 Chrome。Lighthouse runWarnings 均为空。分数之外的品牌标签一致性问题也已修复并复测，未通过删除规则达标。

## 实际限制

- 没有部署或真实流量，因此没有 CrUX / RUM 的 INP 数据；不声称已达到真实用户 INP ≤200ms，TBT 也不等同于 INP。
- 性能数据只覆盖上述代表性首页与文章，并非对所有新游戏、设备或上线环境的保证。Lighthouse 仍提示可进一步提供响应式缩略图、减少图片字节；当前已测 LCP 与 CLS 达到目标。
- Astro/MDX 生成模块仍有 `use astro:head-inject` 的 Rolldown 构建提示；没有屏蔽此警告，SSG、MDX 正文、样式与现有交互已验证通过。
- Pagefind 会提示中文不支持 stemming；实际中文关键词搜索通过。
- 广告和分析默认关闭，未调用第三方服务进行上线测试；没有真实视频来源时不伪造视频示例。法律文案是需要按实际站点调整的起点。
- 浏览器检查使用本机 Chrome；未声称完成 Safari、Firefox 或所有真实移动设备测试。

Example Game 的玩法、数值和代码验证记录始终是明确标注的虚构演示数据。文章修改日期为本次实际编写日期，构建不会自动刷新它们。
