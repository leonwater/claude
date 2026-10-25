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
sys.path.insert(0, str(HERE))
import glossary  # noqa: E402
import glossary_extra  # noqa: E402
from choice_notes import NOTES  # noqa: E402
APP = HERE.parent.parent
# 새 문제는 맨 뒤 파일에 추가한다(앞 문제의 번호와 보기 순서가 바뀌지 않도록)
SOURCES = ["q1.py", "q2.py", "q3a.py", "q3b.py", "q3c.py", "q_tf.py"]
OUT_JSON = APP / "src" / "data" / "adsp_bank.json"
OUT_IMG = APP / "public" / "adsp"
SEED = 20261014
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

SUBJECTS = {1: "1과목 데이터 이해", 2: "2과목 데이터분석 기획", 3: "3과목 데이터분석"}
CHAPTERS = {
    "1-1": "데이터의 이해", "1-2": "데이터의 가치와 미래", "1-3": "데이터 사이언스와 전략 인사이트",
    "2-1": "데이터분석 기획의 이해", "2-2": "분석 마스터플랜",
    "3-1": "R기초와 데이터 마트", "3-2": "통계학 개론과 기초 통계", "3-3": "확률분포·추정·가설검정",
    "3-4": "회귀분석", "3-5": "다변량 분석·시계열", "3-6": "정형 데이터 마이닝",
}

