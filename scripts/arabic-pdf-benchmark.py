"""Benchmark Arabic PDF support: creation x extraction, fonts, OCR.
Score = similarity (%) of extracted text to the source, in logical order."""
import difflib, os, re, subprocess, sys, tempfile, unicodedata, warnings
warnings.filterwarnings("ignore")
LINES = ["حفظ القرآن الكريم رحلة نور تبدأ بآية",
         "قال رسول الله: خيركم من تعلم القرآن وعلمه",
         "عدد الطلاب 125 طالبا في عام 2026 لا إله إلا الله",
         "يستخدم البرنامج Python و PDF لمعالجة الملفات"]
TRUTH = "\n".join(LINES)
FONT = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"
def norm(s):
    s = unicodedata.normalize("NFKC", s)                       # presentation forms -> letters
    s = re.sub(r"[‎‏‪-‮⁦-⁩ً-ْ﻿]", "", s)
    return " ".join(s.split())
def score(got): return round(100 * difflib.SequenceMatcher(None, norm(TRUTH), norm(got)).ratio())
D = tempfile.mkdtemp(); os.chdir(D)
html = lambda font: f'<html dir="rtl" lang="ar"><meta charset="utf-8"><body style="font-family:\'{font}\';font-size:22px">' + "".join(f"<p>{l}</p>" for l in LINES) + "</body></html>"

# ---------- creators ----------
def c_weasy(out, font="Noto Naskh Arabic"):
    open("w.html", "w").write(html(font)); subprocess.run(["weasyprint", "w.html", out], capture_output=True, check=True)
def c_libreoffice(out):
    open("l.md", "w").write("---\ndir: rtl\nlang: ar\n---\n\n" + "\n\n".join(LINES))
    subprocess.run(["pandoc", "l.md", "-o", "l.docx"], check=True)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "l.docx"], capture_output=True, check=True); os.rename("l.pdf", out)
def c_pymupdf(out):
    import pymupdf; d = pymupdf.open(); p = d.new_page()
    p.insert_htmlbox(pymupdf.Rect(40, 40, 555, 800), html("Noto Naskh Arabic").split("<body")[1].split(">",1)[1].replace("</body></html>",""),
                     css="*{font-family:'Noto Naskh Arabic';font-size:16px;direction:rtl;text-align:right}"); d.save(out)
def c_fpdf2(out):
    from fpdf import FPDF; p = FPDF(); p.add_page(); p.add_font("N", fname=FONT); p.set_font("N", size=16)
    p.set_text_shaping(use_shaping_engine=True, direction="rtl", script="arab", language="ar")
    for l in LINES: p.cell(w=0, h=12, text=l, align="R", new_x="LMARGIN", new_y="NEXT")
    p.output(out)
def c_reportlab(out):
    import arabic_reshaper; from bidi.algorithm import get_display
    from reportlab.pdfgen import canvas; from reportlab.pdfbase import pdfmetrics; from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont("N", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    c = canvas.Canvas(out); c.setFont("N", 14)
    for i, l in enumerate(LINES): c.drawRightString(550, 780 - 30 * i, get_display(arabic_reshaper.reshape(l)))
    c.save()
# ---------- extractors ----------
def x_pdftotext(f): return subprocess.run(["pdftotext", "-layout", f, "-"], capture_output=True, text=True).stdout
def x_pymupdf(f):
    import pymupdf; return "\n".join(p.get_text() for p in pymupdf.open(f))  # NOT sort=True: it breaks RTL order
def x_pdfplumber(f):
    import pdfplumber; return "\n".join(p.extract_text(char_dir_render="rtl") or "" for p in pdfplumber.open(f).pages)  # rtl needed
def x_pypdf(f):
    import pypdf; return "\n".join(p.extract_text() for p in pypdf.PdfReader(f).pages)
def x_mutool(f): return subprocess.run(["mutool", "draw", "-F", "txt", f], capture_output=True, text=True).stdout
CRE = {"WeasyPrint": c_weasy, "LibreOffice": c_libreoffice, "PyMuPDF": c_pymupdf, "fpdf2": c_fpdf2, "ReportLab+reshaper": c_reportlab}
EXT = {"pdftotext": x_pdftotext, "PyMuPDF": x_pymupdf, "pdfplumber": x_pdfplumber, "pypdf": x_pypdf, "mutool": x_mutool}

print("== 1. Creation x extraction (accuracy %) ==")
print(f"{'creator':20}" + "".join(f"{e:>12}" for e in EXT))
for cn, cf in CRE.items():
    try: cf(cn + ".pdf"); row = [score(ef(cn + ".pdf")) for ef in EXT.values()]
    except Exception as ex: row = ["ERR"] * len(EXT); print(cn, ex, file=sys.stderr)
    print(f"{cn:20}" + "".join(f"{v:>12}" for v in row))

print("\n== 2. Fonts (WeasyPrint -> pdftotext / PyMuPDF) ==")
for font in ["Noto Naskh Arabic", "Noto Sans Arabic", "Noto Kufi Arabic", "Amiri", "Scheherazade", "Lateef", "KacstOne", "KacstBook", "Thabit", "DejaVu Sans"]:
    c_weasy("f.pdf", font); print(f"{font:20}{score(x_pdftotext('f.pdf')):>6}{score(x_pymupdf('f.pdf')):>6}")

print("\n== 3. OCR on scanned page (300 dpi) ==")
c_weasy("s.pdf"); subprocess.run(["pdftoppm", "-r", "300", "-png", "-singlefile", "s.pdf", "scan"], check=True)
for lang in ["ara", "ara+eng"]:
    r = subprocess.run(["tesseract", "scan.png", "-", "-l", lang], capture_output=True, text=True).stdout
    print(f"tesseract {lang:10}{score(r):>6}")
subprocess.run(["img2pdf", "scan.png", "-o", "scan.pdf"], check=True)
subprocess.run(["ocrmypdf", "-q", "-l", "ara+eng", "scan.pdf", "ocr.pdf"], check=True)
print(f"{'ocrmypdf searchable':20}{score(x_pdftotext('ocr.pdf')):>6}  (pdftotext on result)")
print(f"\nwork dir: {D}")
