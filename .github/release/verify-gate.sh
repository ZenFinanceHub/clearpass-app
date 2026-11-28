#!/usr/bin/env bash
# Proves the release gate holds. Run AS THE `clearpass-dev` GITHUB APP, via the
# Linux user `claude-dev`, from a clone of the repo:
#
#   bash .github/release/verify-gate.sh
#
# Identity: ~/bin/gh mints a <=1 hour installation token per call and puts it
# in gh's environment only; git uses ~/bin/git-credential-clearpass-dev. This
# script never prints, logs or passes a token as an argument. It reads only the
# `permissions` and `exp` fields of the token cache, never the token itself.
#
# Every negative test targets `release-gate-test` (same ruleset as production)
# or uses refused API calls, so nothing here can move production. If an action
# that must be refused is ALLOWED, the script stops immediately (exit 2).
#
# Test G8 creates a pending approval request on a mode=test run; the owner may
# see a notification. NEVER approve that run: this script cancels it. G13 then
# re-runs it, which must wait for approval again, and cancels it again.
#
# Positive tests P1 (owner approves a mode=test run) and P2 (App merges a
# docs-only PR) are not part of this script: P1 is the owner's, and nothing
# here merges.
#
# The release workflow has no rollback mode and never force-pushes (rollbacks
# are revert commits released normally). G5b still checks that a force-push to
# a production-protected branch is refused, and G11 checks that the release
# workflow on main contains no force-push path.
#
# Exit code 0 = every protection held. 2 = a refused action succeeded (STOP).

set -uo pipefail
REPO="ZenFinanceHub/clearpass-app"
OWNER="${REPO%%/*}"
ENV_NAME="production-release"
CONF="$HOME/.config/clearpass-dev"
OWNER_HOME="${OWNER_HOME:-/home/craig}"
pass=0; failn=0
run=""; prun=""
tmp=""

ok()   { echo "PASS  $1"; pass=$((pass+1)); }
bad()  { echo "FAIL  $1"; failn=$((failn+1)); }
info() { echo "INFO  $1"; }

# gh always runs as the App (token passed in gh's environment by the wrapper).
[ -x "$HOME/bin/gh" ] || { echo "FAIL  ~/bin/gh (App wrapper) not found"; exit 1; }
gh() { "$HOME/bin/gh" "$@"; }

cleanup() {
  # Never leave a pending approval behind.
  if [ -n "$run" ]; then gh run cancel "$run" --repo "$REPO" >/dev/null 2>&1 || true; fi
  [ -n "$tmp" ] && rm -rf "$tmp"
}
trap cleanup EXIT

stop() { # a protection did not hold: stop immediately
  echo "FAIL  $1"
  echo "STOP: a refused action succeeded. Stopping at once; report this to the owner."
  exit 2
}

reason() { echo "$1" | tr '\n' ' ' | grep -oE 'HTTP [0-9]+|GH0[0-9]+|rule[s]? violation|protected branch|Resource not accessible|not allowed|workflow[s]? permission|refusing|denied|Must have admin rights|Not Found|rejected' | head -1; }

denied() { # run a command that must be refused; stop at once if it is allowed
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then stop "$label (was ALLOWED)"; else ok "$label (refused: $(reason "$out"))"; fi
}

wait_status() { # <run id> <status> [tries]: wait until status matches or run completes
  local id="$1" want="$2" tries="${3:-40}" st=""
  for _ in $(seq 1 "$tries"); do
    st=$(gh run view "$id" --repo "$REPO" --json status --jq .status 2>/dev/null || echo "")
    [ "$st" = "$want" ] && break
    [ "$st" = completed ] && break
    sleep 6
  done
  echo "$st"
}

# ---------------------------------------------------------------- G1 identity
if out=$(gh api user 2>&1); then
  bad "G1a 'gh api user' succeeded: the credential is a user, not an installation token"
