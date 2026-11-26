#!/usr/bin/env bash
# One-time setup of the production release gate. Run ONCE by the repository
# OWNER (Craig), still logged in to the GitHub CLI as the owner, AFTER creating
# the "clearpass-release" GitHub App (Prompt 5 in the plan):
#
#   bash .github/release/setup-release-gate.sh <APP_CLIENT_ID> <path/to/private-key.pem>
#
# It:
#   1. Creates the `production-release` GitHub Environment:
#      - required reviewer: the repository owner;
#      - admins cannot bypass;
#      - deployments only from `main`.
#   2. Stores the App's client ID as environment variable RELEASE_APP_CLIENT_ID.
#      It is not secret.
#   3. Stores the App's private key as environment secret RELEASE_APP_PRIVATE_KEY.
#      The key goes straight from the file into GitHub and is never printed.
#   4. Creates branch `release-gate-test` at production's commit, if missing,
#      for the gate tests.
#   5. Deletes the downloaded private-key file.
# Safe to re-run with a new key, e.g. to rotate it.

set -euo pipefail

REPO="ZenFinanceHub/clearpass-app"
ENV_NAME="production-release"

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <APP_CLIENT_ID> <path/to/private-key.pem>" >&2
  exit 2
fi
client_id="$1"; pem="$2"
[[ "$client_id" =~ ^Iv[0-9A-Za-z.]+$ ]] || { echo "That doesn't look like a GitHub App client ID (expected to start with 'Iv')." >&2; exit 2; }
[ -f "$pem" ] || { echo "Private key file not found: $pem" >&2; exit 2; }
head -1 "$pem" | grep -q 'BEGIN RSA PRIVATE KEY\|BEGIN PRIVATE KEY' || { echo "$pem is not a PEM private key." >&2; exit 2; }

me=$(gh api user --jq .login)
owner=$(gh api "repos/$REPO" --jq .owner.login)
is_admin=$(gh api "repos/$REPO" --jq .permissions.admin)
if [ "$me" != "$owner" ] || [ "$is_admin" != "true" ]; then
  echo "Run this logged in as the repository owner ($owner). Currently: $me (admin=$is_admin)." >&2
  exit 1
fi
owner_id=$(gh api "users/$owner" --jq .id)

echo "1/5 Environment '$ENV_NAME' (reviewer: $owner; admins cannot bypass; main only)..."
gh api -X PUT "repos/$REPO/environments/$ENV_NAME" --input - >/dev/null <<JSON
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "can_admins_bypass": false,
  "reviewers": [{ "type": "User", "id": $owner_id }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
existing=$(gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" --jq '[.branch_policies[].name] | join(",")')
case ",$existing," in
  *,main,*) ;;
  *) gh api -X POST "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" -f name=main -f type=branch >/dev/null ;;
esac
for extra in $(gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" --jq '.branch_policies[] | select(.name != "main") | .id'); do
  gh api -X DELETE "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies/$extra" >/dev/null
done

echo "2/5 Environment variable RELEASE_APP_CLIENT_ID..."
gh variable set RELEASE_APP_CLIENT_ID --repo "$REPO" --env "$ENV_NAME" --body "$client_id"

echo "3/5 Environment secret RELEASE_APP_PRIVATE_KEY (from the file; not printed)..."
gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPO" --env "$ENV_NAME" < "$pem"

echo "4/5 Branch release-gate-test..."
if ! gh api "repos/$REPO/branches/release-gate-test" >/dev/null 2>&1; then
  prod=$(gh api "repos/$REPO/branches/production" --jq .commit.sha)
  gh api -X POST "repos/$REPO/git/refs" -f ref=refs/heads/release-gate-test -f sha="$prod" >/dev/null
fi

echo "5/5 Deleting the downloaded private key file..."
if command -v shred >/dev/null; then shred -u "$pem"; else rm -f "$pem"; fi

echo
echo "Done. Check:"
gh api "repos/$REPO/environments/$ENV_NAME" \
  --jq '"  environment: \(.name); reviewers: \([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[].reviewer.login] | join(",")); admins can bypass: \(.can_admins_bypass)"'
gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" --jq '"  branches allowed: \([.branch_policies[].name] | join(","))"'
gh variable list --repo "$REPO" --env "$ENV_NAME" | sed 's/^/  variable: /'
gh secret list --repo "$REPO" --env "$ENV_NAME" | sed 's/^/  secret: /'
echo "  release-gate-test: $(gh api "repos/$REPO/branches/release-gate-test" --jq .commit.sha | cut -c1-7)"
echo "  key file deleted: $([ -e "$pem" ] && echo NO || echo yes)"
