// ============================================================
// SGame Engine v1.1.0 - FULL 2D GAME ENGINE
// SGame Studios
// 2026-10-24 11:27:10
// ============================================================

// --- math\Vector2.js ---
// SGame Engine - Vector2
// 2D vektor matematigi
(function(global) {
  "use strict";
  function Vector2(x, y) {
    this.x = x || 0;
    this.y = y || 0;
  }
  Vector2.prototype.add = function(v) { this.x += v.x; this.y += v.y; return this; };
  Vector2.prototype.sub = function(v) { this.x -= v.x; this.y -= v.y; return this; };
  Vector2.prototype.mul = function(s) { this.x *= s; this.y *= s; return this; };
  Vector2.prototype.div = function(s) { this.x /= s; this.y /= s; return this; };
  Vector2.prototype.length = function() { return Math.sqrt(this.x*this.x + this.y*this.y); };
  Vector2.prototype.normalize = function() { var l = this.length(); if (l > 0) this.div(l); return this; };
  Vector2.prototype.clone = function() { return new Vector2(this.x, this.y); };
  Vector2.prototype.distance = function(v) { var dx = this.x-v.x, dy = this.y-v.y; return Math.sqrt(dx*dx+dy*dy); };
  Vector2.prototype.dot = function(v) { return this.x*v.x + this.y*v.y; };
  Vector2.prototype.set = function(x, y) { this.x = x; this.y = y; return this; };
  Vector2.prototype.zero = function() { this.x = 0; this.y = 0; return this; };
  Vector2.add = function(a, b) { return new Vector2(a.x+b.x, a.y+b.y); };
  Vector2.sub = function(a, b) { return new Vector2(a.x-b.x, a.y-b.y); };
  Vector2.distance = function(a, b) { return a.distance(b); };
  global.SGame = global.SGame || {};
  global.SGame.Vector2 = Vector2;
})(window);

// --- math\Rect.js ---
// SGame Engine - Rect
// Dikdortgen sinifi
(function(global) {
  "use strict";
  function Rect(x, y, w, h) {
    this.x = x || 0; this.y = y || 0;
    this.w = w || 0; this.h = h || 0;
  }
  Rect.prototype.contains = function(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };
  Rect.prototype.intersects = function(r) {
    return this.x < r.x + r.w && this.x + this.w > r.x && this.y < r.y + r.h && this.y + this.h > r.y;
  };
  Rect.prototype.clone = function() { return new Rect(this.x, this.y, this.w, this.h); };
  global.SGame = global.SGame || {};
  global.SGame.Rect = Rect;
})(window);

// --- math\Random.js ---
// SGame Engine - Random
(function(global) {
  "use strict";
  var R = {};
  R.range = function(min, max) { return Math.random() * (max - min) + min; };
  R.int = function(min, max) { return Math.floor(R.range(min, max + 1)); };
  R.chance = function(p) { return Math.random() < p; };
  R.pick = function(arr) { return arr[R.int(0, arr.length - 1)]; };
  R.shuffle = function(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = R.int(0, i); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  global.SGame = global.SGame || {};
  global.SGame.Random = R;
})(window);

// --- core\Time.js ---
// SGame Engine - Time
(function(global) {
  "use strict";
  function Time() {
    this.delta = 0;
    this.elapsed = 0;
    this.fps = 0;
    this._last = 0;
    this._fpsCount = 0;
    this._fpsTime = 0;
  }
  Time.prototype.update = function(now) {
    if (this._last === 0) this._last = now;
    this.delta = (now - this._last) / 1000;
    this._last = now;
    this.elapsed += this.delta;
    this._fpsCount++;
    this._fpsTime += this.delta;
    if (this._fpsTime >= 1) {
      this.fps = this._fpsCount;
      this._fpsCount = 0; this._fpsTime = 0;
    }
  };
  global.SGame = global.SGame || {};
  global.SGame.Time = Time;
})(window);

// --- core\Scene.js ---
// SGame Engine - Scene
(function(global) {
  "use strict";
  function Scene(name) {
    this.name = name;
    this.entities = [];
    this.systems = [];
    this._started = false;
  }
  Scene.prototype.add = function(entity) { this.entities.push(entity); return entity; };
  Scene.prototype.remove = function(entity) {
    var i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
  };
  Scene.prototype.start = function() {
    if (this._started) return;
    this._started = true;
    if (typeof this.onCreate === "function") this.onCreate();
  };
  Scene.prototype.update = function(dt) {
    if (typeof this.onUpdate === "function") this.onUpdate(dt);
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (e.active && typeof e.update === "function") e.update(dt);
    }
  };
  Scene.prototype.render = function(renderer) {
    if (typeof this.onRender === "function") this.onRender(renderer);
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (e.visible && typeof e.render === "function") e.render(renderer);
    }
  };
  global.SGame = global.SGame || {};
  global.SGame.Scene = Scene;
})(window);

// --- core\Entity.js ---
// SGame Engine - Entity
(function(global) {
  "use strict";
  function Entity(name) {
    this.name = name || "Entity";
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.width = 0; this.height = 0;
    this.active = true;
    this.visible = true;
    this.tag = "";
    this.components = [];
    this.scene = null;
  }
  Entity.prototype.addComponent = function(c) {
    c.entity = this; this.components.push(c); return c;
  };
  Entity.prototype.getComponent = function(type) {
    for (var i = 0; i < this.components.length; i++) {
      if (this.components[i] instanceof type) return this.components[i];
    }
    return null;
  };
  Entity.prototype.update = function(dt) {
    if (typeof this.onUpdate === "function") this.onUpdate(dt);
    for (var i = 0; i < this.components.length; i++) {
      if (this.components[i].active) this.components[i].update(dt);
    }
  };
  Entity.prototype.render = function(renderer) {
    if (typeof this.onRender === "function") this.onRender(renderer);
    for (var i = 0; i < this.components.length; i++) {
      if (this.components[i].visible) this.components[i].render(renderer);
    }
  };
  Entity.prototype.destroy = function() {
    if (this.scene) this.scene.remove(this);
  };
  global.SGame = global.SGame || {};
  global.SGame.Entity = Entity;
})(window);

// --- core\Component.js ---
// SGame Engine - Component
(function(global) {
  "use strict";
  function Component() {
    this.entity = null;
    this.active = true;
    this.visible = true;
  }
  Component.prototype.update = function(dt) {};
  Component.prototype.render = function(renderer) {};
  global.SGame = global.SGame || {};
  global.SGame.Component = Component;
})(window);

