"""
app.py — Flask API Server for Image Captioning AI
---------------------------------------------------
Endpoints:
  GET  /            → serves the frontend UI (index.html)
  POST /caption     → upload image, receive generated caption
  GET  /model-info  → returns model architecture info
"""

import os
import logging
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from model import generate_caption, load_model
import threading

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

# ──────────────────────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff"}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# ──────────────────────────────────────────────────────────────
# Warm up model in background so first request is fast
# ──────────────────────────────────────────────────────────────
def warmup():
    logger.info("🔥 Warming up model in background thread ...")
    try:
        load_model()
        logger.info("✅ Model warm-up complete. Ready for requests!")
    except Exception as exc:
        logger.error(f"Model warm-up failed: {exc}")

threading.Thread(target=warmup, daemon=True).start()


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/api", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "message": "Image Captioning AI API is live 🚀",
        "endpoints": {
            "POST /caption": "Upload an image to get an AI-generated caption",
            "GET /model-info": "Get model architecture details",
        },
    })


@app.route("/model-info", methods=["GET"])
def model_info():
    return jsonify({
        "model": "BLIP — Bootstrapping Language-Image Pre-training",
        "source": "Salesforce / HuggingFace",
        "vision_encoder": "Vision Transformer (ViT-B/16) — 86M params",
        "language_decoder": "Transformer decoder (auto-regressive)",
        "pretrained_on": "~129 million image-text pairs",
        "decoding_strategy": "Beam search (5 beams)",
        "paper": "https://arxiv.org/abs/2201.12086",
    })


@app.route("/caption", methods=["POST"])
def caption():
    # ── Validate request ────────────────────────────────────────
    if "image" not in request.files:
        return jsonify({"error": "No image file provided. Use field name 'image'."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400
    if not allowed_file(file.filename):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        }), 415

    # ── Read image bytes ────────────────────────────────────────
    image_bytes = file.read()
    if len(image_bytes) == 0:
        return jsonify({"error": "Empty file uploaded."}), 400

    # Optional: conditional prompt prefix
    conditional_text = request.form.get("prompt", None)

    # ── Generate caption ────────────────────────────────────────
    logger.info(f"Processing image: {file.filename} ({len(image_bytes) // 1024} KB)")
    try:
        result = generate_caption(image_bytes, conditional_text)
        logger.info(f"Caption generated: {result['caption']}")
        return jsonify({
            "success": True,
            "filename": file.filename,
            **result,
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        logger.error(f"Caption generation failed:\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error during caption generation."}), 500


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("  🖼️  Image Captioning AI — Backend Server")
    logger.info("  📡  http://localhost:5000")
    logger.info("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
