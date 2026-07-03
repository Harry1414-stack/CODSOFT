# VisionScript — AI Image Captioning

A full-stack image captioning AI that combines **Computer Vision** and **Natural Language Processing**.

## Architecture

```
Image → Vision Transformer (ViT-B/16) → Visual Embeddings
                                               ↓
                               BLIP Cross-Attention Fusion
                                               ↓
                          Transformer Decoder (Beam Search)
                                               ↓
                                    Natural Language Caption
```

## Tech Stack

| Component | Technology |
|---|---|
| Vision Encoder | Vision Transformer (ViT-B/16) |
| Language Decoder | Transformer (auto-regressive) |
| Model | BLIP — Salesforce/HuggingFace |
| Backend | Python 3.10+, Flask, PyTorch |
| Frontend | HTML5, Vanilla CSS, Vanilla JS |

## Quick Start (Windows)

### Option 1: One-Click Launcher
```
Double-click run.bat
```
Then open `frontend/index.html` in your browser.

### Option 2: Manual Setup
```bash
# 1. Create & activate virtual environment
cd backend
python -m venv venv
venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
python app.py
```
Then open `frontend/index.html` in your browser.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| POST | `/caption` | Upload image → get caption |
| GET | `/model-info` | Model architecture info |

### POST /caption
```
Content-Type: multipart/form-data
Field: image  (file, required)
Field: prompt (string, optional — e.g. "a photo of")
```

### Response
```json
{
  "success": true,
  "caption": "A dog playing on a grassy field.",
  "encoder": "Vision Transformer (ViT-B/16)",
  "decoder": "Transformer (auto-regressive)",
  "device": "CPU"
}
```

## Notes
- First run downloads the BLIP model (~1 GB) to `~/.cache/huggingface`
- GPU (CUDA) auto-detected and used if available — significantly faster
- Beam search with 5 beams produces high-quality captions

## References
- [BLIP Paper (arxiv)](https://arxiv.org/abs/2201.12086)
- [HuggingFace BLIP](https://huggingface.co/Salesforce/blip-image-captioning-base)
- [Vision Transformer (ViT)](https://arxiv.org/abs/2010.11929)
