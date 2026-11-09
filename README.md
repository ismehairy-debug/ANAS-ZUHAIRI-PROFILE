# Anas Zuhairi — Personal Website

A white, technology-themed portfolio for **Anas Zuhairi bin Zullkeffle** (Robotics & Automation, UniMAP). It includes:

- **Animated portfolio**: circuit-trace hero, typing roles, scroll reveals, counters, a timeline that fills as you scroll, tilt cards, a gallery lightbox, and live canvas simulations of **AUREWAS** (PLC conveyor sorting), **AI-REWAS** (vision) and the **FIFO inventory** project.
- **Projects**: AUREWAS, Galeri Warisan Maya (WebXR heritage gallery), AI-REWAS and Stock Take FIFO. The content comes from the résumé and project documents.
- **Built-in editor** at `/admin.html`: change any text, upload a profile photo, add gallery pictures, and publish from your browser (phone or laptop). No coding and no server needed.
- **LinkedIn → website sync**: new LinkedIn posts appear in the *Latest updates* section (details below).

No build step. Plain HTML, CSS and JS, hosted free on GitHub Pages.

```
index.html              public website
admin.html              site editor
data/site.json          all site content (the editor writes this)
data/linkedin.json      updates / LinkedIn posts (editor + sync write this)
assets/css, assets/js   styles and scripts
assets/img              built-in images
assets/uploads          photos uploaded from the editor
scripts/linkedin-sync.mjs        LinkedIn feed → data/linkedin.json
.github/workflows/deploy.yml     publishes to GitHub Pages
.github/workflows/linkedin-sync.yml  scheduled / instant LinkedIn sync
```

---

## 1. Put the site online (one-time, about 3 minutes)

1. **Merge this branch into `main`**, for example by opening a pull request and merging it.
2. **Make Pages available.** This repository is *private*. GitHub Pages only works on private repos with a paid plan (GitHub Pro). Choose one:
   - **Settings → General → Danger zone → Change visibility → Public** (free; the content is public on the website anyway), or
   - upgrade to GitHub Pro.
3. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
4. Go to **Actions → Deploy website → Run workflow**, or push any change. Your site will be live at
   `https://ismehairy-debug.github.io/ANAS-ZUHAIRI-PROFILE/`

After that, every save from the editor redeploys the site automatically within about 1 minute.

## 2. Edit the website (add pictures, change details)

1. Open `https://ismehairy-debug.github.io/ANAS-ZUHAIRI-PROFILE/admin.html`. There is also an **Edit site** link in the footer.
2. Create a token once:
   [GitHub → Settings → Developer settings → Fine-grained tokens → Generate](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories** → this repo
   - Permissions → Repository → **Contents: Read and write**
   - *(optional)* **Actions: Read and write**, which enables the "Run LinkedIn sync now" button
3. Paste the token and click **Connect & edit**. The token is stored only in your browser.
4. Edit **Profile, Highlights, Experience, Projects, Skills, Education, Leadership, Gallery, Updates**:
   - **Upload image** or drag & drop. Photos are resized automatically before upload.
   - **Gallery → Add photos** accepts many pictures at once.
   - **Preview** shows your changes before publishing.
   - **Save & publish** (or Ctrl/Cmd + S) creates one commit, and the site updates in about a minute.

Unsaved edits are kept as a draft in the browser if you close the tab.

**Crop & position photos.** On the profile photo, project images and gallery photos, tap **Crop & position**. Drag the picture to move it and use the zoom slider to crop in. Live previews show how it will look on the site. The original file is kept, so you can re-adjust any time.

**Social media.** Go to *Profile → Social media accounts* and add, remove or reorder LinkedIn, WhatsApp, Telegram, Instagram, Facebook, GitHub and others. They appear as icons in the hero and footer, and as rows in the contact section.

## Help companies find you on Google

The page already includes a search-engine profile (schema.org `Person`), a canonical URL, share previews, `robots.txt` and `sitemap.xml`. To get indexed faster:
1. Open [Google Search Console](https://search.google.com/search-console) → **Add property** → URL prefix → `https://ismehairy-debug.github.io/ANAS-ZUHAIRI-PROFILE/`.
2. Verify ownership with the **HTML tag** method: paste the `<meta name="google-site-verification" …>` tag inside `<head>` of `index.html` (on GitHub: open the file → pencil icon → commit), or ask Claude to add it.
3. **Sitemaps** → submit `sitemap.xml`.
4. Put the website link in your LinkedIn *Contact info*, your CV and your email signature. Links from your own profiles help Google connect them.

## 3. LinkedIn → website

LinkedIn does not offer a public API for reading a personal profile's posts. The site therefore supports three routes, and you can combine them:

| Route | Setup | How it works |
|---|---|---|
| **A. Post everywhere from the editor** | none | *Updates & LinkedIn → Post an update everywhere*. It publishes the post on your website **and** opens LinkedIn with the same text pre-filled (the text is also copied to your clipboard). |
| **B. Automatic every 3 hours** | add one variable | Get an RSS/JSON feed of your LinkedIn posts from a feed service (for example RSS.app → "LinkedIn profile feed" for `linkedin.com/in/hairyisme`; some services need a paid plan). Then add it under **Settings → Secrets and variables → Actions → Variables → New variable**: name `LINKEDIN_FEED_URL`, value = the feed URL. The *LinkedIn sync* workflow then imports new posts every 3 hours and redeploys. |
| **C. Instant via Zapier / Make / IFTTT** | one zap | Add an action **Webhooks → POST** to `https://api.github.com/repos/ismehairy-debug/ANAS-ZUHAIRI-PROFILE/dispatches` with headers `Authorization: Bearer <fine-grained token with Contents: Read and write>` and `Accept: application/vnd.github+json`, and body: `{"event_type":"linkedin_post","client_payload":{"url":"<post url>","text":"<post text>","image":"<image url>","date":"<date>"}}` |

You can also add a post manually: **Actions → LinkedIn sync → Run workflow**, then paste the post URL and text. Posts with only a LinkedIn URL and no text are shown as an embedded LinkedIn post.

Sync details: duplicates are skipped, posts you edited in the editor are never overwritten, and images are copied into `assets/uploads/linkedin/` because LinkedIn image links expire.

## 4. Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000  (editor: http://localhost:8000/admin.html)
```

## Privacy

The public site shows your email, LinkedIn, GitHub and city. **Phone number is empty by default.** Add it in *Profile → Phone* if you want it shown. Referees' contact details from the résumé are **not** published.
