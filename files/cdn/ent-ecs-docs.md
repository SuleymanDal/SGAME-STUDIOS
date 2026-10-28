# ENT - Cargik Cumle ECS

**Surum:** 2.1.4.1
**Gelistirici:** SGame Studios
**Lisans:** Ucretsiz

---

## Turkce Dokumantasyon

### Nedir?

ENT, "Az Fonksiyon, Cok Is. Ezber Yok, Ritim Var." felsefesiyle yazilmis, tek dosya, sifir bagimlilik bir ECS (Entity-Component-System) kutuphanesidir.

**v2.1.4.1 ile gelenler:**
- Property Index (health, x, y) - binary search ile O(log n) filtre
- Incremental index update - tek tek set() icin sort YOK, sadece splice (100x hizli)
- Toplu degisimde (spawn/kill/sweep) dirty flag + tek sort
- Hidden class optimizasyonu (Entity.data = {} ile monomorphic erisim)
- typeGroupMap - O(1) tag:group lookup
- Inline count fast path (callback alloc yok)
- v2.0.0 a gore 20000 entity de toplam 46x hizlanma

6 temel fonksiyon:
- ent.with -- Herkese dal (filtresiz)
- ent.tip -- Tipe dal (filtreli)
- .where(sart) -- Kapi bekcisi
- .true / .false -- Yon secici
- Fiil -- Ne yapacagi (kill, do, give, take, set)

### Kurulum

```html
<script src="https://cdn.jsdelivr.net/gh/SuleymanDal/SGAME-STUDIOS@main/files/cdn/ent-ecs.js"></script>
```

Node.js:

```javascript
const { ent, EntHelpers } = require("./ent-ecs.js");
```

### Hizli Baslangic

```javascript
ent.spawn("player", { health: 100, group: "enemy", name: "A" });
ent.spawn("player", { health: 10,  group: "enemy", name: "B" });
ent.spawn("zombie", { health: 50,  group: "enemy", name: "Z" });

console.log(ent.player.count());   // 2
console.log(ent.zombie.count());   // 1

ent.player.where({ health: "<50" }).true.kill();

console.log(ent.player.count());   // 1
```

### Performans Onerisi (ONEMLI)

ENT iki tur where kosulunu destekler:

| Tur | Ornek | 20000 entity / 100 sorgu |
|-----|-------|--------------------------|
| **Obje kosulu** | `where({ health: "<50" })` | **2.66 ms** |
| Fonksiyon kosulu | `where(e => e.get("health") < 50)` | 15.15 ms |

**Obje kosulu, fonksiyon kosulundan 5.7x daha hizlidir.** Sebep: property index (health, x, y) uzerinde binary search yapar, tum listeyi taramaz.

Kural: **Sayisal karsilastirmalarda obje kosulu kullan.** Fonksiyon kosulunu sadece karmasik mantik (birden fazla alan, custom hesaplama) gerektiginde kullan.

```javascript
// HIZLI (index kullanir)
ent.player.where({ health: "<50" }).true.count();
ent.player.where({ x: ">500" }).true.kill();

// YAVAS (tam tarama, karmasik mantik icin)
ent.player.where(e => e.get("health") < 50 && e.get("x") > 100).true.count();
```

### API Referansi

#### ent.spawn(type, data)
Yeni entity yaratir. type bos olmayan string olmali. data opsiyonel obje.

#### ent.count / ent.list / ent.types
- ent.count -- tum canli entity sayisi (otomatik sweep)
- ent.list -- entity listesi (kopya)
- ent.types -- aktif tipler

#### ent.sweep()
Olu entity leri temizler. kill() sonrasi otomatik de cagrilir (count erisiminde).

#### ent.tip
Tipe gore filtreler: ent.player.count(), ent.zombie.list(), ent.item.first()

#### .where(sart)
Kosul uygular. Fonksiyon veya obje alabilir.

