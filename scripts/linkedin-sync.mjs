#!/usr/bin/env node
/**
 * LinkedIn → website sync.
 *
 * Merges new posts into data/linkedin.json from two sources:
 *   1. FEED_URL  — an RSS / Atom / JSON Feed of your LinkedIn posts
 *                  (e.g. from RSS.app, or any automation tool that exposes one).
 *   2. PAYLOAD   — a single post (or { posts: [...] }) sent by
 *                  repository_dispatch (Zapier / Make / IFTTT) or the
 *                  "Run workflow" form in GitHub Actions.
 *
 * Remote images are downloaded into assets/uploads/linkedin/ because
 * LinkedIn image links expire. Existing posts are never overwritten, so
 * edits made in the site editor are kept.
 *
 * Writes `changed=true|false` to $GITHUB_OUTPUT.
 * Node 18+ (uses global fetch). No dependencies.
 */
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data/linkedin.json');
const IMG_DIR = 'assets/uploads/linkedin';
const MAX_POSTS = 60;
const MAX_IMG = 8 * 1024 * 1024;

const log = (...a) => console.log('[linkedin-sync]', ...a);

/* ---------- helpers ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decode(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
function htmlToText(html = '') {
  return decode(decode(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);
}
function isoDate(d) {
  const t = Date.parse(d);
  return (isNaN(t) ? new Date() : new Date(t)).toISOString().slice(0, 10);
}
function idFor(post) {
  const m = String(post.url || '').match(/(?:activity|ugcPost|share)[-:](\d{10,})/);
  if (m) return 'li-' + m[1];
  return 'h-' + createHash('sha1').update((post.url || '') + '|' + (post.text || '')).digest('hex').slice(0, 12);
}
const isHttp = u => /^https?:\/\//i.test(u || '');

/* ---------- parsers ---------- */
function parseXml(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    const tag = n => {
      const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, 'i'));
      return m ? m[1] : '';
    };
    let link = decode(tag('link')).trim();
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? decode(m[1]) : ''; }
    const body = tag('content:encoded') || tag('description') || tag('content') || tag('summary');
    let image = (b.match(/<media:content[^>]*url="([^"]+)"/i) || b.match(/<media:thumbnail[^>]*url="([^"]+)"/i) ||
                 b.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i) || [])[1] || '';
    if (!image) { const m = decode(body).match(/<img[^>]+src=["']([^"']+)["']/i); if (m) image = m[1]; }
    return {
      url: link,
      text: htmlToText(body) || htmlToText(tag('title')),
      date: decode(tag('pubDate') || tag('published') || tag('updated') || tag('dc:date')).trim(),
      image: decode(image)
    };
  });
}
function parseJson(j) {
  const list = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : Array.isArray(j.posts) ? j.posts : [j];
  return list.map(it => ({
    url: it.url || it.external_url || it.link || it.postUrl || '',
    text: it.text || it.content_text || it.commentary || htmlToText(it.content_html || it.content || it.description || it.title || ''),
    date: it.date || it.date_published || it.published || it.publishedAt || it.created_at || '',
    image: it.image || it.banner_image || it.imageUrl || it.thumbnail || ''
  }));
}
async function fromFeed(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'website-linkedin-sync/1.0', Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml, */*' } });
  if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  const trimmed = body.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? parseJson(JSON.parse(trimmed)) : parseXml(body);
}
function fromPayload(raw) {
  if (!raw || raw === 'null' || raw === '{}') return [];
  let p;
  try { p = JSON.parse(raw); } catch { return []; }
  if (!p || typeof p !== 'object') return [];
  if (!Array.isArray(p) && !p.posts && !p.url && !p.text) return [];
  return parseJson(p);
}

/* ---------- images ---------- */
async function localiseImage(url, id) {
  if (!isHttp(url)) return url;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'website-linkedin-sync/1.0' } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMG) return url;
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg';
    await mkdir(path.join(ROOT, IMG_DIR), { recursive: true });
    const rel = `${IMG_DIR}/${id}.${ext}`;
    await writeFile(path.join(ROOT, rel), buf);
    return rel;
  } catch (e) {
    log('image download failed, keeping remote URL:', e.message);
    return url;
  }
}

/* ---------- main ---------- */
async function main() {
  const data = JSON.parse(await readFile(DATA, 'utf8').catch(() => '{"posts":[]}'));
  data.posts = Array.isArray(data.posts) ? data.posts : [];
  const known = new Set(data.posts.map(p => p.id));
  const knownUrls = new Set(data.posts.map(p => p.url).filter(Boolean));

  const incoming = [];
  incoming.push(...fromPayload(process.env.PAYLOAD));
  if (process.env.FEED_URL) {
    try { incoming.push(...await fromFeed(process.env.FEED_URL)); }
    catch (e) { log('feed error:', e.message); }
  } else {
    log('LINKEDIN_FEED_URL is not set — only payload posts will be added.');
  }

  let added = 0;
  for (const raw of incoming) {
    const url = isHttp(raw.url) ? raw.url.trim() : '';
    const text = String(raw.text || '').trim();
    if (!url && !text) continue;
    const post = { url, text, date: isoDate(raw.date), image: isHttp(raw.image) ? raw.image : '' };
    post.id = idFor(post);
    if (known.has(post.id) || (url && knownUrls.has(url))) continue;
    post.source = /linkedin\.com/i.test(url) || !url ? 'linkedin' : 'site';
    post.image = await localiseImage(post.image, post.id);
    data.posts.push({ id: post.id, source: post.source, url: post.url, date: post.date, text: post.text, image: post.image });
    known.add(post.id); if (url) knownUrls.add(url);
    added++;
  }

  data.posts.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  data.posts = data.posts.slice(0, MAX_POSTS);

  if (added) {
    data.updatedAt = new Date().toISOString();
    await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
  }
  log(`${incoming.length} item(s) received, ${added} new post(s) added.`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${added > 0}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
