# 🏛️ Sarkari Naukri — India Government Jobs Portal

A full-stack Next.js portal for browsing, filtering, and AI-extracting Indian government job notifications. Upload any official PDF recruitment notification and Claude AI automatically extracts job details — securely, with your API key stored only on the server.

**Live features:**
- 🔍 Search + filter by state, education, job type
- 📄 Upload any government PDF → Claude AI extracts all jobs instantly
- 📊 Live stats: vacancies, states covered, closing soon
- 🔒 API key lives only on server — never exposed to users
- ⚡ Vercel-ready: deploy in under 5 minutes

---

## 🚀 Deploy to Vercel (Step-by-Step)

### Step 1 — Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Click **API Keys** in the sidebar
4. Click **Create Key** → copy the key (starts with `sk-ant-…`)
5. Keep this key safe — you'll paste it into Vercel in Step 4

---

### Step 2 — Push this project to GitHub

1. Go to [github.com](https://github.com) and create a free account (if you don't have one)
2. Click the **+** button → **New repository**
3. Name it `sarkari-naukri`, set to **Public** or **Private**, click **Create repository**
4. On your computer, open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit — Sarkari Naukri portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sarkari-naukri.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 3 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign Up with GitHub**
2. Click **Add New → Project**
3. Find and click **Import** next to your `sarkari-naukri` repository
4. Vercel auto-detects Next.js — leave all settings as default

---

### Step 4 — Add your API key (critical!)

Before clicking Deploy:

1. Scroll down to **Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-your-key-here` ← paste your real key
3. Click **Add**

> ⚠️ Without this step the PDF parsing will not work. The key is stored encrypted by Vercel and never visible to users.

---

### Step 4b — Connect Vercel Blob (required for jobs to persist)

Jobs are saved to **Vercel Blob** so they survive page refreshes and are shared across all visitors.

1. In your Vercel project, open the **Storage** tab
2. Click **Create Database → Blob → Create**
3. Click **Connect** to attach it to this project

Vercel automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable. That's all that's needed — the app reads/writes the store through the SDK with that token.

> Without `BLOB_READ_WRITE_TOKEN`, the app still runs but jobs are not persisted on Vercel (the serverless filesystem is ephemeral).

---

### Step 5 — Deploy!

Click **Deploy**. Vercel builds and deploys in ~60 seconds.

Your portal is live at: `https://sarkari-naukri-xxxx.vercel.app`

You can add a custom domain (like `sarkari.yourdomain.com`) in Vercel's **Domains** settings.

---

## 🔧 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. Start dev server
npm run dev

# 4. Open http://localhost:3000
```

---

## 📁 Project Structure

```
sarkari-naukri/
├── pages/
│   ├── index.js          ← Main portal UI (React)
│   ├── _app.js           ← Global styles wrapper
│   ├── _document.js      ← HTML head / fonts
│   └── api/
│       ├── parse-pdf.js  ← 🔒 Secure Claude API proxy
│       └── health.js     ← Health check endpoint
├── lib/
│   └── data.js           ← Seed jobs + sample PDF texts
├── styles/
│   └── globals.css       ← Base CSS reset
├── .env.example          ← Environment variable template
├── vercel.json           ← Vercel config (60s function timeout)
├── next.config.js        ← Next.js config
└── package.json
```

---

## 🔒 Security Architecture

```
Browser (User)                Server (Vercel Function)
──────────────────            ────────────────────────────
PDF file → extract text  →→→  /api/parse-pdf
                               │  reads ANTHROPIC_API_KEY
                               │  (env var, never sent to browser)
                               │  calls Claude API
                         ←←←  returns structured job JSON
renders job cards
```

The Anthropic API key is **only** in Vercel's encrypted environment variables. It never appears in the browser, in network responses, or in your source code.

---

## 🗺️ How PDF Parsing Works

1. User drops a PDF on the portal
2. Browser uses **pdf.js** to extract raw text from the PDF (client-side)
3. Text is sent to `/api/parse-pdf` (your Vercel serverless function)
4. The server calls **Claude claude-sonnet-4-6** with the text and a structured prompt
5. Claude returns a JSON array of job objects
6. Jobs appear instantly in the portal with a "FROM PDF" badge

Supports any Indian government recruitment notification — UPSC, SSC, IBPS, RRB, State PSCs, police, teaching, medical, and more.

**Caching:** parsed results are cached in Blob by a content hash, so re-uploading the same PDF returns instantly (`cached: true`) without a second paid Claude call. Identical PDF files are also stored idempotently (same content → same blob, no duplicates).

---

## ✏️ Customising

**Add more seed jobs:** Edit `lib/data.js` → `SEED_JOBS` array

**Change the Claude model:** Edit `pages/api/parse-pdf.js` → `model` field

**Add a database:** Replace the in-memory `useState` in `pages/index.js` with API calls to a Vercel Postgres or Supabase database for persistent storage across sessions

**Custom domain:** In Vercel dashboard → your project → Settings → Domains

**Admin access & security:** All admin actions live at `/admin`. The public home page is read-only. Logging in calls `/api/admin-login`, which verifies credentials server-side and issues a signed session token; the write endpoints (`/api/jobs-store` PUT, `/api/upload-pdf`, `/api/parse-pdf`) reject any request without a valid token. **For production, set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in Vercel** — otherwise it falls back to built-in defaults that are visible in the source history.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (Pages Router) |
| UI | React 18, vanilla CSS |
| AI | Anthropic Claude claude-sonnet-4-6 via `@anthropic-ai/sdk` |
| PDF parsing | pdf.js 3.11 (client-side text extraction) |
| Hosting | Vercel (free tier works) |
| Fonts | Google Fonts — Noto Serif Display |

---

## ❓ FAQ

**Q: Is Vercel's free tier enough?**
A: Yes. The free Hobby plan supports unlimited deployments, 100GB bandwidth/month, and serverless functions — more than enough to start.

**Q: Will job data persist between page refreshes?**
A: Yes. Jobs are saved to **Vercel Blob** (a shared private store) via `/api/jobs-store` and reloaded on every page load, so they survive refreshes and redeploys. Requires `BLOB_READ_WRITE_TOKEN` to be set (see below).

**Q: Can multiple users add jobs simultaneously?**
A: Yes. All visitors read from and write to the same Blob store, so everyone sees the same jobs. Saves are last-write-wins on the full list, which is fine for a single admin; for heavy concurrent editing you'd want per-job writes or a database.

**Q: How do I update the portal after deploying?**
A: Push any change to your GitHub repo — Vercel auto-redeploys in ~30 seconds.

---

Built with ❤️ for job seekers across India 🇮🇳
