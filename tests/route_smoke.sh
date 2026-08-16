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
for _ in {1..60}; do
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

robots_headers="$(mktemp -t tethyr-robots.XXXXXX.headers)"
robots_body="$(mktemp -t tethyr-robots.XXXXXX.body)"
curl -sS -D "${robots_headers}" -o "${robots_body}" "${BASE_URL}/robots.txt"
if ! grep -Fq "Sitemap: ${BASE_URL}/sitemap.xml" "${robots_body}" || ! grep -Fq "Disallow: /dashboard" "${robots_body}"; then
  echo "/robots.txt: expected sitemap and authenticated-route directives" >&2
  cat "${robots_body}" >&2
  rm -f "${robots_headers}" "${robots_body}"
  exit 1
fi
rm -f "${robots_headers}" "${robots_body}"
echo "ok /robots.txt sitemap and private paths"

sitemap_headers="$(mktemp -t tethyr-sitemap.XXXXXX.headers)"
sitemap_body="$(mktemp -t tethyr-sitemap.XXXXXX.body)"
curl -sS -D "${sitemap_headers}" -o "${sitemap_body}" "${BASE_URL}/sitemap.xml"
if ! grep -qi "content-type: application/xml" "${sitemap_headers}" || ! grep -Fq "<urlset" "${sitemap_body}" || ! grep -Fq "<loc>${BASE_URL}/</loc>" "${sitemap_body}"; then
  echo "/sitemap.xml: expected XML sitemap containing the homepage" >&2
  cat "${sitemap_headers}" >&2
  cat "${sitemap_body}" >&2
  rm -f "${sitemap_headers}" "${sitemap_body}"
  exit 1
fi
rm -f "${sitemap_headers}" "${sitemap_body}"
echo "ok /sitemap.xml XML and homepage"

private_robots="$(curl -sS -D - -o /dev/null "${BASE_URL}/dashboard" | tr -d '\r' | awk -F': ' 'tolower($1) == "x-robots-tag" { print $2; exit }')"
public_robots="$(curl -sS -D - -o /dev/null "${BASE_URL}/" | tr -d '\r' | awk -F': ' 'tolower($1) == "x-robots-tag" { print $2; exit }')"
if [[ "${private_robots}" != "noindex, nofollow, noarchive" ]] || [[ -n "${public_robots}" ]]; then
  echo "robots headers: expected private noindex and indexable homepage" >&2
  echo "dashboard=${private_robots@Q} homepage=${public_robots@Q}" >&2
  exit 1
fi
echo "ok robots headers (private noindex, public indexable)"
