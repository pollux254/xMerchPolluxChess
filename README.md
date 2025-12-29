# 🧱 xBase — Build on Xahau with xMerch

> 🧩 **Developer Starter Template**  
> Build trustless commerce apps using **Next.js + Xaman + Xahau** with Supabase Edge Functions for secret storage.

xBase is the default template included with the **xMerch CLI**.  
It scaffolds a fully working Web3-native dApp wired for:

- 🔐 Xaman (Xumm) authentication  
- 💸 Xahau payment payloads  
- 🗄️ Supabase Edge Functions to keep API secrets out of Docker/Evernode  
- ⚡ Real-time on-chain donation / micro-payments  
- 🎨 Next.js 16 + Tailwind + Framer Motion  
- 🛡️ Clean, minimal backend API routes  

No backend servers required — fully serverless.

---

## 🚀 Quick Start

```bash
pnpm dlx xmerch create
cd xbase-project
pnpm dev
```

This generates a full working dApp with:

- `.env.local` (auto-copied)
- `.gitignore` (auto-copied)
- Donation UI connected to Xaman
- API route for creating Xahau payment payloads

> Before accepting donations, deploy the Supabase Edge Functions (keeps Xaman secrets out of the container). See `supabase/README.md` for commands.

Edge functions via CLI helper:

```bash
xmerch deploy --edge   # links project, sets secrets, deploys functions
```

Visit:

```bash
http://localhost:3000
```

---

## 🧰 Environment Variables

Your newly generated `.env.local` needs real values before running:

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_BASE_URL | Local/production URL |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL (public) — Supabase Dashboard → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key (public) — Supabase Dashboard → Settings → API |
| NEXT_PUBLIC_XAHAU_NETWORK_ID | Xahau network (default 21337) |
| EVERNODE_PRIVATE_KEY | Evernode key (if deploying there) |
| COINMARKETCAP_API_KEY (optional) | XAH → USD pricing feed |

Optional local dev (fallback if Supabase isn’t configured; do NOT commit real values):

- XUMM_API_KEY
- XUMM_API_SECRET
- XAH_DESTINATION
- NEXT_PUBLIC_XAHAU_NETWORK_ID (default 21337)

For Docker deploys, fill the separate `.env.deploy` (auto-copied, gitignored) with:

| Variable | Description |
|----------|-------------|
| DOCKER_USERNAME | Your Docker Hub username |
| DOCKER_PERSONAL_ACCESS_TOKEN | Docker Hub token (preferred over password) |
| DOCKER_NAMESPACE | Your org/namespace; use your username if you have no org |
| NEXT_PUBLIC_BASE_URL | Your deployed domain |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| NEXT_PUBLIC_XAHAU_NETWORK_ID | Xahau network (default 21337) |

You can obtain Xaman credentials at:

👉 <https://apps.xaman.dev>

---

## 🔐 Supabase Edge Functions (required)

Secrets live in Supabase Vault, not in your Docker/Evernode container. Deploy the two functions inside `supabase/functions/`:

```bash
# Link project once
supabase link --project-ref <YOUR_PROJECT_REF>

# Store secrets (set these in Supabase, not in .env.local)
supabase secrets set \
  XUMM_API_KEY=your_xaman_app_key \
  XUMM_API_SECRET=your_xaman_app_secret \
  XAH_DESTINATION=your_xahau_raddress \
  SB_URL=https://<your-project>.supabase.co \
  SB_SERVICE_ROLE_KEY=your_service_role_key

# Deploy functions (webhook requires no JWT)
supabase functions deploy xaman-createPayload
supabase functions deploy xaman-webhook --no-verify-jwt
```

