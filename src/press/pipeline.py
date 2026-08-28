"""Press Chain 파이프라인.

압박을 점(點) 사건이 아니라 4단계 연쇄로 본다.

    ① 트리거 → ② 수렴 → ③ 회수 → ④ 전진

각 단계에서 얼마가 새는지를 측정하면 "압박이 강했다"가 아니라
"어느 연결고리가 끊겼다"로 말할 수 있다.
"""
from __future__ import annotations

import bisect
import statistics as st
from collections import defaultdict
from dataclasses import asdict, dataclass, field

from .config import DEFAULT, Config
from .convergence import CoverageEstimator, convergence_at
from .statsbomb import DEFENSIVE_ACTION_TYPES
from .triggers import classify_trigger, find_onsets, match_trigger, opponent_onball

_PPDA_ACTION_TYPES = frozenset({"Pressure", "Duel", "Interception", "Foul Committed"})
_PPDA_OPP_ZONE_X = 72.0
"""상대 프레임에서 자기 진영 60% 경계."""
_PPDA_DEF_ZONE_X = 48.0
"""압박 팀 프레임에서 같은 물리적 경계 (120 - 72)."""


@dataclass
class PressChain:
    """압박 온셋 한 건의 전체 연쇄."""

    match_id: int
    team: str
    minute: int
    trigger: str
    press_x: float
    press_y: float
    trigger_x: float
    trigger_y: float
    regain: bool
    regain_t: float | None = None
    regain_x: float | None = None
    xg: float = 0.0
    shots: int = 0
    conv_raw: int | None = None
    conv_adj: float | None = None
    coverage: float | None = None


@dataclass
class TeamProfile:
    """한 팀의 대회 단위 압박 요약."""

    team: str
    matches: int = 0
    minutes: int = 0
    onsets: list[PressChain] = field(default_factory=list)
    opponent_passes: int = 0
    defensive_actions: int = 0
    heights: list[float] = field(default_factory=list)

    def summary(self) -> dict:
        n = len(self.onsets)
        if n == 0:
            return {"team": self.team, "onsets": 0}
        regains = [r for r in self.onsets if r.regain]
        convs = [r.conv_adj for r in self.onsets if r.conv_adj is not None]
        final_third = sum(
            1 for r in regains if r.regain_x is not None and r.regain_x >= DEFAULT.final_third
        )
        mix: dict[str, int] = defaultdict(int)
        for r in self.onsets:
            mix[r.trigger] += 1
        return {
            "team": self.team,
            "matches": self.matches,
            "onsets": n,
            "per90": round(n / self.minutes * 90, 1) if self.minutes else None,
            "rate": round(len(regains) / n * 100, 1),
            "ft": round(final_third / n * 100, 1),
            "conv": round(st.mean(convs), 2) if convs else None,
            "ppda": round(self.opponent_passes / max(self.defensive_actions, 1), 2),
            "height": round(st.mean(self.heights), 1) if self.heights else None,
            "mix": {k: round(v / n * 100, 1) for k, v in mix.items()},
        }


def _period_index(events: list[dict]) -> dict[int, tuple[list[float], list[dict]]]:
    by_period: dict[int, list[dict]] = defaultdict(list)
    for e in events:
        by_period[e["period"]].append(e)
    return {p: ([e["_t"] for e in evs], evs) for p, evs in by_period.items()}


def _slice(index, period: int, start: float, end: float) -> list[dict]:
    times, evs = index[period]
    return evs[bisect.bisect_right(times, start) : bisect.bisect_right(times, end)]


