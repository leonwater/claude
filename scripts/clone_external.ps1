# 외부 도구 저장소를 external\ 아래에 내려받는다 (이미 있으면 최신으로 갱신).
#
#     powershell -ExecutionPolicy Bypass -File scripts\clone_external.ps1
#
# 사용법 정리는 docs\external-tools-guide.md 참고. git 이 PATH 에 있어야 한다.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Dest = Join-Path $Root "external"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$Repos = @(
  "cloudflare/security-audit-skill",
  "Graphify-Labs/graphify",
  "anomalyco/opencode",
  "heygen-com/hyperframes",
  "Comfy-Org/ComfyUI",
  "ruvnet/ruflo",
  "anthropics/claude-plugins-official",   # frontend-design 플러그인 포함
  "nextlevelbuilder/ui-ux-pro-max-skill",
  "Nutlope/hallmark",
  "emilkowalski/skills",
  "vercel-labs/agent-skills",             # web-design-guidelines 포함
  "DietrichGebert/ponytail"
)

# hyperframes 의 LFS 테스트 영상(약 240MB)은 소스만 필요하면 받지 않는다
$env:GIT_LFS_SKIP_SMUDGE = "1"

foreach ($repo in $Repos) {
  $dir = Join-Path $Dest ($repo.Split("/")[1])
  if (Test-Path (Join-Path $dir ".git")) {
    Write-Host "update $repo"
    git -C $dir pull --ff-only --quiet
  } else {
    Write-Host "clone  $repo"
    git clone --depth 1 --quiet "https://github.com/$repo.git" $dir
  }
}
