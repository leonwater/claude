#!/usr/bin/env python3
"""대회 51경기 전수를 돌려 24개국 압박 프로파일을 만든다.

    python scripts/run_tournament.py

한 팀의 표본만으로는 "강도가 성과를 만들지 않는다"가 그 팀의 특성인지
축구 전반의 성질인지 알 수 없다. 같은 파이프라인을 전 팀에 적용해 대조한다.
"""
from __future__ import annotations

import json
import math
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from press import DEFAULT, CoverageEstimator, analyse_team, match_context  # noqa: E402
from press.pipeline import TeamProfile  # noqa: E402
from press.statsbomb import load_events, load_frames, load_matches  # noqa: E402
from press.triggers import TRIGGERS  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "outputs"
MIN_ONSETS = 40
"""표본이 이보다 적은 팀은 비율이 불안정해 제외한다."""


def pearson(xs: list[float], ys: list[float]) -> float:
    mx, my = st.mean(xs), st.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return num / den


def linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    mx, my = st.mean(xs), st.mean(ys)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return my - slope * mx, slope


def main() -> None:
    estimator = CoverageEstimator(DEFAULT)
    profiles: dict[str, TeamProfile] = {}
    matches = load_matches()

    for i, m in enumerate(matches, 1):
        mid = m["match_id"]
        events, frames = load_events(mid), load_frames(mid)
        duration = max((e["minute"] for e in events), default=90)
        for team in (m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]):
            prof = profiles.setdefault(team, TeamProfile(team=team))
            prof.onsets += analyse_team(
                events, frames, team, mid, estimator=estimator, config=DEFAULT
            )
            prof.matches += 1
            prof.minutes += duration
            opp_pass, def_act, heights = match_context(events, team)
            prof.opponent_passes += opp_pass
            prof.defensive_actions += def_act
            prof.heights += heights
        if i % 10 == 0:
            print(f"  ...{i}/{len(matches)} 경기 처리", flush=True)

    rows = [p.summary() for p in profiles.values() if len(p.onsets) >= MIN_ONSETS]
    rows.sort(key=lambda r: -r["rate"])
    OUT.mkdir(exist_ok=True)
    (OUT / "teams.json").write_text(json.dumps(rows, ensure_ascii=False))

    print(f"\n{'='*94}\n대회 팀별 압박 프로파일 ({len(rows)}개국 · 온셋 {sum(r['onsets'] for r in rows)}회)\n{'='*94}")
    print(
        f"{'팀':<16}{'경기':>4}{'온셋':>6}{'온셋/90':>8}{'회수율':>8}"
        f"{'파이널서드':>10}{'수렴':>7}{'PPDA':>7}{'수비높이':>9}"
    )
    for r in rows:
        print(
            f"{r['team']:<16}{r['matches']:>4}{r['onsets']:>6}{r['per90']:>8.1f}{r['rate']:>7.1f}%"
            f"{r['ft']:>9.1f}%{r['conv']:>7.2f}{r['ppda']:>7.2f}{r['height']:>9.1f}"
        )

    rate = [r["rate"] for r in rows]
    print("\n=== 회수율과의 상관 ===")
    for label, key in [
        ("수비 액션 높이", "height"),
        ("PPDA", "ppda"),
        ("90분당 온셋", "per90"),
        ("수렴 지수", "conv"),
    ]:
        r = pearson([row[key] for row in rows], rate)
        print(f"  {label:<14} r = {r:+.3f}   R² = {r*r:.3f}")

    intercept, slope = linear_fit([r["height"] for r in rows], rate)
    print(f"\n회귀: 회수율 = {intercept:.2f} + {slope:.3f} × 수비높이")

    conv = [r["conv"] for r in rows]
    print(
        f"\n수렴 지수 {min(conv):.2f}~{max(conv):.2f} (변동계수 {st.stdev(conv)/st.mean(conv)*100:.1f}%)"
        f"  vs  회수율 {min(rate):.1f}~{max(rate):.1f}% (변동계수 {st.stdev(rate)/st.mean(rate)*100:.1f}%)"
    )

    print(f"\n{'='*58}\n트리거 구성비 편차: 스페인 − 대회 평균\n{'='*58}")
    spain = next((r for r in rows if r["team"] == "Spain"), None)
    if spain:
        print(f"{'트리거':<14}{'스페인':>9}{'대회평균':>10}{'편차':>9}")
        for trig in TRIGGERS:
            mine = spain["mix"].get(trig, 0.0)
            avg = st.mean([r["mix"].get(trig, 0.0) for r in rows])
            print(f"{trig:<14}{mine:>8.1f}%{avg:>9.1f}%{mine-avg:>+8.1f}p")


if __name__ == "__main__":
    main()
