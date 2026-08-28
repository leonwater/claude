"""압박 온셋 탐지와 트리거 분류.

분석 단위를 "우리 수비 행위"가 아니라 **"상대의 취약 순간"** 으로 잡는다.
코치가 압박을 지시할 때 쓰는 단위(백패스, 터치라인 유도, 뜬 공…)와 맞추기 위해서다.
"""
from __future__ import annotations

from .config import DEFAULT, Config
from .statsbomb import ONBALL_TYPES

GK_POSSESSION = "GK소유"
THROW_IN = "스로인재개"
BACK_PASS = "백패스수신"
AERIAL = "공중볼경합"
TOUCHLINE = "터치라인압착"
OWN_HALF_SQUARE = "자기진영횡전개"
OTHER = "기타전개"

TRIGGERS = [
    TOUCHLINE,
    OWN_HALF_SQUARE,
    OTHER,
    GK_POSSESSION,
    THROW_IN,
    AERIAL,
    BACK_PASS,
]
"""표시 순서(스페인 기준 빈도 내림차순)."""

_WIDE_BAND = 16.0
"""터치라인 압착으로 볼 y 여백(SB유닛)."""

_BACK_PASS_DX = -3.0
_SQUARE_DX = 8.0
_OWN_HALF_X = 60.0


def classify_trigger(event: dict, config: Config = DEFAULT) -> str:
    """상대 온볼 이벤트를 압박 트리거 유형으로 분류한다 (우선순위 캐스케이드).

    재개(스로인/골킥) 라벨은 포제션 선두 이벤트에만 적용한다. ``play_pattern`` 이
    포제션 전체에 지속되기 때문으로, 이 게이팅이 없으면 재개 상황이 크게 과대계상된다.
    """
    kind = event["type"]["name"]
    pattern = event["play_pattern"]["name"]
    position = (event.get("position") or {}).get("name", "")
    offset = event["_off"]
    x, y = event["location"][:2]

    if "Goalkeeper" in position or kind == "Goal Keeper":
        return GK_POSSESSION
    if pattern == "From Throw In" and offset <= config.restart_offset:
        return THROW_IN
    if pattern in ("From Goal Kick", "From Keeper") and offset <= config.restart_offset + 1:
        return GK_POSSESSION
    # 컨트롤 실패는 압박의 '원인'이 아니라 '결과'인 경우가 대부분이라 기타로 둔다.
    if kind == "Miscontrol" or (kind == "Ball Receipt*" and event.get("under_pressure")):
        return OTHER

    if kind == "Pass":
        p = event["pass"]
        end_x, end_y = p["end_location"][:2]
        if p.get("height", {}).get("name") == "High Pass" or p.get("aerial_won"):
            return AERIAL
        if end_x - x <= _BACK_PASS_DX:
            return BACK_PASS
        if min(end_y, 80.0 - end_y) <= _WIDE_BAND:
            return TOUCHLINE
        if abs(end_x - x) < _SQUARE_DX and end_x <= _OWN_HALF_X:
            return OWN_HALF_SQUARE
        return OTHER

    if kind in ("Carry", "Ball Receipt*", "Dribble"):
        if min(y, 80.0 - y) <= _WIDE_BAND:
            return TOUCHLINE
        if x <= _OWN_HALF_X:
            return OWN_HALF_SQUARE
    return OTHER


def find_onsets(events: list[dict], team: str, config: Config = DEFAULT) -> list[dict]:
    """연속 Pressure 군집을 국면 단위로 압축해 각 국면의 첫 건만 반환한다.

    StatsBomb의 ``Pressure`` 는 한 번의 압박 국면에서 여러 건이 연달아 찍히므로
    그대로 세면 압박 횟수가 부풀려진다.
    """
    onsets: list[dict] = []
    last_t, last_period = -1e9, None
    for e in events:
        if e["type"]["name"] != "Pressure" or e["team"]["name"] != team:
            continue
        contiguous = e["period"] == last_period and e["_t"] - last_t < config.cluster_gap
        if not contiguous:
            onsets.append(e)
        last_t, last_period = e["_t"], e["period"]
    return onsets


def opponent_onball(events: list[dict], team: str) -> dict[int, list[dict]]:
    """상대의 온볼 이벤트를 하프별로 모아 둔다 (트리거 후보)."""
    by_period: dict[int, list[dict]] = {}
    for e in events:
        if (
            e["team"]["name"] != team
            and e["type"]["name"] in ONBALL_TYPES
            and "location" in e
        ):
            by_period.setdefault(e["period"], []).append(e)
    return by_period


def match_trigger(
    onset: dict, candidates: dict[int, list[dict]], config: Config = DEFAULT
) -> dict | None:
    """압박 온셋 직전 상대의 마지막 온볼 이벤트를 트리거로 역추적한다."""
    window = [
        e
        for e in candidates.get(onset["period"], ())
        if 0 <= onset["_t"] - e["_t"] <= config.lookback
    ]
    return max(window, key=lambda e: e["_t"]) if window else None
