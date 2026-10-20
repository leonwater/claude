"""PDF 원문에서 '용어 : 설명' 줄을 뽑아 용어집을 만든다.

설명은 PDF 문장을 그대로 쓰므로 원문과 어긋날 수 없다(make_bank.py가 다시 한 번 원문 대조로 확인한다).
PDF에 '용어 : 설명' 형태로 적히지 않은 용어는 EXTRA에 근거 문장과 함께 직접 적는다.
"""
import re
import unicodedata
from functools import lru_cache

# '1. 용어 : 설명', '- 용어 : 설명', '※ 용어 : 설명' 형태
LINE = re.compile(r"^(?:\d+\.\s*)?(?:[-•*※☞]\s*)*([^:：]{1,45}?)\s[:：]\s(.{4,})$")
NEW_ITEM = re.compile(r"^(?:\d+\.\s|[-•*※☞]|\d+\)|[(（]\d+[)）])")


def compact(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[“”„]", '"', s)
    s = re.sub(r"[‘’‚]", "'", s)
    return re.sub(r"\s+", "", s)


def clean_lines(plain_text: str) -> list[str]:
    out = []
    for raw in plain_text.splitlines():
        s = re.sub(r"[ \t]+", " ", raw).strip()
        if s:
            out.append(s)
    return out


def aliases_of(term: str) -> list[str]:
    """'정의언어(DDL)' → [정의언어(DDL), 정의언어, DDL] / 'CART 알고리즘' → [CART 알고리즘, CART] / '집락 추출법(=군집 추출법)' → [..., 군집 추출법]"""
    base = term.split(" - ")[0].strip()
    names = [term, base]
    for inner in re.findall(r"[(（]([^()（）]+)[)）]", base):
        inner = inner.strip().lstrip("=").strip()
        # 'Extraction, Transform, Load' 처럼 풀어 쓴 영어 이름은 제외하고 약어와 동의어만 별칭으로 둔다
        if inner and not ("," in inner and re.fullmatch(r"[A-Za-z ,]+", inner)):
            names.append(inner)
    no_paren = re.sub(r"\s*[(（][^()（）]*[)）]", "", base).strip()
    names.append(no_paren)
    for suffix in (" 알고리즘", " 함수"):
        if no_paren.endswith(suffix):
            names.append(no_paren[: -len(suffix)].strip())
    seen, out = set(), []
    for n in names:
        k = compact(n).lower()
        if k and k not in seen:
            seen.add(k)
            out.append(n)
    return out


# 예시 줄이나 소제목이 용어처럼 뽑힌 것들(정의가 아님)
BLOCK = {
    "(μ", "(P(A|B)", "개념", "해결방안", "특징", "종류", "절차", "25% 지점", "d = 0", "center=T", "p-value", "귀무가설",
    "모델 회귀 식", "각각의 회귀계수에 대한 귀무가설", "귀무가설 / 대립가설 설정", "양측 혹은 단측검정 확인", "일표본 혹은 이표본 확인",
    "모집단의 분산을 알고 있는 경우", "출력 값 계산 예", "(가) 퍼셉트론의 출력", "공분산 = 0", "상관계수 = 1", "첨도 = 3",
    "조직 및 인력방안 수립 (DSCoE", "다차원 척도법 (MDS", "A 품목과 B 품목의 상관성 (향상도 > 1",
    "log_e(P / (1 − P)) = wx + β (w > 0", "자유도가 n-1인 t분포를 이용하여 신뢰구간을 추정", "모형이 통계적으로 유의미한가",
    "회귀계수들이 유의미한가", "모형이 설명력을 갖는가",
}
# 다른 뜻으로도 쓰이는 말: 보기 전체가 그 말일 때만 인정한다
EXACT_ONLY = {"플랫폼"}


def extract(plain_text: str) -> list[dict]:
    lines = clean_lines(plain_text)
    entries = []
    for i, line in enumerate(lines):
        m = LINE.match(line)
        if not m:
            continue
        term, definition = m.group(1).strip(), m.group(2).strip()
        if term.startswith(("예", "참고")) or len(compact(term)) < 2 or term in BLOCK:
            continue
        # PDF 줄바꿈으로 잘린 설명은 다음 줄을 이어 붙인다
        j = i + 1
        while j < len(lines) and len(lines[j]) <= 36 and not NEW_ITEM.match(lines[j]) and not LINE.match(lines[j]) \
                and not re.search(r"[.?!다요음임]$", definition) and len(definition) > 60:
            definition += " " + lines[j]
            j += 1
        names = aliases_of(term)
        entries.append({"term": term, "aliases": [] if term in EXACT_ONLY else names,
                        "exact_aliases": names if term in EXACT_ONLY else [],
                        "def": definition, "src": f"{term} : {definition}"})
    return entries


GENERIC = {"데이터", "정보", "분석", "기법", "모델", "방법", "과정", "단계", "구조", "시스템", "변수", "특징", "유형", "결과"}


def _is_ascii(s: str) -> bool:
    return all(ord(c) < 128 for c in s)


@lru_cache(maxsize=None)
def _key(alias: str) -> str:
    return compact(alias)


@lru_cache(maxsize=None)
def _pattern(alias: str):
    if _is_ascii(alias):
        return re.compile(r"(?<![A-Za-z0-9])" + re.escape(alias) + r"(?![A-Za-z0-9])", re.I)
    return re.compile(re.escape(alias))


def _spans(text: str, alias: str, whole_choice: bool, exact_only: bool = False, text_key: str = "") -> list[tuple[int, int]]:
    """text 안에서 별칭이 나온 위치. 짧은 한글 용어(2자 이하)와 너무 흔한 말은 보기 전체가 그 용어일 때만 인정"""
    key = _key(alias)
    if len(key) < 2:
        return []
    exact = whole_choice and text_key == key
    if exact_only:
        return [(0, len(text))] if exact else []
    if _is_ascii(alias):
        if len(key) <= 2 and not exact:   # DM, DW, BI 같은 두 글자 약어는 CRISP-DM 처럼 다른 말 속에서 잘못 잡히므로 보기 전체일 때만
            return []
        if alias.lower() not in text.lower():
            return []
    else:
        if alias not in text:
            return []
        if (len(key) <= 2 or key in GENERIC) and not exact:
            return []
    return [(m.start(), m.end()) for m in _pattern(alias).finditer(text)]


def _bigrams(s: str) -> set[str]:
    c = compact(s).lower()
    return {c[i:i + 2] for i in range(len(c) - 1)}


def _closeness(entry: dict, ctx: str) -> float:
    a, b = _bigrams(entry["term"] + " " + entry["def"]), _bigrams(ctx)
    return len(a & b) / max(1, len(a | b))


_INDEX_CACHE: dict[int, tuple[list, dict]] = {}


def _index(entries: list[dict]) -> dict[tuple[str, bool], list[dict]]:
    cached = _INDEX_CACHE.get(id(entries))
    if cached and cached[0] is entries and cached[2] == len(entries):
        return cached[1]
    by_alias: dict[tuple[str, bool], list[dict]] = {}
    for e in entries:
        for alias in e["aliases"]:
            by_alias.setdefault((alias, False), []).append(e)
        for alias in e.get("exact_aliases", []):
            by_alias.setdefault((alias, True), []).append(e)
    _INDEX_CACHE[id(entries)] = (entries, by_alias, len(entries))
    return by_alias


def terms_in(text: str, entries: list[dict], whole_choice: bool = False, ctx: str = "") -> list[dict]:
    """text에 나온 용어 항목들을 긴 용어 우선, 겹치지 않게 골라 등장 순서대로 돌려준다.
    같은 별칭을 가진 항목이 여러 개면 ctx(문제 문맥)와 가장 가까운 것을 쓴다."""
    by_alias = _index(entries)
    cands = []
    text_key = compact(text)
    for (alias, exact_only), es in by_alias.items():
        for s, t in _spans(text, alias, whole_choice, exact_only, text_key):
            best = max(es, key=lambda e: _closeness(e, ctx)) if len(es) > 1 else es[0]
            cands.append((t - s, s, t, best))
    cands.sort(key=lambda c: (-c[0], c[1]))
    taken, out = [], []
    for length, s, t, e in cands:
        if any(not (t <= a or s >= b) for a, b in taken):
            continue
        taken.append((s, t))
        out.append((s, e))
    out.sort(key=lambda x: x[0])
    seen, uniq = set(), []
    for _, e in out:
        if id(e) not in seen:
            seen.add(id(e))
            uniq.append(e)
    return uniq


def entry(term: str, definition: str, src: str | None = None, aliases: list[str] | None = None,
          exact: list[str] | None = None) -> dict:
    """직접 적은 용어. definition(또는 src)은 PDF에서 확인되어야 한다(make_bank.py가 검사).
    aliases: 문장 속에서도 찾을 별칭, exact: 보기 전체가 그 말일 때만 인정할 별칭(너무 흔한 말)"""
    names = [term] + [a for a in (aliases or aliases_of(term)) if a != term]
    return {"term": term, "aliases": names, "exact_aliases": exact or [],
            "def": definition, "src": src or definition, "extra": True}
