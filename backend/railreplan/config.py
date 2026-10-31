"""Configuration loader for RailReplan."""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

import yaml
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = PROJECT_ROOT / "config.yaml"


@lru_cache(maxsize=1)
def load_config() -> dict:
    """Load and cache the YAML configuration."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_groq_api_key() -> str | None:
    return os.getenv("GROQ_API_KEY") or None


def get_groq_model() -> str:
    return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def get_serper_api_key() -> str | None:
    return os.getenv("SERPER_API_KEY") or None


def get_serper_budget() -> int:
    return int(os.getenv("SERPER_BUDGET", "100"))


def is_llm_available() -> bool:
    key = get_groq_api_key()
    return bool(key and len(key) > 10)


def is_search_available() -> bool:
    key = get_serper_api_key()
    return bool(key and len(key) > 10)
