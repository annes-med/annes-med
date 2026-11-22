"""Build the mutashabihat PDF. Args: pairs.json warsh_font.ttf out.pdf"""
import json, sys, html, subprocess, os, datetime
pairs_path, font, out = sys.argv[1:4]
D = json.load(open(pairs_path, encoding='utf-8')); V = D['verses']; P = D['pairs']
SN = {2: 'البقرة', 3: 'آل عمران'}
def ref(k): s, a = map(int, k.split(':')); return f'{SN[s]} {a}'
def verse_html(k, marks):
    ws = V[k]; out = []
    for w, m in zip(ws, marks):
        w = html.escape(w)
        out.append(w if m else f'<span class="d">{w}</span>')
    return ' '.join(out)
sec = {('2','2'): [], ('3','3'): [], ('2','3'): []}
for p in P:
    sec[(p['a'].split(':')[0], p['b'].split(':')[0])].append(p)
for v in sec.values(): v.sort(key=lambda p: (int(p['a'].split(':')[1]), int(p['b'].split(':')[1])))
titles = {('2','2'): 'متشابهات داخل سورة البقرة', ('3','3'): 'متشابهات داخل سورة آل عمران', ('2','3'): 'متشابهات بين البقرة وآل عمران'}
cards = []; n = 0
for key in [('2','2'), ('3','3'), ('2','3')]:
    cards.append(f'<h2>{titles[key]} <small>({len(sec[key])} موضعًا)</small></h2>')
    for p in sec[key]:
        n += 1
        tag = '<span class="tag same">متطابقتان</span>' if p['kind'] == 'identical' else f'<span class="tag">تشابه {round(p["ratio"]*100)}%</span>'
        cards.append(f'''<div class="card"><div class="hd"><span class="no">{n}</span><b>{ref(p['a'])}</b> ↔ <b>{ref(p['b'])}</b> {tag}</div>
<div class="v"><span class="r">{ref(p['a'])}</span><div class="q">{verse_html(p['a'], p['ma'])}</div></div>
<div class="v"><span class="r">{ref(p['b'])}</span><div class="q">{verse_html(p['b'], p['mb'])}</div></div></div>''')
css = f'''
@font-face {{ font-family: "Warsh"; src: url("file://{os.path.abspath(font)}"); }}
@page {{ size: A4; margin: 16mm 14mm 16mm 14mm;
  @bottom-center {{ content: counter(page); font: 10pt "Noto Kufi Arabic"; color: #6b7a74; }} }}
body {{ direction: rtl; font-family: "Noto Kufi Arabic", "Noto Naskh Arabic", sans-serif; color: #12241e; font-size: 10.5pt; }}
.cover {{ page-break-after: always; text-align: center; padding-top: 55mm; }}
.cover h1 {{ font-family: "Noto Naskh Arabic"; font-size: 34pt; color: #0d4a3c; margin: 0 0 6mm; }}
.cover .sub {{ font-size: 15pt; color: #b98a2e; }}
.cover .meta {{ margin-top: 30mm; font-size: 10.5pt; color: #46564f; line-height: 2; }}
.intro {{ page-break-after: always; line-height: 2; }}
.intro h2 {{ margin-top: 0; }}
.legend .d {{ font-family: "Noto Naskh Arabic"; }}
h2 {{ font-family: "Noto Naskh Arabic"; color: #0d4a3c; font-size: 17pt; border-bottom: 2.5pt solid #e8c46a; padding-bottom: 2mm; margin: 4mm 0 4mm; page-break-after: avoid; }}
h2 small {{ font-size: 11pt; color: #6b7a74; }}
.sec {{ page-break-before: always; }}
.card {{ border: 1pt solid #d5e1db; border-radius: 3mm; padding: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; background: #fbfcfb; }}
.hd {{ font-size: 10pt; color: #46564f; margin-bottom: 1.5mm; }}
.hd b {{ color: #0d4a3c; }}
.no {{ display: inline-block; min-width: 7mm; padding: 0 1.5mm; margin-left: 2mm; border-radius: 3mm; background: #0d4a3c; color: #fff; text-align: center; font-size: 9pt; }}
.tag {{ float: left; font-size: 8.5pt; padding: .4mm 2.5mm; border-radius: 3mm; background: #f3e6c4; color: #7a5a17; }}
.tag.same {{ background: #dceee5; color: #1f6b48; }}
.v {{ display: flex; gap: 3mm; align-items: baseline; border-top: .6pt dashed #e2e8e5; padding-top: 1.5mm; margin-top: 1.5mm; }}
.r {{ flex: none; width: 22mm; font-size: 8.5pt; color: #6b7a74; }}
.q {{ font-family: "Warsh"; font-size: 17pt; line-height: 2.05; }}
.d {{ background: #fde2b8; color: #9a1f1f; border-radius: 1.5mm; padding: 0 .6mm; }}
'''
today = datetime.date.today().isoformat()
doc = f'''<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="cover"><h1>المتشابهات اللفظية</h1><div class="sub">في سورتي البقرة وآل عمران · رواية ورش عن نافع</div>
<div class="meta">{len(P)} موضعًا من الآيات المتشابهة<br>الكلمات المختلفة مُلوَّنة لتسهيل التمييز عند الحفظ والمراجعة</div></div>
<div class="intro"><h2>طريقة الاستعمال</h2>
<p>كل بطاقة تجمع آيتين متشابهتين في اللفظ. <span class="legend">الكلمات المظلّلة <span class="d">هكذا</span> هي مواضع الاختلاف</span> بين الآيتين، وهي التي يقع فيها الخلط عادة؛ ركّز عليها عند المراجعة.</p>
<p><b>«متطابقتان»</b>: آيتان بلفظ واحد في موضعين، فاحفظ ما قبل كل منهما وما بعدها لتعرف موضعها.<br>
<b>«تشابه ٪»</b>: نسبة الكلمات المشتركة بين الآيتين.</p>
<p>المواضع مرتّبة حسب ترتيب المصحف: داخل البقرة، ثم داخل آل عمران، ثم بين السورتين.</p>
<h2>المصدر والملاحظات</h2>
<p>• نصّ الآيات برواية ورش عن نافع من إصدار <b>مجمع الملك فهد لطباعة المصحف الشريف</b> (UthmanicWarsh v3.0)، عبر مجموعة بيانات quran-ws/quran-text، ومكتوب بخط المجمع لرواية ورش. نُقل النص كما هو دون أي تعديل.</p>
<p>• ترقيم الآيات بالعدّ <b>المدني الأخير</b> المعتمد في مصحف ورش (البقرة 285 آية، آل عمران 200 آية)، وقد يختلف بآية عن ترقيم مصحف حفص.</p>
<p>• علامات الوقف غير مثبتة في هذه القائمة.</p>
<p>• استُخرجت المواضع آليًّا بمقارنة كلمات الآيات (عبارة مشتركة من 4 كلمات فأكثر أو نسبة تشابه عالية)؛ فهي تجمع المتشابه اللفظي الظاهر، ولا تغني عن كتب المتشابه المتخصصة ومراجعة شيخ متقن.</p>
<p style="color:#6b7a74;font-size:9pt">أُعدّ في {today}.</p></div>
{''.join(c if not c.startswith('<h2>') or c is cards[0] else '<div class="sec"></div>'+c for c in cards)}
</body></html>'''
h = out.replace('.pdf', '.html'); open(h, 'w', encoding='utf-8').write(doc)
subprocess.run(['weasyprint', h, out], check=True)
print('ok', out)
