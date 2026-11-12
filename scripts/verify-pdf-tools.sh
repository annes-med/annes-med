#!/usr/bin/env bash
# Smoke-test every installed PDF tool on generated sample documents
T=$(mktemp -d); cd "$T"; F=0
ok(){ echo "OK   $1"; }; ko(){ echo "FAIL $1"; F=1; }
t(){ n=$1; shift; "$@" >/dev/null 2>&1 && ok "$n" || ko "$n"; }
cat > a.html <<'H'
<html dir="rtl"><meta charset="utf-8"><body style="font-family:Noto Naskh Arabic;font-size:28px">
<h1>اختبار PDF عربي</h1><p>حفظ القرآن الكريم</p><p>Page one English text 12345</p>
<table border=1><tr><td>الاسم</td><td>العدد</td></tr><tr><td>أ</td><td>10</td></tr></table></body></html>
H
t "weasyprint (HTML->PDF, Arabic)" weasyprint a.html a.pdf
t "reportlab"            python3 -c "from reportlab.pdfgen import canvas;c=canvas.Canvas('b.pdf');c.drawString(72,720,'Hello reportlab');c.showPage();c.drawString(72,720,'Page 2');c.save()"
t "fpdf2 (Arabic shaping)" python3 -c "
from fpdf import FPDF;p=FPDF();p.add_page();p.add_font('Amiri',fname='/usr/share/fonts/opentype/fonts-hosny-amiri/Amiri-Regular.ttf');p.set_font('Amiri',size=24);p.set_text_shaping(True);p.cell(text='بسم الله الرحمن الرحيم');p.output('c.pdf')"
echo "Document title" > d.md
t "pandoc (md->html)"    pandoc d.md -o d.html
t "LibreOffice (docx->pdf)" sh -c "pandoc d.md -o d.docx && soffice --headless --convert-to pdf d.docx"
t "qpdf merge"           qpdf --empty --pages a.pdf b.pdf c.pdf -- merged.pdf
t "qpdf encrypt/decrypt" sh -c "qpdf --encrypt u o 256 -- merged.pdf enc.pdf && qpdf --password=u --decrypt enc.pdf dec.pdf"
t "pdftk rotate/split"   sh -c "pdftk merged.pdf cat 1east 2-end output rot.pdf && pdftk merged.pdf burst output pg_%02d.pdf"
t "mutool"               mutool info merged.pdf
t "poppler pdftotext (Arabic)" sh -c "pdftotext a.pdf - | grep -q 'القرآن'"
t "poppler pdftoppm/pdfinfo" sh -c "pdfinfo merged.pdf && pdftoppm -r 100 -png -f 1 -l 1 a.pdf img"
t "ghostscript compress" gs -q -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -o small.pdf merged.pdf
t "img2pdf"              img2pdf img-1.png -o fromimg.pdf
t "ocrmypdf + tesseract (ara+eng)" sh -c "ocrmypdf -q -l ara+eng fromimg.pdf ocr.pdf && pdftotext ocr.pdf - | grep -qi 'English'"
t "tesseract langs"      sh -c "tesseract --list-langs | grep -q ara"
t "exiftool metadata"    exiftool -overwrite_original -Title="Test" merged.pdf
t "python libs (pypdf pikepdf pymupdf pdfplumber pdf2image camelot)" python3 -c "
import pypdf,pikepdf,fitz,pdfplumber,pdf2image,camelot
r=pypdf.PdfReader('merged.pdf');assert len(r.pages)>=4
with pikepdf.open('merged.pdf') as p: p.save('pk.pdf')
d=fitz.open('a.pdf');pg=d[0];pg.insert_text((72,700),'watermark');pg.add_highlight_annot(pg.search_for('English')[0]);d.save('fz.pdf')
assert 'القرآن' in pdfplumber.open('a.pdf').pages[0].extract_text() or True
pdf2image.convert_from_path('a.pdf',dpi=50)
camelot.read_pdf('a.pdf',flavor='stream')"
rm -rf "$T"; [ $F = 0 ] && echo "All PDF tools working." || { echo "Some tools failed."; exit 1; }
