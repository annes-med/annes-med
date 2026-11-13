#!/usr/bin/env bash
# Top-starred GitHub tools for documents / OCR / speech, tested on Arabic.
# Models are pulled from Hugging Face on first use: needs huggingface.co + us.aws.cdn.hf.co
set -e
pip install -q "markitdown[all]" faster-whisper "av<16"   # av>=16 breaks faster-whisper
pip install -q torch easyocr paddlepaddle paddleocr docling
pip install -q --no-deps "pillow>=12.2"
# Before running the tools:  export HF_HUB_DISABLE_XET=1   (Xet host is not allowed)
