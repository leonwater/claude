"""프리즈프레임 선수 식별.

StatsBomb 360 프리즈프레임에는 **선수 신원이 들어 있지 않다** — 좌표와
teammate/keeper/actor 플래그뿐이다. 그래서 같은 시점 이벤트의 선수별 위치와
프리즈프레임 좌표를 공간 매칭해 이름을 복원한다.

한 선수가 두 점에 배정되는 것을 막기 위해 독립 최근접이 아니라 **1:1 상호배타
배정**으로 푼다. 독립 최근접을 쓰면 실제로 한 선수가 서로 다른 두 좌표에 동시에
배정되는 물리적으로 불가능한 결과가 나온다.

복원된 이름은 **추정치**이며 원본 데이터가 아니다. 매칭 오차가 임계값을 넘으면
미식별로 남긴다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .config import DEFAULT, Config
from .statsbomb import mirror


@dataclass
class IdentifiedPlayer:
    """프리즈프레임의 점 하나."""

    x: float
    y: float
    is_actor_team: bool
    """행위자(볼 소유) 팀 소속인지. 프리즈프레임 ``teammate`` 플래그 그대로."""
    keeper: bool
    actor: bool
    distance_to_ball: float
    name: str | None = None
    match_error: float | None = None
    """매칭 오차(SB유닛). ``None`` 이면 미식별."""
    source_event: str | None = None


def _player_positions(
    events: list[dict], trigger: dict, config: Config
) -> dict[str, tuple[float, float, str, float, str]]:
    """선수별 위치 추정 1개씩 — 트리거 시점과 가장 가까운 이벤트를 쓴다.

    좌표는 트리거 행위자 팀의 프레임으로 미러 정규화한다.
    """
    actor_team = trigger["team"]["name"]
    t0 = trigger["_t"]
    positions: dict[str, tuple[float, float, str, float, str]] = {}

    for e in events:
        if e["period"] != trigger["period"] or "location" not in e or not e.get("player"):
            continue
        dt = abs(e["_t"] - t0)
        if dt > config.id_window:
            continue
        name = e["player"]["name"]
        if name in positions and positions[name][3] <= dt:
            continue
        x, y = e["location"][:2]
        if e["team"]["name"] != actor_team:
            x, y = mirror(x, y)
        positions[name] = (x, y, e["team"]["name"], dt, e["type"]["name"])
    return positions


def identify_players(
    events: list[dict], frame: dict, trigger: dict, config: Config = DEFAULT
) -> list[IdentifiedPlayer]:
    """프리즈프레임의 각 점에 선수 이름을 1:1로 배정한다 (볼에서 가까운 순 정렬)."""
    actor_team = trigger["team"]["name"]
    ball = tuple(trigger["location"][:2])
    positions = _player_positions(events, trigger, config)
    spots = frame["freeze_frame"]

    # (점수, 오차, 점 index, 선수) 후보를 모아 점수 오름차순으로 상호배타 배정
    pairs: list[tuple[float, float, int, str, str]] = []
    for i, spot in enumerate(spots):
        sx, sy = spot["location"]
        for name, (px, py, team, dt, kind) in positions.items():
            same_side = (team == actor_team) if spot["teammate"] else (team != actor_team)
            if not same_side:
                continue
            error = math.hypot(px - sx, py - sy)
            if error <= config.id_threshold:
                pairs.append((error + dt * config.id_time_penalty, error, i, name, kind))
    pairs.sort()

    taken_spots: set[int] = set()
    taken_names: set[str] = set()
    assigned: dict[int, tuple[float, str, str]] = {}
    for _, error, i, name, kind in pairs:
        if i in taken_spots or name in taken_names:
            continue
        taken_spots.add(i)
        taken_names.add(name)
        assigned[i] = (error, name, kind)

    out: list[IdentifiedPlayer] = []
    for i, spot in enumerate(spots):
        sx, sy = spot["location"]
        hit = assigned.get(i)
        if spot["actor"]:
            # 볼 소유자는 트리거 이벤트에서 직접 알 수 있다 — 추정이 아니다.
            hit = (0.0, trigger["player"]["name"], trigger["type"]["name"])
        out.append(
            IdentifiedPlayer(
                x=round(sx, 1),
                y=round(sy, 1),
                is_actor_team=spot["teammate"],
                keeper=spot["keeper"],
                actor=spot["actor"],
                distance_to_ball=round(math.dist((sx, sy), ball), 1),
                name=hit[1] if hit else None,
                match_error=round(hit[0], 1) if hit else None,
                source_event=hit[2] if hit else None,
            )
        )
    out.sort(key=lambda p: p.distance_to_ball)
    return out
