# 외부 도구 사용법 정리

각 저장소의 공식 README(2026-10-27 기준 최신 커밋)에 적힌 내용만 옮겼다.
저장소는 `bash scripts/clone_external.sh` 로 `external/` 아래에 내려받는다 (git 추적 제외).

| # | 도구 | 한 줄 요약 | 필요 환경 |
|---|------|-----------|-----------|
| 1 | security-audit-skill | 에이전트를 보안 감사자로 만드는 스킬 | Node.js, 병렬 서브에이전트 지원 에이전트 |
| 2 | graphify | 프로젝트를 지식 그래프로 만들어 grep 대신 질의 | Python 3.10+, uv 또는 pipx |
| 3 | opencode | 오픈소스 AI 코딩 에이전트 (터미널 TUI/데스크톱) | — |
| 4 | hyperframes | HTML/CSS/애니메이션 → MP4 영상 렌더링 | Node.js 22+, FFmpeg |
| 5 | ComfyUI | 노드 그래프 기반 이미지·영상·3D·오디오 생성 엔진 | Python, PyTorch, GPU 권장 |
| 6 | ruflo | Claude Code / Codex 용 멀티 에이전트 하네스 | Node.js (npx) |
| 7 | claude-plugins-official | Anthropic 공식 Claude Code 플러그인 디렉터리 | Claude Code |
| 8 | frontend-design | 주제에 맞는 디자인 방향 설정 | Claude Code (7번에 포함) |
| 9 | ui-ux-pro-max | 색·폰트·패턴을 디자인 시스템으로 생성 | Python 3.x |
| 10 | hallmark | AI 티 나는 뻔한 구성 검출·차단 | Node 18+ (브라우저 검사는 puppeteer-core + Chrome) |
| 11 | emil-design-eng | 애니메이션 곡선·속도·디테일 다듬기 | — |
| 12 | web-design-guidelines | 접근성·사용성 규칙 점검 | — |

---

## 1. security-audit-skill (cloudflare)

코드베이스를 6단계(정찰 → 커버리지 기반 탐색 → 후보 검증 → 구조화 출력 → 독립 재검증 → 보고서)로 감사한다.

