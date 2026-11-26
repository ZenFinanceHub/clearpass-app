#!/usr/bin/env bash
# One-time setup of the production gates. Run by the repository OWNER (Craig),
# logged in to the GitHub CLI as the owner, from a clone of the repo. Read it
# before running it. Each part is safe to re-run (e.g. to rotate a secret).
#
#   1. Release gate, AFTER creating the "clearpass-release" GitHub App
#      (Prompt 4 in the plan):
#        bash .github/release/setup-release-gate.sh <APP_CLIENT_ID> <path/to/private-key.pem>
#      - environment `production-release`: reviewer = owner, admins cannot
#        bypass, deployments only from `main`;
#      - variable RELEASE_APP_CLIENT_ID (not secret);
#      - secret RELEASE_APP_PRIVATE_KEY, straight from the file (never printed);
#      - branch `release-gate-test` at production's commit, if missing;
#      - deletes the downloaded key file.
#
#   2. OTA gate (ota-production.yml, ota-rollback.yml):
#        bash .github/release/setup-release-gate.sh ota <path/to/production.env> [path/to/expo-token-file]
#      - environment `ota-build`: NO reviewers, `main` only. Holds the public
#        EXPO_PUBLIC_* client values (RevenueCat SDK keys, Sentry DSN, ...),
#        taken from <production.env>. They are stored as environment secrets
#        only so GitHub masks them in the public logs; they grant nothing.
#        Create that file from the EAS production environment, in
#        apps/mobile, as yourself:
#          npx eas-cli env:pull production --path "$HOME/production.env"
#        Only EXPO_PUBLIC_* lines are used; the file is deleted afterwards
#        (it may also contain non-public values).
#      - environment `production-ota`: reviewer = owner, admins cannot
#        bypass, `main` only. Secret EXPO_TOKEN: an Expo ROBOT token
#        (expo.dev → account craigyp1982 → Settings → Access tokens → robot
#        user with the Developer role → token). From the file if given (the
#        file is deleted afterwards), otherwise typed at a hidden prompt.
#
#   3. Database gate (migrate-production.yml):
#        bash .github/release/setup-release-gate.sh db [path/to/db-url-file]
#      - environment `production-db`: reviewer = owner, admins cannot bypass,
#        `main` only.
#      - secret SUPABASE_DB_URL: the session-pooler connection string (port
#        5432, password percent-encoded). From the file if given; otherwise
#        built from ~/.config/clearpass/db.env exactly as
#        apps/mobile/server/scripts/lib/dbCreds.js does; otherwise typed at a
#        hidden prompt.
#
# No secret value is ever echoed, written to disk by this script, or put on a
# command line (where other users could see it in the process list): values
# go to `gh secret set` / `gh variable set` on standard input.

set -euo pipefail

REPO="ZenFinanceHub/clearpass-app"
# The EXPO_PUBLIC_* names the build job of ota-production.yml passes through.
OTA_BUILD_NAMES="EXPO_PUBLIC_API_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
EXPO_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_UI_V2
EXPO_PUBLIC_APP_ENV"

die() { echo "$*" >&2; exit 2; }
usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit 2
}

# --- shared -------------------------------------------------------------------
owner=""; owner_id=""
preflight() {
  local me is_admin
  me=$(gh api user --jq .login)
  owner=$(gh api "repos/$REPO" --jq .owner.login)
  is_admin=$(gh api "repos/$REPO" --jq .permissions.admin)
  if [ "$me" != "$owner" ] || [ "$is_admin" != "true" ]; then
    echo "Run this logged in as the repository owner ($owner). Currently: $me (admin=$is_admin)." >&2
    exit 1
  fi
  owner_id=$(gh api "users/$owner" --jq .id)
}

# ensure_env NAME with-reviewer|no-reviewer
# Creates or updates the environment: admins cannot bypass; deployments only
# from `main` (any other branch policy is removed).
ensure_env() {
  local name="$1" mode="$2" reviewers
  if [ "$mode" = with-reviewer ]; then reviewers="[{ \"type\": \"User\", \"id\": $owner_id }]"; else reviewers="[]"; fi
  gh api -X PUT "repos/$REPO/environments/$name" --input - >/dev/null <<JSON
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "can_admins_bypass": false,
  "reviewers": $reviewers,
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
  local existing extra
  existing=$(gh api "repos/$REPO/environments/$name/deployment-branch-policies" --jq '[.branch_policies[].name] | join(",")')
  case ",$existing," in
    *,main,*) ;;
    *) gh api -X POST "repos/$REPO/environments/$name/deployment-branch-policies" -f name=main -f type=branch >/dev/null ;;
  esac
  for extra in $(gh api "repos/$REPO/environments/$name/deployment-branch-policies" --jq '.branch_policies[] | select(.name != "main") | .id'); do
    gh api -X DELETE "repos/$REPO/environments/$name/deployment-branch-policies/$extra" >/dev/null
  done
}

