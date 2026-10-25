import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.WIKI_PREVIEW_URL ?? 'http://127.0.0.1:4321';
mkdirSync('validation/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.WIKI_CHROME_PATH ? { executablePath: process.env.WIKI_CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read','clipboard-write'], reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = []; const checks = []; const accessibility = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === base && !response.url().includes('/missing-') && !response.url().includes('/zh/bosses/') && !response.url().includes('/guides/unpublished-note/')) errors.push(`${response.status()}: ${response.url()}`); });
const assert = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
const screenshot = async name => { await page.screenshot({ path: `validation/screenshots/${name}.png`, fullPage: true }); };
async function visit(path) { await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); }
async function audit(name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  const violations = result.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, targets: item.nodes.map(node => node.target) }));
  accessibility.push({ name, violations });
  assert(!violations.length, `${name}: no WCAG A/AA violations in axe scan`);
}
try {
  await visit('/');
  assert(await page.locator('h1').count() === 1, 'Home has one H1');
  await screenshot('home-desktop-dark'); await audit('home-desktop-dark');
  await page.locator('.theme-toggle').click();
  assert(await page.locator('html').getAttribute('data-theme') === 'light', 'Theme changes to light');
  await screenshot('home-desktop-light'); await audit('home-desktop-light');
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('html').getAttribute('data-theme') === 'light', 'Theme preference survives reload');
  await page.locator('.theme-toggle').click();
  await visit('/guides/'); await screenshot('category-desktop'); await audit('category-desktop');
  await page.locator('[data-guide-filter]').fill('combat basics');
  assert(await page.locator('[data-guide-card]:visible').count() === 1, 'Category filter returns matching article');
  await page.locator('[data-guide-filter]').fill('not-an-article');
  assert(await page.locator('.filter-empty').isVisible(), 'Category filter gives an empty state');
  await visit('/guides/first-steps/'); await screenshot('article-desktop'); await audit('article-desktop');
  const firstAnchor = page.locator('.desktop-toc [data-toc-link]').first(); const anchor = await firstAnchor.getAttribute('href');
  await firstAnchor.click();
  assert(new URL(page.url()).hash === anchor, 'Article table of contents navigates to a real heading');
  await page.locator('.language-menu summary').click(); await page.locator('.language-options a[lang="zh"]').click();
  assert(new URL(page.url()).pathname === '/zh/guides/first-steps/' && await page.locator('html').getAttribute('lang') === 'zh', 'Language switch keeps article identity');
  await screenshot('article-chinese'); await audit('article-chinese');
  await visit('/codes/redeem-codes/'); await page.locator('[data-copy]').first().click();
  assert(await page.evaluate(() => navigator.clipboard.readText()) === 'HELLO-VALE', 'Code copy writes the exact value to clipboard');
  await screenshot('codes-desktop');
  await visit('/bosses/moss-guardian/'); await screenshot('boss-desktop'); await audit('boss-desktop');
  await visit('/equipment/weapon-tiers/'); await screenshot('tiers-desktop');
  await visit('/world/vale-map/'); await screenshot('map-desktop'); await audit('map-desktop');
  await visit('/'); await page.locator('[data-search-open]').click(); await page.locator('#wiki-search').fill('Guardian');
  await page.locator('#search-results a').first().waitFor({ state: 'visible' });
  assert(await page.locator('#search-results a[href="/bosses/moss-guardian/"]').count() === 1, 'Pagefind finds the published boss article');
  await screenshot('search-desktop');
  for (const query of ['quiet-orchid-reference','hidden-copper-draft']) {
    await page.locator('#wiki-search').fill(query);
    await page.waitForFunction(() => document.querySelector('.search-message')?.textContent.includes('No matching'));
    assert(await page.locator('#search-results a').count() === 0, `Pagefind excludes ${query}`);
  }
  await page.keyboard.press('Escape'); await page.locator('#search-dialog').waitFor({ state: 'hidden' }); assert(!await page.locator('#search-dialog').isVisible(), 'Escape closes search dialog');
  await visit('/zh/'); await page.locator('[data-search-open]').click(); await page.locator('#wiki-search').fill('战斗');
  await page.locator('#search-results a').first().waitFor({ state: 'visible' });
  const languageResults = await page.locator('#search-results a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert(languageResults.every(url => url.startsWith('/zh/')), 'Chinese search uses the Chinese index');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 }); await visit('/');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile home has no horizontal overflow');
  await screenshot('home-mobile-dark'); await audit('home-mobile-dark');
  await page.locator('[data-nav-open]').click(); assert(await page.locator('#navigation-drawer').isVisible(), 'Mobile navigation drawer opens');
  await screenshot('navigation-mobile');
  await page.keyboard.press('Escape'); await page.locator('#navigation-drawer').waitFor({ state: 'hidden' }); assert(!await page.locator('#navigation-drawer').isVisible(), 'Escape closes navigation drawer');
  await visit('/guides/first-steps/'); await page.locator('.mobile-toc summary').click();
  assert(await page.locator('.mobile-toc [data-toc-link]').first().isVisible(), 'Mobile article table of contents expands');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile article has no horizontal overflow');
  await screenshot('article-mobile'); await audit('article-mobile');
  await page.locator('.theme-toggle').click(); await screenshot('article-mobile-light');
  await visit('/world/vale-map/'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile map fits viewport'); await screenshot('map-mobile');
  for (const width of [320, 360, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/guides/', '/bosses/moss-guardian/', '/equipment/weapon-tiers/']) {
      await visit(path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: ${path} has no horizontal overflow`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const missing = await page.goto(`${base}/missing-page/`); assert(missing.status() === 404, 'Missing route returns an actual HTTP 404');
  await screenshot('404-mobile');
  for (const path of ['/zh/bosses/moss-guardian/','/guides/unpublished-note/']) { const response = await page.goto(`${base}${path}`); assert(response.status() === 404, `No fabricated route: ${path}`); }
  assert(!errors.length, 'No browser JavaScript errors or unexpected failed local requests');
} catch (error) {
  errors.push(error.stack ?? String(error));
  await screenshot('browser-failure');
  throw error;
} finally {
  writeFileSync('validation/browser-check.json', JSON.stringify({ browser: browser.version(), base, checks, errors, accessibility }, null, 2));
  await browser.close();
}
console.log(`Browser OK: ${checks.length} checks, ${accessibility.length} accessibility scans, screenshots saved to validation/screenshots/.`);
