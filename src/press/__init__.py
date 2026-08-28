"""Euro 2024 압박 트리거 분석 파이프라인.

StatsBomb 오픈데이터(이벤트 + 360)로 압박을 트리거 단위로 분해한다.
"""
from .config import DEFAULT, Config
from .convergence import CoverageEstimator, convergence_at
from .identify import IdentifiedPlayer, identify_players
from .pipeline import PressChain, TeamProfile, analyse_team, match_context
from .triggers import TRIGGERS, classify_trigger, find_onsets, match_trigger

__all__ = [
    "Config",
    "DEFAULT",
    "CoverageEstimator",
    "convergence_at",
    "IdentifiedPlayer",
    "identify_players",
    "PressChain",
    "TeamProfile",
    "analyse_team",
    "match_context",
    "TRIGGERS",
    "classify_trigger",
    "find_onsets",
    "match_trigger",
]
