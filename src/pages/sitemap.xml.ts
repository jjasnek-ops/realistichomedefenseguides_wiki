import { articles, pagesFor } from '../lib/content';
import { sitemapXml } from '../lib/seo';
export async function GET() { return new Response(sitemapXml(pagesFor(await articles())), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }); }
