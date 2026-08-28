#!/usr/bin/env python3
"""한 팀의 압박을 온셋 단위로 심층 분석한다.

    python scripts/run_team.py --team Spain

트리거별 프로파일, 경기별 프로파일, 수렴 곡선, 구역 지도를 출력하고
``outputs/<team>.json`` 에 원자료를 남긴다.
"""
from __future__ import annotations

import argparse
import json
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from press import DEFAULT, CoverageEstimator, analyse_team, match_context  # noqa: E402
from press.pipeline import records_to_dicts  # noqa: E402
from press.statsbomb import load_events, load_frames, load_matches  # noqa: E402
from press.triggers import TRIGGERS  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "outputs"


def team_matches(matches: list[dict], team: str) -> list[dict]:
    picked = [
        m
        for m in matches
        if team in (m["home_team"]["home_team_name"], m["away_team"]["away_team_name"])
    ]
    return sorted(picked, key=lambda m: m["match_date"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", default="Spain")
    args = ap.parse_args()
    team = args.team

    estimator = CoverageEstimator(DEFAULT)
    curve: dict[tuple[str, int], list[float]] = {}
    records, match_rows = [], []

    for m in team_matches(load_matches(), team):
        mid = m["match_id"]
        events, frames = load_events(mid), load_frames(mid)
        rows = analyse_team(
            events, frames, team, mid, estimator=estimator, config=DEFAULT, curve=curve
        )
        records += rows

        opp_pass, def_act, heights = match_context(events, team)
        at_home = m["home_team"]["home_team_name"] == team
        opponent = (
            m["away_team"]["away_team_name"] if at_home else m["home_team"]["home_team_name"]
        )
        # 스코어는 분석 대상 팀 기준으로 뒤집어 표기한다.
        ours, theirs = (
            (m["home_score"], m["away_score"]) if at_home else (m["away_score"], m["home_score"])
        )
        regained = sum(1 for r in rows if r.regain)
        match_rows.append(
            {
                "match_id": mid,
                "opponent": opponent,
                "stage": m["competition_stage"]["name"],
                "score": f"{ours}-{theirs}",
                "ppda": round(opp_pass / max(def_act, 1), 2),
                "onsets": len(rows),
                "height": round(st.mean(heights), 1),
                "rate": round(regained / max(len(rows), 1) * 100, 1),
            }
        )

    OUT.mkdir(exist_ok=True)
    (OUT / f"{team.lower()}.json").write_text(
        json.dumps(
            {
                "records": records_to_dicts(records),
                "matches": match_rows,
                "curve": {f"{k[0]}|{k[1]}": v for k, v in curve.items()},
            },
            ensure_ascii=False,
        )
    )

    _report(team, records, match_rows, curve)


def _report(team, records, match_rows, curve) -> None:
    n = len(records)
    print(f"=== {team} · 압박 트리거 프로파일 ===")
    print(f"압박 온셋(트리거 매칭): {n}건\n")

    print(f"{'트리거':<14}{'건수':>5}{'비중':>8}{'회수율':>8}{'중앙시간':>9}{'파이널서드':>10}{'수렴':>7}")
    print("-" * 62)
    for trig in TRIGGERS:
        sub = [r for r in records if r.trigger == trig]
        if not sub:
            continue
        regained = [r for r in sub if r.regain]
        convs = [r.conv_adj for r in sub if r.conv_adj is not None]
        ft = sum(
            1 for r in regained if r.regain_x is not None and r.regain_x >= DEFAULT.final_third
        )
        median_t = st.median([r.regain_t for r in regained]) if regained else float("nan")
        print(
            f"{trig:<14}{len(sub):>5}{len(sub)/n*100:>7.1f}%{len(regained)/len(sub)*100:>7.1f}%"
            f"{median_t:>8.2f}s{ft/len(sub)*100:>9.1f}%{st.mean(convs):>7.2f}"
        )

    regained = [r for r in records if r.regain]
    convs = [r.conv_adj for r in records if r.conv_adj is not None]
    # 보정 효과는 같은 표본(신뢰 프레임)에서 비교해야 한다.
    raws = [r.conv_raw for r in records if r.conv_adj is not None]
    covers = [r.coverage for r in records if r.coverage is not None]
    print("-" * 62)
    print(
        f"{'전체':<14}{n:>5}{100:>7.1f}%{len(regained)/n*100:>7.1f}%"
        f"{st.median([r.regain_t for r in regained]):>8.2f}s"
        f"{sum(1 for r in regained if r.regain_x and r.regain_x >= DEFAULT.final_third)/n*100:>9.1f}%"
        f"{st.mean(convs):>7.2f}"
    )
    print(
        f"\n360 커버리지 평균 {st.mean(covers)*100:.1f}% · 신뢰 프레임 {len(convs)}/{len(covers)}"
        f" ({len(convs)/len(covers)*100:.1f}%) · 보정 효과 {st.mean(raws):.2f} → {st.mean(convs):.2f}"
        f" ({st.mean(convs)/st.mean(raws)-1:+.1%})"
    )
    print(
        f"회수 {len(regained)}건 중 파이널서드 "
        f"{sum(1 for r in regained if r.regain_x and r.regain_x >= DEFAULT.final_third)}건 · "
        f"슈팅 {sum(r.shots for r in records)}회 · 누적 xG {sum(r.xg for r in records):.3f}"
    )

    print("\n=== 경기별 프로파일 ===")
    print(f"{'상대':<16}{'단계':<16}{'결과':>6}{'PPDA':>7}{'온셋':>6}{'수비높이':>9}{'회수율':>8}")
    for row in match_rows:
        print(
            f"{row['opponent']:<16}{row['stage']:<16}{row['score']:>6}{row['ppda']:>7.2f}"
            f"{row['onsets']:>6}{row['height']:>9.1f}{row['rate']:>7.1f}%"
        )

    print("\n=== 수렴 곡선 (트리거 이후 경과초별 평균 압박자 수) ===")
    print(f"{'트리거':<14}" + "".join(f"{s:>7}s" for s in range(6)))
    for trig in TRIGGERS:
        cells = []
        for sec in range(6):
            vals = curve.get((trig, sec), [])
            cells.append(f"{st.mean(vals):>8.2f}" if len(vals) >= 8 else f"{'·':>8}")
        print(f"{trig:<14}" + "".join(cells))

    print("\n=== 구역별 회수율 (x 6분할 × y 3분할, 압박 팀 프레임) ===")
    grid = defaultdict(list)
    for r in records:
        grid[(min(int(r.press_x // 20), 5), min(int(r.press_y // (80 / 3)), 2))].append(r)
    for yi, channel in enumerate(["좌측", "중앙", "우측"]):
        cells = []
        for xi in range(6):
            sub = grid.get((xi, yi), [])
            if sub:
                rate = sum(1 for r in sub if r.regain) / len(sub) * 100
                cells.append(f"{len(sub):>4}건{rate:>6.1f}%")
            else:
                cells.append(f"{'-':>11}")
        print(f"{channel:<8}" + "".join(cells))


if __name__ == "__main__":
    main()
