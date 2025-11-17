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
# Try multiple translation models in order of preference
TRANSLATION_MODELS = [
    "facebook/mbart-large-50-many-to-many-mmt",  # Multilingual model (supports en-ko)
]
TRANSLATION_MODEL = TRANSLATION_MODELS[0]
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
    Tries multiple models in order of preference.
    """
    global _TRANSLATOR_PIPELINE, _TRANSLATOR_UNAVAILABLE
    if _TRANSLATOR_UNAVAILABLE:
        # 재시도 로직: 한 번 실패해도 다시 시도
        logger.info("Retrying translation model load...")
        _TRANSLATOR_UNAVAILABLE = False
    if _TRANSLATOR_PIPELINE is None:
        # Try each model in order
        for model_name in TRANSLATION_MODELS:
            try:
                logger.info(f"Attempting to load translation model: {model_name}")
                _TRANSLATOR_PIPELINE = pipeline(
                    task="translation",
                    model=model_name,
                )
                logger.info(f"Translation model loaded successfully: {model_name}")
                break
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"Failed to load translation model {model_name}: {exc}")
                _TRANSLATOR_PIPELINE = None
                continue
        
        if _TRANSLATOR_PIPELINE is None:
            _TRANSLATOR_UNAVAILABLE = True
            logger.error("All translation models failed to load. Translation will be disabled.")
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
    Translate English text into Korean using deep-translator library.
    Falls back to original text if translation fails.
    """
    if not text:
        return ""

    try:
        from deep_translator import GoogleTranslator
        
        max_length = 500
        text_to_translate = text[:max_length] if len(text) > max_length else text
        
        translator = GoogleTranslator(source='en', target='ko')
        translated = translator.translate(text_to_translate)
        
        if translated and translated != text_to_translate:
            logger.info(f"Translation successful: {text[:50]}... -> {translated[:50]}...")
            return translated
        else:
            logger.warning("Translation returned same text or empty")
            return text
    except ImportError:
        logger.warning("deep-translator not installed, trying alternative methods")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Translation failed: {exc}")
    
    # Fallback: Try googletrans if available
    try:
        from googletrans import Translator
        translator = Translator()
        result = translator.translate(text, src='en', dest='ko')
        if result and result.text:
            logger.info(f"Translation successful (googletrans): {text[:50]}... -> {result.text[:50]}...")
            return result.text
    except ImportError:
        logger.warning("googletrans not installed")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"googletrans translation failed: {exc}")

    # If all else fails, return original text
    logger.warning("All translation methods failed, returning original text")
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

