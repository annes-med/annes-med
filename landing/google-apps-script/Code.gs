/**
 * طلبات «مصحف تسهيل حفظ القرآن الكريم» + ربط World Express (منصة Ecotrack)
 *
 * 1) يستقبل الطلبات من الصفحة → سطر في ورقة «الطلبات» + بريد إلكتروني.
 * 2) قائمة «🚚 التوصيل» في الجدول:
 *    - إرسال الطلبات المؤكَّدة إلى World Express (إنشاء الطرد + رقم التتبع)
 *    - تحديث حالة الطرود (يدويًا أو تلقائيًا كل ساعة)
 *    - جلب ورقة الطرد PDF
 *
 * الإعدادات السرية لا تُكتب هنا: تُحفظ من القائمة «🚚 التوصيل ← الإعدادات».
 * التثبيت: انظر landing/ORDERS-SETUP.md
 */

// ───────── إعدادات عامة (ليست سرية) ─────────
const NOTIFY_EMAIL = '';            // فارغ = بريد صاحب الحساب
const SHEET_NAME = 'الطلبات';
const PRODUCT_NAME = 'مصحف تسهيل حفظ القرآن الكريم';

const COLS = ['التاريخ', 'رقم الطلب', 'الاسم', 'الهاتف', 'الولاية', 'البلدية', 'العنوان',
  'نوع التوصيل', 'الكمية', 'ملاحظات', 'نتيجة الاختبار', 'المستوى', 'الحالة',
  'كود الولاية للتوصيل', 'البلدية (FR)', 'رقم التتبع', 'حالة التوصيل', 'آخر تحديث'];
const ST = { NEW: 'جديد', CONFIRMED: 'مؤكَّد', SENT: 'أُرسل', ERROR: 'خطأ في الإرسال' };

// ───────── استقبال الطلبات من الصفحة ─────────
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return json_({ ok: true });                       // فخ الروبوتات

    const name = clean_(p.name, 80);
    const phone = clean_(p.phone, 20).replace(/[^\d+]/g, '');
    const wilaya = clean_(p.wilaya, 60);
    const commune = clean_(p.commune, 80);
    if (!name || !/^(0|\+213)[5-7]\d{8}$/.test(phone) || !wilaya || !commune) {
      return json_({ ok: false, error: 'invalid' });
    }
    const id = clean_(p.orderId, 20) || ('M' + Date.now().toString(36).toUpperCase());
    const sh = sheet_();
    if (findRow_(sh, 'رقم الطلب', id)) return json_({ ok: true, id: id, duplicate: true });

    const rec = {
      'التاريخ': new Date(), 'رقم الطلب': id, 'الاسم': name, 'الهاتف': "'" + phone,
      'الولاية': wilaya, 'البلدية': commune, 'العنوان': clean_(p.address, 200), 'نوع التوصيل': clean_(p.delivery, 30),
      'الكمية': Math.min(20, Math.max(1, parseInt(p.qty, 10) || 1)), 'ملاحظات': clean_(p.notes, 300),
      'نتيجة الاختبار': clean_(p.score, 5), 'المستوى': clean_(p.level, 30), 'الحالة': ST.NEW,
      'كود الولاية للتوصيل': clean_(p.wilaya_code_58, 3) + '|' + clean_(p.wilaya_code, 3),
      'البلدية (FR)': clean_(p.commune_fr, 80)
    };
    sh.appendRow(COLS.map(function (c) { return rec[c] === undefined ? '' : rec[c]; }));
    notify_(rec);
    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// GET: فحص الرابط، أو سعر التوصيل لولاية: ?action=fee&w=16&w58=16
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'fee') {
    try { return json_({ ok: true, fee: feeFor_(p.w, p.w58) }); }
    catch (err) { return json_({ ok: false }); }
  }
  return json_({ ok: true, service: 'orders' });
}

// ───────── القائمة في الجدول ─────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚚 التوصيل')
    .addItem('إرسال الطلبات المؤكَّدة إلى World Express', 'sendConfirmed')
    .addItem('تحديث حالة الطرود', 'refreshTracking')
    .addItem('ورقة الطرد (PDF) للسطر المحدد', 'labelForSelected')
    .addSeparator()
    .addItem('اختبار الاتصال', 'testConnection')
    .addItem('تفعيل التحديث التلقائي كل ساعة', 'enableAutoTracking')
    .addItem('الإعدادات (المفتاح، الرابط، السعر)', 'settings')
    .addToUi();
}