// --- core\ECS.js ---
// SGame Engine - ECS (Entity-Component-System)
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function ECS() {
    this.entities = [];
    this.systems = [];
    this.nextId = 1;
    this.components = {};
  }
  
  ECS.prototype.createEntity = function() {
    var e = { id: this.nextId++, components: {}, active: true };
    this.entities.push(e);
    return e;
  };
  
  ECS.prototype.destroyEntity = function(e) {
    e.active = false;
    var i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
  };
  
  ECS.prototype.addComponent = function(entity, type, data) {
    var c = { type: type, entity: entity };
    if (data) for (var k in data) c[k] = data[k];
    entity.components[type] = c;
    if (!this.components[type]) this.components[type] = [];
    this.components[type].push(c);
    return c;
  };
  
  ECS.prototype.getComponent = function(entity, type) {
    return entity.components[type];
  };
  
  ECS.prototype.addSystem = function(system) {
    this.systems.push(system);
  };
  
  ECS.prototype.update = function(dt) {
    for (var i = 0; i < this.systems.length; i++) {
      var sys = this.systems[i];
      if (sys.update) sys.update(this, dt);
    }
  };
  
  ECS.prototype.getEntitiesWith = function(types) {
    var result = [];
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      var hasAll = true;
      for (var j = 0; j < types.length; j++) {
        if (!e.components[types[j]]) { hasAll = false; break; }
      }
      if (hasAll) result.push(e);
    }
    return result;
  };
  
  SGame.ECS = ECS;
})(window);

// --- core\SceneManager.js ---
// SGame Engine - SceneManager
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function SceneManager(game) {
    this.game = game;
    this.scenes = {};
    this.current = null;
    this.previous = null;
    this.transition = null;
    this.loadingScene = null;
    this.loadingProgress = 0;
  }
  
  SceneManager.prototype.add = function(name, scene) {
    this.scenes[name] = scene;
    scene.name = name;
    scene.game = this.game;
    return scene;
  };
  
  SceneManager.prototype.go = function(name, options) {
    options = options || {};
    var self = this;
    var target = this.scenes[name];
    if (!target) { console.warn("Sahne yok: " + name); return; }
    
    var doChange = function() {
      if (self.current && self.current.onStop) self.current.onStop();
      self.previous = self.current;
      self.current = target;
      if (target.onStart) target.onStart(options);
    };
    
    if (options.transition) {
      var t = new SGame.Transition(options.transition, options.duration || 0.5);
      this.transition = t;
      t.start(doChange, function() { self.transition = null; });
    } else {
      doChange();
    }
  };
  
  SceneManager.prototype.update = function(dt) {
    if (this.transition) this.transition.update(dt);
    if (this.current && this.current.update) this.current.update(dt);
  };
  
  SceneManager.prototype.render = function(renderer) {
    if (this.current && this.current.render) this.current.render(renderer);
    if (this.transition) this.transition.render(renderer);
  };
  
  SGame.SceneManager = SceneManager;
})(window);

// --- core\Debug.js ---
// SGame Engine - Debug
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Debug(renderer) {
    this.renderer = renderer;
    this.enabled = false;
    this.showFPS = true;
    this.showHitboxes = false;
    this.showStats = false;
    this.history = [];
    this.maxHistory = 60;
  }
  
  Debug.prototype.toggle = function() {
    this.enabled = !this.enabled;
  };
  
  Debug.prototype.render = function(ctx, info) {
    if (!this.enabled) return;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(5, 5, 180, 80);
    ctx.fillStyle = "#0f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var y = 10;
    if (this.showFPS) {
      ctx.fillText("FPS: " + (info.fps || 0), 10, y); y += 15;
    }
    if (this.showStats) {
      ctx.fillText("Entities: " + (info.entities || 0), 10, y); y += 15;
      ctx.fillText("Particles: " + (info.particles || 0), 10, y); y += 15;
      ctx.fillText("Bodies: " + (info.bodies || 0), 10, y); y += 15;
    }
    ctx.restore();
  };
  
  Debug.prototype.drawHitbox = function(ctx, x, y, w, h, color) {
    if (!this.enabled || !this.showHitboxes) return;
    ctx.save();
    ctx.strokeStyle = color || "#ff3366";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  };
  
  SGame.Debug = Debug;
})(window);

// --- core\FixedLoop.js ---
// SGame Engine - Fixed Timestep Loop
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  // Game prototype'a fixed timestep ekle
  var originalStart = SGame.Game.prototype.start;
  
  SGame.Game.prototype.startFixed = function(sceneName, options) {
    options = options || {};
    var fixedDelta = options.fixedDelta || 1 / 60;
    var maxFrameTime = options.maxFrameTime || 0.25;
    this._accumulator = 0;
    this._fixedDelta = fixedDelta;
    this._maxFrameTime = maxFrameTime;
    this.running = true;
    
    var self = this;
    var lastTime = performance.now();
    
    var loop = function(now) {
      if (!self.running) return;
      var frameTime = (now - lastTime) / 1000;
      if (frameTime > maxFrameTime) frameTime = maxFrameTime;
      lastTime = now;
      self._accumulator += frameTime;
      
      while (self._accumulator >= fixedDelta) {
        if (self.currentScene && self.currentScene.update) {
          self.currentScene.update(fixedDelta);
        }
        if (self.physics) self.physics.update(fixedDelta);
        self._accumulator -= fixedDelta;
      }
      
      self.renderer.clear();
      if (self.currentScene && self.currentScene.render) {
        self.currentScene.render(self.renderer);
      }
      
      self.keyboard.clearFrame();
      self.mouse.clearFrame();
      
      requestAnimationFrame(loop);
    };
    
    if (sceneName) this.changeScene(sceneName);
    requestAnimationFrame(loop);
  };
  
})(window);

// --- graphics\Renderer.js ---
// SGame Engine - Renderer
(function(global) {
  "use strict";
  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.clearColor = "#0d0d11";
  }
  Renderer.prototype.clear = function() {
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  };
  Renderer.prototype.resize = function(w, h) {
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
  };
  Renderer.prototype.drawRect = function(x, y, w, h, color) {
    this.ctx.fillStyle = color || "#fff";
    this.ctx.fillRect(x, y, w, h);
  };
  Renderer.prototype.drawCircle = function(x, y, r, color) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color || "#fff";
    this.ctx.fill();
  };
  Renderer.prototype.drawText = function(text, x, y, size, color, align) {
    this.ctx.fillStyle = color || "#fff";
    this.ctx.font = (size || 16) + "px sans-serif";
    this.ctx.textAlign = align || "left";
    this.ctx.textBaseline = "top";
    this.ctx.fillText(text, x, y);
  };
  Renderer.prototype.drawImage = function(img, x, y, w, h) {
    if (w !== undefined && h !== undefined) this.ctx.drawImage(img, x, y, w, h);
    else this.ctx.drawImage(img, x, y);
  };
  global.SGame = global.SGame || {};
  global.SGame.Renderer = Renderer;
})(window);

// --- graphics\Sprite.js ---
// SGame Engine - Sprite
(function(global) {
  "use strict";
  function Sprite(src) {
    this.image = new Image();
    this.image.src = src;
    this.loaded = false;
    var self = this;
    this.image.onload = function() { self.loaded = true; };
  }
  Sprite.prototype.draw = function(renderer, x, y, w, h) {
    if (!this.loaded) return;
    renderer.drawImage(this.image, x, y, w, h);
  };
  global.SGame = global.SGame || {};
  global.SGame.Sprite = Sprite;
})(window);

