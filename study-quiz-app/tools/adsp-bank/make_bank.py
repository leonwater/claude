"""ADsP 문제은행 만들기: 검증 → 그림 자르기 → 앱용 JSON 출력.

사용법 (저장소의 study-quiz-app 폴더에서):
    python3 tools/adsp-bank/make_bank.py <ADsP 핵심정리 PDF 경로>
    python3 tools/adsp-bank/make_bank.py <PDF> --check   # 검증만

필요한 것: poppler-utils(pdftotext, pdftoppm), Pillow
문제 원본은 같은 폴더의 q1.py(1과목), q2.py(2과목), q3a/q3b/q3c.py(3과목)이며,
각 문제의 보기 첫 번째가 정답이다(출력할 때 고정 시드로 섞는다).
"""
import importlib.util
import json
import random
import re
import subprocess
import sys
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
SOURCES = ["q1.py", "q2.py", "q3a.py", "q3b.py", "q3c.py"]
OUT_JSON = APP / "src" / "data" / "adsp_bank.json"
OUT_IMG = APP / "public" / "adsp"
SEED = 20261014

SUBJECTS = {1: "1과목 데이터 이해", 2: "2과목 데이터분석 기획", 3: "3과목 데이터분석"}
CHAPTERS = {
    "1-1": "데이터의 이해", "1-2": "데이터의 가치와 미래", "1-3": "데이터 사이언스와 전략 인사이트",
    "2-1": "데이터분석 기획의 이해", "2-2": "분석 마스터플랜",
    "3-1": "R기초와 데이터 마트", "3-2": "통계학 개론과 기초 통계", "3-3": "확률분포·추정·가설검정",
    "3-4": "회귀분석", "3-5": "다변량 분석·시계열", "3-6": "정형 데이터 마이닝",
}

# 그림: 이름 → (PDF 쪽, 150dpi 기준 자르기 영역, 정답이 보이지 않게 가릴 영역들)
FIGURES = {
    "outlier_dist": (13, (310, 505, 930, 945), []),
    "boxplot_ab": (13, (176, 972, 566, 1284), []),
    "kurtosis": (15, (440, 1055, 790, 1240), []),
    "skew_pos": (15, (300, 1285, 500, 1472), []),
    "skew_neg": (15, (738, 1285, 935, 1472), []),
    "summary_out": (16, (145, 95, 580, 310), []),
    "uniform_ev": (17, (420, 1130, 800, 1265), []),
    "error_table": (18, (400, 1340, 838, 1480), [(694, 1405, 835, 1440)]),
    "ttest_out": (19, (148, 548, 1092, 842), []),
    "sst_reg": (20, (450, 680, 790, 945), []),
    "lm_out": (22, (148, 105, 1092, 478), []),
    "scatter4": (22, (300, 1095, 965, 1272), []),
    "pca_out": (23, (148, 205, 1100, 350), []),
    "scree": (23, (380, 655, 890, 935), []),
    "overfit_panel": (25, (378, 382, 526, 506), []),
    "underfit_panel": (25, (713, 382, 862, 506), []),
    "coins": (27, (340, 165, 900, 275), []),
    "perceptron": (28, (440, 1365, 800, 1555), []),
    "confusion": (29, (452, 175, 788, 407), []),
    "dendrogram": (30, (460, 165, 805, 402), []),
    "distance": (30, (260, 1130, 520, 1305), []),
    "elbow": (32, (380, 150, 880, 425), [(530, 245, 628, 308)]),
    "assoc_table": (33, (160, 155, 475, 435), []),
    "analysis_matrix": (6, (430, 1055, 810, 1235), [(691, 1113, 807, 1171)]),
    "priority_quad": (9, (443, 1333, 796, 1456), []),
    "level_quad": (11, (355, 95, 860, 385), [(668, 280, 756, 315)]),
    "bigdata_method": (8, (155, 110, 1085, 388), [(603, 113, 775, 159)]),
    "readiness": (10, (294, 474, 945, 808), [(296, 633, 515, 665)]),
    "maturity": (10, (336, 912, 903, 1325), [(338, 1128, 401, 1224)]),
}