show_env() {
  local name="$1"
  gh api "repos/$REPO/environments/$name" \
    --jq '"  \(.name): reviewers: \([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[].reviewer.login] | join(",") | if . == "" then "none" else . end); admins can bypass: \(.can_admins_bypass)"'
  gh api "repos/$REPO/environments/$name/deployment-branch-policies" --jq '"    branches allowed: \([.branch_policies[].name] | join(","))"'
  gh variable list --repo "$REPO" --env "$name" --json name --jq '.[].name' | sed 's/^/    variable: /'
  gh secret list --repo "$REPO" --env "$name" --json name --jq '.[].name' | sed 's/^/    secret: /'
}

delete_file() {
  if command -v shred >/dev/null; then shred -u "$1"; else rm -f "$1"; fi
  echo "  deleted: $1 ($([ -e "$1" ] && echo NOT deleted || echo ok))"
}

# read_secret VAR_NAME PROMPT: hidden prompt, value kept in a shell variable.
read_secret() {
  local __v
  IFS= read -rs -p "$2: " __v; echo >&2
  printf -v "$1" '%s' "$__v"
}

# --- 1. release gate (original usage) ------------------------------------------
setup_release() {
  local client_id="$1" pem="$2"
  [[ "$client_id" =~ ^Iv[0-9A-Za-z.]+$ ]] || die "That doesn't look like a GitHub App client ID (expected to start with 'Iv')."
  [ -f "$pem" ] || die "Private key file not found: $pem"
  head -1 "$pem" | grep -q 'BEGIN RSA PRIVATE KEY\|BEGIN PRIVATE KEY' || die "$pem is not a PEM private key."
  local env_name=production-release

  echo "1/5 Environment '$env_name' (reviewer: $owner; admins cannot bypass; main only)..."
  ensure_env "$env_name" with-reviewer
  echo "2/5 Environment variable RELEASE_APP_CLIENT_ID..."
  gh variable set RELEASE_APP_CLIENT_ID --repo "$REPO" --env "$env_name" --body "$client_id"
  echo "3/5 Environment secret RELEASE_APP_PRIVATE_KEY (from the file; not printed)..."
  gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPO" --env "$env_name" < "$pem"
  echo "4/5 Branch release-gate-test..."
  if ! gh api "repos/$REPO/branches/release-gate-test" >/dev/null 2>&1; then
    local prod
    prod=$(gh api "repos/$REPO/branches/production" --jq .commit.sha)
    gh api -X POST "repos/$REPO/git/refs" -f ref=refs/heads/release-gate-test -f sha="$prod" >/dev/null
  fi
  echo "5/5 Deleting the downloaded private key file..."
  delete_file "$pem"
  echo; echo "Done. Check:"
  show_env "$env_name"
  echo "  release-gate-test: $(gh api "repos/$REPO/branches/release-gate-test" --jq .commit.sha | cut -c1-7)"
}

