/* =========================================================
   Anas Zuhairi — Portfolio runtime (v3, recruiter-focused)
   Loads data/site.json + data/linkedin.json and renders the page.
   All user/feed text is inserted with textContent (never innerHTML).
   Motion settles after entry; pointer effects only; reduced motion honoured.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const svgNS = 'http://www.w3.org/2000/svg';

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  function icon(paths) {
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    paths.forEach(d => {
      const p = document.createElementNS(svgNS, 'path');
      if (d.startsWith('F:')) { p.setAttribute('d', d.slice(2)); p.setAttribute('class', 'fill'); } else p.setAttribute('d', d);
      s.append(p);
    });
    return s;
  }
  const ICONS = {
    gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
    chip: ['M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2', 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M9 9h6v6H9z'],
    code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
    globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z'],
    arrow: ['M7 17L17 7M9 7h8v8'],
    download: ['M12 3v12M7 10l5 5 5-5M5 21h14'],
    play: ['F:M8 5.5v13l11-6.5z'],
    pause: ['F:M7 5h4v14H7zM13 5h4v14h-4z'],
    mail: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3 7l9 6 9-6'],
    phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'],
    pin: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    doc: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5M9 13h6M9 17h6']
  };
  // Social platforms: icon + display name. Keys match the editor's "platform" options.
  const SOCIAL = {
    linkedin: { name: 'LinkedIn', icon: ['M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z', 'M2 9h4v12H2z', 'M4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'] },
    whatsapp: { name: 'WhatsApp', icon: ['M7.9 20A9 9 0 1 0 4 16.1L2 22z', 'M9 9.2c.2 2.6 2.2 4.6 4.8 4.8l1-1.2-1.6-.9-.8.6a4 4 0 0 1-1.9-1.9l.6-.8-.9-1.6z'] },
    telegram: { name: 'Telegram', icon: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'] },
    instagram: { name: 'Instagram', icon: ['M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z', 'M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z', 'M17.5 6.5h.01'] },
    facebook: { name: 'Facebook', icon: ['M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z'] },
    github: { name: 'GitHub', icon: ['M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5a10.3 10.3 0 0 0-8 0C6 2 5 2 5 2c-.3 1.1-.3 2.3 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.4.5-.7 1-.9 1.7-.2.6-.2 1.2-.1 1.8v4', 'M9 18c-4.5 2-5-2-7-2'] },
    x: { name: 'X', icon: ['M4 4l16 16', 'M20 4L4 20'] },
    youtube: { name: 'YouTube', icon: ['M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17', 'M10 15l5-3-5-3z'] },
    tiktok: { name: 'TikTok', icon: ['M9 18V5l12-2v13', 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'] },
    website: { name: 'Website', icon: ICONS.globe },
    email: { name: 'Email', icon: ICONS.mail }
  };

  /* ---------- data ---------- */
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return r.json();
  }
  let previewImages = {};
  async function loadData() {
    if (PREVIEW) {
      try {
        const draft = JSON.parse(localStorage.getItem('az-preview') || 'null');
        if (draft && draft.site) { previewImages = draft.images || {}; return { site: draft.site, feed: draft.feed || { posts: [] } }; }
      } catch (e) { /* fall back */ }
    }
    const [site, feed] = await Promise.all([getJSON('data/site.json'), getJSON('data/linkedin.json').catch(() => ({ posts: [] }))]);
    return { site, feed };
  }
  const src = p => (p && previewImages[p]) || p;
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const safeUrl = u => {
    if (!u) return '';
    try { const x = new URL(u, location.href); return ['http:', 'https:', 'mailto:', 'tel:'].includes(x.protocol) ? x.href : ''; } catch { return ''; }
  };
  const isExternal = u => /^https?:/i.test(u) && !u.startsWith(location.origin);
  /** Apply an editor focus/zoom value ({x, y, zoom}) to an <img> as CSS variables. */
  function applyFocus(img, f) {
    if (!img || !f) return;
    const x = Number(f.x), y = Number(f.y), z = Number(f.zoom);
    if (isFinite(x)) img.style.setProperty('--fx', Math.min(100, Math.max(0, x)) + '%');
    if (isFinite(y)) img.style.setProperty('--fy', Math.min(100, Math.max(0, y)) + '%');
    if (isFinite(z) && z > 0) img.style.setProperty('--z', Math.min(4, Math.max(1, z)));
  }
  const socialsOf = p => (p.socials || []).filter(s => safeUrl(s.url));

  /* ---------- renderers ---------- */
  function bindSimple(site) {
    $$('[data-bind]').forEach(el => { const v = get(site, el.dataset.bind); if (typeof v === 'string' && v) el.textContent = v; });
    $$('[data-href]').forEach(el => { const v = safeUrl(get(site, el.dataset.href)); if (v) el.href = v; else el.hidden = true; });
    const m = site.meta || {}, p = site.profile || {};
    if (m.title) document.title = m.title;
    if (m.description) { const d = $('meta[name="description"]'); d && d.setAttribute('content', m.description); }
    $('#year').textContent = new Date().getFullYear();
    ['#nav-cv', '#hero-cv'].forEach(sel => {
      const a = $(sel);
      if (p.resume) { a.href = src(p.resume); a.target = '_blank'; a.rel = 'noopener'; }
      else { a.querySelector('span').textContent = 'Contact me'; a.href = '#contact'; }
    });
  }

  function renderSocials(list, box, small) {
    box.replaceChildren();
    list.forEach(s => {
      const meta = SOCIAL[s.platform] || SOCIAL.website;
      const u = safeUrl(s.url);
      const label = `${meta.name}${s.label ? ': ' + s.label : ''}`;
      box.append(h('li', null, h('a', { href: u, target: isExternal(u) ? '_blank' : null, rel: isExternal(u) ? 'noopener me' : null, 'aria-label': label, title: label }, icon(meta.icon))));
    });
    if (!list.length) box.hidden = true;
  }

  function renderHero(site) {
    const p = site.profile || {};
    const cell = $('#photo-cell'), img = $('.photo', cell);
    if (p.photo) {
      img.src = src(p.photo); img.alt = `Photo of ${p.shortName || p.name || ''}`; img.hidden = false;
      applyFocus(img, p.photoFocus);
      cell.classList.add('has-photo');
    }
    $('.photo__cap', cell).textContent = p.photoCaption || '';
    const fb = $('#factbar'); fb.replaceChildren();
    (p.facts || []).slice(0, 4).forEach(x => fb.append(h('div', null, h('dt', { text: x.label }), h('dd', { text: x.value }))));
    if (!fb.children.length) fb.hidden = true;
    renderSocials(socialsOf(p), $('#hero-socials'));
    renderSocials(socialsOf(p), $('#footer-socials'), true);
    const orgs = $('#proof-orgs'); orgs.replaceChildren();
    (p.proofOrgs || []).forEach(o => orgs.append(h('li', { text: o })));
    if (!orgs.children.length) orgs.parentElement.hidden = true;
  }

  function renderStats(stats = []) {
    const box = $('#stats'); box.replaceChildren();
    stats.forEach((s, i) => box.append(
      h('div', { class: 'stat reveal', style: `--d:${i * 0.07}s` },
        h('div', { class: 'stat__value', 'data-count': s.value, 'data-suffix': s.suffix || '', text: '0' + (s.suffix || '') }),
        h('div', { class: 'stat__label', text: s.label }))));
    if (!stats.length) box.hidden = true;
  }

  function renderAbout(site) {
    const p = site.profile || {};
    const t = $('#about-text'); t.replaceChildren();
    (Array.isArray(p.summary) ? p.summary : String(p.summary || '').split(/\n\s*\n/)).filter(Boolean).forEach(par => t.append(h('p', { text: par })));
    const roles = $('#roles'); roles.replaceChildren();
    (p.roles || []).forEach(r => roles.append(h('li', { text: r })));
    const langGroup = (site.skills || []).find(g => g.icon === 'globe' || /language/i.test(g.group || ''));
    const langs = $('#langs'); langs.replaceChildren();
    (langGroup ? langGroup.items : []).forEach(l => langs.append(h('li', { text: l })));
    if (!langs.children.length) { langs.hidden = true; langs.previousElementSibling.hidden = true; }
  }

  function renderExperience(list = []) {
    const tl = $('#timeline');
    $$('.job', tl).forEach(n => n.remove());
    list.forEach((j, i) => tl.append(
      h('li', { class: 'job reveal', style: `--d:${i * 0.05}s` },
        h('div', { class: 'job__when', text: j.period }),
        h('span', { class: 'job__node', 'aria-hidden': 'true' }),
        h('article', { class: 'job__card' },
          h('h3', { class: 'job__role', text: j.role }),
          h('p', { class: 'job__company' }, j.company, j.location ? h('span', { text: ' · ' + j.location }) : null),
          h('ul', { class: 'bullets' }, (j.bullets || []).map(b => h('li', { text: b }))),
          (j.tags && j.tags.length) ? h('div', { class: 'tags' }, j.tags.map(t => h('span', { class: 'tag', text: t }))) : null))));
  }

  const sims = [];
  function projectCard(p, i, total, compact) {
    const visual = p.visual || (p.image ? 'image' : 'none');
    let media = null;
    if ((visual === 'image' || !window.ProjectVisuals) && p.image) {
      const img = h('img', { src: src(p.image), alt: `${p.title} — preview`, loading: 'lazy', decoding: 'async' });
      applyFocus(img, p.imageFocus);
      media = h('div', { class: 'project__media' }, img);
    } else if (['aurewas', 'vision', 'database'].includes(visual)) {
      const canvas = h('canvas', { class: 'sim', role: 'img', 'aria-label': `${p.title}: animated diagram of how the system works` });
      const ctrl = h('button', { class: 'sim-ctrl', type: 'button' });
      media = h('div', { class: 'project__media' }, canvas, ctrl, visual === 'aurewas' ? h('span', { class: 'sim-label', text: 'Live PLC logic · top-down' }) : null);
      sims.push({ canvas, ctrl, visual });
    }
    if (media && p.status) media.append(h('span', { class: 'badge' + (/progress/i.test(p.status) ? ' badge--progress' : ''), text: p.status }));
    const links = (p.links || []).filter(l => safeUrl(l.url)).map((l, k) =>
      h('a', { class: 'btn btn--sm ' + (k === 0 ? 'btn--primary' : 'btn--line'), href: safeUrl(l.url), target: '_blank', rel: 'noopener' },
        h('span', { text: l.label || 'Open' }), icon(ICONS.arrow)));
    const body = h('div', { class: 'project__body' },
      h('div', { class: 'project__num', text: `Project ${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` }),
      p.context ? h('p', { class: 'project__context', text: p.context }) : null,
      h('h3', { class: 'project__title', text: p.title }),
      p.subtitle ? h('p', { class: 'project__subtitle', text: p.subtitle }) : null,
      p.summary ? h('p', { class: 'project__summary', text: p.summary }) : null,
      (p.highlights && p.highlights.length) ? h('ul', { class: 'bullets' }, p.highlights.map(x => h('li', { text: x }))) : null,
      (p.tags && p.tags.length) ? h('div', { class: 'tags' }, p.tags.map(t => h('span', { class: 'tag', text: t }))) : null,
      p.team ? h('p', { class: 'project__team', text: p.team }) : null,
      links.length ? h('div', { class: 'project__foot' }, links) : null);
    const cls = 'project reveal' + (compact ? ' project--compact' : '') + (!compact && i % 2 ? ' project--flip' : '');
    return h('article', { class: cls, id: p.id ? 'project-' + p.id : null }, media, body);
  }

  function renderProjects(list = []) {
    const box = $('#projects-list'); box.replaceChildren();
    sims.length = 0;
    const featured = list.filter(p => p.featured), rest = list.filter(p => !p.featured);
    let n = 0;
    featured.forEach(p => box.append(projectCard(p, n++, list.length, false)));
    for (let i = 0; i < rest.length; i += 2) box.append(h('div', { class: 'projects__row' }, rest.slice(i, i + 2).map(p => projectCard(p, n++, list.length, true))));
    if (!window.ProjectVisuals) return;
    sims.forEach(({ canvas, ctrl, visual }) => {
      const sim = window.ProjectVisuals.mount(canvas, visual, { autoplay: !reduceMotion });
      const sync = () => {
        const on = sim.isPlaying();
        ctrl.replaceChildren(icon(on ? ICONS.pause : ICONS.play), on ? 'Pause' : 'Play');
        ctrl.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' animation');
      };
      ctrl.addEventListener('click', () => { sim.isPlaying() ? sim.pause() : sim.play(); sync(); });
      sync();
    });
  }

  function renderSkills(list = []) {
    const box = $('#skills-list'); box.replaceChildren();
    list.forEach((g, i) => box.append(
      h('article', { class: 'skill reveal', style: `--d:${i * 0.06}s` },
        h('span', { class: 'skill__icon' }, icon(ICONS[g.icon] || ICONS.chip)),
        h('h3', { class: 'skill__title', text: g.group }),
        h('ul', { class: 'skill__list' }, (g.items || []).map(t => h('li', { text: t }))))));
  }

  function renderEducation(list = []) {
    const box = $('#edu-list'); box.replaceChildren();
    list.forEach((e, i) => box.append(
      h('li', { class: 'reveal', style: `--d:${i * 0.06}s` },
        h('span', { class: 'edu__when', text: e.period }),
        h('h4', { class: 'edu__degree', text: e.degree }),
        h('div', null, h('span', { class: 'edu__school', text: e.school }), e.grade ? h('span', { class: 'grade', text: e.grade }) : null),
        e.notes ? h('p', { class: 'edu__notes', text: e.notes }) : null)));
  }

  function renderLeadership(list = []) {
    const box = $('#lead-list'); box.replaceChildren();
    list.forEach((l, i) => box.append(
      h('li', { class: 'reveal', style: `--d:${i * 0.05}s` },
        h('span', { class: 'lead__num', text: String(i + 1).padStart(2, '0') }),
        h('div', null,
          h('span', { class: 'lead__when', text: l.period }),
          h('h4', { class: 'lead__title', text: l.title }),
          h('div', { class: 'lead__org', text: l.org }),
          l.description ? h('p', { class: 'lead__desc', text: l.description }) : null))));
  }

  function linkedInEmbedUrl(url) {
    const m = String(url || '').match(/(urn:li:(?:activity|share|ugcPost):\d+)|activity[-:](\d{10,})|ugcPost[-:](\d{10,})|share[-:](\d{10,})/);
    if (!m) return '';
    if (m[1]) return 'https://www.linkedin.com/embed/feed/update/' + m[1];
    if (m[2]) return 'https://www.linkedin.com/embed/feed/update/urn:li:activity:' + m[2];
    if (m[3]) return 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:' + m[3];
    return 'https://www.linkedin.com/embed/feed/update/urn:li:share:' + m[4];
  }
  const parseDate = d => { const t = Date.parse(d); return isNaN(t) ? null : new Date(t); };
  const fmtDate = d => { const x = parseDate(d); return x ? x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (d || ''); };

  function renderUpdates(feed) {
    const box = $('#updates-list'); box.replaceChildren();
    const posts = (feed.posts || []).slice().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 9);
    if (!posts.length) { box.append(h('div', { class: 'updates__empty', text: 'New LinkedIn posts will appear here automatically.' })); return; }
    posts.forEach((p, i) => {
      const isLi = p.source === 'linkedin' || /linkedin\.com/.test(p.url || '');
      const url = safeUrl(p.url);
      const embed = isLi && !p.text && !p.image ? linkedInEmbedUrl(p.url) : '';
      const card = h('article', { class: 'post reveal', style: `--d:${(i % 3) * 0.07}s` });
      if (embed) { card.append(h('iframe', { class: 'post__embed', src: embed, title: 'LinkedIn post', loading: 'lazy', allowfullscreen: true })); box.append(card); return; }
      if (p.image) card.append(h('div', { class: 'post__media' }, h('img', { src: src(p.image), alt: '', loading: 'lazy' })));
      else {
        const d = parseDate(p.date);
        card.append(h('div', { class: 'post__media post__art', 'aria-hidden': 'true' },
          h('span', { text: d ? d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() + ' ' + d.getFullYear() : 'NEWS' }),
          h('small', { text: isLi ? 'LINKEDIN' : 'UPDATE' })));
      }
      card.append(h('div', { class: 'post__body' },
        h('div', { class: 'post__meta' },
          h('span', { class: 'post__src' + (isLi ? ' post__src--li' : '') }, isLi ? icon(['F:M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z']) : null, isLi ? 'LinkedIn' : 'Update'),
          h('time', { datetime: p.date || '', text: fmtDate(p.date) })),
        p.text ? h('p', { class: 'post__text', text: p.text }) : null,
        url ? h('a', { class: 'post__link', href: url, target: '_blank', rel: 'noopener' }, isLi ? 'Read on LinkedIn' : 'Read more', icon(ICONS.arrow)) : null));
      box.append(card);
    });
  }

  let galleryItems = [];
  function renderGallery(list = []) {
    const box = $('#gallery-list'); box.replaceChildren();
    galleryItems = list.filter(g => g.image);
    if (!galleryItems.length) { $('#gallery').hidden = true; return; }
    galleryItems.forEach((g, i) => {
      const img = h('img', { src: src(g.image), alt: g.caption || '', loading: 'lazy', decoding: 'async' });
      applyFocus(img, g.focus);
      box.append(h('button', { class: 'shot reveal', type: 'button', style: `--d:${(i % 4) * 0.05}s`, 'aria-label': 'Open image: ' + (g.caption || 'photo'), onclick: () => openLightbox(i) },
        img, g.caption ? h('figcaption', { text: g.caption }) : null));
    });
    const fit = () => {
      const shots = $$('.shot', box); if (!shots.length) return;
      const cols = getComputedStyle(box).gridTemplateColumns.split(' ').length;
      shots.forEach(s => (s.style.gridColumn = ''));
      const cells = (shots.length > 1 ? 4 : 1) + Math.max(0, shots.length - 1);
      const rem = cells % cols;
      if (rem && shots.length > 1) shots[shots.length - 1].style.gridColumn = `span ${cols - rem + 1}`;
    };
    fit(); new ResizeObserver(fit).observe(box);
  }

  function renderContact(p) {
    const ctas = $('#contact-ctas'); ctas.replaceChildren();
    const wa = (p.socials || []).find(s => s.platform === 'whatsapp' && safeUrl(s.url));
    if (p.email) ctas.append(h('a', { class: 'btn btn--white', href: 'mailto:' + p.email }, icon(ICONS.mail), h('span', { text: 'Email me' })));
    if (wa) ctas.append(h('a', { class: 'btn btn--wa', href: safeUrl(wa.url), target: '_blank', rel: 'noopener' }, icon(SOCIAL.whatsapp.icon), h('span', { text: 'WhatsApp' })));
    if (p.resume) ctas.append(h('a', { class: 'btn btn--ghost-inv', href: src(p.resume), target: '_blank', rel: 'noopener' }, icon(ICONS.download), h('span', { text: 'Download CV' })));

    const box = $('#contact-links'); box.replaceChildren();
    const rows = [];
    if (p.email) rows.push([ICONS.mail, 'Email', p.email, 'mailto:' + p.email]);
    if (p.phone) rows.push([ICONS.phone, 'Phone', p.phone, 'tel:' + p.phone.replace(/[^\d+]/g, '')]);
    socialsOf(p).forEach(s => { const m = SOCIAL[s.platform] || SOCIAL.website; rows.push([m.icon, m.name, s.label || s.url.replace(/^https?:\/\/(www\.)?/, ''), s.url]); });
    if (!socialsOf(p).some(s => s.platform === 'linkedin') && p.linkedin) rows.push([SOCIAL.linkedin.icon, 'LinkedIn', p.linkedin.replace(/^https?:\/\/(www\.)?/, ''), p.linkedin]);
    if (p.location) rows.push([ICONS.pin, 'Based in', p.location, '']);
    rows.forEach(([ic, label, text, href]) => {
      const u = href ? safeUrl(href) : '';
      const inner = [h('span', { class: 'ic' }, icon(ic)), h('small', { text: label }), h('span', { class: 'v', text }), u ? icon(ICONS.arrow) : h('i')];
      box.append(h('li', null, u ? h('a', { class: 'contact__row', href: u, target: isExternal(u) ? '_blank' : null, rel: isExternal(u) ? 'noopener' : null, 'aria-label': `${label}: ${text}` }, inner) : h('div', { class: 'contact__row' }, inner)));
    });
  }

  /** Keep the search-engine profile (JSON-LD) in sync with the editable content. */
  function updateStructuredData(site) {
    const el = $('#ld-person'); if (!el) return;
    const p = site.profile || {}, base = (site.meta && site.meta.siteUrl) || location.href.split(/[?#]/)[0];
    const abs = u => { try { return new URL(u, base).href; } catch { return u; } };
    const sameAs = [p.linkedin, p.github, ...socialsOf(p).filter(s => !['whatsapp', 'email'].includes(s.platform)).map(s => s.url)].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
    const data = {
      '@context': 'https://schema.org', '@type': 'Person',
      name: p.name, alternateName: p.shortName, jobTitle: p.headline || p.eyebrow, description: (site.meta || {}).description,
      url: base, image: p.photo ? abs(p.photo) : undefined, email: p.email ? 'mailto:' + p.email : undefined,
      address: p.location ? { '@type': 'PostalAddress', addressLocality: p.location } : undefined,
      alumniOf: (site.education || []).map(e => ({ '@type': 'EducationalOrganization', name: e.school })),
      knowsAbout: (site.skills || []).filter(g => g.icon !== 'globe').flatMap(g => g.items || []).slice(0, 20),
      sameAs
    };
    try { el.textContent = JSON.stringify(data); } catch (e) { /* keep static fallback */ }
  }

  /* ---------- lightbox ---------- */
  const lb = $('.lightbox');
  let lbIndex = 0, lastFocus = null;
  function showLb(i) {
    lbIndex = (i + galleryItems.length) % galleryItems.length;
    const g = galleryItems[lbIndex];
    $('img', lb).src = src(g.image); $('img', lb).alt = g.caption || '';
    $('figcaption', lb).textContent = [g.caption, g.date].filter(Boolean).join(' · ');
  }
  function openLightbox(i) { lastFocus = document.activeElement; showLb(i); lb.hidden = false; requestAnimationFrame(() => lb.classList.add('is-open')); $('.lightbox__close', lb).focus(); document.body.style.overflow = 'hidden'; }
  function closeLightbox() { lb.classList.remove('is-open'); setTimeout(() => { lb.hidden = true; }, 200); document.body.style.overflow = ''; lastFocus && lastFocus.focus(); }
  $('.lightbox__close', lb).addEventListener('click', closeLightbox);
  $('.lightbox__prev', lb).addEventListener('click', () => showLb(lbIndex - 1));
  $('.lightbox__next', lb).addEventListener('click', () => showLb(lbIndex + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
    if (e.key === 'Tab') {
      const f = $$('button', lb), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- motion ---------- */
  function heroSpotlight() {
    if (reduceMotion || !finePointer) return;
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', (e.clientX - r.left) + 'px'); hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', '-999px'); hero.style.setProperty('--my', '-999px'); });
  }
  function reveals() {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      $$('[data-count]', e.target).forEach(countUp);
      if (e.target.matches('[data-count]')) countUp(e.target);
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  }
  function countUp(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    const target = parseFloat(el.dataset.count) || 0, suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const dur = 1200, t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function scrollFx() {
    const bar = $('.progress span'), fill = $('.timeline__rail span'), tl = $('#timeline');
    const links = $$('.nav__links a'), sections = $$('main section[data-index]');
    let ticking = false, current;
    function update() {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (tl && fill) { const r = tl.getBoundingClientRect(); fill.style.transform = `scaleY(${Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height))})`; }
      let cur = null;
      for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s;
      if (cur !== current) { current = cur; links.forEach(a => a.setAttribute('aria-current', String(!!cur && a.getAttribute('href') === '#' + cur.id))); }
    }
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }
  function navMenu() {
    const nav = $('.nav'), btn = $('.nav__toggle');
    const set = open => { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
    btn.addEventListener('click', () => set(!nav.classList.contains('is-open')));
    $$('.nav__links a').forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); } });
  }

  /* ---------- init ---------- */
  async function init() {
    navMenu();
    let data;
    try { data = await loadData(); }
    catch (err) {
      console.error(err);
      document.body.append(h('p', { class: 'preview-banner', text: 'Could not load content — open this site through a web server (GitHub Pages).' }));
      $$('.reveal').forEach(el => el.classList.add('is-in'));
      return;
    }
    const { site, feed } = data, p = site.profile || {};
    bindSimple(site);
    renderHero(site);
    renderStats(site.stats);
    renderAbout(site);
    renderExperience(site.experience);
    renderProjects(site.projects);
    renderSkills(site.skills);
    renderEducation(site.education);
    renderLeadership(site.leadership);
    renderUpdates(feed);
    renderGallery(site.gallery);
    renderContact(p);
    updateStructuredData(site);
    if (PREVIEW) document.body.append(h('div', { class: 'preview-banner', text: 'PREVIEW · unsaved changes from the editor' }));
    heroSpotlight();
    scrollFx();
    reveals();
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-ready')));
  }
  init();
})();