// --- graphics\Animation.js ---
// SGame Engine - Animation
(function(global) {
  "use strict";
  function Animation(frames, fps) {
    this.frames = frames || [];
    this.fps = fps || 10;
    this.current = 0;
    this._timer = 0;
    this.loop = true;
  }
  Animation.prototype.update = function(dt) {
    this._timer += dt;
    if (this._timer >= 1 / this.fps) {
      this._timer = 0;
      this.current++;
      if (this.current >= this.frames.length) {
        this.current = this.loop ? 0 : this.frames.length - 1;
      }
    }
  };
  Animation.prototype.getFrame = function() {
    return this.frames[this.current];
  };
  global.SGame = global.SGame || {};
  global.SGame.Animation = Animation;
})(window);

// --- graphics\AnimatedSprite.js ---
// SGame Engine - AnimatedSprite
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function AnimatedSprite(image, options) {
    options = options || {};
    this.image = image;
    this.frameWidth = options.frameWidth || 32;
    this.frameHeight = options.frameHeight || 32;
    this.frames = options.frames || [];
    this.fps = options.fps || 10;
    this.loop = options.loop !== undefined ? options.loop : true;
    this.currentFrame = 0;
    this.timer = 0;
    this.playing = true;
    this.finished = false;
    this.onComplete = null;
    this.onFrame = null;
  }
  
  AnimatedSprite.prototype.play = function(frames, fps) {
    if (frames) this.frames = frames;
    if (fps) this.fps = fps;
    this.currentFrame = 0;
    this.timer = 0;
    this.playing = true;
    this.finished = false;
  };
  
  AnimatedSprite.prototype.stop = function() { this.playing = false; };
  AnimatedSprite.prototype.resume = function() { this.playing = true; };
  
  AnimatedSprite.prototype.update = function(dt) {
    if (!this.playing || this.frames.length === 0) return;
    this.timer += dt;
    var frameTime = 1 / this.fps;
    while (this.timer >= frameTime) {
      this.timer -= frameTime;
      this.currentFrame++;
      if (this.onFrame) this.onFrame(this.currentFrame);
      if (this.currentFrame >= this.frames.length) {
        if (this.loop) { this.currentFrame = 0; }
        else { this.currentFrame = this.frames.length - 1; this.playing = false; this.finished = true; if (this.onComplete) this.onComplete(); break; }
      }
    }
  };
  
  AnimatedSprite.prototype.draw = function(renderer, x, y, scaleX, scaleY) {
    if (!this.image || !this.image.complete || this.frames.length === 0) return;
    var frameIdx = this.frames[this.currentFrame] || 0;
    var cols = Math.floor(this.image.width / this.frameWidth);
    var sx = (frameIdx % cols) * this.frameWidth;
    var sy = Math.floor(frameIdx / cols) * this.frameHeight;
    var w = this.frameWidth * (scaleX || 1);
    var h = this.frameHeight * (scaleY || 1);
    renderer.ctx.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, x, y, w, h);
  };
  
  SGame.AnimatedSprite = AnimatedSprite;
})(window);

// --- graphics\Camera.js ---
// SGame Engine - Camera (Yumusak Takip)
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Camera(width, height) {
    this.x = 0; this.y = 0;
    this.width = width || 800;
    this.height = height || 600;
    this.zoom = 1;
    this.target = null;
    this.smooth = 0.1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.bounds = null;
  }
  
  Camera.prototype.follow = function(entity, smooth) {
    this.target = entity;
    if (smooth !== undefined) this.smooth = smooth;
  };
  
  Camera.prototype.setBounds = function(x, y, w, h) {
    this.bounds = { x: x, y: y, w: w, h: h };
  };
  
  Camera.prototype.update = function(dt) {
    if (!this.target) return;
    var targetX = this.target.x + this.target.width / 2 - this.width / 2 + this.offsetX;
    var targetY = this.target.y + this.target.height / 2 - this.height / 2 + this.offsetY;
    
    var lerp = 1 - Math.pow(1 - this.smooth, dt * 60);
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;
    
    if (this.bounds) {
      this.x = Math.max(this.bounds.x, Math.min(this.x, this.bounds.x + this.bounds.w - this.width));
      this.y = Math.max(this.bounds.y, Math.min(this.y, this.bounds.y + this.bounds.h - this.height));
    }
  };
  
  Camera.prototype.worldToScreen = function(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  };
  
  Camera.prototype.screenToWorld = function(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  };
  
  Camera.prototype.attach = function(renderer) {
    renderer.ctx.save();
    renderer.ctx.translate(-this.x, -this.y);
  };
  
  Camera.prototype.detach = function(renderer) {
    renderer.ctx.restore();
  };
  
  SGame.Camera = Camera;
})(window);

// --- graphics\Text.js ---
// SGame Engine - Advanced Text
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Text(text, options) {
    options = options || {};
    this.text = text || "";
    this.size = options.size || 16;
    this.color = options.color || "#fff";
    this.font = options.font || "sans-serif";
    this.align = options.align || "left";
    this.baseline = options.baseline || "top";
    this.bold = options.bold || false;
    this.italic = options.italic || false;
    this.shadow = options.shadow || null;
    this.outline = options.outline || null;
    this.opacity = options.opacity !== undefined ? options.opacity : 1;
    this.wrapWidth = options.wrapWidth || 0;
    this.lineHeight = options.lineHeight || 1.2;
  }
  
  Text.prototype.draw = function(renderer, x, y) {
    var ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    var fontStr = "";
    if (this.italic) fontStr += "italic ";
    if (this.bold) fontStr += "bold ";
    fontStr += this.size + "px " + this.font;
    ctx.font = fontStr;
    ctx.textAlign = this.align;
    ctx.textBaseline = this.baseline;
    
    var lines = this.wrapWidth > 0 ? this.wrap(ctx, this.text, this.wrapWidth) : [this.text];
    var lineHeightPx = this.size * this.lineHeight;
    
    for (var i = 0; i < lines.length; i++) {
      var ly = y + i * lineHeightPx;
      
      if (this.shadow) {
        ctx.fillStyle = this.shadow.color || "rgba(0,0,0,0.5)";
        ctx.fillText(lines[i], x + (this.shadow.x || 2), ly + (this.shadow.y || 2));
      }
      
      if (this.outline) {
        ctx.strokeStyle = this.outline.color || "#000";
        ctx.lineWidth = this.outline.width || 3;
        ctx.strokeText(lines[i], x, ly);
      }
      
      ctx.fillStyle = this.color;
      ctx.fillText(lines[i], x, ly);
    }
    
    ctx.restore();
  };
  
  Text.prototype.wrap = function(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var test = current + words[i] + " ";
      if (ctx.measureText(test).width > maxWidth && current !== "") {
        lines.push(current.trim());
        current = words[i] + " ";
      } else {
        current = test;
      }
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
  };
  
  Text.prototype.set = function(text) { this.text = text; return this; };
  
  SGame.Text = Text;
})(window);

