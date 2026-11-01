# 외부 도구 사용법 정리 (Windows 기준)

각 저장소의 공식 README·문서(2026-10-27 기준 최신 커밋)에 적힌 내용만 옮겼다.
저장소는 `powershell -ExecutionPolicy Bypass -File scripts\clone_external.ps1` 로 `external\` 아래에 내려받는다 (git 추적 제외).

## 공통 전제

- **터미널은 PowerShell** 기준이다. 아래 명령은 한 줄로 쓰고, 줄바꿈용 `\` 는 쓰지 않는다.
- **설치는 모두 전역**(모든 프로젝트에서 사용) 기준이다.
  - 스킬은 `%USERPROFILE%\.claude\skills\` 에 들어간다 (PowerShell 에서는 `~\.claude\skills\`).
  - 플러그인은 `/plugin` 슬래시 명령 대신 **PowerShell 에서 `claude plugin ...`** 으로 설치한다 (기본 범위 `user` = 전체 프로젝트, 옵션 불필요).
  - 플러그인 설치 후에는 **Claude Code 를 새로 시작**해야 적용된다.
  - `npx skills add` 는 `-g`(또는 `--global`)를 빼면 현재 폴더에만 설치되니 꼭 붙인다.
- **미리 설치해 둘 것**: Git, Node.js (22 이상 권장 — hyperframes 요구), Python 3.10 이상(graphify·ui-ux-pro-max).
- Windows 에서는 `python3` 대신 `python` 을 쓴다 (ui-ux-pro-max `CLAUDE.md` 명시).

## 한 번에 설치 (복사 → PowerShell 붙여넣기)

`/plugin` 은 Claude Code 안에서만 되므로, 아래는 **일반 PowerShell** 에서 실행하는 `claude plugin ...` 형식이다. 이미 설치된 항목은 오류가 나도 다음 줄로 넘어가면 된다.

**복사용 명령 표** (한 줄씩 PowerShell 에 붙여넣기. 플러그인은 먼저 해당 마켓플레이스를 등록해야 한다)

| 구분 | 도구 | 명령 |
|---|---|---|
| 마켓플레이스 | claude-plugins-official | `claude plugin marketplace add anthropics/claude-plugins-official` |
| 플러그인 | frontend-design | `claude plugin install frontend-design@claude-plugins-official` |
| 플러그인 | context7 | `claude plugin install context7@claude-plugins-official` |
| 플러그인 | code-review | `claude plugin install code-review@claude-plugins-official` |
| 플러그인 | superpowers | `claude plugin install superpowers@claude-plugins-official` |
| 마켓플레이스 | hyperframes | `claude plugin marketplace add heygen-com/hyperframes` |
| 플러그인 | hyperframes | `claude plugin install hyperframes@hyperframes` |
| 마켓플레이스 | ui-ux-pro-max | `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` |
| 플러그인 | ui-ux-pro-max | `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| 마켓플레이스 | hallmark | `claude plugin marketplace add nutlope/hallmark` |
| 플러그인 | hallmark | `claude plugin install hallmark@hallmark` |
| 마켓플레이스 | ponytail | `claude plugin marketplace add DietrichGebert/ponytail` |
| 플러그인 | ponytail | `claude plugin install ponytail@ponytail` |
| 마켓플레이스 | rea | `claude plugin marketplace add morluto/rea` |
| 플러그인 | rea | `claude plugin install rea@rea` |
| 스킬 | security-audit | `npx -y skills add https://github.com/cloudflare/security-audit-skill -s security-audit -g -a claude-code -y --copy` |
| 스킬 | emil-design-eng | `npx -y skills add emilkowalski/skills -s emil-design-eng -g -a claude-code -y --copy` |
| 스킬 | web-design-guidelines | `npx -y skills add vercel-labs/agent-skills -s web-design-guidelines -g -a claude-code -y --copy` |
| CLI | graphify | `uv tool install graphifyy` 후 `graphify install` |

