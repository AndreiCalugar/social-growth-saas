#!/usr/bin/env bash
# verify-setup.sh — checks that all dev infrastructure is healthy

set -euo pipefail

# Load .env from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "ERROR: .env file not found at $ENV_FILE"
  exit 1
fi

PASS="✓"
FAIL="✗"
WARN="!"
ERRORS=0

check() {
  local label="$1"
  local result="$2"  # "ok" or anything else = fail
  local detail="${3:-}"

  if [[ "$result" == "ok" ]]; then
    echo "  $PASS  $label"
    [[ -n "$detail" ]] && echo "       $detail"
  else
    echo "  $FAIL  $label"
    [[ -n "$detail" ]] && echo "       $detail"
    ERRORS=$((ERRORS + 1))
  fi
}

echo ""
echo "========================================"
echo "  Social Growth SaaS — Setup Verifier"
echo "========================================"
echo ""

# --- 1. Docker ---
echo "[ Docker ]"
if docker info &>/dev/null; then
  DOCKER_VERSION=$(docker version --format '{{.Client.Version}}' 2>/dev/null)
  check "Docker daemon running" "ok" "v$DOCKER_VERSION"
else
  check "Docker daemon running" "fail" "Run: open -a Docker"
fi

# --- 2. n8n container ---
echo ""
echo "[ n8n ]"
N8N_STATUS=$(docker inspect n8n --format '{{.State.Status}}' 2>/dev/null || echo "not_found")
if [[ "$N8N_STATUS" == "running" ]]; then
  check "n8n container running" "ok" "docker ps: $N8N_STATUS"
else
  check "n8n container running" "fail" "Status: $N8N_STATUS — run: docker compose up -d"
fi

N8N_HEALTH=$(curl -sf --max-time 5 http://localhost:5678/healthz 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "unreachable")
if [[ "$N8N_HEALTH" == "ok" ]]; then
  check "n8n HTTP health check" "ok" "http://localhost:5678/healthz → {status: ok}"
else
  check "n8n HTTP health check" "fail" "Got: $N8N_HEALTH"
fi

# --- 3. Apify ---
echo ""
echo "[ Apify API ]"
if [[ -z "${APIFY_API_TOKEN:-}" ]]; then
  check "APIFY_API_TOKEN set" "fail" "Not found in .env"
else
  check "APIFY_API_TOKEN set" "ok" "${APIFY_API_TOKEN:0:12}..."
  APIFY_RESP=$(curl -sf --max-time 10 \
    -H "Authorization: Bearer $APIFY_API_TOKEN" \
    "https://api.apify.com/v2/users/me" 2>/dev/null || echo "error")
  if echo "$APIFY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['username'])" &>/dev/null; then
    APIFY_USER=$(echo "$APIFY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['username'])")
    check "Apify API connection" "ok" "Authenticated as: $APIFY_USER"
  else
    check "Apify API connection" "fail" "Check your APIFY_API_TOKEN in .env"
  fi
fi

# --- 4. Supabase ---
echo ""
echo "[ Supabase ]"
if [[ -z "${Project_URL:-}" ]]; then
  check "Project_URL set" "fail" "Not found in .env"
else
  check "Project_URL set" "ok" "$Project_URL"
  # Any response from Supabase (even 403 on schema listing) confirms connectivity
  SUPA_HTTP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" \
    -H "apikey: ${SUPABASE_ANON_KEY:-}" \
    "$Project_URL/rest/v1/" 2>/dev/null || echo "000")
  if [[ "$SUPA_HTTP" != "000" ]] && [[ -n "$SUPA_HTTP" ]]; then
    check "Supabase REST API reachable" "ok" "$Project_URL (HTTP $SUPA_HTTP)"
  else
    check "Supabase REST API reachable" "fail" "No response — check Project_URL in .env"
  fi
fi

# --- 5. Claude API ---
echo ""
echo "[ Claude API ]"
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  check "ANTHROPIC_API_KEY set" "fail" "Not found in .env"
else
  check "ANTHROPIC_API_KEY set" "ok" "${ANTHROPIC_API_KEY:0:12}..."
  CLAUDE_RESP=$(curl -s --max-time 10 \
    -X POST "https://api.anthropic.com/v1/messages" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}' \
    2>/dev/null || echo "")
  if echo "$CLAUDE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('type')=='message' else 1)" &>/dev/null; then
    check "Claude API connection" "ok" "POST /v1/messages → 200"
  elif echo "$CLAUDE_RESP" | grep -q "credit balance"; then
    echo "  $WARN  Claude API connection"
    echo "       Key is valid but has no credits."
    echo "       Add credits at: https://console.anthropic.com → Plans & Billing"
    ERRORS=$((ERRORS + 1))
  elif echo "$CLAUDE_RESP" | grep -q "invalid_api_key\|authentication"; then
    check "Claude API connection" "fail" "401 Unauthorized — check ANTHROPIC_API_KEY in .env"
  else
    check "Claude API connection" "fail" "Unexpected response — check key or network"
  fi
fi

# --- Summary ---
echo ""
echo "========================================"
if [[ $ERRORS -eq 0 ]]; then
  echo "  All checks passed. You're good to go!"
else
  echo "  $ERRORS check(s) failed. Fix the issues above."
fi
echo "========================================"
echo ""

exit $ERRORS
