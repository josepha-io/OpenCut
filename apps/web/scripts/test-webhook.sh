#!/usr/bin/env bash
#
# Test the create-project webhook endpoint locally.
#
# Prerequisites:
#   1. The Next.js dev server is running: cd apps/web && bun dev
#   2. PostgreSQL + Docker are running: docker compose up -d
#   3. A user exists (run scripts/create-user.ts first)
#
# Usage:
#   cd apps/web
#   bash scripts/test-webhook.sh
#
# This uses "inline" mode (no Airtable credentials required).

set -euo pipefail

BASE_URL="${SITE_URL:-http://localhost:3000}"
AUTH_TOKEN="${WEBHOOK_AUTH_TOKEN:-local-dev-webhook-token}"

echo "Testing webhook at ${BASE_URL}/api/webhooks/create-project"
echo ""

# --- Test 1: Inline mode (no Airtable) ---
echo "=== Test 1: Inline mode — create project with demo format ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/webhooks/create-project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "mode": "inline",
    "contentId": "test-webhook-001",
    "format": "demo",
    "driveLink": "https://drive.google.com/file/d/fake-test-id/view",
    "videoDuration": 30,
    "videoWidth": 1080,
    "videoHeight": 1920,
    "hook": "This changed everything",
    "fieldValues": {
      "cta_text": "Shop now at example.com"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "Status: ${HTTP_CODE}"
echo "Response: ${BODY}"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Project created successfully"
  PROJECT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['projectId'])" 2>/dev/null || echo "")
  if [ -n "$PROJECT_ID" ]; then
    echo "  Project ID: ${PROJECT_ID}"
    echo ""

    # Verify project exists in DB via GET
    echo "=== Verifying project via API ==="
    VERIFY=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/projects/${PROJECT_ID}" \
      -H "Cookie: $(curl -s -c - "${BASE_URL}" 2>/dev/null | grep -v '^#' | awk '{print $6"="$7}' | tr '\n' ';')" 2>/dev/null || echo "skip")
    echo "  GET /api/projects/${PROJECT_ID} → ${VERIFY}"
    echo "  (Note: may return 401 if not logged in — that's expected in this test)"
  fi
else
  echo "✗ Failed with status ${HTTP_CODE}"
fi

echo ""

# --- Test 2: Unauthorized request ---
echo "=== Test 2: Unauthorized request (no token) ==="
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/webhooks/create-project" \
  -H "Content-Type: application/json" \
  -d '{"mode":"inline","contentId":"x","format":"x","driveLink":"x","videoDuration":1}')

if [ "$UNAUTH_CODE" = "401" ]; then
  echo "✓ Correctly rejected (401)"
else
  echo "✗ Expected 401, got ${UNAUTH_CODE}"
fi

echo ""

# --- Test 3: Invalid request ---
echo "=== Test 3: Invalid request body ==="
INVALID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/webhooks/create-project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"bad":"data"}')

if [ "$INVALID_CODE" = "400" ]; then
  echo "✓ Correctly rejected (400)"
else
  echo "✗ Expected 400, got ${INVALID_CODE}"
fi

echo ""
echo "Done."