**방법 1 — 스크립트 한 번 실행** (저장소 루트에서)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_all.ps1
```

**방법 2 — 아래 블록을 통째로 붙여넣기**
```powershell
# 플러그인 (전역)
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
claude plugin marketplace add nutlope/hallmark
claude plugin install hallmark@hallmark
claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail
claude plugin install context7@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin install superpowers@claude-plugins-official
claude plugin marketplace add morluto/rea
claude plugin install rea@rea

# 독립 스킬 (전역)
npx -y skills add https://github.com/cloudflare/security-audit-skill -s security-audit -g -a claude-code -y --copy
npx -y skills add emilkowalski/skills -s emil-design-eng -g -a claude-code -y --copy
npx -y skills add vercel-labs/agent-skills -s web-design-guidelines -g -a claude-code -y --copy

# graphify
uv tool install graphifyy
graphify install
```
- 끝나면 **Claude Code 를 새로 시작**한다. `claude plugin list` 로 설치 목록을 확인한다.
- `claude plugin install` 의 기본 범위는 `user`(전체 프로젝트)다 (`claude plugin install --help` 로 확인). `claude plugin marketplace add` 도 기본이 `user`.
- `npx skills add` 옵션은 `npx skills add --help` 기준: `-s` 스킬 지정, `-g` 전역, `-a` 에이전트 지정, `-y` 확인 생략, `--copy` 심볼릭 링크 대신 복사(Windows 에서 링크 권한 문제 회피용으로 추가한 것).
- 스크립트·블록에서 **일부러 뺀 것**: ruflo(요청으로 제외), opencode·ComfyUI·hyperframes Studio 앱(일반 프로그램이라 아래 각 항목의 설치 방법 사용), `ui-ux-pro-max-cli`(플러그인으로 대체).
- 이 스크립트와 `claude plugin ...` 명령은 Windows 에서 직접 실행해 보지 못했다 (이 작업 환경은 리눅스이고 설치 실행이 막혀 있음). 명령 형식은 `claude plugin --help`·`npx skills add --help` 출력으로 확인했다.

---

| # | 도구 | 한 줄 요약 | Windows 필요 환경 |
|---|------|-----------|-------------------|
| 1 | security-audit-skill | 에이전트를 보안 감사자로 만드는 스킬 | Node.js |
| 2 | graphify | 프로젝트를 지식 그래프로 만들어 grep 대신 질의 | Python 3.10+, uv |
| 3 | opencode | 오픈소스 AI 코딩 에이전트 | WSL 권장 (네이티브도 가능) |
| 4 | hyperframes | HTML → MP4 영상 렌더링 | 앱은 설치만, CLI 는 Node.js 22+ 와 FFmpeg |
| 5 | ComfyUI | 노드 그래프 기반 이미지·영상·3D·오디오 생성 | 데스크톱 앱 또는 포터블, GPU 권장 |
| 6 | superpowers | 설계 → 계획 → TDD → 리뷰까지 강제하는 개발 방법론 스킬 모음 | Claude Code |
| 7 | claude-plugins-official | Anthropic 공식 Claude Code 플러그인 디렉터리 | Claude Code |
| 8 | frontend-design | 주제에 맞는 디자인 방향 설정 | Claude Code (7번에 포함) |
| 9 | ui-ux-pro-max | 색·폰트·패턴을 디자인 시스템으로 생성 | Python 3.x |
| 10 | hallmark | AI 티 나는 뻔한 구성 검출·차단 | Node 18+ (브라우저 검사는 puppeteer-core + Chrome) |
| 11 | emil-design-eng | 애니메이션 곡선·속도·디테일 다듬기 | Node.js (npx) |
| 12 | web-design-guidelines | 접근성·사용성 규칙 점검 | Node.js (npx) |
| 13 | ponytail | 새 코드를 덜 쓰고 기존 코드를 재사용하게 하는 스킬 | Node.js (훅이 사용) |
| 14 | rea | 바이너리·앱·웹의 동작을 에이전트로 역분석하는 MCP/CLI | Node.js 22.23.4+ 등, 네이티브 분석은 Ghidra 등 별도 |

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

## 6. superpowers (obra)

코딩 에이전트용 개발 방법론. 만들기 전에 의도를 먼저 묻고(brainstorming) → 설계 승인 → 2~5분 단위 구현 계획 → 서브에이전트가 작업별로 구현·리뷰 → 브랜치 마무리 순으로 진행한다. 스킬이 자동으로 발동하므로 별도 조작이 필요 없다 (README).

**설치** (README 의 Claude Code 항목, 공식 마켓플레이스에 포함됨 — `marketplace.json` 에서 확인)
```powershell
claude plugin install superpowers@claude-plugins-official
```
- 먼저 `claude plugin marketplace add anthropics/claude-plugins-official` 가 되어 있어야 한다 (8번 참고).
- README 의 다른 방법(작성자 마켓플레이스): `claude plugin marketplace add obra/superpowers-marketplace` → `claude plugin install superpowers@superpowers-marketplace`
- 하네스마다 따로 설치해야 한다 (Claude Code, Codex, Cursor, Gemini CLI 등).

**사용** — 설치 후 코딩 작업을 요청하면 자동 적용.
- 기본 흐름: brainstorming → using-git-worktrees → writing-plans → subagent-driven-development 또는 executing-plans → test-driven-development → requesting-code-review → finishing-a-development-branch.
- 에이전트는 작업 전에 관련 스킬이 있는지 항상 확인한다 ("제안이 아니라 필수 워크플로").
- TDD 는 RED-GREEN-REFACTOR 를 강제하며, 테스트보다 먼저 쓴 코드는 삭제한다고 적혀 있다.
- 엉뚱하게 동작하면 "figure out what went wrong with superpowers in this session" 이라고 요청 → `diagnosing-superpowers` 스킬 실행.
- 포함 스킬: brainstorming, writing-plans, executing-plans, dispatching-parallel-agents, requesting/receiving-code-review, using-git-worktrees, finishing-a-development-branch, subagent-driven-development, test-driven-development, systematic-debugging, verification-before-completion, diagnosing-superpowers, writing-skills, using-superpowers.
- ⚠️ 모든 작업에 설계 질문과 TDD 를 강제하므로 작은 수정에는 번거로울 수 있다. ponytail(코드 최소화)과 함께 쓸 때 동작이 겹치는지는 확인하지 못했다.

---

## 7. claude-plugins-official (anthropics)

Anthropic 이 관리하는 Claude Code 플러그인 마켓플레이스. `plugins\`(공식), `external_plugins\`(파트너·커뮤니티).

**사용** (PowerShell, 기본 범위가 사용자 전체라 전역 설치됨)
```powershell
claude plugin install {plugin-name}@claude-plugins-official
claude plugin list                  # 설치된 플러그인 확인
```
- 탐색은 Claude Code 안의 `/plugin` → Discover 에서 하거나, 저장소 `plugins\`·`external_plugins\` 폴더 이름을 보고 고른다.
- 공식 플러그인 예: `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `pr-review-toolkit`, `skill-creator`, `security-guidance`, 각 언어 LSP 등.
- 외부 플러그인 예: `github`, `gitlab`, `linear`, `playwright`, `context7`, `serena`, `terraform` 등.
- 설치 전 신뢰 여부 확인 필요 (Anthropic 이 외부 MCP 서버 내용을 보증하지 않음).

