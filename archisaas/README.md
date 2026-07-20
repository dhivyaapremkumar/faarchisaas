# ArchiSaaS — Setup Guide (Step 4 scaffold)

## What's in this scaffold
- `docker-compose.yml` — Postgres + FastAPI backend + React frontend + Caddy (reverse proxy; auto-HTTPS once you add a domain)
- `Caddyfile` — currently set up for plain HTTP on your VPS's IP address (no domain required to get started)
- `.env.example` — copy to `.env` and fill in real values
- `backend/` — FastAPI app with:
  - Multi-tenant Postgres Row-Level Security wired end to end
  - JWT auth (`/api/auth/login`)
  - A working example route (`/api/projects`) showing RLS auto-filtering data by org/role
  - Alembic migrations, including the RLS policy migration (`0002_enable_rls.py`)

## Deploying on your Hostinger VPS (no domain yet — using the VPS's IP address)

1. **SSH into your VPS** and install Docker + Docker Compose if not already present:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
   Log out and back in after this so the group change takes effect.

2. **Find your VPS's public IP address** — visible in your Hostinger control panel (VPS → Overview), or run this on the VPS itself:
   ```bash
   curl -4 ifconfig.me
   ```
   Write it down — you'll use it everywhere `YOUR_VPS_IP` appears below.

3. **Copy this project to the VPS.** Easiest if you push it to a private GitHub/GitLab repo first, then on the VPS:
   ```bash
   git clone <your-repo-url> archisaas
   cd archisaas
   ```
   (Or `scp -r archisaas/ user@YOUR_VPS_IP:/home/user/` from your local machine if you'd rather not use git yet.)

4. **Fill in your real API keys and secrets:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Specifically fill in:
   - `POSTGRES_PASSWORD` — pick a strong password
   - `DATABASE_URL` — update the password in this URL to match the line above
   - `JWT_SECRET` — generate one: `openssl rand -hex 32`, paste the output here
   - `OPENAI_API_KEY` — your real OpenAI key (this is what powers Hermes)
   - `STORAGE_BACKEND` — leave as `local`; files save straight to the VPS disk, no cloud signup or card needed
   - Leave `R2_*`, `EMAIL_*`, and `N8N_*` fields blank — not needed yet

5. **Set the frontend's API URL to your VPS IP:**
   ```bash
   cd frontend
   cp .env.example .env
   nano .env
   ```
   Set `VITE_API_BASE_URL=http://YOUR_VPS_IP/api` (replace with your real IP from step 2).
   ```bash
   cd ..
   ```

6. **The Caddyfile is already configured for IP-based HTTP** (no domain needed) — nothing to edit here for now.

7. **Bring the whole stack up:**
   ```bash
   docker compose up -d --build
   ```
   First build takes a few minutes (installing Python and Node dependencies). Watch progress with:
   ```bash
   docker compose logs -f
   ```

8. **Generate and run the initial migration** (one-time):
   ```bash
   docker compose exec backend alembic revision --autogenerate -m "initial"
   docker compose exec backend alembic upgrade head
   ```

9. **Verify the backend is alive:**
   ```bash
   curl http://YOUR_VPS_IP/health
   # should return {"status":"ok"}
   ```

10. **Seed your first organization, admin login, and pilot project:**
    ```bash
    docker compose exec backend python -m scripts.seed
    ```

11. **Open the app in your browser:** go to `http://YOUR_VPS_IP` — you should see the login page. Sign in with the email/password you just created.

## Important: open the right ports on Hostinger's firewall
Hostinger VPS instances often have a firewall panel separate from the OS. Make sure **port 80** is allowed for inbound traffic (Hostinger control panel → VPS → Firewall, or `ufw allow 80` on the VPS itself if using ufw). Port 443 isn't needed yet since there's no HTTPS without a domain — you'll open that when you add one.

## Adding a domain later (when you're ready)
1. Buy a domain (or use one you already have) and point an A record at `YOUR_VPS_IP`
2. Edit `Caddyfile`: replace `:80 {` with `your-domain.com {`
3. Edit `frontend/.env`: change `VITE_API_BASE_URL` to `https://your-domain.com/api`
4. Rebuild the frontend and restart Caddy:
   ```bash
   docker compose up -d --build frontend
   docker compose restart caddy
   ```
   Caddy automatically requests and installs a free HTTPS certificate — no other config needed.

## File storage: local disk by default (Step 6, updated)
No credit card or cloud signup needed to get started — files (drawings, meeting audio) are stored directly on your VPS disk by default, in a persistent Docker volume (`uploads_data`), so they survive container restarts and rebuilds.

Endpoints:
- `POST /api/drawings` — architects register a new drawing (e.g. "A-101, Floor Plan")
- `POST /api/drawings/{id}/revisions` — upload a revision file (multipart form: `revision_label`, `changelog`, `status`, `file`)
- `GET /api/drawings/{id}/revisions` — list revisions, auto-filtered by role:
  - Architects see everything
  - Vendors see only revisions matching their `trade` on that project membership
  - Clients see only `issued_for_construction` (final approved) revisions

**How local storage stays secure:** even without real cloud storage, files aren't served from permanent public URLs. Every download link is a time-limited, HMAC-signed token (`/api/files/{key}?expires=...&token=...`) generated fresh on each request and rejected by the server if expired or tampered with — the same security property R2's presigned URLs give you, just implemented directly. A removed vendor can't keep using an old bookmarked link.

**Switching to Cloudflare R2 later** (e.g. once you have a virtual card, or just want offsite backup + easier scaling):
1. Set up the bucket as described earlier in this README
2. In `.env`, change `STORAGE_BACKEND=local` to `STORAGE_BACKEND=r2` and fill in the `R2_*` values
3. `docker compose restart backend`
No code changes needed — same functions, different backend under the hood. Note: files already uploaded to local disk won't automatically migrate to R2; that's a manual copy step if you switch later with existing data.

**One limitation worth knowing:** local disk storage means your files live and die with this one VPS. If the VPS has a hardware failure or you need to move providers, you'll want a backup strategy (e.g. periodic `rsync` of `uploads_data` to another machine, or Hostinger's own backup feature if available) — cloud object storage like R2 handles this for you automatically, which is the main thing you're trading away by staying local for now.

