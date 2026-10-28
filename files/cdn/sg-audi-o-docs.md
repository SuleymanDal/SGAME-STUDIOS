# SG-AUDIO v1.0.0 (Final)
**SGame Studios - Prosedurel Oyun Ses ve Muzik Motoru**

---

## Nedir?
SG-Audio, tarayicida (Web Audio API) calisan, sifir bagimlilikli, tek dosyalik bir ses ve muzik motorudur. Harici mp3 veya wav dosyalarina ihtiyac duymaz. Tum silah sesleri, patlamalar, ortam sesleri ve muzikler matematiksel osilatorler ve filtrelerle anlik olarak sentezlenir.

ENT ECS felsefesine uygun olarak 'Az Fonksiyon, Cok Is' prensibiyle yazilmistir.

---

## Hizli Baslangic

Asagidaki kodu HTML dosyaniza ekleyin:

1. Motoru baslat (Kullanici tiklamasindan sonra cagrilmali)
2. Silah sesi cal: sgAudio.sfx('shotgun', { vol: 0.8 });
3. Muzik baslat: sgAudio.playBossMusic();

---

## API Referansi

### 1. Cekirdek Fonksiyonlar
- **sgAudio.init()**: Ses motorunu (AudioContext) baslatir. Tarayici politikalarina uymak icin sadece kullanici etkilesiminden (tiklama vb.) sonra cagrilmalidir.
- **sgAudio.resume()**: Tarayici sekmeyi arka plana attiginda duraklayan sesi devam ettirir.
- **sgAudio.stopAll()**: O an calan tum sesleri (muzik, efekt, ortam) 50ms icinde yumusakca susturur.
- **sgAudio.mute(true/false)**: Tum sesleri susturur veya acar.
- **sgAudio.getAnalyser()**: Canli ses spektrumu (gorsellestirme) icin AnalyserNode dondurur.

### 2. Ses Seviyesi ve Miksaj
- **sgAudio.volume(master, sfx, music, ambient)**: Ses seviyelerini 0.0 ile 1.0 arasinda ayarlar.
- **sgAudio.duck()**: Silah atisi gibi yuksek seslerde arka plan muzigini ve ortam sesini gecici olarak kisar (200ms sonra geri acar).

### 3. Efektler (SFX)
Kullanim: **sgAudio.sfx(type, options)**

Desteklenen Ses Tipleri:
- Silahlar: pistol, rifle, shotgun, explosion, hit
- Oyuncu: footstep, jump, land, hurt, pickup, switch, reload, empty
- Arayuz: uiHover, uiClick, uiError, uiNotify
- Dusman: enemyGrowl, enemyAttack, enemyDeath

Options (Secenekler): { vol: 0.8, pan: -0.5 } (Ses seviyesi ve sag-sol dengesi)

### 4. 3D Uzamsal Ses
Kullanim: **sgAudio.spatialSfx(type, x, y, z, velocityX, options)**
Sesi 3D uzayda konumlandirir. velocityX parametresi ile Doppler etkisi (yaklasan/uzaklasan ses) simule edilir.

### 5. Cevresel (Ambient) Sesler
- **sgAudio.startWind(volume)**: Dongusel ruzgar sesi.
- **sgAudio.startDistantExplosions()**: Rastgele araliklarla uzaktan gelen patlama sesleri.
- **sgAudio.startAlarm()**: Endustriyel / Nukleer siren sesi.

### 6. Muzik Motoru
- **sgAudio.playSynthwave(bpm)**: Retro Synthwave muzigi baslatir.
- **sgAudio.playCombatMusic()**: 140 BPM hizli savas muzigi.
- **sgAudio.playAmbientMusic()**: 60 BPM sakin kesif muzigi.
- **sgAudio.playBossMusic()**: 160 BPM kaotik boss savasi muzigi.
- **sgAudio.stopMusic()**: Sadece muzigi durdurur.

---

## Moduler Muzik Uretimi
Kendi muziginizi olusturmak icin createMusic kullanabilirsiniz:

- tempo: Saniyedeki vurus sayisi (BPM)
- swing: Ritim aksamasi (0 = mekanik, 0.2 = groove/caz)
- bass: Bas notalari (Hz)
- chords: Akor notalari (Hz)
- drums: 16'lik adimlar (kick, snare vb.)

---

## Teknik Detaylar
- **Web Audio Look-Ahead Scheduler:** Muzikler setInterval yerine Web Audio'nun kendi saatiyle (Look-Ahead) calisir. Bu sayede tarayici kassa bile muzikte mikro-gecikme yasanmaz.
- **Humanization:** Notalarin ses seviyeleri her vurusta hafifce rastgele degisir. Bu, muzige insan eli degmis hissi verir.
- **Voice Management:** Ayni anda en fazla 64 ses calinabilir. Limit asilirsa, en dusuk oncelikli ses kapatilip yenisine yer acilir.
- **Miksaj:** Tum sesler cikisa verilmeden once bir DynamicsCompressor (Limiter) ve Reverb (Yanki) filtresinden gecer. Sesler asla patlamaz (clipping).

---
**Lisans:** Ucretsiz (Free)
**Gelistirici:** SGame Studios - 2026