**설치** ([Skills CLI](https://skills.sh))
```bash
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
# 사용자 전역 설치
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global
```

**사용** — 감사할 저장소에서 에이전트에게 요청하면 자동 실행된다.
```
security audit this codebase
find security vulnerabilities in ./src
do a security review, output to ~/audits/my-project
```
- 출력 경로를 안 주면 `~/security-audit-skill/<repo-name>/run-<N>` 에 저장.
- 결과물: `findings.json`(confirmed / needs_validation / rejected), `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`.
- 여러 번 돌리면 이전 결과를 이어받아 커버리지가 늘어난다 (1회 실행은 전체의 약 절반 발견).
- 대상 코드를 실행하려면 네트워크 차단·쓰기 제한된 OS 샌드박스가 필요. 없으면 실행 대신 `needs_validation` 으로 남긴다.

---

## 2. graphify (Graphify-Labs)

코드·문서·PDF·이미지·영상을 지식 그래프로 만든다. 코드는 tree-sitter 로 로컬 파싱(LLM 불필요).

**설치** — PyPI 패키지명은 `graphifyy`(y 두 개), 명령어는 `graphify`.
```bash
uv tool install graphifyy      # 또는 pipx install graphifyy
graphify install               # 사용 중인 어시스턴트를 감지해 스킬 등록
graphify install --project     # 현재 저장소에만 설치
```
다른 에이전트: `--platform codex | opencode | gemini | copilot ...`, Cursor 는 `graphify cursor install`.

**사용** (어시스턴트 안에서)
```
/graphify .                                   # 현재 폴더 그래프 생성
/graphify ./docs --update                     # 변경 파일만 재추출
/graphify query "what connects auth to the database?"
/graphify path "UserService" "DatabasePool"
/graphify explain "RateLimiter"
/graphify add https://arxiv.org/abs/1706.03762
```
- 결과: `graphify-out/graph.html`(브라우저 시각화), `GRAPH_REPORT.md`(요약), `graph.json`(전체 그래프).
- CLI 직접 질의: `graphify query / path / explain`. 종료 코드 0=답, 3=이름 모호, 4=노드 없음.
- 커밋 시 자동 재빌드: `graphify hook install`.
- 항상 그래프를 쓰게 하기: `graphify claude install` 등.
- 제거: `graphify uninstall` (`--purge` 로 `graphify-out/` 까지 삭제).
- 선택 기능은 extras 로 설치: `uv tool install "graphifyy[pdf]"`, `[video]`, `[mcp]`, `[all]` 등.
- Codex 에서는 `/graphify` 대신 `$graphify`.

---

## 3. opencode (anomalyco)

오픈소스 AI 코딩 에이전트.

**설치**
```bash
curl -fsSL https://opencode.ai/v2/install | bash   # $HOME/.opencode/bin 에 설치
npm i -g @opencode/cli@latest                      # bun/pnpm/yarn 도 가능
brew install anomalyco/tap/opencode-v2              # macOS·Linux 권장
mise use -g opencode
nix run github:anomalyco/opencode
```
- 0.1.x 이전 버전은 먼저 제거.
- 데스크톱 앱(BETA): [opencode.ai/download](https://opencode.ai/download) 또는 `brew install --cask opencode-desktop`.

**사용**
- `Tab` 키로 내장 에이전트 전환
  - **build**: 기본, 전체 권한 개발용
  - **plan**: 읽기 전용 분석용 (파일 수정 거부, bash 실행 전 확인)
- `@general` 로 복잡한 검색·다단계 작업용 서브에이전트 호출.
- 설정 문서: [opencode.ai/v2/docs](https://opencode.ai/v2/docs)

---

## 4. hyperframes (heygen-com)

HTML·CSS·미디어·애니메이션을 결정적(deterministic) MP4 로 렌더링하는 프레임워크.

**AI 에이전트로 쓰기**
```bash
# Claude Code 플러그인
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
# 이후 /hyperframes:hyperframes 로 호출

# 독립 스킬 설치 (OpenCode 등) — 에이전트/비대화형은 아래가 권장
npx hyperframes skills update        # 코어 스킬 4개 설치
npx skills add heygen-com/hyperframes
```
프롬프트 예: `Using /hyperframes, create a 10-second product intro with a fade-in title, a background video, and subtle background music.`

**CLI 로 직접 쓰기** (Node.js 22+, FFmpeg 필요)
```bash
npx hyperframes init my-video
cd my-video
npx hyperframes preview      # 브라우저 미리보기 (라이브 리로드)
npx hyperframes render       # MP4 렌더링
npx hyperframes add data-chart   # 카탈로그 블록 추가
```
- 코어 스킬: `/hyperframes`(먼저 읽기), `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`.
- 필요 시 설치: `/figma`, `/slideshow`, `/remotion-to-hyperframes` → `npx hyperframes skills update <name>`.
- 영상은 HTML + `data-start` / `data-duration` / `data-track-index` 속성으로 정의, GSAP·CSS·Lottie·Three.js 등으로 애니메이션.
- 문서: [hyperframes.heygen.com](https://hyperframes.heygen.com/introduction)

---

## 5. ComfyUI (Comfy-Org)

노드 그래프로 이미지·영상·3D·오디오 생성 워크플로를 만드는 엔진.

**설치 방법 (택1)**
- Windows / macOS 일반 사용자: [데스크톱 앱](https://comfy.org/download) 권장.
- Windows 포터블: GitHub Releases 의 `ComfyUI_windows_portable_nvidia.7z` 등 압축 해제 후 실행.
- comfy-cli: `pip install comfy-cli && comfy install`
- 수동 설치 (Windows·Linux):
  ```bash
  git clone https://github.com/Comfy-Org/ComfyUI.git && cd ComfyUI
  # NVIDIA
  pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu130
  pip install -r requirements.txt
  python main.py
  ```
  AMD(ROCm)·Intel(XPU)·Apple Silicon 은 README 의 해당 PyTorch 설치 명령 사용.

**사용**
- 기본 주소: `http://127.0.0.1:8188` (`--listen`, `--port` 로 변경).
- 모델 위치: 체크포인트 → `models/checkpoints`, VAE → `models/vae`.
- 다른 UI 와 모델 공유: `extra_model_paths.yaml.example` → `extra_model_paths.yaml` 로 바꿔 경로 지정.
- 커스텀 노드 관리자: `pip install -r manager_requirements.txt` 후 `python main.py --enable-manager`.
- 단축키: `Ctrl+Enter` 실행 대기열 추가, `Ctrl+S` 저장, `Ctrl+O` 불러오기, 더블클릭 노드 검색.
- 생성된 PNG 를 화면에 드래그하면 시드 포함 워크플로 전체 복원.
- 프롬프트 가중치 `(good code:1.2)`, 와일드카드 `{day|night}`.
- 고품질 미리보기: `--preview-method auto` (TAESD 는 `models/vae_approx` 에 디코더 넣고 `--preview-method taesd`).
- 완전 오프라인: `--offline`.

---

## 6. ruflo (ruvnet, 구 Claude Flow)

Claude Code·Codex 위에 에이전트 스웜·메모리·훅을 얹는 하네스.

**경로 A — Claude Code 플러그인 (가벼움, 작업공간에 파일 안 생김)**
```text
/plugin marketplace add ruvnet/ruflo
/plugin install ruflo-core@ruflo
/plugin install ruflo-console@ruflo
/plugin install ruflo-mods@ruflo
/reload-plugins
/ruflo
```
- core = 기반 도구 + MCP 서버, console = 에이전트 조종석, mods = 라우팅·정책.
- mods 는 계정 권한으로 샌드박스 없이 실행되므로 설치 전 코드 확인 권장 (Claude Code 2.1.287 이상).

**경로 B — CLI 전체 설치 (에이전트·훅·데몬·MCP 전부)**
```bash
npx ruflo@latest init wizard          # 대화형 설정 (모든 OS)
npx ruflo@latest init                 # 비대화형
npm install -g ruflo@latest
claude mcp add claude-flow -- npx ruflo@latest mcp start   # MCP 서버로 등록
```
- 설치 후엔 Claude Code 를 평소처럼 쓰면 훅이 작업 라우팅·학습을 자동 처리.
- 상세: 저장소 `docs/USERGUIDE.md`.

---

## 7. claude-plugins-official (anthropics)

Anthropic 이 관리하는 Claude Code 플러그인 마켓플레이스. `plugins/`(공식), `external_plugins/`(파트너·커뮤니티).

**사용** (Claude Code 안에서)
```
/plugin install {plugin-name}@claude-plugins-official
/plugin   → Discover 에서 탐색
```
- 공식 플러그인 예: `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `pr-review-toolkit`, `skill-creator`, `security-guidance`, 각 언어 LSP 등.
- 외부 플러그인 예: `github`, `gitlab`, `linear`, `playwright`, `context7`, `serena`, `terraform` 등.
- 설치 전 신뢰 여부 확인 필요 (Anthropic 이 외부 MCP 서버 내용을 보증하지 않음).

---

## 8. frontend-design — 주제에 맞는 디자인 방향 설정

`claude-plugins-official/plugins/frontend-design` 에 이미 포함되어 별도 다운로드 생략.

**설치**
```
/plugin install frontend-design@claude-plugins-official
```
**사용** — 프론트엔드 작업 요청 시 자동 적용.
```
"Create a dashboard for a music streaming app"
"Build a landing page for an AI security startup"
"Design a settings panel with dark mode"
```
- 뻔한 템플릿을 피하고 주제에 맞는 팔레트·타이포·레이아웃 방향을 먼저 정한 뒤 코드 작성.

---

## 9. ui-ux-pro-max — 색·폰트를 디자인 시스템으로 묶기

제품 유형에 맞춰 패턴·스타일·색·타이포·효과·피해야 할 패턴·체크리스트를 한 번에 생성.

**설치**
```
# Claude Code 마켓플레이스
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```
```bash
# CLI (권장) — 패키지명 ui-ux-pro-max-cli, 명령어 uipro
npm install -g ui-ux-pro-max-cli
cd /path/to/your/project
uipro init --ai claude            # cursor, codex, opencode, gemini ... / all
uipro init --ai claude --global   # ~/.claude/skills/ 에 설치
```
- 구버전 `uipro-cli` 는 사용하지 말 것. 검색 스크립트에 Python 3.x 필요.

**사용** — Claude Code 에선 UI 요청 시 자동 활성화.
```
Build a landing page for my SaaS product
Create a dashboard for healthcare analytics
```
디자인 시스템 직접 생성:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness" --design-system -p "Serenity Spa"
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech banking" --design-system -f markdown
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "elegant serif" --domain typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation" --stack react
```

---

## 10. hallmark — 뻔한 AI 스타일 구성 걸러내기

48개 테마 중 3개를 제안해 페이지를 만들고, 실제 브라우저에서 "AI 티" 패턴을 린트한 뒤 새 맥락 리뷰어가 최종 검토.

**설치** (Node 18+)
```bash
npx skills add nutlope/hallmark -g                          # 전역
npx skills add nutlope/hallmark -g --agent claude-code      # 특정 하네스만
npm i -g puppeteer-core                                      # 브라우저 검사용 (Chrome 필요)
```
Claude Code 플러그인: `/plugin marketplace add nutlope/hallmark` → `/plugin install hallmark@hallmark` (`/hallmark:hallmark` 로 호출).

**사용**
```
/hallmark <prompt>                  # 새 페이지 빌드
/hallmark redesign ./src/app        # 내용·연결 유지하고 재설계
/hallmark audit ./index.html        # 수정 없이 점검 보고만
```
- `custom` 이라고 하면 테마 없이 프롬프트만으로 설계.
- 리디자인 시 `keep the layout`(스타일만), `polish`(티 나는 부분만) 지정 가능.
- 아무 페이지 린트: `node skills/hallmark/scripts/sloplint.mjs <file-or-dir> --render`
- 자동 실행 안 되면 `use hallmark to build ...` 로 명시.

---

## 11. emil-design-eng — 애니메이션 곡선·속도 다듬기

Emil Kowalski(Vercel·Linear 출신)의 UI 폴리싱·애니메이션 판단 기준을 담은 스킬. 저장소 `emilkowalski/skills` 의 메인 스킬.

**설치**
```bash
npx skills@latest add emilkowalski/skills
```
**사용**
- 처음 호출하면 준비 메시지만 내고 질문을 기다림.
- UI 코드 리뷰 시 Before/After 표 형식으로 수정안 제시.
- 같은 저장소의 관련 스킬:
  - `animate` — 올바른 곡선·시간·속성으로 애니메이션 새로 작성
  - `review-animations` — 애니메이션 엄격 리뷰
  - `improve-animations` — 코드베이스 전체 애니메이션 감사 + 실행 계획
  - `animation-performance` — 프레임 드랍 해결
  - `find-animation-opportunities`, `animation-vocabulary`, `apple-design`, `mobile-native`, `break-ui` 등

---

## 12. web-design-guidelines — 접근성·사용성 점검

Vercel 의 Web Interface Guidelines(100+ 규칙)로 UI 코드를 감사. 코드 생성은 하지 않고 리뷰만 한다.

**설치**
```bash
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
# 저장소 전체 스킬 설치
npx skills add vercel-labs/agent-skills
```
**사용**
```
review my UI
check accessibility
audit design
check my site against best practices
```
- 파일/패턴을 인자로 주면 해당 파일만 검사, 없으면 어떤 파일을 볼지 물어봄.
- 실행 시마다 `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` 에서 최신 규칙을 받아옴 (네트워크 필요).
- 결과는 `file:line` 형식.
- 점검 범위: 접근성(aria, 시맨틱 HTML, 키보드), 포커스, 폼, 애니메이션(reduced-motion), 타이포, 이미지, 성능, 내비게이션·상태, 다크 모드, 터치, 다국어.

---

## 디자인 스킬 추천 순서

1. **frontend-design** 로 방향 설정 →
2. **ui-ux-pro-max** 로 색·폰트 디자인 시스템 생성 →
3. **hallmark audit** 로 뻔한 구성 제거 →
4. **emil-design-eng** 로 애니메이션 다듬기 →
5. **web-design-guidelines** 로 접근성·사용성 최종 점검
