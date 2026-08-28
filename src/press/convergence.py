"""360 수렴 지수와 가시성 보정.

360 프리즈프레임은 **방송 카메라에 잡힌 선수만** 기록한다(프레임당 평균 16.5명 / 22명).
볼 주변 압박자를 그냥 세면 카메라가 넓게 잡은 장면일수록 압박이 약해 보이는
**방향이 정해진 오차**가 생기고, 이런 편향은 표본을 늘려도 사라지지 않는다.

그래서 각 프레임의 ``visible_area`` 폴리곤 대비 관심 원판의 커버리지 비율을
몬테카를로로 추정해 원시 카운트를 정규화한다.
"""
from __future__ import annotations

import math
import random

from .config import DEFAULT, Config
from .statsbomb import visible_area_polygon


def _unit_disc(samples: int, seed: int) -> list[tuple[float, float]]:
    """반지름 1 원판 위 균등 표본. sqrt(u)를 써야 면적 균등이 된다."""
    rng = random.Random(seed)
    return [(math.sqrt(rng.random()), rng.random() * 2 * math.pi) for _ in range(samples)]


def _point_in_polygon(px: float, py: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > py) != (y2 > py):
            if px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


class CoverageEstimator:
    """볼 주변 원판이 카메라 가시영역에 얼마나 포함되는지 추정한다."""

    def __init__(self, config: Config = DEFAULT):
        self.config = config
        self._disc = _unit_disc(config.mc_samples, config.mc_seed)

    def coverage(self, ball: tuple[float, float], polygon: list[tuple[float, float]]) -> float:
        bx, by = ball
        r = self.config.conv_radius
        hits = sum(
            1
            for radius, theta in self._disc
            if _point_in_polygon(
                bx + radius * r * math.cos(theta), by + radius * r * math.sin(theta), polygon
            )
        )
        return hits / len(self._disc)


def convergence_at(
    frame: dict | None,
    ball: tuple[float, float],
    *,
    pressers_are_teammates: bool,
    estimator: CoverageEstimator,
    exclude_actor: bool = False,
) -> tuple[int | None, float | None, float | None]:
    """볼 반경 내 압박자 수를 원시/보정 값으로 반환한다.

    Parameters
    ----------
    pressers_are_teammates
        프리즈프레임의 ``teammate`` 플래그는 **행위자 팀 기준**이다. 트리거 이벤트는
        상대가 행한 것이므로 압박자는 ``teammate=False`` 쪽이 된다.
    exclude_actor
        볼을 소유한 선수를 압박자 집계에서 제외할지 여부.

    Returns
    -------
    (원시 카운트, 커버리지, 보정 카운트). 프레임이 없으면 모두 ``None``.
    커버리지가 ``min_coverage`` 미만이면 보정 값만 ``None`` 이고 원시 카운트는 남긴다 —
    보정 전후를 같은 표본에서 비교할 수 있어야 보정 효과를 정직하게 말할 수 있다.
    """
    if frame is None:
        return None, None, None

    cfg = estimator.config
    cover = estimator.coverage(ball, visible_area_polygon(frame))

    raw = 0
    for player in frame["freeze_frame"]:
        if player["teammate"] != pressers_are_teammates or player["keeper"]:
            continue
        if exclude_actor and player["actor"]:
            continue
        if math.dist(player["location"], ball) <= cfg.conv_radius:
            raw += 1

    reliable = cover >= cfg.min_coverage
    return raw, cover, (raw / cover if reliable else None)
