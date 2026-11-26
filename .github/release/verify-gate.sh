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

echo
echo "Result: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
