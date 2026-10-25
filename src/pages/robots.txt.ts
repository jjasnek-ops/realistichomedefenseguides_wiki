import { siteUrl } from '../lib/config';
export function GET() { return new Response(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
