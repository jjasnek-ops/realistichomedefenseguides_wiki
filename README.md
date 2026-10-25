# example_wiki

基于 Astro 7、TypeScript、Tailwind CSS 3、MDX、Content Collections 与 Pagefind 的独立游戏 Wiki 静态模板。默认的 **Example Game 是虚构游戏，全部攻略、兑换码与数值均为演示数据**。

## 安装

需要 Node.js 22.19+、pnpm 12.11.2。

```sh
pnpm install --frozen-lockfile
```

## 配置

只需替换以下内容即可更换游戏：

- `site.config.json`：品牌、域名、深浅主题、语言、分类导航、SEO、法律说明及可选展示集成。
- `home.json`：首页内容、模块类型、顺序和显隐。译文放在同一文件的 `translations` 中。
- `src/content/wiki/`：MDX 文章。
- `article-manifest.json`：生产者验收后的文章交接回执；生产模式必需，v2 同时保留原始候选与暂缓发布的审计引用。
- `public/images/` 与 favicon：自有或已授权的图片。

默认 `demo: true` 会在全站显示虚构数据提示。正式使用前替换所有示例内容与法律文案，设置真实域名，再关闭演示标记。分析与广告默认关闭。完整字段与边界见 [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md)。

生产 `demo: false` 时，先把 seoscout 的 `out/article-handoff.json` 导入根目录
`article-manifest.json`，并按其清单逐字节导入所有语言文章。`pnpm check:import`
校验要求发布的完整关键词 × 语言集合、原始文件哈希、来源验收回执及元数据；缺文章、额外
演示文章或变更后的产物都会失败。此检查不调用 API，不生成内容，也不将来源哈希
当作真实性证明。演示模式仍可独立运行，不能被报告为生产文章验收成功。

兼容 `seoscout-articles-v1 / full` 的全部关键词契约。新契约
`seoscout-articles-v2 / evidence_based` 只发布事先冻结计划中的 selected 关键词，
逐篇来源、全部译文和内容门槛保持不变。原始候选必须严格分为 selected 与有检索审计的
deferred；无法生成或翻译的 selected 文章仍会阻断。通过回执保留 candidate/selected/
deferred 计数、`coverage: partial` 或 `full`，以及规范和原始文件的计划摘要。
没有任何合格关键词或未满足计划最低数量、必需分类/关键词时不会通过。
deferred 不创建占位文章、空分类、无效导航或 sitemap 页面；v2 导航分类须与 selected
分类一致。具体契约与信任边界见 [生产文章交接门槛](AGENT_INTEGRATION.md#生产文章交接门槛)。

## 本地预览

```sh
pnpm dev
```

以终端实际打印的 Local URL 为准；端口占用时 Astro 会选择可用端口。搜索依赖生产索引，需要：

```sh
pnpm build
pnpm preview
```

Astro 7 可将预览服务放入后台；用 `pnpm exec astro preview status` 查看，`pnpm exec astro preview stop` 关闭。

## 添加文章

在 `src/content/wiki/{locale}/{category}/{slug}.mdx` 新增文件。分类须存在于 `site.config.json.navigation`，语言须在 `languages` 中启用。

```mdx
---
title: "Your first steps"
description: "A concise, accurate answer to the player's question."
category: guides
date: "2026-10-21"
lastModified: "2026-10-21"
draft: false
noindex: false
tags: [beginner]
---

## Start here

Write the useful answer first.
```

英语默认无 `/en/` 前缀。其他语言只为真实 MDX 译文生成页面；跨语言对应关系使用相同 `translationKey`，演示内容不提供时按 `category/slug` 匹配。生产导入必须提供 manifest 中的 translationKey，并显式声明 draft/noindex 为 false。正文从 H2 开始，模板负责唯一 H1；空正文和生成失败占位会被拒绝。修改生产文章后须重新取得上游验收回执。

## 构建与验证

```sh
pnpm validate
```

依次执行 lint、Astro 类型检查、单元测试、生产交接门槛、配置与内容校验、SSG、Pagefind、产物链接/SEO/sitemap/i18n/草稿与 noindex/品牌检查。输出目录为 `dist/`。原始结果写入 `validation/`，该目录的截图与 JSON 不进入 Git。

需要重新执行浏览器检查时：

```sh
pnpm exec playwright install chromium
pnpm preview
# 将 WIKI_PREVIEW_URL 设为终端打印的实际 Local URL，然后运行：
node scripts/browser-check.mjs
```

也可通过 `WIKI_CHROME_PATH` 指定已安装的 Chrome，跳过浏览器下载。此浏览器脚本验收随附演示站的具体路线；更换游戏后按新内容调整测试场景，通用构建验证不需要修改。

当前实测结果与截图说明见 [VALIDATION_REPORT.md](VALIDATION_REPORT.md)。

## Cloudflare Pages 部署

仓库另含仅手动触发的 Workers 部署工作流 `.github/workflows/deploy-workers.yml`。
该入口先运行 `pnpm build`，生产文章交接失败时不会执行 Wrangler。构建和内容校验
自身不触发部署；部署须由调用方明确授权并使用约定的入口。

模板输出纯静态文件，不需要 Cloudflare adapter、数据库、密钥或常驻 Node 服务。

| 项目 | 设置 |
| --- | --- |
| Node 版本 | 22.19 或以上兼容版本 |
| 安装 | `pnpm install --frozen-lockfile` |
| 构建 | `pnpm build` |
| 输出 | `dist` |

Pages 原生使用 `404.html` 处理不存在的路径。不要添加 SPA catch-all 重写。`public/_headers` 随构建复制。配置流程可参考 [Cloudflare Astro 官方指南](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)。发布前将 `domain` 配置为真实站点域名，并确保图片、来源与内容已获授权。
