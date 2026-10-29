/*!
 * SG-Seed v1.0.0
 * Tek dosyali seed kutuphanesi - FINAL
 * MIT License
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SGSeed = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var INV32 = 2.3283064365386963e-10;
  var MAX_STRING_LEN = 1000000;

  /* ---------- Hash ---------- */

  function fnv1a(str) {
    str = String(str);
    var h = 0x811c9dc5;
    for (var i = 0, n = str.length; i < n; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
    }
    return h >>> 0;
  }

  function xmur3(str) {
    str = String(str);
    var h = 1779033703 ^ str.length;
    for (var i = 0, n = str.length; i < n; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function cyrb128(str) {
    str = String(str);
    var h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (var i = 0, n = str.length, k; i < n; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0,
            (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }

  /* ---------- PRNG ---------- */

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) * INV32;
    };
  }

  function sfc32(a, b, c, d) {
    return function () {
      var t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) * INV32;
    };
  }

  function splitmix32(a) {
    return function () {
      a = (a + 0x9E3779B9) | 0;
      var t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21F0AAAD);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735A2D97);
      t = t ^ (t >>> 15);
      return (t >>> 0) * INV32;
    };
  }

  function xoshiro128ss(a, b, c, d) {
    return function () {
      var t = b << 9, r = b * 5;
      r = ((r << 7) | (r >>> 25)) * 9;
      c ^= a; d ^= b;
      b ^= c; a ^= d;
      c ^= t;
      d = (d << 11) | (d >>> 21);
      return (r >>> 0) * INV32;
    };
  }

  /* ---------- Hex lookup ---------- */
  var HEX = "0123456789abcdef";
  var HEX_PAIRS = new Array(256);
  for (var _i = 0; _i < 256; _i++) {
    HEX_PAIRS[_i] = HEX[_i >> 4] + HEX[_i & 0xF];
  }

  /* ---------- SeedRandom ---------- */

  function SeedRandom(seed, algorithm) {
    if (!(this instanceof SeedRandom)) return new SeedRandom(seed, algorithm);
    // Guvenlik: Symbol ve null/undefined guvenli sekilde string'e cevir
    var str;
    if (seed === undefined) str = "";
    else if (seed === null) str = "null";
    else if (typeof seed === "symbol") str = seed.toString();
    else str = String(seed);

    var s = cyrb128(str);
    var algo = algorithm || "sfc32";
    var rng;
    switch (algo) {
      case "mulberry32": rng = mulberry32(xmur3(str)()); break;
      case "splitmix32": rng = splitmix32(xmur3(str)()); break;
      case "xoshiro128ss": rng = xoshiro128ss(s[0], s[1], s[2], s[3]); break;
      case "sfc32":
      default:
        algo = "sfc32";
        rng = sfc32(s[0], s[1], s[2], s[3]);
        break;
    }
    this._rng = rng;
    this._algorithm = algo;
    this._seed = seed;
    this._gaussCache = null;
  }

  SeedRandom.prototype.next = function () { return this._rng(); };

  // int: guvenli clamp, NaN/Infinity korumasi
  SeedRandom.prototype.int = function (min, max) {
    if (max === undefined) { max = min; min = 0; }
    min = +min || 0;
    max = +max || 0;
    if (max < min) { var t = min; min = max; max = t; }
    return ((this._rng() * (max - min + 1)) + min) | 0;
  };

  SeedRandom.prototype.intFast = SeedRandom.prototype.int;

  SeedRandom.prototype.float = function (min, max) {
    var r = this._rng();
    if (min === undefined) return r;
    min = +min || 0;
    if (max === undefined) { max = min; min = 0; }
    else max = +max || 0;
    if (max < min) { var t = min; min = max; max = t; }
    return r * (max - min) + min;
  };

  SeedRandom.prototype.bool = function (p) {
    p = (p === undefined) ? 0.5 : +p;
    if (!(p >= 0 && p <= 1)) p = 0.5;
    return this._rng() < p;
  };

  SeedRandom.prototype.pick = function (arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[(this._rng() * arr.length) | 0];
  };

  // shuffle: kopya, inline Fisher-Yates (v1.0.0 - reverse loop)
  SeedRandom.prototype.shuffle = function (arr) {
    if (!arr || arr.length === 0) return [];
    var a = arr.slice();
    var rng = this._rng;
    for (var i = a.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // shuffleInPlace: yerinde, inline
  SeedRandom.prototype.shuffleInPlace = function (arr) {
    if (!arr || arr.length === 0) return arr;
    var rng = this._rng;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  SeedRandom.prototype.sample = function (arr, n) {
    if (!arr || arr.length === 0) return [];
    var s = this.shuffle(arr);
    return s.slice(0, n | 0);
  };

  // sampleInPlace: ilk n eleman orneklenir, length DEGISMEZ
  // n negatifse 0, n > length ise length
  SeedRandom.prototype.sampleInPlace = function (arr, n) {
    if (!arr || arr.length === 0) return arr;
    var rng = this._rng;
    var len = arr.length;
    n = (n | 0);
    if (n < 0) n = 0;
    if (n > len) n = len;
    for (var i = 0; i < n; i++) {
      var j = i + ((rng() * (len - i)) | 0);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  var DEFAULT_CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  SeedRandom.prototype.string = function (len, charset) {
    len = (len | 0);
    if (len < 0) len = 0;
    if (len > MAX_STRING_LEN) len = MAX_STRING_LEN;
    if (len === 0) return "";
    var cs = charset || DEFAULT_CHARSET;
    var csLen = cs.length;
    if (csLen === 0) return "";
    var rng = this._rng;
    if (len === 8) {
      return cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0] +
             cs[(rng() * csLen) | 0];
    }
    // Genel: parts + join (uzun string'de += 'den hizli)
    var parts = new Array(len);
    for (var i = 0; i < len; i++) {
      parts[i] = cs[(rng() * csLen) | 0];
    }
    return parts.join("");
  };

  // uuid v1.0.0: HEX_PAIRS lookup (v0.9.1 ile ayni, ~5.3M ops/s)
  SeedRandom.prototype.uuid = function () {
    var rng = this._rng;
    var a = (rng() * 0xFFFFFFFF) >>> 0;
    var b = (rng() * 0xFFFFFFFF) >>> 0;
    var c = (rng() * 0xFFFFFFFF) >>> 0;
    var s = HEX_PAIRS[a >>> 24 & 0xFF] + HEX_PAIRS[a >>> 16 & 0xFF] +
            HEX_PAIRS[a >>> 8  & 0xFF] + HEX_PAIRS[a       & 0xFF] + "-";
    var aTop = a >>> 16;
    s += HEX_PAIRS[aTop >>> 8 & 0xFF] + HEX_PAIRS[aTop & 0xFF] + "-";
    var g3v = 0x4000 | ((b >>> 20) & 0x0FFF);
    s += HEX_PAIRS[g3v >>> 8 & 0xFF] + HEX_PAIRS[g3v & 0xFF] + "-";
    var g4v = 0x8000 | ((b >>> 6) & 0x3FFF);
    s += HEX_PAIRS[g4v >>> 8 & 0xFF] + HEX_PAIRS[g4v & 0xFF] + "-";
    s += HEX_PAIRS[b >>> 8 & 0xFF] + HEX_PAIRS[b & 0xFF] +
         HEX_PAIRS[c >>> 24 & 0xFF] + HEX_PAIRS[c >>> 16 & 0xFF] +
         HEX_PAIRS[c >>> 8  & 0xFF] + HEX_PAIRS[c       & 0xFF];
    return s;
  };

  // gauss: std=0 -> mean dogrudan (sonsuz dongu yok), NaN koruma
  SeedRandom.prototype.gauss = function (mean, std) {
    mean = (mean === undefined) ? 0 : +mean;
    std  = (std  === undefined) ? 1 : +std;
    if (!isFinite(mean)) mean = 0;
    if (!isFinite(std) || std === 0) return mean;
    if (this._gaussCache !== null) {
      var cached = this._gaussCache;
      this._gaussCache = null;
      return cached * std + mean;
    }
    var u1 = this._rng() || 1e-12;
    var u2 = this._rng();
    var mag = Math.sqrt(-2 * Math.log(u1));
    var z0 = mag * Math.cos(6.283185307179586 * u2);
    var z1 = mag * Math.sin(6.283185307179586 * u2);
    this._gaussCache = z1;
    return z0 * std + mean;
  };

  // weighted: bos items, negatif/NaN agirlik guvenligi
  SeedRandom.prototype.weighted = function (items, weights) {
    if (!items || items.length === 0 || !weights || weights.length === 0) return undefined;
    var n = Math.min(items.length, weights.length);
    var total = 0, i;
    for (i = 0; i < n; i++) {
      var w = +weights[i];
      if (!(w > 0)) w = 0; // negatif/NaN -> 0
      total += w;
    }
    if (total <= 0) return items[(this._rng() * n) | 0]; // hepsi 0 -> uniform
    var r = this._rng() * total;
    var acc = 0;
    for (i = 0; i < n; i++) {
      var w2 = +weights[i];
      if (!(w2 > 0)) w2 = 0;
      acc += w2;
      if (r < acc) return items[i];
    }
    return items[n - 1];
  };

  /* ---------- Yardimcilar ---------- */

  function hashInt(n) {
    n = +n;
    if (!isFinite(n)) n = 0;
    n = n >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
  }

  function derive(seed, label) {
    return fnv1a("" + seed + "::" + label);
  }

  return {
    VERSION: VERSION,
    fnv1a: fnv1a,
    xmur3: xmur3,
    cyrb128: cyrb128,
    mulberry32: mulberry32,
    sfc32: sfc32,
    splitmix32: splitmix32,
    xoshiro128ss: xoshiro128ss,
    SeedRandom: SeedRandom,
    hashInt: hashInt,
    derive: derive
  };
});