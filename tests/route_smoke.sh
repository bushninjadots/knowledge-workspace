#!/usr/bin/env bash
set -euo pipefail

HOST="127.0.0.1"
PORT="${TETHYR_SMOKE_PORT:-4173}"
BASE_URL="http://${HOST}:${PORT}"
LOG_FILE="$(mktemp -t tethyr-smoke.XXXXXX.log)"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -f "${LOG_FILE}"
}
trap cleanup EXIT

bun run dev -- --host "${HOST}" --port "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

ready="false"
for _ in {1..30}; do
  if curl -fsS "${BASE_URL}/" >/dev/null 2>&1; then
    ready="true"
    break
  fi
  sleep 1
done

if [[ "${ready}" != "true" ]]; then
  cat "${LOG_FILE}"
  echo "Smoke server did not become ready" >&2
  exit 1
fi

if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  cat "${LOG_FILE}"
  echo "Smoke server exited before becoming ready" >&2
  exit 1
fi

check_route() {
  local path="$1"
  local expected_title="$2"
  local body_file
  body_file="$(mktemp -t tethyr-route.XXXXXX.html)"

  local status
  status="$(curl -sS -o "${body_file}" -w '%{http_code}' "${BASE_URL}${path}")"
  if [[ "${status}" != "200" ]]; then
    echo "${path}: expected HTTP 200, got ${status}" >&2
    cat "${body_file}" >&2
    rm -f "${body_file}"
    exit 1
  fi
  if ! grep -Fq "${expected_title}" "${body_file}"; then
    echo "${path}: response did not contain ${expected_title@Q}" >&2
    rm -f "${body_file}"
    exit 1
  fi
  rm -f "${body_file}"
  echo "ok ${path} (${status})"
}

check_route "/" "Tethyr"
check_route "/login" "Log in"
check_route "/signup" "Sign up"
check_route "/skills/typescript" "Tethyr"
status="$(curl -sS -o /tmp/tethyr-invalid-route.html -w '%{http_code}' "${BASE_URL}/this-route-does-not-exist")"
if [[ "${status}" != "404" ]] || ! grep -Fq "Page not found" /tmp/tethyr-invalid-route.html; then
  echo "/this-route-does-not-exist: expected HTTP 404 with a Page not found state, got ${status}" >&2
  cat /tmp/tethyr-invalid-route.html >&2
  rm -f /tmp/tethyr-invalid-route.html
  exit 1
fi
rm -f /tmp/tethyr-invalid-route.html
echo "ok /this-route-does-not-exist (${status})"

# Authenticated routes use a client-side auth boundary (`ssr: false`), so
# signed-out HTTP requests receive the app shell and the browser redirects to login.
status="$(curl -sS -o /tmp/tethyr-dashboard.html -w '%{http_code}' "${BASE_URL}/dashboard")"
if [[ "${status}" != "200" ]]; then
  echo "/dashboard: expected the client-auth app shell (HTTP 200), got ${status}" >&2
  rm -f /tmp/tethyr-dashboard.html
  exit 1
fi
rm -f /tmp/tethyr-dashboard.html
echo "ok /dashboard client auth boundary (${status})"
