# SG-Seed v1.0.0 — API Referansi

Tek dosyali seed kutuphanesi. UMD (tarayici + Node.js).

## Yukleme

### Tarayici
    <script src="sg-seed.js"></script>
    <script>
      var r = SGSeed.SeedRandom("merhaba");
    </script>

### Node.js
    const SGSeed = require("./sg-seed.js");
    const r = SGSeed.SeedRandom("merhaba");

### Global
Tum API `SGSeed` objesi altinda.

---

## Hash Fonksiyonlari

String'den deterministik 32-bit (veya 4x32-bit) seed uretir.

### SGSeed.fnv1a(str) -> number

FNV-1a 32-bit hash. Hizli, basit.

| Parametre | Tip | Aciklama |
|---|---|---|
| str | string | Hash'lenecek metin |

Dondurur: `number` (0 .. 2^32-1, unsigned 32-bit)

    SGSeed.fnv1a("hello"); // 1335831723

---

### SGSeed.xmur3(str) -> function

32-bit seed uretici dondurur. Her cagri yeni 32-bit sayi uretir.

| Parametre | Tip | Aciklama |
|---|---|---|
| str | string | Seed metni |

Dondurur: `function()` -> `number` (0 .. 2^32-1)

    var seed = SGSeed.xmur3("abc");
    seed(); // 1792905582
    seed(); // baska bir sayi

---

### SGSeed.cyrb128(str) -> [number, number, number, number]

4 adet 32-bit seed dondurur. sfc32 ve xoshiro128ss icin idealdir.

| Parametre | Tip | Aciklama |
|---|---|---|
| str | string | Seed metni |

Dondurur: `[a, b, c, d]` her biri 0 .. 2^32-1

    SGSeed.cyrb128("seed");
    // [2651252004, 3195487425, 3664445863, 4196048962]

---

## PRNG'ler

Her biri `function()` dondurur; cagrildiginda `[0, 1)` araliginda float uretir.

### SGSeed.mulberry32(a) -> function

| Parametre | Tip | Aciklama |
|---|---|---|
| a | number | 32-bit seed |

    var rng = SGSeed.mulberry32(12345);
    rng(); // 0.979728267761...

---

### SGSeed.sfc32(a, b, c, d) -> function

4 seed'li, yuksek kaliteli PRNG. **Varsayilan algoritma.**

| Parametre | Tip | Aciklama |
|---|---|---|
| a, b, c, d | number | 4x 32-bit seed |

    var rng = SGSeed.sfc32(1, 2, 3, 4);
    rng(); // 0.000000001630...

---

### SGSeed.splitmix32(a) -> function

Basit ve hizli.

| Parametre | Tip | Aciklama |
|---|---|---|
| a | number | 32-bit seed |

    var rng = SGSeed.splitmix32(99);
    rng(); // 0.081433345797...

---

### SGSeed.xoshiro128ss(a, b, c, d) -> function

Modern, hizli, iyi istatistiksel ozellikler.

| Parametre | Tip | Aciklama |
|---|---|---|
| a, b, c, d | number | 4x 32-bit seed |

    var rng = SGSeed.xoshiro128ss(1, 2, 3, 4);
    rng(); // 0.000002682209...

---

## SeedRandom Factory

### SGSeed.SeedRandom(seed[, algorithm]) -> SeedRandom

Yeni bir seed'li rastgele obje olusturur.

| Parametre | Tip | Varsayilan | Aciklama |
|---|---|---|---|
| seed | string / number / null / Symbol | - | Seed degeri. null/undefined/Symbol guvenli |
| algorithm | string | "sfc32" | "sfc32", "mulberry32", "splitmix32", "xoshiro128ss" |

    var r = SGSeed.SeedRandom("merhaba");
    var r2 = SGSeed.SeedRandom("merhaba", "xoshiro128ss");

Ayni seed + ayni algoritma = ayni cikti dizisi (deterministik).

---

## SeedRandom Metotlari

### .next() -> number

`[0, 1)` araliginda bir float.

    r.next(); // 0.12345...

---

### .int(min, max) -> number

`[min, max]` araliginda tamsayi (her iki uc dahil).

| Parametre | Tip | Aciklama |
|---|---|---|
| min | number | Alt sinir (dahil) |
| max | number | Ust sinir (dahil). Verilmezse min=0 kabul edilir |

Guvenlik: `max < min` ise otomatik ters cevrilir. NaN/Infinity guvenli.

    r.int(1, 100);   // 1..100
    r.int(10);       // 0..10

---

### .intFast(min, max) -> number

`.int()` ile ayni. Geriye uyumluluk icin alias.

---

### .float([min, max]) -> number

| Cagri | Sonuc |
|---|---|
| `.float()` | `[0, 1)` |
| `.float(max)` | `[0, max)` |
| `.float(min, max)` | `[min, max)` |

Guvenlik: `max < min` ise ters cevrilir.

    r.float(5, 6); // 5.xxx (6 dahil degil)