---

## 8. frontend-design — 주제에 맞는 디자인 방향 설정

`claude-plugins-official\plugins\frontend-design` 에 포함되어 별도 다운로드가 필요 없다.

**설치** (사용자 전체)
```powershell
claude plugin install frontend-design@claude-plugins-official
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
```powershell
# 또는 Claude Code 마켓플레이스 (사용자 전체)
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
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
또는 Claude Code 플러그인(사용자 전체):
```powershell
claude plugin marketplace add nutlope/hallmark
claude plugin install hallmark@hallmark
```
플러그인으로 설치하면 `/hallmark:hallmark` 로 호출한다.

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

**설치** (PowerShell — README 는 슬래시 명령을 두 번에 나눠 입력하라고 하며, 아래도 한 줄씩 실행한다)
```powershell
claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail
```
- 플러그인은 Node.js 훅 2개를 쓰므로 `node` 가 PATH 에 있어야 한다. 없으면 스킬은 동작하지만 훅 호출마다 무해한 `node: command not found` 오류가 뜬다.
- Claude Code 데스크톱 앱은 Code 탭에서 **+** → **Plugins** → **Add plugin** 으로도 설치할 수 있다 (README).
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
- 제거: `claude plugin uninstall ponytail` (README 는 `/plugin remove ponytail`)

