# ✦ JENI LIFE OS

> Your Universal Personal AI Assistant  
> Built by Somnath — The Big Dreamer

## What is this?

A complete, production-ready personal life management system with:
- **AI Chat** powered by Groq (FREE) with full life context
- **Finance tracking** — salary, EMIs, subscriptions, expenses
- **Project management** — DigiKaragir, NashikKumbhMap, etc.
- **Health tracking** — sleep, steps, water, gym
- **Task & goal management**
- **Real database** via Supabase (PostgreSQL)
- **Authentication** — Google login / Magic link

## How it Works

```
YOU → Add data (salary, EMIs, projects) → Supabase Database
                                              ↓
YOU → Ask Jeni anything → API builds FULL context from DB → Sends to Groq AI → Smart response
```

**Every time you chat with Jeni, she fetches ALL your data from the database and uses it to answer intelligently.**

---

## 🚀 Deploy in 30 Minutes — Step by Step

### Step 1: Create Supabase Project (5 min)

1. Go to **[supabase.com](https://supabase.com)**
2. Sign up (free) → Click **"New Project"**
3. Choose a name: `jeni-bot`
4. Set a database password (save it!)
5. Select region: **South Asia (Mumbai)**
6. Wait ~2 minutes for setup

### Step 2: Create Database Tables (2 min)

1. In your Supabase project, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-schema.sql` from this project
4. **Copy the ENTIRE contents** and paste into the SQL editor
5. Click **"Run"** (or Ctrl+Enter)
6. You should see "Success" — all 16 tables are created!

### Step 3: Get Your Supabase Keys (1 min)

1. Go to **Settings → API** (in Supabase dashboard)
2. Copy these two values:
   - **Project URL** → looks like `https://xxxxx.supabase.co`
   - **anon public key** → starts with `eyJhbGciOi...`
3. Save these — you'll need them in Step 6

### Step 4: Enable Authentication (3 min)

**Option A — Email Magic Link (Easiest):**
1. Go to **Authentication → Providers** in Supabase
2. Email is enabled by default — you're done!

**Option B — Google Login (Recommended):**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Go to **APIs & Services → Credentials**
3. Click **"Create Credentials" → "OAuth client ID"**
4. Application type: **Web application**
5. Authorized redirect URI: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client Secret**
7. Back in Supabase: **Authentication → Providers → Google**
8. Enable it, paste Client ID and Secret, Save

### Step 5: Get Groq API Key — FREE (2 min)

1. Go to **[console.groq.com](https://console.groq.com)**
2. Sign up (free)
3. Go to **API Keys → Create API Key**
4. Copy the key (starts with `gsk_...`)
5. Free tier: **14,400 requests/day** — more than enough!

### Step 6: Setup the Code (5 min)

```bash
# Clone or download this project
# Then in your terminal:

cd jeni-bot

# Copy environment file
cp .env.example .env.local

# Edit .env.local and fill in your values:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
# GROQ_API_KEY=gsk_...

# Install dependencies
npm install

# Run locally
npm run dev
```

Open **http://localhost:3000** — you should see the Jeni login page!

### Step 7: Deploy to Vercel — FREE (5 min)

1. Push your code to **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Jeni Life OS v1"
   git remote add origin https://github.com/YOUR_USERNAME/jeni-bot.git
   git push -u origin main
   ```

2. Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub

3. Click **"Add New → Project"** → Import your `jeni-bot` repo

4. **Add Environment Variables** (Settings tab before deploying):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `GROQ_API_KEY` = your Groq key

5. Click **Deploy** → Wait 1-2 minutes

6. Your app is live at: `https://jeni-bot.vercel.app` 🎉

### Step 8: Add Your Data & Start Chatting!

1. Open your deployed app
2. Sign in with Google or email
3. Go to **◈ My Data** tab
4. Add your: Profile → Salary → EMIs → Subscriptions → Projects
5. Go to **✦ Jeni AI** tab
6. Start chatting! Try: "How's my money?" or "Project status"

---

## 📁 Project Structure

```
jeni-bot/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Redirect (auth check)
│   ├── globals.css             # Tailwind + custom styles
│   ├── login/page.tsx          # Login page (Google + Email)
│   ├── dashboard/page.tsx      # Main app (Chat + Overview + Data + Setup)
│   ├── auth/callback/route.ts  # OAuth callback handler
│   └── api/chat/route.ts       # AI chat endpoint (Groq + Context)
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── types.ts                # TypeScript types for all tables
│   └── context-engine.ts       # THE BRAIN — builds life context for AI
├── supabase-schema.sql         # Database schema (paste into SQL Editor)
├── .env.example                # Environment variables template
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Tech Stack (All Free)

| What | Tool | Cost |
|------|------|------|
| Frontend | Next.js 14 + Tailwind | Free |
| Database | Supabase (PostgreSQL) | Free (500MB) |
| Auth | Supabase Auth | Free |
| AI | Groq (Llama 3.3 70B) | Free (14K req/day) |
| Hosting | Vercel | Free |
| **Total** | | **₹0/month** |

---

Built with 🧠 for Somnath — *One dream at a time*
