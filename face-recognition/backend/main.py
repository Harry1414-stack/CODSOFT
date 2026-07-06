"""
Nexoan AI Face Recognition System — FastAPI Backend
"""
import asyncio, base64, threading, glob as glb, json
from pathlib import Path
from typing import List, Optional
from datetime import datetime, date

import cv2, numpy as np
from fastapi import (FastAPI, File, Form, HTTPException,
                     Response, UploadFile, WebSocket, WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from face_engine import FaceEngine

KNOWN_FACES_DIR = Path("known_faces")
PICS_DIR        = Path("../pics")          # relative to backend/
ATTENDANCE_DIR  = Path("attendance_logs")  # new: attendance records
KNOWN_FACES_DIR.mkdir(exist_ok=True)
ATTENDANCE_DIR.mkdir(exist_ok=True)

engine = FaceEngine()


# ── Camera Manager ───────────────────────────────────────────────────────────
class CameraManager:
    def __init__(self):
        self.cap        = None
        self.running    = False
        self._frame     = None
        self._raw_frame = None
        self._detections= []
        self._lock      = threading.Lock()
        self._thread    = None
        self._counter   = 0

    def start(self) -> bool:
        with self._lock:
            if self.running:
                return True

        opened_cap = None
        for backend in (cv2.CAP_DSHOW, cv2.CAP_ANY):
            cap = cv2.VideoCapture(0, backend)
            if cap.isOpened():
                opened_cap = cap
                break
        if not opened_cap:
            return False

        try:
            opened_cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            opened_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            opened_cap.set(cv2.CAP_PROP_FPS,          30)
        except Exception:
            pass  # Some cameras reject property changes — not fatal

        with self._lock:
            if self.running:
                opened_cap.release()
                return True
            self.cap = opened_cap
            self.running = True
            self._counter = 0  # reset frame counter
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            engine.clear_results()  # wipe stale results before new session
            return True

    def stop(self):
        with self._lock:
            if not self.running:
                return
            self.running = False

        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

        with self._lock:
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None
            self._frame      = None
            self._raw_frame  = None
            self._detections = []
        # Wipe any stale recognition data so next person starts fresh
        engine.clear_results()

    def _loop(self):
        import time
        while True:
            with self._lock:
                if not self.running:
                    break
                cap = self.cap
            if not cap:
                break
            try:
                ret, raw = cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue
                self._counter += 1
                # Submit frame to background recognition worker — never blocks
                if self._counter % 8 == 0:
                    engine.submit_frame(raw)
                # Annotate with latest available results (from the worker thread)
                cached = engine.get_last_results()
                annotated = engine.draw_annotations(raw.copy(), cached)
                with self._lock:
                    self._frame      = annotated
                    self._raw_frame  = raw.copy()
                    self._detections = cached
            except Exception as e:
                logger.warning(f"Camera loop error (continuing): {e}")
                time.sleep(0.05)


    def get_jpeg(self):
        with self._lock:
            if self._frame is None:
                return None
            ok, buf = cv2.imencode(".jpg", self._frame, [cv2.IMWRITE_JPEG_QUALITY, 78])
            return buf.tobytes() if ok else None

    def get_raw_jpeg(self):
        with self._lock:
            if self._raw_frame is None:
                return None
            ok, buf = cv2.imencode(".jpg", self._raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            return buf.tobytes() if ok else None

    def get_detections(self):
        with self._lock:
            return list(self._detections)

camera = CameraManager()


# ── FastAPI ──────────────────────────────────────────────────────────────────
app = FastAPI(title="Nexoan AI Face Recognition", version="2.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

app.mount("/known_faces", StaticFiles(directory="known_faces"), name="known_faces")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status":            "ok",
        "company":           "Nexoan AI",
        "face_rec_available": engine.face_rec_available,
        "registered_people": len(engine.get_known_people()),
    }


# ── Camera ────────────────────────────────────────────────────────────────────
@app.post("/api/camera/start")
def camera_start():
    if not camera.start():
        raise HTTPException(500, "Cannot open webcam")
    return {"status": "started"}

@app.post("/api/camera/stop")
def camera_stop():
    camera.stop()
    return {"status": "stopped"}

@app.get("/api/camera/status")
def camera_status():
    return {"running": camera.running}

@app.get("/api/camera/capture")
def camera_capture():
    if not camera.running:
        if not camera.start():
            raise HTTPException(500, "Cannot start camera")
        import time
        time.sleep(0.8) # Allow camera sensor to warm up/adjust exposure
    
    for _ in range(15):
        frame = camera.get_raw_jpeg()
        if frame:
            return Response(content=frame, media_type="image/jpeg")
        import time
        time.sleep(0.1)
        
    raise HTTPException(503, "Camera feed not ready")

@app.get("/api/video-feed")
def video_feed():
    def generate():
        camera.start()
        try:
            while camera.running:
                frame = camera.get_jpeg()
                if frame:
                    yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                import time
                time.sleep(0.03)
        except Exception:
            pass
    return StreamingResponse(generate(),
                             media_type="multipart/x-mixed-replace; boundary=frame")


# ── WebSocket — live detections ───────────────────────────────────────────────
@app.websocket("/ws/detections")
async def ws_detections(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json({
                "detections": camera.get_detections(),
                "camera_on":  camera.running,
            })
            await asyncio.sleep(0.15)
    except WebSocketDisconnect:
        pass


# ── Known Faces ───────────────────────────────────────────────────────────────
@app.get("/api/known-faces")
def list_known_faces():
    return engine.get_known_people()

@app.post("/api/register")
async def register_face(
    name:        str = Form(...),
    employee_id: str = Form(""),
    role:        str = Form(""),
    department:  str = Form(""),
    company:     str = Form("Nexoan AI"),
    files: List[UploadFile] = File(...),
):
    name = name.strip()
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    saved = 0
    for f in files:
        data = await f.read()
        if engine.register_face(name, data, employee_id, role, department, company):
            saved += 1
    if saved == 0:
        raise HTTPException(400, "No valid face images saved")
    return {"message": f"Registered {saved} photo(s) for '{name}'",
            "name": name, "count": saved}

@app.delete("/api/known-faces/{name}")
def delete_face(name: str):
    if engine.delete_person(name):
        return {"message": f"Deleted '{name}'"}
    raise HTTPException(404, "Person not found")

@app.get("/api/known-faces/{name}/photo")
def person_photo(name: str):
    d = KNOWN_FACES_DIR / name
    if not d.is_dir():
        raise HTTPException(404, "Not found")
    photos = sorted(list(d.glob("photo_*.jpg")) + list(d.glob("*.jpeg")) + list(d.glob("*.png")))
    if not photos:
        raise HTTPException(404, "No photos")
    with open(photos[0], "rb") as fh:
        return Response(content=fh.read(), media_type="image/jpeg")

@app.get("/api/known-faces/{name}/metadata")
def person_metadata(name: str):
    d = KNOWN_FACES_DIR / name
    if not d.is_dir():
        raise HTTPException(404, "Not found")
    meta_path = d / "metadata.json"
    if meta_path.exists():
        import json
        with open(meta_path) as f:
            return json.load(f)
    return {"name": name, "company": "Nexoan AI"}


# ── Import from pics/ folder ──────────────────────────────────────────────────
@app.get("/api/pics")
def list_pics():
    """List image files available in the pics/ folder."""
    if not PICS_DIR.exists():
        return {"files": [], "path": str(PICS_DIR.resolve())}
    exts = ("*.jpg","*.jpeg","*.png","*.webp","*.bmp")
    files = []
    for ext in exts:
        files += [p.name for p in PICS_DIR.glob(ext)]
    return {"files": sorted(files), "path": str(PICS_DIR.resolve())}

@app.post("/api/import-pics")
async def import_from_pics(
    name:        str = Form(...),
    employee_id: str = Form(""),
    role:        str = Form(""),
    department:  str = Form(""),
    company:     str = Form("Nexoan AI"),
):
    """Register all images in the pics/ folder as one person."""
    name = name.strip()
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    if not PICS_DIR.exists():
        raise HTTPException(404, "pics/ folder not found")

    exts = ("*.jpg","*.jpeg","*.png","*.webp","*.bmp")
    saved = 0
    for ext in exts:
        for img_path in sorted(PICS_DIR.glob(ext)):
            with open(img_path, "rb") as fh:
                data = fh.read()
            if engine.register_face(name, data, employee_id, role, department, company):
                saved += 1

    if saved == 0:
        raise HTTPException(400, "No images found in pics/ folder")
    return {"message": f"Imported {saved} photo(s) for '{name}'",
            "name": name, "count": saved}


# ── Recognize static image ────────────────────────────────────────────────────
@app.post("/api/recognize")
async def recognize_image(file: UploadFile = File(...)):
    data = await file.read()
    arr  = np.frombuffer(data, np.uint8)
    img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image")
    results  = engine.recognize_faces(img)
    annotated= engine.draw_annotations(img.copy(), results)
    _, buf = cv2.imencode(".jpg", annotated)
    b64    = base64.b64encode(buf.tobytes()).decode()
    return {"detections": results,
            "annotated_image": f"data:image/jpeg;base64,{b64}",
            "face_count": len(results)}


# ── Attendance Tracking ───────────────────────────────────────────────────────
@app.post("/api/mark-attendance")
async def mark_attendance(data: dict):
    """Mark an employee as present."""
    name = data.get('name', '').strip()
    employee_id = data.get('employee_id', '').strip()
    timestamp = data.get('timestamp', '')
    
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    
    # Get today's attendance log file
    today = date.today().isoformat()  # YYYY-MM-DD
    log_file = ATTENDANCE_DIR / f"attendance_{today}.json"
    
    # Load existing records
    records = []
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except:
            records = []
    
    # Check if already marked today
    already_marked = any(r["name"].lower() == name.lower() for r in records)
    if already_marked:
        return {"status": "already_marked", "message": f"{name} already marked present today"}
    
    # Add new record with exact timing details
    now = datetime.now()
    record = {
        "name":        name,
        "employee_id": employee_id,
        "timestamp":   timestamp,
        "marked_at":   now.isoformat(),
        "date":        now.strftime("%d-%m-%Y"),      # DD-MM-YYYY
        "day":         now.strftime("%A"),             # Day Name
        "month":       now.strftime("%B"),           # Month Name
        "year":        now.strftime("%Y"),             # Year
        "time":        now.strftime("%I:%M:%S %p")    # Exact Timing (12-hour with AM/PM)
    }
    records.append(record)
    
    # Save updated records
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    
    return {"status": "success", "message": f"{name} marked present", "record": record}


@app.get("/api/attendance-today")
def get_today_attendance():
    """Get today's attendance records."""
    today = date.today().isoformat()
    log_file = ATTENDANCE_DIR / f"attendance_{today}.json"
    
    if not log_file.exists():
        return {"date": today, "records": []}
    
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        return {"date": today, "records": records}
    except:
        return {"date": today, "records": []}


@app.get("/api/attendance/{date_str}")
def get_attendance_by_date(date_str: str):
    """Get attendance records for a specific date (YYYY-MM-DD)."""
    log_file = ATTENDANCE_DIR / f"attendance_{date_str}.json"
    
    if not log_file.exists():
        return {"date": date_str, "records": []}
    
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        return {"date": date_str, "records": records}
    except:
        return {"date": date_str, "records": []}


@app.delete("/api/attendance/clear")
def clear_attendance_history():
    """Clear all attendance logs."""
    try:
        import os
        for file_path in ATTENDANCE_DIR.glob("attendance_*.json"):
            os.remove(file_path)
        return {"status": "success", "message": "All attendance logs cleared successfully"}
    except Exception as e:
        raise HTTPException(500, f"Error clearing logs: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