// --- graphics\Tilemap.js ---
// SGame Engine - Tilemap
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Tilemap(options) {
    options = options || {};
    this.tileWidth = options.tileWidth || 32;
    this.tileHeight = options.tileHeight || 32;
    this.width = options.width || 20;
    this.height = options.height || 15;
    this.layers = [];
    this.tilesets = {};
  }
  
  Tilemap.prototype.addTileset = function(name, image, options) {
    this.tilesets[name] = {
      image: image,
      tileWidth: (options && options.tileWidth) || this.tileWidth,
      tileHeight: (options && options.tileHeight) || this.tileHeight,
      firstId: (options && options.firstId) || 1
    };
  };
  
  Tilemap.prototype.addLayer = function(name, data, options) {
    options = options || {};
    this.layers.push({
      name: name,
      data: data || [],
      visible: true,
      opacity: options.opacity !== undefined ? options.opacity : 1,
      offsetX: options.offsetX || 0,
      offsetY: options.offsetY || 0
    });
    return this.layers[this.layers.length - 1];
  };
  
  Tilemap.prototype.getTile = function(layerIndex, x, y) {
    var layer = this.layers[layerIndex];
    if (!layer) return 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return layer.data[y * this.width + x] || 0;
  };
  
  Tilemap.prototype.setTile = function(layerIndex, x, y, tileId) {
    var layer = this.layers[layerIndex];
    if (!layer) return;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    layer.data[y * this.width + x] = tileId;
  };
  
  Tilemap.prototype.getTileAt = function(worldX, worldY) {
    var tx = Math.floor(worldX / this.tileWidth);
    var ty = Math.floor(worldY / this.tileHeight);
    return { x: tx, y: ty, tile: this.getTile(0, tx, ty) };
  };
  
  Tilemap.prototype.render = function(renderer, camera) {
    var ctx = renderer.ctx;
    var camX = camera ? camera.x : 0;
    var camY = camera ? camera.y : 0;
    
    for (var li = 0; li < this.layers.length; li++) {
      var layer = this.layers[li];
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      
      for (var y = 0; y < this.height; y++) {
        for (var x = 0; x < this.width; x++) {
          var tileId = layer.data[y * this.width + x];
          if (!tileId) continue;
          
          var sx = x * this.tileWidth - camX + layer.offsetX;
          var sy = y * this.tileHeight - camY + layer.offsetY;
          
          // Ekran disindaysa atla
          if (sx + this.tileWidth < 0 || sy + this.tileHeight < 0 ||
              sx > renderer.width || sy > renderer.height) continue;
          
          // Tileset'ten tile ciz
          for (var ts in this.tilesets) {
            var tsd = this.tilesets[ts];
            if (tileId >= tsd.firstId && tsd.image && tsd.image.loaded) {
              var localId = tileId - tsd.firstId;
              var tilesPerRow = Math.floor(tsd.image.image.width / tsd.tileWidth);
              var srcX = (localId % tilesPerRow) * tsd.tileWidth;
              var srcY = Math.floor(localId / tilesPerRow) * tsd.tileHeight;
              ctx.drawImage(tsd.image.image, srcX, srcY, tsd.tileWidth, tsd.tileHeight,
                sx, sy, this.tileWidth, this.tileHeight);
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  };
  
  SGame.Tilemap = Tilemap;
})(window);

// --- graphics\Particle.js ---
// SGame Engine - Particle System
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Particle(opts) {
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.life = opts.life || 1;
    this.maxLife = this.life;
    this.size = opts.size || 4;
    this.color = opts.color || "#fff";
    this.gravity = opts.gravity || 0;
    this.fade = opts.fade !== undefined ? opts.fade : true;
    this.shrink = opts.shrink !== undefined ? opts.shrink : true;
  }
  
  Particle.prototype.update = function(dt) {
    this.life -= dt;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return this.life > 0;
  };
  
  Particle.prototype.render = function(renderer) {
    var alpha = this.fade ? (this.life / this.maxLife) : 1;
    var size = this.shrink ? (this.size * (this.life / this.maxLife)) : this.size;
    var ctx = renderer.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  
  function ParticleSystem(options) {
    options = options || {};
    this.particles = [];
    this.maxParticles = options.maxParticles || 500;
  }
  
  ParticleSystem.prototype.emit = function(x, y, count, options) {
    options = options || {};
    for (var i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      var angle = options.angle !== undefined ? options.angle + (Math.random() - 0.5) * (options.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
      var speed = (options.speed || 100) * (0.5 + Math.random() * 0.5);
      this.particles.push(new Particle({
        x: x + (Math.random() - 0.5) * (options.jitter || 0),
        y: y + (Math.random() - 0.5) * (options.jitter || 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: (options.life || 1) * (0.5 + Math.random() * 0.5),
        size: (options.size || 4) * (0.5 + Math.random()),
        color: Array.isArray(options.color) ? options.color[Math.floor(Math.random() * options.color.length)] : (options.color || "#fff"),
        gravity: options.gravity || 0,
        fade: options.fade,
        shrink: options.shrink
      }));
    }
  };
  
  ParticleSystem.prototype.update = function(dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }
  };
  
  ParticleSystem.prototype.render = function(renderer, camera) {
    var camX = camera ? camera.x : 0;
    var camY = camera ? camera.y : 0;
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var savedX = p.x, savedY = p.y;
      p.x -= camX; p.y -= camY;
      p.render(renderer);
      p.x = savedX; p.y = savedY;
    }
  };
  
  ParticleSystem.prototype.clear = function() { this.particles = []; };
  ParticleSystem.prototype.count = function() { return this.particles.length; };
  
  SGame.Particle = Particle;
  SGame.ParticleSystem = ParticleSystem;
})(window);

// --- graphics\Transition.js ---
// SGame Engine - Scene Transitions
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Transition(type, duration) {
    this.type = type || "fade";
    this.duration = duration || 0.5;
    this.time = 0;
    this.active = false;
    this.phase = "out"; // out, in
    this.onComplete = null;
    this.midCallback = null;
    this.color = "#000";
  }
  
  Transition.prototype.start = function(midCallback, onComplete) {
    this.time = 0;
    this.active = true;
    this.phase = "out";
    this.midCallback = midCallback;
    this.onComplete = onComplete;
  };
  
  Transition.prototype.update = function(dt) {
    if (!this.active) return;
    this.time += dt;
    var progress = Math.min(this.time / (this.duration / 2), 1);
    
    if (this.phase === "out" && progress >= 1) {
      if (this.midCallback) this.midCallback();
      this.phase = "in";
      this.time = 0;
    } else if (this.phase === "in" && progress >= 1) {
      this.active = false;
      if (this.onComplete) this.onComplete();
    }
  };
  
  Transition.prototype.render = function(renderer) {
    if (!this.active) return;
    var ctx = renderer.ctx;
    var progress = Math.min(this.time / (this.duration / 2), 1);
    var alpha = this.phase === "out" ? progress : 1 - progress;
    
    ctx.save();
    if (this.type === "fade") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, renderer.width, renderer.height);
    } else if (this.type === "slide-left") {
      var offset = this.phase === "out" ? progress * renderer.width : (1 - progress) * renderer.width;
      ctx.fillStyle = this.color;
      ctx.fillRect(renderer.width - offset, 0, offset, renderer.height);
    } else if (this.type === "slide-right") {
      var offset = this.phase === "out" ? progress * renderer.width : (1 - progress) * renderer.width;
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, offset, renderer.height);
    } else if (this.type === "zoom") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, renderer.width, renderer.height);
    }
    ctx.restore();
  };
  
  SGame.Transition = Transition;
})(window);

