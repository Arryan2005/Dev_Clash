from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class UploadResponse(BaseModel):
    job_id: str
    status: str = "uploaded"

class AnalyzeResponse(BaseModel):
    job_id: str
    status: str = "processing"

class WeakMoment(BaseModel):
    start: int
    end: int
    reason: str

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

class AnalysisResult(BaseModel):
    job_id: str
    status: str = "completed"
    transcript: str = ""
    transcript_summary: TranscriptSummary
    speech_metrics: SpeechMetrics
    scores: Scores
    top_rejection_reasons: List[str]
    weak_moments: List[WeakMoment]
    improvement_plan: List[str]
    summary: str

class FailedResult(BaseModel):
    job_id: str
    status: str = "failed"
    message: str
    details: Optional[str] = None