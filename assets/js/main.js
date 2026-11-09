/* =========================================================
   Anas Zuhairi — Portfolio runtime
   Loads data/site.json + data/linkedin.json and renders the page.
   All user/feed text is inserted with textContent (never innerHTML).
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');

  /* ---------- tiny DOM builder ---------- */
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
  const svgNS = 'http://www.w3.org/2000/svg';
  function icon(paths, cls) {
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
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
    code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6', 'M14 4l-4 16'],
    globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z'],
    mail: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3 7l9 6 9-6'],
    linkedin: ['F:M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z'],
    github: ['F:M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z'],
    pin: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'],
    doc: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5M9 13h6M9 17h6'],
    arrow: ['M7 17L17 7M9 7h8v8']
  };

  /* ---------- data loading ---------- */
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
        if (draft && draft.site) {
          previewImages = draft.images || {};
          return { site: draft.site, feed: draft.feed || { posts: [] } };
        }
      } catch (e) { /* fall through */ }
    }
    const [site, feed] = await Promise.all([
      getJSON('data/site.json'),
      getJSON('data/linkedin.json').catch(() => ({ posts: [] }))
    ]);
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
    $$('[data-bind]').forEach(el => {
      const v = get(site, el.dataset.bind);
      if (typeof v === 'string' && v) el.textContent = v;
    });
    $$('[data-href]').forEach(el => {
      const v = safeUrl(get(site, el.dataset.href));
      if (v) el.href = v; else el.hidden = true;
    });
    const m = site.meta || {};
    if (m.title) document.title = m.title;
    if (m.description) { const d = $('meta[name="description"]'); d && d.setAttribute('content', m.description); }
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }

  function renderHeroPhoto(p) {
    const img = $('.avatar__img');
    if (p.photo) {
      img.src = src(p.photo);
      img.alt = p.name || '';
      img.hidden = false;
      img.closest('.avatar').classList.add('has-photo');
    }
    // decorative ticks
    const g = $('.avatar__rings .ticks');
    if (g && !g.childNodes.length) {
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, r1 = 176, r2 = i % 5 === 0 ? 166 : 171;
        const l = document.createElementNS(svgNS, 'line');
        l.setAttribute('x1', 200 + Math.cos(a) * r1); l.setAttribute('y1', 200 + Math.sin(a) * r1);
        l.setAttribute('x2', 200 + Math.cos(a) * r2); l.setAttribute('y2', 200 + Math.sin(a) * r2);
        g.append(l);
      }
    }
  }

  function renderStats(stats = []) {
    const box = $('#stats'); box.replaceChildren();
    stats.forEach((s, i) => box.append(
      h('div', { class: 'stat reveal', style: `--d:${i * 0.08}s` },
        h('div', { class: 'stat__value', 'data-count': s.value, 'data-suffix': s.suffix || '', text: '0' + (s.suffix || '') }),
        h('div', { class: 'stat__label', text: s.label })
      )
    ));
    if (!stats.length) box.parentElement.hidden = true;
  }

  function renderAbout(p) {
    const t = $('#about-text'); t.replaceChildren();
    (Array.isArray(p.summary) ? p.summary : String(p.summary || '').split(/\n\s*\n/)).filter(Boolean)
      .forEach(par => t.append(h('p', { text: par })));
    const f = $('#about-facts'); f.replaceChildren();
    (p.facts || []).forEach(x => f.append(h('div', { class: 'fact' }, h('dt', { text: x.label }), h('dd', { text: x.value }))));
  }

  function renderExperience(list = []) {
    const tl = $('#timeline');
    $$('.job', tl).forEach(n => n.remove());
    list.forEach((j, i) => tl.append(
      h('li', { class: 'job reveal', style: `--d:${i * 0.05}s` },
        h('span', { class: 'job__node', 'aria-hidden': 'true' }),
        h('article', { class: 'card job__card' },
          h('div', { class: 'job__top' },
            h('h3', { class: 'job__role' }, j.role, ' · ', h('span', { class: 'job__company', text: j.company })),
            h('span', { class: 'job__period', text: j.period })
          ),
          h('p', { class: 'job__loc', text: j.location }),
          h('ul', null, (j.bullets || []).map(b => h('li', { text: b }))),
          (j.tags && j.tags.length) ? h('div', { class: 'tags' }, j.tags.map(t => h('span', { class: 'tag', text: t }))) : null
        )
      )
    ));
  }

  function projectCard(p, i, compact) {
    const media = h('div', { class: 'project__media' });
    const visual = p.visual || (p.image ? 'image' : 'none');
    if (p.image && (visual === 'image' || !window.ProjectVisuals)) {
      media.append(h('img', { src: src(p.image), alt: p.title + ' preview', loading: 'lazy', decoding: 'async' }));
    } else if (['aurewas', 'vision', 'database'].includes(visual)) {
      const c = h('canvas', { class: 'sim', 'aria-label': `${p.title} animated diagram`, role: 'img', 'data-visual': visual });
      media.append(c);
      if (visual === 'aurewas') media.append(h('div', { class: 'sim-legend', 'aria-hidden': 'true' }, h('span', { text: 'Live logic simulation' }), h('span', { text: 'Top-down view' })));
    } else if (p.image) {
      media.append(h('img', { src: src(p.image), alt: p.title + ' preview', loading: 'lazy' }));
    } else {
      media.hidden = true;
    }
    if (p.status) media.append(h('span', { class: 'badge badge-float' + (/progress/i.test(p.status) ? ' badge--progress' : ''), text: p.status }));

    const links = (p.links || []).filter(l => safeUrl(l.url)).map((l, k) =>
      h('a', { class: 'btn btn--sm ' + (k === 0 ? 'btn--primary' : 'btn--ghost') + ' magnetic', href: safeUrl(l.url), target: '_blank', rel: 'noopener' },
        h('span', { text: l.label || 'Open' }), icon(ICONS.arrow)));

    const body = h('div', { class: 'project__body' },
      p.context ? h('p', { class: 'project__context', text: p.context }) : null,
      h('h3', { class: 'project__title', text: p.title }),
      p.subtitle ? h('p', { class: 'project__subtitle', text: p.subtitle }) : null,
      p.summary ? h('p', { class: 'project__summary', text: p.summary }) : null,
      (p.highlights && p.highlights.length) ? h('ul', { class: 'project__list' }, p.highlights.map(x => h('li', { text: x }))) : null,
      (p.tags && p.tags.length) ? h('div', { class: 'tags' }, p.tags.map(t => h('span', { class: 'tag', text: t }))) : null,
      p.team ? h('p', { class: 'project__team', text: p.team }) : null,
      links.length ? h('div', { class: 'project__foot' }, links) : null
    );
    const cls = 'card project tilt reveal' + (compact ? ' project--compact' : '') + (!compact && i % 2 ? ' project--flip' : '');
    return h('article', { class: cls, id: p.id ? 'project-' + p.id : null }, media.hidden ? null : media, body, h('span', { class: 'glare', 'aria-hidden': 'true' }));
  }

  function renderProjects(list = []) {
    const box = $('#projects-list'); box.replaceChildren();
    const featured = list.filter(p => p.featured), rest = list.filter(p => !p.featured);
    featured.forEach((p, i) => box.append(projectCard(p, i, false)));
    for (let i = 0; i < rest.length; i += 2) {
      box.append(h('div', { class: 'projects__row' }, rest.slice(i, i + 2).map((p, k) => projectCard(p, k, true))));
    }
    $$('canvas[data-visual]', box).forEach(c => window.ProjectVisuals && window.ProjectVisuals.mount(c, c.dataset.visual));
  }

  function renderSkills(list = []) {
    const box = $('#skills-list'); box.replaceChildren();
    list.forEach((g, i) => box.append(
      h('article', { class: 'card skill reveal', style: `--d:${(i % 2) * 0.08}s` },
        h('div', { class: 'skill__head' },
          h('span', { class: 'skill__icon' }, icon(ICONS[g.icon] || ICONS.chip)),
          h('h3', { class: 'skill__title', text: g.group })
        ),
        h('div', { class: 'skill__items' }, (g.items || []).map((t, k) => h('span', { class: 'tag', style: `--i:${k}`, text: t })))
      )
    ));
  }

  function renderEducation(list = []) {
    const box = $('#edu-list'); box.replaceChildren();
    list.forEach((e, i) => box.append(
      h('article', { class: 'card edu__item reveal', style: `--d:${i * 0.07}s` },
        h('span', { class: 'edu__period', text: e.period }),
        h('h4', { class: 'edu__degree', text: e.degree }),
        h('div', null, h('span', { class: 'edu__school', text: e.school }), e.grade ? h('span', { class: 'edu__grade', text: e.grade }) : null),
        e.notes ? h('p', { class: 'edu__notes', text: e.notes }) : null
      )
    ));
  }

  function renderLeadership(list = []) {
    const box = $('#lead-list'); box.replaceChildren();
    list.forEach((l, i) => box.append(
      h('div', { class: 'lead__item' },
        h('span', { class: 'lead__num', text: String(i + 1).padStart(2, '0') }),
        h('div', null,
          h('h4', { class: 'lead__title' }, l.title, l.period ? h('span', { class: 'lead__period', text: '· ' + l.period }) : null),
          h('div', { class: 'lead__org', text: l.org }),
          l.description ? h('p', { class: 'lead__desc', text: l.description }) : null
        )
      )
    ));
    box.classList.add('reveal');
  }

  function linkedInEmbedUrl(url) {
    const m = String(url || '').match(/(urn:li:(?:activity|share|ugcPost):\d+)|activity[-:](\d{10,})|ugcPost[-:](\d{10,})|share[-:](\d{10,})/);
    if (!m) return '';
    if (m[1]) return 'https://www.linkedin.com/embed/feed/update/' + m[1];
    if (m[2]) return 'https://www.linkedin.com/embed/feed/update/urn:li:activity:' + m[2];
    if (m[3]) return 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:' + m[3];
    return 'https://www.linkedin.com/embed/feed/update/urn:li:share:' + m[4];
  }
  function fmtDate(d) {
    const t = Date.parse(d);
    return isNaN(t) ? (d || '') : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderUpdates(feed, profile) {
    const box = $('#updates-list'); box.replaceChildren();
    const posts = (feed.posts || []).slice().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 9);
    if (!posts.length) {
      box.append(h('div', { class: 'card updates__empty', text: 'New LinkedIn posts will appear here automatically.' }));
      return;
    }
    posts.forEach((p, i) => {
      const isLi = p.source === 'linkedin' || /linkedin\.com/.test(p.url || '');
      const url = safeUrl(p.url);
      const embed = isLi && !p.text && !p.image ? linkedInEmbedUrl(p.url) : '';
      const card = h('article', { class: 'card post reveal', style: `--d:${(i % 3) * 0.08}s` });
      if (embed) {
        card.append(h('iframe', { class: 'post__embed', src: embed, title: 'LinkedIn post', loading: 'lazy', allowfullscreen: true }));
      } else {
        if (p.image) card.append(h('div', { class: 'post__img' }, h('img', { src: src(p.image), alt: '', loading: 'lazy' })));
        else {
          const t = Date.parse(p.date);
          const d = isNaN(t) ? null : new Date(t);
          card.append(h('div', { class: 'post__img post__art', 'aria-hidden': 'true' },
            h('span', { text: d ? d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() + ' ' + d.getFullYear() : 'NEWS' }),
            h('small', { text: isLi ? '// LINKEDIN POST' : '// UPDATE' })));
        }
        card.append(h('div', { class: 'post__body' },
          h('div', { class: 'post__meta' },
            h('span', { class: 'post__src' + (isLi ? ' post__src--li' : '') }, isLi ? icon(ICONS.linkedin) : null, isLi ? 'LinkedIn' : 'Update'),
            h('time', { datetime: p.date || '', text: fmtDate(p.date) })
          ),
          p.text ? h('p', { class: 'post__text', text: p.text }) : null,
          url ? h('a', { class: 'post__link', href: url, target: '_blank', rel: 'noopener' }, isLi ? 'Read on LinkedIn' : 'Read more', icon(ICONS.arrow)) : null
        ));
      }
      box.append(card);
    });
  }

  let galleryItems = [];
  function renderGallery(list = []) {
    const box = $('#gallery-list'); box.replaceChildren();
    galleryItems = list.filter(g => g.image);
    if (!galleryItems.length) { $('#gallery').hidden = true; return; }
    galleryItems.forEach((g, i) => box.append(
      h('button', { class: 'shot reveal', type: 'button', style: `--d:${(i % 3) * 0.06}s`, 'aria-label': 'Open image: ' + (g.caption || 'photo'), onclick: () => openLightbox(i) },
        h('img', { src: src(g.image), alt: g.caption || '', loading: 'lazy', decoding: 'async' }),
        g.caption ? h('figcaption', { text: g.caption }) : null
      )
    ));
  }

  function renderContact(p) {
    const box = $('#contact-links'); box.replaceChildren();
    const items = [];
    if (p.email) items.push(['mail', 'Email', p.email, 'mailto:' + p.email]);
    if (p.linkedin) items.push(['linkedin', 'LinkedIn', p.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), p.linkedin]);
    if (p.phone) items.push(['phone', 'Phone', p.phone, 'tel:' + p.phone.replace(/[^\d+]/g, '')]);
    if (p.github) items.push(['github', 'GitHub', p.github.replace(/^https?:\/\/(www\.)?/, ''), p.github]);
    if (p.resume) items.push(['doc', 'Résumé', 'Download CV', src(p.resume)]);
    if (p.location) items.push(['pin', 'Based in', p.location, '']);
    items.forEach(([ic, label, text, href]) => {
      const u = href ? (href.startsWith('data:') ? href : safeUrl(href)) : '';
      const inner = [icon(ICONS[ic]), h('div', null, h('small', { text: label }), h('span', { text }))];
      box.append(u ? h('a', { class: 'contact__link', href: u, target: u.startsWith('mailto:') || u.startsWith('tel:') ? null : '_blank', rel: 'noopener' }, inner)
                   : h('div', { class: 'contact__link' }, inner));
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
    lastFocus = document.activeElement;
    showLb(i); lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    $('.lightbox__close', lb).focus();
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('is-open');
    setTimeout(() => { lb.hidden = true; }, 250);
    document.body.style.overflow = '';
    lastFocus && lastFocus.focus();
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
  });

  /* =========================================================
     Animations
     ========================================================= */

  // Split hero title into characters (last word gets the gradient)
  function splitTitle() {
    $$('.split').forEach(el => {
      const text = el.textContent.trim();
      const words = text.split(/\s+/);
      el.replaceChildren();
      el.setAttribute('aria-label', text);
      let n = 0;
      words.forEach((w, wi) => {
        const accent = wi === words.length - 1 && words.length > 1;
        [...w].forEach(ch => {
          const s = h('span', { class: 'char' + (accent ? ' char--accent' : ''), 'aria-hidden': 'true', text: ch });
          s.style.transitionDelay = (0.15 + n++ * 0.035) + 's';
          el.append(s);
        });
        if (wi < words.length - 1) el.append(h('span', { class: 'char space', 'aria-hidden': 'true', text: ' ' }));
      });
    });
  }

  // Typewriter for roles
  function typer(roles) {
    const el = $('.typer'); if (!el || !roles || !roles.length) return;
    if (reduceMotion) { el.textContent = roles[0]; return; }
    let r = 0, i = 0, del = false;
    (function tick() {
      const word = roles[r];
      i += del ? -1 : 1;
      el.textContent = word.slice(0, i);
      let wait = del ? 28 : 55 + Math.random() * 40;
      if (!del && i === word.length) { del = true; wait = 1900; }
      else if (del && i === 0) { del = false; r = (r + 1) % roles.length; wait = 350; }
      setTimeout(tick, wait);
    })();
  }

  // Hero canvas: PCB traces with travelling signal pulses
  function heroCanvas() {
    const canvas = $('.hero__canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, dpr, traces = [], pulses = [], nodes = [], raf = 0, running = false;
    const mouse = { x: -9999, y: -9999 };
    const STEP = 44;

    function build() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traces = []; nodes = []; pulses = [];
      const cols = Math.ceil(W / STEP) + 1, rows = Math.ceil(H / STEP) + 1;
      const count = Math.round((cols * rows) / (W < 700 ? 9 : 6.5));
      const used = new Set();
      for (let t = 0; t < count; t++) {
        let cx = Math.floor(Math.random() * cols), cy = Math.floor(Math.random() * rows);
        const pts = [[cx * STEP, cy * STEP]];
        let dir = Math.floor(Math.random() * 4);
        const len = 3 + Math.floor(Math.random() * 7);
        for (let k = 0; k < len; k++) {
          if (Math.random() < 0.35) dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
          const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
          const diag = Math.random() < 0.25;
          cx += dx + (diag ? (dy ? (Math.random() < .5 ? 1 : -1) : 0) : 0);
          cy += dy + (diag ? (dx ? (Math.random() < .5 ? 1 : -1) : 0) : 0);
          const key = cx + ',' + cy;
          if (used.has(key) || cx < -1 || cy < -1 || cx > cols + 1 || cy > rows + 1) break;
          used.add(key);
          pts.push([cx * STEP, cy * STEP]);
        }
        if (pts.length > 2) {
          let L = 0; const seg = [];
          for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
          traces.push({ pts, seg, L, a: 0.10 + Math.random() * 0.14 });
          nodes.push({ x: pts[0][0], y: pts[0][1] }, { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
        }
      }
      for (let i = 0; i < Math.min(26, traces.length); i++) spawnPulse(Math.random());
    }
    function spawnPulse(p0) {
      const tr = traces[Math.floor(Math.random() * traces.length)];
      if (!tr) return;
      pulses.push({ tr, p: p0 || 0, v: 70 + Math.random() * 110, hue: Math.random() < 0.7 ? 0 : 1 });
    }
    function pointAt(tr, d) {
      for (let i = 0; i < tr.seg.length; i++) {
        if (d <= tr.seg[i]) {
          const f = d / tr.seg[i], a = tr.pts[i], b = tr.pts[i + 1];
          return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        }
        d -= tr.seg[i];
      }
      return tr.pts[tr.pts.length - 1];
    }
    let last = 0;
    function frame(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      ctx.clearRect(0, 0, W, H);
      // traces
      ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
      for (const tr of traces) {
        ctx.strokeStyle = `rgba(10, 92, 255, ${tr.a})`;
        ctx.beginPath(); ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
        for (let i = 1; i < tr.pts.length; i++) ctx.lineTo(tr.pts[i][0], tr.pts[i][1]);
        ctx.stroke();
      }
      // nodes (pads), glow near mouse
      for (const n of nodes) {
        const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const k = Math.max(0, 1 - d / 180);
        ctx.beginPath(); ctx.arc(n.x, n.y, 2.6 + k * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,1)`; ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(10, 92, 255, ${0.28 + k * 0.6})`; ctx.stroke();
        if (k > 0.05) { ctx.beginPath(); ctx.arc(n.x, n.y, 8 + k * 10, 0, Math.PI * 2); ctx.fillStyle = `rgba(0, 184, 255, ${k * 0.10})`; ctx.fill(); }
      }
      // pulses
      for (const p of pulses) {
        p.p += (p.v * dt) / p.tr.L;
        const head = p.p * p.tr.L;
        const col = p.hue ? '0, 184, 255' : '10, 92, 255';
        for (let k = 0; k < 10; k++) {
          const d = head - k * 5;
          if (d < 0 || d > p.tr.L) continue;
          const [x, y] = pointAt(p.tr, d);
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, 2.4 - k * 0.2), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${col}, ${(1 - k / 10) * 0.9})`; ctx.fill();
        }
      }
      pulses = pulses.filter(p => p.p < 1.15);
      while (pulses.length < Math.min(26, traces.length)) spawnPulse(0);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running && !reduceMotion) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    build();
    if (reduceMotion) { frame(0); cancelAnimationFrame(raf); }
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduceMotion) { frame(0); cancelAnimationFrame(raf); } }, 150); });
    canvas.parentElement.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    canvas.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(es => (es[0].isIntersecting && !document.hidden) ? start() : stop()).observe(canvas);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  }

  // Reveal on scroll + counters
  function reveals() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        $$('[data-count]', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal, .skill, .stat').forEach(el => io.observe(el));
  }
  function countUp(el) {
    const target = parseFloat(el.dataset.count) || 0, suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const dur = 1600, t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(target * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  // Scroll-linked: progress bar, nav state, timeline fill, parallax, active link
  function scrollFx() {
    const bar = $('.scroll-progress span'), nav = $('.nav'), fill = $('.timeline__fill'), tl = $('#timeline');
    const links = $$('.nav__links a[href^="#"]');
    const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    let lastY = window.scrollY, ticking = false;
    function update() {
      ticking = false;
      const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      nav.classList.toggle('is-scrolled', y > 20);
      if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > 400 && y > lastY + 4);
      if (y < lastY - 4) nav.classList.remove('is-hidden');
      lastY = y;
      if (tl && fill) {
        const r = tl.getBoundingClientRect();
        const k = Math.min(1, Math.max(0, (innerHeight * 0.65 - r.top) / r.height));
        fill.style.transform = `scaleY(${k})`;
      }
      if (!reduceMotion) $$('.project__media img').forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        img.style.setProperty('--py', (-k * 30).toFixed(1) + 'px');
      });
      let current = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.35) current = s;
      links.forEach(a => a.classList.toggle('is-active', current && a.getAttribute('href') === '#' + current.id && y > 200));
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Mobile nav
  function navMenu() {
    const nav = $('.nav'), btn = $('.nav__toggle');
    btn.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('.nav__links a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }));
  }

  // Pointer effects: cursor glow, magnetic buttons, card tilt
  function pointerFx() {
    if (!finePointer || reduceMotion) return;
    document.body.classList.add('has-pointer');
    const glow = $('.cursor-glow');
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener('pointermove', e => {
      const m = e.target.closest && e.target.closest('.magnetic');
      $$('.magnetic.is-mag').forEach(b => { if (b !== m) { b.classList.remove('is-mag'); b.style.setProperty('--x', '0px'); b.style.setProperty('--y', '0px'); } });
      if (m) {
        const r = m.getBoundingClientRect();
        m.classList.add('is-mag');
        m.style.setProperty('--x', ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px');
        m.style.setProperty('--y', ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px');
      }
      const t = e.target.closest && e.target.closest('.tilt');
      $$('.tilt.is-tilt').forEach(c => { if (c !== t) { c.classList.remove('is-tilt'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
      if (t && innerWidth > 900) {
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        t.classList.add('is-tilt');
        t.style.setProperty('--rx', ((0.5 - py) * 3).toFixed(2) + 'deg');
        t.style.setProperty('--ry', ((px - 0.5) * 4).toFixed(2) + 'deg');
        t.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        t.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      }
    }, { passive: true });
  }

  // Boot loader
  function boot(done) {
    const el = $('.boot'), bar = $('.boot__bar span'), log = $('.boot__log');
    if (reduceMotion || sessionStorage.getItem('az-booted')) { el.classList.add('is-done'); done(); return; }
    const steps = ['INITIALISING SYSTEM', 'LOADING PLC MODULES', 'CALIBRATING VISION', 'SYSTEM READY'];
    let i = 0;
    const iv = setInterval(() => {
      i++;
      bar.style.width = Math.min(100, i * 25) + '%';
      log.textContent = steps[Math.min(i, steps.length - 1)];
      if (i >= 4) {
        clearInterval(iv);
        setTimeout(() => { el.classList.add('is-done'); try { sessionStorage.setItem('az-booted', '1'); } catch (e) {} done(); }, 220);
      }
    }, 170);
  }

  /* ---------- init ---------- */
  async function init() {
    navMenu();
    let data;
    try { data = await loadData(); }
    catch (err) {
      console.error(err);
      $('.boot').classList.add('is-done');
      document.body.prepend(h('p', { class: 'preview-banner', text: 'Could not load content — open this site through a web server (GitHub Pages).' }));
      return;
    }
    const { site, feed } = data;
    const p = site.profile || {};
    bindSimple(site);
    renderHeroPhoto(p);
    renderStats(site.stats);
    renderAbout(p);
    renderExperience(site.experience);
    renderProjects(site.projects);
    renderSkills(site.skills);
    renderEducation(site.education);
    renderLeadership(site.leadership);
    renderUpdates(feed, p);
    renderGallery(site.gallery);
    renderContact(p);
    if (PREVIEW) document.body.append(h('div', { class: 'preview-banner', text: 'PREVIEW · unsaved changes from the editor' }));

    splitTitle();
    heroCanvas();
    scrollFx();
    reveals();
    pointerFx();
    boot(() => {
      document.body.classList.add('is-ready');
      setTimeout(() => typer(p.roles), 700);
    });
  }
  init();
})();
