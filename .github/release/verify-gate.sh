#!/usr/bin/env bash
# Proves the release gate holds. Run AS THE MACHINE USER (clearpass-bot), from a
# clone of the repo, after setup:
#
#   bash .github/release/verify-gate.sh
#
# Every negative test targets `release-gate-test` (same ruleset as production)
# or uses refused API calls, so nothing here can move production. Test G8
# creates a pending approval request on a mode=test run; the owner may see a
# notification for it. Do NOT approve that one, because this script cancels it.
#
# G12-G15 cover the OTA and database gates: environment settings, the bot
# being unable to read their secrets or approve their runs, and a workflow on
# another branch being unable to reach them. G14 creates a pending approval
# on an OTA rollback run for a non-existent update group ("gate self-approval
# probe"); do NOT approve it either; this script cancels it.
#
# The release workflow has no rollback mode and never force-pushes (rollbacks
# are revert commits released normally). G5b still checks that a force-push
# to a production-protected branch is refused, and G11 checks that the
# release workflow on main contains no force-push path.
#
# Exit code 0 = every protection held.

set -uo pipefail
REPO="ZenFinanceHub/clearpass-app"
ENV_NAME="production-release"
pass=0; failn=0
ok()  { echo "PASS  $1"; pass=$((pass+1)); }
bad() { echo "FAIL  $1"; failn=$((failn+1)); }
denied() { # run a command that must be refused
  local label="$1"; shift
  if out=$("$@" 2>&1); then bad "$label (was ALLOWED)"; else ok "$label (refused: $(echo "$out" | tr '\n' ' ' | grep -oE 'HTTP [0-9]+|rule[s]? violation|protected|denied|Resource not accessible|not allowed|Must have admin rights|Not Found|refusing' | head -1))"; fi
}

login=$(gh api user --jq .login)
admin=$(gh api "repos/$REPO" --jq .permissions.admin)
owner=$(gh api "repos/$REPO" --jq .owner.login)
echo "Running as: $login"
if [ "$login" != "$owner" ]; then ok "G1 CLI identity is not the owner ($login)"; else bad "G1 CLI identity IS the owner. Stop: log in as the machine user"; exit 1; fi
if [ "$admin" = "false" ]; then ok "G2 machine user is not a repository admin"; else bad "G2 machine user has ADMIN rights"; fi

# Credentials reachable from this OS user (names only).
if gh auth status 2>&1 | grep -q "account $owner"; then bad "G3 the owner's account is still logged in to this CLI"; else ok "G3 owner account not present in this CLI"; fi
for v in GH_TOKEN GITHUB_TOKEN GITHUB_PAT; do if [ -n "${!v:-}" ]; then bad "G3 environment variable $v is set"; fi; done
if [ -e "$HOME/.git-credentials" ]; then bad "G3 $HOME/.git-credentials exists"; else ok "G3 no plaintext git credentials file"; fi

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if ! git clone -q "https://github.com/$REPO.git" "$tmp/r"; then bad "clone failed"; exit 1; fi
cd "$tmp/r" || exit 1
git config user.name "$login"; git config user.email "$login@users.noreply.github.com"
main=$(git rev-parse origin/main)

# G4 rules apply to production (read-only check).
if gh api "repos/$REPO/rules/branches/production" --jq '[.[].type] | join(",")' | grep -q update; then
  ok "G4 'restrict updates' applies to production"
else
  bad "G4 'restrict updates' NOT applied to production"
fi

# G5 push / force-push / delete on a production-protected branch.
git fetch -q origin release-gate-test || true
git checkout -q -B probe origin/release-gate-test 2>/dev/null || git checkout -q -B probe "$main"
git commit -q --allow-empty -m "gate probe (must be rejected)"
denied "G5a push to release-gate-test (production ruleset)" git push -q origin HEAD:refs/heads/release-gate-test
denied "G5b force-push to release-gate-test" git push -q --force origin "$main:refs/heads/release-gate-test"
denied "G5c delete release-gate-test" git push -q origin :refs/heads/release-gate-test

# G6 direct push to main without a PR.
git checkout -q -B probe-main "$main"; git commit -q --allow-empty -m "gate probe (must be rejected)"
denied "G6 direct push to main" git push -q origin HEAD:refs/heads/main

