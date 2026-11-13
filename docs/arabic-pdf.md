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

## 4. أدوات GitHub الأعلى تقييماً — مختبرة على العربي

| الأداة (نجوم GitHub) | الاستخدام | النتيجة على العربي |
|---|---|---|
| **PaddleOCR** (92k) | OCR | ✅ **الأفضل**: كل السطور صحيحة ومرتبة — بشرط النموذج العربي (انظر الكود) |
| **EasyOCR** (30k) | OCR | ✅ كل الكلمات صحيحة، لكن يقطع العنوان إلى أجزاء |
| **faster-whisper** (Whisper 112k) | تحويل الكلام العربي إلى نص / ترجمة الفيديو | ✅ دقيق، 10 ثوانٍ صوت في 8 ثوانٍ على المعالج |
| **MarkItDown** (195k) | Word/Excel/PowerPoint → Markdown | ✅ ممتاز لـ Word (عناوين + جداول) · ❌ يقلب العربي في PDF |
| **Docling** (70k) | PDF → Markdown | ⚠️ النص صحيح غالباً، لكن ضاع شكل الجدول و«الأجزاء» صارت «أجزاء ال» |
| Marker (41k) | PDF → Markdown | ⛔ لم يُختبر: يحتاج نماذج من `models.datalab.to` (محجوب) |
| Stirling-PDF (96k) | تطبيق ويب لتعديل PDF | ⛔ غير مثبّت: يحتاج Docker/خادم Java |

```bash
export HF_HUB_DISABLE_XET=1     # ضروري في هذه البيئة لتنزيل النماذج
```
```python
# PaddleOCR للعربي — هذه الإعدادات ضرورية (الافتراضي لا يقرأ العربي أو يستهلك 20GB ذاكرة)
from paddleocr import PaddleOCR
ocr = PaddleOCR(text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="arabic_PP-OCRv5_mobile_rec",
                text_det_limit_side_len=960, text_det_limit_type="max",
                use_doc_orientation_classify=False, use_doc_unwarping=False,
                use_textline_orientation=False, enable_mkldnn=False)
for r in ocr.predict("scan.png"): print("\n".join(r["rec_texts"]))

# Whisper للعربي (ترجمة الفيديو)
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")   # أو "medium" لدقة أعلى
for s in m.transcribe("video.mp4", language="ar")[0]: print(f"[{s.start:.1f}] {s.text}")
```
