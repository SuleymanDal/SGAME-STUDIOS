// ============================================================
// ENT - Çarpık Cümle ECS v1.3.1
// Felsefe: Az Fonksiyon, Çok İş. Ezber Yok, Ritim Var.
// SGame Studios - 2026
// ============================================================
// v1.3.1 Yeni:
//   - Tag/Grup: ent.tag("player").enemy.count()
//   - Zaman: ent.timer(), ent.after(), ent.update(dt)
// ============================================================

(function(global) {
  "use strict";

  var currentScene = "default";
  var scenes = {
    "default": { entities: [], typeMap: {}, groupMap: {}, needsSweep: false }
  };
  var nextId = 1;
  var debugMode = false;
  var conditionCache = {};
  var BATCH_THRESHOLD = 500;

  // Zaman sistemi
  var timers = {};
  var timeAccumulator = 0;

  function getActiveScene() { return scenes[currentScene]; }

  function logError(fn, msg) {
    if (debugMode) console.error("[ENT] " + fn + ": " + msg);
    throw new Error("[ENT " + fn + "] " + msg);
  }

  // ============================================================
  // ENTITY
  // ============================================================
  function Entity(type, data) {
    this.id = nextId++;
    this.type = type;
    this.data = data || {};
    this.alive = true;
  }
  Entity.prototype.get = function(k) {
    return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : undefined;
  };
  Entity.prototype.set = function(k, v) { this.data[k] = v; return this; };
  Entity.prototype.has = function(k) {
    return Object.prototype.hasOwnProperty.call(this.data, k);
  };
  Entity.prototype.kill = function() {
    this.alive = false;
    getActiveScene().needsSweep = true;
    return this;
  };

  // ============================================================
  // SWEEP
  // ============================================================
  function sweep() {
    var scene = getActiveScene();
    if (!scene.needsSweep) return 0;
    var before = scene.entities.length;
    var alive = [];
    for (var i = 0; i < scene.entities.length; i++) {
      if (scene.entities[i].alive) alive.push(scene.entities[i]);
    }
    scene.entities = alive;
    // groupMap'i de temizle
    if (scene.groupMap) {
      for (var grp in scene.groupMap) {
        if (!scene.groupMap.hasOwnProperty(grp)) continue;
        var grpList = scene.groupMap[grp];
        var aliveGrp = [];
        for (var gi = 0; gi < grpList.length; gi++) {
          if (grpList[gi].alive) aliveGrp.push(grpList[gi]);
        }
        if (aliveGrp.length > 0) scene.groupMap[grp] = aliveGrp;
        else delete scene.groupMap[grp];
      }
    }
    for (var type in scene.typeMap) {
      if (!scene.typeMap.hasOwnProperty(type)) continue;
      var list = scene.typeMap[type];
      var aliveOfType = [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].alive) aliveOfType.push(list[j]);
      }
      if (aliveOfType.length > 0) scene.typeMap[type] = aliveOfType;
      else delete scene.typeMap[type];
    }
    scene.needsSweep = false;
    return before - scene.entities.length;
  }

  // ============================================================
  // KOSUL PARSE
  // ============================================================
  function parseCondition(cond) {
    if (typeof cond === "string") {
      var key = cond;
      return function(e) { return e.has(key) && !!e.get(key); };
    }
    if (typeof cond === "function") return cond;
    if (typeof cond === "object" && cond !== null) {
      var cacheKey = JSON.stringify(cond);
      if (conditionCache[cacheKey]) return conditionCache[cacheKey];
      var obj = cond;
      var keys = Object.keys(obj);
      var fn;
      if (keys.length === 1) {
        var k = keys[0];
        var expected = obj[k];
        if (typeof expected === "string") {
          var m = expected.match(/^([<>]=?)\s*(-?\d+(?:\.\d+)?)$/);
          if (m) {
            var op = m[1], num = parseFloat(m[2]);
            if (op === "<")  fn = function(e) { var v = e.data[k]; return v !== undefined && v < num; };
            if (op === "<=") fn = function(e) { var v = e.data[k]; return v !== undefined && v <= num; };
            if (op === ">")  fn = function(e) { var v = e.data[k]; return v !== undefined && v > num; };
            if (op === ">=") fn = function(e) { var v = e.data[k]; return v !== undefined && v >= num; };
          } else {
            fn = function(e) { return e.data[k] === expected; };
          }
        } else {
          fn = function(e) { return e.data[k] === expected; };
        }
      } else {
        fn = function(e) {
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (!Object.prototype.hasOwnProperty.call(e.data, key)) return false;
            var expected = obj[key];
            var actual = e.data[key];
            if (typeof expected === "string") {
              var m = expected.match(/^([<>]=?)\s*(-?\d+(?:\.\d+)?)$/);
              if (m) {
                var op = m[1], num = parseFloat(m[2]);
                if (op === "<"  && !(actual <  num)) return false;
                if (op === "<=" && !(actual <= num)) return false;
                if (op === ">"  && !(actual >  num)) return false;
                if (op === ">=" && !(actual >= num)) return false;
              } else if (actual !== expected) return false;
            } else if (actual !== expected) return false;
          }
          return true;
        };
      }
      conditionCache[cacheKey] = fn;
      return fn;
    }
    logError("where", "Gecersiz kosul tipi: " + typeof cond);
  }

  // ============================================================
  // QUERY
  // ============================================================
  function Query(getList, condition, invert) {
    this.getList = getList;
    this.condition = condition;
    this.invert = invert;
  }
  Query.prototype.selected = function() {
    var list = this.getList();
    if (list.length === 0) return [];
    if (getActiveScene().needsSweep) sweep();
    if (!this.condition) return list.slice();
    if (list.length >= BATCH_THRESHOLD) return this._batchQuery(list);
    return this._simpleQuery(list);
  };
  Query.prototype._simpleQuery = function(list) {
    var out = [];
    var cond = this.condition, inv = this.invert;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive) continue;
      var ok = !!cond(e);
      if (inv) ok = !ok;
      if (ok) out.push(e);
    }
    return out;
  };
  Query.prototype._batchQuery = function(list) {
    var out = [];
    var cond = this.condition, inv = this.invert;
    var CHUNK = 500;
    for (var start = 0; start < list.length; start += CHUNK) {
      var end = Math.min(start + CHUNK, list.length);
      for (var i = start; i < end; i++) {
        var e = list[i];
        if (!e.alive) continue;
        var ok = !!cond(e);
        if (inv) ok = !ok;
        if (ok) out.push(e);
      }
    }
    return out;
  };

  // ============================================================
  // ACTIONS
  // ============================================================
  var actions = {
    kill: function() {
      var sel = this.selected();
      if (sel.length === 0) return 0;
      var scene = getActiveScene();
      scene.needsSweep = true;
      for (var i = 0; i < sel.length; i++) sel[i].alive = false;
      sweep();
      return sel.length;
    },
    do: function(fn) {
      if (typeof fn !== "function") logError("do", "Fonksiyon gerekli");
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) fn(sel[i], i);
      return sel.length;
    },
    give: function(k, v) {
      if (typeof k !== "string") logError("give", "Key string olmali");
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) sel[i].set(k, v);
      return sel.length;
    },
    take: function(k) {
      if (typeof k !== "string") logError("take", "Key string olmali");
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) delete sel[i].data[k];
      return sel.length;
    },
    set: function(k, v) { return this.give(k, v); },
    count: function() { return this.selected().length; },
    list: function() { return this.selected(); },
    first: function() {
      var sel = this.selected();
      return sel.length > 0 ? sel[0] : null;
    },
    each: function(fn) {
      if (typeof fn !== "function") logError("each", "Fonksiyon gerekli");
      var sel = this.selected();
      for (var i = 0; i < sel.length; i++) fn(sel[i], i);
      return sel.length;
    }
  };

  // ============================================================
  // BUILDER
  // ============================================================
  function Builder(getList) {
    this.getList = getList;
    this._condition = null;
    this._invert = false;
  }
  Builder.prototype.where = function(cond) {
    this._condition = parseCondition(cond);
    return this;
  };
  Builder.prototype["if"] = Builder.prototype.where;
  Object.defineProperty(Builder.prototype, "true", {
    get: function() { this._invert = false; return this; }
  });
  Object.defineProperty(Builder.prototype, "false", {
    get: function() { this._invert = true; return this; }
  });
  for (var name in actions) {
    if (actions.hasOwnProperty(name)) {
      (function(n) {
        Builder.prototype[n] = function() {
          var q = new Query(this.getList, this._condition, this._invert);
          return actions[n].apply(q, arguments);
        };
      })(name);
    }
  }

  // ============================================================
  // TAG BUILDER
  // ent.tag("player").enemy.count()
  // ============================================================
  function TagBuilder(tagName) {
    this._tagName = tagName;
  }

  TagBuilder.prototype._getListForGroup = function(groupName) {
    var scene = getActiveScene();
    // groupMap varsa onu kullan (O(k) - hizli)
    var groupList = scene.groupMap[groupName] || [];
    var out = [];
    for (var i = 0; i < groupList.length; i++) {
      var e = groupList[i];
      if (e.alive && e.type === this._tagName) out.push(e);
    }
    return out;
  };

  function makeTagProxy(tagName) {
    var tagBuilder = new TagBuilder(tagName);
    return new Proxy(tagBuilder, {
      get: function(target, prop) {
        if (prop in target && typeof target[prop] === "function") return target[prop];
        // Group adı -> Builder
        var groupName = prop;
        return new Builder(function() {
          return target._getListForGroup(groupName);
        });
      }
    });
  }

  // ============================================================
  // ZAMAN SISTEMI
  // ============================================================
  var timerAPI = {
    create: function(name, interval, callback) {
      if (typeof name !== "string") logError("timer", "Name string olmali");
      if (typeof interval !== "number") logError("timer", "Interval sayi olmali");
      if (typeof callback !== "function") logError("timer", "Callback fonksiyon olmali");
      timers[name] = {
        name: name,
        interval: interval,
        callback: callback,
        elapsed: 0,
        active: true,
        once: false
      };
      return timerAPI;
    },
    after: function(delay, callback) {
      if (typeof delay !== "number") logError("after", "Delay sayi olmali");
      if (typeof callback !== "function") logError("after", "Callback fonksiyon olmali");
      var name = "_after_" + Date.now() + "_" + Math.random();
      timers[name] = {
        name: name,
        interval: delay,
        callback: callback,
        elapsed: 0,
        active: true,
        once: true
      };
      return timerAPI;
    },
    stop: function(name) {
      if (timers[name]) {
        timers[name].active = false;
        delete timers[name];
      }
      return timerAPI;
    },
    stopAll: function() {
      for (var name in timers) {
        if (timers.hasOwnProperty(name)) delete timers[name];
      }
      return timerAPI;
    },
    remaining: function(name) {
      var t = timers[name];
      if (!t) return 0;
      return Math.max(0, t.interval - t.elapsed);
    },
    active: function(name) {
      var t = timers[name];
      return t ? t.active : false;
    },
    list: function() { return Object.keys(timers); }
  };

  // ============================================================
  // ENT
  // ============================================================
  var entCore = {
    spawn: function(type, data) {
      if (!type || typeof type !== "string") logError("spawn", "Type string olmali");
      var scene = getActiveScene();
      var e = new Entity(type, data);
      scene.entities.push(e);
      if (!scene.typeMap[type]) scene.typeMap[type] = [];
      scene.typeMap[type].push(e);
      // Group map'e ekle (hizli tag sorgusu icin)
      var grp = e.get("group");
      if (grp) {
        if (!scene.groupMap[grp]) scene.groupMap[grp] = [];
        scene.groupMap[grp].push(e);
      }
      return e;
    },
    scene: function(name) {
      if (name === undefined) return currentScene;
      if (typeof name !== "string") logError("scene", "Sahne adi string olmali");
      currentScene = name;
      if (!scenes[name]) scenes[name] = { entities: [], typeMap: {}, groupMap: {}, needsSweep: false };
      return new Builder(function() { return scenes[name].entities; });
    },
    scenes: function() { return Object.keys(scenes); },
    sweep: function() { return sweep(); },
    clear: function() {
      var scene = getActiveScene();
      scene.entities = [];
      scene.typeMap = {};
      scene.groupMap = {};
      scene.needsSweep = false;
    },
    clearAll: function() {
      scenes = { "default": { entities: [], typeMap: {}, groupMap: {}, needsSweep: false } };
      currentScene = "default";
      timers = {};
      timeAccumulator = 0;
    },
    debug: function(on) { debugMode = !!on; return debugMode; },
    setBatchThreshold: function(n) {
      BATCH_THRESHOLD = Math.max(100, n);
      return BATCH_THRESHOLD;
    },

    // Tag: ent.tag("player").enemy
    tag: function(tagName) {
      if (typeof tagName !== "string") logError("tag", "Tag adi string olmali");
      return makeTagProxy(tagName);
    },

    // Zaman
    timer: timerAPI,
    after: function(delay, callback) { return timerAPI.after(delay, callback); },

    update: function(dt) {
      if (typeof dt !== "number" || dt <= 0) return;
      timeAccumulator += dt;
      for (var name in timers) {
        if (!timers.hasOwnProperty(name)) continue;
        var t = timers[name];
        if (!t.active) continue;
        t.elapsed += dt;
        if (t.elapsed >= t.interval) {
          try { t.callback(t.elapsed); } catch(e) { console.error("[ENT timer] " + name + ": " + e.message); }
          if (t.once) delete timers[name];
          else t.elapsed -= t.interval;
        }
      }
    },

    with: new Builder(function() { return getActiveScene().entities; }),
    all: new Builder(function() { return getActiveScene().entities; })
  };
  entCore.create = entCore.spawn;

  Object.defineProperty(entCore, "count", {
    get: function() { return getActiveScene().entities.length; }
  });
  Object.defineProperty(entCore, "types", {
    get: function() { return Object.keys(getActiveScene().typeMap); }
  });
  Object.defineProperty(entCore, "list", {
    get: function() { return getActiveScene().entities.slice(); }
  });
  Object.defineProperty(entCore, "time", {
    get: function() { return timeAccumulator; }
  });

  var ent = new Proxy(entCore, {
    get: function(target, prop) {
      if (prop in target) return target[prop];
      var typeName = prop;
      return new Builder(function() {
        return getActiveScene().typeMap[typeName] || [];
      });
    }
  });

  var helpers = {
    distance: function(a, b) {
      if (!a || !b) return Infinity;
      var ax = a.get("x") || 0, ay = a.get("y") || 0;
      var bx = b.get("x") || 0, by = b.get("y") || 0;
      var dx = ax - bx, dy = ay - by;
      return Math.sqrt(dx * dx + dy * dy);
    },
    near: function(a, b, r) {
      if (!a || !b) return false;
      return helpers.distance(a, b) <= (r || 100);
    }
  };

  global.ent = ent;
  global.EntEntity = Entity;
  global.EntBuilder = Builder;
  global.EntActions = actions;
  global.EntHelpers = helpers;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ent: ent, Entity: Entity, Builder: Builder, Actions: actions, Helpers: helpers };
  }

  console.log("[ENT] v1.3.1 yuklendi (tag/grup + zaman).");
})(typeof window !== "undefined" ? window : global);