---

## 14. rea — Reverse Engineer Anything (morluto)

"별이 가장 많은 리버스 엔지니어링 도구"로 요청하신 후보다. 에이전트가 MCP 로 네이티브 바이너리·Electron/JS 앱·.NET·APK·웹사이트를 로컬에서 분석하고, 결론마다 근거와 한계를 함께 돌려준다 (README).

⚠️ **별 개수는 확인하지 못했다.** 이 환경에서는 GitHub API 접근이 막혀 있고, 웹 검색에 나온 수치(약 23만)는 블로그 한 곳의 주장이라 신뢰하지 않는다. 직접 [github.com/morluto/rea](https://github.com/morluto/rea) 에서 확인하고, "리버스 엔지니어링 전반"에서 별이 가장 많은 도구는 다를 수 있다(다른 도구를 원하면 알려 달라).

⚠️ **공식 출처만 사용**: README 가 `github.com/morluto/rea`, `rea.tools`, npm `rea-agents` 만 공식이라고 경고한다. 이름이 비슷한 저장소·복사된 README 는 공식이 아니다.

**설치** (Node.js 22.x ≥ 22.23.4, 24.x ≥ 24.22.1 또는 26.12.1+ 필요 — README)
```powershell
# A. Claude Code 플러그인 (docs/installation.md 의 플러그인 항목)
claude plugin marketplace add morluto/rea
claude plugin install rea@rea

# B. 또는 setup 마법사 (에이전트 선택 → 변경 검토·승인, 기존 설정은 백업)
npx rea-agents setup
npm install --global rea-agents      # rea 명령을 계속 쓰려면
```
- **A 와 B 중 하나만** 쓴다. 둘 다 쓰면 `rea` 서버가 두 개 생긴다 (문서 명시). 일괄 설치 스크립트는 A 를 사용한다.
- 플러그인은 `rea setup` 을 실행하지 않으므로 분석 엔진(Ghidra 등) 설정은 별도다.
- 설치 후 Claude Code 를 새로 시작한다.

**사용**
```text
Understand how search works in the Notes app, show me the evidence, and build a similar feature for my project.
```
```powershell
npx -y rea-agents@latest analyze-javascript-application C:\absolute\path\to\app --json   # JS/Electron 앱 (ASAR 포함)
rea --help
rea update                      # npm 전역 설치 시 업데이트
rea doctor --json               # 환경 점검
```
- 엔진 없이 되는 정적 분석: JS/Electron, .NET, Go, Rust, PE 임포트·인증서, APK 서명, Godot PCK, 모델 파일(GGUF/safetensors) 등. 웹사이트 분석은 Chrome 계열 브라우저 필요.
- **Windows 네이티브 바이너리 분석**: Ghidra 또는 IDA 등이 필요하다. `rea setup` 은 Ghidra·Java·Python 을 설치하지 않으며, Windows 의 Hopper 자동 설치는 지원하지 않는다. Windows Ghidra 는 "experimental P0" 로 x86/x86-64/ARM64 PE 읽기 전용만 지원한다. 설정 예(PowerShell):
  ```powershell
  $env:GHIDRA_INSTALL_DIR = "C:\tools\ghidra_12.1.4_PUBLIC"
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
  rea doctor --json
  ```
- 분석은 로컬에서 실행되며, 런타임 캡처는 선택한 대상을 내 사용자 권한으로 실행한다.
- **적법한 용도만**: 저장소 `DISCLAIMER.md` 는 보안 연구, 악성코드·사고 분석, 상호운용성, 직접 소유·허가받은 소프트웨어 분석 등을 허용하고, DRM·라이선스·안티치트 우회, 게임 치트, 허가 없는 인증 우회, 상용 소프트웨어 복제는 지원하지 않는다고 밝힌다. 분석 대상의 라이선스와 관할 법을 먼저 확인할 것.
- 문서: [rea.tools](https://rea.tools/), 저장소 `docs/installation.md`, `docs/cli.md`.

---

## 디자인 스킬 추천 순서

1. **frontend-design** 로 방향 설정 →
2. **ui-ux-pro-max** 로 색·폰트 디자인 시스템 생성 →
3. **hallmark audit** 로 뻔한 구성 제거 →
4. **emil-design-eng** 로 애니메이션 다듬기 →
5. **web-design-guidelines** 로 접근성·사용성 최종 점검

ponytail 은 디자인과 별개로, 코드 작성·리뷰 전반에 항상 켜 두는 용도다.

---

## 추가하면 좋을 것 (제안)

모두 이미 받은 `claude-plugins-official` 저장소의 README·플러그인 파일에 적힌 내용만 정리했다. 설치는 PowerShell 에서 `claude plugin install <이름>@claude-plugins-official` (전역, 8번의 마켓플레이스 등록이 먼저 필요). 설치 후 Claude Code 를 새로 시작한다.

### 우선순위 높음

**1) context7 — 최신 문서 조회 MCP**
- 문제: AI 가 오래된 학습 데이터로 낡은·존재하지 않는 API 를 쓰는 것을 막는다. 소스 저장소의 현재 문서와 코드 예제를 가져온다.
- 구성: Context7 의 호스팅 서버(`https://mcp.context7.com/mcp`)에 연결하는 원격 MCP. 로컬 Node/npm 불필요.
- 도구 2개: `resolve-library-id`(라이브러리 검색 → `/vercel/next.js` 같은 ID 와 버전), `query-docs`(해당 라이브러리 문서를 질문과의 관련도 순으로 반환).
- 사용: 코딩 요청에서 "Next.js 최신 문서 기준으로" 처럼 라이브러리를 언급하면 에이전트가 호출한다.
- API 키는 선택. 없으면 익명 공용 한도를 공유한다. 내 플랜을 쓰려면 환경변수 `CONTEXT7_API_KEY` 를 설정하고 Claude Code 를 재시작 (README 는 `export` 예시만 있다. Windows 에서는 `setx CONTEXT7_API_KEY "키"` 가 일반적인 방법이나 README 에는 없다).
- 주의: 질문 내용이 외부 서비스(Context7)로 전송된다.
- 설치: `claude plugin install context7@claude-plugins-official`

**2) playwright — 브라우저 자동화 MCP (Microsoft)**
- 기능: 웹 페이지 조작, 스크린샷, 폼 입력, E2E 테스트.
- 구성: `npx @playwright/mcp@latest` 를 실행하는 MCP (파일 `.mcp.json` 에서 확인). Node.js 가 필요하다.
- 활용: hallmark·ui-ux-pro-max·web-design-guidelines 로 만든 화면을 실제 브라우저로 열어 확인·캡처.
- 브라우저 바이너리 설치 여부는 해당 파일에 안내가 없어 확인하지 못했다. 처음 실행 때 오류가 나면 메시지를 따른다.
- 설치: `claude plugin install playwright@claude-plugins-official`

