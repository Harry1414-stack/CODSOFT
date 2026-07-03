# CODSOFT Internship Projects

A collection of AI/ML and web projects built during the **CODSOFT Internship**.

---

## 📁 Projects

### 🤖 [chatbot/](./chatbot/)
**ApexTrade AI Chatbot** — A high-fidelity, trading-focused rule-based chatbot application built with modern web technologies. Features real-time trading feeds, calendar interactions, and a pattern-matching conversational engine.

**Stack:** HTML · CSS · JavaScript (Vanilla)

---

### 🖼️ [image-captioning/](./image-captioning/)
**VisionScript — AI Image Captioning** — Combines Computer Vision and Natural Language Processing to generate captions for images. Uses a Vision Transformer (ViT-B/16) as the image encoder and a Transformer decoder for caption generation, powered by the BLIP model from Salesforce/HuggingFace.

**Stack:** Python · Flask · PyTorch · HuggingFace Transformers (BLIP) · HTML · CSS · JavaScript

**How to run:**
```bash
cd image-captioning/backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

---

## 🛠️ Tech Stack Overview

| Project | Frontend | Backend | AI/ML |
|---|---|---|---|
| Chatbot | HTML/CSS/JS | — | Rule-based NLP |
| Image Captioning | HTML/CSS/JS | Python Flask | BLIP (ViT + Transformer) |
