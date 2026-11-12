# أدوات PDF للملفات العربية — الدليل العملي

نتائج اختبار فعلي (`python3 -I scripts/arabic-pdf-benchmark.py`) على نص عربي فيه إنجليزية وأرقام
وحروف «لا» و«ال». الرقم = نسبة تطابق النص المستخرج مع الأصل.

## 1. إنشاء PDF عربي × استخراج النص منه

| أداة الإنشاء ↓ / الاستخراج → | pdftotext | PyMuPDF | pdfplumber (rtl) | pypdf |
|---|---|---|---|---|
| **WeasyPrint** (HTML/CSS) | **97** | 69 | 91 | 74 |
| **LibreOffice** (Word) | 96 | **97** | 92 | **99** |
| fpdf2 | 94 | 82 | 94 | 83 |
| PyMuPDF insert_htmlbox | 82 | 83 | 44 | 42 |
| ReportLab + arabic-reshaper | 96 | 68 | 91 | 74 |

## 2. التوصيات

**الإنشاء**
- **WeasyPrint** (HTML + CSS بـ `dir="rtl"`): أفضل تنسيق وخطوط وجداول → الخيار الأول للتقارير والكتيّبات.
- **LibreOffice** `soffice --headless --convert-to pdf file.docx`: لملفات Word / Excel / PowerPoint العربية.
- **fpdf2**: للإنشاء بالبرمجة، مع `set_text_shaping(use_shaping_engine=True, direction="rtl", script="arab")`.
- تجنّب ReportLab للعربي إلا مع arabic-reshaper + python-bidi (لا يشكّل الحروف وحده).

**الاستخراج**
- **pdftotext** (Poppler) هو الأكثر ثباتاً على كل الملفات: `pdftotext -layout file.pdf out.txt`.
- **pdfplumber**: لا بد من `extract_text(char_dir_render="rtl")`، وإلا خرجت الحروف معكوسة.
  ⚠️ حتى مع هذا الخيار تنعكس الأرقام والكلمات الإنجليزية (125 → 521). يصلح للجداول فقط مع مراجعة.
- **PyMuPDF**: استعمل `page.get_text()` **بدون** `sort=True` (يقلب ترتيب الكلمات العربية).
  يخلط ترتيب السطور المختلطة (عربي + أرقام) أحياناً.
- **mutool** يُخرج العربي معكوساً — لا تستعمله للعربي.

**الخطوط** (WeasyPrint → pdftotext): Noto Naskh Arabic 97 · Noto Sans/Thabit/DejaVu 96 ·
Amiri/Noto Kufi/KacstBook 95 · Scheherazade/Lateef 87.
- **Noto Naskh Arabic** هو الأفضل للنص القابل للبحث والنسخ.
- **Amiri** جميل للطباعة لكن مع WeasyPrint يُفقد أحياناً حرف «ل» من «ال» عند النسخ.
- خطوط كثيرة تكتب لفظ الجلالة بحرف مركّب، فيُستخرج أحياناً «اهلل» بدل «الله» — راجعه عند البحث.

**OCR (الملفات الممسوحة)**
- `tesseract scan.png out -l ara+eng` → **100%** على صفحة 300 dpi (ara وحدها: 94%). استعمل دائماً **ara+eng**.
- `ocrmypdf -l ara+eng in.pdf out.pdf` يجعل الـ PDF قابلاً للبحث (النص المستخرج منه بعد ذلك ~82%،
  فإن أردت النص نفسه استعمل tesseract مباشرة على الصورة).

## 3. أوامر جاهزة

```bash
weasyprint report.html report.pdf                         # HTML عربي → PDF
soffice --headless --convert-to pdf document.docx         # Word عربي → PDF
pdftotext -layout file.pdf - | less                       # استخراج النص العربي
ocrmypdf -l ara+eng --deskew scanned.pdf searchable.pdf   # ممسوح → قابل للبحث
pdftoppm -r 300 -png file.pdf page && tesseract page-1.png - -l ara+eng  # OCR مباشر
qpdf --empty --pages a.pdf b.pdf -- merged.pdf            # دمج (لا يمسّ النص العربي)
gs -q -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -o small.pdf big.pdf       # ضغط
```
