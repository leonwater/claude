# 외부 도구 사용법 정리 (Windows 기준)

각 저장소의 공식 README·문서(2026-10-27 기준 최신 커밋)에 적힌 내용만 옮겼다.
저장소는 `powershell -ExecutionPolicy Bypass -File scripts\clone_external.ps1` 로 `external\` 아래에 내려받는다 (git 추적 제외).

## 공통 전제

- **터미널은 PowerShell** 기준이다. 아래 명령은 한 줄로 쓰고, 줄바꿈용 `\` 는 쓰지 않는다.
- **설치는 모두 전역**(모든 프로젝트에서 사용) 기준이다.
  - 스킬은 `%USERPROFILE%\.claude\skills\` 에 들어간다 (PowerShell 에서는 `~\.claude\skills\`).
  - `/plugin install` 은 기본 범위가 사용자 전체라서 옵션이 필요 없다.
  - `npx skills add` 는 `-g`(또는 `--global`)를 빼면 현재 폴더에만 설치되니 꼭 붙인다.
- **미리 설치해 둘 것**: Git, Node.js (22 이상 권장 — hyperframes 요구), Python 3.10 이상(graphify·ui-ux-pro-max).
- Windows 에서는 `python3` 대신 `python` 을 쓴다 (ui-ux-pro-max `CLAUDE.md` 명시).

| # | 도구 | 한 줄 요약 | Windows 필요 환경 |
|---|------|-----------|-------------------|
| 1 | security-audit-skill | 에이전트를 보안 감사자로 만드는 스킬 | Node.js |
| 2 | graphify | 프로젝트를 지식 그래프로 만들어 grep 대신 질의 | Python 3.10+, uv |
| 3 | opencode | 오픈소스 AI 코딩 에이전트 | WSL 권장 (네이티브도 가능) |
| 4 | hyperframes | HTML → MP4 영상 렌더링 | 앱은 설치만, CLI 는 Node.js 22+ 와 FFmpeg |
| 5 | ComfyUI | 노드 그래프 기반 이미지·영상·3D·오디오 생성 | 데스크톱 앱 또는 포터블, GPU 권장 |
| 6 | ruflo | Claude Code·Codex 용 멀티 에이전트 하네스 | Node.js |
| 7 | claude-plugins-official | Anthropic 공식 Claude Code 플러그인 디렉터리 | Claude Code |
| 8 | frontend-design | 주제에 맞는 디자인 방향 설정 | Claude Code (7번에 포함) |
| 9 | ui-ux-pro-max | 색·폰트·패턴을 디자인 시스템으로 생성 | Python 3.x |
| 10 | hallmark | AI 티 나는 뻔한 구성 검출·차단 | Node 18+ (브라우저 검사는 puppeteer-core + Chrome) |
| 11 | emil-design-eng | 애니메이션 곡선·속도·디테일 다듬기 | Node.js (npx) |
| 12 | web-design-guidelines | 접근성·사용성 규칙 점검 | Node.js (npx) |
| 13 | ponytail | 새 코드를 덜 쓰고 기존 코드를 재사용하게 하는 스킬 | Node.js (훅이 사용) |

---

## 1. security-audit-skill (cloudflare)

코드베이스를 6단계(정찰 → 커버리지 기반 탐색 → 후보 검증 → 구조화 출력 → 독립 재검증 → 보고서)로 감사한다.

**설치** ([Skills CLI](https://skills.sh), 전역)
```powershell
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global
```

**사용** — 감사할 저장소에서 에이전트에게 요청하면 자동 실행된다.
```
security audit this codebase
find security vulnerabilities in ./src
do a security review, output to ~/audits/my-project
```
- 출력 경로를 안 주면 `~/security-audit-skill/<repo-name>/run-<N>` 에 저장 (Windows 에서는 사용자 폴더 아래).
- 결과물: `findings.json`(confirmed / needs_validation / rejected), `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`.
- 여러 번 돌리면 이전 결과를 이어받아 커버리지가 늘어난다 (1회 실행은 전체의 약 절반 발견).
- 대상 코드를 실행하려면 네트워크 차단·쓰기 제한된 OS 샌드박스가 필요. 없으면 실행 대신 `needs_validation` 으로 남긴다.
- README 에 Windows 전용 설명은 없다. 검증 스크립트(`.cjs`)는 Node.js 만 있으면 된다.

---

## 2. graphify (Graphify-Labs)

코드·문서·PDF·이미지·영상을 지식 그래프로 만든다. 코드는 tree-sitter 로 로컬 파싱(LLM 불필요).

**설치** — PyPI 패키지명은 `graphifyy`(y 두 개), 명령어는 `graphify`.
```powershell
winget install astral-sh.uv        # uv 가 없을 때 (README 의 Windows 빠른 설치)
uv tool install graphifyy          # 또는 pipx install graphifyy
graphify install                   # Windows 자동 감지 (전역, 기본값)
```
- 자동 감지가 안 되면 `graphify install --platform windows`.
- `graphify` 를 못 찾으면 `uv tool update-shell` 후 터미널을 다시 연다.
- `--project` 를 붙이면 현재 저장소에만 설치되므로 붙이지 않는다.
- 다른 에이전트: `--platform codex | opencode | gemini | copilot ...`, Cursor 는 `graphify cursor install`.
- PowerShell 따옴표 문제, `command not found` 는 [Troubleshooting](https://docs.graphify.com/troubleshooting) 참고 (README 안내).

**사용** (어시스턴트 안에서)
```
/graphify .                                   # 현재 폴더 그래프 생성
/graphify ./docs --update                     # 변경 파일만 재추출
/graphify query "what connects auth to the database?"
/graphify path "UserService" "DatabasePool"
/graphify explain "RateLimiter"
/graphify add https://arxiv.org/abs/1706.03762
```
- 결과: `graphify-out\graph.html`(브라우저 시각화), `GRAPH_REPORT.md`(요약), `graph.json`(전체 그래프).
- CLI 직접 질의: `graphify query / path / explain`. 종료 코드 0=답, 3=이름 모호, 4=노드 없음.
- 커밋 시 자동 재빌드: `graphify hook install`.
- 항상 그래프를 쓰게 하기: 프로젝트마다 `graphify claude install` 등을 한 번 실행 (그 프로젝트에 설정 파일을 쓰는 방식).
- 제거: `graphify uninstall` (`--purge` 로 `graphify-out\` 까지 삭제).
- 선택 기능은 extras 로 설치: `uv tool install "graphifyy[pdf]"`, `[video]`, `[mcp]`, `[all]` 등.
- Codex 에서는 `/graphify` 대신 `$graphify`.

---

## 3. opencode (anomalyco)

오픈소스 AI 코딩 에이전트.

**Windows 설치 (택1)**
- **WSL 권장**: 저장소 문서가 "WSL 이 파일 시스템 성능·터미널 지원·호환성이 더 좋다"며 권장한다. WSL 터미널 안에서 README 의 리눅스 설치 명령을 쓴다.
  ```bash
  wsl --install                                  # PowerShell, WSL 이 없을 때 (Microsoft 공식 안내)
  curl -fsSL https://opencode.ai/v2/install | bash   # WSL 터미널 안에서 (README)
  cd /mnt/c/Users/YourName/project && opencode       # Windows 파일은 /mnt/c/ 로 접근
  ```
- **데스크톱 앱(BETA)**: [opencode.ai/download](https://opencode.ai/download) 에서 `opencode-desktop-win-x64.exe`.
- **네이티브 Windows** (저장소 `docs/index.mdx` 의 Windows 항목):
  ```powershell
  choco install opencode
  scoop install opencode
  npm install -g opencode-ai
  ```
  `mise use -g github:anomalyco/opencode`, Docker(`docker run -it --rm ghcr.io/anomalyco/opencode`), GitHub Releases 바이너리도 가능. "Bun 으로 Windows 설치는 진행 중"이라고 적혀 있다.
- ⚠️ **버전 주의**: 메인 README 는 V2(`npm i -g @opencode/cli@latest`, `brew install anomalyco/tap/opencode-v2`)를, 저장소 안 docs 의 Windows 항목은 V1 계열(`opencode-ai`, `brew install anomalyco/tap/opencode` 가 V1)을 가리킨다. docs 에도 "Homebrew `opencode` 공식 formula 는 V2" 라고 적혀 있어 두 문서가 어긋난다. 어느 쪽이 최신인지 확인하지 못했으니 설치 후 `opencode --version` 으로 확인하고, V2 를 원하면 README 의 `@opencode/cli` 를 쓴다.
- 설치 스크립트는 `$HOME/.opencode/bin` 에 설치한다 (README).

**사용**
- `Tab` 키로 내장 에이전트 전환
  - **build**: 기본, 전체 권한 개발용
  - **plan**: 읽기 전용 분석용 (파일 수정 거부, bash 실행 전 확인)
- `@general` 로 복잡한 검색·다단계 작업용 서브에이전트 호출.
- WSL 서버 + 데스크톱 앱: WSL 에서 `opencode serve --hostname 0.0.0.0 --port 4096` 후 앱에서 `http://localhost:4096` 접속. 이때 `OPENCODE_SERVER_PASSWORD` 로 비밀번호를 꼭 설정한다.
- 웹 클라이언트는 PowerShell 이 아니라 WSL 터미널에서 `opencode web --hostname 0.0.0.0` 실행을 권장.
- 설정 문서: [opencode.ai/v2/docs](https://opencode.ai/v2/docs)

---

## 4. hyperframes (heygen-com)

HTML·CSS·미디어·애니메이션을 결정적(deterministic) MP4 로 렌더링하는 프레임워크.

**가장 쉬운 방법 — Studio 앱 (Windows 64비트 Intel/AMD 지원, Windows on Arm 은 아직 없음)**
1. [hyperframes.dev/studio](https://hyperframes.dev/studio) 에서 **Download for Windows** → `Install-HyperFrames.exe` 받기.
2. 실행하면 게시자가 **HeyGen** 으로 표시된다. 설치 후 **HyperFrames** 를 열고 무료 HeyGen 계정으로 로그인.
3. **Make something** 에 원하는 영상을 입력.
- 앱 설정·로그인 정보는 `%APPDATA%\HyperFrames` 에 저장된다.
- 앱은 사용자 컴퓨터의 AI 에이전트를 사용하며, 에이전트 요금은 각자 플랜으로 청구된다. HeyGen 미디어(아바타·생성 영상)만 요청 시 크레딧을 쓴다.

**AI 에이전트로 쓰기** (Claude Code 등, 전역)
```powershell
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
# 이후 /hyperframes:hyperframes 로 호출

# 또는 독립 스킬로 전역 설치 — 코어 스킬 4개
npx hyperframes skills update
```
프롬프트 예: `Using /hyperframes, create a 10-second product intro with a fade-in title, a background video, and subtle background music.`

**CLI 로 직접 쓰기** (Node.js 22+, FFmpeg 필요)
```powershell
npx hyperframes init my-video
cd my-video
npx hyperframes preview      # 브라우저 미리보기 (라이브 리로드)
npx hyperframes render       # MP4 렌더링
npx hyperframes add data-chart   # 카탈로그 블록 추가
```
- FFmpeg 를 패키지 관리자 없이 쓰려면 `ffmpeg.exe`, `ffprobe.exe` 를 받은 뒤 환경변수 `HYPERFRAMES_FFMPEG_PATH`, `HYPERFRAMES_FFPROBE_PATH` 에 각 경로를 지정한다. 또는 프로젝트의 `.hyperframes\bin\` 에 두고 그 폴더에서 실행 (PATH 가 먼저 검색되므로 특정 빌드가 필요하면 환경변수 사용). `npx hyperframes doctor --json` 으로 확인.
- PowerShell 에서는 인라인 JSON 의 따옴표가 사라지므로, JSON 플래그는 파일로 만들어 경로로 넘기거나 `-` 로 파이프한다 (`--grading grading.json` 등. `--variables`, `--vars` 도 동일).
- 코어 스킬: `/hyperframes`(먼저 읽기), `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`.
- 필요 시 설치: `/figma`, `/slideshow`, `/remotion-to-hyperframes` → `npx hyperframes skills update <name>`.
- 영상은 HTML + `data-start` / `data-duration` / `data-track-index` 속성으로 정의, GSAP·CSS·Lottie·Three.js 등으로 애니메이션.
- 문서: [hyperframes.heygen.com](https://hyperframes.heygen.com/introduction)

---

## 5. ComfyUI (Comfy-Org)

노드 그래프로 이미지·영상·3D·오디오 생성 워크플로를 만드는 엔진.

**Windows 설치 (택1)**
- **데스크톱 앱 (신규 사용자에게 권장)**: [comfy.org/download](https://comfy.org/download).
- **Windows 포터블** (README 상 일반 사용자에게는 비권장): GitHub Releases 의 7z 를 받아 [7-Zip](https://7-zip.org) 등으로 압축을 풀고 실행.
  - NVIDIA(20 시리즈 이상): `ComfyUI_windows_portable_nvidia.7z` (Python 3.13, PyTorch CUDA 13.0 — 안 켜지면 NVIDIA 드라이버 업데이트)
  - AMD: `ComfyUI_windows_portable_amd.7z`, Intel: `ComfyUI_windows_portable_intel.7z`
  - NVIDIA 10 시리즈 이하: `ComfyUI_windows_portable_nvidia_cu126.7z` (**20 시리즈 이상에는 쓰지 말 것**)
  - 압축이 안 풀리면 파일 우클릭 → 속성 → **차단 해제**.
- **comfy-cli**: `pip install comfy-cli` → `comfy install`
- **수동 설치**:
  ```powershell
  git clone https://github.com/Comfy-Org/ComfyUI.git
  cd ComfyUI
  pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu130
  pip install -r requirements.txt
  python main.py
  ```
  - "Torch not compiled with CUDA enabled" 오류 시 `pip uninstall torch` 후 위 명령으로 재설치.
  - AMD(Windows, ROCm 10.0): Windows 11 + 최신 AMD 드라이버 + 64비트 Python 3.13 필요, README 의 `pip install --index-url https://stable.repo.amd.com/rocm/whl-next/ "torch[device-all]==2.13.0+rocm10.0.0" ...` 명령 사용.
  - Intel Arc: `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/xpu`

**사용**
- 기본 주소: `http://127.0.0.1:8188` (`--listen`, `--port` 로 변경).
- 모델 위치: 체크포인트 → `models\checkpoints`, VAE → `models\vae`.
- 다른 UI 와 모델 공유: `extra_model_paths.yaml.example` → `extra_model_paths.yaml` 로 이름을 바꿔 경로 지정 (포터블은 ComfyUI 폴더 안에 있음).
- 커스텀 노드 관리자: `pip install -r manager_requirements.txt` 후 `python main.py --enable-manager`.
- 단축키: `Ctrl+Enter` 실행 대기열 추가, `Ctrl+S` 저장, `Ctrl+O` 불러오기, 더블클릭 노드 검색.
- 생성된 PNG 를 화면에 드래그하면 시드 포함 워크플로 전체 복원.
- 프롬프트 가중치 `(good code:1.2)`, 와일드카드 `{day|night}`.
- 고품질 미리보기: `--preview-method auto` (TAESD 는 `models\vae_approx` 에 디코더 넣고 `--preview-method taesd`).
- 완전 오프라인: `--offline`.

---

## 6. ruflo (ruvnet, 구 Claude Flow)

Claude Code·Codex 위에 에이전트 스웜·메모리·훅을 얹는 하네스.

**경로 A — Claude Code 플러그인 (전역 설치는 이 방법, 작업공간에 파일 안 생김)**
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
```powershell
npm install -g ruflo@latest
npx ruflo@latest init wizard
claude mcp add --scope user claude-flow -- npx ruflo@latest mcp start
```
- ⚠️ README 의 `curl ... | bash` 한 줄 설치는 POSIX 셸(Git-Bash, WSL)용이다. 네이티브 PowerShell·cmd 에서는 `npx ruflo@latest init wizard` 를 쓴다 (`'bash' is not recognized` 오류의 해결책으로 README 가 안내).
- `claude mcp add` 는 `--scope user` 를 빼면 현재 프로젝트에만 등록된다 (Claude Code 동작, ruflo README 에는 이 옵션이 없음). 네이티브 Windows 에서 `npx` 기반 MCP 가 실행되지 않으면 별도 처리가 필요할 수 있으나, ruflo README 에는 Windows 전용 MCP 명령이 없어 확인하지 못했다.
- `init` 은 실행한 프로젝트에 `.claude\`, `.claude-flow\`, `CLAUDE.md` 를 만드는 방식이라 전역 설치가 없다. 훅·에이전트까지 쓰려면 프로젝트마다 한 번 실행한다.
- 설치 후엔 Claude Code 를 평소처럼 쓰면 훅이 작업 라우팅·학습을 자동 처리.
- 상세: 저장소 `docs\USERGUIDE.md`.

---

## 7. claude-plugins-official (anthropics)

Anthropic 이 관리하는 Claude Code 플러그인 마켓플레이스. `plugins\`(공식), `external_plugins\`(파트너·커뮤니티).

**사용** (Claude Code 안에서, 기본 범위가 사용자 전체라 전역 설치됨)
```
/plugin install {plugin-name}@claude-plugins-official
/plugin   → Discover 에서 탐색
```
- 공식 플러그인 예: `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `pr-review-toolkit`, `skill-creator`, `security-guidance`, 각 언어 LSP 등.
- 외부 플러그인 예: `github`, `gitlab`, `linear`, `playwright`, `context7`, `serena`, `terraform` 등.
- 설치 전 신뢰 여부 확인 필요 (Anthropic 이 외부 MCP 서버 내용을 보증하지 않음).

---

## 8. frontend-design — 주제에 맞는 디자인 방향 설정

`claude-plugins-official\plugins\frontend-design` 에 포함되어 별도 다운로드가 필요 없다.

**설치** (사용자 전체)
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
```powershell
# CLI (README 권장) — 패키지명 ui-ux-pro-max-cli, 명령어 uipro
npm install -g ui-ux-pro-max-cli
uipro init --ai claude --global   # %USERPROFILE%\.claude\skills\ 에 설치
uipro update --global             # 전역 스킬 파일 갱신
```
```
# 또는 Claude Code 마켓플레이스 (사용자 전체)
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```
- `--global` 을 빼면 현재 프로젝트에만 설치된다.
- 구버전 `uipro-cli` 는 사용하지 말 것. 검색 스크립트에 Python 3.x 필요 (표준 라이브러리만 사용, 네트워크 호출 없음).
- README 에는 Python 설치 단계가 사람용으로만 적혀 있고, 에이전트는 소프트웨어를 직접 설치하지 않고 사용자에게 묻도록 되어 있다.

**사용** — Claude Code 에선 UI 요청 시 자동 활성화.
```
Build a landing page for my SaaS product
Create a dashboard for healthcare analytics
```
디자인 시스템 직접 생성 (**Windows 는 `python3` 대신 `python`**, 전역 설치라 스크립트는 `%USERPROFILE%\.claude\skills\` 아래):
```powershell
python ~\.claude\skills\ui-ux-pro-max\scripts\search.py "beauty spa wellness" --design-system -p "Serenity Spa"
python ~\.claude\skills\ui-ux-pro-max\scripts\search.py "fintech banking" --design-system -f markdown
python ~\.claude\skills\ui-ux-pro-max\scripts\search.py "elegant serif" --domain typography
python ~\.claude\skills\ui-ux-pro-max\scripts\search.py "form validation" --stack react
```

---

## 10. hallmark — 뻔한 AI 스타일 구성 걸러내기

48개 테마 중 3개를 제안해 페이지를 만들고, 실제 브라우저에서 "AI 티" 패턴을 린트한 뒤 새 맥락 리뷰어가 최종 검토.

**설치** (Node 18+)
```powershell
npx skills add nutlope/hallmark -g --agent claude-code      # 전역, Claude Code 용 (~\.claude\skills\hallmark)
npx skills add nutlope/hallmark -g                          # 전역, 지원하는 모든 하네스
npm i -g puppeteer-core                                      # 브라우저 검사용 (Chrome 필요)
```
또는 Claude Code 플러그인(사용자 전체): `/plugin marketplace add nutlope/hallmark` → `/plugin install hallmark@hallmark` (`/hallmark:hallmark` 로 호출).

**사용**
```
/hallmark <prompt>                  # 새 페이지 빌드
/hallmark redesign ./src/app        # 내용·연결 유지하고 재설계
/hallmark audit ./index.html        # 수정 없이 점검 보고만
```
- `custom` 이라고 하면 테마 없이 프롬프트만으로 설계.
- 리디자인 시 `keep the layout`(스타일만), `polish`(티 나는 부분만) 지정 가능.
- 아무 페이지 린트: `node skills\hallmark\scripts\sloplint.mjs <file-or-dir> --render` (저장소를 clone 한 폴더 기준)
- puppeteer-core·Chrome 이 없으면 정적 검사만 실행된다.
- 자동 실행 안 되면 `use hallmark to build ...` 로 명시.
- README 에 Windows 전용 안내는 없다.

---

## 11. emil-design-eng — 애니메이션 곡선·속도 다듬기

Emil Kowalski(Vercel·Linear 출신)의 UI 폴리싱·애니메이션 판단 기준을 담은 스킬. 저장소 `emilkowalski/skills` 의 메인 스킬.

**설치**
```powershell
npx skills@latest add emilkowalski/skills -g
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
```powershell
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -g
# 저장소 전체 스킬 전역 설치
npx skills add vercel-labs/agent-skills -g
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

## 13. ponytail (DietrichGebert)

"할 말은 없고 코드는 한 줄"이 콘셉트인 스킬. 새로 짜기 전에 기존 코드·표준 라이브러리·플랫폼 기능을 먼저 쓰게 하고, 검증·에러 처리·보안·접근성은 절대 줄이지 않는다. 위험한 로직(분기·루프·파서·돈·보안)에는 작은 테스트를 남긴다. README 의 자체 벤치마크: 코드 -53%, 시간 -41%, 비용 -26%, 토큰 -45%.

**설치** (Claude Code — 두 줄을 **각각 따로** 입력해야 한다)
```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
- 플러그인은 Node.js 훅 2개를 쓰므로 `node` 가 PATH 에 있어야 한다. 없으면 스킬은 동작하지만 훅 호출마다 무해한 `node: command not found` 오류가 뜬다.
- Claude Code 데스크톱 앱은 Code 탭에서 같은 명령을 입력하거나 **+** → **Plugins** → **Add plugin**.
- 플러그인 대신 스킬만 전역 설치: `npx skills add DietrichGebert/ponytail --global` (스킬 6개 복사. 항상 켜진 규칙은 `AGENTS.md` 를 추가하거나 플러그인을 써야 함. `--skill '*'` 로 전부 선택).
- 공식 출처는 GitHub `DietrichGebert/ponytail` 과 npm `@dietrichgebert/ponytail` 뿐이다. `.exe`/`.dll` 이 들어 있는 사본은 공식이 아니다 (README 경고).

**사용** — 설치하면 매 세션 자동 활성화.
| 명령 | 기능 |
|---|---|
| `/ponytail [lite \| full \| ultra \| off]` | 강도 설정/끄기. 인자 없이 쓰면 꺼져 있을 때 켜고, 켜져 있으면 현재 수준 표시 |
| `/ponytail band [on \| off]` | 프롬프트 위 밴드(비용·토큰·재사용 횟수·테스트 통과 여부) 표시/숨김 (Claude Code 2.1.290 이상, 터미널·데스크톱 앱 한정) |
| `/ponytail band import` | 과거 Claude Code 세션을 보드에 추가 |
| `/ponytail-review` | 현재 diff 를 버그·보안·부하·테스트 누락·속도·삭제 가능 코드 관점으로 리뷰. `uncommitted`, `staged`, `branch`, PR 링크로 대상 지정 |
| `/ponytail-audit` | 같은 점검을 저장소 전체에 수행, 우선순위 순 |
| `/ponytail-debt` | 미뤄 둔 `shortcut:` 주석을 모아 장부로 정리 |
| `/ponytail-gain` | 벤치마크 기반 효과 지표 표시 |
| `/ponytail-help` | 명령 요약 |

- 기본 강도 설정(선택): 환경변수 `PONYTAIL_DEFAULT_MODE`(`lite`/`full`/`ultra`/`off`) 또는 `%APPDATA%\ponytail\config.json` 의 `defaultMode` 필드. 기본값은 `full`.
- 밴드·보드 데이터는 기본적으로 내 컴퓨터(`~/.config/ponytail/band/`)에만 저장된다. Windows 의 정확한 하위 경로는 README 에 따로 명시되어 있지 않다 (설정 파일만 `%APPDATA%\ponytail\`).
- 서브에이전트에도 규칙이 주입된다. 특정 에이전트 종류에서 빼려면 `PONYTAIL_SUBAGENT_MATCHER` 환경변수에 정규식을 지정.
- 제거: `/plugin remove ponytail`

---

## 디자인 스킬 추천 순서

1. **frontend-design** 로 방향 설정 →
2. **ui-ux-pro-max** 로 색·폰트 디자인 시스템 생성 →
3. **hallmark audit** 로 뻔한 구성 제거 →
4. **emil-design-eng** 로 애니메이션 다듬기 →
5. **web-design-guidelines** 로 접근성·사용성 최종 점검

ponytail 은 디자인과 별개로, 코드 작성·리뷰 전반에 항상 켜 두는 용도다.