function settings() {
  const ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  const ask = function (key, label, secret) {
    const cur = props.getProperty(key) || '';
    const r = ui.prompt(label, 'القيمة الحالية: ' + (cur ? (secret ? '•••• محفوظ' : cur) : 'فارغ') +
      '\nاتركه فارغًا للإبقاء على القيمة الحالية.', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return false;
    const v = r.getResponseText().trim();
    if (v) props.setProperty(key, v);
    return true;
  };
  ask('ECOTRACK_BASE', 'رابط لوحة تحكم World Express (مثال: https://xxxx.ecotrack.dz)', false) &&
  ask('ECOTRACK_TOKEN', 'مفتاح API (Token) من لوحة تحكم World Express', true) &&
  ask('PRODUCT_PRICE', 'سعر النسخة الواحدة بالدينار (رقم فقط)', false) &&
  ask('CUSTOMER_PAYS_DELIVERY', 'هل يدفع الزبون ثمن التوصيل؟ اكتب 1 لنعم أو 0 لا', false);
  ui.alert('تم حفظ الإعدادات. جرّب «اختبار الاتصال».');
}

function testConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = eco_('GET', 'get/wilayas');
    ui.alert(r.code === 200 ? '✓ الاتصال يعمل. عدد الولايات عند الشركة: ' + count_(r.data)
      : '✗ رفضت الشركة الاتصال (' + r.code + '). تحقق من المفتاح والرابط.');
  } catch (err) { ui.alert('✗ ' + err.message); }
}

// ───────── الإرسال إلى World Express ─────────
function sendConfirmed() {
  const sh = sheet_(), cfg = cfg_(), h = headerIndex_(sh);
  const rows = sh.getDataRange().getValues();
  let sent = 0, failed = 0;
  for (let r = 1; r < rows.length; r++) {
    const v = rows[r];
    if (String(v[h['الحالة']]).trim() !== ST.CONFIRMED || v[h['رقم التتبع']]) continue;
    let res;
    try { res = createParcel_(cfg, v, h); } catch (err) { res = { ok: false, error: err.message }; }
    const row = r + 1;
    if (res.ok) {
      sh.getRange(row, h['رقم التتبع'] + 1).setValue(res.tracking);
      sh.getRange(row, h['الحالة'] + 1).setValue(ST.SENT);
      sh.getRange(row, h['حالة التوصيل'] + 1).setValue(res.validated ? 'في انتظار الاستلام' : 'أُنشئ — أكّده من لوحة التحكم');
      sent++;
    } else {
      sh.getRange(row, h['الحالة'] + 1).setValue(ST.ERROR);
      sh.getRange(row, h['حالة التوصيل'] + 1).setValue(res.error);
      failed++;
    }
    sh.getRange(row, h['آخر تحديث'] + 1).setValue(new Date());
  }
  toast_('أُرسل ' + sent + ' طرد' + (failed ? ' · فشل ' + failed + ' (انظر عمود «حالة التوصيل»)' : ''));
}

function createParcel_(cfg, v, h) {
  const codes = String(v[h['كود الولاية للتوصيل']]).split('|');      // "قديم|جديد"
  const w58 = parseInt(codes[0], 10), w69 = parseInt(codes[1], 10);
  const wilayaId = courierWilaya_(w69, w58);
  const commune = matchCommune_(wilayaId, String(v[h['البلدية (FR)']]), String(v[h['البلدية']]));
  if (!commune) return { ok: false, error: 'البلدية غير موجودة عند الشركة: صحّحها يدويًا ثم أعد «مؤكَّد»' };

  const qty = parseInt(v[h['الكمية']], 10) || 1;
  const desk = /مكتب/.test(String(v[h['نوع التوصيل']]));
  let amount = cfg.price * qty;
  if (cfg.customerPaysDelivery) amount += feeFor_(w69, w58, desk) || 0;

  const params = {
    reference: String(v[h['رقم الطلب']]),
    nom_client: String(v[h['الاسم']]),
    telephone: localPhone_(v[h['الهاتف']]),
    adresse: String(v[h['العنوان']] || '') || commune.nom,
    code_wilaya: String(wilayaId),
    commune: commune.nom,
    montant: String(amount),
    produit: PRODUCT_NAME + ' x' + qty,
    type: '1',                                     // 1 = توصيل
    stop_desk: desk ? '1' : '0',
    remarque: String(v[h['ملاحظات']]).slice(0, 250)
  };
  if (desk && commune.code_postal) params.code_postal = String(commune.code_postal);

  const r = eco_('POST', 'create/order', params);
  const d = r.data || {};
  if (r.code !== 200 || !okFlag_(d.success) || !d.tracking) {
    return { ok: false, error: 'رفض الشركة: ' + (d.message || JSON.stringify(d).slice(0, 150) || r.code) };
  }
  // تأكيد الطرد وطلب استلامه من طرف الشركة
  const vr = eco_('POST', 'valid/order', { tracking: d.tracking, ask_collection: '1' });
  return { ok: true, tracking: d.tracking, validated: vr.code === 200 && okFlag_((vr.data || {}).success) };
}

