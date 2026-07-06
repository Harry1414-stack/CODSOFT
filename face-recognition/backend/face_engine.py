"""
Face Detection & Recognition Engine — DeepFace backend
Supports: employee metadata (name, ID, role, department, company)
"""

import cv2
import json
import numpy as np
import threading
import shutil
import logging
import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

KNOWN_FACES_DIR = Path("known_faces")

try:
    from deepface import DeepFace
    DEEPFACE_OK = True
    logger.info("✅ DeepFace loaded")
except ImportError:
    DEEPFACE_OK = False
    logger.warning("⚠️  DeepFace not found — Haar cascade fallback")

MODEL_NAME       = "Facenet512"
DETECTOR_BACKEND = "ssd"
THRESHOLD        = 0.40
MIN_FACE_PX      = 60   # ignore faces smaller than this (width or height)
DETECT_W         = 640  # native camera width
DETECT_H         = 480  # native camera height


# ── Model warm-up ────────────────────────────────────────────────────────────

def _warmup_deepface():
    """Run a dummy inference so TF/Keras weights are loaded before any real request."""
    if not DEEPFACE_OK:
        return
    try:
        dummy = np.zeros((160, 160, 3), dtype=np.uint8)
        DeepFace.represent(
            img_path=dummy,
            model_name=MODEL_NAME,
            detector_backend="skip",
            enforce_detection=False,
        )
        logger.info("✅ DeepFace model pre-warmed")
    except Exception as e:
        logger.warning(f"Warm-up failed (non-fatal): {e}")


_warmup_thread = threading.Thread(target=_warmup_deepface, daemon=True)
_warmup_thread.start()