# G7 settings and secrets.
denied "G7a list environment secrets" gh api "repos/$REPO/environments/$ENV_NAME/secrets"
denied "G7b change the environment" gh api -X PUT "repos/$REPO/environments/$ENV_NAME" -F wait_timer=0
denied "G7c create a ruleset" gh api -X POST "repos/$REPO/rulesets" -f name=probe -f target=branch -f enforcement=disabled
denied "G7d add a deploy key" gh api -X POST "repos/$REPO/keys" -f title=probe -f key="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGtlc3Qta2V5LW5vdC1yZWFsLWZvci1wcm9iZS0wMDAwMDAw probe"
denied "G7e invite a collaborator" gh api -X PUT "repos/$REPO/collaborators/octocat" -f permission=admin

# G8 self-approval: start a mode=test release, then try to approve it as the bot.
# (Test mode accepts the commit release-gate-test is already at, as a no-op,
# so this always reaches the approval step when main's CI is green.)
gh workflow run release.yml --repo "$REPO" --ref main -f sha="$main" -f mode=test -f reason="gate self-approval probe (owner: do NOT approve)" >/dev/null 2>&1
sleep 8
run=$(gh run list --repo "$REPO" --workflow release.yml --limit 1 --json databaseId,headBranch --jq '.[0].databaseId')
for _ in $(seq 1 40); do
  st=$(gh run view "$run" --repo "$REPO" --json status --jq .status)
  [ "$st" = waiting ] && break
  [ "$st" = completed ] && break
  sleep 6
done
if [ "$st" = waiting ]; then
  env_id=$(gh api "repos/$REPO/actions/runs/$run/pending_deployments" --jq '.[0].environment.id')
  can=$(gh api "repos/$REPO/actions/runs/$run/pending_deployments" --jq '.[0].current_user_can_approve')
  if [ "$can" = false ]; then ok "G8a GitHub reports the bot cannot approve (current_user_can_approve=false)"; else bad "G8a current_user_can_approve=$can"; fi
  denied "G8b bot approves its own release request" gh api -X POST "repos/$REPO/actions/runs/$run/pending_deployments" -F "environment_ids[]=$env_id" -f state=approved -f comment=probe
else
  bad "G8 test run did not reach 'waiting' (status: $st). Check that verify passed (is main CI-green?)"
fi
gh run cancel "$run" --repo "$REPO" >/dev/null 2>&1 || true

# G9 run a modified release workflow from another branch: the environment must refuse it.
# The probe replaces release.yml with a version that has no checks at all and
# just asks the environment for the key.
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
git commit -q -am "gate probe: modified release workflow (must not reach the key)"
if git push -q origin HEAD:refs/heads/gate-probe 2>/dev/null; then
  gh workflow run release.yml --repo "$REPO" --ref gate-probe -f sha="$main" -f mode=test -f reason="gate branch probe" >/dev/null 2>&1
  sleep 10
  prun=$(gh run list --repo "$REPO" --workflow release.yml --branch gate-probe --limit 1 --json databaseId --jq '.[0].databaseId')
  for _ in $(seq 1 40); do st=$(gh run view "$prun" --repo "$REPO" --json status --jq .status); [ "$st" = completed ] && break; [ "$st" = waiting ] && break; sleep 6; done
  log=$(gh run view "$prun" --repo "$REPO" --log 2>/dev/null || true)
  if grep -q KEY_AVAILABLE <<< "$log"; then bad "G9 a modified workflow on another branch READ THE KEY"
  elif [ "$st" = waiting ]; then bad "G9 a run from another branch reached the approval step (branch policy not enforced)"
  else ok "G9 a modified workflow on another branch could not reach the environment or the key"; fi
  gh run cancel "$prun" --repo "$REPO" >/dev/null 2>&1 || true
  git push -q origin :refs/heads/gate-probe 2>/dev/null || true
else
  bad "G9 could not push the probe branch (needs the 'workflow' scope on the bot login)"
fi

