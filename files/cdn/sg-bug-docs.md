# SG-BUG v1.0.0 (Final)

**SGame Studios - Gelistirici Hata Ayiklama ve Log Motoru**

---

## Nedir?

**SG-BUG**, tarayicida calisan, sifir bagimlilikli, tek dosyalik bir hata ayiklama aracidir. Ana JavaScript dosyanizdan gelen tum console.log, warn, error ve info ciktilarini yakalar; ekranin altinda profesyonel bir konsol paneli olarak gosterir.

**Entegre Oldugu Kutuphaneler:**
- **ENT ECS** (Entity Component System) - v2.1.4.1
- **SG-Audio** (Ses Motoru) - v1.0.0

---

## Kurulum

HTML dosyaniza (tercihen body etiketinden hemen once) ekleyin:

script src='sg-bug.js'
script sgBug.init(); /script

Bu kadar. Panel otomatik olarak ekranin altina yerlestirilecek.

---

## Ozellikler

### 1. Otomatik Log Yakalama

Kutuphane yuklendiginde su console metodlarini otomatik override eder:

- console.log -> LOG (Yesil)
- console.info -> INFO (Cyan)
- console.warn -> WARN (Sari)
- console.error -> ERROR (Kirmizi)

Ayrica window.onerror ile yakalanmayan tum global hatalari da otomatik yakalar.

### 2. 100 Hata Kodu (2000-2099)

Her hata kodu bir kategoriye, seviyeye ve renge sahiptir:

| Kod Araligi | Kategori |
|-------------|----------|
| 2000-2019 | Uyarilar (WARN) |
| 2020-2029 | ECS Hatalari |
| 2030-2039 | Fizik Hatalari |
| 2040-2049 | Ag Hatalari |
| 2050-2059 | GPU Hatalari |
| 2060-2069 | Giris (Input) Hatalari |
| 2070-2079 | Ses (Audio) Hatalari |
| 2080-2089 | Bellek (Memory) Hatalari |
| 2090-2098 | Arayuz (UI) Hatalari |
| 2099 | Kritik Sistem Hatasi (FATAL) |

### 3. Dinamik Veri Destegi

Hata mesajlari {degisken} sablonlari icerebilir:

sgBug.event(1008, { count: 150000 });
Cikti: [1008 LOG] [ECS] Toplam Entity: 150000

### 4. Canli FPS Sayaci
Panelin basliginda anlik FPS gosterilir.

### 5. Hata Sayaci
Toplam ERROR ve FATAL sayisi baslikta canli olarak gorunur.

### 6. Gelismis Filtreleme
- Seviye Filtresi: Sadece ERROR veya WARN goruntuleme
- Kategori Filtresi: Sadece Fizik veya Ag hatalari
- Arama: Metin icinde arama yapma

### 7. JSON Disa Aktarma
[EXPORT] butonu ile tum loglari .json dosyasi olarak indirebilirsiniz.

---

## API Referansi

| Fonksiyon | Aciklama |
|-----------|----------|
| sgBug.init() | Paneli olusturur ve loglari yakalamaya baslar. |
| sgBug.hide() | Paneli gizler. |
| sgBug.show() | Paneli tekrar gosterir. |
| sgBug.clear() | Tum loglari temizler. |
| sgBug.event(code, data) | Belirli bir hata kodunu tetikler. |
| sgBug.exportJSON() | Loglari JSON olarak indirir. |

### Global Kisayol

eventLog(2030, { body: 'Player_Box' });
// Bu, sgBug.event(2030, { body: 'Player_Box' }) ile aynidir.

---

## Ornek Kullanim

// Baslat
sgBug.init();

// Fizik motoru baslat
sgBug.event(1001);

// Entity sayisini logla
sgBug.event(1008, { count: 150000 });

// Hata simule et
sgBug.event(2030, { body: 'Player_Box' });

// Kritik hata
sgBug.event(2087, { used: 512, total: 512 });

### Cikti

[17:04:10.935] [2087 FATAL] [MEMORY] Heap Bellegi Doldu (512MB / 512MB)
[17:04:07.607] [2030 ERROR] [PHYSICS] RigidBody Null Dondu: Player_Box
[17:04:06.335] [1008 LOG] [ECS] Toplam Entity: 150000
[17:04:05.783] [1001 INFO] [PHYSICS] Fizik Motoru Baslatildi

---

## Guvenlik ve Optimizasyon

| Ozellik | Aciklama |
|---------|----------|
| XSS Korumasi | Tum log mesajlari escapeHtml() fonksiyonundan gecirilir. |
| Error Throttle | Saniyede en fazla 500 hata loglanir (spam korumasi). |
| Bellek Siniri | Maksimum 1000 log tutulur, eski loglar silinir. |
| DocumentFragment | DOM manipulasyonu minimuma indirildi. |
| Cift Baslatma Korumasi | isInitialized bayragi ile motorun iki kez baslatilmasi engellendi. |

---

## Entegrasyon Ornekleri

### ENT ECS ile Birlikte

ent.spawn('player', { health: 100 });
sgBug.event(1008, { count: ent.count });

### SG-Audio ile Birlikte

sgAudio.init();
sgBug.event(1006); // Ses dosyasi yukleniyor
sgAudio.sfx('shotgun', { vol: 0.8 });

### Hata Ayiklama Ornegi

try {
  ent.spawn(null); // Hata firlatir
} catch (e) {
  sgBug.event(2020, { max: 100000 });
}

---

## Versiyon Gecmisi

| Surum | Degisiklik |
|-------|-----------|
| 0.0.1 | Ilk surum. Temel log yakalama. |
| 0.0.4 | Gercekci simulasyonlar eklendi. |
| 0.1.0 | 30+ hata kodu, filtreleme, arama. |
| 0.2.0 | Kategori sistemi, grup testi. |
| 0.3.0 | Dinamik veri, milisaniye zaman damgasi. |
| 0.8.0 | Canli FPS, 50+ hata kodu. |
| 0.9.0 | 100 hata kodu, blink animasyonu, hata sayaci. |
| **1.0.0** | **XSS korumasi, throttle, optimizasyon. Final surum.** |

---

## Lisans

**Ucretsiz (Free)**

**Gelistirici:** SGame Studios - 2026
**Iletisim:** GitHub / SuleymanDal