// --- graphics\UI.js ---
// SGame Engine - UI System
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Button(options) {
    options = options || {};
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.w = options.w || 150;
    this.h = options.h || 40;
    this.text = options.text || "Button";
    this.fontSize = options.fontSize || 16;
    this.bgColor = options.bgColor || "#0055cc";
    this.hoverColor = options.hoverColor || "#003380";
    this.textColor = options.textColor || "#fff";
    this.borderRadius = options.borderRadius || 6;
    this.onClick = options.onClick || null;
    this.visible = true;
    this.enabled = true;
    this.hovered = false;
    this.pressed = false;
  }
  
  Button.prototype.contains = function(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };
  
  Button.prototype.update = function(mouse) {
    this.hovered = this.contains(mouse.x, mouse.y);
    if (this.hovered && mouse.clicked && this.enabled) {
      if (this.onClick) this.onClick();
    }
  };
  
  Button.prototype.render = function(renderer) {
    if (!this.visible) return;
    var ctx = renderer.ctx;
    ctx.save();
    ctx.fillStyle = this.hovered && this.enabled ? this.hoverColor : this.bgColor;
    if (!this.enabled) ctx.globalAlpha = 0.5;
    
    ctx.beginPath();
    var r = this.borderRadius;
    ctx.moveTo(this.x + r, this.y);
    ctx.lineTo(this.x + this.w - r, this.y);
    ctx.quadraticCurveTo(this.x + this.w, this.y, this.x + this.w, this.y + r);
    ctx.lineTo(this.x + this.w, this.y + this.h - r);
    ctx.quadraticCurveTo(this.x + this.w, this.y + this.h, this.x + this.w - r, this.y + this.h);
    ctx.lineTo(this.x + r, this.y + this.h);
    ctx.quadraticCurveTo(this.x, this.y + this.h, this.x, this.y + this.h - r);
    ctx.lineTo(this.x, this.y + r);
    ctx.quadraticCurveTo(this.x, this.y, this.x + r, this.y);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = this.textColor;
    ctx.font = "bold " + this.fontSize + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2);
    ctx.restore();
  };
  
  function Slider(options) {
    options = options || {};
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.w = options.w || 200;
    this.h = options.h || 6;
    this.value = options.value !== undefined ? options.value : 0.5;
    this.min = options.min !== undefined ? options.min : 0;
    this.max = options.max !== undefined ? options.max : 1;
    this.color = options.color || "#0055cc";
    this.trackColor = options.trackColor || "#2a475e";
    this.onChange = options.onChange || null;
    this.visible = true;
    this.dragging = false;
  }
  
  Slider.prototype.update = function(mouse) {
    var knobX = this.x + (this.value - this.min) / (this.max - this.min) * this.w;
    var knobY = this.y + this.h / 2;
    if (mouse.down && Math.abs(mouse.x - knobX) < 15 && Math.abs(mouse.y - knobY) < 15) {
      this.dragging = true;
    }
    if (!mouse.down) this.dragging = false;
    if (this.dragging) {
      var newValue = (mouse.x - this.x) / this.w * (this.max - this.min) + this.min;
      this.value = Math.max(this.min, Math.min(this.max, newValue));
      if (this.onChange) this.onChange(this.value);
    }
  };
  
  Slider.prototype.render = function(renderer) {
    if (!this.visible) return;
    var ctx = renderer.ctx;
    ctx.save();
    // Track
    ctx.fillStyle = this.trackColor;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // Fill
    var fillW = (this.value - this.min) / (this.max - this.min) * this.w;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, fillW, this.h);
    // Knob
    var knobX = this.x + fillW;
    ctx.beginPath();
    ctx.arc(knobX, this.y + this.h / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  };
  
  function Checkbox(options) {
    options = options || {};
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.size = options.size || 24;
    this.label = options.label || "";
    this.checked = options.checked || false;
    this.color = options.color || "#0055cc";
    this.onChange = options.onChange || null;
    this.visible = true;
  }
  
  Checkbox.prototype.update = function(mouse) {
    if (mouse.clicked && mouse.x >= this.x && mouse.x <= this.x + this.size &&
        mouse.y >= this.y && mouse.y <= this.y + this.size) {
      this.checked = !this.checked;
      if (this.onChange) this.onChange(this.checked);
    }
  };
  
  Checkbox.prototype.render = function(renderer) {
    if (!this.visible) return;
    var ctx = renderer.ctx;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.size, this.size);
    if (this.checked) {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x + 4, this.y + 4, this.size - 8, this.size - 8);
    }
    if (this.label) {
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, this.x + this.size + 10, this.y + this.size / 2);
    }
    ctx.restore();
  };
  
  function UIManager() {
    this.elements = [];
  }
  
  UIManager.prototype.add = function(el) {
    this.elements.push(el);
    return el;
  };
  
  UIManager.prototype.update = function(mouse) {
    for (var i = 0; i < this.elements.length; i++) {
      if (this.elements[i].update) this.elements[i].update(mouse);
    }
  };
  
  UIManager.prototype.render = function(renderer) {
    for (var i = 0; i < this.elements.length; i++) {
      if (this.elements[i].render) this.elements[i].render(renderer);
    }
  };
  
  UIManager.prototype.clear = function() { this.elements = []; };
  
  SGame.Button = Button;
  SGame.Slider = Slider;
  SGame.Checkbox = Checkbox;
  SGame.UI = UIManager;
})(window);

// --- physics\Body.js ---
// SGame Engine - Body
(function(global) {
  "use strict";
  function Body(x, y, w, h, type) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.type = type || "dynamic";
    this.static = (type === "static");
    this.onGround = false;
  }
  Body.prototype.rect = function() {
    var SGame = global.SGame;
    return new SGame.Rect(this.x, this.y, this.w, this.h);
  };
  global.SGame = global.SGame || {};
  global.SGame.Body = Body;
})(window);

