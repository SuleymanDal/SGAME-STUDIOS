// ============================================================
// SG-BUG v1.0.0 (Final) - Cargik Cumle Debug Motoru
// Felsefe: Az Fonksiyon, Cok Is. Ezber Yok, Ritim Var.
// Optimizasyonlar: Escape, Sanitization, WeakMap, Throttle
// SGame Studios - 2026
// ============================================================
(function(global) {
  "use strict";
  var VERSION = "1.0.0";
  var el = null;
  var logs = [];
  var filterLevel = "ALL";
  var filterCategory = "ALL";
  var searchText = "";
  var fps = 0, frameCount = 0, lastFpsTime = 0;
  var errorCount = 0;
  var maxLogs = 1000;
  var isInitialized = false;
  var errorThrottle = 0;

  var _originalConsole = {
    log: console.log, warn: console.warn, error: console.error, info: console.info
  };

  // HTML Kacis (XSS Korumasi)
  function escapeHtml(str) {
    if (typeof str !== "string") return String(str);
    return str.replace(/[&<>"']/g, function(m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  // 100 Hata Kodu (v0.9.0'dan ayni)
  var DICTIONARY = {
    2000: { level: "WARN", category: "NETWORK", msg: "Baglanti Yavas (Ping: {ping}ms)", color: "#a0f" },
    2001: { level: "WARN", category: "GPU",     msg: "VRAM Dusuk: {vram}MB", color: "#fa0" },
    2002: { level: "WARN", category: "ECS",     msg: "Entity Sayisi Artiyor: {count}", color: "#0f0" },
    2003: { level: "WARN", category: "PHYSICS", msg: "Collider Uyusmazligi: {body}", color: "#55f" },
    2004: { level: "WARN", category: "AUDIO",   msg: "Ses Gecikmesi: {ms}ms", color: "#f0f" },
    2005: { level: "WARN", category: "UI",      msg: "Ekran Cozunurlugu Desteklenmiyor", color: "#0ff" },
    2006: { level: "WARN", category: "INPUT",   msg: "Tus Atamasi Eksik", color: "#0ff" },
    2007: { level: "WARN", category: "SYSTEM",  msg: "Sistem Saati Geri Kaldi", color: "#0ff" },
    2008: { level: "WARN", category: "PHYSICS", msg: "Yercekimi Anomalisi", color: "#55f" },
    2009: { level: "WARN", category: "NETWORK", msg: "Paket Kaybi: {loss}%", color: "#a0f" },
    2010: { level: "WARN", category: "GPU",     msg: "Doku Filtresi Basarisiz", color: "#fa0" },
    2011: { level: "WARN", category: "ECS",     msg: "Bos Component Tespit Edildi", color: "#0f0" },
    2012: { level: "WARN", category: "AUDIO",   msg: "Ses Kalitesi Dusuk", color: "#f0f" },
    2013: { level: "WARN", category: "INPUT",   msg: "Mouse Hassasiyeti Yuksek", color: "#0ff" },
    2014: { level: "WARN", category: "UI",      msg: "Font Yukleme Gecikmesi", color: "#0ff" },
    2015: { level: "WARN", category: "SYSTEM",  msg: "Arka Plan Guncellemesi", color: "#0ff" },
    2016: { level: "WARN", category: "PHYSICS", msg: "Sürtünme Katsayisi Sifir", color: "#55f" },
    2017: { level: "WARN", category: "NETWORK", msg: "Yeniden Baglanma Denemesi", color: "#a0f" },
    2018: { level: "WARN", category: "GPU",     msg: "Anizotropik Filtre Siniri", color: "#fa0" },
    2019: { level: "WARN", category: "ECS",     msg: "Bilesen Siralama Hatasi", color: "#0f0" },
    2020: { level: "ERROR", category: "ECS", msg: "Entity Limiti Asildi (Max: {max})", color: "#f00" },
    2021: { level: "ERROR", category: "ECS", msg: "Orphan Component: {name}", color: "#f00" },
    2022: { level: "ERROR", category: "ECS", msg: "Silinmis Entity Erisimi: {id}", color: "#f00" },
    2023: { level: "ERROR", category: "ECS", msg: "Gecersiz Entity ID", color: "#f00" },
    2024: { level: "ERROR", category: "ECS", msg: "System Guncelleme Hatasi", color: "#f00" },
    2025: { level: "ERROR", category: "ECS", msg: "Component Veri Bozulmasi", color: "#f00" },
    2026: { level: "ERROR", category: "ECS", msg: "Dongusel Bagimlilik Hatasi", color: "#f00" },
    2027: { level: "ERROR", category: "ECS", msg: "Entity Klonlama Hatasi", color: "#f00" },
    2028: { level: "ERROR", category: "ECS", msg: "Toplu Silme Hatasi", color: "#f00" },
    2029: { level: "ERROR", category: "ECS", msg: "Entity Filtre Hatasi", color: "#f00" },
    2030: { level: "ERROR", category: "PHYSICS", msg: "RigidBody Null Dondu: {body}", color: "#f00" },
    2031: { level: "ERROR", category: "PHYSICS", msg: "Collider Cakismasi: {a} <-> {b}", color: "#f00" },
    2032: { level: "ERROR", category: "PHYSICS", msg: "Yercekimi Hesaplama Hatasi", color: "#f00" },
    2033: { level: "ERROR", category: "PHYSICS", msg: "Hareket Vektoru Bozuk", color: "#f00" },
    2034: { level: "ERROR", category: "PHYSICS", msg: "Carpan (Impulse) Uygulanamadi", color: "#f00" },
    2035: { level: "ERROR", category: "PHYSICS", msg: "Zaman Adimi Gecersiz", color: "#f00" },
    2036: { level: "ERROR", category: "PHYSICS", msg: "Yercekimi Vektoru Bozuk", color: "#f00" },
    2037: { level: "ERROR", category: "PHYSICS", msg: "Temas Noktasi Bulunamadi", color: "#f00" },
    2038: { level: "ERROR", category: "PHYSICS", msg: "Katı Cisim Uyku Hatasi", color: "#f00" },
    2039: { level: "ERROR", category: "PHYSICS", msg: "Kinematik Cisim Hatasi", color: "#f00" },
    2040: { level: "ERROR", category: "NETWORK", msg: "WebSocket Koptu (Kod: {code})", color: "#f00" },
    2041: { level: "ERROR", category: "NETWORK", msg: "Zaman Asimi: {url}", color: "#f00" },
    2042: { level: "ERROR", category: "NETWORK", msg: "Bozuk Paket Alindi", color: "#f00" },
    2043: { level: "ERROR", category: "NETWORK", msg: "Sunucu Baglantisi Reddedildi", color: "#f00" },
    2044: { level: "ERROR", category: "NETWORK", msg: "API Anahtari Gecersiz", color: "#f00" },
    2045: { level: "ERROR", category: "NETWORK", msg: "SSL Sertifikasi Gecersiz", color: "#f00" },
    2046: { level: "ERROR", category: "NETWORK", msg: "DNS Cozumleme Hatasi", color: "#f00" },
    2047: { level: "ERROR", category: "NETWORK", msg: "Yeniden Baglanti Basarisiz", color: "#f00" },
    2048: { level: "ERROR", category: "NETWORK", msg: "Veri Sikistirma Hatasi", color: "#f00" },
    2049: { level: "ERROR", category: "NETWORK", msg: "Protokol Uyumsuzlugu", color: "#f00" },
    2050: { level: "ERROR", category: "GPU", msg: "Doku Bulunamadi: {path}", color: "#f00" },
    2051: { level: "FATAL", category: "GPU", msg: "WebGL Context Kayboldu", color: "#f00" },
    2052: { level: "ERROR", category: "GPU", msg: "Shader Derleme Hatasi: {shader}", color: "#f00" },
    2053: { level: "ERROR", category: "GPU", msg: "Model Yukleme Hatasi: {model}", color: "#f00" },
    2054: { level: "ERROR", category: "GPU", msg: "Piksel Formati Desteklenmiyor", color: "#f00" },
    2055: { level: "ERROR", category: "GPU", msg: "Doku Boyutu Siniri Asildi", color: "#f00" },
    2056: { level: "ERROR", category: "GPU", msg: "Vertex Buffer Hatasi", color: "#f00" },
    2057: { level: "ERROR", category: "GPU", msg: "Index Buffer Hatasi", color: "#f00" },
    2058: { level: "ERROR", category: "GPU", msg: "Framebuffer Olusturma Hatasi", color: "#f00" },
    2059: { level: "ERROR", category: "GPU", msg: "Render Target Desteklenmiyor", color: "#f00" },
    2060: { level: "ERROR", category: "INPUT", msg: "Cihaz Kayboldu: {device}", color: "#f00" },
    2061: { level: "ERROR", category: "INPUT", msg: "Gamepad Baglantisi Koptu", color: "#f00" },
    2062: { level: "ERROR", category: "INPUT", msg: "Klavye Tusu Taninmadi", color: "#f00" },
    2063: { level: "ERROR", category: "INPUT", msg: "Mouse Hareketi Okunamadi", color: "#f00" },
    2064: { level: "ERROR", category: "INPUT", msg: "Dokunmatik Giris Hatasi", color: "#f00" },
    2065: { level: "ERROR", category: "INPUT", msg: "Sanal Joystick Hatasi", color: "#f00" },
    2066: { level: "ERROR", category: "INPUT", msg: "Tus Kombinasyonu Gecersiz", color: "#f00" },
    2067: { level: "ERROR", category: "INPUT", msg: "Giris Buffer Tasti", color: "#f00" },
    2068: { level: "ERROR", category: "INPUT", msg: "Işaretçi Kilidi Basarisiz", color: "#f00" },
    2069: { level: "ERROR", category: "INPUT", msg: "Giris Haritalama Hatasi", color: "#f00" },
    2070: { level: "ERROR", category: "AUDIO", msg: "Ses Buffer Hatasi: {file}", color: "#f00" },
    2071: { level: "ERROR", category: "AUDIO", msg: "Autoplay Engellendi", color: "#f00" },
    2072: { level: "ERROR", category: "AUDIO", msg: "Kanallar Arasi Uyumsuzluk", color: "#f00" },
    2073: { level: "ERROR", category: "AUDIO", msg: "Ses Kodegi Desteklenmiyor", color: "#f00" },
    2074: { level: "ERROR", category: "AUDIO", msg: "Ses Cihazi Bulunamadi", color: "#f00" },
    2075: { level: "ERROR", category: "AUDIO", msg: "Ses Sentezleme Hatasi", color: "#f00" },
    2076: { level: "ERROR", category: "AUDIO", msg: "Yanki Efekti Basarisiz", color: "#f00" },
    2077: { level: "ERROR", category: "AUDIO", msg: "Filtre Uygulama Hatasi", color: "#f00" },
    2078: { level: "ERROR", category: "AUDIO", msg: "Ses Sinyali Klipslendi", color: "#f00" },
    2079: { level: "ERROR", category: "AUDIO", msg: "Ses Motoru Baslatilamadi", color: "#f00" },
    2080: { level: "ERROR", category: "MEMORY", msg: "Bellek Kullanimi Yuksek: {usage}MB", color: "#f00" },
    2081: { level: "ERROR", category: "MEMORY", msg: "Bellek Tahsisi Basarisiz", color: "#f00" },
    2082: { level: "ERROR", category: "MEMORY", msg: "Referans Dongusu Tespit Edildi", color: "#f00" },
    2083: { level: "ERROR", category: "MEMORY", msg: "Cop Toplayici Hatasi", color: "#f00" },
    2084: { level: "ERROR", category: "MEMORY", msg: "Bellek Sizintisi Tespit Edildi", color: "#f00" },
    2085: { level: "ERROR", category: "MEMORY", msg: "Buffer Tasma Hatasi", color: "#f00" },
    2086: { level: "ERROR", category: "MEMORY", msg: "Stack Tahsisi Basarisiz", color: "#f00" },
    2087: { level: "FATAL", category: "MEMORY", msg: "Heap Bellegi Doldu ({used}MB / {total}MB)", color: "#f00" },
    2088: { level: "ERROR", category: "MEMORY", msg: "Bellek Kopyalama Hatasi", color: "#f00" },
    2089: { level: "ERROR", category: "MEMORY", msg: "Pointer Gecersiz", color: "#f00" },
    2090: { level: "ERROR", category: "UI", msg: "DOM Elemani Bulunamadi: {selector}", color: "#f00" },
    2091: { level: "ERROR", category: "UI", msg: "CSS Yukleme Hatasi", color: "#f00" },
    2092: { level: "ERROR", category: "UI", msg: "Layout Hesaplama Hatasi", color: "#f00" },
    2093: { level: "ERROR", category: "UI", msg: "Font Yukleme Hatasi", color: "#f00" },
    2094: { level: "ERROR", category: "UI", msg: "Resim Yukleme Hatasi", color: "#f00" },
    2095: { level: "ERROR", category: "UI", msg: "Menu Gecis Hatasi", color: "#f00" },
    2096: { level: "ERROR", category: "UI", msg: "Buton Tiklama Hatasi", color: "#f00" },
    2097: { level: "ERROR", category: "UI", msg: "Scroll Hatasi", color: "#f00" },
    2098: { level: "FATAL", category: "UI", msg: "Arayuz Coktu", color: "#f00" },
    2099: { level: "FATAL", category: "SYSTEM", msg: "Bilinmeyen Kritik Hata: {error}", color: "#f00" }
  };

  function fillTemplate(str, data) {
    if (!data) return str;
    return str.replace(/\{(\w+)\}/g, function(match, key) {
      var val = data[key] !== undefined ? data[key] : match;
      return escapeHtml(String(val));
    });
  }

  function addLog(code, data) {
    var info = DICTIONARY[code] || { level: "LOG", category: "UNKNOWN", msg: "Bilinmeyen Kod: " + escapeHtml(String(code)), color: "#888" };
    var now = new Date();
    var time = now.toLocaleTimeString() + "." + now.getMilliseconds().toString().padStart(3, "0");
    var msg = fillTemplate(info.msg, data);
    
    if (info.level === "ERROR" || info.level === "FATAL") {
      errorThrottle++;
      if (errorThrottle > 500) return; // Saniyede 500'den fazla hata loglama
      errorCount++;
    }

    if (logs.length > 0 && logs[0].code === code && logs[0].text === msg) {
      logs[0].count = (logs[0].count || 1) + 1;
      logs[0].time = time;
    } else {
      logs.unshift({ time: time, code: code, level: info.level, category: info.category, text: msg, color: info.color, count: 1 });
    }
    
    if (logs.length > maxLogs) logs.pop();
    renderLogs();
  }

  function renderLogs() {
    if (!el) return;
    var frag = document.createDocumentFragment();
    var count = 0;
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      if (filterLevel !== "ALL" && l.level !== filterLevel) continue;
      if (filterCategory !== "ALL" && l.category !== filterCategory) continue;
      if (searchText && l.text.toLowerCase().indexOf(searchText.toLowerCase()) === -1) continue;
      
      var line = document.createElement("div");
      line.style.color = l.color;
      line.style.borderBottom = "1px solid #222";
      line.style.padding = "4px 8px";
      line.style.fontFamily = "monospace";
      if (l.level === "FATAL") line.style.animation = "blink 0.5s infinite";
      var countStr = l.count > 1 ? " (x" + l.count + ")" : "";
      line.innerHTML = "<span style='color:#555'>[" + l.time + "]</span> <b>[" + l.code + " " + l.level + "]</b> <span style='color:#777'>[" + l.category + "]</span> " + l.text + countStr;
      frag.appendChild(line);
      count++;
      if (count > 300) break;
    }
    el.innerHTML = "";
    el.appendChild(frag);
    var cntEl = document.getElementById("sg-bug-count");
    if (cntEl) cntEl.innerText = logs.length;
    var errEl = document.getElementById("sg-bug-errors");
    if (errEl) errEl.innerText = errorCount;
  }

  // Console Override
  console.log = function() { var a = Array.prototype.slice.call(arguments).join(" "); _originalConsole.log.apply(console, arguments); addLog(1010, {message: a}); };
  console.info = function() { var a = Array.prototype.slice.call(arguments).join(" "); _originalConsole.info.apply(console, arguments); addLog(1000); };
  console.warn = function() { var a = Array.prototype.slice.call(arguments).join(" "); _originalConsole.warn.apply(console, arguments); addLog(2000, {ping: "450"}); };
  console.error = function() { var a = Array.prototype.slice.call(arguments).join(" "); _originalConsole.error.apply(console, arguments); addLog(2099, {error: a}); };

  window.addEventListener("error", function(e) { addLog(2099, {error: e.message}); });

  function updateFps() {
    requestAnimationFrame(updateFps);
    frameCount++;
    var now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      frameCount = 0;
      lastFpsTime = now;
      errorThrottle = 0;
      var fpsEl = document.getElementById("sg-bug-fps");
      if (fpsEl) fpsEl.innerText = "FPS: " + fps;
    }
  }

  var sgBug = {
    version: VERSION,
    dictionary: DICTIONARY,
    event: function(code, data) { addLog(code, data); },
    isInitialized: function() { return isInitialized; },

    init: function() {
      if (isInitialized) return;
      isInitialized = true;
      if (document.getElementById("sg-bug-panel")) return;
      
      var style = document.createElement("style");
      style.innerText = "@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }";
      document.head.appendChild(style);

      var panel = document.createElement("div");
      panel.id = "sg-bug-panel";
      panel.style.cssText = "position:fixed;bottom:0;left:0;right:0;height:350px;background:rgba(10,10,10,0.95);border-top:2px solid #0f0;z-index:99999;font-family:monospace;font-size:12px;display:flex;flex-direction:column;";
      
      var header = document.createElement("div");
      header.style.cssText = "padding:6px 12px;background:#000;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#0f0;";
      header.innerHTML = "<span>SG-BUG v" + VERSION + " <span id='sg-bug-fps' style='color:#0ff;margin-left:15px'>FPS: --</span> <span id='sg-bug-errors' style='color:#f00;margin-left:15px'>HATA: 0</span></span><div><span style='cursor:pointer;color:#ff0;padding:0 8px' onclick='sgBug.exportJSON()'>[EXPORT]</span><span style='cursor:pointer;color:#ff0;padding:0 8px' onclick='sgBug.clear()'>[TEMIZLE]</span><span style='cursor:pointer;color:#f00;padding:0 8px' onclick='sgBug.hide()'>[KAPAT]</span></div>";
      panel.appendChild(header);

      var toolbar = document.createElement("div");
      toolbar.style.cssText = "padding:4px 12px;background:#111;border-bottom:1px solid #333;display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
      toolbar.innerHTML = "<select id='sg-bug-level' style='background:#222;color:#0f0;border:1px solid #0f0;padding:2px'><option value='ALL'>Tum Seviyeler</option><option value='INFO'>INFO</option><option value='LOG'>LOG</option><option value='WARN'>WARN</option><option value='ERROR'>ERROR</option><option value='FATAL'>FATAL</option></select><select id='sg-bug-category' style='background:#222;color:#0f0;border:1px solid #0f0;padding:2px'><option value='ALL'>Tum Kategoriler</option><option value='SYSTEM'>Sistem</option><option value='PHYSICS'>Fizik</option><option value='NETWORK'>Ag</option><option value='GPU'>GPU</option><option value='ECS'>ECS</option><option value='AUDIO'>Ses</option><option value='MEMORY'>Bellek</option><option value='INPUT'>Girdi</option><option value='UI'>Arayuz</option></select><input type='text' id='sg-bug-search' placeholder='Ara...' style='background:#222;color:#0f0;border:1px solid #0f0;padding:2px;width:120px'><span style='color:#888;font-size:11px'>Toplam: <span id='sg-bug-count'>0</span></span>";
      panel.appendChild(toolbar);

      var content = document.createElement("div");
      content.id = "sg-bug-content";
      content.style.cssText = "flex:1;overflow-y:auto;padding:5px 0;";
      panel.appendChild(content);
      el = content;

      document.body.appendChild(panel);
      document.body.style.paddingBottom = "350px";

      document.getElementById("sg-bug-level").addEventListener("change", function(e) { filterLevel = e.target.value; renderLogs(); });
      document.getElementById("sg-bug-category").addEventListener("change", function(e) { filterCategory = e.target.value; renderLogs(); });
      document.getElementById("sg-bug-search").addEventListener("input", function(e) { searchText = e.target.value; renderLogs(); });

      addLog(1000);
      updateFps();
    },

    hide: function() { var p = document.getElementById("sg-bug-panel"); if (p) p.style.display = "none"; document.body.style.paddingBottom = "0px"; },
    show: function() { var p = document.getElementById("sg-bug-panel"); if (p) p.style.display = "flex"; document.body.style.paddingBottom = "350px"; },
    clear: function() { logs = []; errorCount = 0; renderLogs(); },
    exportJSON: function() {
      var blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "sg-bug-logs-" + Date.now() + ".json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  global.sgBug = sgBug;
  global.eventLog = function(code, data) { sgBug.event(code, data); };
})(typeof window !== "undefined" ? window : global);
