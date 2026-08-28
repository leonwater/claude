#!/usr/bin/env python3
"""리포트에 실을 압박 사례 한 장면을 고르고 선수 이름을 복원한다.

    python scripts/run_team.py --team Spain     # 먼저 실행 (outputs/spain.json 생성)
    python scripts/make_vignette.py --team Spain

선정 기준은 "수렴이 회수로 직결됐고, 볼 주변 선수가 실제로 식별되는" 장면이다.
지표는 국면을 요약하지만 코치를 설득하는 것은 장면이라, 이름 없는 점 그림은 쓸모가 적다.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from press import DEFAULT, identify_players  # noqa: E402
from press.statsbomb import load_events, load_frames, to_metres  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "outputs"

MIN_CONV = 3.0
MIN_REGAIN_X = 75.0
NEAR_BALL = 5
"""볼에서 가장 가까운 이 인원의 식별률을 선정 기준으로 삼는다."""


def find_trigger_event(events: list[dict], record: dict, team: str) -> dict | None:
    """기록된 트리거 좌표·분으로 원본 이벤트를 다시 찾는다."""
    for e in events:
        if e["team"]["name"] == team or "location" not in e:
            continue
        if e.get("minute") != record["minute"]:
            continue
        if (
            abs(e["location"][0] - record["trigger_x"]) < 0.5
            and abs(e["location"][1] - record["trigger_y"]) < 0.5
        ):
            return e
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", default="Spain")
    ap.add_argument("--top", type=int, default=14, help="후보로 검토할 상위 사례 수")
    args = ap.parse_args()
    team = args.team

    data = json.loads((OUT / f"{team.lower()}.json").read_text())
    candidates = [
        r
        for r in data["records"]
        if r["regain"]
        and r["conv_adj"]
        and r["conv_adj"] >= MIN_CONV
        and r["regain_x"]
        and r["regain_x"] >= MIN_REGAIN_X
    ]
    candidates.sort(key=lambda r: -r["conv_adj"])

    cache: dict[int, tuple[list[dict], dict]] = {}
    best = None
    print(f"{'경기':>10}{'분':>5}  {'트리거':<14}{'수렴':>6}{'식별률':>10}{'근접5명':>9}")
    for rec in candidates[: args.top]:
        mid = rec["match_id"]
        if mid not in cache:
            cache[mid] = (load_events(mid), load_frames(mid))
        events, frames = cache[mid]

        trigger = find_trigger_event(events, rec, team)
        if trigger is None or trigger["id"] not in frames:
            continue
        players = identify_players(events, frames[trigger["id"]], trigger, DEFAULT)
        named = sum(1 for p in players if p.name)
        near = sum(1 for p in players[:NEAR_BALL] if p.name)
        print(
            f"{mid:>10}{rec['minute']:>5}  {rec['trigger']:<14}{rec['conv_adj']:>6.2f}"
            f"{named:>5}/{len(players):<4}{near:>6}/{NEAR_BALL}"
        )
        score = near / NEAR_BALL * 0.6 + named / len(players) * 0.4
        if best is None or score > best[0]:
            best = (score, rec, trigger, players)

    if best is None:
        print("조건을 만족하는 사례가 없습니다.")
        return

    _, rec, trigger, players = best
    print(f"\n★ 선정: {rec['minute']}분 · {rec['trigger']} · 수렴 {rec['conv_adj']:.2f}")
    print(
        f"  트리거: {trigger['type']['name']} · {trigger['player']['name']}"
        f" @ {trigger['location']}  →  {rec['regain_t']:.2f}s 후 x={rec['regain_x']:.0f} 회수"
    )
    print(f"\n{'팀':<5}{'좌표':<17}{'선수':<30}{'볼거리':>9}{'매칭오차':>9}")
    for p in players:
        side = trigger["team"]["name"][:3].upper() if p.is_actor_team else team[:3].upper()
        err = f"{p.match_error:.1f}u" if p.match_error is not None else "—"
        print(
            f"{side:<5}({p.x:5.1f},{p.y:5.1f})  {(p.name or '— 미식별')[:28]:<30}"
            f"{to_metres(p.distance_to_ball):>8.1f}m{err:>9}"
        )

    names = [p.name for p in players if p.name]
    assert len(names) == len(set(names)), "선수가 중복 배정됨 — 1:1 배정이 깨졌다"
    print(f"\n식별 {len(names)}/{len(players)}명 · 중복 없음 확인")

    OUT.mkdir(exist_ok=True)
    (OUT / "vignette.json").write_text(
        json.dumps(
            {
                "match_id": rec["match_id"],
                "minute": rec["minute"],
                "trigger": rec["trigger"],
                "conv_adj": round(rec["conv_adj"], 2),
                "regain_t": round(rec["regain_t"], 2),
                "regain_x": rec["regain_x"],
                "ball": trigger["location"][:2],
                "actor": trigger["player"]["name"],
                "actor_team": trigger["team"]["name"],
                "event": trigger["type"]["name"],
                "players": [asdict(p) for p in players],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