# G10 changing protected files needs the owner's review.
git checkout -q -B gate-codeowners "$main"
echo "# probe" >> .github/CODEOWNERS
git commit -q -am "gate probe: edit CODEOWNERS (must not be mergeable without owner review)"
if git push -q origin HEAD:refs/heads/gate-codeowners 2>/dev/null; then
  url=$(gh pr create --repo "$REPO" --base main --head gate-codeowners --title "gate probe (close me)" --body "Automated gate probe. Must not be mergeable without the owner's review." 2>/dev/null)
  denied "G10 merge a CODEOWNERS change without the owner's review" gh pr merge "$url" --repo "$REPO" --squash
  gh pr close "$url" --repo "$REPO" --delete-branch >/dev/null 2>&1 || git push -q origin :refs/heads/gate-codeowners
else
  bad "G10 could not push probe branch"
fi

# G11 the release workflow on main is fast-forward only: modes are exactly
# release and test, and no non-comment line force-pushes.
wf=$(gh api "repos/$REPO/contents/.github/workflows/release.yml?ref=main" --jq .content | base64 -d)
if grep -qE '^\s*options: \[release, test\]\s*$' <<< "$wf"; then ok "G11a release modes are exactly [release, test]"; else bad "G11a release workflow modes are not exactly [release, test]"; fi
if grep -vE '^\s*#' <<< "$wf" | grep -qE -- '--force|force-with-lease|push[^#]*\+[0-9a-zA-Z$"]|mode: rollback'; then
  bad "G11b release workflow on main contains a force-push or rollback path"
else
  ok "G11b release workflow on main has no force-push or rollback path"
fi

# ---- OTA and database gates (ota-production.yml, ota-rollback.yml, migrate-production.yml)

# G12 environment settings (read-only): each approval environment has exactly
# the owner as reviewer, no admin bypass, and accepts `main` only; ota-build
# has no reviewer but is also `main` only.
check_env() { # name expected-reviewers
  local name="$1" want="$2" j revs bypass pol branches
  if ! j=$(gh api "repos/$REPO/environments/$name" 2>/dev/null); then bad "G12 environment $name is missing"; return; fi
  revs=$(jq -r '[.protection_rules[]? | select(.type == "required_reviewers") | .reviewers[].reviewer.login] | sort | join(",")' <<< "$j")
  bypass=$(jq -r '.can_admins_bypass' <<< "$j")
  pol=$(jq -r '.deployment_branch_policy | "\(.protected_branches)/\(.custom_branch_policies)"' <<< "$j")
  branches=$(gh api "repos/$REPO/environments/$name/deployment-branch-policies" --jq '[.branch_policies[] | "\(.type // "branch"):\(.name)"] | join(",")' 2>/dev/null)
  if [ "$revs" = "$want" ] && [ "$bypass" = false ] && [ "$pol" = false/true ] && [ "$branches" = branch:main ]; then
    ok "G12 $name: reviewers='${revs:-none}', admins cannot bypass, main only"
  else
    bad "G12 $name: reviewers='${revs:-none}' (want '${want:-none}'), can_admins_bypass=$bypass, policy=$pol, branches=$branches"
  fi
  if [ -n "$revs" ] && grep -qx "$login" <<< "${revs//,/$'\n'}"; then bad "G12 $name lists the bot ($login) as a reviewer"; fi
}
check_env production-release "$owner"
check_env production-ota "$owner"
check_env production-db "$owner"
check_env ota-build ""

# G13 the bot cannot read or change these environments' secrets and settings.
denied "G13a list production-ota secrets" gh api "repos/$REPO/environments/production-ota/secrets"
denied "G13b list production-db secrets" gh api "repos/$REPO/environments/production-db/secrets"
denied "G13c change production-db" gh api -X PUT "repos/$REPO/environments/production-db" -F wait_timer=0
denied "G13d change production-ota" gh api -X PUT "repos/$REPO/environments/production-ota" -F wait_timer=0
denied "G13e list ota-build values" gh api "repos/$REPO/environments/ota-build/secrets"
if gh secret set GATE_PROBE --repo "$REPO" --env ota-build --body x >/dev/null 2>&1; then
  bad "G13f bot could ADD a value to ota-build"
  gh secret delete GATE_PROBE --repo "$REPO" --env ota-build >/dev/null 2>&1 || true
else
  ok "G13f bot cannot add or change ota-build values"
fi