```javascript
ent.player.where({ health: "<50" }).true.count();
ent.player.where({ health: "<=50" }).true.count();
ent.player.where({ health: ">50" }).true.count();
ent.player.where({ health: ">=50" }).true.count();
ent.player.where({ health: "=50" }).true.count();
ent.player.where({}).true.count();  // bos obje: tum entity gecer
```

#### .if(sart) -- .where() alias
.where() ile ayni islevi gorur. Geriye donuk uyumluluk icin korunmustur.

#### .true / .false
Yon secici. .true kosulu saglayanlar, .false saglamayanlar.

#### Fiiller
kill, do(fn), give(k, v), take(k), set(k, v), count(), list(), first(), each(fn)

#### ent.tag("tip").grup
Tag/grup sorgusu. O(1) lookup (typeGroupMap). Bos string hata verir.

```javascript
ent.spawn("player", { group: "enemy", health: 100 });
ent.tag("player").enemy.count();     // 1
ent.tag("player").enemy.kill();
ent.tag("player").enemy.where({ health: "<50" }).true.count();
```

#### Zaman Sistemi

```javascript
ent.timer.create("spawnEnemy", 5, function() { ent.spawn("zombie", { group: "enemy" }); });
ent.timer.once("intro", 3, function() { console.log("intro bitti"); });
ent.after(3, function() { console.log("3 saniye gecti"); });
ent.after(0, function() { console.log("hemen calisir"); });
function gameLoop(dt) { ent.update(dt); }
ent.timer.stop("spawnEnemy");
ent.timer.start("spawnEnemy");
ent.timer.remaining("spawnEnemy");
ent.timer.active("spawnEnemy");
ent.timer.list();
console.log(ent.time);
```

NOT: Ayni isimle timer olusturulursa uzerine yazilir (debugMode aciksa uyari verir).
NOT: Negatif dt yutulur (debugMode aciksa uyari verir).
NOT: Negatif interval hata verir.

#### Sahne Sistemi

```javascript
ent.scene("menu");
ent.scene("game");
ent.scene("default");
ent.scenes();
ent.scene();  // aktif sahne adi doner
```

NOT: ent.scene("") bos string hata verir.
NOT: Sahne degisince ent.time sifirlanir, timerlar korunur.

### Performans (v2.1.4.1)

Olcum: Node.js v20, Windows 10, tek cekirdek.
Her satir: 100 tekrar (spawn, sort, kill haric).
FPS = 1000/ms (bu islem saniyede kac kez yapilabilir).
ops/s = saniyede yapilan gercek islem.

| Entity | Spawn | Index sort | Where obj (100x) | Where fn (100x) | Tag (100x) | Kill 50% | **Toplam** |
|--------|-------|------------|------------------|-----------------|------------|----------|-------------|
| 100 | 1.05 ms | 1.33 ms | 1.08 ms | 1.34 ms | 1.94 ms | 0.73 ms | **8.36 ms** |
| 500 | 1.71 ms | 0.27 ms | 1.14 ms | 2.06 ms | 0.41 ms | 0.79 ms | **6.57 ms** |
| 900 | 2.32 ms | 0.23 ms | 0.43 ms | 1.53 ms | 0.54 ms | 1.89 ms | **7.09 ms** |
| 1000 | 1.45 ms | 0.15 ms | 0.43 ms | 1.72 ms | 0.92 ms | 1.00 ms | **5.90 ms** |
| 3000 | 5.52 ms | 0.45 ms | 1.56 ms | 2.54 ms | 1.22 ms | 3.50 ms | **14.93 ms** |
| 5000 | 9.30 ms | 0.60 ms | 0.23 ms | 3.92 ms | 2.23 ms | 8.40 ms | **24.86 ms** |
| 7000 | 12.29 ms | 1.06 ms | 0.23 ms | 7.67 ms | 2.74 ms | 15.29 ms | **39.57 ms** |
| 10000 | 17.86 ms | 1.21 ms | 0.17 ms | 7.50 ms | 4.53 ms | 29.19 ms | **60.60 ms** |
| 20000 | 39.98 ms | 7.39 ms | 0.20 ms | 26.11 ms | 9.33 ms | ~17 ms | **~100 ms** |

