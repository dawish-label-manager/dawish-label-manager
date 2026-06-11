(function(){
  'use strict';
  if (window.__DAWISH_DESKTOP_ENHANCEMENTS__) return;
  window.__DAWISH_DESKTOP_ENHANCEMENTS__ = true;

  const api = window.DawishDesktop;
  const state = {
    info: null,
    settings: {},
    printers: [],
    activity: [],
    activeTab: 'dashboard',
    locked: false,
    booted: false
  };

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
  function toast(msg){ if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg); }
  function nowText(){ return new Date().toLocaleString('ar-SA'); }



  function isMainAppVisible(){
    const login = document.getElementById('loginPage');
    const app = document.getElementById('app');
    return !!app && !app.classList.contains('hidden') && (!login || login.classList.contains('hidden'));
  }

  function syncDesktopVisibility(){
    const visible = isMainAppVisible();
    const dock = document.getElementById('desktopProDock');
    const modal = document.getElementById('desktopProModal');
    const lock = document.getElementById('desktopLock');
    if (dock) dock.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      if (modal) modal.classList.remove('active');
      if (lock) lock.classList.remove('active');
    }
  }

  function hookLoginVisibility(){
    const originalShowApp = window.showApp;
    if (typeof originalShowApp === 'function' && !originalShowApp.__desktopWrapped) {
      window.showApp = function(){
        const result = originalShowApp.apply(this, arguments);
        setTimeout(syncDesktopVisibility, 60);
        return result;
      };
      window.showApp.__desktopWrapped = true;
    }
    const originalShowLogin = window.showLogin;
    if (typeof originalShowLogin === 'function' && !originalShowLogin.__desktopWrapped) {
      window.showLogin = function(){
        const result = originalShowLogin.apply(this, arguments);
        setTimeout(syncDesktopVisibility, 60);
        return result;
      };
      window.showLogin.__desktopWrapped = true;
    }
    const app = document.getElementById('app');
    const login = document.getElementById('loginPage');
    const observer = new MutationObserver(syncDesktopVisibility);
    if (app) observer.observe(app, { attributes:true, attributeFilter:['class'] });
    if (login) observer.observe(login, { attributes:true, attributeFilter:['class'] });
    setInterval(syncDesktopVisibility, 1200);
  }

  function getLocalSnapshot(){
    const local = {};
    try {
      for (let i=0;i<localStorage.length;i++) {
        const k = localStorage.key(i);
        local[k] = localStorage.getItem(k);
      }
    } catch(e) {}
    return {
      localStorage: local,
      queue: getQueue(),
      exportedAt: new Date().toISOString(),
      url: location.href,
      version: state.info?.version || ''
    };
  }

  function getQueue(){
    try {
      if (Array.isArray(window.barcodeQueue)) return window.barcodeQueue;
      if (Array.isArray(window.fiyazPrintQueue)) return window.fiyazPrintQueue;
      const possibleKeys = ['barcodeQueue','dawishBarcodeQueue','fiyazQueue','printQueue','lastBarcodeQueue'];
      for (const k of possibleKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e) {}
    return [];
  }

  function queueStats(){
    const q = getQueue();
    const total = q.reduce((sum, item) => sum + Number(item.count || item.qty || item.quantity || 1), 0);
    const needReview = q.filter(item => !(item.barcode || item.code || item.sku) || !(item.name || item.title)).length;
    const map = new Map();
    q.forEach(item => {
      const key = String(item.id || item.barcode || item.code || item.sku || item.name || Math.random());
      map.set(key, (map.get(key) || 0) + 1);
    });
    const duplicates = Array.from(map.values()).filter(n => n > 1).length;
    return { total, products: q.length, needReview, duplicates, queue: q };
  }

  async function boot(){
    injectCss();
    createDock();
    createControlCenter();
    createLockScreen();
    bindGlobalErrors();
    hookLoginVisibility();
    await refreshDesktopState();
    renderAll();
    syncDesktopVisibility();
    autoActivity('system', 'تم فتح البرنامج');

    api?.onOpenControlCenter?.((tab) => openControlCenter(tab || 'dashboard'));
    api?.onUpdateAvailable?.(() => { openControlCenter('updates'); setStatus('يوجد تحديث جديد جاهز للتنزيل.'); });
    api?.onUpdateDownloaded?.(() => { openControlCenter('updates'); setStatus('تم تنزيل التحديث. أعد تشغيل البرنامج للتثبيت.'); });
    api?.onUpdateError?.((err) => { openControlCenter('updates'); setStatus('تعذر فحص التحديثات: ' + err); });

    setInterval(renderDashboard, 2500);
    setInterval(() => autoSaveLastQueue(), 5000);
  }

  async function refreshDesktopState(){
    try { state.info = await api?.getInfo?.(); } catch(e) {}
    try { state.settings = await api?.getSettings?.() || {}; } catch(e) {}
    try { state.printers = await api?.getPrinters?.() || []; } catch(e) {}
    try { state.activity = await api?.listActivity?.() || []; } catch(e) {}
  }

  function injectCss(){
    if ($('desktopEnhancementsCss')) return;
    const style = document.createElement('style');
    style.id = 'desktopEnhancementsCss';
    style.textContent = `
      .desktop-pro-dock{display:none;position:fixed;left:18px;bottom:18px;z-index:9998;display:none;gap:8px;align-items:center;background:rgba(255,253,247,.94);backdrop-filter:blur(16px);border:1px solid #ded6c5;border-radius:22px;padding:8px;box-shadow:0 18px 45px rgba(45,38,24,.16);direction:rtl}
      .desktop-pro-dock button{border:0;border-radius:16px;padding:11px 13px;font-weight:1000;cursor:pointer;background:#315f4f;color:#fff;font-family:inherit}
      .desktop-pro-dock .soft{background:#f7f2e7;color:#26362d;border:1px solid #dfd4bd}
      .desktop-pro-modal{position:fixed;inset:0;z-index:10000;background:rgba(18,25,21,.48);display:none;align-items:center;justify-content:center;padding:18px;direction:rtl}
      .desktop-pro-modal.active{display:flex}
      .desktop-pro-card{width:min(1180px,calc(100vw - 36px));height:min(780px,calc(100vh - 36px));background:#fffdf7;border:1px solid #ded6c5;border-radius:30px;box-shadow:0 35px 100px rgba(0,0,0,.28);display:grid;grid-template-columns:250px 1fr;overflow:hidden;color:#1d241f;font-family:inherit}
      .desktop-pro-side{background:linear-gradient(180deg,#17231d,#24362d);color:#fff;padding:18px;display:grid;align-content:start;gap:8px}
      .desktop-pro-logo{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.12)}
      .desktop-pro-logo img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:16px;padding:4px}
      .desktop-pro-logo strong{display:block;font-size:16px;line-height:1.35}.desktop-pro-logo small{color:rgba(255,255,255,.68);font-weight:800}
      .desktop-pro-tab{border:1px solid transparent;background:transparent;color:rgba(255,255,255,.82);border-radius:16px;padding:12px;text-align:right;font-weight:1000;cursor:pointer;font-family:inherit}
      .desktop-pro-tab.active{background:#fff8e7;color:#17231d;border-color:rgba(201,155,72,.4)}
      .desktop-pro-main{padding:18px;overflow:auto;background:radial-gradient(circle at top right,#fff8e9,#f3efe5 45%,#ebe5d7)}
      .desktop-pro-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.desktop-pro-head h2{margin:0;font-size:24px}.desktop-pro-head p{margin:6px 0 0;color:#716f66;font-weight:850}
      .desktop-close{border:0;background:#bd4e4e;color:#fff;border-radius:14px;padding:10px 13px;font-weight:1000;cursor:pointer;font-family:inherit}
      .desktop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.desktop-card{background:rgba(255,253,247,.95);border:1px solid #ded6c5;border-radius:22px;padding:14px;box-shadow:0 8px 24px rgba(45,38,24,.08)}
      .desktop-card small{display:block;color:#716f66;font-weight:900;margin-bottom:7px}.desktop-card strong{font-size:25px;color:#203f35;font-weight:1000}.desktop-card.dark{background:linear-gradient(135deg,#17231d,#2a3e33);color:#fff}.desktop-card.dark small{color:rgba(255,255,255,.7)}.desktop-card.dark strong{color:#f2ca6b}
      .desktop-section{display:none}.desktop-section.active{display:block}.desktop-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.desktop-actions button,.desktop-btn{border:0;border-radius:15px;padding:11px 14px;font-weight:1000;cursor:pointer;background:#315f4f;color:#fff;font-family:inherit}.desktop-actions .soft,.desktop-btn.soft{background:#f7f2e7;color:#26362d;border:1px solid #dfd4bd}.desktop-actions .danger{background:#bd4e4e}
      .desktop-input{width:100%;border:1px solid #d9d0bd;border-radius:16px;padding:12px;background:#fffef9;font-family:inherit;font-weight:850}.desktop-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.desktop-log{display:grid;gap:8px;max-height:360px;overflow:auto}.desktop-log-item{background:#fffef9;border:1px solid #ded6c5;border-radius:16px;padding:11px}.desktop-log-item strong{display:block}.desktop-log-item small{color:#716f66;font-weight:850}
      .desktop-status{background:#fff8e7;border:1px solid #e9d8a8;border-radius:18px;padding:12px;margin:12px 0;color:#5c431c;font-weight:950}.desktop-table{width:100%;border-collapse:separate;border-spacing:0 8px}.desktop-table td,.desktop-table th{text-align:right;padding:10px;background:#fffef9;border-top:1px solid #ded6c5;border-bottom:1px solid #ded6c5}.desktop-table th{background:#f7f2e7}.desktop-table td:first-child,.desktop-table th:first-child{border-radius:0 14px 14px 0;border-right:1px solid #ded6c5}.desktop-table td:last-child,.desktop-table th:last-child{border-radius:14px 0 0 14px;border-left:1px solid #ded6c5}
      .desktop-lock{position:fixed;inset:0;z-index:10001;display:none;align-items:center;justify-content:center;background:linear-gradient(135deg,#17231d,#2a3e33);direction:rtl}.desktop-lock.active{display:flex}.desktop-lock-card{width:min(420px,calc(100vw - 28px));background:#fffdf7;border-radius:30px;padding:26px;text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.35)}.desktop-lock-card img{width:98px;height:98px;object-fit:contain}.desktop-lock-card h2{margin:8px 0 4px}.desktop-lock-card p{color:#716f66;font-weight:850}
      @media(max-width:780px){.desktop-pro-card{grid-template-columns:1fr;height:calc(100vh - 20px);width:calc(100vw - 20px);border-radius:24px}.desktop-pro-side{display:flex;overflow:auto;padding:10px}.desktop-pro-logo{display:none}.desktop-pro-tab{white-space:nowrap}.desktop-row{grid-template-columns:1fr}.desktop-pro-main{padding:12px}.desktop-pro-dock{right:10px;left:10px;bottom:86px;justify-content:center}}
    `;
    document.head.appendChild(style);
  }

  function createDock(){
    if ($('desktopProDock')) return;
    const dock = document.createElement('div');
    dock.id = 'desktopProDock';
    dock.className = 'desktop-pro-dock';
    dock.innerHTML = `
      <button onclick="window.DawishPro.open('dashboard')">مركز التحكم</button>
      <button class="soft" onclick="window.DawishPro.open('printer')">الطابعة</button>
      <button class="soft" onclick="window.DawishPro.reviewPrint()">مراجعة الطباعة</button>
    `;
    document.body.appendChild(dock);
  }

  function createControlCenter(){
    if ($('desktopProModal')) return;
    const modal = document.createElement('div');
    modal.id = 'desktopProModal';
    modal.className = 'desktop-pro-modal';
    modal.innerHTML = `
      <div class="desktop-pro-card">
        <aside class="desktop-pro-side">
          <div class="desktop-pro-logo"><img src="../assets/logo.png"><div><strong>نظام إدارة الملصقات</strong><small>عطارة الدويش</small></div></div>
          ${tabButton('dashboard','مركز التحكم')}
          ${tabButton('printer','إعدادات الطابعة')}
          ${tabButton('safeprint','الطباعة الآمنة')}
          ${tabButton('backup','النسخ الاحتياطي')}
          ${tabButton('maintenance','الصيانة')}
          ${tabButton('activity','سجل العمليات')}
          ${tabButton('devices','إدارة الأجهزة')}
          ${tabButton('updates','التحديثات')}
          ${tabButton('security','القفل والتدريب')}
        </aside>
        <main class="desktop-pro-main">
          <div class="desktop-pro-head"><div><h2 id="desktopProTitle">مركز التحكم</h2><p id="desktopProSubtitle">لوحة تشغيل البرنامج على الكمبيوتر</p></div><button class="desktop-close" onclick="window.DawishPro.close()">إغلاق</button></div>
          <div id="desktopStatus" class="desktop-status hidden"></div>
          <section id="desktopSec-dashboard" class="desktop-section"></section>
          <section id="desktopSec-printer" class="desktop-section"></section>
          <section id="desktopSec-safeprint" class="desktop-section"></section>
          <section id="desktopSec-backup" class="desktop-section"></section>
          <section id="desktopSec-maintenance" class="desktop-section"></section>
          <section id="desktopSec-activity" class="desktop-section"></section>
          <section id="desktopSec-devices" class="desktop-section"></section>
          <section id="desktopSec-updates" class="desktop-section"></section>
          <section id="desktopSec-security" class="desktop-section"></section>
        </main>
      </div>`;
    document.body.appendChild(modal);
  }

  function tabButton(id, label){ return `<button class="desktop-pro-tab" data-tab="${id}" onclick="window.DawishPro.open('${id}')">${label}</button>`; }

  function createLockScreen(){
    if ($('desktopLock')) return;
    const lock = document.createElement('div');
    lock.id = 'desktopLock';
    lock.className = 'desktop-lock';
    lock.innerHTML = `<div class="desktop-lock-card"><img src="../assets/logo.png"><h2>البرنامج مقفل</h2><p>أدخل رمز المدير للمتابعة</p><input id="desktopLockPin" class="desktop-input" type="password" placeholder="رمز الدخول"><div class="desktop-actions" style="justify-content:center"><button onclick="window.DawishPro.unlock()">فتح القفل</button></div></div>`;
    document.body.appendChild(lock);
  }

  function openControlCenter(tab){
    if (!isMainAppVisible()) { syncDesktopVisibility(); return; }
    state.activeTab = tab || 'dashboard';
    $('desktopProModal')?.classList.add('active');
    renderAll();
  }
  function closeControlCenter(){ $('desktopProModal')?.classList.remove('active'); }
  function setStatus(text){ const el=$('desktopStatus'); if(!el) return; el.textContent=text; el.classList.toggle('hidden', !text); }

  function renderAll(){
    document.querySelectorAll('.desktop-pro-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === state.activeTab));
    document.querySelectorAll('.desktop-section').forEach(s => s.classList.toggle('active', s.id === 'desktopSec-' + state.activeTab));
    const titles = {
      dashboard:['مركز التحكم','حالة البرنامج والطابعة والاتصال والملصقات'], printer:['إعدادات الطابعة','اختيار الطابعة ومقاس الملصق وتجربة الطباعة'], safeprint:['الطباعة الآمنة','مراجعة القائمة قبل الطباعة أو الإرسال'], backup:['النسخ الاحتياطي','تصدير واستيراد بيانات البرنامج'], maintenance:['الصيانة','فحص سريع للكاش والسجلات وإعادة التحميل'], activity:['سجل العمليات','كل عمليات اليوم والموظفين والأخطاء'], devices:['إدارة الأجهزة','تعريف جهاز الإدارة أو المستودع أو الكاشير'], updates:['التحديثات','فحص وتثبيت تحديثات البرنامج'], security:['القفل والتدريب','قفل الشاشة ووضع التدريب']
    };
    const [t,sub] = titles[state.activeTab] || titles.dashboard;
    if ($('desktopProTitle')) $('desktopProTitle').textContent = t;
    if ($('desktopProSubtitle')) $('desktopProSubtitle').textContent = sub;
    renderDashboard(); renderPrinter(); renderSafePrint(); renderBackup(); renderMaintenance(); renderActivity(); renderDevices(); renderUpdates(); renderSecurity();
  }

  function renderDashboard(){
    const el = $('desktopSec-dashboard'); if (!el) return;
    const qs = queueStats();
    const online = navigator.onLine ? 'متصل' : 'غير متصل';
    const printer = state.settings.printerName || state.printers.find(p=>p.isDefault)?.name || 'غير محددة';
    el.innerHTML = `<div class="desktop-grid">
      <div class="desktop-card dark"><small>حالة النظام</small><strong>${online}</strong></div>
      <div class="desktop-card"><small>الطابعة</small><strong style="font-size:18px">${esc(printer)}</strong></div>
      <div class="desktop-card"><small>جاهز للطباعة</small><strong>${qs.total}</strong></div>
      <div class="desktop-card"><small>عدد المنتجات</small><strong>${qs.products}</strong></div>
      <div class="desktop-card"><small>تحتاج مراجعة</small><strong>${qs.needReview}</strong></div>
      <div class="desktop-card"><small>إصدار البرنامج</small><strong>${esc(state.info?.version || '1.1.0')}</strong></div>
    </div>
    <div class="desktop-actions"><button onclick="window.DawishPro.open('safeprint')">مراجعة الطباعة</button><button class="soft" onclick="window.DawishPro.open('printer')">إعدادات الطابعة</button><button class="soft" onclick="window.DawishPro.backup()">نسخة احتياطية الآن</button><button class="soft" onclick="window.DawishPro.lock()">قفل البرنامج</button></div>`;
  }

  function renderPrinter(){
    const el = $('desktopSec-printer'); if(!el) return;
    const options = state.printers.map(p => `<option value="${esc(p.name)}" ${p.name===state.settings.printerName?'selected':''}>${esc(p.name)}${p.isDefault?' — الافتراضية':''}</option>`).join('');
    el.innerHTML = `<div class="desktop-card"><div class="desktop-row"><div><label>الطابعة</label><select id="desktopPrinterName" class="desktop-input"><option value="">اختيار الطابعة</option>${options}</select></div><div><label>مقاس الملصق</label><select id="desktopLabelSize" class="desktop-input"><option value="58x40">58 × 40 mm</option><option value="58x30">58 × 30 mm</option><option value="80x50">80 × 50 mm</option></select></div></div><div class="desktop-actions"><button onclick="window.DawishPro.savePrinter()">حفظ الإعدادات</button><button class="soft" onclick="window.DawishPro.refreshPrinters()">تحديث قائمة الطابعات</button><button class="soft" onclick="window.DawishPro.testPrint()">تجربة طباعة</button></div></div>`;
    const s = $('desktopLabelSize'); if (s) s.value = state.settings.labelSize || '58x40';
  }

  function renderSafePrint(){
    const el = $('desktopSec-safeprint'); if(!el) return;
    const qs = queueStats();
    const rows = qs.queue.slice(0,20).map((item,i)=>`<tr><td>${i+1}</td><td>${esc(item.name||item.title||'منتج')}</td><td>${esc(item.weight||item.variant||'—')}</td><td>${Number(item.count||item.qty||item.quantity||1)}</td><td>${esc(item.barcode||item.code||item.sku||'يحتاج مراجعة')}</td></tr>`).join('');
    el.innerHTML = `<div class="desktop-grid"><div class="desktop-card dark"><small>عدد الملصقات</small><strong>${qs.total}</strong></div><div class="desktop-card"><small>عدد المنتجات</small><strong>${qs.products}</strong></div><div class="desktop-card"><small>نواقص</small><strong>${qs.needReview}</strong></div><div class="desktop-card"><small>تكرارات</small><strong>${qs.duplicates}</strong></div></div><div class="desktop-actions"><button onclick="window.DawishPro.approvePrint()">اعتماد الطباعة</button><button class="soft" onclick="window.DawishPro.restoreQueue()">استرجاع آخر قائمة</button><button class="soft" onclick="window.DawishPro.autoSaveQueue(true)">حفظ القائمة الحالية</button></div><table class="desktop-table"><thead><tr><th>#</th><th>المنتج</th><th>الحجم</th><th>العدد</th><th>الباركود</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد منتجات في قائمة الطباعة الحالية</td></tr>'}</tbody></table>`;
  }

  function renderBackup(){
    const el=$('desktopSec-backup'); if(!el) return;
    el.innerHTML = `<div class="desktop-card"><strong>النسخ الاحتياطي</strong><p class="muted">يحفظ بيانات localStorage والقائمة الحالية وإعدادات البرنامج في ملف JSON.</p><div class="desktop-actions"><button onclick="window.DawishPro.backup()">تصدير نسخة احتياطية</button><button class="soft" onclick="window.DawishPro.importBackup()">استيراد نسخة احتياطية</button></div></div>`;
  }
  function renderMaintenance(){
    const el=$('desktopSec-maintenance'); if(!el) return;
    el.innerHTML = `<div class="desktop-card"><strong>صيانة سريعة</strong><p class="muted">تفحص مجلد البيانات والسجلات وتساعد على إعادة تحميل الكاش عند حدوث مشكلة.</p><div class="desktop-actions"><button onclick="window.DawishPro.maintenance()">تشغيل الصيانة</button><button class="soft" onclick="location.reload()">إعادة تحميل البرنامج</button><button class="danger" onclick="window.DawishPro.clearOldLogs()">مسح سجل العمليات</button></div><div id="maintenanceResult"></div></div>`;
  }
  function renderActivity(){
    const el=$('desktopSec-activity'); if(!el) return;
    const logs = (state.activity||[]).slice(0,80).map(x=>`<div class="desktop-log-item"><strong>${esc(x.message)}</strong><small>${new Date(x.at).toLocaleString('ar-SA')} — ${esc(x.type)} — ${esc(x.device||'')}</small></div>`).join('');
    el.innerHTML = `<div class="desktop-actions"><button class="soft" onclick="window.DawishPro.reloadActivity()">تحديث السجل</button><button class="danger" onclick="window.DawishPro.clearOldLogs()">مسح السجل</button></div><div class="desktop-log">${logs || '<div class="desktop-log-item">لا يوجد سجل عمليات بعد</div>'}</div>`;
  }
  function renderDevices(){
    const el=$('desktopSec-devices'); if(!el) return;
    el.innerHTML = `<div class="desktop-card"><div class="desktop-row"><div><label>اسم الجهاز</label><input id="desktopDeviceName" class="desktop-input" value="${esc(state.settings.deviceName || state.info?.device || '')}"></div><div><label>دور الجهاز</label><select id="desktopDeviceRole" class="desktop-input"><option value="admin">جهاز الإدارة</option><option value="cashier">جهاز الكاشير</option><option value="warehouse">جهاز المستودع</option><option value="labels">جهاز الملصقات</option></select></div></div><div class="desktop-actions"><button onclick="window.DawishPro.saveDevice()">حفظ الجهاز</button></div></div>`;
    const role=$('desktopDeviceRole'); if(role) role.value=state.settings.deviceRole || 'labels';
  }
  function renderUpdates(){
    const el=$('desktopSec-updates'); if(!el) return;
    el.innerHTML = `<div class="desktop-card"><strong>التحديثات</strong><p class="muted">الإصدار الحالي: ${esc(state.info?.version || '1.1.0')}</p><div class="desktop-actions"><button onclick="window.DawishPro.checkUpdates()">فحص التحديثات</button><button class="soft" onclick="window.DawishPro.installUpdate()">تثبيت التحديث المحمل</button></div></div>`;
  }
  function renderSecurity(){
    const el=$('desktopSec-security'); if(!el) return;
    el.innerHTML = `<div class="desktop-card"><div class="desktop-row"><div><label>رمز القفل</label><input id="desktopPin" class="desktop-input" type="password" value="${esc(state.settings.lockPin || '1234')}"></div><div><label>وضع التدريب</label><select id="desktopTraining" class="desktop-input"><option value="false">متوقف</option><option value="true">مفعل</option></select></div></div><div class="desktop-actions"><button onclick="window.DawishPro.saveSecurity()">حفظ</button><button class="soft" onclick="window.DawishPro.lock()">قفل الآن</button></div></div>`;
    const tr=$('desktopTraining'); if(tr) tr.value=String(!!state.settings.trainingMode);
  }

  async function autoActivity(type, message, details){ try { await api?.addActivity?.({type,message,details}); state.activity = await api?.listActivity?.() || state.activity; } catch(e){} }
  function autoSaveLastQueue(show){ try { localStorage.setItem('dawishLastPrintQueue', JSON.stringify({at:new Date().toISOString(), queue:getQueue()})); if(show) toast('تم حفظ القائمة الحالية'); } catch(e){} }

  function restoreQueue(){
    try {
      const data = JSON.parse(localStorage.getItem('dawishLastPrintQueue') || '{}');
      if (!Array.isArray(data.queue) || !data.queue.length) return toast('لا توجد قائمة محفوظة');
      if (Array.isArray(window.barcodeQueue)) window.barcodeQueue.splice(0, window.barcodeQueue.length, ...data.queue);
      localStorage.setItem('barcodeQueue', JSON.stringify(data.queue));
      autoActivity('queue','تم استرجاع آخر قائمة طباعة', {count:data.queue.length});
      toast('تم استرجاع آخر قائمة طباعة');
      renderAll();
    } catch(e){ toast('تعذر استرجاع القائمة'); }
  }

  function bindGlobalErrors(){
    window.addEventListener('error', e => autoActivity('error','خطأ في البرنامج', {message:e.message, file:e.filename, line:e.lineno}));
    window.addEventListener('unhandledrejection', e => autoActivity('error','خطأ غير متوقع', {reason:String(e.reason)}));
    window.addEventListener('online', () => autoActivity('network','عاد الاتصال بالإنترنت'));
    window.addEventListener('offline', () => autoActivity('network','انقطع الاتصال بالإنترنت'));
  }

  window.DawishPro = {
    open: openControlCenter,
    close: closeControlCenter,
    reviewPrint: () => openControlCenter('safeprint'),
    async refreshPrinters(){ state.printers = await api?.getPrinters?.() || []; renderPrinter(); toast('تم تحديث الطابعات'); },
    async savePrinter(){ const patch={printerName:$('desktopPrinterName')?.value||'',labelSize:$('desktopLabelSize')?.value||'58x40'}; state.settings=await api?.setSettings?.(patch)||{...state.settings,...patch}; toast('تم حفظ إعدادات الطابعة'); renderAll(); },
    testPrint(){ autoActivity('print','تم تنفيذ تجربة طباعة'); const w=window.open('', '_blank', 'width=360,height=420'); if(w){ w.document.write('<html dir="rtl"><body style="font-family:Tahoma;text-align:center;padding:20px"><h2>تجربة طباعة</h2><p>عطارة الدويش</p><svg id="barcode"></svg><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script><script>JsBarcode("#barcode","123456789012",{width:2,height:60,displayValue:true});setTimeout(()=>print(),500)<\/script></body></html>'); w.document.close(); } else window.print(); },
    approvePrint(){ const qs=queueStats(); if(!qs.total) return toast('لا توجد ملصقات للطباعة'); if(confirm(`سيتم اعتماد طباعة ${qs.total} ملصق لعدد ${qs.products} منتج. هل تريد المتابعة؟`)){ autoActivity('print','تم اعتماد الطباعة الآمنة',{total:qs.total,products:qs.products}); window.print(); } },
    autoSaveQueue: autoSaveLastQueue,
    restoreQueue,
    async backup(){ const res=await api?.saveBackup?.(getLocalSnapshot()); if(res?.ok){ toast('تم حفظ النسخة الاحتياطية'); await autoActivity('backup','تم تصدير نسخة احتياطية'); } },
    async importBackup(){ const res=await api?.loadBackup?.(); if(!res?.ok) return; const payload=res.data?.payload || res.data; const ls=payload?.localStorage || payload?.payload?.localStorage; if(ls && confirm('سيتم استيراد بيانات النسخة الاحتياطية إلى هذا الجهاز. متابعة؟')){ Object.keys(ls).forEach(k=>localStorage.setItem(k, ls[k])); toast('تم الاستيراد. سيتم إعادة تحميل البرنامج'); setTimeout(()=>location.reload(),700); } },
    async maintenance(){ const res=await api?.runMaintenance?.(); const el=$('maintenanceResult'); if(el) el.innerHTML='<div class="desktop-status">'+(res?.checks||[]).map(esc).join('<br>')+'</div>'; await autoActivity('maintenance','تم تشغيل الصيانة'); },
    async reloadActivity(){ state.activity=await api?.listActivity?.()||[]; renderActivity(); },
    async clearOldLogs(){ if(confirm('مسح سجل العمليات؟')){ await api?.clearActivity?.(); state.activity=[]; renderActivity(); toast('تم مسح السجل'); } },
    async saveDevice(){ const patch={deviceName:$('desktopDeviceName')?.value||'',deviceRole:$('desktopDeviceRole')?.value||'labels'}; state.settings=await api?.setSettings?.(patch)||{...state.settings,...patch}; toast('تم حفظ بيانات الجهاز'); },
    async checkUpdates(){ setStatus('جاري فحص التحديثات...'); const res=await api?.checkUpdates?.(); setStatus(res?.ok ? 'تم فحص التحديثات. إذا وجد إصدار جديد سيظهر هنا.' : 'لا يمكن فحص التحديثات الآن أو أن البرنامج في وضع التطوير.'); },
    async installUpdate(){ try{ await api?.installUpdate?.(); }catch(e){ toast('لا يوجد تحديث محمل للتثبيت'); } },
    async saveSecurity(){ const patch={lockPin:$('desktopPin')?.value||'1234',trainingMode:$('desktopTraining')?.value==='true'}; state.settings=await api?.setSettings?.(patch)||{...state.settings,...patch}; toast('تم حفظ إعدادات القفل والتدريب'); },
    lock(){ if(!isMainAppVisible()) return; state.locked=true; $('desktopLock')?.classList.add('active'); },
    unlock(){ const pin=$('desktopLockPin')?.value||''; if(pin===String(state.settings.lockPin||'1234')){ $('desktopLock')?.classList.remove('active'); if($('desktopLockPin')) $('desktopLockPin').value=''; autoActivity('security','تم فتح قفل البرنامج'); } else toast('رمز الدخول غير صحيح'); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
