"""분석 파라미터.

모든 임계값을 한 곳에 모아 둔다. 값을 바꾸면 파이프라인 전체가 같은 정의로 재실행된다.
근거는 README의 "방법론" 절 참조.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    # --- 압박 국면 정의 ---
    cluster_gap: float = 5.0
    """압박 온셋 분리 간격(초). 직전 이 시간 내 동일 팀 Pressure가 없으면 새 국면으로 본다."""

    lookback: float = 6.0
    """트리거 역추적 창(초). 온셋 직전 이 시간 내 상대의 마지막 온볼 이벤트를 트리거로 삼는다."""

    restart_offset: int = 2
    """재개(스로인/골킥) 라벨을 유효하게 볼 포제션 내 이벤트 오프셋.

    play_pattern이 포제션 전체에 지속되는 성질을 보정한다. 이 게이팅이 없으면
    스로인 20초 뒤의 패스도 'From Throw In'으로 잡혀 재개 상황이 과대계상된다.
    """

    # --- 결과 판정 ---
    regain_window: float = 8.0
    """회수 판정 창(초). 온셋 이후 이 시간 내 소유권을 되찾으면 회수로 본다."""

    value_window: float = 12.0
    """회수 후 슈팅 추적 창(초)."""

    final_third: float = 80.0
    """파이널서드 경계 (압박 팀 프레임 기준 x)."""

    # --- 360 수렴 측정 ---
    conv_radius: float = 12.0
    """수렴 반경(SB유닛). 12유닛 ≈ 10.4m."""

    conv_horizon: float = 5.0
    """수렴 곡선 관측 지평(초)."""

    min_coverage: float = 0.35
    """가시성 보정 최소 신뢰 커버리지. 미만이면 해당 프레임을 제외한다."""

    mc_samples: int = 240
    """커버리지 추정용 몬테카를로 표본 수."""

    mc_seed: int = 7
    """몬테카를로 시드. 재현성을 위해 고정한다."""

    # --- 프리즈프레임 선수 식별 ---
    id_window: float = 5.0
    """선수 위치 추정에 사용할 이벤트 시간 창(초)."""

    id_threshold: float = 4.0
    """매칭 허용 오차(SB유닛). 초과하면 미식별로 남긴다."""

    id_time_penalty: float = 0.6
    """매칭 점수에서 시간차 1초당 가산되는 거리 페널티(SB유닛)."""


DEFAULT = Config()
