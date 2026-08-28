"""StatsBomb 오픈데이터 접근과 좌표 규약.

좌표계 주의
-----------
StatsBomb은 **행위 팀이 항상 좌→우로 공격하는 팀별 미러 좌표계**를 쓴다.
같은 물리적 지점이 A팀 이벤트에서 x=30, B팀 이벤트에서 x=90으로 기록된다.
팀 간 좌표를 비교하려면 반드시 :func:`mirror` 를 거쳐야 한다.

이 규약은 Pressure 이벤트와 그 related_events의 좌표를 대조해 실증했다
(미러 변환 시 오차 0.1~4.7 유닛 vs 미변환 8.3~78.3 유닛).
좌우 채널은 y≈0이 좌측, y≈80이 우측이며 선수별 평균 y와 코너킥 좌표로 교차검증했다.
"""
from __future__ import annotations

import json
import urllib.request
from collections import Counter
from pathlib import Path

BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"

PITCH_X = 120.0
PITCH_Y = 80.0
UNIT_METRES = 0.8625
"""SB유닛 → 미터 환산 계수 (105m/120, 68m/80 의 평균)."""

EURO_2024 = (55, 282)
"""(competition_id, season_id)"""

ONBALL_TYPES = frozenset(
    {"Pass", "Carry", "Ball Receipt*", "Miscontrol", "Goal Keeper", "Dribble"}
)
DEFENSIVE_ACTION_TYPES = frozenset({"Pressure", "Duel", "Interception"})


def data_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "data"


def _fetch(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=180) as resp:
        dest.write_bytes(resp.read())
    return dest


def load_matches(competition_id: int = EURO_2024[0], season_id: int = EURO_2024[1]) -> list[dict]:
    path = _fetch(
        f"{BASE_URL}/matches/{competition_id}/{season_id}.json",
        data_dir() / f"matches_{competition_id}_{season_id}.json",
    )
    return json.loads(path.read_text())


def load_events(match_id: int) -> list[dict]:
    """경기 이벤트를 시간 순으로 로드하고 파생 필드를 붙인다.

    부가 필드
        ``_t``   : 하프 내 경과 초 (timestamp 파싱)
        ``_off`` : 소속 포제션 내 이벤트 순번 (재개 라벨 게이팅용)
    """
    path = _fetch(f"{BASE_URL}/events/{match_id}.json", data_dir() / f"ev_{match_id}.json")
    events = json.loads(path.read_text())
    events.sort(key=lambda e: (e["period"], e["index"]))

    seen: Counter = Counter()
    for e in events:
        e["_t"] = event_seconds(e)
        e["_off"] = seen[e["possession"]]
        seen[e["possession"]] += 1
    return events


def load_frames(match_id: int) -> dict[str, dict]:
    """360 프리즈프레임을 ``event_uuid`` 로 색인해 반환한다.

    프레임에는 좌표와 teammate/keeper/actor 플래그만 있고 **선수 신원은 없다**.
    이름 복원은 :mod:`press.identify` 참조.
    """
    path = _fetch(
        f"{BASE_URL}/three-sixty/{match_id}.json", data_dir() / f"f360_{match_id}.json"
    )
    return {f["event_uuid"]: f for f in json.loads(path.read_text())}


def event_seconds(event: dict) -> float:
    """``timestamp`` ("HH:MM:SS.mmm")를 하프 내 경과 초로 변환한다."""
    hours, minutes, seconds = event["timestamp"].split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def mirror(x: float, y: float) -> tuple[float, float]:
    """팀별 미러 좌표계를 상대 팀 기준으로 뒤집는다."""
    return PITCH_X - x, PITCH_Y - y


def to_metres(units: float) -> float:
    return units * UNIT_METRES


def visible_area_polygon(frame: dict) -> list[tuple[float, float]]:
    """평탄한 ``visible_area`` 리스트를 (x, y) 꼭짓점 목록으로 바꾼다."""
    flat = frame["visible_area"]
    return [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
