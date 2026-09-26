# Deploy OPflow for Doctors (Vercel + the existing Render API)

About 10 minutes. You need: the `opflow-doctor` GitHub repo with this folder's contents, your Vercel account,
and your Render dashboard (the `opflow-backend` service).

## 1. One shared secret

Make one random secret (48+ characters). For example, in any terminal:

```bash
node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
```

Keep it private. The same value goes to Vercel **and** Render below.

## 2. Vercel (the website)

1. vercel.com → **Add New… → Project** → import the `opflow-doctor` repo. Framework: **Next.js** (found by itself).
2. **Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `DOCTOR_API_BASE_URL` | `https://opflow-backend.onrender.com` |
   | `NEXT_PUBLIC_LIVE_URL` | `https://opflow-backend.onrender.com` |
   | `DOCTOR_WEB_KEY` | the secret from step 1 |

3. **Deploy.** The address will be `https://opflow-doctor.vercel.app` (or the name Vercel shows; use that below).

## 3. Render (the API)

Dashboard → `opflow-backend` → **Environment** → add:

| Name | Value |
|---|---|
| `DOCTOR_WEB_KEY` | the same secret |
| `DOCTOR_WEB_ORIGIN` | `https://opflow-doctor.vercel.app` (your exact Vercel address, no slash at the end) |

**Save changes** (Render restarts the API by itself). No database change is needed.

## 4. Check

1. Open the Vercel address → **Doctor login** page.
2. Log in with a doctor's OPD ID and password (from the admin site). First time: set a new password.
3. **Today** shows the OPD; top-right shows **LIVE** (green) — the live line works.
4. On the doctor's phone, the app is still signed in.

## Later: your own address (e.g. doctor.opflow.in)

Vercel → Project → **Settings → Domains** → add `doctor.opflow.in` and add the DNS record Vercel shows at your
domain provider. Then change `DOCTOR_WEB_ORIGIN` on Render to the new address.

## If something is wrong

| You see | Fix |
|---|---|
| "The OPflow server cannot be reached" | `DOCTOR_API_BASE_URL` on Vercel; the Render service is running |
| **CHECKING** instead of **LIVE** on Today | `NEXT_PUBLIC_LIVE_URL` on Vercel (then **Redeploy**: it is built into the page) |
| Every doctor gets "Too many tries" at sign-in | `DOCTOR_WEB_KEY` missing or different on Vercel / Render |
