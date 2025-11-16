"""
AI utility functions for the Breaking Share homepage.

This module exposes two primary helpers:
1. summarize_headline: uses a Korean text summarization transformer pipeline.
2. rank_recommendations: scores stock candidates based on simple weighted factors.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Mapping, Sequence

import numpy as np
import pandas as pd
import logging
from transformers import pipeline

SUMMARIZER_MODEL = "lcw99/t5-base-korean-text-summary"
TRANSLATION_MODEL = "Helsinki-NLP/opus-mt-en-ko"
_DEFAULT_MAX_TOKENS = 180
_DEFAULT_MIN_TOKENS = 45

logger = logging.getLogger(__name__)
_TRANSLATOR_PIPELINE = None
_TRANSLATOR_UNAVAILABLE = False


@lru_cache(maxsize=1)
def _get_summarizer():
    """
    Lazily load the summarization pipeline once per process.

    The model is small enough to run on CPU for prototyping,
    but you can set the `device` argument to leverage GPU when available.
    """
    return pipeline(
        task="summarization",
        model=SUMMARIZER_MODEL,
        tokenizer=SUMMARIZER_MODEL,
    )


def _get_translator():
    """
    Lazily load the English→Korean translation pipeline once per process.
    """
    global _TRANSLATOR_PIPELINE, _TRANSLATOR_UNAVAILABLE
    if _TRANSLATOR_UNAVAILABLE:
        return None
    if _TRANSLATOR_PIPELINE is None:
        try:
            _TRANSLATOR_PIPELINE = pipeline(
                task="translation",
                model=TRANSLATION_MODEL,
                tokenizer=TRANSLATION_MODEL,
            )
        except Exception as exc:  # noqa: BLE001
            _TRANSLATOR_UNAVAILABLE = True
            logger.warning("Translation model unavailable (%s): %s", TRANSLATION_MODEL, exc)
            return None
    return _TRANSLATOR_PIPELINE


def summarize_headline(text: str, max_tokens: int = _DEFAULT_MAX_TOKENS) -> str:
    """
    Summarize a Korean headline or paragraph into a concise briefing.

    Args:
        text: Raw news headline or paragraph.
        max_tokens: Upper bound for generated summary tokens.

    Returns:
        A summarized string in Korean.
    """
    if not text:
        return ""

    summarizer = _get_summarizer()
    output = summarizer(
        text,
        max_length=max_tokens,
        min_length=min(_DEFAULT_MIN_TOKENS, max_tokens // 2),
        do_sample=False,
    )
    return output[0]["summary_text"]


def translate_to_korean(text: str) -> str:
    """
    Translate English text into Korean using a neural machine translation model.

    Empty inputs are returned as empty strings to avoid unnecessary inference.
    """
    if not text:
        return ""

    translator = _get_translator()
    if translator is None:
        return text

    try:
        output = translator(text, clean_up_tokenization_spaces=True)
        return output[0]["translation_text"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Translation failed, returning original text: %s", exc)
        return text


def _normalize_series(series: pd.Series) -> pd.Series:
    """
    Normalize a pandas Series to z-scores, guard against division by zero.
    """
    if series.std(ddof=0) == 0:
        return pd.Series(np.zeros(len(series)), index=series.index)
    return (series - series.mean()) / series.std(ddof=0)


def rank_recommendations(
    candidates: Sequence[Mapping[str, float]],
    weights: Mapping[str, float] | None = None,
) -> List[Mapping[str, float]]:
    """
    Rank stock candidates using a simple weighted score model.

    Args:
        candidates: Iterable of dictionaries with numeric factors, e.g.
            [{"ticker": "NVDA", "eps_growth": 0.32, "momentum": 0.65, "institutional_inflow": 0.4}, ...]
        weights: Optional weight dictionary for each factor (excluding ticker).

    Returns:
        List of candidate dicts sorted by score (descending). The score is appended as the `composite_score`.
    """
    if not candidates:
        return []

    # Convert to DataFrame for easier manipulation
    frame = pd.DataFrame(candidates).copy()
    if "ticker" not in frame.columns:
        raise ValueError("Each candidate must include a 'ticker' key.")

    numeric_cols = frame.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        raise ValueError("At least one numeric factor is required to rank recommendations.")

    normalized = frame[numeric_cols].apply(_normalize_series)

    if weights is None:
        weights = {col: 1.0 for col in numeric_cols}

    missing_weights = set(numeric_cols) - set(weights)
    if missing_weights:
        raise ValueError(f"Missing weights for factors: {', '.join(sorted(missing_weights))}")

    weight_vector = np.array([weights[col] for col in numeric_cols])
    scores = normalized.to_numpy() @ weight_vector
    frame["composite_score"] = scores

    ordered = frame.sort_values("composite_score", ascending=False)
    return ordered.to_dict(orient="records")