# --- 2. OTA gate ------------------------------------------------------------------
setup_ota() {
  local envfile="$1" tokenfile="${2:-}"
  [ -f "$envfile" ] || die "Not found: $envfile (create it with: npx eas-cli env:pull production --path \"\$HOME/production.env\")"
  [ -z "$tokenfile" ] || [ -f "$tokenfile" ] || die "Not found: $tokenfile"

  # Parse NAME=VALUE lines; keep EXPO_PUBLIC_* only. Values stay in memory.
  declare -A vals=()
  local line name value n
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$ ]] || continue
    name="${BASH_REMATCH[2]}"; value="${BASH_REMATCH[3]}"
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    vals["$name"]="$value"
  done < "$envfile"
  [ "${#vals[@]}" -gt 0 ] || die "No EXPO_PUBLIC_* lines in $envfile."
  [[ "${vals[EXPO_PUBLIC_REVENUECAT_API_KEY_IOS]:-}" == appl_* ]] || die "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS is missing or doesn't start with appl_ (value not shown)."
  [[ "${vals[EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID]:-}" == goog_* ]] || die "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID is missing or doesn't start with goog_ (value not shown)."
  if [ -n "${vals[EXPO_PUBLIC_APP_ENV]:-}" ] && [ "${vals[EXPO_PUBLIC_APP_ENV]}" != production ]; then
    die "EXPO_PUBLIC_APP_ENV in $envfile is not 'production'."
  fi

  echo "1/5 Environment 'ota-build' (no reviewers; admins cannot bypass; main only)..."
  ensure_env ota-build no-reviewer
  # Stored as environment secrets only so GitHub masks them in the public
  # logs; they are public client values (see ota-production.yml).
  echo "2/5 ota-build values (public client values, stored masked; names only shown)..."
  for name in $(printf '%s\n' "${!vals[@]}" | sort); do
    printf '%s' "${vals[$name]}" | gh secret set "$name" --repo "$REPO" --env ota-build
    if grep -qx "$name" <<< "$OTA_BUILD_NAMES"; then echo "  set $name"
    else echo "  set $name  <- NOT in ota-production.yml's list; add it to the build step or the OTA run will stop"; fi
  done
  local extra
  extra=$(gh secret list --repo "$REPO" --env ota-build --json name --jq '.[].name' | while read -r n; do [ -n "${vals[$n]+x}" ] || echo "$n"; done)
  if [ -n "$extra" ]; then
    echo "  NOTE: ota-build also has values that are not in $envfile (left unchanged; the OTA workflow refuses if they"
    echo "        differ from EAS production, so delete any stale one with: gh secret delete NAME --repo $REPO --env ota-build):"
    while IFS= read -r n; do echo "    $n"; done <<< "$extra"
  fi

  echo "3/5 Environment 'production-ota' (reviewer: $owner; admins cannot bypass; main only)..."
  ensure_env production-ota with-reviewer

  echo "4/5 Environment secret EXPO_TOKEN (not printed)..."
  local token
  if [ -n "$tokenfile" ]; then token=$(tr -d '\r\n' < "$tokenfile"); else read_secret token "Paste the Expo robot token (hidden)"; fi
  [ -n "$token" ] || die "Empty token."
  [[ "$token" =~ ^[A-Za-z0-9_.-]+$ ]] || die "That doesn't look like an Expo access token (unexpected characters)."
  printf '%s' "$token" | gh secret set EXPO_TOKEN --repo "$REPO" --env production-ota
  token=""

  echo "5/5 Deleting $envfile${tokenfile:+ and $tokenfile}..."
  delete_file "$envfile"
  if [ -n "$tokenfile" ]; then delete_file "$tokenfile"; fi
  echo; echo "Done. Check:"
  show_env ota-build
  show_env production-ota
}

# --- 3. database gate -------------------------------------------------------------
setup_db() {
  local urlfile="${1:-}" url="" dbenv="$HOME/.config/clearpass/db.env"
  if [ -n "$urlfile" ]; then
    [ -f "$urlfile" ] || die "Not found: $urlfile"
    url=$(tr -d '\r\n' < "$urlfile")
  elif [ -f "$dbenv" ]; then
    echo "Building SUPABASE_DB_URL from $dbenv (as lib/dbCreds.js does; not printed)..."
    # Same parsing and percent-encoding as apps/mobile/server/scripts/lib/dbCreds.js.
    url=$(python3 -I - "$dbenv" <<'PY'
import sys, urllib.parse
vals = {}
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    vals[k.strip()] = v.strip()
pw, tpl = vals.get("SUPABASE_DB_PASSWORD", ""), vals.get("SUPABASE_DB_URL_TEMPLATE", "")
if not pw or "[YOUR-PASSWORD]" not in tpl:
    sys.exit("db.env needs SUPABASE_DB_PASSWORD and SUPABASE_DB_URL_TEMPLATE with a [YOUR-PASSWORD] placeholder")
# encodeURIComponent leaves A-Z a-z 0-9 - _ . ! ~ * ' ( ) unescaped.
print(tpl.replace("[YOUR-PASSWORD]", urllib.parse.quote(pw, safe="-_.!~*'()")), end="")
PY
)
  else
    read_secret url "Paste the Supabase session-pooler connection string, password included (hidden)"
  fi
  [[ "$url" =~ ^postgres(ql)?://[^:@/]+:[^@/]+@[^:/?@]+:5432/[^?]+(\?.*)?$ ]] \
    || die "Not a postgresql://user:password@host:5432/db URL with the session pooler port 5432 (value not shown)."

  echo "1/2 Environment 'production-db' (reviewer: $owner; admins cannot bypass; main only)..."
  ensure_env production-db with-reviewer
  echo "2/2 Environment secret SUPABASE_DB_URL (not printed)..."
  printf '%s' "$url" | gh secret set SUPABASE_DB_URL --repo "$REPO" --env production-db
  url=""
  if [ -n "$urlfile" ]; then delete_file "$urlfile"; fi
  echo; echo "Done. Check:"
  show_env production-db
}

case "${1:-}" in
  ota) if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then usage; fi; preflight; setup_ota "$2" "${3:-}" ;;
  db) if [ "$#" -gt 2 ]; then usage; fi; preflight; setup_db "${2:-}" ;;
  Iv*) if [ "$#" -ne 2 ]; then usage; fi; preflight; setup_release "$1" "$2" ;;
  *) usage ;;
esac