# 그림: 이름 → (PDF 쪽, 150dpi 기준 자르기 영역, 가릴 영역들)
# 가릴 영역은 (x0, y0, x1, y1, 표시 글자). 다른 칸이 보이면 소거법으로 답이 나오므로 같은 종류의 칸은 모두 가린다.
# 표시 글자가 ""이면 흰색으로 지우고, ("line", x0, y0, x1, y1)은 지운 자리에 선을 다시 그린다.
FIGURES = {
    "outlier_dist": (13, (310, 505, 930, 945), [(408, 764, 507, 789, "(가)"), (750, 764, 849, 789, "(나)")]),
    "boxplot_ab": (13, (176, 972, 566, 1284), []),
    "kurtosis": (15, (440, 1055, 790, 1240), [(641, 1066, 699, 1088, "(가)"), (667, 1168, 726, 1190, "(나)"), (722, 1204, 779, 1226, "(다)")]),
    "skew_pos": (15, (300, 1285, 500, 1472), []),
    "skew_neg": (15, (738, 1285, 935, 1472), []),
    "summary_out": (16, (145, 95, 580, 310), []),
    "uniform_ev": (17, (420, 1130, 800, 1265), []),
    "error_table": (18, (400, 1340, 838, 1480), [(552, 1405, 691, 1440, "(가)"), (694, 1405, 835, 1440, "(나)"), (552, 1443, 691, 1478, "(다)"), (694, 1443, 835, 1478, "(라)")]),
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
    "confusion": (29, (452, 175, 788, 407), [(581, 242, 679, 316, "(가)"), (683, 242, 781, 316, "(나)"), (581, 320, 679, 394, "(다)"), (683, 320, 781, 394, "(라)")]),
    "dendrogram": (30, (460, 165, 805, 402), []),
    "distance": (30, (260, 1130, 520, 1305), []),
    "elbow": (32, (380, 150, 880, 425), [(528, 243, 630, 312, ""), ("line", 525, 296, 569, 315)]),
    "assoc_table": (33, (160, 155, 475, 435), []),
    "analysis_matrix": (6, (430, 1055, 810, 1235), [(549, 1113, 688, 1171, "(가)"), (691, 1113, 807, 1171, "(나)"), (549, 1174, 688, 1232, "(다)"), (691, 1174, 807, 1232, "(라)")]),
    "priority_quad": (9, (443, 1333, 796, 1456), []),
    "level_quad": (11, (355, 95, 860, 385), [(484, 161, 571, 196, "(가)"), (668, 161, 756, 196, "(나)"), (484, 280, 571, 315, "(다)"), (668, 280, 756, 315, "(라)")]),
    "bigdata_method": (8, (155, 110, 1085, 388), [(245, 113, 412, 159, "(가)"), (425, 113, 592, 159, "(나)"), (603, 113, 775, 159, "(다)"), (785, 113, 927, 159, "(라)"), (939, 113, 1081, 159, "(마)")]),
    "readiness": (10, (294, 474, 945, 808), [(296, 478, 515, 512, "(가)"), (517, 478, 733, 512, "(나)"), (735, 478, 943, 512, "(다)"), (296, 633, 515, 665, "(라)"), (517, 633, 733, 665, "(마)"), (735, 633, 943, 665, "(바)")]),
    "maturity": (10, (336, 912, 903, 1325), [(338, 955, 401, 1050, "(가)"), (338, 1053, 401, 1125, "(나)"), (338, 1128, 401, 1224, "(다)"), (338, 1227, 401, 1322, "(라)")]),
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


MAX_TERMS = 8
MAX_CHOICE_TERMS = 3


def annotate(qs: list[dict], source_text: str) -> tuple[list[dict], int]:
    """문제마다 용어정리(glossary)와 오답 선지 설명(choiceInfo)을 만든다. 오류 수를 함께 돌려준다."""
    src = compact(source_text)
    errors = 0
    entries = glossary.extract(source_text) + glossary_extra.EXTRA
    glossary_extra.apply_aliases(entries)
    for e in entries:
        if compact(e["src"]) not in src:
            print("용어집 설명이 PDF에 없음:", e["term"], "|", e["src"][:60])
            errors += 1

    keys = {(x["c"], c) for x in qs for c in x["o"][1:]}
    used_notes = set()
    out = []
    for x in qs:
        ctx = " ".join([x["q"], x["e"], x["src"], *x["o"]])
        answer = x["o"][0]
        # 용어정리: 정답 선지 → 다른 선지 → 문제 본문 순
        picked, seen = [], set()
        groups = [glossary.terms_in(answer, entries, True, ctx)]
        groups += [glossary.terms_in(c, entries, True, ctx) for c in x["o"][1:]]
        # 문제별로 직접 지정한 용어(보기에 없는 핵심어)
        groups.append([glossary_extra.find(entries, name, ctx) for name in glossary_extra.QT.get(x["c"], [])])
        groups.append(glossary.terms_in(x["q"], entries, False, ctx))
        for g in groups:
            for e in g:
                if e["term"] not in seen and len(picked) < MAX_TERMS:
                    seen.add(e["term"])
                    picked.append({"term": e["term"], "def": e["def"]})
        # 오답 선지 설명
        info = [None]
        for c in x["o"][1:]:
            lines = []
            note = NOTES.get((x["c"], c))
            if note:
                used_notes.add((x["c"], c))
                text, quote = note
                if quote is None:
                    if len(compact(c)) >= 6 and compact(c) in src:
                        print("PDF에 있는 선지를 '없음'으로 표시:", x["c"], "|", c)
                        errors += 1
                else:
                    q = x["src"] if quote == "=" else quote
                    if compact(q) not in src:
                        print("선지 설명 근거가 PDF에 없음:", x["c"], "|", c, "|", q[:50])
                        errors += 1
                lines.append(text)
            else:
                for e in glossary.terms_in(c, entries, True, ctx)[:MAX_CHOICE_TERMS]:
                    lines.append(f"{e['term']} — {e['def']}")
                if not lines and "→" in c and "→" in answer:
                    lines.append(f"PDF에 없는 순서입니다. PDF의 순서는 '{answer}'입니다.")
                elif not lines and len(compact(c)) >= 4 and compact(c) not in src:
                    lines.append("PDF에 없는 선지입니다.")
            if not lines:
                print("오답 선지 설명 없음:", x["c"], "|", c)
                errors += 1
            info.append(lines)
        if not picked:
            print("용어정리 없음:", x["c"])
            errors += 1
        out.append({"glossary": picked, "info": info})
    for k in set(NOTES) - used_notes:
        print("어느 문제에도 없는 선지 설명:", k)
        errors += 1
    return out, errors


def crop_figures(pdf: Path, workdir: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    subprocess.run(["pdftoppm", "-r", "150", "-png", str(pdf), str(workdir / "p")], check=True)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype(FONT, 20)
    except OSError:
        sys.exit(f"한글 글꼴이 없습니다: {FONT} (fonts-wqy-zenhei 설치)")
    for name, (page, box, masks) in FIGURES.items():
        page_png = next(workdir.glob(f"p-*{page:02d}.png"))
        im = Image.open(page_png).convert("RGB")
        d = ImageDraw.Draw(im)
        for m in masks:
            if m[0] == "line":  # 지운 자리에 그래프 선을 다시 그림
                d.line(m[1:], fill="#8c8c8c", width=3)
                continue
            x0, y0, x1, y1, label = m
            if not label:
                d.rectangle((x0, y0, x1, y1), fill="white")
                continue
            d.rectangle((x0, y0, x1, y1), fill="#fff3c4", outline="#c99a00", width=2)
            d.text(((x0 + x1) / 2, (y0 + y1) / 2), label, fill="#8a6500", font=font, anchor="mm")
        im.crop(box).save(OUT_IMG / f"{name}.png", optimize=True)
    print(f"그림 {len(FIGURES)}개 → {OUT_IMG}")


def export(qs: list[dict], ann: list[dict]) -> None:
    rng = random.Random(SEED)
    out = []
    for i, (x, a) in enumerate(zip(qs, ann), 1):
        order = list(range(4))
        rng.shuffle(order)
        out.append({
            "id": f"adsp-{i:03d}", "subject": x["s"], "chapter": x["ch"], "concept": x["c"], "stem": x["q"],
            "choices": [x["o"][k] for k in order], "answerIndex": order.index(0), "explanation": x["e"],
            "sourceQuote": x["src"], "image": f"{x['img']}.png" if x["img"] else None,
            "glossary": a["glossary"],
            # 보기마다 '그 보기를 골랐을 때 보여 줄 설명'(정답 보기는 null)
            "choiceInfo": [a["info"][k] for k in order],
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
        text = (work / "plain.txt").read_text()
        errors = validate(qs, text)
        ann, ann_errors = annotate(qs, text)
        if errors or ann_errors:
            sys.exit(f"검증 오류가 있어 중단합니다 (문제 {errors}, 용어·선지 설명 {ann_errors}).")
        print("용어정리·선지 설명 검증 통과")
        if "--check" in sys.argv:
            return
        crop_figures(pdf, work)
        export(qs, ann)
    print("앱 문제은행을 바꿨다면 src/lib/builtin.ts의 ADSP_BANK_VERSION을 1 올리세요.")


if __name__ == "__main__":
    main()