**3) code-review — 다중 에이전트 PR 리뷰**
- 명령: `/code-review` (PR 브랜치에서 실행).
- 동작: 닫힘·초안·사소한·이미 리뷰한 PR 은 건너뛰고, 4개 에이전트가 병렬로 검토한다 — CLAUDE.md 준수 2개, 명백한 버그 1개, git blame·이력 기반 문제 1개.
- 각 이슈에 0~100 신뢰도를 매겨 **80 미만은 버리고**, 80 이상만 PR 댓글로 남긴다 (없으면 댓글 안 남김).
- 걸러내는 것: 기존부터 있던 문제, 린터가 잡는 것, 사소한 지적, 린트 무시 주석이 달린 코드.
- 팁: CLAUDE.md 가 구체적일수록 준수 검사가 정확하다.
- 설치: `claude plugin install code-review@claude-plugins-official`

### 우선순위 중간

**4) commit-commands — 커밋·PR 자동화**
- `/commit`: 변경 사항 분석 → 저장소의 기존 커밋 메시지 스타일에 맞춰 초안 작성 → 파일 스테이징 → 커밋. `.env`, `credentials.json` 같은 비밀 파일은 커밋하지 않도록 한다.
- `/commit-push-pr`: main 이면 새 브랜치 생성 → 커밋 → push → `gh pr create` 로 PR 생성 → URL 안내. 브랜치의 모든 커밋을 보고 요약·테스트 계획이 담긴 설명을 쓴다.
- `/clean_gone`: 원격에서 삭제된([gone]) 로컬 브랜치와 연결된 워크트리를 정리.
- 요구: `/commit-push-pr` 는 GitHub CLI(`gh`) 설치·인증과 `origin` 원격이 필요하다 (Windows: `winget install GitHub.cli` — 이 ID 는 제가 아는 값이며 README 에는 없다).

