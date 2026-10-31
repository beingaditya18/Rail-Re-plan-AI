"""
RailReplan Domain Models — Pydantic v2
All data is SIMULATED. Decision support only.
"""
from __future__ import annotations

import enum
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from uuid import uuid4


# ── Enums ──────────────────────────────────────────────────

class TrainType(str, enum.Enum):
    VANDE_BHARAT = "VANDE_BHARAT"
    RAJDHANI = "RAJDHANI"
    SUPERFAST = "SUPERFAST"
    MAIL_EXPRESS = "MAIL_EXPRESS"
    PASSENGER = "PASSENGER"
    FREIGHT = "FREIGHT"


class Direction(str, enum.Enum):
    UP = "UP"      # towards Delhi
    DN = "DN"      # away from Delhi


class DisruptionType(str, enum.Enum):
    TRAIN_DELAY = "TRAIN_DELAY"
    TRACK_BLOCK = "TRACK_BLOCK"
    WEATHER_FOG = "WEATHER_FOG"
    LOCO_FAILURE = "LOCO_FAILURE"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DisruptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    UPDATED = "UPDATED"
    CLEARED = "CLEARED"


class CrewRole(str, enum.Enum):
    LOCO_PILOT = "LOCO_PILOT"
    ASST_LOCO_PILOT = "ASST_LOCO_PILOT"
    GUARD = "GUARD"


class TrainAction(str, enum.Enum):
    RUN = "RUN"
    HOLD = "HOLD"
    USE_LOOP = "USE_LOOP"
    DIVERT = "DIVERT"
    SHORT_TERMINATE = "SHORT_TERMINATE"
    CANCEL = "CANCEL"


class AlertChannel(str, enum.Enum):
    SMS = "sms"
    APP_PUSH = "app_push"
    WHATSAPP = "whatsapp"
    STATION_PA = "station_pa"
    DISPLAY_BOARD = "display_board"


class AgentRole(str, enum.Enum):
    INTAKE = "INTAKE"
    IMPACT = "IMPACT"
    SCHEDULE = "SCHEDULE"
    PLATFORM = "PLATFORM"
    CREW = "CREW"
    COMMUNICATION = "COMMUNICATION"
    COPILOT = "COPILOT"
    RAG = "RAG"
    ORCHESTRATOR = "ORCHESTRATOR"