## Hermes pipeline: Voice → MOM → Auto-Assigned Tasks (Step 7 — added)

Flow:
1. `POST /api/meetings` — architect uploads a site recording (multipart: `project_id`, `meeting_date`, `audio` file). Returns immediately with `status: processing`; transcription + drafting runs in the background (can take 30s-2min for a long recording).
2. `GET /api/meetings/{id}` — poll this to check `mom_status`. Once it's `pending_review`, you'll see the drafted MOM and a list of action items, each with a `suggested_assignee_name` (what the AI heard) and `assignee_user_id` (only filled in if matched with ≥72% confidence against a real project member).
3. `PATCH /api/meetings/{id}/action-items/{item_id}` — architect reviews and corrects: fix a misheard name, adjust a due date, manually assign anything left unassigned.
4. `POST /api/meetings/{id}/publish` — **only this step creates real Tasks** and notifies assignees. Nothing reaches another user's dashboard before a human has reviewed it — this is the core guardrail of the whole pipeline.

**Design principle worth understanding:** the LLM's output (`suggested_assignee_name`) is never trusted to write directly to `assignee_user_id`. A separate fuzzy-matching function (`app/services/matching.py`) checks it against real, active project members and only auto-assigns above a confidence threshold. Below that, the item stays `unassigned` and waits for the architect — this prevents a misheard name from silently assigning work to the wrong person.

**Note on background tasks:** this scaffold uses FastAPI's built-in `BackgroundTasks`, which runs in-process — fine for your pilot and low volume. Once you have several projects running concurrently, migrate this to a proper task queue (Celery + Redis, or RQ) so a slow transcription doesn't compete with your API server's request handling. Flagged here so it's not a surprise later.

## Frontend (Step 8 — added)

React + TypeScript + Tailwind, in `frontend/`. Design direction: "Drafting Table" — deep blueprint-navy shell, warm drafting-paper background, amber accent, drawing-number-style mono labels throughout (fitting the subject matter rather than a generic dashboard template).

**Local development:**
```bash
cd frontend
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```
Opens at `http://localhost:5173`, talking to your backend (local or VPS).

**What's built:**
- Login page
- Role-adaptive sidebar (`DashboardLayout`) — architects see Drawings/Meetings/Team, vendors see Tasks/Drawings, clients see Status/Drawings only
- Architect dashboard — live project list from `GET /api/projects`
- **Meeting review page** (`/meetings/:id`) — the human-in-the-loop UI for the Hermes pipeline: shows drafted action items, who they were matched to, confidence scores, and the "Publish & assign tasks" button that triggers real task creation
- Vendor dashboard — currently uses placeholder task data (marked clearly in the code); wire it to a real `GET /api/tasks?assigned_to=me` endpoint (natural next backend addition, the `Task` model already supports it)
- Client dashboard — read-only project status

**Deploying with the rest of the stack:** the frontend now has its own Dockerfile (multi-stage: builds the React app, serves it via Nginx) and is wired into `docker-compose.yml` and the `Caddyfile` — Caddy routes `/api/*` to the backend and everything else to the frontend. Same `docker compose up -d --build` command from Step 4 builds everything together.

## What's NOT in this scaffold yet (next steps)
- User/org signup endpoints (only login exists — you'll seed your first org+user directly via the seed script for your pilot)
- Manual per-vendor drawing access grants (currently trade-auto-match only — override table is a fast follow)
- `GET /api/tasks` endpoint (vendor dashboard is UI-ready, waiting on this)
- Drawings and meetings list/upload UI pages (routes are stubbed as sidebar links; the review page and API layer are built, list/upload screens are the next UI work)
- n8n container + notification workflows (webhook call is wired, n8n side needs building)
- Help/FAQ chatbot (RAG)
- Moving background tasks to a real queue (Celery/RQ) once you outgrow in-process processing

We'll build these in the following steps.
