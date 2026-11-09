/* =========================================================
   Site Editor — edits data/site.json + data/linkedin.json and
   uploads images, committing straight to GitHub (one commit per save).
   No server needed: works on GitHub Pages with a fine-grained token.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v, persist = true) { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch (e) { /* storage full / blocked */ } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
  };
  let uid = 0;

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v; // only used with static strings in this file
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }

  /* ---------------- state ---------------- */
  const S = {
    conn: null, demo: false,
    site: null, feed: null,
    orig: { site: '', feed: '', siteSha: null, feedIds: new Set() },
    pending: {},            // path -> { b64, dataUrl, size }
    section: 'profile',
    dirty: false
  };

  /* ---------------- encoding helpers ---------------- */
  const b64ToUtf8 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const utf8ToB64 = s => bytesToB64(new TextEncoder().encode(s));
  const slug = s => String(s || 'file').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40) || 'file';
  const rand = () => Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------------- GitHub API ---------------- */
  async function gh(path, opts = {}) {
    const { owner, repo, token } = S.conn;
    const url = path.startsWith('https://') ? path : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); if (j.message) msg = `${j.message} (${res.status})`; } catch (e) {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const refPath = b => b.split('/').map(encodeURIComponent).join('/');
  async function readFile(path) {
    const j = await gh(`/contents/${path}?ref=${encodeURIComponent(S.conn.branch)}`);
    return { text: b64ToUtf8(j.content || ''), sha: j.sha };
  }
  async function commitFiles(files, message) {
    const br = refPath(S.conn.branch);
    const ref = await gh(`/git/ref/heads/${br}`);
    const parent = ref.object.sha;
    const base = await gh(`/git/commits/${parent}`);
    const tree = [], shas = {};
    for (const f of files) {
      const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.content, encoding: f.encoding }) });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      shas[f.path] = blob.sha;
    }
    const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] }) });
    await gh(`/git/refs/heads/${br}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    return { commit, shas };
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, kind = '', ms = 4200) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast is-on ' + kind;
    clearTimeout(toastTimer);
    if (kind !== 'busy') toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
  }

  /* ---------------- schema ---------------- */
  const LINK_FIELDS = [{ key: 'label', label: 'Button label' }, { key: 'url', label: 'URL', type: 'url' }];
  const SOCIAL_OPTIONS = [['linkedin', 'LinkedIn'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['github', 'GitHub'], ['x', 'X (Twitter)'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['website', 'Website'], ['email', 'Email']];
  const SECTIONS = [
    {
      id: 'profile', label: 'Profile', icon: 'user', root: 'site', path: 'profile', type: 'object',
      intro: 'Your name, photo, headline and contact details.',
      fields: [
        { key: 'photo', label: 'Profile photo', type: 'image', wide: true, focal: 'photoFocus', frames: [['Website photo', 4 / 5], ['Square thumbnail', 1]], help: 'Use “Crop & position” to move and zoom the photo. A portrait (vertical) photo works best.' },
        { key: 'photoCaption', label: 'Photo caption', wide: true, help: 'Optional — shown under the photo, e.g. where it was taken. Leave empty to hide.' },
        { key: 'shortName', label: 'Display name' },
        { key: 'name', label: 'Full name' },
        { key: 'headline', label: 'Job title / headline', wide: true, help: 'Shown under your name and used by Google, e.g. “Robotics & Automation Engineering Technology Student”.' },
        { key: 'initials', label: 'Initials (logo)' },
        { key: 'eyebrow', label: 'Short label (used for search results)' },
        { key: 'roles', label: 'Typing animation — roles', type: 'lines', help: 'One per line.' },
        { key: 'availability', label: 'Status line', help: 'e.g. Open to internships' },
        { key: 'tagline', label: 'Tagline', type: 'textarea', wide: true },
        { key: 'summary', label: 'About me', type: 'paragraphs', wide: true, rows: 8, help: 'Leave a blank line between paragraphs.' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', help: 'Leave empty to hide it from the site.' },
        { key: 'linkedin', label: 'LinkedIn URL (main profile)', type: 'url' },
        { key: 'github', label: 'GitHub URL', type: 'url' },
        { key: 'socials', label: 'Social media accounts', type: 'list', wide: true, itemName: 'account',
          title: x => `${(SOCIAL_OPTIONS.find(o => o[0] === x.platform) || ['', 'Link'])[1]} — ${x.label || x.url || ''}`,
          fields: [
            { key: 'platform', label: 'Platform', type: 'select', options: SOCIAL_OPTIONS },
            { key: 'label', label: 'Name / handle shown', help: 'e.g. @hairiwasme' },
            { key: 'url', label: 'Link', type: 'url', wide: true }
          ] },
        { key: 'proofOrgs', label: 'Organisations strip (companies & schools)', type: 'tags', wide: true, help: 'Comma separated — shown under the top section, e.g. Micron Memory, ViTrox, UniMAP.' },
        { key: 'badges', label: 'Highlight badges on your photo (max 3)', type: 'lines', wide: true, rows: 3, help: 'One per line, short — e.g. “2+ yrs industry · Micron & ViTrox”.' },
        { key: 'searchSuggestions', label: 'Search suggestions', type: 'tags', wide: true, help: 'Comma separated — quick buttons under the search box, e.g. PLC, Machine vision, Micron.' },
        { key: 'location', label: 'Location' },
        { key: 'resume', label: 'CV / Résumé (PDF)', type: 'file', accept: 'application/pdf', help: 'Adds a “Download CV” link in the contact section.' },
        { key: 'facts', label: 'Quick facts (About section)', type: 'list', wide: true, itemName: 'fact', title: x => `${x.label || 'Label'} — ${x.value || ''}`, fields: [{ key: 'label', label: 'Label' }, { key: 'value', label: 'Value' }] }
      ]
    },
    {
      id: 'stats', label: 'Highlights', icon: 'chart', root: 'site', path: 'stats', type: 'list', itemName: 'number',
      intro: 'The animated counters under the hero.',
      title: x => `${x.value ?? ''}${x.suffix || ''} — ${x.label || ''}`,
      fields: [{ key: 'value', label: 'Number', type: 'number' }, { key: 'suffix', label: 'Suffix', help: 'e.g. + or %' }, { key: 'label', label: 'Description', type: 'textarea', wide: true, rows: 2 }]
    },
    {
      id: 'experience', label: 'Experience', icon: 'brief', root: 'site', path: 'experience', type: 'list', itemName: 'job',
      intro: 'Work history shown on the animated timeline.',
      title: x => `${x.role || 'Role'} · ${x.company || 'Company'}`,
      fields: [
        { key: 'role', label: 'Role' }, { key: 'company', label: 'Company' },
        { key: 'location', label: 'Location' }, { key: 'period', label: 'Period', help: 'e.g. Jul 2022 — Oct 2023' },
        { key: 'bullets', label: 'Achievements', type: 'lines', wide: true, rows: 5, help: 'One per line.' },
        { key: 'tags', label: 'Tags', type: 'tags', wide: true, help: 'Comma separated.' }
      ]
    },
    {
      id: 'projects', label: 'Projects', icon: 'cube', root: 'site', path: 'projects', type: 'list', itemName: 'project',
      intro: 'Featured projects show large with an animation or image; others show as smaller cards.',
      title: x => `${x.title || 'Untitled'}${x.featured ? '  ★' : ''}`,
      fields: [
        { key: 'title', label: 'Title' }, { key: 'subtitle', label: 'Subtitle' },
        { key: 'context', label: 'Context line', help: 'e.g. Final Year Project · UniMAP' },
        { key: 'status', label: 'Status badge', help: 'e.g. Prototype, In progress' },
        { key: 'featured', label: 'Featured (large card)', type: 'bool' },
        { key: 'visual', label: 'Visual', type: 'select', options: [['image', 'Photo / image'], ['aurewas', 'Animation: conveyor sorting'], ['vision', 'Animation: AI vision camera'], ['database', 'Animation: FIFO database'], ['none', 'None']] },
        { key: 'image', label: 'Project image', type: 'image', wide: true, focal: 'imageFocus', frames: [['Desktop card', 4 / 3], ['Phone', 16 / 10]], help: 'Used when Visual is “Photo / image”. Use “Crop & position” to frame it.' },
        { key: 'summary', label: 'Summary', type: 'textarea', wide: true },
        { key: 'highlights', label: 'Highlights', type: 'lines', wide: true, rows: 5, help: 'One per line.' },
        { key: 'tags', label: 'Tags', type: 'tags', wide: true, help: 'Comma separated.' },
        { key: 'team', label: 'Team / credits', wide: true },
        { key: 'links', label: 'Buttons (links)', type: 'list', wide: true, itemName: 'link', title: x => x.label || x.url || 'Link', fields: LINK_FIELDS },
        { key: 'id', label: 'Anchor id', help: 'Short id used in the page URL, e.g. aurewas' }
      ]
    },
    {
      id: 'skills', label: 'Skills', icon: 'chip', root: 'site', path: 'skills', type: 'list', itemName: 'skill group',
      title: x => x.group || 'Group',
      fields: [
        { key: 'group', label: 'Group name' },
        { key: 'icon', label: 'Icon', type: 'select', options: [['gear', 'Gear'], ['chip', 'Chip'], ['code', 'Code'], ['globe', 'Globe']] },
        { key: 'items', label: 'Skills', type: 'lines', wide: true, rows: 6, help: 'One per line.' }
      ]
    },
    {
      id: 'education', label: 'Education', icon: 'cap', root: 'site', path: 'education', type: 'list', itemName: 'qualification',
      title: x => x.degree || 'Qualification',
      fields: [
        { key: 'degree', label: 'Qualification', wide: true }, { key: 'school', label: 'Institution' },
        { key: 'period', label: 'Period' }, { key: 'grade', label: 'Grade', help: 'e.g. CGPA 3.11' },
        { key: 'notes', label: 'Coursework / notes', type: 'textarea', wide: true, rows: 3 }
      ]
    },
    {
      id: 'leadership', label: 'Leadership', icon: 'flag', root: 'site', path: 'leadership', type: 'list', itemName: 'role',
      title: x => `${x.title || 'Title'} — ${x.org || ''}`,
      fields: [
        { key: 'title', label: 'Title' }, { key: 'period', label: 'Period' },
        { key: 'org', label: 'Organisation / event', wide: true },
        { key: 'description', label: 'Description', type: 'textarea', wide: true, rows: 3 }
      ]
    },
    {
      id: 'gallery', label: 'Gallery', icon: 'image', root: 'site', path: 'gallery', type: 'list', itemName: 'photo', bulk: true,
      intro: 'Photos from your LinkedIn posts. Add the post’s photo and paste its link (LinkedIn → ⋯ on the post → Copy link to post): tapping the photo on the site opens the post. Paste only a link (no photo) to embed the whole post. LinkedIn posts you add under “Updates & LinkedIn” with a photo appear here automatically.',
      title: x => x.caption || x.link || 'Photo',
      thumb: x => x.image,
      fields: [
        { key: 'link', label: 'LinkedIn post link', type: 'url', wide: true, help: 'e.g. https://www.linkedin.com/posts/… or https://www.linkedin.com/feed/update/urn:li:activity:…' },
        { key: 'image', label: 'Photo (optional — without a photo the post is embedded)', type: 'image', wide: true, focal: 'focus', frames: [['Gallery tile', 1], ['Wide tile', 2]] },
        { key: 'caption', label: 'Caption', wide: true },
        { key: 'date', label: 'Date / year' }
      ]
    },
    {
      id: 'updates', label: 'Updates & LinkedIn', icon: 'linkedin', root: 'feed', path: 'posts', type: 'list', itemName: 'post', composer: true,
      title: x => `${x.date || ''} · ${(x.text || x.url || 'Post').slice(0, 60)}`,
      thumb: x => x.image,
      fields: [
        { key: 'source', label: 'Source', type: 'select', options: [['linkedin', 'LinkedIn post'], ['site', 'Website update']] },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'url', label: 'Link (LinkedIn post URL)', type: 'url', wide: true, help: 'With only a LinkedIn URL and no text, the site embeds the original post.' },
        { key: 'text', label: 'Text', type: 'textarea', wide: true, rows: 5 },
        { key: 'image', label: 'Image', type: 'image', wide: true }
      ]
    },
    {
      id: 'settings', label: 'SEO & settings', icon: 'gear', root: 'site', path: 'meta', type: 'object', settings: true,
      intro: 'Browser tab title and the description shown by Google and when the link is shared.',
      fields: [
        { key: 'title', label: 'Page title (Google headline)', wide: true, help: 'Name + role + key skills works best for recruiters searching.' },
        { key: 'description', label: 'Description (Google snippet)', type: 'textarea', wide: true, rows: 3, help: 'About 150–160 characters.' },
        { key: 'siteUrl', label: 'Website address', type: 'url', wide: true }
      ]
    }
  ];
  const ICONS = {
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    brief: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
    cube: 'M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5',
    chip: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3',
    cap: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
    flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-.01',
    linkedin: 'M4 9h3v11H4zM5.5 3.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM10 9h3v1.6c.6-1 1.8-1.9 3.6-1.9 3.4 0 4.4 2 4.4 5.4V20h-3v-5.3c0-1.5-.3-3-2.1-3-1.9 0-2.4 1.3-2.4 3V20h-3z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'
  };
  const svgIcon = name => el('span', { class: 'ico', html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.gear}"/></svg>` });

  const rootOf = sec => (sec.root === 'feed' ? S.feed : S.site);
  function target(sec) {
    const root = rootOf(sec);
    if (root[sec.path] == null) root[sec.path] = sec.type === 'list' ? [] : {};
    return root[sec.path];
  }
  function blank(fields) {
    const o = {};
    for (const f of fields) {
      if (f.type === 'list' || f.type === 'lines' || f.type === 'tags' || f.type === 'paragraphs') o[f.key] = [];
      else if (f.type === 'bool') o[f.key] = false;
      else if (f.type === 'select') o[f.key] = f.options[0][0];
      else if (f.type === 'date') o[f.key] = today();
      else o[f.key] = '';
    }
    return o;
  }

  /* ---------------- change tracking & draft ---------------- */
  let draftTimer;
  function changed() {
    S.dirty = true;
    $('#dirty').hidden = false;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => store.set('az-draft', JSON.stringify({ site: S.site, feed: S.feed, sha: S.orig.siteSha, at: Date.now() })), 500);
  }
  function markClean() {
    S.dirty = false; $('#dirty').hidden = true;
    store.del('az-draft');
  }
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- uploads ---------------- */
  function fileToDataUrl(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  async function compressImage(file, max = 1800) {
    if (/svg|gif/.test(file.type)) return { dataUrl: await fileToDataUrl(file), ext: file.type.includes('svg') ? 'svg' : 'gif' };
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d');
    const png = file.type === 'image/png' && file.size < 900000;
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const type = png ? 'image/png' : 'image/jpeg';
    return { dataUrl: c.toDataURL(type, 0.85), ext: png ? 'png' : 'jpg' };
  }
  async function addUpload(file) {
    const isPdf = file.type === 'application/pdf';
    const isImg = file.type.startsWith('image/');
    if (!isPdf && !isImg) throw new Error('Please choose an image or a PDF.');
    if (file.size > 15e6) throw new Error('File is larger than 15 MB.');
    const base = slug(file.name.replace(/\.[^.]+$/, ''));
    let dataUrl, path;
    if (isPdf) {
      dataUrl = await fileToDataUrl(file);
      path = `assets/uploads/docs/${base}-${rand()}.pdf`;
    } else {
      const r = await compressImage(file);
      dataUrl = r.dataUrl;
      path = `assets/uploads/${new Date().getFullYear()}/${base}-${rand()}.${r.ext}`;
    }
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    S.pending[path] = { b64, dataUrl, size: Math.round(b64.length * 0.75) };
    return path;
  }
  const resolve = v => (v && S.pending[v] ? S.pending[v].dataUrl : v || '');

  /* ---------------- crop & position (non-destructive) ----------------
     Stores { x, y, zoom } — the focal point in % and a zoom factor. The site
     shows the image with object-position + scale around that point, so the
     original file is never cut and can be re-adjusted at any time. */
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  function applyFocusStyle(img, f) {
    const x = f && isFinite(f.x) ? f.x : 50, y = f && isFinite(f.y) ? f.y : 50, z = f && f.zoom > 0 ? f.zoom : 1;
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${x}% ${y}%`;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = `scale(${z})`;
  }
  function openCropper(url, initial, frames, onSave) {
    const val = { x: 50, y: 50, zoom: 1, ...(initial || {}) };
    const mainImg = el('img', { alt: 'Photo being adjusted', src: url, draggable: 'false' });
    const main = el('div', { class: 'crop__main', tabindex: '0', role: 'application', 'aria-label': 'Drag to move the photo. Arrow keys move, plus and minus zoom.' },
      mainImg, el('span', { class: 'crop__thirds', 'aria-hidden': 'true' }));
    main.style.aspectRatio = String(frames[0][1]);
    main.style.width = `min(100%, calc(60vh * ${frames[0][1]}))`;
    const previews = frames.map(([label, ratio]) => {
      const im = el('img', { alt: '', src: url });
      const fr = el('div', { class: 'crop__mini' }, im); fr.style.aspectRatio = String(ratio);
      return { im, node: el('figure', { class: 'crop__prev' }, fr, el('figcaption', { class: 'mono', text: label })) };
    });
    const zoom = el('input', { type: 'range', min: '1', max: '3', step: '0.01', 'aria-label': 'Zoom' });
    const zoomOut = el('span', { class: 'mono crop__zv' });
    const xIn = el('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Horizontal position' });
    const yIn = el('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Vertical position' });
    const paint = () => {
      [mainImg, ...previews.map(p => p.im)].forEach(im => applyFocusStyle(im, val));
      zoom.value = val.zoom; xIn.value = val.x; yIn.value = val.y;
      zoomOut.textContent = Math.round(val.zoom * 100) + '%';
    };
    zoom.addEventListener('input', () => { val.zoom = +zoom.value; paint(); });
    xIn.addEventListener('input', () => { val.x = +xIn.value; paint(); });
    yIn.addEventListener('input', () => { val.y = +yIn.value; paint(); });

    // Drag to pan: convert pixel movement into focal-point % for the current size & zoom.
    let drag = null;
    main.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; main.setPointerCapture(e.pointerId); main.classList.add('is-drag'); });
    main.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      const fw = main.clientWidth, fh = main.clientHeight, iw = mainImg.naturalWidth || fw, ih = mainImg.naturalHeight || fh;
      const s = Math.max(fw / iw, fh / ih);
      const spanX = iw * s - fw + fw * (val.zoom - 1), spanY = ih * s - fh + fh * (val.zoom - 1);
      if (spanX > 0.5) val.x = clampN(val.x - dx / spanX * 100, 0, 100);
      if (spanY > 0.5) val.y = clampN(val.y - dy / spanY * 100, 0, 100);
      paint();
    });
    const end = () => { drag = null; main.classList.remove('is-drag'); };
    main.addEventListener('pointerup', end); main.addEventListener('pointercancel', end);
    main.addEventListener('wheel', e => { e.preventDefault(); val.zoom = clampN(val.zoom - e.deltaY * 0.002, 1, 3); paint(); }, { passive: false });
    main.addEventListener('keydown', e => {
      const step = e.shiftKey ? 10 : 2;
      const k = { ArrowLeft: ['x', -step], ArrowRight: ['x', step], ArrowUp: ['y', -step], ArrowDown: ['y', step] }[e.key];
      if (k) { e.preventDefault(); val[k[0]] = clampN(val[k[0]] + k[1], 0, 100); paint(); }
      if (e.key === '+' || e.key === '=') { val.zoom = clampN(val.zoom + 0.05, 1, 3); paint(); }
      if (e.key === '-') { val.zoom = clampN(val.zoom - 0.05, 1, 3); paint(); }
    });

    const close = () => { overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    const overlay = el('div', { class: 'crop', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Crop and position image' },
      el('div', { class: 'crop__card' },
        el('header', { class: 'crop__head' },
          el('h2', { text: 'Crop & position' }),
          el('p', { class: 'muted', text: 'Drag the photo to move it, use the zoom slider to crop in. The previews show how it looks on the site. Your original photo is kept, so you can change this again any time.' })),
        el('div', { class: 'crop__body' },
          main,
          el('div', { class: 'crop__side' },
            el('div', { class: 'crop__previews' }, previews.map(p => p.node)),
            el('label', { class: 'crop__ctl' }, el('span', null, 'Zoom ', zoomOut), zoom),
            el('label', { class: 'crop__ctl' }, el('span', { text: 'Left ↔ right' }), xIn),
            el('label', { class: 'crop__ctl' }, el('span', { text: 'Up ↕ down' }), yIn))),
        el('footer', { class: 'crop__foot' },
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Reset', onclick: () => { Object.assign(val, { x: 50, y: 50, zoom: 1 }); paint(); } }),
          el('span', { class: 'crop__spacer' }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Cancel', onclick: close }),
          el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Apply', onclick: () => {
            onSave({ x: Math.round(val.x * 10) / 10, y: Math.round(val.y * 10) / 10, zoom: Math.round(val.zoom * 100) / 100 });
            close(); toast('Position saved — press “Save & publish” to update the site.', 'ok');
          } }))));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', esc);
    document.body.append(overlay); document.body.style.overflow = 'hidden';
    paint(); main.focus();
  }

  /* ---------------- field renderers ---------------- */
  function field(spec, obj, onChange) {
    const id = 'f' + (++uid);
    const wrap = el('div', { class: 'field' + (spec.wide || ['list', 'image'].includes(spec.type) ? ' field--wide' : '') + (spec.type === 'bool' ? ' field--bool' : '') });
    const commit = v => { obj[spec.key] = v; onChange(); };
    let input;
    const v = obj[spec.key];
    switch (spec.type) {
      case 'textarea':
        input = el('textarea', { id, rows: spec.rows || 4 }); input.value = v || '';
        input.addEventListener('input', () => commit(input.value)); break;
      case 'lines':
        input = el('textarea', { id, rows: spec.rows || 4 }); input.value = (v || []).join('\n');
        input.addEventListener('input', () => commit(input.value.split('\n').map(s => s.trim()).filter(Boolean))); break;
      case 'paragraphs':
        input = el('textarea', { id, rows: spec.rows || 6 }); input.value = (Array.isArray(v) ? v : [v || '']).join('\n\n');
        input.addEventListener('input', () => commit(input.value.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean))); break;
      case 'tags':
        input = el('input', { id, type: 'text' }); input.value = (v || []).join(', ');
        input.addEventListener('input', () => commit(input.value.split(',').map(s => s.trim()).filter(Boolean))); break;
      case 'number':
        input = el('input', { id, type: 'number', step: 'any' }); input.value = v ?? '';
        input.addEventListener('input', () => commit(input.value === '' ? 0 : Number(input.value))); break;
      case 'bool':
        input = el('input', { id, type: 'checkbox' }); input.checked = !!v;
        input.addEventListener('change', () => commit(input.checked));
        wrap.append(input, el('label', { for: id, text: spec.label }));
        return wrap;
      case 'select':
        input = el('select', { id }, spec.options.map(([val, lab]) => el('option', { value: val, text: lab })));
        input.value = v || spec.options[0][0];
        input.addEventListener('change', () => commit(input.value)); break;
      case 'date':
        input = el('input', { id, type: 'date' }); input.value = (v || '').slice(0, 10);
        input.addEventListener('input', () => commit(input.value)); break;
      case 'image': case 'file':
        input = mediaField(spec, obj, onChange, id); break;
      case 'list':
        if (!Array.isArray(obj[spec.key])) obj[spec.key] = [];
        input = listEditor(obj[spec.key], spec, onChange); break;
      default:
        input = el('input', { id, type: spec.type === 'url' ? 'url' : spec.type === 'email' ? 'email' : 'text' }); input.value = v ?? '';
        input.addEventListener('input', () => commit(input.value));
    }
    wrap.append(el('label', { for: id, text: spec.label }), input);
    if (spec.help) wrap.append(el('small', { class: 'help', text: spec.help }));
    return wrap;
  }

  function mediaField(spec, obj, onChange, id) {
    const isImg = spec.type === 'image';
    const box = el('div', { class: 'media' });
    const preview = el('div', { class: 'media__preview' });
    const pathEl = el('span', { class: 'media__path mono' });
    const fileIn = el('input', { type: 'file', id, accept: spec.accept || (isImg ? 'image/*' : '*/*'), hidden: true });
    const urlIn = el('input', { type: 'text', placeholder: isImg ? 'or paste an image URL / path' : 'or paste a file URL' });
    const focalBtn = spec.focal ? el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Crop & position', onclick: () => {
      if (!obj[spec.key]) { toast('Upload an image first.', 'err'); return; }
      openCropper(resolve(obj[spec.key]), obj[spec.focal], spec.frames || [['Preview', 1]], val => { obj[spec.focal] = val; refresh(); onChange(); });
    } }) : null;
    const refresh = () => {
      const v = obj[spec.key] || '';
      preview.replaceChildren();
      preview.classList.toggle('is-empty', !v);
      if (v && isImg) {
        const im = el('img', { alt: '', src: resolve(v) });
        if (spec.focal) applyFocusStyle(im, obj[spec.focal]);
        im.onerror = () => { preview.replaceChildren(el('span', { class: 'mono', text: 'Uploaded — appears after publish' })); };
        preview.append(im);
      } else if (v) preview.append(el('span', { class: 'mono', text: 'File: ' + v.split('/').pop() }));
      else preview.append(el('span', { text: isImg ? 'Drop an image here' : 'No file' }));
      if (spec.frames) preview.style.aspectRatio = String(spec.frames[0][1]);
      pathEl.textContent = v ? (S.pending[v] ? 'new · ' : '') + v : '';
      urlIn.value = v;
      if (focalBtn) focalBtn.disabled = !v;
    };
    const take = async file => {
      try {
        toast('Preparing ' + (isImg ? 'image' : 'file') + '…', 'busy');
        obj[spec.key] = await addUpload(file);
        if (spec.focal) delete obj[spec.focal]; // new picture: start from the centre
        refresh(); onChange();
        toast((isImg ? 'Image' : 'File') + ' added — press “Save & publish” to upload it.', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) take(fileIn.files[0]); fileIn.value = ''; });
    urlIn.addEventListener('change', () => { obj[spec.key] = urlIn.value.trim(); refresh(); onChange(); });
    preview.addEventListener('click', () => fileIn.click());
    preview.addEventListener('dragover', e => { e.preventDefault(); preview.classList.add('is-drag'); });
    preview.addEventListener('dragleave', () => preview.classList.remove('is-drag'));
    preview.addEventListener('drop', e => { e.preventDefault(); preview.classList.remove('is-drag'); const f = e.dataTransfer.files[0]; if (f) take(f); });
    const actions = el('div', { class: 'media__actions' },
      focalBtn,
      el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: isImg ? (spec.focal ? 'Replace image' : 'Upload image') : 'Upload file', onclick: () => fileIn.click() }),
      el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Remove', onclick: () => { obj[spec.key] = ''; refresh(); onChange(); } }),
      urlIn);
    box.append(preview, el('div', { class: 'media__side' }, actions, pathEl), fileIn);
    refresh();
    return box;
  }

  function listEditor(arr, spec, onChange, opts = {}) {
    const box = el('div', { class: 'list' });
    const titleOf = (x, i) => (spec.title ? spec.title(x) : (x.title || x.label || `Item ${i + 1}`)) || `Item ${i + 1}`;
    let openIdx = opts.openIndex ?? -1;
    function draw() {
      box.replaceChildren();
      arr.forEach((item, i) => {
        const d = el('details', { class: 'item' });
        const title = el('span', { class: 'item__title', text: titleOf(item, i) });
        const thumbSrc = spec.thumb && spec.thumb(item);
        const tool = (label, fn, cls = '') => el('button', { type: 'button', class: 'tool ' + cls, title: label, 'aria-label': label, text: { Up: '↑', Down: '↓', Delete: '✕', Duplicate: '⧉' }[label], onclick: e => { e.preventDefault(); e.stopPropagation(); fn(); } });
        const sum = el('summary', null,
          el('span', { class: 'item__num mono', text: String(i + 1).padStart(2, '0') }),
          thumbSrc ? el('img', { class: 'item__thumb', src: resolve(thumbSrc), alt: '' }) : null,
          title,
          el('span', { class: 'item__tools' },
            tool('Up', () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; openIdx = -1; draw(); onChange(); } }),
            tool('Down', () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; openIdx = -1; draw(); onChange(); } }),
            tool('Duplicate', () => { arr.splice(i + 1, 0, JSON.parse(JSON.stringify(item))); openIdx = i + 1; draw(); onChange(); }),
            tool('Delete', () => { if (confirm(`Delete “${titleOf(item, i)}”?`)) { arr.splice(i, 1); openIdx = -1; draw(); onChange(); } }, 'tool--danger')
          ));
        const body = el('div', { class: 'item__body grid' });
        const build = () => {
          if (body.childElementCount) return;
          spec.fields.forEach(f => body.append(field(f, item, () => {
            title.textContent = titleOf(item, i);
            const th = sum.querySelector('.item__thumb');
            if (spec.thumb) { const s = spec.thumb(item); if (th) th.src = resolve(s); }
            onChange();
          })));
        };
        d.addEventListener('toggle', () => { if (d.open) build(); });
        d.append(sum, body);
        if (i === openIdx) { d.open = true; build(); }
        box.append(d);
      });
      const add = el('button', { type: 'button', class: 'btn btn--ghost btn--sm list__add', text: '+ Add ' + (spec.itemName || 'item'),
        onclick: () => { const n = blank(spec.fields); if (opts.addTop) { arr.unshift(n); openIdx = 0; } else { arr.push(n); openIdx = arr.length - 1; } draw(); onChange(); } });
      box.append(add);
      if (!arr.length) box.prepend(el('p', { class: 'empty', text: 'Nothing here yet.' }));
    }
    draw();
    box.redraw = draw;
    return box;
  }

  /* ---------------- panels ---------------- */
  function renderSidebar() {
    const nav = $('#sidebar'); nav.replaceChildren();
    SECTIONS.forEach(sec => nav.append(el('button', {
      type: 'button', class: 'side-link' + (S.section === sec.id ? ' is-active' : ''),
      onclick: () => { S.section = sec.id; renderSidebar(); renderPanel(); $('#panel').scrollTop = 0; window.scrollTo({ top: 0 }); }
    }, svgIcon(sec.icon), el('span', { text: sec.label }))));
  }

  function renderPanel() {
    const sec = SECTIONS.find(s => s.id === S.section);
    const panel = $('#panel'); panel.replaceChildren();
    panel.append(el('header', { class: 'panel__head' },
      el('h1', { text: sec.label }),
      sec.intro ? el('p', { text: sec.intro }) : null));

    if (sec.composer) panel.append(composer(), syncCard());

    const t = target(sec);
    if (sec.type === 'object') {
      const grid = el('div', { class: 'grid card' });
      sec.fields.forEach(f => grid.append(field(f, t, changed)));
      panel.append(grid);
    } else {
      if (sec.bulk) panel.append(bulkUploader(t, sec));
      panel.append(listEditor(t, sec, changed, { addTop: sec.id === 'updates' }));
    }
    if (sec.settings) panel.append(settingsCard());
  }

  function bulkUploader(arr, sec) {
    const input = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const zone = el('div', { class: 'dropzone' },
      el('strong', { text: 'Add photos' }),
      el('span', { text: 'Drag & drop here, or click to choose (many at once is fine)' }), input);
    const takeAll = async files => {
      const list = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (!list.length) return;
      let n = 0;
      const added = [];
      for (const f of list) {
        toast(`Preparing photo ${++n} of ${list.length}…`, 'busy');
        try {
          const path = await addUpload(f);
          added.push({ image: path, caption: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), date: String(new Date().getFullYear()) });
        } catch (e) { toast(e.message, 'err'); }
      }
      if (!added.length) return;
      arr.unshift(...added);
      changed(); renderPanel();
      toast(`${list.length} photo${list.length > 1 ? 's' : ''} added — edit captions, then “Save & publish”.`, 'ok', 6000);
    };
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => takeAll(input.files));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('is-drag'); takeAll(e.dataTransfer.files); });
    return zone;
  }

  function linkedInId(url) {
    const m = String(url || '').match(/(?:activity|ugcPost|share)[-:](\d{10,})/);
    return m ? 'li-' + m[1] : '';
  }

  function composer() {
    const draft = { text: '', image: '', url: '' };
    const card = el('section', { class: 'card composer' });
    const ta = el('textarea', { rows: 4, placeholder: 'What’s new? e.g. “Presented AUREWAS at Festival Idea Putrajaya 2026…”' });
    ta.addEventListener('input', () => { draft.text = ta.value; });
    const url = el('input', { type: 'url', placeholder: 'LinkedIn post URL (optional — paste it after posting)' });
    url.addEventListener('input', () => { draft.url = url.value.trim(); });
    const share = el('input', { type: 'checkbox', id: 'share-li', checked: true });
    const imgSpec = { key: 'image', label: 'Image', type: 'image' };
    const publish = async () => {
      if (!draft.text.trim() && !draft.url) { toast('Write something or paste a LinkedIn link first.', 'err'); return; }
      const isLi = /linkedin\.com/.test(draft.url);
      S.feed.posts = S.feed.posts || [];
      S.feed.posts.unshift({ id: linkedInId(draft.url) || 'site-' + Date.now().toString(36), source: isLi ? 'linkedin' : 'site', url: draft.url, date: today(), text: draft.text.trim(), image: draft.image });
      changed();
      if (share.checked && draft.text.trim()) {
        try { await navigator.clipboard.writeText(draft.text.trim()); } catch (e) {}
        window.open('https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(draft.text.trim()), '_blank', 'noopener');
      }
      if (!S.demo) await save(); else toast('Added. Connect your token to publish.', 'ok');
      renderPanel();
    };
    card.append(
      el('h2', { text: 'Post an update everywhere' }),
      el('p', { class: 'muted', text: 'Write once: it is published on your website and LinkedIn opens with the same text ready to post (it is also copied to your clipboard).' }),
      ta,
      el('div', { class: 'composer__row' }, field(imgSpec, draft, () => {})),
      url,
      el('div', { class: 'composer__foot' },
        el('label', { class: 'check', for: 'share-li' }, share, ' Also open LinkedIn to post it'),
        el('button', { type: 'button', class: 'btn btn--primary', text: 'Publish update', onclick: publish }))
    );
    return card;
  }

  function syncCard() {
    const runBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Run LinkedIn sync now' });
    runBtn.addEventListener('click', async () => {
      if (S.demo) { toast('Connect first.', 'err'); return; }
      try {
        await gh('/actions/workflows/linkedin-sync.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: S.conn.branch }) });
        toast('Sync started. New LinkedIn posts appear on the site in 1–2 minutes.', 'ok', 6000);
      } catch (e) {
        toast(e.status === 403 || e.status === 404 ? 'Your token needs “Actions: Read and write” permission to start the sync.' : 'Could not start sync: ' + e.message, 'err', 7000);
      }
    });
    return el('details', { class: 'card sync' },
      el('summary', null, el('strong', { text: 'Automatic LinkedIn → website sync' }), el('span', { class: 'mono pill', text: 'every 3 h' })),
      el('div', { class: 'sync__body' },
        el('p', { text: 'A GitHub Action checks your LinkedIn activity feed every 3 hours and publishes new posts here automatically. It can also be triggered instantly by Zapier / Make / IFTTT. One-time setup steps are in the README (section “LinkedIn sync”).' }),
        runBtn));
  }

  function settingsCard() {
    const c = S.conn || {};
    return el('section', { class: 'card settings' },
      el('h2', { text: 'Connection' }),
      el('p', { class: 'mono', text: S.demo ? 'Demo mode — not connected' : `${c.owner}/${c.repo} @ ${c.branch}` }),
      el('div', { class: 'row-btns' },
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Download backup (JSON)', onclick: () => {
          const blob = new Blob([JSON.stringify({ site: S.site, feed: S.feed }, null, 2)], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: `site-backup-${today()}.json` }); a.click();
        } }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Reload from GitHub', onclick: async () => {
          if (S.dirty && !confirm('Discard unsaved changes and reload?')) return;
          try { await loadRemote(); markClean(); renderPanel(); toast('Reloaded.', 'ok'); } catch (e) { toast(e.message, 'err'); }
        } }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Sign out', onclick: logout })));
  }

  /* ---------------- save / preview ---------------- */
  const stable = feed => JSON.stringify({ ...feed, updatedAt: undefined });
  async function save() {
    if (S.demo) { toast('Connect with your GitHub token to publish.', 'err'); showLogin(); return; }
    const btn = $('#save-btn'); btn.disabled = true;
    toast('Publishing…', 'busy');
    try {
      // Merge posts that the LinkedIn sync added while the editor was open.
      let merged = 0;
      try {
        const remote = JSON.parse((await readFile('data/linkedin.json')).text);
        const mine = new Set((S.feed.posts || []).map(p => p.id));
        const fresh = (remote.posts || []).filter(p => p.id && !S.orig.feedIds.has(p.id) && !mine.has(p.id));
        if (fresh.length) { S.feed.posts.push(...fresh); merged = fresh.length; }
      } catch (e) { if (e.status !== 404) throw e; }
      S.feed.posts = (S.feed.posts || []).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

      const files = [];
      const siteText = JSON.stringify(S.site, null, 2) + '\n';
      if (siteText !== S.orig.site) {
        const remoteSite = await readFile('data/site.json');
        if (remoteSite.sha !== S.orig.siteSha && !confirm('The site content was changed elsewhere after you opened the editor. Overwrite it with your version?')) { toast('Publish cancelled.'); return; }
        files.push({ path: 'data/site.json', content: siteText, encoding: 'utf-8' });
      }
      if (stable(S.feed) !== S.orig.feedStable) {
        S.feed.updatedAt = new Date().toISOString();
        files.push({ path: 'data/linkedin.json', content: JSON.stringify(S.feed, null, 2) + '\n', encoding: 'utf-8' });
      }
      const allJson = JSON.stringify(S.site) + JSON.stringify(S.feed);
      for (const [path, f] of Object.entries(S.pending)) if (allJson.includes(path)) files.push({ path, content: f.b64, encoding: 'base64' });
      if (!files.length) { toast('No changes to publish.'); markClean(); return; }

      const n = files.length;
      const { shas } = await commitFiles(files, `Update website via editor (${n} file${n > 1 ? 's' : ''})`);
      S.orig = {
        site: siteText,
        siteSha: shas['data/site.json'] || S.orig.siteSha,
        feedStable: stable(S.feed),
        feedIds: new Set(S.feed.posts.map(p => p.id))
      };
      S.pending = {};
      markClean();
      renderPanel();
      toast(`Published ✓ ${merged ? `(+${merged} synced LinkedIn post${merged > 1 ? 's' : ''}) ` : ''}Your website updates in about a minute.`, 'ok', 7000);
    } catch (e) {
      console.error(e);
      toast('Publish failed: ' + e.message, 'err', 9000);
    } finally { btn.disabled = false; }
  }

  function preview() {
    const images = {};
    for (const [p, f] of Object.entries(S.pending)) if (f.dataUrl.startsWith('data:image')) images[p] = f.dataUrl;
    let ok = true;
    try { localStorage.setItem('az-preview', JSON.stringify({ site: S.site, feed: S.feed, images })); }
    catch (e) {
      try { localStorage.setItem('az-preview', JSON.stringify({ site: S.site, feed: S.feed, images: {} })); ok = false; } catch (e2) { toast('Preview is not available in this browser.', 'err'); return; }
    }
    window.open('index.html?preview=1', '_blank');
    if (!ok) toast('Preview opened without new photos (too large to preview) — they will appear after publishing.');
  }

  /* ---------------- load / connect ---------------- */
  async function loadRemote(silent) {
    const s = await readFile('data/site.json');
    let f = null;
    try { f = await readFile('data/linkedin.json'); } catch (e) { if (e.status !== 404) throw e; }
    S.site = JSON.parse(s.text);
    S.feed = f ? JSON.parse(f.text) : { profileUrl: '', posts: [] };
    S.feed.posts = S.feed.posts || [];
    S.orig = { site: JSON.stringify(S.site, null, 2) + '\n', siteSha: s.sha, feedStable: stable(S.feed), feedIds: new Set(S.feed.posts.map(p => p.id)) };
    if (!silent) checkDraft();
  }
  async function loadLocal() {
    const [site, feed] = await Promise.all([
      fetch('data/site.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/linkedin.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ posts: [] }))
    ]);
    S.site = site; S.feed = feed; S.feed.posts = S.feed.posts || [];
    S.orig = { site: JSON.stringify(site, null, 2) + '\n', siteSha: null, feedStable: stable(feed), feedIds: new Set(feed.posts.map(p => p.id)) };
  }
  function checkDraft() {
    const raw = store.get('az-draft');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (JSON.stringify(d.site) === JSON.stringify(S.site) && stable(d.feed) === stable(S.feed)) { store.del('az-draft'); return; }
      $('#draft-banner').hidden = false;
      $('#draft-restore').onclick = () => { S.site = d.site; S.feed = d.feed; $('#draft-banner').hidden = true; changed(); renderPanel(); toast('Draft restored (new photos from that session need to be uploaded again).', 'ok', 6000); };
      $('#draft-discard').onclick = () => { store.del('az-draft'); $('#draft-banner').hidden = true; };
    } catch (e) { store.del('az-draft'); }
  }

  function showApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#conn-status').textContent = S.demo ? 'demo mode · not connected' : `${S.conn.owner}/${S.conn.repo} @ ${S.conn.branch}`;
    $('#save-btn').textContent = S.demo ? 'Connect to publish' : 'Save & publish';
    renderSidebar(); renderPanel();
  }
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
  function logout() {
    if (S.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
    store.del('az-token'); store.del('az-conn');
    S.conn = null; S.demo = false; S.dirty = false;
    showLogin();
  }

  async function connect(conn, remember) {
    S.conn = conn; S.demo = false;
    const info = await gh('');
    if (info.permissions && info.permissions.push === false) throw new Error('This token can read but not write to the repository. Give it “Contents: Read and write”.');
    try { await gh(`/git/ref/heads/${refPath(conn.branch)}`); } catch (e) { if (e.status === 404) throw new Error(`Branch “${conn.branch}” was not found.`); throw e; }
    await loadRemote();
    store.set('az-conn', JSON.stringify({ owner: conn.owner, repo: conn.repo, branch: conn.branch }), true);
    store.del('az-token');
    store.set('az-token', conn.token, !!remember);
    showApp();
  }

  async function prefill() {
    const f = $('#login-form');
    let repo = {};
    try { repo = (await fetch('data/site.json', { cache: 'no-cache' }).then(r => r.json())).meta.repo || {}; } catch (e) {}
    const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
    if (m && !repo.owner) { repo.owner = m[1]; repo.name = location.pathname.split('/').filter(Boolean)[0] || ''; }
    const saved = JSON.parse(store.get('az-conn') || '{}');
    f.owner.value = saved.owner || repo.owner || '';
    f.repo.value = saved.repo || repo.name || '';
    f.branch.value = saved.branch || repo.branch || 'main';
    const token = store.get('az-token');
    if (token && f.owner.value && f.repo.value) {
      f.token.value = token;
      try { await connect({ owner: f.owner.value, repo: f.repo.value, branch: f.branch.value, token }, true); }
      catch (e) { $('#login-error').textContent = 'Saved token no longer works: ' + e.message; }
    }
  }

  /* ---------------- wire up ---------------- */
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type=submit]');
    $('#login-error').textContent = '';
    btn.disabled = true; btn.textContent = 'Connecting…';
    try {
      await connect({ owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || 'main', token: f.token.value.trim() }, f.remember.checked);
    } catch (err) {
      $('#login-error').textContent = err.status === 401 ? 'Token rejected — check that you copied it fully and it has not expired.'
        : err.status === 404 ? 'Repository not found, or the token has no access to it.' : err.message;
    } finally { btn.disabled = false; btn.textContent = 'Connect & edit'; }
  });
  $('#demo-btn').addEventListener('click', async () => {
    try { await loadLocal(); S.demo = true; showApp(); toast('Demo mode: explore and preview freely. Connect a token to publish.'); }
    catch (e) { $('#login-error').textContent = 'Could not load site content: ' + e.message; }
  });
  $('#save-btn').addEventListener('click', () => (S.demo ? showLogin() : save()));
  $('#preview-btn').addEventListener('click', preview);
  $('#logout-btn').addEventListener('click', logout);
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('#app').hidden) { e.preventDefault(); save(); } });

  prefill();
})();
