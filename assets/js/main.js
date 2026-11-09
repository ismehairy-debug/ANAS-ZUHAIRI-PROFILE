/* =========================================================
   Anas Zuhairi — Portfolio runtime (v2)
   Loads data/site.json + data/linkedin.json and renders the page.
   All user/feed text is inserted with textContent (never innerHTML).
   Motion: entrance reveals that settle, pointer-driven effects,
   no decorative infinite loops; everything honours reduced motion.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const svgNS = 'http://www.w3.org/2000/svg';

  /* ---------- DOM helpers ---------- */
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
    linkedin: ['F:M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z'],
    arrow: ['M7 17L17 7M9 7h8v8'],
    play: ['F:M8 5.5v13l11-6.5z'],
    pause: ['F:M7 5h4v14H7zM13 5h4v14h-4z']
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
      } catch (e) { /* fall back to published data */ }
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

  /* ---------- renderers ---------- */
  function bindSimple(site) {
    const p = site.profile || {};
    const words = String(p.shortName || p.name || '').trim().split(/\s+/);
    p.firstLine = words.length > 1 ? words.slice(0, -1).join(' ') : words[0] || '';
    p.secondLine = words.length > 1 ? words[words.length - 1] : '';
    $$('[data-bind]').forEach(el => {
      const v = get(site, el.dataset.bind);
      if (typeof v === 'string' && v) el.textContent = v;
      else if (el.dataset.bind === 'profile.secondLine') el.closest('.line').hidden = true;
    });
    $$('[data-href]').forEach(el => { const v = safeUrl(get(site, el.dataset.href)); if (v) el.href = v; else el.hidden = true; });
    const m = site.meta || {};
    if (m.title) document.title = m.title;
    if (m.description) { const d = $('meta[name="description"]'); d && d.setAttribute('content', m.description); }
    $('#year').textContent = new Date().getFullYear();
    const cv = $('#nav-cv');
    if (p.resume) {
      cv.href = src(p.resume); cv.target = '_blank'; cv.rel = 'noopener';
    } else {
      cv.querySelector('span').textContent = 'Contact';
    }
  }

  function renderHero(p) {
    const cell = $('#photo-cell'), img = $('.photo', cell);
    if (p.photo) {
      img.src = src(p.photo); img.alt = `Photo of ${p.shortName || p.name || ''}`; img.hidden = false;
      cell.classList.add('has-photo');
    }
    if (p.photoCaption) { $('.photo__cap', cell).textContent = p.photoCaption; cell.classList.add('has-caption'); }
    const roles = $('#roles'); roles.replaceChildren();
    (p.roles || []).forEach(r => roles.append(h('li', { text: r })));
  }

  function renderStats(stats = []) {
    const box = $('#stats'); box.replaceChildren();
    stats.forEach((s, i) => box.append(
      h('div', { class: 'cell stat reveal', style: `--d:${0.35 + i * 0.07}s` },
        h('div', { class: 'stat__value', 'data-count': s.value, 'data-suffix': s.suffix || '', text: '0' + (s.suffix || '') }),
        h('div', { class: 'stat__label', text: s.label }))));
    if (!stats.length) box.hidden = true;
  }

  function renderAbout(p) {
    const t = $('#about-text'); t.replaceChildren();
    (Array.isArray(p.summary) ? p.summary : String(p.summary || '').split(/\n\s*\n/)).filter(Boolean).forEach(par => t.append(h('p', { text: par })));
    const f = $('#about-facts'); f.replaceChildren();
    (p.facts || []).forEach(x => f.append(h('div', { class: 'fact' }, h('dt', { text: x.label }), h('dd', { text: x.value }))));
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
    if (visual === 'image' && p.image) {
      media = h('div', { class: 'project__media' }, h('img', { src: src(p.image), alt: `${p.title} — preview`, loading: 'lazy', decoding: 'async' }));
    } else if (['aurewas', 'vision', 'database'].includes(visual) && window.ProjectVisuals) {
      const canvas = h('canvas', { class: 'sim', role: 'img', 'aria-label': `${p.title}: animated diagram of how the system works` });
      const ctrl = h('button', { class: 'sim-ctrl', type: 'button', 'aria-pressed': 'false' });
      media = h('div', { class: 'project__media' }, canvas, ctrl,
        visual === 'aurewas' ? h('span', { class: 'sim-label', text: 'Live PLC logic · top-down' }) : null);
      sims.push({ canvas, ctrl, visual });
    } else if (p.image) {
      media = h('div', { class: 'project__media' }, h('img', { src: src(p.image), alt: `${p.title} — preview`, loading: 'lazy' }));
    }
    if (media && p.status) media.append(h('span', { class: 'badge' + (/progress/i.test(p.status) ? ' badge--progress' : ''), text: p.status }));

    const links = (p.links || []).filter(l => safeUrl(l.url)).map((l, k) =>
      h('a', { class: 'btn btn--sm ' + (k === 0 ? 'btn--accent' : 'btn--line'), href: safeUrl(l.url), target: '_blank', rel: 'noopener' },
        h('span', { text: l.label || 'Open' }), icon(ICONS.arrow)));

    const body = h('div', { class: 'project__body' },
      h('div', { class: 'project__num' }, h('span', { text: `P/${String(i + 1).padStart(2, '0')}` }), h('span', { text: `${String(i + 1).padStart(2, '0')} — ${String(total).padStart(2, '0')}` })),
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
    sims.forEach(({ canvas, ctrl, visual }) => {
      const sim = window.ProjectVisuals.mount(canvas, visual, { autoplay: !reduceMotion });
      const sync = () => {
        const on = sim.isPlaying();
        ctrl.replaceChildren(icon(on ? ICONS.pause : ICONS.play), on ? 'Pause' : 'Play');
        ctrl.setAttribute('aria-pressed', String(!on));
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
          h('span', { class: 'post__src' + (isLi ? ' post__src--li' : '') }, isLi ? icon(ICONS.linkedin) : null, isLi ? 'LinkedIn' : 'Update'),
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
    galleryItems.forEach((g, i) => box.append(
      h('button', { class: 'shot reveal', type: 'button', style: `--d:${(i % 4) * 0.05}s`, 'aria-label': 'Open image: ' + (g.caption || 'photo'), onclick: () => openLightbox(i) },
        h('img', { src: src(g.image), alt: g.caption || '', loading: 'lazy', decoding: 'async' }),
        g.caption ? h('figcaption', { text: g.caption }) : null)));
    // Stretch the last photo so the bento grid never ends with an empty gap.
    const fit = () => {
      const shots = $$('.shot', box); if (!shots.length) return;
      const cols = getComputedStyle(box).gridTemplateColumns.split(' ').length;
      shots.forEach(s => (s.style.gridColumn = ''));
      const cells = (shots.length > 1 ? 4 : 1) + Math.max(0, shots.length - 1);
      const rem = cells % cols;
      if (rem && shots.length > 1) shots[shots.length - 1].style.gridColumn = `span ${cols - rem + 1}`;
    };
    fit();
    new ResizeObserver(fit).observe(box);
  }

  function renderContact(p) {
    const box = $('#contact-links'); box.replaceChildren();
    const rows = [];
    if (p.email) rows.push(['Email', p.email, 'mailto:' + p.email]);
    if (p.phone) rows.push(['Phone', p.phone, 'tel:' + p.phone.replace(/[^\d+]/g, '')]);
    if (p.linkedin) rows.push(['LinkedIn', p.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), p.linkedin]);
    if (p.github) rows.push(['GitHub', p.github.replace(/^https?:\/\/(www\.)?/, ''), p.github]);
    if (p.resume) rows.push(['Résumé', 'Download CV (PDF)', src(p.resume)]);
    if (p.location) rows.push(['Based in', p.location, '']);
    rows.forEach(([label, text, href]) => {
      const u = href ? (href.startsWith('data:') ? href : safeUrl(href)) : '';
      const inner = [h('small', { text: label }), h('span', { text }), u ? icon(ICONS.arrow) : h('i')];
      const ext = u && !u.startsWith('mailto:') && !u.startsWith('tel:');
      box.append(h('li', null, u ? h('a', { class: 'contact__row', href: u, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, inner) : h('div', { class: 'contact__row' }, inner)));
    });
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
  function openLightbox(i) {
    lastFocus = document.activeElement; showLb(i); lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    $('.lightbox__close', lb).focus(); document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('is-open'); setTimeout(() => { lb.hidden = true; }, 220);
    document.body.style.overflow = ''; lastFocus && lastFocus.focus();
  }
  $('.lightbox__close', lb).addEventListener('click', closeLightbox);
  $('.lightbox__prev', lb).addEventListener('click', () => showLb(lbIndex - 1));
  $('.lightbox__next', lb).addEventListener('click', () => showLb(lbIndex + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $$('button', lb); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* =========================================================
     Motion
     ========================================================= */

  // Hero: PCB traces drawn once on load; pointer moves send a single
  // signal pulse along a nearby trace (interaction-driven, never looping).
  function heroTraces() {
    const hero = $('.hero'), svg = $('.hero__traces');
    const STEP = 48;
    let traces = [];
    function build() {
      const W = hero.clientWidth, H = hero.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.replaceChildren(); traces = [];
      const cols = Math.floor(W / STEP), rows = Math.floor(H / STEP);
      const count = Math.max(8, Math.round((cols * rows) / (W < 700 ? 22 : 14)));
      const used = new Set();
      for (let t = 0; t < count; t++) {
        let cx = Math.floor(Math.random() * cols), cy = Math.floor(Math.random() * rows);
        const pts = [[cx, cy]]; let dir = Math.floor(Math.random() * 4);
        const len = 3 + Math.floor(Math.random() * 6);
        for (let k = 0; k < len; k++) {
          if (Math.random() < 0.4) dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
          const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
          cx += dx; cy += dy;
          const key = cx + ',' + cy;
          if (used.has(key) || cx < 0 || cy < 0 || cx > cols || cy > rows) break;
          used.add(key); pts.push([cx, cy]);
        }
        if (pts.length < 3) continue;
        // chamfer the corners like PCB routing
        let d = `M${pts[0][0] * STEP} ${pts[0][1] * STEP}`;
        for (let i = 1; i < pts.length; i++) {
          const [x, y] = pts[i], nxt = pts[i + 1];
          if (nxt && (nxt[0] - x !== x - pts[i - 1][0] || nxt[1] - y !== y - pts[i - 1][1])) {
            const c = STEP * 0.35;
            const bx = x * STEP - Math.sign(x - pts[i - 1][0]) * c, by = y * STEP - Math.sign(y - pts[i - 1][1]) * c;
            const ax = x * STEP + Math.sign(nxt[0] - x) * c, ay = y * STEP + Math.sign(nxt[1] - y) * c;
            d += ` L${bx} ${by} L${ax} ${ay}`;
          } else d += ` L${x * STEP} ${y * STEP}`;
        }
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', d);
        path.style.transitionDelay = (0.2 + Math.random() * 0.8).toFixed(2) + 's';
        svg.append(path);
        const L = path.getTotalLength(); path.style.setProperty('--len', L.toFixed(1));
        const end = pts[pts.length - 1], start = pts[0];
        [start, end].forEach(([x, y]) => {
          const c = document.createElementNS(svgNS, 'circle');
          c.setAttribute('cx', x * STEP); c.setAttribute('cy', y * STEP); c.setAttribute('r', 3.5);
          c.style.transitionDelay = (1.2 + Math.random() * 0.6).toFixed(2) + 's';
          svg.append(c);
        });
        const pulse = document.createElementNS(svgNS, 'circle');
        pulse.setAttribute('r', 3); pulse.setAttribute('class', 'pulse');
        svg.append(pulse);
        traces.push({ path, L, pulse, busy: false, x: start[0] * STEP, y: start[1] * STEP });
      }
    }
    function fire(mx, my) {
      let best = null, bd = 260;
      for (const t of traces) { if (t.busy) continue; const d = Math.hypot(t.x - mx, t.y - my); if (d < bd) { bd = d; best = t; } }
      if (!best) return;
      best.busy = true;
      const t0 = performance.now(), dur = Math.min(1400, 300 + best.L * 2.2);
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 2);
        const pt = best.path.getPointAtLength(e * best.L);
        best.pulse.setAttribute('cx', pt.x); best.pulse.setAttribute('cy', pt.y);
        best.pulse.style.opacity = String(k < 0.85 ? 0.95 : (1 - k) / 0.15 * 0.95);
        if (k < 1) requestAnimationFrame(step); else { best.pulse.style.opacity = '0'; setTimeout(() => (best.busy = false), 600); }
      })(t0);
    }
    build();
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 200); }).observe(hero);
    if (reduceMotion || !finePointer) return;
    let last = 0;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      hero.style.setProperty('--mx', mx + 'px'); hero.style.setProperty('--my', my + 'px');
      const now = performance.now();
      if (now - last > 380) { last = now; fire(mx, my); }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', '-999px'); hero.style.setProperty('--my', '-999px'); });
  }

  function reveals() {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      $$('[data-count]', e.target).forEach(countUp);
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  }
  function countUp(el) {
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
    const bar = $('.progress span'), nav = $('.nav'), label = $('.brand__section');
    const fill = $('.timeline__rail span'), tl = $('#timeline');
    const links = $$('.nav__links a');
    const sections = $$('main section[data-index]');
    let ticking = false, current = null;
    function update() {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      nav.classList.toggle('is-scrolled', y > 8);
      if (tl && fill) {
        const r = tl.getBoundingClientRect();
        fill.style.transform = `scaleY(${Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height))})`;
      }
      let cur = null;
      for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s;
      if (cur !== current) {
        current = cur;
        const link = cur && links.find(a => a.getAttribute('href') === '#' + cur.id);
        label.textContent = cur ? `${cur.dataset.index} / ${link ? link.textContent : $('h2', cur).textContent}` : 'Portfolio';
        links.forEach(a => a.setAttribute('aria-current', String(!!cur && a.getAttribute('href') === '#' + cur.id)));
      }
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
      return;
    }
    const { site, feed } = data;
    const p = site.profile || {};
    bindSimple(site);
    renderHero(p);
    renderStats(site.stats);
    renderAbout(p);
    renderExperience(site.experience);
    renderProjects(site.projects);
    renderSkills(site.skills);
    renderEducation(site.education);
    renderLeadership(site.leadership);
    renderUpdates(feed);
    renderGallery(site.gallery);
    renderContact(p);
    if (PREVIEW) document.body.append(h('div', { class: 'preview-banner', text: 'PREVIEW · unsaved changes from the editor' }));
    heroTraces();
    scrollFx();
    reveals();
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-ready')));
  }
  init();
})();