// --- physics\Collision.js ---
// SGame Engine - Collision (Polygon + SAT)
(function(global) {
  "use strict";
  var SGame = global.SGame;
  var C = {};
  
  // Dikdortgen-dikdortgen
  C.rectRect = function(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };
  
  // Nokta-dikdortgen
  C.pointRect = function(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };
  
  // Nokta-daire
  C.pointCircle = function(px, py, cx, cy, r) {
    var dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };
  
  // Daire-daire
  C.circleCircle = function(x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return dist < r1 + r2;
  };
  
  // Dikdortgen-daire
  C.rectCircle = function(r, cx, cy, cr) {
    var closestX = Math.max(r.x, Math.min(cx, r.x + r.w));
    var closestY = Math.max(r.y, Math.min(cy, r.y + r.h));
    var dx = cx - closestX, dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  };
  
  // Poligon-poligon (SAT)
  C.polygonPolygon = function(a, b) {
    var polygons = [a, b];
    for (var i = 0; i < polygons.length; i++) {
      var p = polygons[i];
      for (var j = 0; j < p.length; j++) {
        var p1 = p[j];
        var p2 = p[(j + 1) % p.length];
        var axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
        var len = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
        if (len === 0) continue;
        axis.x /= len; axis.y /= len;
        
        var minA = Infinity, maxA = -Infinity;
        for (var k = 0; k < a.length; k++) {
          var dot = a[k].x * axis.x + a[k].y * axis.y;
          if (dot < minA) minA = dot;
          if (dot > maxA) maxA = dot;
        }
        var minB = Infinity, maxB = -Infinity;
        for (var m = 0; m < b.length; m++) {
          var dot2 = b[m].x * axis.x + b[m].y * axis.y;
          if (dot2 < minB) minB = dot2;
          if (dot2 > maxB) maxB = dot2;
        }
        if (maxA < minB || maxB < minA) return false;
      }
    }
    return true;
  };
  
  // Cizgi-dikdortgen
  C.lineRect = function(x1, y1, x2, y2, r) {
    var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) return false;
    return true;
  };
  
  SGame.Collision = C;
})(window);

// --- physics\Physics.js ---
// SGame Engine - Advanced Physics
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function Body(x, y, w, h, type) {
    this.x = x || 0; this.y = y || 0;
    this.w = w || 0; this.h = h || 0;
    this.vx = 0; this.vy = 0;
    this.ax = 0; this.ay = 0;
    this.type = type || "dynamic";
    this.static = (type === "static");
    this.onGround = false;
    this.mass = 1;
    this.friction = 0.9;
    this.restitution = 0;
    this.gravityScale = 1;
    this.onCollide = null;
  }
  
  Body.prototype.rect = function() {
    return new SGame.Rect(this.x, this.y, this.w, this.h);
  };
  
  Body.prototype.applyForce = function(fx, fy) {
    this.ax += fx / this.mass;
    this.ay += fy / this.mass;
  };
  
  function Spring(bodyA, bodyB, restLength, stiffness, damping) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.restLength = restLength;
    this.stiffness = stiffness || 100;
    this.damping = damping || 5;
  }
  
  Spring.prototype.update = function(dt) {
    var dx = this.bodyB.x - this.bodyA.x;
    var dy = this.bodyB.y - this.bodyA.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    var nx = dx / dist, ny = dy / dist;
    var force = (dist - this.restLength) * this.stiffness;
    var rvx = this.bodyB.vx - this.bodyA.vx;
    var rvy = this.bodyB.vy - this.bodyA.vy;
    var damping = (rvx * nx + rvy * ny) * this.damping;
    var totalForce = force + damping;
    this.bodyA.applyForce(nx * totalForce, ny * totalForce);
    this.bodyB.applyForce(-nx * totalForce, -ny * totalForce);
  };
  
  function Physics() {
    this.gravity = { x: 0, y: 800 };
    this.bodies = [];
    this.springs = [];
    this.iterations = 4;
  }
  
  Physics.prototype.add = function(b) { this.bodies.push(b); return b; };
  Physics.prototype.addSpring = function(s) { this.springs.push(s); return s; };
  
  Physics.prototype.update = function(dt) {
    var i, b;
    
    // Kuvvetleri uygula
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      if (b.static) continue;
      b.ax = 0; b.ay = 0;
      b.ay += this.gravity.y * b.gravityScale;
    }
    
    // Yaylar
    for (i = 0; i < this.springs.length; i++) {
      this.springs[i].update(dt);
    }
    
    // Hizi guncelle
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      if (b.static) continue;
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      b.vx *= Math.pow(b.friction, dt * 60);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    
    // Carpisma
    for (var iter = 0; iter < this.iterations; iter++) {
      for (i = 0; i < this.bodies.length; i++) {
        b = this.bodies[i];
        if (b.static) continue;
        b.onGround = false;
        for (var j = 0; j < this.bodies.length; j++) {
          var c = this.bodies[j];
          if (i === j) continue;
          if (!c.static && j < i) continue;
          if (SGame.Collision.rectRect(b.rect(), c.rect())) {
            var overlapX = Math.min(b.x + b.w - c.x, c.x + c.w - b.x);
            var overlapY = Math.min(b.y + b.h - c.y, c.y + c.h - b.y);
            if (overlapY < overlapX) {
              if (b.y + b.h / 2 < c.y + c.h / 2) {
                b.y = c.y - b.h;
                if (b.vy > 0) {
                  b.vy = -b.vy * b.restitution;
                  if (b.vy < 0.1) b.vy = 0;
                }
                b.onGround = true;
              } else {
                b.y = c.y + c.h;
                if (b.vy < 0) b.vy = -b.vy * b.restitution;
              }
            } else {
              if (b.x + b.w / 2 < c.x + c.w / 2) {
                b.x = c.x - b.w;
                b.vx = 0;
              } else {
                b.x = c.x + c.w;
                b.vx = 0;
              }
            }
            if (b.onCollide) b.onCollide(c);
          }
        }
      }
    }
  };
  
  SGame.Body = Body;
  SGame.Spring = Spring;
  SGame.Physics = Physics;
})(window);

// --- physics\AdvancedPhysics.js ---
// SGame Engine - Advanced Physics Additions
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  // Body'ye ek metotlar
  var proto = SGame.Body.prototype;
  
  proto.applyImpulse = function(fx, fy) {
    this.vx += fx / this.mass;
    this.vy += fy / this.mass;
  };
  
  proto.setVelocity = function(vx, vy) {
    this.vx = vx; this.vy = vy;
  };
  
  proto.setPosition = function(x, y) {
    this.x = x; this.y = y;
  };
  
  proto.addForce = function(fx, fy) {
    this.ax += fx / this.mass;
    this.ay += fy / this.mass;
  };
  
  proto.setGravityScale = function(s) {
    this.gravityScale = s;
  };
  
  // Physics'e ek metotlar
  var physProto = SGame.Physics.prototype;
  
  physProto.setGravity = function(x, y) {
    this.gravity.x = x; this.gravity.y = y;
  };
  
  physProto.applyRadialForce = function(cx, cy, radius, strength) {
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      if (b.static) continue;
      var dx = b.x + b.w / 2 - cx;
      var dy = b.y + b.h / 2 - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 0) {
        var f = strength * (1 - dist / radius);
        b.ax += (dx / dist) * f;
        b.ay += (dy / dist) * f;
      }
    }
  };
  
  physProto.clear = function() { this.bodies = []; this.springs = []; };
  
})(window);

