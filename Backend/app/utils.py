import os
import uuid
import json
import shutil
import subprocess
from pathlib import Path

UPLOAD_DIR = Path("uploads")
TEMP_AUDIO_DIR = Path("temp_audio")

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".webm", ".mp4", ".mov", ".avi", ".mkv", ".mpeg", ".mpg", ".aac"
}

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".aac"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".mpeg", ".mpg"}

def ensure_dirs():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

def generate_job_id() -> str:
    return str(uuid.uuid4())

def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()

def is_allowed_file(filename: str) -> bool:
    return get_file_extension(filename) in ALLOWED_EXTENSIONS

def safe_filename(filename: str) -> str:
    base = os.path.basename(filename).replace(" ", "_")
    return f"{uuid.uuid4().hex[:8]}_{base}"

def clamp(value: float, min_value: int = 0, max_value: int = 100) -> int:
    return int(max(min_value, min(max_value, round(value))))

def is_video_file(file_path: str) -> bool:
    ext = Path(file_path).suffix.lower()
    return ext in VIDEO_EXTENSIONS

def is_audio_file(file_path: str) -> bool:
    ext = Path(file_path).suffix.lower()
    return ext in AUDIO_EXTENSIONS

def extract_audio_from_video(input_path: str) -> str:
    """
    Converts video to mono 16k WAV for Whisper.
    Requires ffmpeg installed and available in PATH.
    """
    input_path_obj = Path(input_path)
    output_path = TEMP_AUDIO_DIR / f"{input_path_obj.stem}_audio.wav"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr}")

    return str(output_path)

def normalize_audio_for_whisper(input_path: str) -> str:
    """
    Converts any audio file to mono 16k WAV for better Whisper compatibility.
    """
    input_path_obj = Path(input_path)
    output_path = TEMP_AUDIO_DIR / f"{input_path_obj.stem}_normalized.wav"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio normalization failed: {result.stderr}")

    return str(output_path)

def prepare_audio_for_analysis(file_path: str) -> str:
    """
    Returns a clean WAV audio path suitable for Whisper.
    """
    if is_video_file(file_path):
        return extract_audio_from_video(file_path)
    return normalize_audio_for_whisper(file_path)

def get_media_duration_seconds(file_path: str) -> int:
    """
    Uses ffprobe to get exact media duration.
    Requires ffmpeg installed.
    """
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    data = json.loads(result.stdout)
    duration = float(data["format"]["duration"])
    return max(1, int(round(duration)))

def cleanup_temp_file(file_path: str):
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
    except Exception:
        pass