// ───────── التتبع ─────────
function refreshTracking() {
  const sh = sheet_(), h = headerIndex_(sh);
  const rows = sh.getDataRange().getValues();
  const pending = [];
  for (let r = 1; r < rows.length; r++) {
    const t = String(rows[r][h['رقم التتبع']] || '').trim();
    const st = String(rows[r][h['حالة التوصيل']] || '');
    if (t && !/سُلّم|livr[ée]|مرتجع|retour/i.test(st)) pending.push({ row: r + 1, t: t });
  }
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const q = chunk.map(function (x) { return 'trackings[]=' + encodeURIComponent(x.t); }).join('&');
    const r = eco_('GET', 'get/trackings/info?' + q);
    const byTracking = keyed_(r.data);
    chunk.forEach(function (x) {
      const info = byTracking[x.t];                // نطابق رقم التتبع بالضبط
      if (!info) return;
      sh.getRange(x.row, h['حالة التوصيل'] + 1).setValue(statusText_(info));
      sh.getRange(x.row, h['آخر تحديث'] + 1).setValue(new Date());
    });
  }
  if (pending.length) toast_('تم تحديث ' + pending.length + ' طرد');
}

function enableAutoTracking() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshTracking') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshTracking').timeBased().everyHours(1).create();
  toast_('سيتم تحديث حالة الطرود كل ساعة');
}