// --- input\Keyboard.js ---
// SGame Engine - Keyboard
(function(global) {
  "use strict";
  function Keyboard() {
    this.keys = {};
    this.justPressed = {};
    var self = this;
    window.addEventListener("keydown", function(e) {
      if (!self.keys[e.code]) self.justPressed[e.code] = true;
      self.keys[e.code] = true;
    });
    window.addEventListener("keyup", function(e) { self.keys[e.code] = false; });
  }
  Keyboard.prototype.isDown = function(code) { return !!this.keys[code]; };
  Keyboard.prototype.wasPressed = function(code) { return !!this.justPressed[code]; };
  Keyboard.prototype.clearFrame = function() { this.justPressed = {}; };
  global.SGame = global.SGame || {};
  global.SGame.Keyboard = Keyboard;
})(window);

// --- input\Mouse.js ---
// SGame Engine - Mouse
(function(global) {
  "use strict";
  function Mouse(canvas) {
    this.x = 0; this.y = 0;
    this.down = false;
    this.clicked = false;
    var self = this;
    canvas.addEventListener("mousemove", function(e) {
      var r = canvas.getBoundingClientRect();
      self.x = e.clientX - r.left;
      self.y = e.clientY - r.top;
    });
    canvas.addEventListener("mousedown", function() { self.down = true; self.clicked = true; });
    canvas.addEventListener("mouseup", function() { self.down = false; });
  }
  Mouse.prototype.clearFrame = function() { this.clicked = false; };
  global.SGame = global.SGame || {};
  global.SGame.Mouse = Mouse;
})(window);

// --- input\Touch.js ---
// SGame Engine - Touch
(function(global) {
  "use strict";
  function Touch(canvas) {
    this.touches = [];
    var self = this;
    canvas.addEventListener("touchstart", function(e) {
      e.preventDefault();
      self.touches = Array.prototype.slice.call(e.touches);
    }, { passive: false });
    canvas.addEventListener("touchmove", function(e) {
      e.preventDefault();
      self.touches = Array.prototype.slice.call(e.touches);
    }, { passive: false });
    canvas.addEventListener("touchend", function(e) {
      e.preventDefault();
      self.touches = Array.prototype.slice.call(e.touches);
    }, { passive: false });
  }
  global.SGame = global.SGame || {};
  global.SGame.Touch = Touch;
})(window);

// --- audio\Audio.js ---
// SGame Engine - Spatial Audio
(function(global) {
  "use strict";
  var SGame = global.SGame;
  var A = {};
  A.sounds = {};
  A.context = null;
  A.listener = { x: 0, y: 0 };
  
  A.init = function() {
    try {
      A.context = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { console.warn("Web Audio API yok"); }
  };
  
  A.load = function(name, src) {
    var audio = new Audio(src);
    A.sounds[name] = { audio: audio, src: src, buffer: null };
    if (A.context) {
      fetch(src).then(function(r) { return r.arrayBuffer(); })
        .then(function(buf) { return A.context.decodeAudioData(buf); })
        .then(function(decoded) { A.sounds[name].buffer = decoded; })
        .catch(function(){});
    }
    return audio;
  };
  
  A.play = function(name, options) {
    options = options || {};
    var s = A.sounds[name];
    if (!s) return;
    
    if (options.x !== undefined && A.context && s.buffer) {
      // Spatial audio
      var source = A.context.createBufferSource();
      source.buffer = s.buffer;
      var panner = A.context.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 100;
      panner.maxDistance = 10000;
      panner.positionX.value = options.x - A.listener.x;
      panner.positionY.value = options.y - A.listener.y;
      panner.positionZ.value = 0;
      
      var gain = A.context.createGain();
      gain.gain.value = options.volume !== undefined ? options.volume : 1;
      
      source.connect(panner);
      panner.connect(gain);
      gain.connect(A.context.destination);
      source.start(0);
    } else {
      var clone = s.audio.cloneNode();
      clone.volume = options.volume !== undefined ? options.volume : 1;
      if (options.rate) clone.playbackRate = options.rate;
      clone.play().catch(function(){});
    }
  };
  
  A.playMusic = function(name, options) {
    options = options || {};
    var s = A.sounds[name];
    if (!s) return;
    s.audio.loop = true;
    s.audio.volume = options.volume !== undefined ? options.volume : 0.5;
    s.audio.play().catch(function(){});
  };
  
  A.stop = function(name) {
    if (A.sounds[name]) {
      A.sounds[name].audio.pause();
      A.sounds[name].audio.currentTime = 0;
    }
  };
  
  A.stopAll = function() {
    for (var k in A.sounds) A.stop(k);
  };
  
  A.setListener = function(x, y) {
    A.listener.x = x; A.listener.y = y;
    if (A.context && A.context.listener) {
      A.context.listener.positionX.value = x;
      A.context.listener.positionY.value = y;
      A.context.listener.positionZ.value = 0;
    }
  };
  
  SGame.Audio = A;
})(window);

// --- audio\SFX.js ---
// SGame Engine - SFX Manager
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  function SFX() {
    this.sounds = {};
    this.active = {};
    this.volume = 1;
    this.muted = false;
  }
  
  SFX.prototype.load = function(name, src, options) {
    options = options || {};
    var audio = new Audio(src);
    audio.preload = "auto";
    this.sounds[name] = { audio: audio, options: options };
    return this;
  };
  
  SFX.prototype.play = function(name, opts) {
    opts = opts || {};
    if (this.muted) return null;
    var s = this.sounds[name];
    if (!s) return null;
    var clone = s.audio.cloneNode();
    clone.volume = (opts.volume !== undefined ? opts.volume : 1) * this.volume;
    if (opts.rate) clone.playbackRate = opts.rate;
    if (opts.loop) clone.loop = true;
    if (opts.onEnd) clone.onended = opts.onEnd;
    clone.play().catch(function(){});
    return clone;
  };
  
  SFX.prototype.stopAll = function() {
    for (var k in this.active) {
      try { this.active[k].pause(); } catch(e) {}
    }
    this.active = {};
  };
  
  SFX.prototype.setVolume = function(v) { this.volume = Math.max(0, Math.min(1, v)); };
  SFX.prototype.mute = function() { this.muted = true; };
  SFX.prototype.unmute = function() { this.muted = false; };
  
  SGame.SFX = SFX;
})(window);