def compact(s: str) -> str:
    """앱의 검증(src/lib/verify.ts)과 같은 규칙: NFKC, 따옴표 통일, 공백 제거"""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[“”„]", '"', s)
    s = re.sub(r"[‘’‚]", "'", s)
    return re.sub(r"\s+", "", s)


def bigram_similarity(a: str, b: str) -> float:
    A = {compact(a)[i:i + 2] for i in range(len(compact(a)) - 1)}
    B = {compact(b)[i:i + 2] for i in range(len(compact(b)) - 1)}
    return len(A & B) / max(1, len(A | B))


def load_questions() -> list[dict]:
    qs = []
    for name in SOURCES:
        spec = importlib.util.spec_from_file_location(name[:-3], HERE / name)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        qs += mod.Q
    return qs


def validate(qs: list[dict], source_text: str) -> int:
    src = compact(source_text)
    errors = 0
    seen = set()
    for x in qs:
        tag = f"[{x['s']}과목 / {x['c']}]"
        quote = compact(x["src"])
        if len(quote) < 8 or quote not in src:
            print("근거 문장이 원문에 없음", tag, x["src"])
            errors += 1
        if len(x["o"]) != 4 or len({compact(o) for o in x["o"]}) != 4:
            print("보기 오류", tag)
            errors += 1
        if x["img"] and x["img"] not in FIGURES:
            print("없는 그림", tag, x["img"])
            errors += 1
        key = compact(x["c"])
        if key in seen:
            print("개념 중복", tag)
            errors += 1
        seen.add(key)
    for i, a in enumerate(qs):
        for b in qs[i + 1:]:
            s = bigram_similarity(a["q"] + a["o"][0], b["q"] + b["o"][0])
            if s >= 0.6:
                print(f"(참고) 비슷한 문제 {s:.2f}: {a['c']} | {b['c']}")
    print(f"문항 {len(qs)}개, 오류 {errors}개, 과목별 {dict(Counter(x['s'] for x in qs))}")
    return errors


def crop_figures(pdf: Path, workdir: Path) -> None:
    from PIL import Image, ImageDraw

    subprocess.run(["pdftoppm", "-r", "150", "-png", str(pdf), str(workdir / "p")], check=True)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    for name, (page, box, masks) in FIGURES.items():
        page_png = next(workdir.glob(f"p-*{page:02d}.png"))
        im = Image.open(page_png).convert("RGB")
        d = ImageDraw.Draw(im)
        for m in masks:
            d.rectangle(m, fill="#fff3c4", outline="#c99a00", width=2)
            d.text(((m[0] + m[2]) // 2 - 6, (m[1] + m[3]) // 2 - 7), "?", fill="#8a6500")
        im.crop(box).save(OUT_IMG / f"{name}.png", optimize=True)
    print(f"그림 {len(FIGURES)}개 → {OUT_IMG}")


def export(qs: list[dict]) -> None:
    rng = random.Random(SEED)
    out = []
    for i, x in enumerate(qs, 1):
        order = list(range(4))
        rng.shuffle(order)
        out.append({
            "id": f"adsp-{i:03d}", "subject": x["s"], "chapter": x["ch"], "concept": x["c"], "stem": x["q"],
            "choices": [x["o"][k] for k in order], "answerIndex": order.index(0), "explanation": x["e"],
            "sourceQuote": x["src"], "image": f"{x['img']}.png" if x["img"] else None,
        })
    bank = {"title": "ADsP 1·2·3과목 핵심 정리", "source": "ADsP_1-3 핵심정리 PDF (33쪽)",
            "subjects": SUBJECTS, "chapters": CHAPTERS, "questions": out}
    OUT_JSON.write_text(json.dumps(bank, ensure_ascii=False, indent=1))
    print(f"문제은행 {len(out)}문항 → {OUT_JSON}")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf = Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        subprocess.run(["pdftotext", str(pdf), str(work / "plain.txt")], check=True)
        qs = load_questions()
        if validate(qs, (work / "plain.txt").read_text()):
            sys.exit("검증 오류가 있어 중단합니다.")
        if "--check" in sys.argv:
            return
        crop_figures(pdf, work)
        export(qs)
    print("앱 문제은행을 바꿨다면 src/lib/builtin.ts의 ADSP_BANK_VERSION을 1 올리세요.")


if __name__ == "__main__":
    main()