---

### .bool([p]) -> boolean

Olasilikli boolean.

| Parametre | Tip | Varsayilan | Aciklama |
|---|---|---|---|
| p | number | 0.5 | true olma olasiligi [0, 1] |

Gecersiz p (0-1 disi, NaN) -> 0.5 kullanilir.

    r.bool();     // ~%50 true
    r.bool(0.9);  // ~%90 true

---

### .pick(arr) -> any

Diziden rastgele bir eleman secer.

| Parametre | Tip | Aciklama |
|---|---|---|
| arr | Array | Secilecek dizi |

Bos/null dizi -> `undefined`.

    r.pick(["a", "b", "c"]);
    r.pick([]); // undefined

---

### .shuffle(arr) -> Array

Fisher-Yates ile karistirilmis **yeni** dizi dondurur. Orijinal dizi degismez.

| Parametre | Tip | Aciklama |
|---|---|---|
| arr | Array | Karistirilacak dizi |

Bos/null -> `[]`.

    var arr = [1, 2, 3, 4, 5];
    var out = r.shuffle(arr);
    // out: karisik, arr: hala [1,2,3,4,5]

---

### .shuffleInPlace(arr) -> Array

Yerinde karistirir. Orijinal dizi degisir. `shuffle`'dan hizli.

| Parametre | Tip | Aciklama |
|---|---|---|
| arr | Array | Yerinde karistirilacak dizi |

Bos/null -> ayni dizi.

    var arr = [1, 2, 3, 4, 5];
    r.shuffleInPlace(arr);
    // arr artik karisik

---

### .sample(arr, n) -> Array

Karistirilmis kopyadan ilk n eleman dondurur. Orijinal degismez.

| Parametre | Tip | Aciklama |
|---|---|---|
| arr | Array | Kaynak dizi |
| n | number | Kac eleman alinacak |

    r.sample([1,2,3,4,5], 3); // 3 eleman, orijinal bozulmaz

---

### .sampleInPlace(arr, n) -> Array

Yerinde ornekler. `arr`'nin **ilk n elemani** orneklenir. **Length degismez.**

| Parametre | Tip | Aciklama |
|---|---|---|
| arr | Array | Kaynak dizi (degisir) |
| n | number | Kac eleman orneklenecek (clamp [0, length]) |

Kullanim: `arr.slice(0, n)` ile orneklenmis kismi al.

    var arr = [1,2,3,4,5,6,7,8,9,10];
    r.sampleInPlace(arr, 3);
    arr.slice(0, 3); // 3 eleman (orneklenmis)
    arr.length;      // 10 (degismedi)

---

### .string(len[, charset]) -> string

Rastgele string.

| Parametre | Tip | Varsayilan | Aciklama |
|---|---|---|---|
| len | number | - | Uzunluk |
| charset | string | a-z A-Z 0-9 | Kullanilacak karakterler |

Guvenlik: negatif len -> `""`, max 1.000.000 karakter, bos charset -> `""`.

    r.string(8);            // "mSIATvPX"
    r.string(4, "abc");     // "caba" vb.
    r.string(-5);           // ""

---

### .uuid() -> string