**5) security-guidance — 평소 작성하는 코드의 보안 점검 (3겹)**
1. 패턴 경고: Edit/Write 시 위험 패턴 약 25개(`yaml.load`, `pickle.load`, 날것의 `innerHTML`, 하드코딩된 비밀 등)를 즉시 알림. 자격 증명 불필요.
2. diff 리뷰: Claude 가 한 턴을 끝낼 때 diff 를 LLM(기본 최신 Opus)에 보내고, 심각도 높은 발견을 Claude 에게 돌려줘 사용자가 보기 전에 고치게 한다.
3. 커밋 리뷰: `git commit` 시 에이전트가 관련 파일을 읽어 데이터 흐름을 추적 — 여러 파일에 걸친 IDOR, 인증 우회, SSRF 등을 잡는다.
- 요구: Claude Code ≥ 2.1.144, PATH 에 Python 3.8+ (`python`/`py -3` 가능).
- 비용·프라이버시: 2·3단계는 LLM 호출이라 사용량이 늘고 diff 가 모델 제공자에게 전송된다. 자격 증명이 없으면 1단계만 동작한다.
- 끄기: `SECURITY_GUIDANCE_DISABLE=1`(전체), `ENABLE_CODE_SECURITY_REVIEW=0`(LLM 리뷰 전체), `ENABLE_PATTERN_RULES=0`(패턴 경고), `ENABLE_STOP_REVIEW=0`(턴 종료 리뷰만).
- 설치: `claude plugin install security-guidance@claude-plugins-official`

**6) code-simplifier — 코드 정리 에이전트**
- 방금 수정한 코드를 대상으로, **동작은 그대로 두고** 가독성·일관성·유지보수성을 높인다. 지시하지 않으면 최근 수정분만 본다. 지나치게 압축된 코드보다 명시적인 코드를 우선한다.
- 사용: 구현 후 "code-simplifier 로 정리해줘" 처럼 요청.
- 설치: `claude plugin install code-simplifier@claude-plugins-official`

