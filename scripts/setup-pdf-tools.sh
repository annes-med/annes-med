#!/usr/bin/env bash
# Install professional PDF editing / conversion / OCR tools (Ubuntu 24.04)
set -e
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  qpdf poppler-utils ghostscript mupdf-tools pdftk-java img2pdf pandoc \
  tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng tesseract-ocr-fra \
  unpaper pngquant jbig2 libimage-exiftool-perl libharfbuzz-subset0 \
  fonts-hosny-amiri fonts-noto-core fonts-noto-ui-core fonts-sil-scheherazade \
  fonts-sil-lateef fonts-kacst fonts-kacst-one fonts-arabeyes fonts-hosny-thabit
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
  libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui
# ocrmypdf from pip (the apt one breaks against a newer pikepdf)
pip install -q pypdf pikepdf pymupdf pdfplumber reportlab weasyprint pdf2image \
  fpdf2 arabic-reshaper python-bidi camelot-py ocrmypdf
pip install -q --no-deps "pillow>=12.2"
