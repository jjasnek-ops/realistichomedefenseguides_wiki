# 素材与许可来源

本项目没有复制 VV Ultimatum、源演示游戏的 Logo、游戏截图或图片。没有捆绑外部字体；界面使用设备系统字体。

| 资源 | 来源与用途 |
| --- | --- |
| `public/images/hero.webp` | 2026-10-21 使用内置 image_gen 工具新生成的虚构概念插画，实测原始尺寸 2172×724，优化为 1536×512 WebP。不是游戏截图。 |
| `public/images/wayfarer-blade.svg` 及 WebP | 本任务原创矢量示意图，展示虚构武器；WebP 为构建前一次性转换的网页资源。 |
| `public/images/vale-map.svg` 及 WebP | 本任务原创地图示意图，标记虚构位置；不包含真实游戏地图数据。 |
| `public/images/logo.svg`、`public/favicon.svg` | 本任务原创几何罗盘标志。 |
| Lucide 图标 | 通过 astro-icon 内联输出；保留 `public/licenses/lucide.txt` 中的 ISC 及继承的 Feather MIT 声明。 |
| Astro/Tailwind/Pagefind | 保留 `public/licenses/` 中相应的软件许可；锁文件记录实际依赖版本，安装包自带其余依赖许可。 |

GameForge / AnvilWiki 软件来源及 MIT 声明见 `LICENSE` 与 `MIGRATION_REPORT.md`。未使用上游 Lato 字体，因此未复制其字体文件或把字体许可冒充图片授权。

横幅使用内置 image_gen 模式，提示词如下；工具不属于模板依赖，构建与浏览不需要调用 AI：

> Use case: stylized-concept. Asset type: original panoramic fantasy game wiki banner, no UI. Create a sophisticated painterly environment concept for a fictional generic adventure RPG called Example Game, without text. Wide cinematic landscape, ancient weathered stone citadel and circular ruins rising from a wooded island in the right-center, distant layered mountains and a silver river, a tiny cloaked traveler in foreground, gold late afternoon rays through atmospheric clouds, mossy stone, restrained desaturated forest greens, charcoal shadows and warm antique gold. Fine detailed game concept art with a tangible painterly texture, realistic proportions and strong depth, quietly epic. Composition: panoramic 3:1 landscape. Keep left third dark and tranquil with tree silhouettes and mist so a website can place legible white title over it. Rich detailed center and right. No text, no logos, no watermarks, no recognizable franchise characters or designs. This is fictional demo artwork.

横幅交付路径为 `public/images/hero.webp`。地图、武器的 SVG 原稿与 WebP 均在 `public/images/`，便于外部 Agent 整体替换。新增第三方素材时应补充真实来源与适用授权记录。