else
  ok "G1a 'gh api user' fails (an installation token is not a user: $(reason "$out"))"
fi
repos=$(gh api installation/repositories --jq '[.total_count, ([.repositories[].full_name] | join(","))] | @tsv' 2>/dev/null || echo "")
if [ "$repos" = "$(printf '1\t%s' "$REPO")" ]; then
  ok "G1b installation lists exactly 1 repository ($REPO)"
else
  bad "G1b installation repositories are not exactly [$REPO] (got: ${repos:-refused})"
fi

# ---------------------------------------------------------------- G2 rights
"$HOME/bin/gh-app-token" >/dev/null 2>&1 || bad "G2 could not mint an installation token"
if [ -r "$CONF/token.json" ]; then
  # Only .permissions is read: never .token.
  perms=$(jq -r '.permissions // {} | to_entries | map("\(.key):\(.value)") | sort | join(" ")' "$CONF/token.json" 2>/dev/null)
  extra=$(jq -r '
    {"actions":"write","checks":"read","statuses":"read","contents":"write","pull_requests":"write","metadata":"read"} as $a
    | def rank: {"read":1,"write":2,"admin":3}[.] // 99;
    (.permissions // {}) | to_entries[]
    | select(($a[.key] == null) or ((.value | rank) > ($a[.key] | rank)))
    | "\(.key):\(.value)"' "$CONF/token.json" 2>/dev/null | tr '\n' ' ')
  if [ -n "$perms" ] && [ -z "$extra" ]; then
    ok "G2 granted permissions are within {actions:write checks:read statuses:read contents:write pull_requests:write metadata:read}: $perms"
  else
    bad "G2 permissions outside the allowed set: ${extra:-none recorded} (granted: ${perms:-none})"
  fi
else
  bad "G2 token cache with recorded permissions is missing"
fi

# ---------------------------------------------------------------- G3 owner credentials unreachable
for v in GH_TOKEN GITHUB_TOKEN GITHUB_PAT GH_ENTERPRISE_TOKEN CLOUDFLARE_API_TOKEN EXPO_TOKEN SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD; do
  if [ -n "${!v:-}" ]; then bad "G3 environment variable $v is set"; else ok "G3 environment variable $v is not set"; fi
done
if [ -e "$HOME/.git-credentials" ]; then bad "G3 $HOME/.git-credentials exists"; else ok "G3 no plaintext git credentials file"; fi
if [ -e "$HOME/.config/gh/hosts.yml" ]; then bad "G3 a gh login file exists ($HOME/.config/gh/hosts.yml)"; else ok "G3 no stored gh login"; fi
if gh auth status 2>&1 | grep -qi "account $OWNER"; then bad "G3 the owner's account is logged in to this CLI"; else ok "G3 owner account not present in this CLI"; fi
if [ -e "$HOME/.expo" ]; then bad "G3 an Expo session directory exists ($HOME/.expo)"; else ok "G3 no ~/.expo session"; fi
if ls "$OWNER_HOME" >/dev/null 2>&1; then bad "G3 can list $OWNER_HOME"; else ok "G3 cannot list $OWNER_HOME"; fi
if [ -r "$OWNER_HOME/.config/clearpass/db.env" ]; then bad "G3 can read the production db.env"; else ok "G3 cannot read the production db.env"; fi
if [ -r /var/run/docker.sock ] || [ -w /var/run/docker.sock ]; then bad "G3 can use /var/run/docker.sock"; else ok "G3 cannot use /var/run/docker.sock"; fi
if id -nG | tr ' ' '\n' | grep -qxE 'docker|sudo|adm|wheel'; then bad "G3 user is in a privileged group ($(id -nG))"; else ok "G3 user is in no privileged group"; fi
if sudo -n true >/dev/null 2>&1; then bad "G3 'sudo -n' works"; else ok "G3 'sudo -n' fails"; fi
keyinfo=$(stat -c '%a %U' "$CONF/app.pem" 2>/dev/null || echo "missing")
if [ "$keyinfo" = "600 claude-dev" ]; then ok "G3 App key is mode 600, owned by claude-dev"; else bad "G3 App key is '$keyinfo' (want '600 claude-dev')"; fi

# ---------------------------------------------------------------- clone for the probes
tmp=$(mktemp -d)
if ! git clone -q "https://github.com/$REPO.git" "$tmp/r"; then bad "clone failed"; exit 1; fi
cd "$tmp/r" || exit 1
git config user.name "clearpass-dev[bot]"; git config user.email "clearpass-dev[bot]@users.noreply.github.com"
main=$(git rev-parse origin/main)

# ---------------------------------------------------------------- G4 rules apply to production (read-only)
if gh api "repos/$REPO/rules/branches/production" --jq '[.[].type] | join(",")' 2>/dev/null | grep -qw update; then
  ok "G4 'restrict updates' (update rule) applies to production"
else
  bad "G4 'update' rule NOT visible on production"
fi

# ---------------------------------------------------------------- G4b-d the environment (read-only)
# Owner-only reviewer, self-review prevented, no admin bypass. (Reading the
# environment is allowed for the App; changing it is refused in G7.)
envj=$(gh api "repos/$REPO/environments/$ENV_NAME" 2>/dev/null || echo "")
if [ -z "$envj" ]; then
  bad "G4b-d could not read the $ENV_NAME environment"
else
  rv=$(jq -r '[.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[] | "\(.type):\(.reviewer.login)"] | join(",")' <<< "$envj")
  psr=$(jq -r '[.protection_rules[]? | select(.type=="required_reviewers") | .prevent_self_review][0] | tostring' <<< "$envj")
  cab=$(jq -r '.can_admins_bypass | tostring' <<< "$envj")
  if [ "$rv" = "User:$OWNER" ]; then ok "G4b sole required reviewer is the owner account"; else bad "G4b required reviewers are '$rv'"; fi
  if [ "$psr" = true ]; then ok "G4c prevent self-review is ON"; else bad "G4c prevent self-review is $psr"; fi
  if [ "$cab" = false ]; then ok "G4d admins cannot bypass the environment"; else bad "G4d can_admins_bypass=$cab"; fi
fi

# ---------------------------------------------------------------- G5 push / force-push / delete on release-gate-test
git fetch -q origin release-gate-test || { bad "G5 release-gate-test does not exist"; exit 1; }
git checkout -q -B probe origin/release-gate-test
git commit -q --allow-empty -m "gate probe (must be rejected)"
denied "G5a push to release-gate-test" git push -q origin HEAD:refs/heads/release-gate-test
# A parentless commit is never a fast-forward, so this is a true force-push.
orphan=$(git commit-tree "$main^{tree}" -m "gate probe (must be rejected)")
denied "G5b force-push to release-gate-test" git push -q --force origin "$orphan:refs/heads/release-gate-test"
denied "G5c delete release-gate-test" git push -q origin :refs/heads/release-gate-test

# ---------------------------------------------------------------- G6 direct push to main
git checkout -q -B probe-main "$main"; git commit -q --allow-empty -m "gate probe (must be rejected)"
denied "G6 direct push to main" git push -q origin HEAD:refs/heads/main

# ---------------------------------------------------------------- G7 settings and secrets
denied "G7a list environment secrets" gh api "repos/$REPO/environments/$ENV_NAME/secrets"
denied "G7b change the environment" gh api -X PUT "repos/$REPO/environments/$ENV_NAME" -F wait_timer=0
denied "G7c create a ruleset" gh api -X POST "repos/$REPO/rulesets" -f name=probe -f target=branch -f enforcement=disabled
denied "G7d add a deploy key" gh api -X POST "repos/$REPO/keys" -f title=probe -f key="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGtlc3Qta2V5LW5vdC1yZWFsLWZvci1wcm9iZS0wMDAwMDAw probe"
denied "G7e invite a collaborator" gh api -X PUT "repos/$REPO/collaborators/octocat" -f permission=admin

# ---------------------------------------------------------------- G8 self-approval
# Start a mode=test run (the App has Actions: write), wait for the approval step,
# then try to approve it as the App. It must be refused. Nothing is ever approved.
start=$(date -u -d '-60 seconds' +%Y-%m-%dT%H:%M:%SZ)
st=""
if gh workflow run release.yml --repo "$REPO" --ref main -f sha="$main" -f mode=test -f reason="gate self-approval probe (owner: do NOT approve)" >/dev/null 2>&1; then
  for _ in $(seq 1 20); do
    run=$(gh run list --repo "$REPO" --workflow release.yml --event workflow_dispatch --limit 5 --json databaseId,createdAt \
          --jq "[.[] | select(.createdAt >= \"$start\")][0].databaseId // empty" 2>/dev/null)
    [ -n "$run" ] && break
    sleep 3
  done
  if [ -n "$run" ]; then st=$(wait_status "$run" waiting 40); fi
else
  bad "G8 could not start the mode=test run (workflow dispatch refused)"
fi
if [ "$st" = waiting ]; then
  pd=$(gh api "repos/$REPO/actions/runs/$run/pending_deployments" 2>/dev/null || echo "")
  env_id=$(jq -r '.[0].environment.id // empty' <<< "$pd" 2>/dev/null)
  can=$(jq -r '.[0].current_user_can_approve | if . == null then "" else tostring end' <<< "$pd" 2>/dev/null)
  if [ "$can" = false ]; then ok "G8a GitHub reports the App cannot approve (current_user_can_approve=false)"
  elif [ -z "$can" ]; then ok "G8a pending deployment details are not readable by the App (cannot approve)"
  else stop "G8a current_user_can_approve=$can"; fi
  if [ -n "$env_id" ]; then
    denied "G8b the App approves its own release request" gh api -X POST "repos/$REPO/actions/runs/$run/pending_deployments" -F "environment_ids[]=$env_id" -f state=approved -f comment=probe
  else
    bad "G8b approval attempt not exercised: could not read the environment id of the pending deployment"
  fi
elif [ -n "$run" ]; then
  bad "G8 test run did not reach 'waiting' (status: ${st:-unknown}). Is main CI-green?"
fi
if [ -n "$run" ]; then
  gh run cancel "$run" --repo "$REPO" >/dev/null 2>&1 || true
  wait_status "$run" completed 20 >/dev/null
fi

# ---------------------------------------------------------------- G9 modified workflow on another branch
# The App has no Workflows permission, so GitHub must refuse the push itself.
git checkout -q -B gate-probe "$main"
cat > .github/workflows/release.yml <<'YML'
name: Release to production
on:
  workflow_dispatch:
    inputs:
      sha: { required: true, type: string }
      mode: { required: true, type: string }
      reason: { required: true, type: string }
jobs:
  push:
    runs-on: ubuntu-latest
    environment: production-release
    steps:
      - name: Probe
        env:
          K: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
        run: if [ -n "$K" ]; then echo KEY_AVAILABLE; else echo NO_KEY; fi
YML
git commit -q -am "gate probe: modified release workflow (must be refused)"
if out=$(git push -q origin HEAD:refs/heads/gate-probe 2>&1); then
  git push -q origin :refs/heads/gate-probe >/dev/null 2>&1 || true
  stop "G9a pushing a modified workflow file (was ALLOWED; the probe branch was deleted again, no run was started)"
else
  ok "G9a push of a modified workflow file refused (no Workflows permission: $(reason "$out"))"
fi
# Read-only, if the App can read it: the environment accepts main only.
pol=$(gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" --jq '[.branch_policies[].name] | join(",")' 2>/dev/null || echo "")
if [ -n "$pol" ]; then
  if [ "$pol" = main ]; then ok "G9b environment $ENV_NAME accepts only: main"; else bad "G9b environment $ENV_NAME accepts: $pol"; fi
else
  info "G9b environment branch policy not readable by the App (expected); confirmed from the owner's API check of 2026-11-26"
fi

# ---------------------------------------------------------------- G10 CODEOWNERS change needs the owner
git checkout -q -B gate-codeowners "$main"
echo "# probe" >> .github/CODEOWNERS
git commit -q -am "gate probe: edit CODEOWNERS (must not be mergeable without owner review)"
if git push -q origin HEAD:refs/heads/gate-codeowners 2>/dev/null; then
  url=$(gh pr create --repo "$REPO" --base main --head gate-codeowners --title "gate probe (close me)" --body "Automated gate probe. Must not be mergeable without the owner's review." 2>/dev/null)
  if [ -n "$url" ]; then
    denied "G10 merge a CODEOWNERS change without the owner's review" gh pr merge "$url" --repo "$REPO" --squash
    gh pr close "$url" --repo "$REPO" --delete-branch >/dev/null 2>&1 || git push -q origin :refs/heads/gate-codeowners >/dev/null 2>&1
  else
    git push -q origin :refs/heads/gate-codeowners >/dev/null 2>&1
    bad "G10 could not open the probe PR"
  fi
else
  bad "G10 could not push probe branch"
fi

# ---------------------------------------------------------------- G11 release workflow is fast-forward only
wf=$(gh api "repos/$REPO/contents/.github/workflows/release.yml?ref=main" --jq .content | base64 -d)
if grep -qE '^\s*options: \[release, test\]\s*$' <<< "$wf"; then ok "G11a release modes are exactly [release, test]"; else bad "G11a release workflow modes are not exactly [release, test]"; fi
if grep -vE '^\s*#' <<< "$wf" | grep -qE -- '--force|force-with-lease|push[^#]*\+[0-9a-zA-Z$"]|mode: rollback'; then
  bad "G11b release workflow on main contains a force-push or rollback path"
else
  ok "G11b release workflow on main has no force-push or rollback path"
fi

# ---------------------------------------------------------------- G12 token lifetime and scope
"$HOME/bin/gh-app-token" >/dev/null 2>&1
exp=$(jq -r '.exp // 0' "$CONF/token.json" 2>/dev/null || echo 0)
left=$(( exp - $(date +%s) ))
if [ "$left" -gt 0 ] && [ "$left" -le 3600 ]; then ok "G12a token expires in ${left}s (<= 3600)"; else bad "G12a token lifetime out of range (${left}s)"; fi
if [ "$repos" = "$(printf '1\t%s' "$REPO")" ]; then ok "G12b token is scoped to one repository"; else bad "G12b token is not scoped to exactly one repository"; fi

# ---------------------------------------------------------------- G13 re-run needs fresh approval
if [ -n "$run" ] && [ "$st" = waiting ]; then
  if gh run rerun "$run" --repo "$REPO" >/dev/null 2>&1; then
    st2=$(wait_status "$run" waiting 50)
    if [ "$st2" = waiting ]; then
      ok "G13 re-running the cancelled G8 run stops at 'waiting' for approval again"
    else
      concl=$(gh run view "$run" --repo "$REPO" --json conclusion --jq .conclusion 2>/dev/null)
      [ "$concl" = success ] && stop "G13 the re-run proceeded WITHOUT approval"
      bad "G13 re-run did not reach 'waiting' (status: ${st2:-unknown}, conclusion: ${concl:-none})"
    fi
    gh run cancel "$run" --repo "$REPO" >/dev/null 2>&1 || true
    wait_status "$run" completed 20 >/dev/null
  else
    bad "G13 could not re-run the cancelled G8 run"
  fi
else
  bad "G13 not run: there was no waiting G8 run to re-run"
fi
run=""

echo
echo "Result: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
