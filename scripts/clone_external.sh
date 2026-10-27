#!/usr/bin/env bash
# 외부 도구 저장소를 external/ 아래에 내려받는다 (이미 있으면 최신으로 갱신).
#
#     bash scripts/clone_external.sh
#
# 사용법 정리는 docs/external-tools-guide.md 참고.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/external"
mkdir -p "$DEST"

REPOS=(
  cloudflare/security-audit-skill
  Graphify-Labs/graphify
  anomalyco/opencode
  heygen-com/hyperframes
  Comfy-Org/ComfyUI
  ruvnet/ruflo
  anthropics/claude-plugins-official   # frontend-design 플러그인 포함
  nextlevelbuilder/ui-ux-pro-max-skill
  Nutlope/hallmark
  emilkowalski/skills
  vercel-labs/agent-skills             # web-design-guidelines 포함
)

for repo in "${REPOS[@]}"; do
  dir="$DEST/$(basename "$repo")"
  if [ -d "$dir/.git" ]; then
    echo "update $repo"
    git -C "$dir" pull --ff-only --quiet
  else
    echo "clone  $repo"
    # hyperframes 의 LFS 테스트 영상(약 240MB)은 소스만 필요하면 받지 않는다
    GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --quiet "https://github.com/$repo.git" "$dir"
  fi
done
