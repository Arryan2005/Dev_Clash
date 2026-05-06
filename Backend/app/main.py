import os
import uuid
import shutil
import threading
import math
from typing import Union
from fastapi import APIRouter, FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.schemas import UploadResponse, AnalyzeResponse, AnalysisResult, FailedResult
from app.storage import JOB_STORE
from app.services import analyze_interview, transcribe_file

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../Easiest Work"))

api = APIRouter(prefix="/api")

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".webm", ".mp4", ".mov", ".avi", ".mkv", ".mpeg", ".mpg", ".aac"
}

app = FastAPI(
    title="IRAS Backend - Real AI Version",
    description="Interview Rejection Analysis System with real transcription + real analysis",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def validate_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {allowed}"
        )
    return ext

@api.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    role: str = Form(...)
):
    validate_extension(file.filename)

    job_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    saved_name = f"{job_id}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    JOB_STORE[job_id] = {
        "job_id": job_id,
        "status": "uploaded",
        "role": role,
        "original_filename": file.filename,
        "file_path": saved_path,
        "result": None,
        "error": None
    }

    return UploadResponse(job_id=job_id, status="uploaded")

def _run_analysis(job_id: str):
    job = JOB_STORE.get(job_id)
    if not job:
        return

    try:
        job["status"] = "processing"

        result = analyze_interview(
            input_path=job["file_path"],
            role=job["role"],
            job_id=job_id
        )

        job["status"] = "completed"
        job["result"] = result

    except Exception as e:
        job["status"] = "failed"
        job["error"] = {
            "job_id": job_id,
            "status": "failed",
            "message": "Analysis failed",
            "details": str(e)
        }

@api.post("/analyze/{job_id}", response_model=AnalyzeResponse)
def start_analysis(job_id: str):
    job = JOB_STORE.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "processing":
        return AnalyzeResponse(job_id=job_id, status="processing")

    thread = threading.Thread(target=_run_analysis, args=(job_id,), daemon=True)
    thread.start()

    return AnalyzeResponse(job_id=job_id, status="processing")

@api.get("/result/{job_id}", response_model=Union[AnalysisResult, FailedResult, dict])
def get_result(job_id: str):
    job = JOB_STORE.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "uploaded":
        return {"status": "queued"}

    if job["status"] == "processing":
        return {"status": "processing"}

    if job["status"] == "failed":
        return job["error"]

    return job["result"]

@api.post("/transcribe")
async def transcribe_only(file: UploadFile = File(...)):
    """
    Transcribes audio and returns timestamped text.
    No scoring or analysis — just raw transcript.
    """
    validate_extension(file.filename)

    job_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    saved_name = f"tx_{job_id}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        tx = transcribe_file(saved_path)
        segments = tx.get("segments", [])
        duration_sec = tx.get("duration_sec", 0)

        lines = []
        for seg in segments:
            start = int(seg.get("start", 0))
            text = seg.get("text", "").strip()
            if text:
                mins = start // 60
                secs = start % 60
                timestamp = f"[{mins:02d}:{secs:02d}]"
                lines.append(f"{timestamp} {text}")

        transcript_text = "\n".join(lines) if lines else tx.get("text", "")

        return {
            "status": "completed",
            "transcript": transcript_text,
            "duration_sec": duration_sec,
            "word_count": len(tx.get("text", "").split())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(saved_path):
            os.remove(saved_path)


app.include_router(api)

if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")