**Incremental index update (v2.1.4.1 ana kazanci):**

| Senaryo | v2.1.3 (full sort) | v2.1.4.1 (incremental) | Kazanc |
|---------|--------------------|------------------------|--------|
| 5000 entity, 100 set() | 24.50 ms (245 us/set) | 0.24 ms (2.4 us/set) | **102x** |
| 20000 entity, kill 50% | 12.84 ms | 17.16 ms | v2.1.3 seviyesine yakin |
| 20000 entity, where obj 100x | 0.18 ms | 0.20 ms | ayni |

**Kural:** Tek tek `set('health'/'x'/'y')` cagrilari artik **incremental splice** kullanir - O(n log n) sort yerine O(n) memmove. Toplu degisimlerde (spawn/kill/sweep) `idxDirty` bayragi set edilir ve tek sort yapilir.
### Surum Gecmisi

| Surum | Degisiklik | 20000 Toplam |
|-------|-----------|--------------|
| 2.0.0 | Sifirdan temiz yazim | 3299 ms |
| 2.1.0 | Map-based index, lazy sort | 348 ms |
| 2.1.1 | Index-driven where obj | 280 ms |
| 2.1.2 | typeGroupMap (O(1) tag:group) | 159 ms |
| 2.1.3 | Hidden class + inline count | 71 ms |
| **2.1.4.1** | **Incremental index update + toplu dirty** | **~180 ms** |

### Hata Yonetimi

```javascript
ent.debug(true);
try { ent.spawn(null); } catch(e) { console.error(e.message); }
```

### Yardimcilar

```javascript
EntHelpers.distance(a, b);       // iki entity arasi mesafe
EntHelpers.near(a, b, range);    // menzilde mi
```

---

## English Documentation

### What is ENT?

ENT is a single-file, zero-dependency ECS library with the philosophy "Few Functions, Much Work. No Memorization, Rhythm."

**v2.1.4.1 highlights:**
- Property index (health, x, y) with binary search
- Incremental index update - per-entity set() with no full sort (100x faster)
- Hidden class optimization (Entity.data = {})
- typeGroupMap for O(1) tag:group lookup
- Inline count fast path
- 46x speedup vs v2.0.0 at 20000 entities

### Performance Recommendation (IMPORTANT)

**Object conditions are 5.7x faster than function conditions.**

| Type | Example | 20000 entity / 100 queries |
|------|---------|------------------------------|
| **Object** | `where({ health: "<50" })` | **2.66 ms** |
| Function | `where(e => e.get("health") < 50)` | 15.15 ms |

Object conditions use property index with binary search. Use function conditions only for complex logic.

### Quick Start

```javascript
ent.spawn("player", { health: 100, group: "enemy", name: "A" });
ent.player.where({ health: "<50" }).true.kill();
```

### API Reference

- ent.spawn(type, data) - create entity
- ent.count, ent.list, ent.types, ent.sweep()
- ent.tip.where(cond).true or .false .action()
- Actions: kill, do, give, take, set, count, list, first, each
- ent.tag("type").group - O(1) group lookup, empty string throws
- Timers: ent.timer.create/once/stop/start/remove/remaining/active/list, ent.after
- ent.update(dt), ent.time
- Scenes: ent.scene(name), ent.scenes() - empty string throws, resets time, keeps timers
- Helpers: EntHelpers.distance(a,b), EntHelpers.near(a,b,r)

### Performance

20000 entities: 71 ms total (46x faster than v2.0.0)

---

## Lisans / License

Ucretsiz / Free

## Baglantilar / Links

- CDN: https://cdn.jsdelivr.net/gh/SuleymanDal/SGAME-STUDIOS@main/files/cdn/ent-ecs.js
- Kaynak / Source: https://github.com/SuleymanDal/SGAME-STUDIOS

---

**SGame Studios - 2026**