**7) claude-md-management — CLAUDE.md 관리**
- `claude-md-improver`(스킬): 현재 코드베이스와 CLAUDE.md 가 어긋났는지 점검하고 품질 점수·수정안을 제시. 예: "audit my CLAUDE.md files", "check if my CLAUDE.md is up to date".
- `/revise-claude-md`(명령): 세션에서 알게 된 내용을 CLAUDE.md 에 반영. 세션 종료 시 사용.
- 설치: `claude plugin install claude-md-management@claude-plugins-official`

### 선택

**8) feature-dev — 7단계 기능 개발 워크플로**
- `/feature-dev <설명>`: 요구 파악 → 코드베이스 탐색(`code-explorer` 병렬) → 질문으로 모호함 해소 → 아키텍처 설계(`code-architect`, 여러 접근안) → 구현 → 품질 리뷰(`code-reviewer`) → 요약.
- ⚠️ superpowers 와 목적이 겹친다. 하나만 쓰는 편이 낫다.

**9) pr-review-toolkit — 6개 리뷰 전문 에이전트**
- `comment-analyzer`(주석 정확성·낡은 주석), `pr-test-analyzer`(테스트 커버리지의 질·누락), `silent-failure-hunter`(삼켜진 오류·부적절한 폴백), `type-design-analyzer`(타입 캡슐화·불변식 1~10점), `code-reviewer`(지침 준수), `code-simplifier`(단순화). 명령은 `review-pr`.
- ⚠️ code-review 와 일부 겹친다. 에이전트별로 깊게 보고 싶을 때만.

**10) typescript-lsp / pyright-lsp — 언어 서버(코드 인텔리전스)**
- 정의로 이동·참조 찾기·오류 검사를 제공. 플러그인과 별개로 서버를 직접 설치해야 한다.
  - TypeScript/JavaScript(`.ts .tsx .js .jsx .mts .cts .mjs .cjs`): `npm install -g typescript-language-server typescript`
  - Python(`.py .pyi`): `npm install -g pyright` (또는 `pip install pyright`, `pipx install pyright`)
- 설치: `claude plugin install typescript-lsp@claude-plugins-official`, `claude plugin install pyright-lsp@claude-plugins-official`

**11) skill-creator — 스킬 제작·개선·측정**
- 새 스킬 작성, 기존 스킬 개선, 평가(evals) 실행, 분산 분석 벤치마크, 트리거 정확도를 높이는 설명문 최적화.
- 설치: `claude plugin install skill-creator@claude-plugins-official`

**12) session-report — 사용량 HTML 리포트**
- `~/.claude/projects` 의 대화 기록을 분석해 토큰·캐시 효율·서브에이전트·스킬·비용이 큰 프롬프트를 담은 HTML 파일을 현재 폴더에 만든다. 기본은 최근 7일이고 `24h`, `30d`, `all` 로 범위를 바꾼다. Node.js 필요. ponytail 의 절감 효과를 확인하는 데 쓸 수 있다.
- 설치: `claude plugin install session-report@claude-plugins-official`

### 겹치거나 충돌할 수 있는 조합
- `superpowers`(설계·TDD 강제) ↔ `ponytail`(최소 코드): 함께 쓸 때 동작이 겹치는지는 확인하지 못했다. 불편하면 둘 중 하나만 켠다.
- `superpowers` ↔ `feature-dev`: 둘 다 단계형 개발 워크플로다.
- `code-review` ↔ `pr-review-toolkit`: 둘 다 PR 리뷰다.
- `security-audit`(스킬, 전체 감사) ↔ `security-guidance`(플러그인, 평소 점검): 용도가 달라 같이 써도 된다.
- `rea` 는 플러그인 방식과 `rea setup` 방식을 동시에 쓰지 않는다.
