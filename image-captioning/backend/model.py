"""
model.py — Image Captioning Model Module
-----------------------------------------
Uses Salesforce BLIP (Bootstrapping Language-Image Pre-training)
from HuggingFace Transformers.

Architecture:
  - Vision Encoder: Vision Transformer (ViT-B/16) — extracts image features
  - Language Decoder: Transformer decoder — generates caption tokens auto-regressively
  - Training: Contrastive + generative pre-training on 129M image-text pairs
"""

import io
import logging
import torch
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Singleton model holder
# ──────────────────────────────────────────────────────────────
_processor = None
_model = None
_device = None


def load_model():
    """Load BLIP model and processor (downloads on first run, cached afterwards)."""
    global _processor, _model, _device

    if _model is not None:
        return  # already loaded

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading BLIP model on device: {_device}")

    model_name = "Salesforce/blip-image-captioning-base"

    logger.info("Downloading / loading BLIP processor ...")
    _processor = BlipProcessor.from_pretrained(model_name)

    logger.info("Downloading / loading BLIP model weights ...")
    _model = BlipForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
    ).to(_device)
    _model.eval()

    logger.info("BLIP model loaded successfully ✓")


def generate_caption(image_bytes: bytes, conditional_text: str = None) -> dict:
    """
    Generate a caption for the given image bytes.

    Args:
        image_bytes: Raw bytes of the uploaded image.
        conditional_text: Optional prefix to guide caption generation
                          (e.g. "a photo of").

    Returns:
        dict with keys: caption, confidence_note, device
    """
    load_model()

    # ── Open image ──────────────────────────────────────────────
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Cannot open image: {exc}") from exc

    # ── Preprocess ──────────────────────────────────────────────
    if conditional_text:
        inputs = _processor(image, conditional_text, return_tensors="pt").to(_device)
    else:
        inputs = _processor(image, return_tensors="pt").to(_device)

    # Cast to fp16 on CUDA for speed
    if _device == "cuda":
        inputs = {k: v.half() if v.dtype == torch.float32 else v
                  for k, v in inputs.items()}

    # ── Generate (beam search) ──────────────────────────────────
    with torch.no_grad():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=100,
            num_beams=5,
            early_stopping=True,
            repetition_penalty=1.3,
        )

    caption = _processor.decode(output_ids[0], skip_special_tokens=True)
    caption = caption.strip().capitalize()
    if not caption.endswith("."):
        caption += "."

    return {
        "caption": caption,
        "model": "BLIP (Salesforce/blip-image-captioning-base)",
        "encoder": "Vision Transformer (ViT-B/16)",
        "decoder": "Transformer (auto-regressive)",
        "device": _device.upper(),
    }
