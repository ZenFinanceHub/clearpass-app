#!/usr/bin/env bash
# One-time setup of the production release gate. Run ONCE by the repository
# OWNER (Craig), with the owner's own GitHub CLI login, from the repo root:
#
#     bash .github/release/setup-release-gate.sh
#
# It creates:
#   1. The `production-release` GitHub Environment:
#      - required reviewer: the repository owner (you);
#      - admins cannot bypass;
#      - runs only from `main`.
#   2. A new SSH deploy key with write access, titled "release-gate". The ruleset
#      "production protection" lets deploy keys update `production`.
#   3. The environment secret RELEASE_DEPLOY_KEY holding that key's private half.
#      Only the approved "push" job of .github/workflows/release.yml can read it.
#
# The private key is generated in a private temp dir, piped straight into
# `gh secret set`, and deleted. It is never printed. Safe to re-run: it
# replaces the key and secret.
#
# Afterwards (see docs/clearpass-2.0/07-infrastructure-action-plan.md, G1):
# log the CLI out of your owner account on this machine, so automation here
# only has the low-privilege bot login.

set -euo pipefail

REPO="ZenFinanceHub/clearpass-app"
ENV_NAME="production-release"
KEY_TITLE="release-gate"

me=$(gh api user --jq .login)
owner=$(gh api "repos/$REPO" --jq .owner.login)
is_admin=$(gh api "repos/$REPO" --jq .permissions.admin)
if [ "$me" != "$owner" ] || [ "$is_admin" != "true" ]; then
  echo "Run this logged in as the repository owner ($owner). Currently: $me (admin=$is_admin)." >&2
  exit 1
fi
owner_id=$(gh api "users/$owner" --jq .id)

echo "1/3 Creating environment '$ENV_NAME' (reviewer: $owner; admins cannot bypass; main only)..."
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

echo "2/3 Creating a new write deploy key '$KEY_TITLE'..."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
ssh-keygen -q -t ed25519 -N "" -C "$KEY_TITLE" -f "$tmp/key"
for id in $(gh api "repos/$REPO/keys" --jq ".[] | select(.title == \"$KEY_TITLE\") | .id"); do
  gh api -X DELETE "repos/$REPO/keys/$id" >/dev/null
done
gh api -X POST "repos/$REPO/keys" -f title="$KEY_TITLE" -f key="$(cat "$tmp/key.pub")" -F read_only=false >/dev/null

echo "3/3 Storing the private key as environment secret RELEASE_DEPLOY_KEY (not printed)..."
gh secret set RELEASE_DEPLOY_KEY --repo "$REPO" --env "$ENV_NAME" < "$tmp/key"

echo
echo "Done. Check:"
gh api "repos/$REPO/environments/$ENV_NAME" \
  --jq '"  environment: \(.name); reviewers: \([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[].reviewer.login] | join(",")); admins can bypass: \(.can_admins_bypass)"'
gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" --jq '"  branches allowed: \([.branch_policies[].name] | join(","))"'
gh api "repos/$REPO/keys" --jq ".[] | select(.title == \"$KEY_TITLE\") | \"  deploy key: \(.title), write: \(.read_only | not)\""
gh secret list --repo "$REPO" --env "$ENV_NAME" | sed 's/^/  secret: /'
echo "The private key file has been deleted."