def analyse_team(
    events: list[dict],
    frames: dict[str, dict],
    team: str,
    match_id: int,
    *,
    estimator: CoverageEstimator,
    config: Config = DEFAULT,
    curve: dict[tuple[str, int], list[float]] | None = None,
) -> list[PressChain]:
    """한 경기에서 ``team`` 이 건 압박을 온셋 단위로 분해한다.

    ``curve`` 를 넘기면 트리거 이후 경과 초별 수렴 지수를 그 dict에 누적한다
    (이벤트 샘플링 방식 — 360 프레임은 이벤트가 있는 순간에만 존재한다).
    """
    index = _period_index(events)
    candidates = opponent_onball(events, team)
    records: list[PressChain] = []

    for onset in find_onsets(events, team, config):
        trigger = match_trigger(onset, candidates, config)
        if trigger is None:
            continue
        kind = classify_trigger(trigger, config)
        ball = tuple(trigger["location"][:2])

        # ③ 회수 — 온셋 이후 소유권이 우리에게 넘어온 첫 이벤트
        regain, regain_t, regain_x = False, None, None
        for e in _slice(index, onset["period"], onset["_t"], onset["_t"] + config.regain_window):
            if (
                e["possession_team"]["name"] == team
                and e["team"]["name"] == team
                and "location" in e
            ):
                regain, regain_t, regain_x = True, e["_t"] - onset["_t"], e["location"][0]
                break

        # ④ 전진 — 회수 후 슈팅으로 이어졌는가
        xg, shots = 0.0, 0
        if regain:
            base = onset["_t"] + regain_t
            for e in _slice(index, onset["period"], base - 1e-9, base + config.value_window):
                if e["type"]["name"] == "Shot" and e["team"]["name"] == team:
                    xg = max(xg, e["shot"].get("statsbomb_xg", 0.0))
                    shots += 1

        # ② 수렴 — 트리거 시점. 트리거는 상대가 행했으므로 압박자는 teammate=False 쪽.
        raw, cover, adj = convergence_at(
            frames.get(trigger["id"]),
            ball,
            pressers_are_teammates=False,
            estimator=estimator,
        )

        if curve is not None:
            _accumulate_curve(curve, events, frames, trigger, kind, team, estimator, config)

        records.append(
            PressChain(
                match_id=match_id,
                team=team,
                minute=onset["minute"],
                trigger=kind,
                press_x=onset["location"][0],
                press_y=onset["location"][1],
                trigger_x=ball[0],
                trigger_y=ball[1],
                regain=regain,
                regain_t=regain_t,
                regain_x=regain_x,
                xg=xg,
                shots=shots,
                conv_raw=raw,
                conv_adj=adj,
                coverage=cover,
            )
        )
    return records


def _accumulate_curve(curve, events, frames, trigger, kind, team, estimator, config) -> None:
    """트리거 이후 지평까지의 수렴 지수를 초 단위 버킷에 누적한다."""
    for e in events:
        if e["period"] != trigger["period"] or "location" not in e:
            continue
        dt = e["_t"] - trigger["_t"]
        if not 0 <= dt <= config.conv_horizon:
            continue
        frame = frames.get(e["id"])
        if frame is None:
            continue
        _, _, adj = convergence_at(
            frame,
            tuple(e["location"][:2]),
            pressers_are_teammates=(e["team"]["name"] == team),
            estimator=estimator,
            exclude_actor=True,
        )
        if adj is not None:
            curve.setdefault((kind, round(dt)), []).append(adj)


def match_context(events: list[dict], team: str) -> tuple[int, int, list[float]]:
    """PPDA 구성 요소와 수비 액션 높이를 뽑는다.

    좌표는 팀별 미러이므로 같은 물리적 구역이라도 팀에 따라 임계값이 다르다
    (상대 패스는 x ≤ 72, 우리 수비 액션은 x ≥ 48).
    """
    opponent_passes = sum(
        1
        for e in events
        if e["team"]["name"] != team
        and e["type"]["name"] == "Pass"
        and e.get("location", (0,))[0] <= _PPDA_OPP_ZONE_X
    )
    defensive_actions = sum(
        1
        for e in events
        if e["team"]["name"] == team
        and e["type"]["name"] in _PPDA_ACTION_TYPES
        and e.get("location", (0,))[0] >= _PPDA_DEF_ZONE_X
    )
    heights = [
        e["location"][0]
        for e in events
        if e["team"]["name"] == team
        and e["type"]["name"] in DEFENSIVE_ACTION_TYPES
        and "location" in e
    ]
    return opponent_passes, defensive_actions, heights


def records_to_dicts(records: list[PressChain]) -> list[dict]:
    return [asdict(r) for r in records]