UUID v4 formati (deterministik seed'li).

Format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- 3. grup basi `4` (versiyon 4)
- 4. grup basi `8|9|a|b` (varyant)

    r.uuid(); // "6255d454-6255-42d4-93f8-fe1dec8b7b49"

---

### .gauss([mean, std]) -> number

Normal (Gauss) dagilim. Box-Muller + cache (her 2 cagrida 1 hesaplama).

| Parametre | Tip | Varsayilan | Aciklama |
|---|---|---|---|
| mean | number | 0 | Ortalama |
| std | number | 1 | Standart sapma |

Guvenlik: `std = 0` -> dogrudan `mean` doner (sonsuz dongu yok).

    r.gauss();       // ~ N(0, 1)
    r.gauss(100, 15); // ~ N(100, 15)

---

### .weighted(items, weights) -> any

Agirlikli rastgele secim.

| Parametre | Tip | Aciklama |
|---|---|---|
| items | Array | Secilecek elemanlar |
| weights | Array | Her elemanin agirligi (pozitif) |

Guvenlik:
- Negatif/NaN agirlik -> 0 kabul
- Tum agirliklar 0 -> uniform dagilim
- Bos dizi -> `undefined`

    r.weighted(["a","b","c"], [1,1,8]); // ~%80 "c"

---

## Yardimci Fonksiyonlar

### SGSeed.hashInt(n) -> number

Tamsayi hash (32-bit).

| Parametre | Tip | Aciklama |
|---|---|---|
| n | number | Hash'lenecek sayi |

    SGSeed.hashInt(12345); // 1747545881

---

### SGSeed.derive(seed, label) -> number

Ana seed'den alt-seed turetir. Farkli label -> farkli seed.

| Parametre | Tip | Aciklama |
|---|---|---|
| seed | any | Ana seed |
| label | string | Alt-seed etiketi |

    SGSeed.derive("main", "player1"); // 4288883605
    SGSeed.derive("main", "player2"); // farkli

Kullanim: Tek seed'den birden fazla bagimsiz alt-dizi uretmek.

    var master = "game-2024";
    var rPlayer = SGSeed.SeedRandom(SGSeed.derive(master, "player"));
    var rEnemy  = SGSeed.SeedRandom(SGSeed.derive(master, "enemy"));
    // Ayni oyun seed'i -> ayni player + enemy dizisi

---

### SGSeed.VERSION -> string

Kutuphane surumu.

    SGSeed.VERSION; // "1.0.0"

---

## Ornekler

### Basit kullanim

    var r = SGSeed.SeedRandom("merhaba");
    console.log(r.int(1, 6));      // zar
    console.log(r.pick(["a","b"])); // yazi-tura
    console.log(r.uuid());

### Deterministik oyun seed'i

    var r = SGSeed.SeedRandom("level-5");
    var enemyPositions = [];
    for (var i = 0; i < 10; i++) {
      enemyPositions.push({ x: r.int(0, 100), y: r.int(0, 100) });
    }
    // Ayni seed -> ayni pozisyonlar

### Agirlikli loot tablosu

    var items  = ["common", "rare", "epic", "legendary"];
    var chance = [70, 20, 8, 2];
    var r = SGSeed.SeedRandom("loot-seed");
    for (var i = 0; i < 20; i++) {
      console.log(r.weighted(items, chance));
    }

### Farkli PRNG algoritmalari

    var r1 = SGSeed.SeedRandom("x", "sfc32");
    var r2 = SGSeed.SeedRandom("x", "xoshiro128ss");
    // Ayni seed, farkli dizi

---

## Guvenlik Notlari

| Durum | Davranis |
|---|---|
| `int(10, 5)` | `5..10` arasi (ters cevrilir) |
| `int(NaN, 5)` | `0..5` (NaN -> 0) |
| `pick([])` | `undefined` |
| `shuffle([])` | `[]` |
| `shuffleInPlace([])` | ayni bos dizi |
| `sampleInPlace(arr, -5)` | n = 0 (ornekleme yok) |
| `sampleInPlace(arr, 999)` | n = length (tum dizi) |
| `string(-5)` | `""` |
| `string(2e6)` | 1.000.000 karakter (clamp) |
| `gauss(x, 0)` | `x` doner |
| `weighted(items, [0,0,0])` | uniform dagilim |
| `weighted(items, [1,-5,2])` | negatif -> 0 |
| `SeedRandom(null)` | calisir, seed = "null" |
| `SeedRandom(Symbol())` | calisir, toString() |

---

## Performans (v1.0.0, 1M iterasyon)

Tipik degerler (Chrome, M1 Mac):

| Fonksiyon | Ops/s | Not |
|---|---|---|
| `hashInt` | ~350M | En hizli |
| `VERSION` | ~400M | String length erisimi |
| `fnv1a` | ~90M | String dongu |
| `mulberry32` | ~50M | PRNG |
| `splitmix32` | ~55M | PRNG |
| `sfc32` | ~15M | Varsayilan, kaliteli |
| `xoshiro128ss` | ~13M | Kaliteli |
| `int` | ~11M | Range + rng |
| `float` | ~14M | Range + rng |
| `bool` | ~11M | Rng + karsilastirma |
| `pick` | ~13M | Rng + array lookup |
| `weighted` | ~7.5M | Dongu + agirlik |
| `gauss` | ~8M | Box-Muller cache |
| `uuid` | ~5.3M | HEX_PAIRS lookup |
| `sampleInPlace` | ~3.8M | n iterasyon |
| `string(8)` | ~1.4M | 8 rng cagrisi + concat |
| `sample` | ~1.2M | shuffle + slice |
| `shuffle` | ~1.07M | Fisher-Yates |
| `shuffleInPlace` | ~1.07M | Fisher-Yates (in-place) |

---

## Sürüm Gecmisi

### v1.0.0 (FINAL)
- Guvenlik: int/float/pick/shuffle/sample/string/gauss/weighted tam koruma
- SeedRandom: null/undefined/Symbol guvenli
- sampleInPlace: length degismez (A secenegi)
- uuid: HEX_PAIRS lookup (~5.3M ops/s)
- gauss: Box-Muller cache (~2x)

### v0.9.1
- shuffleInPlace / sampleInPlace: inline
- uuid: HEX_PAIRS

### v0.9.0
- gauss cache, uuid bit manip, string unrolled
- shuffle forward loop, int `+min |0`

### v0.1.1
- sfc32/xoshiro: `* INV32` (bolme yerine carpma)

### v0.1.0
- Ilk surum: fnv1a, xmur3, cyrb128, mulberry32, sfc32, splitmix32, xoshiro128ss, SeedRandom, hashInt, derive

---

## Lisans

MIT