# G14 the bot cannot approve a production-ota request. Uses the OTA rollback
# workflow with a group ID that does not exist: even if someone approved it,
# the job would stop at "group not found" before republishing anything.
# Owner: do NOT approve "gate self-approval probe"; this script cancels it.
gh workflow run ota-rollback.yml --repo "$REPO" --ref main -f group=00000000-0000-4000-8000-000000000000 \
  -f reason="gate self-approval probe (owner: do NOT approve)" >/dev/null 2>&1
sleep 8
orun=$(gh run list --repo "$REPO" --workflow ota-rollback.yml --limit 1 --json databaseId --jq '.[0].databaseId')
st=unknown
for _ in $(seq 1 40); do
  st=$(gh run view "$orun" --repo "$REPO" --json status --jq .status)
  if [ "$st" = waiting ] || [ "$st" = completed ]; then break; fi
  sleep 6
done
if [ "$st" = waiting ]; then
  env_id=$(gh api "repos/$REPO/actions/runs/$orun/pending_deployments" --jq '.[0].environment.id')
  can=$(gh api "repos/$REPO/actions/runs/$orun/pending_deployments" --jq '.[0].current_user_can_approve')
  if [ "$can" = false ]; then ok "G14a GitHub reports the bot cannot approve production-ota"; else bad "G14a current_user_can_approve=$can for production-ota"; fi
  denied "G14b bot approves a production-ota request" gh api -X POST "repos/$REPO/actions/runs/$orun/pending_deployments" -F "environment_ids[]=$env_id" -f state=approved -f comment=probe
else
  bad "G14 OTA rollback probe did not reach 'waiting' (status: $st)"
fi
gh run cancel "$orun" --repo "$REPO" >/dev/null 2>&1 || true

# G15 a workflow added on another branch cannot reach EXPO_TOKEN,
# SUPABASE_DB_URL or the ota-build variables (environments accept main only).
git checkout -q -B gate-probe-envs "$main"
cat > .github/workflows/gate-probe-envs.yml <<'YML'
name: gate probe envs
on:
  push:
    branches: [gate-probe-envs]
jobs:
  ota:
    runs-on: ubuntu-latest
    environment: production-ota
    steps:
      - env:
          K: ${{ secrets.EXPO_TOKEN }}
        run: if [ -n "$K" ]; then echo SECRET_AVAILABLE; else echo NO_SECRET; fi
  db:
    runs-on: ubuntu-latest
    environment: production-db
    steps:
      - env:
          K: ${{ secrets.SUPABASE_DB_URL }}
        run: if [ -n "$K" ]; then echo SECRET_AVAILABLE; else echo NO_SECRET; fi
  build:
    runs-on: ubuntu-latest
    environment: ota-build
    steps:
      - env:
          K: ${{ secrets.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS }}
        run: if [ -n "$K" ]; then echo VARS_AVAILABLE; else echo NO_VARS; fi
YML
git add .github/workflows/gate-probe-envs.yml
git commit -q -m "gate probe: workflow on a branch asks for production environments (must be refused)"
if git push -q origin HEAD:refs/heads/gate-probe-envs 2>/dev/null; then
  sleep 12
  erun=$(gh run list --repo "$REPO" --branch gate-probe-envs --event push --limit 1 --json databaseId --jq '.[0].databaseId')
  st=unknown
  for _ in $(seq 1 40); do
    st=$(gh run view "$erun" --repo "$REPO" --json status --jq .status 2>/dev/null)
    if [ "$st" = completed ] || [ "$st" = waiting ]; then break; fi
    sleep 6
  done
  log=$(gh run view "$erun" --repo "$REPO" --log 2>/dev/null || true)
  if grep -qE 'SECRET_AVAILABLE|VARS_AVAILABLE' <<< "$log"; then bad "G15 a workflow on another branch READ a production secret or the ota-build values"
  elif [ "$st" = waiting ]; then bad "G15 a run from another branch reached an approval step (branch policy not enforced)"
  elif [ -z "$erun" ]; then bad "G15 no run found for the probe branch"
  else ok "G15 a workflow on another branch could not reach production-ota, production-db or ota-build"; fi
  gh run cancel "$erun" --repo "$REPO" >/dev/null 2>&1 || true
  git push -q origin :refs/heads/gate-probe-envs 2>/dev/null || true
else
  bad "G15 could not push the probe branch (needs the 'workflow' scope on the bot login)"
fi

echo
echo "Result: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
