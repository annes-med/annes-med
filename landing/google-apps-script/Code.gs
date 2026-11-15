/**
 * استقبال طلبات «مصحف تسهيل حفظ القرآن الكريم»
 * يضيف كل طلب كسطر في ورقة «الطلبات» ويرسل لك بريدًا إلكترونيًا فوريًا.
 *
 * التثبيت: انظر landing/ORDERS-SETUP.md
 */

// البريد الذي تصله إشعارات الطلبات. اتركه فارغًا لاستعمال بريد صاحب الحساب.
const NOTIFY_EMAIL = '';
const SHEET_NAME = 'الطلبات';
const HEADERS = ['التاريخ', 'رقم الطلب', 'الاسم', 'الهاتف', 'الولاية', 'البلدية',
                 'نوع التوصيل', 'الكمية', 'ملاحظات', 'نتيجة الاختبار', 'المستوى', 'الحالة'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return reply_({ ok: true });           // حقل فخ ضد الروبوتات

    const name = clean_(p.name, 80);
    const phone = clean_(p.phone, 20).replace(/[^\d+]/g, '');
    const wilaya = clean_(p.wilaya, 60);
    const commune = clean_(p.commune, 80);
    if (!name || !/^(0|\+213)[5-7]\d{8}$/.test(phone) || !wilaya || !commune) {
      return reply_({ ok: false, error: 'invalid' });
    }
    const qty = Math.min(20, Math.max(1, parseInt(p.qty, 10) || 1));
    const id = clean_(p.orderId, 20) || ('M' + Date.now().toString(36).toUpperCase());

    const sheet = sheet_();
    // منع تكرار نفس الطلب إذا ضغط الزبون الزر مرتين
    const last = sheet.getLastRow();
    if (last > 1) {
      const ids = sheet.getRange(Math.max(2, last - 50), 2, Math.min(51, last - 1), 1).getValues().flat();
      if (ids.indexOf(id) !== -1) return reply_({ ok: true, id: id, duplicate: true });
    }

    const row = [new Date(), id, name, "'" + phone, wilaya, commune,
                 clean_(p.delivery, 30), qty, clean_(p.notes, 300),
                 clean_(p.score, 5), clean_(p.level, 30), 'جديد'];
    sheet.appendRow(row);

    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    if (to) {
      MailApp.sendEmail({
        to: to,
        subject: 'طلب جديد ' + id + ' — ' + wilaya + ' / ' + commune,
        htmlBody: '<div dir="rtl" style="font-family:Tahoma,Arial;font-size:15px">' +
          '<h3>طلب جديد: مصحف تسهيل حفظ القرآن الكريم</h3>' +
          HEADERS.slice(0, 11).map(function (h, i) {
            return '<b>' + h + ':</b> ' + escape_(String(row[i]).replace(/^'/, '')) + '<br>';
          }).join('') + '</div>'
      });
    }
    return reply_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// يسمح بفتح الرابط في المتصفح للتأكد من أنه يعمل
function doGet() {
  return reply_({ ok: true, service: 'orders' });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0d4a3c').setFontColor('#ffffff');
  }
  return sh;
}

function clean_(v, max) {
  return String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/^[=+\-@]+/, '').trim().slice(0, max);
}
function escape_(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// شغّل هذه الدالة مرة واحدة من المحرر لمنح الصلاحيات وتجربة الإرسال
function testOrder() {
  const r = doPost({ parameter: { name: 'طلب تجريبي', phone: '0555000000', wilaya: '16 - الجزائر',
    commune: 'باب الوادي', delivery: 'إلى المنزل', qty: '1', orderId: 'TEST' + Date.now() } });
  console.log(r.getContent());
}