function labelForSelected() {
  const sh = sheet_(), h = headerIndex_(sh), ui = SpreadsheetApp.getUi();
  const row = sh.getActiveRange().getRow();
  const t = row > 1 ? String(sh.getRange(row, h['رقم التتبع'] + 1).getValue()).trim() : '';
  if (!t) return ui.alert('اختر سطرًا فيه رقم تتبع.');
  const cfg = cfg_();
  const resp = UrlFetchApp.fetch(cfg.base + '/api/v1/get/order/label?tracking=' + encodeURIComponent(t), {
    headers: { Authorization: 'Bearer ' + cfg.token }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return ui.alert('تعذّر جلب ورقة الطرد (' + resp.getResponseCode() + ').');
  const file = DriveApp.createFile(resp.getBlob().setName('طرد-' + t + '.pdf'));
  ui.alert('تم حفظ ورقة الطرد في Google Drive:\n' + file.getUrl());
}

// ───────── أدوات Ecotrack ─────────
function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const base = (p.getProperty('ECOTRACK_BASE') || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const token = p.getProperty('ECOTRACK_TOKEN') || '';
  if (!base || !token) throw new Error('أكمل الإعدادات أولًا: 🚚 التوصيل ← الإعدادات');
  return { base: base, token: token, price: parseInt(p.getProperty('PRODUCT_PRICE'), 10) || 0,
           customerPaysDelivery: p.getProperty('CUSTOMER_PAYS_DELIVERY') === '1' };
}

function eco_(method, path, params) {
  const cfg = cfg_();
  const opt = { method: method.toLowerCase(), muteHttpExceptions: true,
                headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/json' } };
  if (params) opt.payload = params;                 // form-urlencoded
  const resp = UrlFetchApp.fetch(cfg.base + '/api/v1/' + path, opt);
  if (resp.getResponseCode() === 401 || resp.getResponseCode() === 403) {
    throw new Error('رفضت الشركة مفتاح API (' + resp.getResponseCode() + '): تحقق من المفتاح والرابط في الإعدادات');
  }
  let data = null;
  try { data = JSON.parse(resp.getContentText()); } catch (e) { data = { message: resp.getContentText().slice(0, 200) }; }
  return { code: resp.getResponseCode(), data: data };
}

// ولايات الشركة: إذا كانت تعرف الولايات الجديدة (59–69) نستعمل الرقم الجديد، وإلا القديم.
function courierWilaya_(w69, w58) {
  if (!(w69 > 58)) return w69 || w58;
  const ids = cached_('eco_wilayas', 21600, function () {
    const r = eco_('GET', 'get/wilayas');
    return rowsOf_(r.data).map(function (x) { return parseInt(x.wilaya_id || x.id, 10); });
  });
  return ids.indexOf(w69) !== -1 ? w69 : w58;
}

function matchCommune_(wilayaId, fr, ar) {
  const list = cached_('eco_communes_' + wilayaId, 21600, function () {
    return rowsOf_(eco_('GET', 'get/communes?wilaya_id=' + wilayaId).data)
      .filter(function (c) { return !c.wilaya_id || parseInt(c.wilaya_id, 10) === wilayaId; })
      .map(function (c) { return { nom: c.nom, code_postal: c.code_postal, desk: c.has_stop_desk }; });
  });
  const want = [norm_(fr), norm_(ar)].filter(String);
  for (let i = 0; i < list.length; i++) if (want.indexOf(norm_(list[i].nom)) !== -1) return list[i];
  return null;
}

function feeFor_(w69, w58, desk) {
  const fees = cached_('eco_fees', 21600, function () {
    const d = eco_('GET', 'get/fees').data || {};
    return rowsOf_(d.livraison || d);
  });
  const id = courierWilaya_(parseInt(w69, 10), parseInt(w58, 10));
  const f = fees.filter(function (x) { return parseInt(x.wilaya_id, 10) === id; })[0];
  if (!f) return null;
  const home = parseInt(f.tarif || f.tarif_domicile || f.home, 10);
  const stop = parseInt(f.tarif_stopdesk || f.tarif_stop_desk || f.stopdesk, 10);
  return desk === undefined ? { home: home || null, desk: stop || null } : (desk ? stop : home);
}

// ───────── أدوات عامة ─────────
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#0d4a3c').setFontColor('#ffffff');
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList([ST.NEW, ST.CONFIRMED, ST.SENT, 'ملغى', ST.ERROR], true).build();
    sh.getRange(2, COLS.indexOf('الحالة') + 1, 1000, 1).setDataValidation(rule);
  } else {
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    COLS.forEach(function (c) { if (head.indexOf(c) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(c); });
  }
  return sh;
}
function headerIndex_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], h = {};
  head.forEach(function (c, i) { h[c] = i; });
  return h;
}
function findRow_(sh, col, value) {
  const h = headerIndex_(sh), last = sh.getLastRow();
  if (last < 2) return 0;
  const from = Math.max(2, last - 200);
  const vals = sh.getRange(from, h[col] + 1, last - from + 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === value) return from + i;
  return 0;
}
function notify_(rec) {
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: 'طلب جديد ' + rec['رقم الطلب'] + ' — ' + rec['الولاية'] + ' / ' + rec['البلدية'],
    htmlBody: '<div dir="rtl" style="font-family:Tahoma,Arial;font-size:15px"><h3>طلب جديد: ' + PRODUCT_NAME + '</h3>' +
      COLS.slice(0, 12).map(function (c) {
        return '<b>' + c + ':</b> ' + esc_(String(rec[c]).replace(/^'/, '')) + '<br>';
      }).join('') + '<p>بعد الاتصال بالزبون غيّر «الحالة» إلى «مؤكَّد» ثم: 🚚 التوصيل ← إرسال الطلبات المؤكَّدة.</p></div>'
  });
}
function cached_(key, ttl, fn) {
  const c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit) return JSON.parse(hit);
  const v = fn();
  try { c.put(key, JSON.stringify(v), ttl); } catch (e) { /* أكبر من حد الكاش */ }
  return v;
}
function rowsOf_(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data;
    return Object.keys(d).map(function (k) { return d[k]; }).filter(function (x) { return x && typeof x === 'object'; });
  }
  return [];
}
function keyed_(d) {                         // {tracking: row} أو {data:{...}} أو [{tracking,...}]
  const out = {};
  if (d && d.data && typeof d.data === 'object') d = d.data;
  if (Array.isArray(d)) d.forEach(function (x) { if (x && x.tracking) out[x.tracking] = x; });
  else if (d && typeof d === 'object') Object.keys(d).forEach(function (k) {
    const x = d[k]; if (x && typeof x === 'object') out[x.tracking || k] = x;
  });
  return out;
}
function statusText_(info) {
  let s = info.status || info.statut || info.last_status || '';
  const act = info.activity || info.history || info.etapes;
  if (!s && Array.isArray(act) && act.length) { const l = act[act.length - 1]; s = l.status || l.statut || l.event || ''; }
  return String(s || 'غير معروف');
}
function okFlag_(v) { return v === true || v === 1 || v === '1' || v === 'true'; }
function count_(d) { return rowsOf_(d).length; }
function localPhone_(p) { p = String(p).replace(/^'/, '').replace(/[^\d]/g, ''); return p.indexOf('213') === 0 ? '0' + p.slice(3) : p; }
function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ًͯ-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().replace(/[^a-zء-ي]/g, '');
}
function clean_(v, max) { return String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/^[=+\-@]+/, '').trim().slice(0, max); }
function esc_(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function toast_(m) { try { SpreadsheetApp.getActiveSpreadsheet().toast(m, '🚚 التوصيل', 6); } catch (e) { console.log(m); } }

// شغّلها مرة من المحرر: تمنح الصلاحيات وتضيف طلبًا تجريبيًا
function testOrder() {
  const r = doPost({ parameter: { name: 'طلب تجريبي', phone: '0555000000', wilaya: '16 - الجزائر',
    commune: 'باب الوادي', commune_fr: 'Bab El Oued', wilaya_code: '16', wilaya_code_58: '16',
    delivery: 'إلى المنزل', qty: '1', orderId: 'TEST' + Date.now() } });
  console.log(r.getContent());
}