class SolverStatus(str, enum.Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    UNKNOWN = "UNKNOWN"
    TIMEOUT = "TIMEOUT"


# ── Safety Validation Models ──────────────────────────────

class SafetyViolation(BaseModel):
    severity: str = "ERROR"  # ERROR, WARNING
    rule: str  # HEADWAY, PLATFORM_CLEARANCE, PLATFORM_OVERLAP, CREW_HOER, DWELL_VIOLATION
    description: str
    train_numbers: list[str] = Field(default_factory=list)
    location: str = ""
    timestamp: Optional[datetime] = None


class SafetyValidationReport(BaseModel):
    is_safe: bool = True
    violations: list[SafetyViolation] = Field(default_factory=list)
    warning_count: int = 0
    error_count: int = 0
    checked_rules: list[str] = Field(default_factory=list)
    validated_at: datetime = Field(default_factory=datetime.now)


# ── Station & Network ─────────────────────────────────────

class Platform(BaseModel):
    id: str
    station_code: str = ""
    platform_number: int = 1
    length_m: float = 600.0
    usable_length_m: float = 580.0
    clearance_margin_m: float = 20.0
    handles_freight: bool = False
    resource_type: str = "platform"  # platform, loop_line, siding


class Station(BaseModel):
    code: str
    name: str
    km: float
    platforms: list[Platform] = Field(default_factory=list)
    loops: int = 0
    loop_lines: list[Platform] = Field(default_factory=list)


class Section(BaseModel):
    from_station: str
    to_station: str
    length_km: float
    up_line: bool = True
    dn_line: bool = True
    max_speed_kmph: float = 130.0
    min_headway_min: int = 5


# ── Train ──────────────────────────────────────────────────

class ScheduledStop(BaseModel):
    station_code: str
    arrival: Optional[datetime] = None
    departure: Optional[datetime] = None
    min_dwell_min: int = 2
    platform_id: Optional[str] = None


class SectionRuntime(BaseModel):
    from_station: str
    to_station: str
    runtime_min: float


class Train(BaseModel):
    number: str
    name: str
    type: TrainType
    priority_weight: int = 50
    direction: Direction
    coaches: int = 24
    length_m: float = 550.0
    rake_id: str = ""
    stops: list[ScheduledStop] = Field(default_factory=list)
    section_runtimes: list[SectionRuntime] = Field(default_factory=list)


class RakeLinkage(BaseModel):
    rake_id: str
    current_train: str
    next_train: str
    turnaround_station: str
    min_turnaround_min: int = 30


# ── Crew ───────────────────────────────────────────────────

class CrewMember(BaseModel):
    id: str = Field(default_factory=lambda: f"CREW-{uuid4().hex[:8].upper()}")
    name: str
    role: CrewRole
    base_station: str
    route_qualifications: list[str] = Field(default_factory=list)  # section codes
    duty_start: Optional[datetime] = None
    hours_on_duty: float = 0.0
    max_duty_hours: float = 12.0
    min_rest_hours: float = 8.0
    assigned_train: Optional[str] = None
    is_spare: bool = False


# ── Passengers ─────────────────────────────────────────────

class PassengerGroup(BaseModel):
    id: str = Field(default_factory=lambda: f"PAX-{uuid4().hex[:6].upper()}")
    train_number: str
    boarding_station: str
    alighting_station: str
    count: int = 1
    connecting_train: Optional[str] = None
    language: str = "en"  # en or hi
    contact: str = ""     # fake phone


# ── Disruption ─────────────────────────────────────────────

class DisruptionUpdate(BaseModel):
    timestamp: datetime
    field: str
    old_value: str
    new_value: str
    reason: str = ""


class Disruption(BaseModel):
    id: str = Field(default_factory=lambda: f"DISR-{uuid4().hex[:8].upper()}")
    type: DisruptionType
    description: str = ""
    location_station: Optional[str] = None
    location_section: Optional[tuple[str, str]] = None
    start_time: datetime
    expected_duration_min: int = 60
    severity: Severity = Severity.MEDIUM
    confidence: float = 0.8
    status: DisruptionStatus = DisruptionStatus.ACTIVE
    speed_cap_kmph: Optional[float] = None
    affected_train: Optional[str] = None  # for TRAIN_DELAY
    delay_minutes: Optional[int] = None   # for TRAIN_DELAY
    updates: list[DisruptionUpdate] = Field(default_factory=list)
    source: str = "manual"  # manual, free_text, api, intel


# ── Plan ───────────────────────────────────────────────────

class PlanEvent(BaseModel):
    train_number: str
    station_code: str
    original_arrival: Optional[datetime] = None
    original_departure: Optional[datetime] = None
    revised_arrival: Optional[datetime] = None
    revised_departure: Optional[datetime] = None
    original_platform: Optional[str] = None
    revised_platform: Optional[str] = None
    line_used: Optional[str] = None  # UP, DN, LOOP
    action: TrainAction = TrainAction.RUN
    delay_minutes: int = 0


class CrewAssignment(BaseModel):
    train_number: str
    crew_id: str
    crew_name: str
    role: CrewRole
    from_station: str
    to_station: str
    original: bool = True  # vs reassigned


class DecisionLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    agent: AgentRole
    decision: str
    reason: str
    details: dict = Field(default_factory=dict)


class PlanMetrics(BaseModel):
    total_delay_minutes: float = 0
    weighted_delay_minutes: float = 0
    trains_affected: int = 0
    trains_cancelled: int = 0
    trains_short_terminated: int = 0
    on_time_percentage: float = 100.0
    passenger_minutes_lost: float = 0
    missed_connections: int = 0
    platform_changes: int = 0
    crew_changes: int = 0
    solve_time_seconds: float = 0
    optimality_gap: float = 0
    alert_lead_time_minutes: float = 0
    solver_status: str = "OPTIMAL"
    delay_reduction_pct: float = 0.0


class Plan(BaseModel):
    id: str = Field(default_factory=lambda: f"PLAN-{uuid4().hex[:8].upper()}")
    disruption_id: str
    events: list[PlanEvent] = Field(default_factory=list)
    crew_assignments: list[CrewAssignment] = Field(default_factory=list)
    decision_log: list[DecisionLogEntry] = Field(default_factory=list)
    metrics: PlanMetrics = Field(default_factory=PlanMetrics)
    safety_report: Optional[SafetyValidationReport] = None
    solver_status: str = "OPTIMAL"
    status: str = "proposed"  # proposed, approved, applied, rejected
    policy: str = "agent"     # do_nothing, heuristic, agent
    created_at: datetime = Field(default_factory=datetime.now)


# ── Agent Messages ─────────────────────────────────────────

class AgentMessage(BaseModel):
    id: str = Field(default_factory=lambda: f"MSG-{uuid4().hex[:8].upper()}")
    timestamp: datetime = Field(default_factory=datetime.now)
    from_agent: AgentRole
    to_agent: Optional[AgentRole] = None
    message_type: str = "info"  # info, proposal, conflict, approval, rejection
    content: str = ""
    data: dict = Field(default_factory=dict)
    negotiation_round: int = 0


class Conflict(BaseModel):
    type: str  # headway, platform, crew_duty, rake_turnaround
    description: str
    train_numbers: list[str] = Field(default_factory=list)
    station_code: Optional[str] = None
    constraint: str = ""  # e.g., "train must depart before 10:40"


# ── Alert ──────────────────────────────────────────────────

class PassengerAlert(BaseModel):
    id: str = Field(default_factory=lambda: f"ALERT-{uuid4().hex[:8].upper()}")
    timestamp: datetime = Field(default_factory=datetime.now)
    train_number: str
    train_name: str = ""
    channel: AlertChannel
    language: str = "en"
    subject: str = ""
    body: str = ""
    recipients_count: int = 0
    station_code: Optional[str] = None
    delay_minutes: Optional[int] = None
    new_platform: Optional[str] = None
    verified: bool = False
    plan_id: str = ""


# ── Simulation State ───────────────────────────────────────

class TrainPosition(BaseModel):
    train_number: str
    train_name: str
    train_type: TrainType
    direction: Direction
    current_km: float
    current_section: Optional[tuple[str, str]] = None
    current_station: Optional[str] = None
    speed_kmph: float = 0
    status: str = "on_time"  # on_time, delayed, halted, cancelled
    delay_minutes: int = 0


class SimulationState(BaseModel):
    clock: datetime
    tick: int = 0
    speed_multiplier: float = 60.0
    running: bool = False
    paused: bool = False
    trains: list[TrainPosition] = Field(default_factory=list)
    active_disruptions: list[Disruption] = Field(default_factory=list)
    metrics: dict = Field(default_factory=dict)


# ── RAG / Evidence ─────────────────────────────────────────

class EvidenceClaim(BaseModel):
    claim: str
    source_title: str
    source_url: Optional[str] = None
    source_date: Optional[str] = None
    excerpt: str = ""
    confidence: float = 0.8
    source_type: str = "rulebook"  # rulebook, web, decision_log


class EvidenceBundle(BaseModel):
    query: str
    claims: list[EvidenceClaim] = Field(default_factory=list)
    grounded: bool = True
    timestamp: datetime = Field(default_factory=datetime.now)


# ── WebSocket Events ──────────────────────────────────────

class WSEvent(BaseModel):
    type: str  # sim_tick, train_position, disruption, agent_message, plan_proposal, alert, kpi
    timestamp: datetime = Field(default_factory=datetime.now)
    data: dict = Field(default_factory=dict)