// --- assets\Loader.js ---
// SGame Engine - Loader
(function(global) {
  "use strict";
  function Loader() {
    this.queue = [];
    this.loaded = 0;
    this.total = 0;
    this.onProgress = null;
    this.onComplete = null;
  }
  Loader.prototype.image = function(name, src) {
    var self = this;
    this.queue.push(function(cb) {
      var img = new Image();
      img.src = src;
      img.onload = function() { cb(null, name, img); };
      img.onerror = function() { cb("Gorsel yuklenemedi: " + src); };
    });
    return this;
  };
  Loader.prototype.load = function() {
    var self = this;
    this.total = this.queue.length;
    this.loaded = 0;
    var results = {};
    var error = null;
    function next(i) {
      if (i >= self.queue.length) {
        if (self.onComplete) self.onComplete(error, results);
        return;
      }
      self.queue[i](function(err, name, data) {
        if (err) { error = err; }
        results[name] = data;
        self.loaded++;
        if (self.onProgress) self.onProgress(self.loaded, self.total);
        next(i + 1);
      });
    }
    next(0);
  };
  global.SGame = global.SGame || {};
  global.SGame.Loader = Loader;
})(window);

// --- assets\Save.js ---
// SGame Engine - Save/Load
(function(global) {
  "use strict";
  var SGame = global.SGame;
  var S = {};
  
  S.save = function(key, data) {
    try {
      localStorage.setItem("sgame_" + key, JSON.stringify(data));
      return true;
    } catch(e) { console.warn("Kaydetme hatasi:", e); return false; }
  };
  
  S.load = function(key, defaultValue) {
    try {
      var raw = localStorage.getItem("sgame_" + key);
      if (raw === null) return defaultValue !== undefined ? defaultValue : null;
      return JSON.parse(raw);
    } catch(e) { return defaultValue !== undefined ? defaultValue : null; }
  };
  
  S.remove = function(key) {
    try { localStorage.removeItem("sgame_" + key); return true; }
    catch(e) { return false; }
  };
  
  S.clear = function() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith("sgame_")) localStorage.removeItem(keys[i]);
      }
      return true;
    } catch(e) { return false; }
  };
  
  S.exists = function(key) {
    return localStorage.getItem("sgame_" + key) !== null;
  };
  
  // Skor tablosu
  S.addScore = function(boardName, score, meta) {
    var board = S.load("scoreboard_" + boardName, []);
    board.push({ score: score, meta: meta || {}, date: Date.now() });
    board.sort(function(a, b) { return b.score - a.score; });
    board = board.slice(0, 100);
    S.save("scoreboard_" + boardName, board);
    return board;
  };
  
  S.getScores = function(boardName, limit) {
    var board = S.load("scoreboard_" + boardName, []);
    return limit ? board.slice(0, limit) : board;
  };
  
  // Ayarlar
  S.saveSettings = function(settings) { return S.save("settings", settings); };
  S.loadSettings = function() { return S.load("settings", { sound: true, music: true, quality: "high" }); };
  
  SGame.Save = S;
})(window);

// --- assets\JSONSave.js ---
// SGame Engine - JSON Save/Load
(function(global) {
  "use strict";
  var SGame = global.SGame;
  
  var J = {};
  
  J.export = function(data) {
    try {
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "sgame-save-" + Date.now() + ".json";
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch(e) { console.warn("Export hatasi:", e); return false; }
  };
  
  J.import = function(callback) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (callback) callback(data);
        } catch(err) { alert("Gecersiz JSON: " + err.message); }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  
  // Sahne/oyun durumunu kaydet
  J.saveGameState = function(game, key) {
    var state = {
      timestamp: Date.now(),
      version: SGame.version,
      scenes: {}
    };
    for (var name in game.scenes) {
      var scene = game.scenes[name];
      if (scene.saveState) {
        state.scenes[name] = scene.saveState();
      }
    }
    return SGame.Save.save(key, state);
  };
  
  J.loadGameState = function(game, key) {
    var state = SGame.Save.load(key);
    if (!state) return false;
    for (var name in state.scenes) {
      if (game.scenes[name] && game.scenes[name].loadState) {
        game.scenes[name].loadState(state.scenes[name]);
      }
    }
    return true;
  };
  
  SGame.JSONSave = J;
})(window);

// --- core\Game.js ---
// SGame Engine - Game
(function(global) {
  "use strict";
  var SGame = global.SGame || {};
  
  function Game(options) {
    options = options || {};
    this.canvas = options.canvas || document.createElement("canvas");
    if (typeof this.canvas === "string") this.canvas = document.getElementById(this.canvas);
    this.canvas.width = options.width || 800;
    this.canvas.height = options.height || 600;
    
    this.renderer = new SGame.Renderer(this.canvas);
    this.time = new SGame.Time();
    this.scenes = {};
    this.currentScene = null;
    this.running = false;
    this.paused = false;
    this.keyboard = new SGame.Keyboard();
    this.mouse = new SGame.Mouse(this.canvas);
    this.touch = new SGame.Touch(this.canvas);
    this.physics = new SGame.Physics();
    this.camera = new SGame.Camera(this.canvas.width, this.canvas.height);
    
    var self = this;
    this._tick = function(now) {
      if (!self.running) return;
      if (!self.paused) {
        self.time.update(now);
        if (self.currentScene) self.currentScene.update(self.time.delta);
        self.renderer.clear();
        if (self.currentScene) self.currentScene.render(self.renderer);
        self.keyboard.clearFrame();
        self.mouse.clearFrame();
      }
      requestAnimationFrame(self._tick);
    };
  }
  
  Game.prototype.addScene = function(scene) {
    this.scenes[scene.name] = scene;
    scene.game = this;
    return scene;
  };
  
  Game.prototype.changeScene = function(name) {
    var s = this.scenes[name];
    if (!s) { console.warn("Sahne bulunamadi: " + name); return; }
    if (this.currentScene) {
      if (typeof this.currentScene.onStop === "function") this.currentScene.onStop();
    }
    this.currentScene = s;
    s.start();
  };
  
  Game.prototype.start = function(sceneName) {
    this.running = true;
    if (sceneName) this.changeScene(sceneName);
    requestAnimationFrame(this._tick);
  };
  
  Game.prototype.stop = function() { this.running = false; };
  Game.prototype.pause = function() { this.paused = true; };
  Game.prototype.resume = function() { this.paused = false; };
  
  SGame.Game = Game;
  global.SGame = SGame;
})(window);

// --- SGame.js ---
// SGame Engine - Main
(function(global) {
  "use strict";
  var SGame = global.SGame || {};
  SGame.version = "1.0.0";
  SGame.name = "SGame Engine";
  SGame.author = "SGame Studios";
  
  // Kolay oyun olusturma
  SGame.create = function(options) {
    return new SGame.Game(options);
  };
  
  global.SGame = SGame;
  console.log("%cSGame Engine v" + SGame.version, "color:#0055cc;font-size:16px;font-weight:bold;");
  console.log("%cSGame Studios - 2D Game Engine", "color:#66c0f4;font-size:12px;");
})(window);

