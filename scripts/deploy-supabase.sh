#!/bin/bash
# Helper to link a Supabase project, set secrets, and deploy Edge Functions for xBase (Donate Form)

set -euo pipefail

echo "========================================"
echo " xBase Supabase Edge Functions Deploy"
echo "========================================"
echo
echo "Prerequisites:"
echo "  - supabase CLI installed (npm i -g supabase)"
echo "  - Run 'supabase login' for the target account"
echo

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found. Install via: npm install -g supabase"
  exit 1
fi

# Best-effort load of project ref from env files (no secrets stored here)
PROJECT_REF_FROM_ENV=""
SUPABASE_URL_FROM_ENV=""
for ENV_FILE in .env.local .env.deploy; do
  if [[ -f "${ENV_FILE}" ]]; then
    URL_LINE=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "${ENV_FILE}" | tail -n1 || true)
    if [[ -n "${URL_LINE}" ]]; then
      SUPABASE_URL_FROM_ENV=$(echo "${URL_LINE#NEXT_PUBLIC_SUPABASE_URL=}" | tr -d '"'\')
      PROJECT_REF_FROM_ENV=$(echo "${SUPABASE_URL_FROM_ENV}" | sed -E 's@https?://([^.]+)\.supabase\.co.*@\1@')
      break
    fi
  fi
done

DEFAULT_REF_PROMPT=""
if [[ -n "${PROJECT_REF_FROM_ENV}" ]]; then
  DEFAULT_REF_PROMPT=" [${PROJECT_REF_FROM_ENV}]"
fi

read -rp "Enter Supabase project ref${DEFAULT_REF_PROMPT}: " PROJECT_REF
PROJECT_REF=${PROJECT_REF:-$PROJECT_REF_FROM_ENV}

if [[ -z "${PROJECT_REF}" ]]; then
  echo "Project ref is required."
  exit 1
fi

# Link project
echo
echo "Linking project..."
supabase link --project-ref "${PROJECT_REF}"

# Collect secrets (do not store locally)
echo
echo "Enter Xaman / destination secrets (input hidden):"
read -rsp "  XUMM_API_KEY: " XUMM_API_KEY && echo
read -rsp "  XUMM_API_SECRET: " XUMM_API_SECRET && echo
read -rsp "  XAH_DESTINATION (r-address): " XAH_DESTINATION && echo
read -rsp "  SB_SERVICE_ROLE_KEY (optional, for DB writes): " SB_SERVICE_ROLE_KEY && echo

SUPABASE_URL="${SUPABASE_URL_FROM_ENV:-https://${PROJECT_REF}.supabase.co}"
echo
echo "Using SUPABASE_URL: ${SUPABASE_URL}"

# Set secrets
echo
echo "Setting Supabase secrets..."
supabase secrets set \
  XUMM_API_KEY="${XUMM_API_KEY}" \
  XUMM_API_SECRET="${XUMM_API_SECRET}" \
  XAH_DESTINATION="${XAH_DESTINATION}" \
  SB_URL="${SUPABASE_URL}" \
  SB_SERVICE_ROLE_KEY="${SB_SERVICE_ROLE_KEY}"

# Deploy functions
echo
echo "Deploying Edge Functions..."
supabase functions deploy xaman-createPayload
supabase functions deploy xaman-webhook --no-verify-jwt

echo
echo "✅ Supabase Edge Functions deployed for project ${PROJECT_REF}"
echo "Remember to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local/.env.deploy."