Then set in `.env.local` (and production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BASE_URL`.

Shortcut: run `./scripts/deploy-supabase.sh` to link, set secrets (prompted), and deploy the functions (webhook uses `--no-verify-jwt`).
CI option: the generated repo includes `.github/workflows/deploy-edge-functions.yml` (from `git.example`). Add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` as GitHub secrets to auto-deploy functions on push to `main`.

---

## 📁 Project Structure

```bash
xbase-project/
│
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── xaman/
│   │           ├── create-payload/xahau-payload/route.ts   # proxies to Supabase Edge Function
│   │           └── webhook/xahau/route.ts                  # (legacy) webhook handler
│   ├── favicon.ico
│   ├── globals.css
│   └── page.tsx                                            # donation UI
│
├── lib/
│   └── xahau-payload.ts                                    # reusable payload builder
│
├── public/
│   └── next.svg
│
├── supabase/
│   ├── README.md
│   ├── config.toml
│   └── functions/
│       ├── xaman-createPayload/
│       └── xaman-webhook/
│
├── .github/
│   └── workflows/
│       └── deploy-edge-functions.yml
│
├── env.example                                              # copied → .env.local
├── env.deploy.example                                       # copied → .env.deploy (gitignored)
├── gitignore.example                                        # copied → .gitignore
├── package.json
├── tailwind.config.ts
└── README.md
```

---

# ⚡ Donation Flow Overview

### **1. Frontend (page.tsx)**  

User selects a donation amount (10, 50, 100 XAH).  
Clicking **Donate** triggers:

```tsx
const res = await fetch("/api/auth/xaman/create-payload/xahau-payload", {
  method: "POST",
  body: JSON.stringify({ amount }),
});
```

---

### **2. Backend (route.ts)**  

The Next.js route proxies to the Supabase Edge Function (where the Xaman secrets live). If Supabase isn’t configured, it falls back to local env (XUMM_API_KEY/XUMM_API_SECRET/XAH_DESTINATION) for development. The function builds the payload and returns:

```json
{ "nextUrl": "xumm://...", "uuid": "...", "qrUrl": "https://..." }
```

---

### **3. User Signs Transaction**  

Xaman opens automatically (mobile)  
or in a new window (desktop).

---

### **4. Webhook Receiver**  

Handled in Supabase (`supabase/functions/xaman-webhook`). It validates the transaction with Xaman and, if provided `SB_SERVICE_ROLE_KEY`, can write a record to your `donations` table. Extend this function for receipts, rewards, memberships, NFT issuance, etc.

---

## 🧪 Payload Builder (Reusable)

`lib/xahau-payload.ts` contains a fully typed payload generator:

```ts
export function buildXahauPaymentPayload(amount, destination, memo?)
```

Includes:

- NetworkID  
- Memo hex encoding  
- Expiration  
- Safe default flags  
- Drop conversion  

This keeps API routes clean.

---

## 🎨 UI & Styling

xBase uses:

- **Next.js 16 (App Router + Turbopack)**
- **Tailwind CSS v4**
- **Framer Motion**

Everything is intentionally minimal, so developers can:

- Theme the donation flow
- Extend components
- Create storefront layouts
- Add modals and animations

---

## 🐳 Docker Deploy

**Checklist**

1) Run edge deploy first (secrets in Supabase):

```bash
xmerch deploy --edge
```

2) Optional build to catch errors before image build:

```bash
pnpm build
```

3) Fill `.env.deploy` with Docker creds + public build-time env (`NEXT_PUBLIC_BASE_URL` = your deployed domain, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_XAHAU_NETWORK_ID`).

**Commands**

```bash
set -a
source .env.deploy
set +a
xmerch deploy --docker --dry-run

# Real push
set -a
source .env.deploy
set +a
xmerch deploy --docker
```

Tip: `.dockerignore` keeps `node_modules`/`.next` out of the image; don’t copy local `node_modules` into the build context.

### Tagging / registry notes
- By default the image is pushed to `DOCKER_NAMESPACE/DOCKER_USERNAME` with tag `latest`.
- To customize, set `DOCKER_NAMESPACE` (defaults to `DOCKER_USERNAME`) and `DEPLOY_TAG` in `.env.deploy` (e.g., `DEPLOY_TAG=prod-2025-01-01`).
- The final image name will be `DOCKER_NAMESPACE/xbase:${DEPLOY_TAG}`.

## 🌐 Evernode Deploy (manual)

If you’re targeting Evernode, do this **before** running the Docker commands above:

1) Pick host + subdomain (before you build):  
   Hosts: `evernode1.zerp.network` … `evernode5.zerp.network`  
   Choose a unique subdomain, e.g., `myapp` → `https://myapp.zerp.network`

2) Set `.env.deploy` to match that subdomain:
```bash
NEXT_PUBLIC_BASE_URL="https://<SUBDOMAIN>.zerp.network"
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
NEXT_PUBLIC_XAHAU_NETWORK_ID="21337"
```

3) Build/push with the subdomain in the tag:
```bash
<DOCKER_NAMESPACE>/xbase:<TAG>--gptcp1--3000--subdomain--<SUBDOMAIN>--proxyssl--false
```

4) Deploy on the Evernode host. Public envs are baked into the image; secrets stay in Supabase.

## 🧱 Suggested Next Steps

- Add additional payment actions  
- Connect Supabase or custom backend  
- Implement NFT access keys  
- Add multi-step forms  
- Create custom hook triggers  
- Deploy to **Vercel** or integrate **Evernode** (coming soon via evrPanel API)  

---

## 🔗 Helpful Resources

- Xaman Dev Dashboard → <https://apps.xaman.dev>  
- Xahau Docs → <https://xahau.network>  
- Hooks Docs → <https://hooks.xahau.network>  
- xMerch CLI Repo → <https://github.com/mworks-proj/xmerch-cli>  

---

## 📄 License

MIT © 2025 MWorks Design LLC