class FaceEngine:
    def __init__(self):
        self.known_names: list      = []
        self.known_metadata: dict   = {}
        self._emb_matrix: Optional[np.ndarray] = None  # (N, D) float32 matrix
        self._lock = threading.Lock()
        KNOWN_FACES_DIR.mkdir(exist_ok=True)

        # Recognition runs in a dedicated thread — never blocks the camera loop
        self._rec_lock     = threading.Lock()
        self._rec_frame    = None          # latest frame waiting to be processed
        self._rec_results  = []            # most recent results from rec thread
        self._rec_pending  = threading.Event()
        self._rec_thread   = threading.Thread(target=self._recognition_worker, daemon=True)
        self._rec_thread.start()

        # Load embeddings (fast: cache hit reads JSON, no DeepFace calls)
        self.load_embeddings()

    # ── Metadata helpers ─────────────────────────────────────────────────────

    def _load_meta(self, person_dir: Path) -> dict:
        meta_path = person_dir / "metadata.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"name": person_dir.name, "company": "Nexoan AI"}

    def _save_meta(self, person_dir: Path, meta: dict):
        meta_path = person_dir / "metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

    # ── Embedding management ─────────────────────────────────────────────────

    def load_embeddings(self):
        embeddings, names, metadata_map = [], [], {}

        if not KNOWN_FACES_DIR.exists() or not DEEPFACE_OK:
            with self._lock:
                self.known_names    = []
                self.known_metadata = {}
                self._emb_matrix    = None
            return

        for person_dir in sorted(KNOWN_FACES_DIR.iterdir()):
            if not person_dir.is_dir():
                continue
            name = person_dir.name
            meta = self._load_meta(person_dir)
            metadata_map[name] = meta

            cache_path = person_dir / "embeddings.json"
            cache = {}
            if cache_path.exists():
                try:
                    with open(cache_path, "r", encoding="utf-8") as f:
                        cache = json.load(f)
                except Exception:
                    cache = {}

            cache_dirty = False
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
                for img_path in sorted(person_dir.glob(ext)):
                    img_name = img_path.name
                    vec_list = cache.get(img_name)
                    if vec_list is not None:
                        # Cache hit — instant
                        embeddings.append(np.array(vec_list, dtype=np.float32))
                        names.append(name)
                    else:
                        # Cache miss — compute and persist
                        try:
                            result = DeepFace.represent(
                                img_path=str(img_path),
                                model_name=MODEL_NAME,
                                detector_backend=DETECTOR_BACKEND,
                                enforce_detection=False,
                            )
                            if result:
                                vec = np.array(result[0]["embedding"], dtype=np.float32)
                                vec /= (np.linalg.norm(vec) + 1e-8)
                                embeddings.append(vec)
                                names.append(name)
                                cache[img_name] = vec.tolist()
                                cache_dirty = True
                        except Exception as e:
                            logger.warning(f"Could not encode {img_path}: {e}")

            if cache_dirty:
                try:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(cache, f, indent=2)
                except Exception as e:
                    logger.warning(f"Could not save cache to {cache_path}: {e}")

        # Build a pre-compiled (N, D) numpy matrix for fast vectorised cosine sim
        matrix = np.array(embeddings, dtype=np.float32) if embeddings else None

        with self._lock:
            self.known_names    = names
            self.known_metadata = metadata_map
            self._emb_matrix    = matrix

        logger.info(f"Loaded {len(embeddings)} embeddings for {len(metadata_map)} people")

    def register_face(self, name: str, image_data: bytes,
                      employee_id: str = "", role: str = "",
                      department: str = "", company: str = "Nexoan AI") -> bool:
        name = name.strip()
        if not name:
            return False

        person_dir = KNOWN_FACES_DIR / name
        person_dir.mkdir(parents=True, exist_ok=True)

        existing = sum(1 for _ in person_dir.glob("photo_*.jpg"))
        img_path = person_dir / f"photo_{existing + 1:03d}.jpg"

        arr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False
        cv2.imwrite(str(img_path), img)

        existing_meta = self._load_meta(person_dir)
        meta = {
            "name":          name,
            "employee_id":   employee_id or existing_meta.get("employee_id", ""),
            "role":          role        or existing_meta.get("role", ""),
            "department":    department  or existing_meta.get("department", ""),
            "company":       company     or existing_meta.get("company", "Nexoan AI"),
            "registered_at": existing_meta.get("registered_at",
                             datetime.datetime.now().isoformat(timespec="seconds")),
        }
        self._save_meta(person_dir, meta)
        threading.Thread(target=self.load_embeddings, daemon=True).start()
        return True

    def delete_person(self, name: str) -> bool:
        person_dir = KNOWN_FACES_DIR / name
        if person_dir.is_dir():
            try:
                def remove_readonly(func, path, excinfo):
                    import os, stat
                    try:
                        os.chmod(path, stat.S_IWRITE)
                        func(path)
                    except Exception:
                        pass

                shutil.rmtree(str(person_dir), onerror=remove_readonly)
                threading.Thread(target=self.load_embeddings, daemon=True).start()
                return True
            except Exception as e:
                logger.warning(f"rmtree failed: {e}. Trying rename fallback.")
                try:
                    temp_dir = person_dir.parent / f"_del_{int(datetime.datetime.now().timestamp())}"
                    person_dir.rename(temp_dir)
                    shutil.rmtree(str(temp_dir), ignore_errors=True)
                    threading.Thread(target=self.load_embeddings, daemon=True).start()
                    return True
                except Exception as e2:
                    logger.error(f"Fallback rename also failed: {e2}")
                    return False
        return False

    # ── Background recognition worker ────────────────────────────────────────

    def _recognition_worker(self):
        """Dedicated daemon thread — pulls frames from _rec_frame and stores results."""
        while True:
            self._rec_pending.wait()
            self._rec_pending.clear()
            with self._rec_lock:
                frame = self._rec_frame
            if frame is None:
                continue
            try:
                results = self._run_recognition(frame)
                with self._rec_lock:
                    self._rec_results = results
            except Exception as e:
                logger.debug(f"Recognition worker error: {e}")

    def submit_frame(self, frame: np.ndarray):
        """Non-blocking: post a frame for background recognition."""
        with self._rec_lock:
            self._rec_frame = frame
        self._rec_pending.set()

    def get_last_results(self) -> list:
        with self._rec_lock:
            return list(self._rec_results)

    def clear_results(self):
        """Flush stale results when camera stops or restarts.
        Prevents previous person's detection from carrying over to the next session."""
        with self._rec_lock:
            self._rec_results = []
            self._rec_frame   = None
        self._rec_pending.clear()  # discard any queued frame too
        logger.info("Recognition results cleared for fresh session")

    # ── Detection & Recognition ──────────────────────────────────────────────

    def _run_recognition(self, frame: np.ndarray) -> list:
        """Internal – runs on the recognition worker thread, not the camera thread."""
        if not DEEPFACE_OK:
            return self._haar_detect(frame)

        # Downscale for faster face detection (4× fewer pixels)
        small = cv2.resize(frame, (DETECT_W, DETECT_H))
        sx = frame.shape[1] / DETECT_W
        sy = frame.shape[0] / DETECT_H

        try:
            faces = DeepFace.extract_faces(
                img_path=small,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=True,
            )
        except Exception as e:
            logger.debug(f"extract_faces: {e}")
            return []

        results = []
        with self._lock:
            matrix    = self._emb_matrix
            names_cp  = list(self.known_names)

        for face_obj in faces:
            if face_obj.get("confidence", 0) < 0.5:
                continue
            region = face_obj.get("facial_area", {})
            x  = int(region.get("x", 0) * sx)
            y  = int(region.get("y", 0) * sy)
            w  = int(region.get("w", 0) * sx)
            h  = int(region.get("h", 0) * sy)

            # Skip tiny faces (far away or noise)
            if w < MIN_FACE_PX or h < MIN_FACE_PX:
                continue

            bbox = {"top": y, "right": x + w, "bottom": y + h, "left": x}
            name       = "Unknown"
            match_conf = 0.0

            if matrix is not None and len(names_cp):
                try:
                    face_img = face_obj["face"]
                    face_u8  = (face_img * 255).astype(np.uint8)
                    face_bgr = cv2.cvtColor(face_u8, cv2.COLOR_RGB2BGR)
                    rep = DeepFace.represent(
                        img_path=face_bgr,
                        model_name=MODEL_NAME,
                        detector_backend="skip",
                        enforce_detection=False,
                    )
                    if rep:
                        vec = np.array(rep[0]["embedding"], dtype=np.float32)
                        vec /= (np.linalg.norm(vec) + 1e-8)
                        # Single matrix multiply — O(N) instead of loop
                        sims     = matrix @ vec          # shape (N,)
                        best_idx = int(np.argmax(sims))
                        best_sim = float(sims[best_idx])
                        if best_sim > (1.0 - THRESHOLD):
                            name       = names_cp[best_idx]
                            match_conf = round(best_sim, 3)
                except Exception as e:
                    logger.debug(f"represent: {e}")

            results.append(self._build_result(name, match_conf, bbox))
        return results

    # Keep legacy method for static image API endpoint
    def recognize_faces(self, frame: np.ndarray) -> list:
        return self._run_recognition(frame)

    def _haar_detect(self, frame: np.ndarray) -> list:
        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(MIN_FACE_PX, MIN_FACE_PX))
        return [
            self._build_result("Unknown", 0.0,
                {"top": y, "right": x+w, "bottom": y+h, "left": x})
            for (x, y, w, h) in (faces if len(faces) > 0 else [])
        ]

    def _build_result(self, name: str, confidence: float, bbox: dict) -> dict:
        with self._lock:
            meta = dict(self.known_metadata.get(name, {"name": name}))
        return {
            "name":        name,
            "confidence":  confidence,
            "bbox":        bbox,
            "employee_id": meta.get("employee_id", ""),
            "role":        meta.get("role", ""),
            "department":  meta.get("department", ""),
            "company":     meta.get("company", "Nexoan AI"),
        }

    # ── Rendering ────────────────────────────────────────────────────────────

    def draw_annotations(self, frame: np.ndarray, results: list) -> np.ndarray:
        for r in results:
            b = r["bbox"]
            t, ri, bo, l = b["top"], b["right"], b["bottom"], b["left"]
            name, conf   = r["name"], r["confidence"]
            role         = r.get("role", "")

            color = (0, 200, 120) if name != "Unknown" else (60, 60, 255)
            cv2.rectangle(frame, (l, t), (ri, bo), color, 2)

            label = f"{name}" + (f"  {conf:.0%}" if name != "Unknown" else "")
            if role and name != "Unknown":
                label = f"{name} | {role}  {conf:.0%}"

            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, 0.52, 1)
            cv2.rectangle(frame, (l, t - lh - 12), (l + lw + 10, t), color, cv2.FILLED)
            cv2.putText(frame, label, (l + 5, t - 4),
                        cv2.FONT_HERSHEY_DUPLEX, 0.52, (255, 255, 255), 1, cv2.LINE_AA)

        cv2.putText(frame, f"NEXOAN AI | Faces: {len(results)}", (10, 28),
                    cv2.FONT_HERSHEY_DUPLEX, 0.65, (0, 200, 120), 1, cv2.LINE_AA)
        return frame

    # ── Utility ──────────────────────────────────────────────────────────────

    def get_known_people(self) -> list:
        people = []
        if not KNOWN_FACES_DIR.exists():
            return people
        for d in sorted(KNOWN_FACES_DIR.iterdir()):
            if not d.is_dir():
                continue
            photos = list(d.glob("photo_*.jpg")) + list(d.glob("*.jpeg")) + list(d.glob("*.png"))
            if not photos:
                continue
            meta = self._load_meta(d)
            people.append({
                "name":          d.name,
                "photo_count":   len(photos),
                "employee_id":   meta.get("employee_id", ""),
                "role":          meta.get("role", ""),
                "department":    meta.get("department", ""),
                "company":       meta.get("company", "Nexoan AI"),
                "registered_at": meta.get("registered_at", ""),
            })
        return people

    @property
    def face_rec_available(self) -> bool:
        return DEEPFACE_OK
