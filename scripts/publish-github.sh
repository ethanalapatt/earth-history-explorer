#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repository='ethanalapatt/earth-history-explorer'
cd "$repo_dir"
gh auth status >/dev/null
account="$(gh api user --jq .login)"
if [[ "$account" != 'ethanalapatt' ]]; then
  echo 'Please sign in to GitHub as ethanalapatt before publishing.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'There are uncommitted changes. Commit or review them before publishing.' >&2
  exit 1
fi
if origin="$(git remote get-url origin 2>/dev/null)"; then
  case "$origin" in
    "https://github.com/$repository.git"|"https://github.com/$repository"|"git@github.com:$repository.git") ;;
    *) echo 'The existing origin points elsewhere; inspect it before publishing.' >&2; exit 1;;
  esac
else
  gh repo create "$repository" --private --source "$repo_dir" --remote origin --description 'Interactive Earth globe with country and city history'
fi
# Publish each milestone in order. No force push and no stored credentials.
# If this is a subsequent run, only push commits absent from the remote branch.
remote_head="$(git -c credential.helper= -c 'credential.helper=!gh auth git-credential' ls-remote origin refs/heads/main | cut -f1)"
if [[ -n "$remote_head" ]]; then
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' fetch origin main
  git merge-base --is-ancestor "$remote_head" main || { echo 'Remote history has diverged. Inspect it before pushing.' >&2; exit 1; }
  range="$remote_head..main"
else
  range='main'
fi
while IFS= read -r commit; do
  [[ -n "$commit" ]] || continue
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin "$commit:refs/heads/main"
done < <(git rev-list --reverse "$range")
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main
local_head="$(git rev-parse HEAD)"
published_head="$(gh api "repos/$repository/commits/main" --jq .sha)"
[[ "$local_head" == "$published_head" ]] || { echo 'Remote verification failed.' >&2; exit 1; }
echo "Published and verified: https://github.com/$repository"
