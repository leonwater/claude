# 외부 도구(스킬·플러그인)를 PowerShell 에서 한 번에 전역 설치한다.
#
#     powershell -ExecutionPolicy Bypass -File scripts\install_all.ps1
#
# 필요: Node.js(npx), Claude Code(claude), Python 3.10+, uv(graphify). 사용법은 docs\external-tools-guide.md 참고.
# 한 단계가 실패해도 다음 단계는 계속 진행하고, 마지막에 실패 목록을 보여준다.
$failed = @()

function Run($label, [scriptblock]$cmd) {
  Write-Host "`n== $label" -ForegroundColor Cyan
  & $cmd
  if ($LASTEXITCODE -ne 0) { $script:failed += $label; Write-Host "실패: $label" -ForegroundColor Yellow }
}

# --- Claude Code 플러그인 (기본 범위 user = 모든 프로젝트) ---
Run "marketplace: claude-plugins-official" { claude plugin marketplace add anthropics/claude-plugins-official }
Run "plugin: frontend-design"             { claude plugin install frontend-design@claude-plugins-official }
Run "marketplace: hyperframes"            { claude plugin marketplace add heygen-com/hyperframes }
Run "plugin: hyperframes"                 { claude plugin install hyperframes@hyperframes }
Run "marketplace: ui-ux-pro-max"          { claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill }
Run "plugin: ui-ux-pro-max"               { claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill }
Run "marketplace: hallmark"               { claude plugin marketplace add nutlope/hallmark }
Run "plugin: hallmark"                    { claude plugin install hallmark@hallmark }
Run "marketplace: ponytail"               { claude plugin marketplace add DietrichGebert/ponytail }
Run "plugin: ponytail"                    { claude plugin install ponytail@ponytail }
Run "marketplace: ruflo"                  { claude plugin marketplace add ruvnet/ruflo }
Run "plugin: ruflo-core"                  { claude plugin install ruflo-core@ruflo }
Run "plugin: ruflo-console"               { claude plugin install ruflo-console@ruflo }
# ruflo-mods 는 샌드박스 없이 계정 권한으로 실행되므로 코드를 확인한 뒤 직접 설치한다:
#   claude plugin install ruflo-mods@ruflo

# --- 독립 스킬 (-g 전역, -a claude-code, -y 확인 생략, --copy 심볼릭 링크 대신 복사) ---
Run "skill: security-audit"       { npx -y skills add https://github.com/cloudflare/security-audit-skill -s security-audit -g -a claude-code -y --copy }
Run "skill: emil-design-eng"      { npx -y skills add emilkowalski/skills -s emil-design-eng -g -a claude-code -y --copy }
Run "skill: web-design-guidelines" { npx -y skills add vercel-labs/agent-skills -s web-design-guidelines -g -a claude-code -y --copy }

# --- CLI 도구 ---
Run "cli: graphify"          { uv tool install graphifyy }
Run "graphify install"       { graphify install }

Write-Host "`n완료. Claude Code 를 새로 시작하면 플러그인이 적용된다." -ForegroundColor Green
if ($failed.Count -gt 0) {
  Write-Host "실패한 단계:" -ForegroundColor Yellow
  $failed | ForEach-Object { Write-Host " - $_" }
}
