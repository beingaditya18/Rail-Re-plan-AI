"""
Seeded data generator for RailReplan.
Generates a realistic North-Central India corridor with ~35 trains,
crew rosters, and passenger groups. ALL DATA IS SIMULATED.

Usage:
    python -m railreplan.data.generate --seed 42
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from railreplan.models import (
    Station, Platform, Section, Train, TrainType, Direction,
    ScheduledStop, SectionRuntime, CrewMember, CrewRole,
    PassengerGroup, RakeLinkage,
)
from railreplan.config import load_config


# ── Corridor Definition ───────────────────────────────────

STATION_DETAILS = [
    {"code": "NDLS", "name": "New Delhi",        "km": 0,   "plat_count": 8, "loops": 2, "freight": [7, 8]},
    {"code": "MTJ",  "name": "Mathura Junction", "km": 141, "plat_count": 5, "loops": 2, "freight": [5]},
    {"code": "AGC",  "name": "Agra Cantt",       "km": 195, "plat_count": 6, "loops": 2, "freight": [6]},
    {"code": "GWL",  "name": "Gwalior",          "km": 305, "plat_count": 5, "loops": 2, "freight": [5]},
    {"code": "DAA",  "name": "Datia",            "km": 365, "plat_count": 3, "loops": 1, "freight": [3]},
    {"code": "JHS",  "name": "Jhansi Junction",  "km": 403, "plat_count": 6, "loops": 2, "freight": [6]},
    {"code": "LAR",  "name": "Lalitpur",         "km": 458, "plat_count": 3, "loops": 1, "freight": [3]},
    {"code": "BINA", "name": "Bina Junction",    "km": 534, "plat_count": 5, "loops": 2, "freight": [5]},
    {"code": "BPL",  "name": "Bhopal Junction",  "km": 702, "plat_count": 7, "loops": 2, "freight": [7]},
]

# Speed profiles by train type (km/h)
SPEED_PROFILES: dict[TrainType, int] = {
    TrainType.VANDE_BHARAT: 130,
    TrainType.RAJDHANI: 120,
    TrainType.SUPERFAST: 100,
    TrainType.MAIL_EXPRESS: 85,
    TrainType.PASSENGER: 60,
    TrainType.FREIGHT: 50,
}

PRIORITY_WEIGHTS: dict[TrainType, int] = {
    TrainType.VANDE_BHARAT: 100,
    TrainType.RAJDHANI: 95,
    TrainType.SUPERFAST: 70,
    TrainType.MAIL_EXPRESS: 50,
    TrainType.PASSENGER: 30,
    TrainType.FREIGHT: 10,
}

# Train templates: (number, name, type, direction, stop_pattern)
# stop_pattern: list of station codes where the train stops
TRAIN_TEMPLATES = [
    # ── Vande Bharat & Tejas (Highest Priority, 130 km/h) ──
    ("22436", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BPL"]),
    ("22435", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.UP, ["BPL", "JHS", "GWL", "AGC", "NDLS"]),
    ("20172", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "BPL"]),
    ("20171", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.UP, ["BPL", "GWL", "AGC", "MTJ", "NDLS"]),
    ("20957", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.DN, ["NDLS", "AGC", "GWL", "JHS"]),
    ("20958", "Vande Bharat Express",        TrainType.VANDE_BHARAT, Direction.UP, ["JHS", "GWL", "AGC", "NDLS"]),

    # ── Shatabdi & Rajdhani (120 km/h) ──
    ("12001", "Bhopal Shatabdi",             TrainType.VANDE_BHARAT, Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BPL"]),
    ("12002", "Bhopal Shatabdi",             TrainType.VANDE_BHARAT, Direction.UP, ["BPL", "JHS", "GWL", "AGC", "NDLS"]),
    ("12434", "Chennai Rajdhani",            TrainType.RAJDHANI,     Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BPL"]),
    ("12433", "Chennai Rajdhani",            TrainType.RAJDHANI,     Direction.UP, ["BPL", "JHS", "GWL", "AGC", "NDLS"]),
    ("12438", "Secunderabad Rajdhani",       TrainType.RAJDHANI,     Direction.DN, ["NDLS", "AGC", "JHS", "BPL"]),
    ("12437", "Secunderabad Rajdhani",       TrainType.RAJDHANI,     Direction.UP, ["BPL", "JHS", "AGC", "NDLS"]),
    ("12627", "Karnataka Rajdhani",          TrainType.RAJDHANI,     Direction.DN, ["NDLS", "AGC", "JHS", "BINA", "BPL"]),
    ("12628", "Karnataka Rajdhani",          TrainType.RAJDHANI,     Direction.UP, ["BPL", "BINA", "JHS", "AGC", "NDLS"]),

    # ── Duronto Expresses (110 km/h) ──
    ("12214", "Delhi-YPR Duronto",           TrainType.RAJDHANI,     Direction.DN, ["NDLS", "GWL", "JHS", "BPL"]),
    ("12213", "YPR-Delhi Duronto",           TrainType.RAJDHANI,     Direction.UP, ["BPL", "JHS", "GWL", "NDLS"]),
    ("12286", "Secunderabad Duronto",        TrainType.RAJDHANI,     Direction.DN, ["NDLS", "JHS", "BINA", "BPL"]),
    ("12285", "Secunderabad Duronto",        TrainType.RAJDHANI,     Direction.UP, ["BPL", "BINA", "JHS", "NDLS"]),

    # ── Superfast Expresses (100 km/h) ──
    ("12622", "Tamil Nadu Express",          TrainType.SUPERFAST,    Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BPL"]),
    ("12621", "Tamil Nadu Express",          TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "GWL", "AGC", "NDLS"]),
    ("12626", "Kerala Express",              TrainType.SUPERFAST,    Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BPL"]),
    ("12625", "Kerala Express",              TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12615", "Grand Trunk Express",         TrainType.SUPERFAST,    Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BPL"]),
    ("12616", "Grand Trunk Express",         TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12724", "Telangana Express",           TrainType.SUPERFAST,    Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BPL"]),
    ("12723", "Telangana Express",           TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12137", "Punjab Mail SF",              TrainType.SUPERFAST,    Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BINA", "BPL"]),
    ("12138", "Punjab Mail SF",              TrainType.SUPERFAST,    Direction.UP, ["BPL", "BINA", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12191", "Jabalpur SF",                 TrainType.SUPERFAST,    Direction.DN, ["NDLS", "AGC", "GWL", "DAA", "JHS", "LAR", "BINA"]),
    ("12192", "Jabalpur SF",                 TrainType.SUPERFAST,    Direction.UP, ["BINA", "LAR", "JHS", "DAA", "GWL", "AGC", "NDLS"]),
    ("12903", "Golden Temple Mail",          TrainType.SUPERFAST,    Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "DAA", "JHS", "BPL"]),
    ("12904", "Golden Temple Mail",          TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "DAA", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12156", "Bhopal Express",              TrainType.SUPERFAST,    Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BPL"]),
    ("12155", "Bhopal Express",              TrainType.SUPERFAST,    Direction.UP, ["BPL", "JHS", "GWL", "AGC", "NDLS"]),

    # ── Mail & Express Trains (85 km/h) ──
    ("11077", "Jhelum Express",              TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "DAA", "JHS", "LAR", "BINA", "BPL"]),
    ("11078", "Jhelum Express",              TrainType.MAIL_EXPRESS, Direction.UP, ["BPL", "BINA", "LAR", "JHS", "DAA", "GWL", "AGC", "MTJ", "NDLS"]),
    ("11701", "Dakshin Express",             TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BINA", "BPL"]),
    ("11702", "Dakshin Express",             TrainType.MAIL_EXPRESS, Direction.UP, ["BPL", "BINA", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("14309", "Ujjaini Express",             TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "DAA", "JHS", "LAR", "BINA"]),
    ("14310", "Ujjaini Express",             TrainType.MAIL_EXPRESS, Direction.UP, ["BINA", "LAR", "JHS", "DAA", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12919", "Malwa Express",               TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "LAR", "BINA", "BPL"]),
    ("12920", "Malwa Express",               TrainType.MAIL_EXPRESS, Direction.UP, ["BPL", "BINA", "LAR", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12185", "Rewanchal Express",           TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "DAA", "JHS"]),
    ("12186", "Rewanchal Express",           TrainType.MAIL_EXPRESS, Direction.UP, ["JHS", "DAA", "GWL", "AGC", "MTJ", "NDLS"]),
    ("12448", "UP Sampark Kranti",           TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS"]),
    ("12447", "UP Sampark Kranti",           TrainType.MAIL_EXPRESS, Direction.UP, ["JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("18238", "Chhattisgarh Express",        TrainType.MAIL_EXPRESS, Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "DAA", "JHS", "LAR", "BINA", "BPL"]),
    ("18237", "Chhattisgarh Express",        TrainType.MAIL_EXPRESS, Direction.UP, ["BPL", "BINA", "LAR", "JHS", "DAA", "GWL", "AGC", "MTJ", "NDLS"]),

    # ── Passenger & MEMU Commuter (60 km/h) ──
    ("54151", "MTJ Passenger",               TrainType.PASSENGER,    Direction.DN, ["NDLS", "MTJ", "AGC"]),
    ("54152", "MTJ Passenger",               TrainType.PASSENGER,    Direction.UP, ["AGC", "MTJ", "NDLS"]),
    ("54253", "JHS Passenger",               TrainType.PASSENGER,    Direction.DN, ["AGC", "GWL", "DAA", "JHS"]),
    ("54254", "JHS Passenger",               TrainType.PASSENGER,    Direction.UP, ["JHS", "DAA", "GWL", "AGC"]),
    ("64181", "MEMU Local",                  TrainType.PASSENGER,    Direction.DN, ["JHS", "LAR", "BINA"]),
    ("64182", "MEMU Local",                  TrainType.PASSENGER,    Direction.UP, ["BINA", "LAR", "JHS"]),
    ("54301", "BPL Passenger",               TrainType.PASSENGER,    Direction.DN, ["BINA", "BPL"]),
    ("54302", "BPL Passenger",               TrainType.PASSENGER,    Direction.UP, ["BPL", "BINA"]),

    # ── Heavy Freight & Goods Rakes (50 km/h) ──
    ("FGHT01", "Container Freight Express",  TrainType.FREIGHT,      Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BPL"]),
    ("FGHT02", "Coal Hopper Freight",         TrainType.FREIGHT,      Direction.UP, ["BPL", "JHS", "GWL", "AGC", "MTJ", "NDLS"]),
    ("FGHT03", "Petroleum Tanker Special",   TrainType.FREIGHT,      Direction.DN, ["NDLS", "AGC", "GWL", "JHS", "BINA"]),
    ("FGHT04", "Food Grain Goods",            TrainType.FREIGHT,      Direction.UP, ["BINA", "JHS", "GWL", "AGC", "NDLS"]),
    ("FGHT05", "Mixed Steel Goods",           TrainType.FREIGHT,      Direction.DN, ["AGC", "GWL", "JHS", "LAR", "BINA", "BPL"]),
    ("FGHT06", "Fertilizer Special",          TrainType.FREIGHT,      Direction.UP, ["BPL", "BINA", "LAR", "JHS", "GWL"]),
    ("FGHT07", "Automobile Car Carrier",      TrainType.FREIGHT,      Direction.DN, ["NDLS", "MTJ", "AGC", "GWL", "JHS", "BPL"]),
    ("FGHT08", "Cement Hopper Goods",         TrainType.FREIGHT,      Direction.UP, ["JHS", "GWL", "AGC", "MTJ", "NDLS"]),
]

# Baseline simulated operational delays across the fleet (in minutes)
BASELINE_DELAYS: dict[str, int] = {
    # 🔴 Critical / Emergency Delays (>30 min)
    "54152": 54,   # Held at AGC outer for Rajdhani overtake
    "64182": 85,   # MEMU local delayed at Bina
    "54302": 42,   # Commuter delayed awaiting rake turnover
    "FGHT02": 62,  # Coal Freight looped for 22436 Vande Bharat
    "FGHT04": 75,  # Food grain rake waiting block signal
    "FGHT06": 48,  # Fertilizer rake in siding
    "14310": 38,   # Ujjaini express delayed due to rake linkage
    "12920": 45,   # Malwa express delayed due to cautionary order

    # 🟡 Moderate Delays (6-30 min)
    "12137": 14,   # Punjab Mail
    "12615": 18,   # Grand Trunk Express
    "11077": 24,   # Jhelum Express
    "12903": 12,   # Golden Temple Mail
    "11701": 16,   # Dakshin Express
    "12622": 15,   # Tamil Nadu Express
    "12724": 20,   # Telangana Express
    "12448": 10,   # UP Sampark Kranti
    "12185": 22,   # Rewanchal Express
    "14309": 15,   # Ujjaini Express DN
    "12191": 11,   # Jabalpur SF
    "54253": 25,   # JHS Passenger
    "54151": 8,    # MTJ Passenger
    "FGHT01": 28,  # Container Freight
}

# Crew names pool
CREW_FIRST_NAMES = [
    "Rajesh", "Amit", "Suresh", "Vikram", "Deepak", "Manoj", "Anil",
    "Sanjay", "Ramesh", "Prakash", "Sunil", "Vinod", "Ashok", "Dinesh",
    "Mohit", "Rakesh", "Naresh", "Govind", "Harish", "Jagdish",
    "Ravi", "Ajay", "Pankaj", "Santosh", "Mukesh", "Kamal", "Bharat",
    "Girish", "Kiran", "Lalit", "Mahesh", "Nitin", "Omprakash",
]

CREW_LAST_NAMES = [
    "Kumar", "Singh", "Sharma", "Verma", "Gupta", "Yadav", "Joshi",
    "Mishra", "Pandey", "Tiwari", "Dubey", "Srivastava", "Chauhan",
    "Rawat", "Nair", "Patel", "Reddy", "Das", "Bose", "Sen",
]


def _km_between(stations: list[dict], code_a: str, code_b: str) -> float:
    """Get distance between two station codes."""
    km_map = {s["code"]: s["km"] for s in stations}
    return abs(km_map[code_b] - km_map[code_a])


def generate_stations(rng: random.Random | None = None) -> list[Station]:
    """Generate the corridor stations with realistic platforms and loop lines."""
    if rng is None:
        rng = random.Random(42)
    stations = []
    for sd in STATION_DETAILS:
        platforms = []
        for i in range(1, sd["plat_count"] + 1):
            # Realistic IR platform lengths: 600m standard, 650m major, 550m/450m minor
            if i <= 2:
                length = 650.0  # Main high-capacity platforms (up to 24 coaches)
            elif i <= 4:
                length = 600.0  # Standard broad gauge 24-coach platform
            elif i <= 6:
                length = 550.0  # 20-22 coach platform
            else:
                length = 450.0  # Shorter commuter / passenger platform
            
            margin = 25.0  # Safety clearance to fouling marks / starter signal
            platforms.append(Platform(
                id=f"{sd['code']}-P{i}",
                station_code=sd["code"],
                platform_number=i,
                length_m=length,
                usable_length_m=length - margin,
                clearance_margin_m=margin,
                handles_freight=(i in sd.get("freight", [])),
                resource_type="platform",
            ))
        
        # Dedicated loop lines (720m-750m for holding / overtaking / freight)
        loop_lines = []
        for li in range(1, sd.get("loops", 0) + 1):
            loop_len = 750.0
            margin = 25.0
            loop_lines.append(Platform(
                id=f"{sd['code']}-L{li}",
                station_code=sd["code"],
                platform_number=li,
                length_m=loop_len,
                usable_length_m=loop_len - margin,
                clearance_margin_m=margin,
                handles_freight=True,
                resource_type="loop_line",
            ))

        stations.append(Station(
            code=sd["code"],
            name=sd["name"],
            km=sd["km"],
            platforms=platforms,
            loops=sd["loops"],
            loop_lines=loop_lines,
        ))
    return stations


def generate_sections(stations: list[Station]) -> list[Section]:
    """Generate sections between consecutive stations."""
    sections = []
    for i in range(len(stations) - 1):
        a, b = stations[i], stations[i + 1]
        sections.append(Section(
            from_station=a.code,
            to_station=b.code,
            length_km=b.km - a.km,
            up_line=True,
            dn_line=True,
            max_speed_kmph=130.0 if (b.km - a.km) > 80 else 110.0,
            min_headway_min=5,
        ))
    return sections


def generate_trains(stations: list[Station], base_time: datetime, rng: random.Random) -> list[Train]:
    """Generate the fleet of trains with realistic schedules."""
    station_km = {s.code: s.km for s in stations}
    trains: list[Train] = []
    
    # Stagger departures across the operational window for 60+ trains
    departure_offsets_min = [i * 7 - 180 for i in range(len(TRAIN_TEMPLATES))]
    rng.shuffle(departure_offsets_min)
    
    for idx, (number, name, ttype, direction, stop_codes) in enumerate(TRAIN_TEMPLATES):
        speed = SPEED_PROFILES[ttype]
        offset = departure_offsets_min[idx % len(departure_offsets_min)]
        dep_time = base_time + timedelta(minutes=offset)
        
        stops: list[ScheduledStop] = []
        runtimes: list[SectionRuntime] = []
        current_time = dep_time
        
        for i, code in enumerate(stop_codes):
            if i == 0:
                # Origin: no arrival, departure = current_time
                stops.append(ScheduledStop(
                    station_code=code,
                    arrival=None,
                    departure=current_time,
                    min_dwell_min=0,
                ))
            else:
                prev_code = stop_codes[i - 1]
                dist = abs(station_km[code] - station_km[prev_code])
                
                # Calculate runtime with some randomness
                runtime_min = (dist / speed) * 60
                runtime_min = max(runtime_min, 5)  # minimum 5 minutes
                runtime_min = round(runtime_min + rng.uniform(-2, 3))
                
                runtimes.append(SectionRuntime(
                    from_station=prev_code,
                    to_station=code,
                    runtime_min=runtime_min,
                ))
                
                arrival = current_time + timedelta(minutes=runtime_min)
                
                # Dwell time
                if i == len(stop_codes) - 1:
                    dwell = 0  # terminal
                elif ttype in (TrainType.VANDE_BHARAT, TrainType.RAJDHANI):
                    dwell = rng.choice([1, 2, 2])
                elif ttype in (TrainType.SUPERFAST, TrainType.MAIL_EXPRESS):
                    dwell = rng.choice([2, 3, 5])
                elif ttype == TrainType.PASSENGER:
                    dwell = rng.choice([3, 5, 8, 10])
                else:
                    dwell = rng.choice([5, 10, 15])
                
                departure = arrival + timedelta(minutes=dwell) if i < len(stop_codes) - 1 else None
                
                stops.append(ScheduledStop(
                    station_code=code,
                    arrival=arrival,
                    departure=departure,
                    min_dwell_min=max(1, dwell - 1),
                ))
                
                current_time = departure if departure else arrival
        
        # Configure authoritative coaches and physical train length per train type
        if ttype == TrainType.VANDE_BHARAT:
            coaches = 16
            length_m = 384.0  # 16 coaches @ 24m (Trainset EMU)
        elif ttype == TrainType.RAJDHANI:
            coaches = rng.choice([20, 22])
            length_m = coaches * 24.0 + 22.0  # LHB Coaches + WAP-7 Loco
        elif ttype == TrainType.SUPERFAST:
            coaches = rng.choice([22, 24])
            length_m = coaches * 24.0 + 22.0  # ICF/LHB Coaches + WAP-7
        elif ttype == TrainType.MAIL_EXPRESS:
            coaches = rng.choice([18, 22, 24])
            length_m = coaches * 24.0 + 22.0
        elif ttype == TrainType.PASSENGER:
            coaches = rng.choice([12, 16])
            length_m = coaches * 24.0 + 22.0
        else:  # FREIGHT
            coaches = 58  # 58 BOXN / BCN wagons
            length_m = 685.0  # 58 wagons @ 11.5m + WAG-9 loco + BVZI brake van
        
        trains.append(Train(
            number=number,
            name=name,
            type=ttype,
            priority_weight=PRIORITY_WEIGHTS[ttype],
            direction=direction,
            coaches=coaches,
            length_m=length_m,
            rake_id=f"RAKE-{number}",
            stops=stops,
            section_runtimes=runtimes,
        ))
    
    return trains


def generate_rake_linkages(trains: list[Train], rng: random.Random) -> list[RakeLinkage]:
    """Generate rake linkages for paired trains."""
    linkages: list[RakeLinkage] = []
    paired = {}
    
    for t in trains:
        base = t.number.rstrip("0123456789")[:3] + t.number[-3:]
        if base not in paired:
            paired[base] = t
        else:
            other = paired.pop(base)
            # The train that arrives at terminal becomes the rake for the return
            terminal = t.stops[-1].station_code if t.stops else ""
            linkages.append(RakeLinkage(
                rake_id=f"RAKE-{other.number}",
                current_train=other.number,
                next_train=t.number,
                turnaround_station=terminal,
                min_turnaround_min=rng.choice([20, 30, 45]),
            ))
    
    return linkages


def generate_crew(trains: list[Train], rng: random.Random) -> list[CrewMember]:
    """Generate crew members with realistic duty spreads."""
    crew: list[CrewMember] = []
    crew_id = 1
    base_time = trains[0].stops[0].departure if trains and trains[0].stops else datetime(2025, 1, 15, 5, 0)
    
    # Assign crew to each train
    for train in trains:
        if train.type == TrainType.FREIGHT:
            roles = [CrewRole.LOCO_PILOT, CrewRole.ASST_LOCO_PILOT]
        else:
            roles = [CrewRole.LOCO_PILOT, CrewRole.ASST_LOCO_PILOT, CrewRole.GUARD]
        
        origin = train.stops[0].station_code if train.stops else "NDLS"
        dep_time = train.stops[0].departure or base_time
        
        for role in roles:
            # Realistic initial hours on duty prior to train departure (sign-on, inspection, short prior duty)
            hours = rng.choice([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5])
            duty_start = dep_time - timedelta(hours=hours)
            
            fname = rng.choice(CREW_FIRST_NAMES)
            lname = rng.choice(CREW_LAST_NAMES)
            
            # Route qualifications: sections the crew knows
            qual_stations = [s.station_code for s in train.stops]
            quals = []
            for i in range(len(qual_stations) - 1):
                quals.append(f"{qual_stations[i]}-{qual_stations[i+1]}")
            
            crew.append(CrewMember(
                id=f"CREW-{crew_id:04d}",
                name=f"{fname} {lname}",
                role=role,
                base_station=origin,
                route_qualifications=quals,
                duty_start=duty_start,
                hours_on_duty=hours,
                max_duty_hours=12.0,
                min_rest_hours=8.0,
                assigned_train=train.number,
                is_spare=False,
            ))
            crew_id += 1
    
    # Add spare crew reserves at major crew-change stations
    spare_stations = ["NDLS", "AGC", "GWL", "JHS", "BINA", "BPL"]
    for stn in spare_stations:
        for role in [CrewRole.LOCO_PILOT, CrewRole.LOCO_PILOT, CrewRole.ASST_LOCO_PILOT, CrewRole.ASST_LOCO_PILOT, CrewRole.GUARD, CrewRole.GUARD]:
            fname = rng.choice(CREW_FIRST_NAMES)
            lname = rng.choice(CREW_LAST_NAMES)
            crew.append(CrewMember(
                id=f"CREW-{crew_id:04d}",
                name=f"{fname} {lname}",
                role=role,
                base_station=stn,
                route_qualifications=[],
                duty_start=base_time - timedelta(hours=rng.randint(0, 2)),
                hours_on_duty=rng.uniform(0, 2),
                max_duty_hours=12.0,
                min_rest_hours=8.0,
                assigned_train=None,
                is_spare=True,
            ))
            crew_id += 1
    
    return crew


def generate_passengers(trains: list[Train], rng: random.Random) -> list[PassengerGroup]:
    """Generate 2000-5000 passenger groups."""
    passengers: list[PassengerGroup] = []
    target = rng.randint(2000, 5000)
    pax_id = 1
    
    # Filter non-freight trains
    pax_trains = [t for t in trains if t.type != TrainType.FREIGHT]
    
    while len(passengers) < target:
        train = rng.choice(pax_trains)
        if len(train.stops) < 2:
            continue
        
        # Pick boarding and alighting stations
        stop_indices = list(range(len(train.stops)))
        board_idx = rng.choice(stop_indices[:-1])
        alight_idx = rng.choice(stop_indices[board_idx + 1:])
        
        board_stn = train.stops[board_idx].station_code
        alight_stn = train.stops[alight_idx].station_code
        
        # Some passengers have connections
        connecting = None
        if rng.random() < 0.08:  # 8% have connections
            conn_trains = [t for t in pax_trains 
                          if t.number != train.number 
                          and any(s.station_code == alight_stn for s in t.stops)]
            if conn_trains:
                connecting = rng.choice(conn_trains).number
        
        count = rng.choices(
            [1, 2, 3, 4, 5, 8, 15, 30],
            weights=[30, 25, 15, 10, 8, 5, 4, 3],
            k=1
        )[0]
        
        language = rng.choices(["en", "hi"], weights=[40, 60], k=1)[0]
        
        passengers.append(PassengerGroup(
            id=f"PAX-{pax_id:05d}",
            train_number=train.number,
            boarding_station=board_stn,
            alighting_station=alight_stn,
            count=count,
            connecting_train=connecting,
            language=language,
            contact=f"+91-{rng.randint(70000, 99999):05d}-{rng.randint(10000, 99999):05d}",
        ))
        pax_id += 1
    
    return passengers


def generate_all(seed: int = 42) -> dict[str, Any]:
    """Generate the complete corridor dataset."""
    rng = random.Random(seed)
    random.seed(seed)
    
    base_time = datetime(2025, 1, 15, 5, 0)  # 05:00 on a winter morning
    
    stations = generate_stations(rng)
    sections = generate_sections(stations)
    trains = generate_trains(stations, base_time, rng)
    rake_linkages = generate_rake_linkages(trains, rng)
    crew = generate_crew(trains, rng)
    passengers = generate_passengers(trains, rng)
    
    return {
        "metadata": {
            "seed": seed,
            "generated_at": datetime.now().isoformat(),
            "label": "SIMULATED DATA — North-Central India Corridor",
            "corridor": "New Delhi to Bhopal",
            "window": f"{base_time.strftime('%H:%M')} to {(base_time + timedelta(hours=7)).strftime('%H:%M')}",
        },
        "stations": [s.model_dump() for s in stations],
        "sections": [s.model_dump() for s in sections],
        "trains": [t.model_dump(mode="json") for t in trains],
        "rake_linkages": [r.model_dump() for r in rake_linkages],
        "crew": [c.model_dump(mode="json") for c in crew],
        "passengers": [p.model_dump() for p in passengers],
        "stats": {
            "stations": len(stations),
            "sections": len(sections),
            "trains": len(trains),
            "crew_members": len(crew),
            "passenger_groups": len(passengers),
            "total_passengers": sum(p.count for p in passengers),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Generate RailReplan synthetic data")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    args = parser.parse_args()
    
    data = generate_all(seed=args.seed)
    
    output_path = args.output or str(Path(__file__).parent.parent.parent.parent / "data" / "generated" / f"corridor_seed{args.seed}.json")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    
    stats = data["stats"]
    print(f"✅ Generated corridor data (seed={args.seed}):")
    print(f"   Stations:    {stats['stations']}")
    print(f"   Sections:    {stats['sections']}")
    print(f"   Trains:      {stats['trains']}")
    print(f"   Crew:        {stats['crew_members']}")
    print(f"   Passengers:  {stats['passenger_groups']} groups ({stats['total_passengers']} people)")
    print(f"   Output:      {output_path}")


if __name__ == "__main__":
    main()
