#!/usr/bin/env bash
# scripts/smoke-test-prod.sh
# Usage: FIREBASE_URL=https://us-central1-PROJECT.cloudfunctions.net/bgg \
#        BGG_USERNAME=you BGG_PASSWORD=secret bash scripts/smoke-test-prod.sh
set -euo pipefail

BASE="${FIREBASE_URL:?FIREBASE_URL required}"
USERNAME="${BGG_USERNAME:?BGG_USERNAME required}"
PASSWORD="${BGG_PASSWORD:?BGG_PASSWORD required}"

# Trim any trailing slash from BASE
BASE="${BASE%/}"

echo "=== [1] Collection read via Firebase Function (202 poll loop) ==="
MAX_RETRIES=8
for i in $(seq 1 $MAX_RETRIES); do
  RESP=$(curl -si "${BASE}?path=/xmlapi2/collection?username=${USERNAME}&own=1&subtype=boardgame" 2>&1)
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
echo "=== [2] Login via Firebase Function (extract sessionId from JSON body) ==="
LOGIN_RESP=$(curl -si -X POST "${BASE}?path=/login/api/v1" \
  -H "Content-Type: application/json" \
  -d "{\"credentials\":{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}}")
LOGIN_STATUS=$(echo "$LOGIN_RESP" | grep -m1 "^HTTP" | awk '{print $2}')
echo "  HTTP $LOGIN_STATUS"

RESP_BODY=$(echo "$LOGIN_RESP" | tail -1)
echo "  Response body: ${RESP_BODY:0:200}"

# In prod, Firebase Function extracts sessionid and returns as JSON { "sessionId": "..." } (D-07)
SESSION_ID=$(echo "$RESP_BODY" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || true)

if [ -z "$SESSION_ID" ]; then
  echo "  [WARN] sessionId not in JSON body — checking Set-Cookie header (defensive fallback)"
  SESSION_ID=$(echo "$LOGIN_RESP" | grep -i "set-cookie" | grep -o "sessionid=[^;]*" | cut -d= -f2 || true)
fi

if [ -z "$SESSION_ID" ]; then
  echo "  [FAIL] Could not extract session ID from login response"
  echo "  Response: $(echo "$LOGIN_RESP" | tail -3)"
  exit 1
fi
echo "  [OK] Got session ID (${#SESSION_ID} chars)"

echo ""
echo "=== [3] Write one rating via Firebase Function (geekrating) ==="
# Game ID 174430 = Gloomhaven — safe test target
# Send session token as X-BGG-Session header; Function reattaches as Cookie: sessionid=... (D-08)
WRITE_RESP=$(curl -si -X POST "${BASE}?path=/api/geekrating" \
  -H "X-BGG-Session: ${SESSION_ID}" \
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
