import os
import re
import math
import shutil
import tempfile
import subprocess
from collections import Counter
from typing import Dict, Any, List
import whisper

WHISPER_MODEL = whisper.load_model("tiny")
FILLER_WORDS = [
    "um", "uh", "like", "actually", "basically", "you know",
    "so", "well", "hmm", "kind of", "sort of", "literally"
]

def extract_audio_to_wav(input_path: str) -> str:
    """
    Converts any supported audio/video file into mono 16k WAV for Whisper.
    Requires ffmpeg installed and available in PATH.
    """
    temp_dir = tempfile.mkdtemp(prefix="iras_audio_")
    output_wav = os.path.join(temp_dir, "audio.wav")

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        output_wav
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0 or not os.path.exists(output_wav):
        stderr = result.stderr.strip() if result.stderr else "Unknown ffmpeg error"
        raise RuntimeError(f"FFmpeg conversion failed: {stderr}")

    return output_wav

def transcribe_file(input_path: str) -> Dict[str, Any]:
    """
    Real transcription using Whisper after converting to WAV.
    Returns transcript text + metadata.
    """
    wav_path = extract_audio_to_wav(input_path)

    try:
        result = WHISPER_MODEL.transcribe(wav_path)
        text = (result.get("text") or "").strip()
        segments = result.get("segments") or []

        duration_sec = 0
        if segments:
            duration_sec = int(math.ceil(segments[-1].get("end", 0)))

        if duration_sec <= 0:
            duration_sec = 60

        return {
            "text": text,
            "segments": segments,
            "duration_sec": duration_sec
        }

    finally:
        temp_dir = os.path.dirname(wav_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

def clean_words(text: str) -> List[str]:
    return re.findall(r"\b[\w']+\b", text.lower())


def count_fillers(text: str) -> Dict[str, int]:
    lowered = text.lower()
    counts = {}

    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        matches = re.findall(pattern, lowered)
        if matches:
            counts[filler] = len(matches)

    return counts

def estimate_long_pauses(segments: List[Dict[str, Any]], threshold: float = 1.8) -> Dict[str, Any]:
    """
    Estimate long pauses from Whisper segment gaps.
    """
    if not segments or len(segments) < 2:
        return {"long_pauses": 0, "avg_pause_sec": 0.0, "pause_windows": []}

    pauses = []
    pause_windows = []

    for i in range(1, len(segments)):
        prev_end = float(segments[i - 1].get("end", 0))
        curr_start = float(segments[i].get("start", 0))
        gap = max(0.0, curr_start - prev_end)

        if gap >= threshold:
            pauses.append(gap)
            pause_windows.append({
                "start": int(prev_end),
                "end": int(curr_start),
                "duration": round(gap, 2)
            })

    avg_pause = round(sum(pauses) / len(pauses), 2) if pauses else 0.0

    return {
        "long_pauses": len(pauses),
        "avg_pause_sec": avg_pause,
        "pause_windows": pause_windows
    }

def pace_label_from_wpm(wpm: int) -> str:
    if wpm < 110:
        return "slow"
    elif wpm <= 165:
        return "balanced"
    return "fast"

def clamp_score(n: float) -> int:
    return max(0, min(100, int(round(n))))

def score_clarity(text: str, filler_count: int, long_pauses: int) -> int:
    base = 78
    penalty = filler_count * 1.5 + long_pauses * 2
    if len(text.split()) < 80:
        penalty += 8
    return clamp_score(base - penalty)

def score_relevance(text: str, role: str) -> int:
    role_keywords = {
        "data_scientist": ["data", "model", "analysis", "python", "sql", "machine learning", "experiment"],
        "software_engineer": ["system", "api", "backend", "frontend", "database", "performance", "debug"],
        "product_manager": ["user", "roadmap", "metric", "stakeholder", "launch", "impact"],
        "marketing": ["campaign", "growth", "conversion", "brand", "audience", "engagement"],
        "sales": ["client", "revenue", "deal", "pipeline", "target", "conversion"],
        "finance": ["budget", "forecast", "analysis", "revenue", "cost", "margin"],
        "designer": ["user", "prototype", "design", "research", "usability", "iteration"],
        "general": ["team", "project", "problem", "result", "experience"]
    }

    lowered = text.lower()
    keywords = role_keywords.get(role, role_keywords["general"])
    hits = sum(1 for kw in keywords if kw in lowered)

    base = 50 + hits * 7
    return clamp_score(base)

def score_specificity(text: str) -> int:
    """
    Reward numbers, concrete outcomes, action verbs.
    """
    lowered = text.lower()
    number_hits = len(re.findall(r"\b\d+[%]?\b", lowered))
    action_hits = sum(1 for w in ["built", "led", "improved", "reduced", "increased", "optimized", "designed", "shipped"] if w in lowered)

    base = 42 + number_hits * 8 + action_hits * 5
    if len(text.split()) < 80:
        base -= 8

    return clamp_score(base)

def score_confidence(filler_count: int, long_pauses: int, wpm: int) -> int:
    base = 80
    penalty = filler_count * 1.2 + long_pauses * 3

    if wpm < 105:
        penalty += 6
    elif wpm > 180:
        penalty += 5

    return clamp_score(base - penalty)

def generate_rejection_reasons(clarity: int, relevance: int, specificity: int, confidence: int, filler_count: int, long_pauses: int) -> List[str]:
    reasons = []

    if specificity < 60:
        reasons.append("Answers were generic and lacked concrete examples or measurable impact.")

    if confidence < 60:
        reasons.append("Hesitation and pauses reduced perceived confidence during important responses.")

    if clarity < 65:
        reasons.append("Frequent filler words and uneven delivery made some answers less clear.")

    if relevance < 60:
        reasons.append("Several responses did not strongly align with what the role expects.")

    if filler_count > 15:
        reasons.append("High filler word frequency weakened answer polish and executive presence.")

    if long_pauses >= 4:
        reasons.append("Multiple long pauses suggested uncertainty or weak preparation.")

    if not reasons:
        reasons.append("Overall performance was decent, but stronger examples and sharper delivery would improve selection chances.")

    return reasons[:3]

def generate_weak_moments(segments: List[Dict[str, Any]], pause_windows: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    weak = []

    for p in pause_windows[:2]:
        weak.append({
            "start": p["start"],
            "end": p["end"],
            "reason": f"Long pause of {p['duration']}s before continuing the answer."
        })

    filler_total = sum(count_fillers(text).values())
    if filler_total > 10:
        weak.append({
            "start": 20,
            "end": 45,
            "reason": "High filler word usage likely reduced clarity and confidence."
        })

    return weak[:3]

def generate_improvement_plan(role: str, clarity: int, relevance: int, specificity: int, confidence: int) -> List[str]:
    plan = []

    if specificity < 70:
        plan.append("Use STAR format and include numbers, outcomes, and ownership in every major answer.")

    if clarity < 70:
        plan.append("Practice concise speaking drills to reduce filler words and improve sentence structure.")

    if confidence < 70:
        plan.append("Rehearse 5 core interview answers aloud to reduce hesitation and long pauses.")

    if relevance < 70:
        plan.append(f"Tailor examples more tightly to the {role.replace('_', ' ')} role expectations.")

    if not plan:
        plan.append("Maintain your strengths and refine your strongest stories with sharper metrics and outcomes.")

    return plan[:4]

def generate_summary(overall: int, clarity: int, relevance: int, specificity: int, confidence: int) -> str:
    weakest = {
        "clarity": clarity,
        "relevance": relevance,
        "specificity": specificity,
        "confidence": confidence
    }
    weakest_area = min(weakest, key=weakest.get)

    return (
        f"Your interview performance scored {overall}/100 overall. "
        f"Your weakest area was {weakest_area}, which likely had the biggest impact on interviewer perception. "
        f"Improving answer specificity, reducing hesitation, and aligning examples more tightly to the role can significantly increase your chances in future interviews."
    )

def analyze_interview(input_path: str, role: str, job_id: str) -> Dict[str, Any]:
    """
    Full pipeline that returns EXACT frontend-compatible schema.
    """
    tx = transcribe_file(input_path)
    text = tx["text"]
    segments = tx["segments"]
    duration_sec = tx["duration_sec"]

    words = clean_words(text)
    word_count = len(words)

    if duration_sec <= 0:
        duration_sec = 60

    wpm = int(round((word_count / max(duration_sec, 1)) * 60))
    fillers = count_fillers(text)
    filler_count = sum(fillers.values())

    pause_info = estimate_long_pauses(segments)
    long_pauses = pause_info["long_pauses"]
    avg_pause_sec = pause_info["avg_pause_sec"]
    pause_windows = pause_info["pause_windows"]

    clarity = score_clarity(text, filler_count, long_pauses)
    relevance = score_relevance(text, role)
    specificity = score_specificity(text)
    confidence = score_confidence(filler_count, long_pauses, wpm)

    overall = clamp_score((clarity + relevance + specificity + confidence) / 4)

    result = {
        "job_id": job_id,
        "status": "completed",
        "transcript_summary": {
            "duration_sec": duration_sec,
            "word_count": word_count
        },
        "speech_metrics": {
            "wpm": wpm,
            "pace_label": pace_label_from_wpm(wpm),
            "filler_count": filler_count,
            "top_fillers": dict(Counter(fillers).most_common(4)),
            "long_pauses": long_pauses,
            "avg_pause_sec": avg_pause_sec
        },
        "scores": {
            "overall": overall,
            "clarity": clarity,
            "relevance": relevance,
            "specificity": specificity,
            "confidence": confidence
        },
        "top_rejection_reasons": generate_rejection_reasons(
            clarity, relevance, specificity, confidence, filler_count, long_pauses
        ),
        "weak_moments": generate_weak_moments(segments, pause_windows, text),
        "improvement_plan": generate_improvement_plan(
            role, clarity, relevance, specificity, confidence
        ),
        "summary": generate_summary(overall, clarity, relevance, specificity, confidence)
    }

    return result