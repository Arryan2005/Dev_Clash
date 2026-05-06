from typing import Dict, Optional, Any
from pydantic import BaseModel

class TranscriptSummary(BaseModel):
    duration_sec: int
    word_count: int

class SpeechMetrics(BaseModel):
    wpm: int
    pace_label: str
    filler_count: int
    top_fillers: Dict[str, int]
    long_pauses: int
    avg_pause_sec: float

class Scores(BaseModel):
    overall: int
    clarity: int
    relevance: int
    specificity: int
    confidence: int

class WeakMoment(BaseModel):
    start: int
    end: int
    reason: str

class AnalysisResult(BaseModel):
    job_id: str
    transcript_summary: TranscriptSummary
    speech_metrics: SpeechMetrics
    scores: Scores
    top_rejection_reasons: list[str]
    weak_moments: list[WeakMoment]
    improvement_plan: list[str]
    summary: str

class JobRecord(BaseModel):
    job_id: str
    status: str
    role: str
    filename: str
    file_path: str
    content_type: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None