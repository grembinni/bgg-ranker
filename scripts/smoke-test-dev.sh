#!/usr/bin/env bash
# scripts/smoke-test-dev.sh
# Usage: BGG_USERNAME=you BGG_PASSWORD=secret bash scripts/smoke-test-dev.sh
set -euo pipefail

BASE="${VITE_BGG_API_BASE:-http://localhost:5173/bggapi}"
USERNAME="${BGG_USERNAME:?BGG_USERNAME required}"
PASSWORD="${BGG_PASSWORD:?BGG_PASSWORD required}"

echo "=== [1] Collection read (202 poll loop) ==="
MAX_RETRIES=8
for i in $(seq 1 $MAX_RETRIES); do
  RESP=$(curl -si "${BASE}/xmlapi2/collection?username=${USERNAME}&own=1&subtype=boardgame" 2>&1)
  STATUS=$(echo "$RESP" | grep -m1 "^HTTP" | awk '{print $2}')
  echo "  Attempt $i: HTTP $STATUS"
  if [ "$STATUS" = "200" ]; then
    BODY=$(echo "$RESP" | tail -c 200)
    echo "  Body (first 200 chars): ${BODY:0:200}"
    echo "  [OK] Collection read succeeded"
    break
  elif [ "$STATUS" = "202" ]; then
    echo "  BGG queued — waiting 3s..."
    sleep 3
  else
    echo "  [FAIL] Unexpected status $STATUS"
    exit 1
  fi
  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "  [FAIL] Timed out waiting for collection"
    exit 1
  fi
done

echo ""
echo "=== [2] Login (extract sessionId) ==="
LOGIN_RESP=$(curl -si -X POST "${BASE}/login/api/v1" \
  -H "Content-Type: application/json" \
  -d "{\"credentials\":{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}}")
LOGIN_STATUS=$(echo "$LOGIN_RESP" | grep -m1 "^HTTP" | awk '{print $2}')
echo "  HTTP $LOGIN_STATUS"

# In dev, extract sessionid from Set-Cookie header (Vite proxy doesn't transform login response)
SESSION_ID=$(echo "$LOGIN_RESP" | grep -i "set-cookie" | grep -o "sessionid=[^;]*" | cut -d= -f2 || true)

if [ -z "$SESSION_ID" ]; then
  echo "  [WARN] sessionid not in Set-Cookie — checking JSON body"
  SESSION_ID=$(echo "$LOGIN_RESP" | tail -1 | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || true)
fi

if [ -z "$SESSION_ID" ]; then
  echo "  [FAIL] Could not extract session ID from login response"
  echo "  Response: $(echo "$LOGIN_RESP" | tail -3)"
  exit 1
fi
echo "  [OK] Got session ID (${#SESSION_ID} chars)"

echo ""
echo "=== [3] Write one rating (geekrating) ==="
# Game ID 174430 = Gloomhaven — safe test target
WRITE_RESP=$(curl -si -X POST "${BASE}/api/geekrating" \
  -H "Cookie: sessionid=${SESSION_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "objectid=174430&objecttype=thing&rating=7")
WRITE_STATUS=$(echo "$WRITE_RESP" | grep -m1 "^HTTP" | awk '{print $2}')
WRITE_BODY=$(echo "$WRITE_RESP" | tail -1)
echo "  HTTP $WRITE_STATUS"
echo "  Body (first 200 chars): ${WRITE_BODY:0:200}"
if [[ "$WRITE_STATUS" =~ ^2 ]]; then
  echo "  [OK] Write rating succeeded"
else
  echo "  [WARN] Write returned $WRITE_STATUS — verify geekrating endpoint format (undocumented, Assumption A1)"
fi

echo ""
echo "=== Smoke test complete ==="
