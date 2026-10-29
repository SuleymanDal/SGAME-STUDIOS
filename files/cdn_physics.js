/**
 * ============================================================
 *  SG-PHY
 *  Surum    : 1.5.10
 *  Tur      : Tek dosyalik fizik kutuphanesi (saf JS)
 *  Global   : phy
 *  Birimler : SI (m, kg, s, N, J, rad)
 *  Icerik   : 1.4.2 tum moduller +
 *             character, trigger, layers, rope, spring2d,
 *             tilemap, destructible, render
 * ============================================================
 */
(function (global) {
  "use strict";

  var VERSION  = "2.3.2";
  var CODENAME = "Stable";
  var G_EARTH = 9.81, G_MOON = 1.62, G_MARS = 3.71, GC = 6.674e-11;
  var PI2 = Math.PI * 2;

  function def(proto, name, fn) {
    Object.defineProperty(proto, name, { get: fn, configurable: true });
  }

  /* ================= Vektor ================= */
  var v = {
    add: function(a,b){
      if (a.z === undefined && b.z === undefined)
        return {x:a.x+b.x, y:a.y+b.y, z:0};
      return {x:a.x+b.x, y:a.y+b.y, z:(a.z||0)+(b.z||0)};
    },
    sub: function(a,b){
      if (a.z === undefined && b.z === undefined)
        return {x:a.x-b.x, y:a.y-b.y, z:0};
      return {x:a.x-b.x, y:a.y-b.y, z:(a.z||0)-(b.z||0)};
    },
    mul: function(a,s){
      if (a.z === undefined) return {x:a.x*s, y:a.y*s, z:0};
      return {x:a.x*s, y:a.y*s, z:a.z*s};
    },
    dot: function(a,b){
      if (a.z === undefined && b.z === undefined)
        return a.x*b.x + a.y*b.y;
      return a.x*b.x + a.y*b.y + (a.z||0)*(b.z||0);
    },
    cross: function(a,b){
      return { x:a.y*(b.z||0)-(a.z||0)*b.y, y:(a.z||0)*b.x-a.x*(b.z||0), z:a.x*b.y-a.y*b.x };
    },
    len: function(a){
      if (a.z === undefined) return Math.sqrt(a.x*a.x + a.y*a.y);
      return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
    },
    norm: function(a){
      var z = a.z === undefined ? 0 : a.z;
      var l2 = a.x*a.x + a.y*a.y + z*z;
      if (l2 === 0) return {x:0, y:0, z:0};
      var inv = 1 / Math.sqrt(l2);
      return {x:a.x*inv, y:a.y*inv, z:z*inv};
    },
    dist: function(a,b){
      var dx = a.x-b.x, dy = a.y-b.y, dz = (a.z||0)-(b.z||0);
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    },
    lerp: function(a,b,t){
      var z1 = a.z||0, z2 = b.z||0;
      return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, z:z1+(z2-z1)*t };
    },
    perp: function(a){ return {x:-a.y, y:a.x, z:0}; },
    rot: function(a, angle){
      var c = Math.cos(angle), s = Math.sin(angle);
      return {x:a.x*c - a.y*s, y:a.x*s + a.y*c, z:(a.z||0)};
    },
    neg: function(a){ return {x:-a.x, y:-a.y, z:-(a.z||0)}; }
  };

  /* ================= Kinematik ================= */
  var motion = {
    v:  function (x0,v0,a,t){ return v0 + a*t; },
    x:  function (x0,v0,a,t){ return x0 + v0*t + 0.5*a*t*t; },
    v2: function (v0,a,dx){ return Math.sqrt(Math.max(0, v0*v0 + 2*a*dx)); },
    t:  function (v0,vv,a){ return (vv-v0)/a; }
  };

  /* ================= Fall ================= */
  function Fall(t) { this.t2 = 0.5 * t * t; }
  def(Fall.prototype, "earth", function(){ return G_EARTH * this.t2; });
  def(Fall.prototype, "moon",  function(){ return G_MOON  * this.t2; });
  def(Fall.prototype, "mars",  function(){ return G_MARS  * this.t2; });
  function fall(t){ return new Fall(t); }

  /* ================= Push ================= */
  function Push(m,a) { this.F = m * a; }
  Push.prototype.valueOf  = function(){ return this.F; };
  Push.prototype.toString = function(){ return "" + this.F; };
  Push.prototype.fric   = function(mu, N){ return mu * N; };
  Push.prototype.spring = function(k, x){ return -k * x; };
  function push(m,a){ return new Push(m,a); }

  /* ================= Energy ================= */
  function Energy(m,vv) { this.m = m; this.v = vv; }
  def(Energy.prototype, "ke", function(){ return 0.5 * this.m * this.v * this.v; });
  def(Energy.prototype, "p",  function(){ return this.m * this.v; });
  def(Energy.prototype, "pe", function(){
    var m = this.m;
    return function(h){ return m * G_EARTH * h; };
  });
  function energy(m,vv){ return new Energy(m,vv); }

  /* ================= Crash ================= */
  function Crash(m1,v1,m2,v2) {
    this.m1=m1; this.v1=v1; this.m2=m2; this.v2=v2; this.M=m1+m2;
  }
  def(Crash.prototype, "elastic", function(){
    var m1=this.m1, m2=this.m2, v1=this.v1, v2=this.v2, M=this.M;
    return {
      v1: ((m1-m2)*v1 + 2*m2*v2) / M,
      v2: ((m2-m1)*v2 + 2*m1*v1) / M
    };
  });
  def(Crash.prototype, "inelastic", function(){
    return { v: (this.m1*this.v1 + this.m2*this.v2) / this.M };
  });
  function crash(m1,v1,m2,v2){ return new Crash(m1,v1,m2,v2); }

  /* ================= Spin ================= */
  function Spin(a,b) { this.a=a; this.b=b; }
  def(Spin.prototype, "cw",   function(){ return  this.a * this.b; });
  def(Spin.prototype, "ccw",  function(){ return -this.a * this.b; });
  def(Spin.prototype, "ring", function(){ var b=this.b; return this.a * b * b; });
  def(Spin.prototype, "disk", function(){ var b=this.b; return 0.5 * this.a * b * b; });
  def(Spin.prototype, "rod",  function(){ var b=this.b; return (1/12) * this.a * b * b; });
  function spin(a,b){ return new Spin(a,b); }

  /* ================= Grav ================= */
  function Grav2(M, r) { this.M=M; this.r=r; }
  def(Grav2.prototype, "orb", function(){ return Math.sqrt((GC * this.M) / this.r); });
  def(Grav2.prototype, "esc", function(){ return Math.sqrt((2 * GC * this.M) / this.r); });
  function grav(a,b,c){
    if (c !== undefined) return (GC * a * b) / (c * c);
    return new Grav2(a, b);
  }

  /* ================= Projectile ================= */
  function Projectile(v0, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    this.vx = v0 * Math.cos(rad);
    this.vy = v0 * Math.sin(rad);
    this.g  = G_EARTH;
    this.range = (this.vx * this.vy * 2) / this.g;
    this.maxH  = (this.vy * this.vy) / (2 * this.g);
    this.time  = (2 * this.vy) / this.g;
  }
  Projectile.prototype.at = function(t){
    return { x: this.vx * t, y: this.vy * t - 0.5 * this.g * t * t };
  };
  function projectile(v0, angleDeg){ return new Projectile(v0, angleDeg); }

  /* ================= Damped ================= */
  function Damped(k, c, m) {
    this.w0 = Math.sqrt(k / m);
    this.zeta = c / (2 * Math.sqrt(k * m));
    this.wd = this.w0 * Math.sqrt(Math.max(0, 1 - this.zeta * this.zeta));
    this.period = this.wd > 0 ? (2 * Math.PI) / this.wd : Infinity;
  }
  Damped.prototype.ampAt = function(t){
    return Math.exp(-this.zeta * this.w0 * t);
  };
  function damped(k, c, m){ return new Damped(k, c, m); }

  /* ================= Field ================= */
  function Field(M, x, y) {
    var r2 = x*x + y*y;
    var mag = (GC * M) / r2;
    this.mag = mag;
    if (r2 === 0){ this.gx = 0; this.gy = 0; return; }
    var inv = mag / Math.sqrt(r2);
    this.gx = -inv * x;
    this.gy = -inv * y;
  }
  function field(M, x, y){ return new Field(M, x, y); }

  /* ================= Swing ================= */
  function SwingKM(k, m) {
    this.T = PI2 * Math.sqrt(m/k);
    this.f = (1/PI2) * Math.sqrt(k/m);
  }
  function PendT(L) {
    this.T = PI2 * Math.sqrt(L / G_EARTH);
    this.f = (1/PI2) * Math.sqrt(G_EARTH / L);
  }
  function SwingPend(L) { this.pend = new PendT(L); }
  function swing(a,b){
    if (b === undefined) return new SwingPend(a);
    return new SwingKM(a,b);
  }

  /* ================= Step ================= */
  var step = {
    euler: function (x,vv,a,dt){ return { x:x+vv*dt, v:vv+a*dt }; },
    verlet:function (x,vv,a,dt){ return { x:x+vv*dt+0.5*a*dt*dt, v:vv+a*dt }; },
    eulerVec: function(x, vv, a, dt){
      return { x:{x:x.x+vv.x*dt,y:x.y+vv.y*dt}, v:{x:vv.x+a.x*dt,y:vv.y+a.y*dt} };
    },
    verletVec: function(x, vv, a, dt){
      return {
        x:{ x:x.x+vv.x*dt+0.5*a.x*dt*dt, y:x.y+vv.y*dt+0.5*a.y*dt*dt },
        v:{ x:vv.x+a.x*dt, y:vv.y+a.y*dt }
      };
    },
    rk4: function (f,x,dt){
      if (typeof x === "number"){
        var k1=f(x), k2=f(x+0.5*dt*k1), k3=f(x+0.5*dt*k2), k4=f(x+dt*k3);
        return x + (dt/6)*(k1+2*k2+2*k3+k4);
      }
      var add = function(p,q,s){ return { x:p.x+q.x*s, y:p.y+q.y*s, z:(p.z||0)+(q.z||0)*s }; };
      var a1=f(x), a2=f(add(x,a1,0.5*dt)), a3=f(add(x,a2,0.5*dt)), a4=f(add(x,a3,dt));
      return { x:x.x+(dt/6)*(a1.x+2*a2.x+2*a3.x+a4.x),
               y:x.y+(dt/6)*(a1.y+2*a2.y+2*a3.y+a4.y),
               z:(x.z||0)+(dt/6)*((a1.z||0)+2*(a2.z||0)+2*(a3.z||0)+(a4.z||0)) };
    },
    rk4Vec: function(f, x, dt){
      var add = function(p,q,s){ return { x:p.x+q.x*s, y:p.y+q.y*s }; };
      var a1=f(x), a2=f(add(x,a1,0.5*dt)), a3=f(add(x,a2,0.5*dt)), a4=f(add(x,a3,dt));
      return { x:x.x+(dt/6)*(a1.x+2*a2.x+2*a3.x+a4.x),
               y:x.y+(dt/6)*(a1.y+2*a2.y+2*a3.y+a4.y) };
    }
  };

  /* ================= Hit ================= */
  function aabbOv(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function aabbDet(a,b){
    if (!aabbOv(a,b)) return { hit:false, normal:null, depth:0 };
    var dx1=b.x+b.w-a.x, dx2=a.x+a.w-b.x, dy1=b.y+b.h-a.y, dy2=a.y+a.h-b.y;
    var d=Math.min(dx1,dx2,dy1,dy2), n;
    if (d===dx1) n={x:-1,y:0};
    else if (d===dx2) n={x:1,y:0};
    else if (d===dy1) n={x:0,y:-1};
    else n={x:0,y:1};
    return { hit:true, normal:n, depth:d };
  }
  function circOv(a,b){ var dx=a.x-b.x, dy=a.y-b.y, r=a.r+b.r; return dx*dx+dy*dy <= r*r; }
  function circDet(a,b){
    var dx=a.x-b.x, dy=a.y-b.y, r=a.r+b.r, d2=dx*dx+dy*dy;
    if (d2 > r*r) return { hit:false, normal:null, depth:0 };
    var d=Math.sqrt(d2)||1e-9;
    return { hit:true, normal:{x:dx/d,y:dy/d}, depth:r-d };
  }
  function Hit(a,b,isC,base){ this.a=a; this.b=b; this.isC=isC; this.base=base; }
  Hit.prototype.valueOf  = function(){ return this.base; };
  Hit.prototype.toString = function(){ return "" + this.base; };
  def(Hit.prototype, "det", function(){
    return this.isC ? circDet(this.a, this.b) : aabbDet(this.a, this.b);
  });
  function hit(a,b){
    var isC = a.r !== undefined && b.r !== undefined;
    return new Hit(a, b, isC, isC ? circOv(a,b) : aabbOv(a,b));
  }

  /* ================= Body ================= */
  function Body(opts) {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.ax = 0; this.ay = 0;
    this.fx = 0; this.fy = 0;
    this.angle = 0;
    this.angularVelocity = 0;
    this.torque = 0;
    this.mass = 1;
    this.inertia = 1;
    this.isStatic = false;
    this.restitution = 0.8;
    this.r = 0; this.w = 0; this.h = 0;
    this.shape = null;
    this.layer = 1;
    this.mask = -1;
    this.isSensor = false;
    if (opts !== undefined){
      if (opts.x !== undefined) this.x = opts.x;
      if (opts.y !== undefined) this.y = opts.y;
      if (opts.vx !== undefined) this.vx = opts.vx;
      if (opts.vy !== undefined) this.vy = opts.vy;
      if (opts.angle !== undefined) this.angle = opts.angle;
      if (opts.angularVelocity !== undefined) this.angularVelocity = opts.angularVelocity;
      if (opts.mass !== undefined) this.mass = opts.mass;
      if (opts.inertia !== undefined) this.inertia = opts.inertia;
      if (opts.static !== undefined) this.isStatic = !!opts.static;
      if (opts.restitution !== undefined) this.restitution = opts.restitution;
      if (opts.r !== undefined) this.r = opts.r;
      if (opts.w !== undefined) this.w = opts.w;
      if (opts.h !== undefined) this.h = opts.h;
      if (opts.shape !== undefined) this.shape = opts.shape;
      if (opts.layer !== undefined) this.layer = opts.layer;
      if (opts.mask !== undefined) this.mask = opts.mask;
      if (opts.isSensor !== undefined) this.isSensor = !!opts.isSensor;
    }
  }
  Body.prototype.applyForce = function(fx, fy){
    if (!this.isStatic){ this.fx += fx; this.fy += fy; }
    return this;
  };
  Body.prototype.applyTorque = function(t){
    if (!this.isStatic){ this.torque += t; }
    return this;
  };
  Body.prototype.applyImpulse = function(ix, iy){
    if (this.isStatic) return this;
    var invM = 1 / this.mass;
    this.vx += ix * invM;
    this.vy += iy * invM;
    return this;
  };
  Body.prototype.applyImpulseAt = function(ix, iy, px, py){
    if (this.isStatic) return this;
    var invM = 1 / this.mass;
    var invI = 1 / this.inertia;
    this.vx += ix * invM;
    this.vy += iy * invM;
    var rx = px - this.x, ry = py - this.y;
    this.angularVelocity += (rx * iy - ry * ix) * invI;
    return this;
  };
  Body.prototype.clearForces = function(){
    this.fx = 0; this.fy = 0; this.torque = 0;
    return this;
  };
  Body.prototype.integrate = function(dt){
    if (this.isStatic) return this;
    var invM = 1 / this.mass;
    var invI = 1 / this.inertia;
    this.vx += this.fx * invM * dt;
    this.vy += this.fy * invM * dt;
    this.angularVelocity += this.torque * invI * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.angle += this.angularVelocity * dt;
    this.fx = 0; this.fy = 0; this.torque = 0;
    return this;
  };
  function body(opts){ return new Body(opts); }

  /* ================= World ================= */
  function World(opts) {
    this.gx = 0;
    this.gy = -G_EARTH;
    this.bodies = [];
    this.substeps = 2;
    if (opts !== undefined){
      if (opts.gravity){
        if (opts.gravity.x !== undefined) this.gx = opts.gravity.x;
        if (opts.gravity.y !== undefined) this.gy = opts.gravity.y;
      }
      if (opts.substeps !== undefined) this.substeps = opts.substeps;
    }
  }
  World.prototype.add = function(b){ this.bodies.push(b); return this; };
  World.prototype.remove = function(b){
    var arr = this.bodies;
    for (var i=0, l=arr.length; i<l; i++){
      if (arr[i] === b){ arr.splice(i, 1); return this; }
    }
    return this;
  };
  World.prototype.step = function(dt){
    var n = this.substeps > 0 ? this.substeps : 1;
    var h = dt / n;
    var gx = this.gx, gy = this.gy;
    var bodies = this.bodies;
    var len = bodies.length;
    for (var s=0; s<n; s++){
      for (var i=0; i<len; i++){
        var b = bodies[i];
        if (b.isStatic) continue;
        b.fx += gx * b.mass;
        b.fy += gy * b.mass;
        b.integrate(h);
      }
    }
    return this;
  };
  function world(opts){ return new World(opts); }

  /* ================= Collide ================= */
  var collide = {
    aabb: function(a,b){ return aabbOv(a,b); },
    circle: function(a,b){ return circOv(a,b); },
    detect: function(a,b){
      if (a.r !== undefined && b.r !== undefined) return circDet(a,b);
      return aabbDet(a,b);
    },
    resolve: function(a, b, opts){
      var aIsC = a.r !== undefined;
      var bIsC = b.r !== undefined;
      var nx, ny, depth;
      if (aIsC && bIsC){
        var dx = a.x - b.x, dy = a.y - b.y;
        var rr = a.r + b.r;
        var d2 = dx*dx + dy*dy;
        if (d2 > rr*rr) return false;
        var d = Math.sqrt(d2) || 1e-9;
        nx = dx/d; ny = dy/d; depth = rr - d;
      } else {
        if (!aabbOv(a,b)) return false;
        var dx1=b.x+b.w-a.x, dx2=a.x+a.w-b.x, dy1=b.y+b.h-a.y, dy2=a.y+a.h-b.y;
        depth = Math.min(dx1,dx2,dy1,dy2);
        if (depth === dx1){ nx=-1; ny=0; }
        else if (depth === dx2){ nx=1; ny=0; }
        else if (depth === dy1){ nx=0; ny=-1; }
        else { nx=0; ny=1; }
      }
      var aStatic = a.isStatic, bStatic = b.isStatic;
      if (aStatic && bStatic) return false;
      var invA = aStatic ? 0 : 1/a.mass;
      var invB = bStatic ? 0 : 1/b.mass;
      var totalInv = invA + invB;
      if (totalInv === 0) return false;
      var corr = depth / totalInv;
      if (!aStatic){ a.x -= nx * corr * invA; a.y -= ny * corr * invA; }
      if (!bStatic){ b.x += nx * corr * invB; b.y += ny * corr * invB; }
      var rvx = b.vx - a.vx;
      var rvy = b.vy - a.vy;
      var vn = rvx * nx + rvy * ny;
      if (vn > 0) return true;
      var e = opts !== undefined && opts.restitution !== undefined
              ? opts.restitution
              : (a.restitution < b.restitution ? a.restitution : b.restitution);
      var j = -(1 + e) * vn / totalInv;
      var ix = j * nx, iy = j * ny;
      if (!aStatic){ a.vx -= ix * invA; a.vy -= iy * invA; }
      if (!bStatic){ b.vx += ix * invB; b.vy += iy * invB; }
      return true;
    }
  };

  /* ================= Constraint ================= */
  function SpringBody(a, b, opts){
    this.a = a; this.b = b;
    if (opts === undefined){ this.k = 100; this.damping = 0; this.restLength = 1; }
    else {
      this.k = opts.k !== undefined ? opts.k : 100;
      this.damping = opts.damping !== undefined ? opts.damping : 0;
      this.restLength = opts.restLength !== undefined ? opts.restLength : 1;
    }
  }
  SpringBody.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) return this;
    var invDist = 1 / dist;
    var nx = dx * invDist, ny = dy * invDist;
    var F = this.k * (dist - this.restLength);
    var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    F += this.damping * vn;
    var fx = F * nx, fy = F * ny;
    if (!a.isStatic){ a.fx += fx; a.fy += fy; }
    if (!b.isStatic){ b.fx -= fx; b.fy -= fy; }
    return this;
  };
  function DistanceBody(a, b, opts){
    this.a = a; this.b = b;
    if (opts === undefined){ this.length = 1; this.stiffness = 1; }
    else {
      this.length = opts.length !== undefined ? opts.length : 1;
      this.stiffness = opts.stiffness !== undefined ? opts.stiffness : 1;
    }
  }
  DistanceBody.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) return this;
    var diff = (dist - this.length) / dist * 0.5 * this.stiffness;
    var offx = dx * diff, offy = dy * diff;
    if (!a.isStatic){ a.x += offx; a.y += offy; }
    if (!b.isStatic){ b.x -= offx; b.y -= offy; }
    return this;
  };
  function PinBody(a, px, py){ this.a = a; this.px = px; this.py = py; }
  PinBody.prototype.apply = function(){
    if (this.a.isStatic) return this;
    this.a.x = this.px; this.a.y = this.py;
    this.a.vx = 0; this.a.vy = 0;
    return this;
  };
  var constraint = {
    spring:   function(a,b,opts){ return new SpringBody(a,b,opts); },
    distance: function(a,b,opts){ return new DistanceBody(a,b,opts); },
    pin:      function(a,px,py){ return new PinBody(a,px,py); }
  };

  /* ================= Trajectory ================= */
  function Trajectory(v0, angleDeg, g){
    var rad = angleDeg * Math.PI / 180;
    this.vx = v0 * Math.cos(rad);
    this.vy = v0 * Math.sin(rad);
    this.g  = g == null ? G_EARTH : g;
  }
  Trajectory.prototype.samples = function(n){
    var total = (2 * this.vy) / this.g;
    var out = new Array(n);
    var vx = this.vx, vy = this.vy;
    var halfG = 0.5 * this.g;
    var dt = total / (n - 1);
    for (var i=0; i<n; i++){
      var t = i * dt;
      out[i] = { t: t, x: vx * t, y: vy * t - halfG * t * t };
    }
    return out;
  };
  function trajectory(v0, angleDeg, g){ return new Trajectory(v0, angleDeg, g); }

  /* ================= Shape ================= */
  var shape = {
    _regCache: {},
    circle: function(r){ return { type:"circle", r:r }; },
    box: function(w,h){ return { type:"box", w:w, h:h }; },
    aabb: function(b){
      if (b.type === "circle"){
        return { minX: -b.r, minY: -b.r, maxX: b.r, maxY: b.r };
      }
      if (b.type === "box"){
        return { minX:-b.w/2, minY:-b.h/2, maxX:b.w/2, maxY:b.h/2 };
      }
      if (b.type === "capsule" || b.type === "polygon"){
        var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        var pts = b.type === "capsule" ? b.points() : b.verts;
        for (var i=0;i<pts.length;i++){
          var p = pts[i];
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        return { minX:minX, minY:minY, maxX:maxX, maxY:maxY };
      }
      if (b.r !== undefined && b.r > 0){
        return { minX:b.x-b.r, minY:b.y-b.r, maxX:b.x+b.r, maxY:b.y+b.r };
      }
      return { minX:b.x, minY:b.y, maxX:b.x+b.w, maxY:b.y+b.h };
    },
    contains: function(s, px, py){
      if (s.type === "circle") return px*px + py*py <= s.r*s.r;
      if (s.type === "box") return Math.abs(px) <= s.w/2 && Math.abs(py) <= s.h/2;
      if (s.type === "polygon"){
        var verts = s.verts;
        var inside = false;
        for (var i=0, j=verts.length-1; i<verts.length; j=i++){
          var vi = verts[i], vj = verts[j];
          if (((vi.y > py) !== (vj.y > py)) &&
              (px < (vj.x - vi.x) * (py - vi.y) / (vj.y - vi.y) + vi.x)){
            inside = !inside;
          }
        }
        return inside;
      }
      return false;
    },
    area: function(s){
      if (s.type === "circle") return Math.PI * s.r * s.r;
      if (s.type === "box") return s.w * s.h;
      if (s.type === "polygon"){
        var A = 0, verts = s.verts;
        for (var i=0, j=verts.length-1; i<verts.length; j=i++){
          A += (verts[j].x + verts[i].x) * (verts[j].y - verts[i].y);
        }
        return Math.abs(A * 0.5);
      }
      if (s.type === "capsule") return Math.PI * s.r * s.r + 2 * s.r * s.len;
      return 0;
    }
  };

  /* ================= Rigid ================= */
  function Rigid(opts) {
    opts = opts || {};
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.angle = opts.angle || 0;
    this.angularVelocity = opts.angularVelocity || 0;
    this.fx = 0; this.fy = 0;
    this.torque = 0;
    this.mass = opts.mass == null ? 1 : opts.mass;
    this.inertia = opts.inertia != null ? opts.inertia : this.mass;
    this.isStatic = !!opts.static;
    this.restitution = opts.restitution == null ? 0.8 : opts.restitution;
    this.r = opts.r || 0;
    this.w = opts.w || 0;
    this.h = opts.h || 0;
  }
  Rigid.prototype.applyForce = function(fx, fy){
    if (this.isStatic) return this;
    this.fx += fx; this.fy += fy;
    return this;
  };
  Rigid.prototype.applyTorque = function(t){
    if (this.isStatic) return this;
    this.torque += t;
    return this;
  };
  Rigid.prototype.applyImpulse = function(ix, iy){
    if (this.isStatic) return this;
    var invM = 1/this.mass;
    this.vx += ix * invM;
    this.vy += iy * invM;
    return this;
  };
  Rigid.prototype.applyImpulseAt = function(ix, iy, px, py){
    if (this.isStatic) return this;
    var invM = 1/this.mass;
    var invI = 1/this.inertia;
    this.vx += ix * invM;
    this.vy += iy * invM;
    var rx = px - this.x;
    var ry = py - this.y;
    this.angularVelocity += (rx * iy - ry * ix) * invI;
    return this;
  };
  Rigid.prototype.integrate = function(dt){
    if (this.isStatic) return this;
    var invM = 1/this.mass;
    var invI = 1/this.inertia;
    this.vx += this.fx * invM * dt;
    this.vy += this.fy * invM * dt;
    this.angularVelocity += this.torque * invI * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVelocity * dt;
    this.fx = 0; this.fy = 0; this.torque = 0;
    return this;
  };
  function rigid(opts){ return new Rigid(opts); }

  /* ================= Contact ================= */
  var contact = {
    manifold: function(a, b){
      var ar = a.r, br = b.r;
      var aIsC = ar !== undefined && ar > 0;
      var bIsC = br !== undefined && br > 0;
      if (aIsC && bIsC){
        var dx = b.x - a.x, dy = b.y - a.y;
        var rr = ar + br;
        var d2 = dx*dx + dy*dy;
        if (d2 > rr*rr) return null;
        var d = Math.sqrt(d2);
        if (d === 0) d = 1e-9;
        var invD = 1/d;
        var nx = dx*invD, ny = dy*invD;
        var depth = rr - d;
        return {
          a:a, b:b,
          normal:{x:nx, y:ny},
          depth:depth,
          points:[{x:a.x + nx * ar, y:a.y + ny * ar}]
        };
      }
      var aMinX, aMinY, aMaxX, aMaxY;
      var bMinX, bMinY, bMaxX, bMaxY;
      if (aIsC){
        aMinX = a.x - ar; aMinY = a.y - ar; aMaxX = a.x + ar; aMaxY = a.y + ar;
      } else {
        aMinX = a.x; aMinY = a.y; aMaxX = a.x + (a.w || 0); aMaxY = a.y + (a.h || 0);
      }
      if (bIsC){
        bMinX = b.x - br; bMinY = b.y - br; bMaxX = b.x + br; bMaxY = b.y + br;
      } else {
        bMinX = b.x; bMinY = b.y; bMaxX = b.x + (b.w || 0); bMaxY = b.y + (b.h || 0);
      }
      if (aMaxX < bMinX || bMaxX < aMinX || aMaxY < bMinY || bMaxY < aMinY) return null;
      var dx1 = bMaxX - aMinX, dx2 = aMaxX - bMinX;
      var dy1 = bMaxY - aMinY, dy2 = aMaxY - bMinY;
      var depth, nx2, ny2;
      if (dx1 < dx2 && dx1 < dy1 && dx1 < dy2){ nx2=1; ny2=0; depth=dx1; }
      else if (dx2 < dy1 && dx2 < dy2){ nx2=-1; ny2=0; depth=dx2; }
      else if (dy1 < dy2){ nx2=0; ny2=1; depth=dy1; }
      else { nx2=0; ny2=-1; depth=dy2; }
      return {
        a:a, b:b,
        normal:{x:nx2, y:ny2},
        depth:depth,
        points:[{x:(aMinX+aMaxX+bMinX+bMaxX)*0.25, y:(aMinY+aMaxY+bMinY+bMaxY)*0.25}]
      };
    }
  };

  /* ================= Solver ================= */
  var solver = {
    solveManifold: function(m, opts){
      opts = opts || {};
      var iters = opts.iterations || 8;
      var baumgarte = opts.baumgarte || 0.2;
      var slop = opts.slop || 0.01;
      var a = m.a, b = m.b;
      var aStatic = a.isStatic, bStatic = b.isStatic;
      if (aStatic && bStatic) return;
      var invA = aStatic ? 0 : 1/a.mass;
      var invB = bStatic ? 0 : 1/b.mass;
      var invSum = invA + invB;
      if (invSum === 0) return;
      var n = m.normal;
      var nx = n.x, ny = n.y, nz = n.z;
      var ea = a.restitution, eb = b.restitution;
      var e = ea < eb ? ea : eb;
      var avx=a.vx, avy=a.vy, avz=a.vz;
      var bvx=b.vx, bvy=b.vy, bvz=b.vz;
      // erken cikis: uzaklasiyor
      var vn0 = (bvx-avx)*nx + (bvy-avy)*ny + (bvz-avz)*nz;
      if (vn0 > 0) return;
      // konum duzeltme
      var corr = m.depth - slop;
      if (corr > 0){
        corr *= baumgarte / invSum;
        var cx = nx*corr, cy = ny*corr, cz = nz*corr;
        if (!aStatic){ a.x -= cx*invA; a.y -= cy*invA; a.z -= cz*invA; }
        if (!bStatic){ b.x += cx*invB; b.y += cy*invB; b.z += cz*invB; }
      }
      // hiz cozumu (iterasyon)
      for (var it=0; it<iters; it++){
        var rvx = bvx - avx;
        var rvy = bvy - avy;
        var rvz = bvz - avz;
        var vn = rvx*nx + rvy*ny + rvz*nz;
        if (vn > 0) break;
        var j = -(1 + e) * vn / invSum;
        var ix = j*nx, iy = j*ny, iz = j*nz;
        if (!aStatic){ avx -= ix*invA; avy -= iy*invA; avz -= iz*invA; }
        if (!bStatic){ bvx += ix*invB; bvy += iy*invB; bvz += iz*invB; }
      }
      a.vx = avx; a.vy = avy; a.vz = avz;
      b.vx = bvx; b.vy = bvy; b.vz = bvz;
    },
    solve: function(manifolds, opts){
      opts = opts || {};
      for (var i=0; i<manifolds.length; i++){
        if (manifolds[i]) solver.solveManifold(manifolds[i], opts);
      }
    }
  };

  /* ================= Raycast ================= */
  var raycast = {
    ray: function(ox, oy, dx, dy, shapes){
      var best = null;
      var len = Math.sqrt(dx*dx + dy*dy);
      if (len === 0) return null;
      var nx = dx/len, ny = dy/len;
      for (var i=0; i<shapes.length; i++){
        var s = shapes[i];
        var t = -1;
        if (s.type === "circle"){
          var cx = s.x || 0, cy = s.y || 0, r = s.r;
          var ocx = ox - cx, ocy = oy - cy;
          var b = ocx*nx + ocy*ny;
          var c = ocx*ocx + ocy*ocy - r*r;
          var disc = b*b - c;
          if (disc >= 0){
            var sq = Math.sqrt(disc);
            var t1 = -b - sq;
            var t2 = -b + sq;
            t = t1 > 0 ? t1 : (t2 > 0 ? t2 : -1);
          }
        } else if (s.type === "box"){
          var hw = s.w/2, hh = s.h/2;
          var tmin = -Infinity, tmax = Infinity;
          if (Math.abs(nx) > 1e-9){
            var t1x = (-hw - ox) / nx, t2x = (hw - ox) / nx;
            tmin = Math.max(tmin, Math.min(t1x, t2x));
            tmax = Math.min(tmax, Math.max(t1x, t2x));
          } else if (ox < -hw || ox > hw) continue;
          if (Math.abs(ny) > 1e-9){
            var t1y = (-hh - oy) / ny, t2y = (hh - oy) / ny;
            tmin = Math.max(tmin, Math.min(t1y, t2y));
            tmax = Math.min(tmax, Math.max(t1y, t2y));
          } else if (oy < -hh || oy > hh) continue;
          if (tmax < 0 || tmin > tmax) continue;
          t = tmin > 0 ? tmin : tmax;
        } else if (s.type === "polygon"){
          var verts = s.verts;
          for (var e=0; e<verts.length; e++){
            var v1 = verts[e], v2 = verts[(e+1) % verts.length];
            var ex = v2.x - v1.x, ey = v2.y - v1.y;
            var denom = nx * ey - ny * ex;
            if (Math.abs(denom) < 1e-9) continue;
            var tx = v1.x - ox, ty = v1.y - oy;
            var tt = (tx * ey - ty * ex) / denom;
            var ss = (tx * ny - ty * nx) / denom;
            if (tt > 0 && ss >= 0 && ss <= 1){
              if (t < 0 || tt < t) t = tt;
            }
          }
        }
        if (t > 0 && (best === null || t < best.t)){
          var px = ox + nx * t, py = oy + ny * t;
          var normal;
          if (s.type === "circle"){
            var cx2 = s.x || 0, cy2 = s.y || 0;
            var nnx = px - cx2, nny = py - cy2;
            var nl = Math.sqrt(nnx*nnx + nny*nny) || 1e-9;
            normal = { x:nnx/nl, y:nny/nl };
          } else {
            normal = { x:-nx, y:-ny };
          }
          best = { hit:s, t:t, point:{x:px, y:py}, normal:normal, distance:t };
        }
      }
      return best;
    }
  };

  /* ================= Quadtree ================= */
  function QuadtreeNode(x, y, w, h, maxItems, depth){
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.items = [];
    this.children = null;
    this.maxItems = maxItems;
    this.depth = depth || 0;
  }
  QuadtreeNode.prototype.insert = function(item){
    if (this.children !== null){
      var idx = this._index(item);
      if (idx !== -1){ this.children[idx].insert(item); return; }
      this.items.push(item);
      return;
    }
    this.items.push(item);
    if (this.items.length > this.maxItems && this.depth < 6){
      this._split();
      var moved = this.items;
      this.items = [];
      for (var i=0; i<moved.length; i++){
        var idx = this._index(moved[i]);
        if (idx !== -1) this.children[idx].insert(moved[i]);
        else this.items.push(moved[i]);
      }
    }
  };
  QuadtreeNode.prototype._split = function(){
    var hw = this.w/2, hh = this.h/2;
    this.children = [
      new QuadtreeNode(this.x, this.y, hw, hh, this.maxItems, this.depth+1),
      new QuadtreeNode(this.x+hw, this.y, hw, hh, this.maxItems, this.depth+1),
      new QuadtreeNode(this.x, this.y+hh, hw, hh, this.maxItems, this.depth+1),
      new QuadtreeNode(this.x+hw, this.y+hh, hw, hh, this.maxItems, this.depth+1)
    ];
  };
  QuadtreeNode.prototype._index = function(item){
    var mx = item.x + (item.w || 0)/2;
    var my = item.y + (item.h || 0)/2;
    var hw = this.w/2, hh = this.h/2;
    var left = mx < this.x + hw;
    var top = my < this.y + hh;
    if (left && top) return 0;
    if (!left && top) return 1;
    if (left && !top) return 2;
    return 3;
  };
  QuadtreeNode.prototype.query = function(qx, qy, qw, qh, out){
    out = out || [];
    if (qx > this.x + this.w || qx + qw < this.x ||
        qy > this.y + this.h || qy + qh < this.y) return out;
    for (var i=0; i<this.items.length; i++){
      var it = this.items[i];
      var iw = it.w || 0, ih = it.h || 0;
      if (it.x < qx+qw && it.x+iw > qx && it.y < qy+qh && it.y+ih > qy){
        out.push(it);
      }
    }
    if (this.children){
      for (var c=0; c<4; c++) this.children[c].query(qx, qy, qw, qh, out);
    }
    return out;
  };
  var quadtree = {
    create: function(x, y, w, h, maxItems){
      return new QuadtreeNode(x, y, w, h, maxItems || 4, 0);
    }
  };

  /* ================= ForceField ================= */
  var forceField = {
    gravity: function(gx, gy){ return { type:"gravity", gx:gx, gy:gy }; },
    wind: function(wx, wy){ return { type:"wind", wx:wx, wy:wy }; },
    attractor: function(px, py, strength){
      return { type:"attractor", px:px, py:py, strength:strength };
    },
    applyTo: function(field, b){
      if (b.isStatic) return;
      var fx = 0, fy = 0;
      if (field.type === "gravity"){
        fx = field.gx * b.mass;
        fy = field.gy * b.mass;
      } else if (field.type === "wind"){
        fx = field.wx;
        fy = field.wy;
      } else if (field.type === "attractor"){
        var dx = field.px - b.x, dy = field.py - b.y;
        var d2 = dx*dx + dy*dy || 1e-9;
        var d = Math.sqrt(d2);
        var mag = field.strength / d2;
        fx = mag * dx / d;
        fy = mag * dy / d;
      }
      b.fx += fx;
      b.fy += fy;
    }
  };

  /* ================= Sim ================= */
  function Sim(opts) {
    opts = opts || {};
    this.gx = opts.gravity ? (opts.gravity.x || 0) : 0;
    this.gy = opts.gravity ? (opts.gravity.y || -G_EARTH) : -G_EARTH;
    this.bodies = [];
    this.solverIterations = opts.solverIterations || 8;
    this.baumgarte = opts.baumgarte || 0.2;
    this.slop = opts.slop || 0.01;
    this.stats = { steps:0, contacts:0, lastDt:0, totalTime:0 };
  }
  Sim.prototype.add = function(b){ this.bodies.push(b); return this; };
  Sim.prototype.remove = function(b){
    var arr = this.bodies;
    for (var i=0; i<arr.length; i++){
      if (arr[i] === b){ arr.splice(i,1); return this; }
    }
    return this;
  };
  Sim.prototype.step = function(dt){
    var bodies = this.bodies;
    var n = bodies.length;
    var gx = this.gx, gy = this.gy;
    for (var i=0; i<n; i++){
      var b = bodies[i];
      if (b.isStatic) continue;
      b.fx += gx * b.mass;
      b.fy += gy * b.mass;
    }
    var manifolds = [];
    for (var a=0; a<n; a++){
      for (var c=a+1; c<n; c++){
        var m = contact.manifold(bodies[a], bodies[c]);
        if (m) manifolds.push(m);
      }
    }
    this.stats.contacts = manifolds.length;
    var opts = {
      iterations: this.solverIterations,
      baumgarte: this.baumgarte,
      slop: this.slop
    };
    solver.solve(manifolds, opts);
    for (var k=0; k<n; k++){
      var bk = bodies[k];
      if (bk.isStatic) continue;
      var invM = 1/bk.mass;
      bk.vx += bk.fx * invM * dt;
      bk.vy += bk.fy * invM * dt;
      bk.x  += bk.vx * dt;
      bk.y  += bk.vy * dt;
      bk.fx = 0; bk.fy = 0;
    }
    this.stats.steps++;
    this.stats.lastDt = dt;
    this.stats.totalTime += dt;
    return this;
  };
  function sim(opts){ return new Sim(opts); }

  /* ================= Friction ================= */
  var friction = {
    maxStatic: function(muS, N){ return muS * N; },
    kinetic: function(muK, N){ return muK * N; },
    applyToBody: function(b, muK, normalForce, dirX, dirY){
      if (b.isStatic) return b;
      var len = Math.sqrt(dirX*dirX + dirY*dirY);
      if (len === 0) return b;
      var mag = muK * normalForce / len;
      b.fx -= mag * dirX;
      b.fy -= mag * dirY;
      return b;
    }
  };

  /* ================= Joint ================= */
  function RevoluteJoint(a, b, px, py){
    this.a = a; this.b = b;
    this.px = px; this.py = py;
  }
  RevoluteJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = (a.x + b.x) * 0.5 - this.px;
    var dy = (a.y + b.y) * 0.5 - this.py;
    if (!a.isStatic){ a.x -= dx; a.y -= dy; }
    if (!b.isStatic){ b.x -= dx; b.y -= dy; }
    return this;
  };
  function WeldJoint(a, b){
    this.a = a; this.b = b;
    this.ox = b.x - a.x;
    this.oy = b.y - a.y;
  }
  WeldJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    if (!b.isStatic){
      b.x = a.x + this.ox;
      b.y = a.y + this.oy;
      b.vx = a.vx;
      b.vy = a.vy;
    }
    return this;
  };
  function PrismaticJoint(a, b, axisX, axisY, min, max){
    this.a = a; this.b = b;
    this.ax = axisX; this.ay = axisY;
    this.min = min == null ? -Infinity : min;
    this.max = max == null ? Infinity : max;
  }
  PrismaticJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y;
    var proj = dx * this.ax + dy * this.ay;
    if (proj < this.min) proj = this.min;
    if (proj > this.max) proj = this.max;
    if (!b.isStatic){
      b.x = a.x + this.ax * proj;
      b.y = a.y + this.ay * proj;
    }
    return this;
  };
  var joint = {
    revolute: function(a,b,px,py){ return new RevoluteJoint(a,b,px,py); },
    weld:     function(a,b){ return new WeldJoint(a,b); },
    prismatic:function(a,b,ax,ay,min,max){ return new PrismaticJoint(a,b,ax,ay,min,max); }
  };

  /* ================= Motor ================= */
  function Motor(a, targetSpeed, maxTorque){
    this.a = a;
    this.targetSpeed = targetSpeed;
    this.maxTorque = maxTorque == null ? Infinity : maxTorque;
  }
  Motor.prototype.apply = function(dt){
    var a = this.a;
    if (a.isStatic) return this;
    var diff = this.targetSpeed - (a.angularVelocity || 0);
    var t = diff * (a.inertia || 1) / dt;
    if (t > this.maxTorque) t = this.maxTorque;
    if (t < -this.maxTorque) t = -this.maxTorque;
    a.torque = (a.torque || 0) + t;
    return this;
  };
  function motor(a, targetSpeed, maxTorque){ return new Motor(a, targetSpeed, maxTorque); }

  /* ================= Sleeping ================= */
  function Sleeping(opts) {
    opts = opts || {};
    this.linearThreshold = opts.linearThreshold || 0.01;
    this.angularThreshold = opts.angularThreshold || 0.01;
    this.timeThreshold = opts.timeThreshold || 0.5;
  }
  Sleeping.prototype.update = function(b, dt){
    if (b.isStatic){ b.sleeping = true; return b; }
    var vx = b.vx, vy = b.vy;
    var lv2 = vx*vx + vy*vy;
    var th2 = this.linearThreshold * this.linearThreshold;
    if (lv2 < th2 && Math.abs(b.angularVelocity || 0) < this.angularThreshold){
      var t = (b.sleepTimer || 0) + dt;
      b.sleepTimer = t;
      if (t > this.timeThreshold){
        b.sleeping = true;
        b.vx = 0; b.vy = 0; b.angularVelocity = 0;
      }
    } else {
      b.sleepTimer = 0;
      b.sleeping = false;
    }
    return b;
  };
  function sleeping(opts){ return new Sleeping(opts); }

  /* ================= Capsule ================= */
  function Capsule(r, len, angle){
    this.type = "capsule";
    this.r = r;
    this.len = len;
    this.angle = angle || 0;
  }
  Capsule.prototype.points = function(){
    var a = this.angle;
    var hx = Math.cos(a) * this.len/2;
    var hy = Math.sin(a) * this.len/2;
    var c1x = -hx, c1y = -hy;
    var c2x = hx, c2y = hy;
    var r = this.r;
    return [
      {x:c1x-r, y:c1y-r}, {x:c1x+r, y:c1y-r},
      {x:c1x-r, y:c1y+r}, {x:c1x+r, y:c1y+r},
      {x:c2x-r, y:c2y-r}, {x:c2x+r, y:c2y-r},
      {x:c2x-r, y:c2y+r}, {x:c2x+r, y:c2y+r}
    ];
  };
  var capsule = {
    create: function(r, len, angle){ return new Capsule(r, len, angle); },
    fromPoints: function(x1, y1, x2, y2, r){
      var dx = x2-x1, dy = y2-y1;
      var len = Math.sqrt(dx*dx + dy*dy);
      var angle = Math.atan2(dy, dx);
      return new Capsule(r, len, angle);
    }
  };

  /* ================= Polygon ================= */
  function Polygon(verts){
    this.type = "polygon";
    this.verts = verts;
  }
  Polygon.prototype.aabb = function(){
    var minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (var i=0;i<this.verts.length;i++){
      var p = this.verts[i];
      if (p.x<minX) minX=p.x; if (p.x>maxX) maxX=p.x;
      if (p.y<minY) minY=p.y; if (p.y>maxY) maxY=p.y;
    }
    return {minX:minX, minY:minY, maxX:maxX, maxY:maxY};
  };
  Polygon.prototype.centroid = function(){
    var cx=0, cy=0, A=0;
    var verts = this.verts;
    for (var i=0, j=verts.length-1; i<verts.length; j=i++){
      var cross = verts[j].x*verts[i].y - verts[i].x*verts[j].y;
      A += cross;
      cx += (verts[j].x + verts[i].x) * cross;
      cy += (verts[j].y + verts[i].y) * cross;
    }
    A *= 0.5;
    if (A === 0) return {x:0, y:0};
    return {x: cx/(6*A), y: cy/(6*A)};
  };
  Polygon.prototype.translate = function(dx, dy){
    var out = new Array(this.verts.length);
    for (var i=0;i<this.verts.length;i++){
      out[i] = {x:this.verts[i].x+dx, y:this.verts[i].y+dy};
    }
    return new Polygon(out);
  };
  Polygon.prototype.rotate = function(angle){
    var c = Math.cos(angle), s = Math.sin(angle);
    var out = new Array(this.verts.length);
    for (var i=0;i<this.verts.length;i++){
      var vv = this.verts[i];
      out[i] = {x:vv.x*c - vv.y*s, y:vv.x*s + vv.y*c};
    }
    return new Polygon(out);
  };
  var polygon = {
    create: function(verts){ return new Polygon(verts); },
    box: function(w, h){
      return new Polygon([
        {x:-w/2, y:-h/2}, {x:w/2, y:-h/2},
        {x:w/2, y:h/2}, {x:-w/2, y:h/2}
      ]);
    },
    regular: function(n, r){
      var key = n + ":" + r;
      if (shape._regCache[key]) return shape._regCache[key];
      var verts = new Array(n);
      if (n <= 16){
        var step = PI2 / n;
        for (var i=0;i<n;i++){
          var a = i * step;
          verts[i] = {x:r*Math.cos(a), y:r*Math.sin(a)};
        }
      } else {
        var step2 = PI2 / n;
        var c = 1, s = 0;
        var cs = Math.cos(step2), ss = Math.sin(step2);
        for (var j=0;j<n;j++){
          verts[j] = {x:r*c, y:r*s};
          var nc = c*cs - s*ss;
          var ns = c*ss + s*cs;
          c = nc; s = ns;
        }
      }
      var poly = new Polygon(verts);
      shape._regCache[key] = poly;
      return poly;
    }
  };

  /* ================= SAT ================= */
  function projectPoly(verts, axis){
    var min = Infinity, max = -Infinity;
    for (var i=0;i<verts.length;i++){
      var d = verts[i].x * axis.x + verts[i].y * axis.y;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return {min:min, max:max};
  }
  function getAxes(verts){
    var axes = [];
    for (var i=0;i<verts.length;i++){
      var p1 = verts[i], p2 = verts[(i+1)%verts.length];
      var edge = {x:p2.x-p1.x, y:p2.y-p1.y};
      var len = Math.sqrt(edge.x*edge.x + edge.y*edge.y) || 1;
      axes.push({x:-edge.y/len, y:edge.x/len});
    }
    return axes;
  }
  var sat = {
    polyPoly: function(A, B){
      var aA = A._aabbCache || (A._aabbCache = A.aabb());
      var aB = B._aabbCache || (B._aabbCache = B.aabb());
      if (aA.maxX < aB.minX || aB.maxX < aA.minX ||
          aA.maxY < aB.minY || aB.maxY < aA.minY) return null;
      var vA = A.verts, vB = B.verts;
      var axesA = A._axesCache || (A._axesCache = getAxes(vA));
      var axesB = B._axesCache || (B._axesCache = getAxes(vB));
      var minOverlap = Infinity, bestX = 0, bestY = 0;
      var nAxesA = axesA.length, nAxesB = axesB.length;
      var i, ax, pAmin, pAmax, pBmin, pBmax, proj, d, overlap;

      // A eksenleri
      for (i=0;i<nAxesA;i++){
        ax = axesA[i];
        pAmin = Infinity; pAmax = -Infinity;
        for (var k=0;k<vA.length;k++){
          d = vA[k].x * ax.x + vA[k].y * ax.y;
          if (d < pAmin) pAmin = d;
          if (d > pAmax) pAmax = d;
        }
        pBmin = Infinity; pBmax = -Infinity;
        for (var m=0;m<vB.length;m++){
          d = vB[m].x * ax.x + vB[m].y * ax.y;
          if (d < pBmin) pBmin = d;
          if (d > pBmax) pBmax = d;
        }
        overlap = Math.min(pAmax, pBmax) - Math.max(pAmin, pBmin);
        if (overlap < 0) return null;
        if (overlap < minOverlap){
          minOverlap = overlap;
          bestX = ax.x; bestY = ax.y;
        }
      }
      // B eksenleri
      for (i=0;i<nAxesB;i++){
        ax = axesB[i];
        pAmin = Infinity; pAmax = -Infinity;
        for (var k2=0;k2<vA.length;k2++){
          d = vA[k2].x * ax.x + vA[k2].y * ax.y;
          if (d < pAmin) pAmin = d;
          if (d > pAmax) pAmax = d;
        }
        pBmin = Infinity; pBmax = -Infinity;
        for (var m2=0;m2<vB.length;m2++){
          d = vB[m2].x * ax.x + vB[m2].y * ax.y;
          if (d < pBmin) pBmin = d;
          if (d > pBmax) pBmax = d;
        }
        overlap = Math.min(pAmax, pBmax) - Math.max(pAmin, pBmin);
        if (overlap < 0) return null;
        if (overlap < minOverlap){
          minOverlap = overlap;
          bestX = ax.x; bestY = ax.y;
        }
      }
      var cA = A._centroidCache || (A._centroidCache = A.centroid());
      var cB = B._centroidCache || (B._centroidCache = B.centroid());
      var dx = cB.x - cA.x, dy = cB.y - cA.y;
      if (dx*bestX + dy*bestY < 0){ bestX = -bestX; bestY = -bestY; }
      return { hit:true, normal:{x:bestX, y:bestY}, depth:minOverlap };
    },
    aabbPoly: function(aabb, poly){
      var aA = aabb;
      var aB = poly.aabb();
      if (aA.maxX < aB.minX || aB.maxX < aA.minX ||
          aA.maxY < aB.minY || aB.maxY < aA.minY) return null;
      var boxPoly = new Polygon([
        {x:aabb.minX, y:aabb.minY}, {x:aabb.maxX, y:aabb.minY},
        {x:aabb.maxX, y:aabb.maxY}, {x:aabb.minX, y:aabb.maxY}
      ]);
      return sat.polyPoly(boxPoly, poly);
    },
    circPoly: function(cx, cy, r, poly){
      var aB = poly.aabb();
      if (cx + r < aB.minX || cx - r > aB.maxX ||
          cy + r < aB.minY || cy - r > aB.maxY) return null;
      var verts = poly.verts;
      var minDist2 = Infinity, nearestEdge = null;
      for (var i=0;i<verts.length;i++){
        var p1 = verts[i], p2 = verts[(i+1)%verts.length];
        var ex = p2.x-p1.x, ey = p2.y-p1.y;
        var len2 = ex*ex + ey*ey;
        var t = ((cx-p1.x)*ex + (cy-p1.y)*ey) / len2;
        if (t < 0) t = 0; if (t > 1) t = 1;
        var px = p1.x + ex*t, py = p1.y + ey*t;
        var dx = cx-px, dy = cy-py;
        var d2 = dx*dx + dy*dy;
        if (d2 < minDist2){ minDist2 = d2; nearestEdge = {x:px, y:py}; }
      }
      if (minDist2 > r*r) return null;
      var dx2 = nearestEdge.x - cx, dy2 = nearestEdge.y - cy;
      var d = Math.sqrt(minDist2) || 1e-9;
      return {
        hit:true,
        normal:{x:dx2/d, y:dy2/d},
        depth: r - d
      };
    }
  };

  /* ================= Fracture ================= */
  var fracture = {
    split: function(poly, ax, ay, bx, by){
      var dx = bx - ax, dy = by - ay;
      var len2 = dx*dx + dy*dy;
      if (len2 === 0) return [poly];
      var invLen = 1 / Math.sqrt(len2);
      var nx = -dy * invLen;
      var ny =  dx * invLen;
      var verts = poly.verts;
      var n = verts.length;
      var sides = new Array(n);
      var hasPos = false, hasNeg = false;
      for (var i=0;i<n;i++){
        var vv = verts[i];
        var s = (vv.x - ax) * nx + (vv.y - ay) * ny;
        sides[i] = s;
        if (s > 1e-9) hasPos = true;
        if (s < -1e-9) hasNeg = true;
      }
      if (!hasPos || !hasNeg) return [poly];
      var left = [], right = [];
      for (var j=0;j<n;j++){
        var k = (j + 1) % n;
        var sj = sides[j], sk = sides[k];
        var vj = verts[j], vk = verts[k];
        if (sj >= 0) left.push({x:vj.x, y:vj.y});
        if (sj <= 0) right.push({x:vj.x, y:vj.y});
        if ((sj > 0 && sk < 0) || (sj < 0 && sk > 0)){
          var t = sj / (sj - sk);
          var ip = { x: vj.x + (vk.x - vj.x) * t, y: vj.y + (vk.y - vj.y) * t };
          left.push(ip);
          right.push(ip);
        }
      }
      var out = [];
      if (left.length >= 3) out.push(new Polygon(left));
      if (right.length >= 3) out.push(new Polygon(right));
      return out;
    }
  };

  /* ================= Broadphase ================= */
  var broadphase = {
    build: function(bodies, x, y, w, h, maxItems){
      var qt = quadtree.create(x, y, w, h, maxItems || 8);
      for (var i=0;i<bodies.length;i++){
        var b = bodies[i];
        var aabb = shape.aabb(b);
        qt.insert({
          x:aabb.minX, y:aabb.minY,
          w:aabb.maxX-aabb.minX, h:aabb.maxY-aabb.minY,
          body:b
        });
      }
      return qt;
    },
    queryBody: function(qt, b){
      var aabb = shape.aabb(b);
      var qw = aabb.maxX - aabb.minX;
      var qh = aabb.maxY - aabb.minY;
      var hits = qt.query(aabb.minX, aabb.minY, qw, qh);
      var out = [];
      for (var i=0;i<hits.length;i++){
        if (hits[i].body !== b) out.push(hits[i].body);
      }
      return out;
    }
  };

  /* ================= Sim2D ================= */
  function Sim2D(opts) {
    opts = opts || {};
    this.gx = opts.gravity ? (opts.gravity.x || 0) : 0;
    this.gy = opts.gravity ? (opts.gravity.y || -G_EARTH) : -G_EARTH;
    this.bodies = [];
    this.constraints = [];
    this.solverIterations = opts.solverIterations || 8;
    this.baumgarte = opts.baumgarte || 0.2;
    this.slop = opts.slop || 0.01;
    this.useBroadphase = !!opts.broadphase;
    this.stats = { steps:0, contacts:0, broadphaseHits:0, lastDt:0, totalTime:0 };
    this.qt = null;
  }
  Sim2D.prototype.add = function(b){ this.bodies.push(b); return this; };
  Sim2D.prototype.addConstraint = function(c){ this.constraints.push(c); return this; };
  Sim2D.prototype.remove = function(b){
    var arr = this.bodies;
    for (var i=0; i<arr.length; i++){
      if (arr[i] === b){ arr.splice(i,1); return this; }
    }
    return this;
  };
  Sim2D.prototype.step = function(dt){
    var bodies = this.bodies;
    var n = bodies.length;
    var gx = this.gx, gy = this.gy;

    for (var i=0; i<n; i++){
      var b = bodies[i];
      if (b.isStatic) continue;
      b.fx += gx * b.mass;
      b.fy += gy * b.mass;
    }

    var pairs = [];
    if (this.useBroadphase){
      var minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      for (var k=0;k<n;k++){
        var ab = shape.aabb(bodies[k]);
        if (ab.minX < minX) minX = ab.minX;
        if (ab.minY < minY) minY = ab.minY;
        if (ab.maxX > maxX) maxX = ab.maxX;
        if (ab.maxY > maxY) maxY = ab.maxY;
      }
      var pad = 10;
      var qt = broadphase.build(bodies, minX-pad, minY-pad, maxX-minX+2*pad, maxY-minY+2*pad, 8);
      this.qt = qt;
      var seen = {};
      for (var a=0; a<n; a++){
        var cands = broadphase.queryBody(qt, bodies[a]);
        for (var ci=0; ci<cands.length; ci++){
          var idx = bodies.indexOf(cands[ci]);
          var key = a < idx ? a+","+idx : idx+","+a;
          if (!seen[key]){ seen[key] = 1; pairs.push([a, idx]); }
        }
      }
      this.stats.broadphaseHits = pairs.length;
    } else {
      for (var ai=0; ai<n; ai++){
        for (var bi=ai+1; bi<n; bi++) pairs.push([ai, bi]);
      }
    }

    var manifolds = [];
    for (var pi=0; pi<pairs.length; pi++){
      var ia = pairs[pi][0], ib = pairs[pi][1];
      var ba = bodies[ia], bb = bodies[ib];
      if (ba.layer !== undefined && bb.layer !== undefined &&
          (ba.layer & bb.mask) === 0 && (bb.layer & ba.mask) === 0) continue;
      if (ba.isSensor || bb.isSensor) continue;
      if (ba.shape && ba.shape.type === "polygon" && bb.shape && bb.shape.type === "polygon"){
        var mp = sat.polyPoly(ba.shape, bb.shape);
        if (mp) manifolds.push({
          a:ba, b:bb,
          normal:mp.normal,
          depth:mp.depth,
          points:[{x:(ba.x+bb.x)/2, y:(ba.y+bb.y)/2}]
        });
      } else if (ba.shape && bb.shape && (ba.shape.type === "circle" || bb.shape.type === "circle")){
        var m2 = contact.manifold(ba, bb);
        if (m2) manifolds.push(m2);
      } else {
        var m3 = contact.manifold(ba, bb);
        if (m3) manifolds.push(m3);
      }
    }
    this.stats.contacts = manifolds.length;

    for (var cc=0; cc<this.constraints.length; cc++){
      if (this.constraints[cc].apply) this.constraints[cc].apply(dt);
    }

    solver.solve(manifolds, {
      iterations: this.solverIterations,
      baumgarte: this.baumgarte,
      slop: this.slop
    });

    for (var k2=0; k2<n; k2++){
      bodies[k2].integrate(dt);
    }

    this.stats.steps++;
    this.stats.lastDt = dt;
    this.stats.totalTime += dt;
    return this;
  };
  function sim2d(opts){ return new Sim2D(opts); }

  /* ================= Debug ================= */
  var debug = {
    body: function(b){
      var out = { points:[], lines:[] };
      if (b.shape){
        if (b.shape.type === "circle"){
          out.points.push({x:b.x, y:b.y, r:b.shape.r, color:"#7cf"});
        } else if (b.shape.type === "polygon"){
          var verts = b.shape.verts;
          var world = new Array(verts.length);
          var c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0);
          for (var i=0;i<verts.length;i++){
            var vv = verts[i];
            world[i] = {
              x: b.x + vv.x*c - vv.y*s,
              y: b.y + vv.x*s + vv.y*c
            };
          }
          for (var j=0;j<world.length;j++){
            out.lines.push({a:world[j], b:world[(j+1)%world.length], color:"#7cf"});
          }
        } else if (b.shape.type === "capsule"){
          out.points.push({x:b.x, y:b.y, r:b.shape.r, color:"#7cf"});
        }
      } else if (b.r !== undefined && b.r > 0){
        out.points.push({x:b.x, y:b.y, r:b.r, color:"#7cf"});
      } else if (b.w !== undefined){
        out.lines.push({a:{x:b.x,y:b.y}, b:{x:b.x+b.w,y:b.y+b.h}, color:"#7cf"});
      }
      return out;
    },
    manifold: function(m){
      var out = { points:[], lines:[] };
      if (!m) return out;
      var p = m.points && m.points[0] ? m.points[0] : {x:m.a.x, y:m.a.y};
      out.lines.push({
        a:p,
        b:{x:p.x + m.normal.x * m.depth * 20, y:p.y + m.normal.y * m.depth * 20},
        color:"#f66"
      });
      return out;
    }
  };

  /* ============================================================
   * ============ 1.5.10 YENI MODULLER ===========================
   * ============================================================ */

  /* ================= Character ================= */
  function Character(opts) {
    opts = opts || {};
    this.b = opts.body || body({x:0, y:0, r:8, mass:1});
    this.gravity = opts.gravity == null ? G_EARTH : opts.gravity;
    this.jumpSpeed = opts.jumpSpeed == null ? 10 : opts.jumpSpeed;
    this.maxJumps = opts.maxJumps == null ? 2 : opts.maxJumps;
    this.jumpsLeft = this.maxJumps;
    this.grounded = false;
    this.coyoteTime = opts.coyoteTime == null ? 0.1 : opts.coyoteTime;
    this.coyoteTimer = 0;
    this.jumpBuffer = opts.jumpBuffer == null ? 0.1 : opts.jumpBuffer;
    this.jumpBufferTimer = 0;
  }
    Character.prototype.update = function(dt, groundY){
    var feet = this.b.y + (this.b.r || 0);
    this.grounded = groundY !== undefined && feet >= groundY - 1e-6;
    if (this.grounded){
      this.jumpsLeft = this.maxJumps;
      this.coyoteTimer = this.coyoteTime;
    } else if (this.coyoteTimer > 0){
      this.coyoteTimer -= dt;
    }
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    return this;
  };
  Character.prototype.jump = function(){
    if (this.jumpsLeft > 0 || this.coyoteTimer > 0){
      this.b.vy = -this.jumpSpeed;
      this.jumpsLeft--;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      return true;
    }
    this.jumpBufferTimer = this.jumpBuffer;
    return false;
  };
  function character(opts){ return new Character(opts); }

  /* ================= Trigger ================= */
  function Trigger(shape, opts) {
    opts = opts || {};
    this.shape = shape;
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.w = opts.w || 0;
    this.h = opts.h || 0;
    this.r = opts.r || 0;
    this.onEnter = opts.onEnter || null;
    this.onStay = opts.onStay || null;
    this.onExit = opts.onExit || null;
    this._inside = {};
  }
  Trigger.prototype.test = function(b){
    var dx, dy;
    if (this.shape === "circle"){
      dx = b.x - this.x; dy = b.y - this.y;
      return dx*dx + dy*dy <= (this.r + (b.r || 0)) * (this.r + (b.r || 0));
    }
    // AABB
    var bMinX = b.x - (b.r || 0), bMaxX = b.x + (b.r || 0);
    var bMinY = b.y - (b.r || 0), bMaxY = b.y + (b.r || 0);
    if (b.w !== undefined && b.w > 0){ bMinX = b.x; bMaxX = b.x + b.w; }
    if (b.h !== undefined && b.h > 0){ bMinY = b.y; bMaxY = b.y + b.h; }
    return !(this.x + this.w < bMinX || bMaxX < this.x ||
             this.y + this.h < bMinY || bMaxY < this.y);
  };
  Trigger.prototype.update = function(bodies){
    for (var i=0;i<bodies.length;i++){
      var b = bodies[i];
      var inside = this.test(b);
      var was = this._inside[b];
      if (inside && !was){
        this._inside[b] = true;
        if (this.onEnter) this.onEnter(b);
      } else if (inside && was){
        if (this.onStay) this.onStay(b);
      } else if (!inside && was){
        delete this._inside[b];
        if (this.onExit) this.onExit(b);
      }
    }
    return this;
  };
  function trigger(shape, opts){ return new Trigger(shape, opts); }

  /* ================= Layers ================= */
  var layers = {
    NONE: 0,
    ALL: -1,
    bit: function(n){ return 1 << n; },
    combine: function(){ var r = 0; for (var i=0;i<arguments.length;i++) r |= arguments[i]; return r; },
    test: function(a, b){ return (a.layer & b.mask) !== 0 || (b.layer & a.mask) !== 0; }
  };

  /* ================= Rope ================= */
  function Rope(bodies, opts) {
    opts = opts || {};
    this.bodies = bodies;
    this.constraints = [];
    for (var i=0;i<bodies.length-1;i++){
      this.constraints.push(constraint.distance(bodies[i], bodies[i+1], opts));
    }
  }
  Rope.prototype.apply = function(){
    for (var i=0;i<this.constraints.length;i++) this.constraints[i].apply();
    return this;
  };
  Rope.prototype.ends = function(){
    return { first: this.bodies[0], last: this.bodies[this.bodies.length-1] };
  };
  function rope(bodies, opts){ return new Rope(bodies, opts); }

  /* ================= Spring2D ================= */
  function Spring2D(a, b, opts) {
    opts = opts || {};
    this.a = a; this.b = b;
    this.k = opts.k == null ? 100 : opts.k;
    this.damping = opts.damping == null ? 0 : opts.damping;
    this.restLength = opts.restLength == null ? 1 : opts.restLength;
  }
  Spring2D.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) return this;
    var inv = 1 / dist;
    var nx = dx * inv, ny = dy * inv;
    var F = this.k * (dist - this.restLength);
    var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    F += this.damping * vn;
    var fx = F * nx, fy = F * ny;
    if (!a.isStatic){ a.fx += fx; a.fy += fy; }
    if (!b.isStatic){ b.fx -= fx; b.fy -= fy; }
    return this;
  };
  Spring2D.prototype.points = function(){
    // yayin gorsel noktalari (salinyum icin ornek noktalar)
    var n = 8;
    var out = [];
    for (var i=0;i<=n;i++){
      var t = i / n;
      var x = this.a.x + (this.b.x - this.a.x) * t;
      var y = this.a.y + (this.b.y - this.a.y) * t;
      // dikey salinyum
      if (i > 0 && i < n){
        var amp = 5;
        var perpX = -(this.b.y - this.a.y);
        var perpY = (this.b.x - this.a.x);
        var plen = Math.sqrt(perpX*perpX + perpY*perpY) || 1;
        var sign = (i % 2 === 0) ? 1 : -1;
        x += (perpX/plen) * amp * sign;
        y += (perpY/plen) * amp * sign;
      }
      out.push({x:x, y:y});
    }
    return out;
  };
  var spring2d = {
    create: function(a,b,opts){ return new Spring2D(a,b,opts); }
  };

  /* ================= Tilemap ================= */
  function Tilemap(w, h, tileSize) {
    this.w = w; this.h = h;
    this.tileSize = tileSize || 16;
    this.tiles = new Uint8Array(w * h);
  }
  Tilemap.prototype.set = function(x, y, solid){
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return this;
    this.tiles[y * this.w + x] = solid ? 1 : 0;
    return this;
  };
  Tilemap.prototype.get = function(x, y){
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return 0;
    return this.tiles[y * this.w + x];
  };
  Tilemap.prototype.solidAt = function(px, py){
    var tx = Math.floor(px / this.tileSize);
    var ty = Math.floor(py / this.tileSize);
    return this.get(tx, ty) === 1;
  };
  Tilemap.prototype.collide = function(b){
    var out = [];
    var ts = this.tileSize;
    var r = b.r || 0;
    var bMinX = b.x - r, bMaxX = b.x + r;
    var bMinY = b.y - r, bMaxY = b.y + r;
    if (b.w !== undefined && b.w > 0){ bMinX = b.x; bMaxX = b.x + b.w; }
    if (b.h !== undefined && b.h > 0){ bMinY = b.y; bMaxY = b.y + b.h; }
    var t0x = Math.floor(bMinX / ts), t1x = Math.floor(bMaxX / ts);
    var t0y = Math.floor(bMinY / ts), t1y = Math.floor(bMaxY / ts);
    for (var ty=t0y; ty<=t1y; ty++){
      for (var tx=t0x; tx<=t1x; tx++){
        if (this.get(tx, ty) === 1){
          out.push({ tx:tx, ty:ty, x:tx*ts, y:ty*ts, w:ts, h:ts });
        }
      }
    }
    return out;
  };
  var tilemap = {
    create: function(w, h, tileSize){ return new Tilemap(w, h, tileSize); }
  };

  /* ================= Destructible ================= */
  function Destructible(poly, opts) {
    opts = opts || {};
    this.poly = poly;
    this.threshold = opts.threshold == null ? 0.5 : opts.threshold;
    this.pieces = [poly];
  }
  Destructible.prototype.impact = function(px, py, force){
    if (force < this.threshold) return this;
    var out = [];
    for (var i=0;i<this.pieces.length;i++){
      var p = this.pieces[i];
      // parca merkezine gore kes
      var c = p.centroid();
      var dirX = c.x - px, dirY = c.y - py;
      var len = Math.sqrt(dirX*dirX + dirY*dirY) || 1;
      // darbe yonunde kes
      var parts = fracture.split(p, px, py, px + dirX/len * 100, py + dirY/len * 100);
      if (parts.length > 1){
        for (var j=0;j<parts.length;j++) out.push(parts[j]);
      } else {
        out.push(p);
      }
    }
    this.pieces = out;
    return this;
  };
  Destructible.prototype.count = function(){ return this.pieces.length; };
  function destructible(poly, opts){ return new Destructible(poly, opts); }

  /* ================= Render ================= */
  function Camera(x, y, zoom) {
    this.x = x || 0;
    this.y = y || 0;
    this.zoom = zoom == null ? 1 : zoom;
  }
  Camera.prototype.toScreen = function(wx, wy, canvasW, canvasH){
    return {
      x: (wx - this.x) * this.zoom + canvasW / 2,
      y: (wy - this.y) * this.zoom + canvasH / 2
    };
  };
  Camera.prototype.toWorld = function(sx, sy, canvasW, canvasH){
    return {
      x: (sx - canvasW / 2) / this.zoom + this.x,
      y: (sy - canvasH / 2) / this.zoom + this.y
    };
  };
  var render = {
    camera: function(x, y, zoom){ return new Camera(x, y, zoom); },
    polyline: function(points, color){
      var out = [];
      for (var i=0;i<points.length-1;i++){
        out.push({ a:points[i], b:points[i+1], color:color || "#7cf" });
      }
      return out;
    },
    circle: function(x, y, r, color){
      return { type:"circle", x:x, y:y, r:r, color:color || "#7cf" };
    },
    polygon: function(verts, color){
      var n = verts.length;
      var lines = new Array(n);
      for (var i=0;i<n;i++){
        lines[i] = { a:verts[i], b:verts[(i+1)%n], color:color || "#7cf" };
      }
      return lines;
    },
    body: function(b){
      return debug.body(b);
    }
  };


  /* ================= Spatial Hash (hizli broadphase) ================= */
  function SpatialHash(cellSize) {
    this.cellSize = cellSize || 64;
    this.cells = {};
    this.bodies = [];
  }
  SpatialHash.prototype._key = function(cx, cy){ return cx + "," + cy; };
  SpatialHash.prototype.add = function(b){
    this.bodies.push(b);
    var aabb = shape.aabb(b);
    var cs = this.cellSize;
    var x0 = Math.floor(aabb.minX / cs), x1 = Math.floor(aabb.maxX / cs);
    var y0 = Math.floor(aabb.minY / cs), y1 = Math.floor(aabb.maxY / cs);
    for (var y=y0; y<=y1; y++){
      for (var x=x0; x<=x1; x++){
        var k = this._key(x, y);
        if (!this.cells[k]) this.cells[k] = [];
        this.cells[k].push(b);
      }
    }
    return this;
  };
  SpatialHash.prototype.query = function(b, out){
    out = out || [];
    var aabb = shape.aabb(b);
    var cs = this.cellSize;
    var x0 = Math.floor(aabb.minX / cs), x1 = Math.floor(aabb.maxX / cs);
    var y0 = Math.floor(aabb.minY / cs), y1 = Math.floor(aabb.maxY / cs);
    var seen = {};
    for (var y=y0; y<=y1; y++){
      for (var x=x0; x<=x1; x++){
        var cell = this.cells[this._key(x, y)];
        if (!cell) continue;
        for (var i=0;i<cell.length;i++){
          if (cell[i] === b) continue;
          if (seen[cell[i]._id]) continue;
          if (!cell[i]._id) cell[i]._id = rnd.next();
          seen[cell[i]._id] = 1;
          out.push(cell[i]);
        }
      }
    }
    return out;
  };
  SpatialHash.prototype.clear = function(){
    this.cells = {};
    this.bodies = [];
    return this;
  };
  var spatialHash = {
    create: function(cellSize){ return new SpatialHash(cellSize); }
  };

  /* ================= Particles ================= */
  function Particles(max) {
    this.max = max || 1000;
    this.x = null; this.y = null;
    this.vx = null; this.vy = null;
    this.life = null;
    this.count = 0;
    this.gravity = -G_EARTH;
  }
  Particles.prototype._init = function(){
    if (this.x) return;
    var m = this.max;
    this.x = new Float32Array(m);
    this.y = new Float32Array(m);
    this.vx = new Float32Array(m);
    this.vy = new Float32Array(m);
    this.life = new Float32Array(m);
  };
  Particles.prototype.emit = function(px, py, count, spread, speed){
    this._init();
    spread = spread || 0.5;
    speed = speed || 5;
    for (var i=0;i<count && this.count < this.max;i++){
      var idx = this.count++;
      this.x[idx] = px;
      this.y[idx] = py;
      var a = rnd.next() * Math.PI * 2;
      var v = rnd.next() * speed;
      this.vx[idx] = Math.cos(a) * v * spread + rnd.next() * 0.1;
      this.vy[idx] = Math.sin(a) * v * spread + rnd.next() * 0.1;
      this.life[idx] = 1;
    }
    return this;
  };
  Particles.prototype.step = function(dt){
    if (!this.x) return this;
    for (var i=0;i<this.count;i++){
      this.vy[i] += this.gravity * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.life[i] -= dt;
      if (this.life[i] <= 0){
        var last = --this.count;
        this.x[i] = this.x[last]; this.y[i] = this.y[last];
        this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last];
        this.life[i] = this.life[last];
        i--;
      }
    }
    return this;
  };
  Particles.prototype.list = function(){
    var out = new Array(this.count);
    for (var i=0;i<this.count;i++){
      out[i] = { x:this.x[i], y:this.y[i], life:this.life[i] };
    }
    return out;
  };
  function particles(max){ return new Particles(max); }

  /* ================= Bezier ================= */
  function Bezier(p0, p1, p2, p3) {
    this.p0 = p0; this.p1 = p1; this.p2 = p2; this.p3 = p3;
  }
  Bezier.prototype.at = function(t){
    var mt = 1 - t;
    var a = mt*mt*mt, b = 3*mt*mt*t, c = 3*mt*t*t, d = t*t*t;
    return {
      x: a*this.p0.x + b*this.p1.x + c*this.p2.x + d*this.p3.x,
      y: a*this.p0.y + b*this.p1.y + c*this.p2.y + d*this.p3.y
    };
  };
  Bezier.prototype.derivative = function(t){
    var mt = 1 - t;
    var a = 3*mt*mt, b = 6*mt*t, c = 3*t*t;
    return {
      x: a*(this.p1.x-this.p0.x) + b*(this.p2.x-this.p1.x) + c*(this.p3.x-this.p2.x),
      y: a*(this.p1.y-this.p0.y) + b*(this.p2.y-this.p1.y) + c*(this.p3.y-this.p2.y)
    };
  };
  Bezier.prototype.samples = function(n){
    var out = new Array(n);
    var p0 = this.p0, p1 = this.p1, p2 = this.p2, p3 = this.p3;
    for (var i=0;i<n;i++){
      var t = i / (n - 1);
      var mt = 1 - t;
      var a = mt*mt*mt, b = 3*mt*mt*t, c = 3*mt*t*t, d = t*t*t;
      out[i] = {
        x: a*p0.x + b*p1.x + c*p2.x + d*p3.x,
        y: a*p0.y + b*p1.y + c*p2.y + d*p3.y
      };
    }
    return out;
  };
  var bezier = {
    create: function(p0, p1, p2, p3){ return new Bezier(p0, p1, p2, p3); }
  };

  /* ================= Curve (catmull-rom) ================= */
  function Curve(points) {
    this.points = points;
  }
  Curve.prototype.at = function(t){
    var n = this.points.length;
    if (n < 2) return this.points[0] || {x:0,y:0};
    var idx = Math.floor(t * (n - 1));
    if (idx >= n - 1) idx = n - 2;
    var localT = t * (n - 1) - idx;
    var p0 = this.points[Math.max(0, idx-1)];
    var p1 = this.points[idx];
    var p2 = this.points[idx+1];
    var p3 = this.points[Math.min(n-1, idx+2)];
    var t2 = localT * localT;
    var t3 = t2 * localT;
    return {
      x: 0.5 * ((2*p1.x) + (-p0.x + p2.x)*localT + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
      y: 0.5 * ((2*p1.y) + (-p0.y + p2.y)*localT + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3)
    };
  };
  Curve.prototype.samples = function(n){
    if (this._cacheN === n && this._cacheOut) return this._cacheOut;
    var out = new Array(n);
    var pts = this.points;
    var len = pts.length;
    if (len < 2){
      for (var i0=0;i0<n;i0++) out[i0] = pts[0] || {x:0,y:0};
      this._cacheN = n;
      this._cacheOut = out;
      return out;
    }
    var lastIdx = len - 2;
    for (var i=0;i<n;i++){
      var t = i / (n - 1);
      var idx = Math.floor(t * (len - 1));
      if (idx > lastIdx) idx = lastIdx;
      var localT = t * (len - 1) - idx;
      var p0 = pts[idx > 0 ? idx - 1 : 0];
      var p1 = pts[idx];
      var p2 = pts[idx + 1];
      var p3 = pts[idx + 2 < len ? idx + 2 : len - 1];
      var t2 = localT * localT;
      var t3 = t2 * localT;
      out[i] = {
        x: 0.5 * ((2*p1.x) + (-p0.x + p2.x)*localT + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
        y: 0.5 * ((2*p1.y) + (-p0.y + p2.y)*localT + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3)
      };
    }
    this._cacheN = n;
    this._cacheOut = out;
    return out;
  };
  var curve = {
    create: function(points){ return new Curve(points); }
  };

  /* ================= PathFollow ================= */
  function PathFollow(path, duration, loop) {
    this.path = path;
    this.duration = duration || 1;
    this.loop = !!loop;
    this.t = 0;
  }
  PathFollow.prototype.step = function(dt){
    this.t += dt / this.duration;
    if (this.t > 1){
      if (this.loop) this.t = this.t % 1;
      else this.t = 1;
    }
    return this.at(this.t);
  };
  PathFollow.prototype.at = function(t){
    if (this.path.at) return this.path.at(t);
    if (this.path.samples) return this.path.samples(2)[0];
    return {x:0,y:0};
  };
  var pathFollow = {
    create: function(path, duration, loop){ return new PathFollow(path, duration, loop); }
  };

  /* ================= Light (basit 2D isik) ================= */
  var light = {
    // isik kaynagindan N yon icin ray at
    cast: function(x, y, radius, shapes, count){
      count = count || 16;
      var out = [];
      for (var i=0;i<count;i++){
        var a = (i / count) * PI2;
        var dx = Math.cos(a), dy = Math.sin(a);
        var hit = raycast.ray(x, y, dx * radius, dy * radius, shapes);
        var dist = hit ? hit.distance : radius;
        out.push({
          angle: a,
          point: {x: x + dx * dist, y: y + dy * dist},
          distance: dist
        });
      }
      return out;
    }
  };

  /* ================= Wind ================= */
  function WindField(px, py, wx, wy, radius) {
    this.px = px; this.py = py;
    this.wx = wx; this.wy = wy;
    this.radius = radius;
  }
  WindField.prototype.applyTo = function(b){
    var dx = b.x - this.px, dy = b.y - this.py;
    var d2 = dx*dx + dy*dy;
    var r2 = this.radius * this.radius;
    if (d2 > r2) return;
    var falloff = 1 - d2 / r2;
    b.fx += this.wx * falloff;
    b.fy += this.wy * falloff;
  };
  var wind = {
    create: function(px, py, wx, wy, radius){ return new WindField(px, py, wx, wy, radius); }
  };

  /* ================= Explosion ================= */
  var explosion = {
    apply: function(bodies, px, py, force, radius){
      var r2 = radius * radius;
      for (var i=0;i<bodies.length;i++){
        var b = bodies[i];
        if (b.isStatic) continue;
        var dx = b.x - px, dy = b.y - py;
        var d2 = dx*dx + dy*dy;
        if (d2 > r2) continue;
        var d = Math.sqrt(d2) || 1e-9;
        var mag = force * (1 - d2 / r2);
        b.vx += (dx / d) * mag;
        b.vy += (dy / d) * mag;
      }
      return bodies;
    }
  };


  /* ============================================================
   * ============ phy3 - 3D EXTENSION ===========================
   * ============================================================ */
  var phy3 = {};

  /* ---------- 3D Vector ---------- */
  phy3.v = {
    add: function(a,b){
      return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z};
    },
    sub: function(a,b){
      return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z};
    },
    mul: function(a,s){
      return {x:a.x*s, y:a.y*s, z:a.z*s};
    },
    dot: function(a,b){
      return a.x*b.x + a.y*b.y + a.z*b.z;
    },
    cross: function(a,b){
      var ax=a.x, ay=a.y, az=a.z;
      var bx=b.x, by=b.y, bz=b.z;
      return {
        x: ay*bz - az*by,
        y: az*bx - ax*bz,
        z: ax*by - ay*bx
      };
    },
    len: function(a){
      var x=a.x, y=a.y, z=a.z;
      return Math.sqrt(x*x + y*y + z*z);
    },
    len2: function(a){
      var x=a.x, y=a.y, z=a.z;
      return x*x + y*y + z*z;
    },
    norm: function(a){
      var x=a.x, y=a.y, z=a.z;
      var l = Math.sqrt(x*x + y*y + z*z);
      if (l === 0) return {x:0, y:0, z:0};
      var inv = 1/l;
      return {x:x*inv, y:y*inv, z:z*inv};
    },
    dist: function(a,b){
      var dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    },
    dist2: function(a,b){
      var dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
      return dx*dx + dy*dy + dz*dz;
    },
    lerp: function(a,b,t){
      return {
        x: a.x + (b.x-a.x)*t,
        y: a.y + (b.y-a.y)*t,
        z: a.z + (b.z-a.z)*t
      };
    },
    neg: function(a){
      return {x:-a.x, y:-a.y, z:-a.z};
    },
    rotX: function(a, angle){
      var c = Math.cos(angle), s = Math.sin(angle);
      var y=a.y, z=a.z;
      return {x:a.x, y:y*c - z*s, z:y*s + z*c};
    },
    rotY: function(a, angle){
      var c = Math.cos(angle), s = Math.sin(angle);
      var x=a.x, z=a.z;
      return {x:x*c + z*s, y:a.y, z:-x*s + z*c};
    },
    rotZ: function(a, angle){
      var c = Math.cos(angle), s = Math.sin(angle);
      var x=a.x, y=a.y;
      return {x:x*c - y*s, y:x*s + y*c, z:a.z};
    }
  };

  /* ---------- Quaternion ---------- */
  phy3.quat = {
    identity: function(){ return {x:0, y:0, z:0, w:1}; },
    fromAxisAngle: function(axis, angle){
      var h = angle * 0.5;
      var s = Math.sin(h);
      var ax=axis.x, ay=axis.y, az=axis.z;
      var len = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
      var inv = s / len;
      return {
        x: ax * inv,
        y: ay * inv,
        z: az * inv,
        w: Math.cos(h)
      };
    },
    mul: function(a, b){
      var aw=a.w, ax=a.x, ay=a.y, az=a.z;
      var bw=b.w, bx=b.x, by=b.y, bz=b.z;
      return {
        w: aw*bw - ax*bx - ay*by - az*bz,
        x: aw*bx + ax*bw + ay*bz - az*by,
        y: aw*by - ax*bz + ay*bw + az*bx,
        z: aw*bz + ax*by - ay*bx + az*bw
      };
    },
    conjugate: function(q){
      return {x:-q.x, y:-q.y, z:-q.z, w:q.w};
    },
    norm: function(q){
      var x=q.x, y=q.y, z=q.z, w=q.w;
      var l = Math.sqrt(x*x + y*y + z*z + w*w) || 1;
      var inv = 1/l;
      return {x:x*inv, y:y*inv, z:z*inv, w:w*inv};
    },
    rotate: function(q, v){
      var qx=q.x, qy=q.y, qz=q.z, qw=q.w;
      var vx=v.x, vy=v.y, vz=v.z;
      // t = q * (v, 0)
      var tw = -qx*vx - qy*vy - qz*vz;
      var tx = qw*vx + qy*vz - qz*vy;
      var ty = qw*vy + qz*vx - qx*vz;
      var tz = qw*vz + qx*vy - qy*vx;
      // result = t * q_conjugate
      var cx=-qx, cy=-qy, cz=-qz, cw=qw;
      return {
        x: tw*cx + tx*cw + ty*cz - tz*cy,
        y: tw*cy - tx*cz + ty*cw + tz*cx,
        z: tw*cz + tx*cy - ty*cx + tz*cw
      };
    }
  };

  /* ---------- Matrix3 ---------- */
  phy3.mat3 = {
    identity: function(){ return {m:[1,0,0, 0,1,0, 0,0,1]}; },
    fromQuat: function(q){
      var x=q.x, y=q.y, z=q.z, w=q.w;
      var xx=x*x, yy=y*y, zz=z*z;
      var xy=x*y, xz=x*z, yz=y*z;
      var wx=w*x, wy=w*y, wz=w*z;
      return {m:[
        1-2*(yy+zz), 2*(xy-wz), 2*(xz+wy),
        2*(xy+wz), 1-2*(xx+zz), 2*(yz-wx),
        2*(xz-wy), 2*(yz+wx), 1-2*(xx+yy)
      ]};
    },
    mulVec: function(m, v){
      var a = m.m;
      return {
        x: a[0]*v.x + a[1]*v.y + a[2]*v.z,
        y: a[3]*v.x + a[4]*v.y + a[5]*v.z,
        z: a[6]*v.x + a[7]*v.y + a[8]*v.z
      };
    },
    transpose: function(m){
      var a = m.m;
      return {m:[a[0],a[3],a[6], a[1],a[4],a[7], a[2],a[5],a[8]]};
    }
  };

  /* ---------- Body3D ---------- */
  function Body3(opts){
    if (opts === undefined){
      this.x = 0; this.y = 0; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.fx = 0; this.fy = 0; this.fz = 0;
      this.mass = 1;
      this.isStatic = false;
      this.restitution = 0.8;
      this.type = "sphere";
      this.r = 0; this.w = 0; this.h = 0; this.d = 0; this.len = 0;
      this.quat = phy3.quat.identity();
      this.angularVel = {x:0, y:0, z:0};
      this.torque = {x:0, y:0, z:0};
      this.inertia = 1;
      return;
    }
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.z = opts.z || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.vz = opts.vz || 0;
    this.fx = 0; this.fy = 0; this.fz = 0;
    this.mass = opts.mass == null ? 1 : opts.mass;
    this.isStatic = !!opts.static;
    this.restitution = opts.restitution == null ? 0.8 : opts.restitution;
    this.type = opts.type || "sphere";
    this.r = opts.r || 0;
    this.w = opts.w || 0;
    this.h = opts.h || 0;
    this.d = opts.d || 0;
    this.len = opts.len || 0;
    this.quat = opts.quat || phy3.quat.identity();
    this.angularVel = opts.angularVel || {x:0, y:0, z:0};
    this.torque = {x:0, y:0, z:0};
    this.inertia = opts.inertia == null ? 1 : opts.inertia;
  }
  Body3.prototype.applyForce = function(fx, fy, fz){
    if (!this.isStatic){ this.fx += fx; this.fy += fy; this.fz += fz; }
    return this;
  };
  Body3.prototype.applyImpulse = function(ix, iy, iz){
    if (this.isStatic) return this;
    var im = 1/this.mass;
    this.vx += ix*im; this.vy += iy*im; this.vz += iz*im;
    return this;
  };
  Body3.prototype.applyTorque = function(tx, ty, tz){
    if (!this.isStatic){ this.torque.x += tx; this.torque.y += ty; this.torque.z += tz; }
    return this;
  };
  Body3.prototype.integrate = function(dt){
    if (this.isStatic) return this;
    var im = 1/this.mass;
    var vx = this.vx + this.fx * im * dt;
    var vy = this.vy + this.fy * im * dt;
    var vz = this.vz + this.fz * im * dt;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.x += vx * dt;
    this.y += vy * dt;
    this.z += vz * dt;
    var w = this.angularVel;
    var wx=w.x, wy=w.y, wz=w.z;
    var ang2 = wx*wx + wy*wy + wz*wz;
    if (ang2 > 1e-18){
      var ang = Math.sqrt(ang2);
      var h = ang * dt * 0.5;
      var sh = Math.sin(h) / ang;
      var dqx = wx * sh, dqy = wy * sh, dqz = wz * sh, dqw = Math.cos(h);
      var qx=this.quat.x, qy=this.quat.y, qz=this.quat.z, qw=this.quat.w;
      var nw = qw*dqw - qx*dqx - qy*dqy - qz*dqz;
      var nx = qw*dqx + qx*dqw + qy*dqz - qz*dqy;
      var ny = qw*dqy - qx*dqz + qy*dqw + qz*dqx;
      var nz = qw*dqz + qx*dqy - qy*dqx + qz*dqw;
      var ql = Math.sqrt(nx*nx + ny*ny + nz*nz + nw*nw) || 1;
      var inv = 1/ql;
      this.quat.x = nx*inv; this.quat.y = ny*inv; this.quat.z = nz*inv; this.quat.w = nw*inv;
    }
    this.fx = 0; this.fy = 0; this.fz = 0;
    this.torque.x = 0; this.torque.y = 0; this.torque.z = 0;
    return this;
  };
  phy3.body3 = function(opts){ return new Body3(opts); };

  /* ---------- World3 ---------- */
  function World3(opts){
    opts = opts || {};
    this.gravity = opts.gravity || {x:0, y:-9.81, z:0};
    this.bodies = [];
    this.substeps = opts.substeps || 1;
  }
  World3.prototype.add = function(b){ this.bodies.push(b); return this; };
  World3.prototype.remove = function(b){
    var i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    return this;
  };
  World3.prototype.step = function(dt){
    var n = Math.max(1, this.substeps);
    var h = dt / n;
    var g = this.gravity;
    var bodies = this.bodies;
    var len = bodies.length;
    for (var s=0; s<n; s++){
      for (var i=0; i<len; i++){
        var b = bodies[i];
        if (b.isStatic) continue;
        b.fx += g.x * b.mass;
        b.fy += g.y * b.mass;
        b.fz += g.z * b.mass;
        // inline integrate
        var im = 1/b.mass;
        b.vx += b.fx * im * h;
        b.vy += b.fy * im * h;
        b.vz += b.fz * im * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.z += b.vz * h;
        b.fx = 0; b.fy = 0; b.fz = 0;
      }
    }
    return this;
  };
  phy3.world3 = function(opts){ return new World3(opts); };

  /* ---------- 3D Collision ---------- */
  function sphereSphere(a, b){
    var dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
    var rr = a.r + b.r;
    var d2 = dx*dx + dy*dy + dz*dz;
    if (d2 > rr*rr) return null;
    var d = Math.sqrt(d2) || 1e-9;
    return { hit:true, normal:{x:dx/d, y:dy/d, z:dz/d}, depth: rr - d };
  }
  function aabbAabb3(a, b){
    var ahw=a.w/2, ahh=a.h/2, ahd=a.d/2;
    var bhw=b.w/2, bhh=b.h/2, bhd=b.d/2;
    var dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
    var ox = ahw+bhw-Math.abs(dx);
    var oy = ahh+bhh-Math.abs(dy);
    var oz = ahd+bhd-Math.abs(dz);
    if (ox <= 0 || oy <= 0 || oz <= 0) return null;
    var depth, nx=0, ny=0, nz=0;
    if (ox < oy && ox < oz){ depth=ox; nx=dx>0?1:-1; }
    else if (oy < oz){ depth=oy; ny=dy>0?1:-1; }
    else { depth=oz; nz=dz>0?1:-1; }
    return { hit:true, normal:{x:nx,y:ny,z:nz}, depth:depth };
  }
  function sphereAabb3(s, box){
    var hw=box.w/2, hh=box.h/2, hd=box.d/2;
    var rx = s.x - box.x, ry = s.y - box.y, rz = s.z - box.z;
    var cx = Math.max(-hw, Math.min(hw, rx));
    var cy = Math.max(-hh, Math.min(hh, ry));
    var cz = Math.max(-hd, Math.min(hd, rz));
    var dx = rx-cx, dy = ry-cy, dz = rz-cz;
    var d2 = dx*dx+dy*dy+dz*dz;
    if (d2 > s.r*s.r) return null;
    var d = Math.sqrt(d2);
    if (d > 1e-9) return { hit:true, normal:{x:-dx/d, y:-dy/d, z:-dz/d}, depth: s.r-d };
    var pen = {
      x: hw + s.r - Math.abs(rx),
      y: hh + s.r - Math.abs(ry),
      z: hd + s.r - Math.abs(rz)
    };
    if (pen.x < pen.y && pen.x < pen.z) return { hit:true, normal:{x:rx>0?-1:1,y:0,z:0}, depth:pen.x };
    if (pen.y < pen.z) return { hit:true, normal:{x:0,y:ry>0?-1:1,z:0}, depth:pen.y };
    return { hit:true, normal:{x:0,y:0,z:rz>0?-1:1}, depth:pen.z };
  }
  function closestSegSeg3(p1, q1, p2, q2){
    var d1 = phy3.v.sub(q1, p1);
    var d2 = phy3.v.sub(q2, p2);
    var r = phy3.v.sub(p1, p2);
    var a = phy3.v.dot(d1, d1);
    var e = phy3.v.dot(d2, d2);
    var f = phy3.v.dot(d2, r);
    var s, t;
    if (a <= 1e-9 && e <= 1e-9){ s=0; t=0; }
    else if (a <= 1e-9){ s=0; t=Math.max(0, Math.min(1, f/e)); }
    else {
      var c = phy3.v.dot(d1, r);
      if (e <= 1e-9){ t=0; s=Math.max(0, Math.min(1, -c/a)); }
      else {
        var b = phy3.v.dot(d1, d2);
        var denom = a*e - b*b;
        if (denom !== 0) s = Math.max(0, Math.min(1, (b*f - c*e)/denom));
        else s = 0;
        t = (b*s + f) / e;
        if (t < 0){ t=0; s=Math.max(0, Math.min(1, -c/a)); }
        else if (t > 1){ t=1; s=Math.max(0, Math.min(1, (b-c)/a)); }
      }
    }
    return {
      pa: {x:p1.x+d1.x*s, y:p1.y+d1.y*s, z:p1.z+d1.z*s},
      pb: {x:p2.x+d2.x*t, y:p2.y+d2.y*t, z:p2.z+d2.z*t}
    };
  }
  function capsuleCapsule3(a, b){
    var aAxis = phy3.quat.rotate(a.quat, {x:0, y:1, z:0});
    var bAxis = phy3.quat.rotate(b.quat, {x:0, y:1, z:0});
    var aHalf = {x:aAxis.x*a.len/2, y:aAxis.y*a.len/2, z:aAxis.z*a.len/2};
    var bHalf = {x:bAxis.x*b.len/2, y:bAxis.y*b.len/2, z:bAxis.z*b.len/2};
    var aP1 = {x:a.x+aHalf.x, y:a.y+aHalf.y, z:a.z+aHalf.z};
    var aP2 = {x:a.x-aHalf.x, y:a.y-aHalf.y, z:a.z-aHalf.z};
    var bP1 = {x:b.x+bHalf.x, y:b.y+bHalf.y, z:b.z+bHalf.z};
    var bP2 = {x:b.x-bHalf.x, y:b.y-bHalf.y, z:b.z-bHalf.z};
    var closest = closestSegSeg3(aP1, aP2, bP1, bP2);
    var dx = closest.pb.x - closest.pa.x;
    var dy = closest.pb.y - closest.pa.y;
    var dz = closest.pb.z - closest.pa.z;
    var d2 = dx*dx + dy*dy + dz*dz;
    var rr = a.r + b.r;
    if (d2 > rr*rr) return null;
    var d = Math.sqrt(d2) || 1e-9;
    return { hit:true, normal:{x:dx/d, y:dy/d, z:dz/d}, depth: rr - d };
  }
  phy3.collide3 = {
    sphereSphere: sphereSphere,
    aabbAabb: aabbAabb3,
    sphereAabb: sphereAabb3,
    capsuleCapsule: capsuleCapsule3,
    detect: function(a, b){
      var ta = a.type, tb = b.type;
      if (ta === "sphere"){
        if (tb === "sphere") return sphereSphere(a, b);
        if (tb === "aabb") return sphereAabb3(a, b);
      } else if (ta === "aabb"){
        if (tb === "aabb") return aabbAabb3(a, b);
        if (tb === "sphere") return sphereAabb3(b, a);
      } else if (ta === "capsule" && tb === "capsule"){
        return capsuleCapsule3(a, b);
      }
      return null;
    },
    overlap: function(a, b){ return phy3.collide3.detect(a, b) !== null; }
  };

  /* ---------- Contact3 ---------- */
  phy3.contact3 = {
    manifold: function(a, b){
      var ta = a.type, tb = b.type;
      var det = null;
      if (ta === "sphere"){
        if (tb === "sphere"){
          var dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
          var rr = a.r + b.r;
          var d2 = dx*dx + dy*dy + dz*dz;
          if (d2 <= rr*rr){
            var d = Math.sqrt(d2) || 1e-9;
            det = { normal:{x:dx/d, y:dy/d, z:dz/d}, depth: rr - d };
          }
        } else if (tb === "aabb"){
          det = sphereAabb3(a, b);
        }
      } else if (ta === "aabb"){
        if (tb === "aabb"){
          var ahw=a.w/2, ahh=a.h/2, ahd=a.d/2;
          var bhw=b.w/2, bhh=b.h/2, bhd=b.d/2;
          var dx2=b.x-a.x, dy2=b.y-a.y, dz2=b.z-a.z;
          var ox = ahw+bhw-Math.abs(dx2);
          if (ox <= 0) return null;
          var oy = ahh+bhh-Math.abs(dy2);
          if (oy <= 0) return null;
          var oz = ahd+bhd-Math.abs(dz2);
          if (oz <= 0) return null;
          var depth, nx=0, ny=0, nz=0;
          if (ox < oy && ox < oz){ depth=ox; nx=dx2>0?1:-1; }
          else if (oy < oz){ depth=oy; ny=dy2>0?1:-1; }
          else { depth=oz; nz=dz2>0?1:-1; }
          det = { normal:{x:nx,y:ny,z:nz}, depth:depth };
        } else if (tb === "sphere"){
          det = sphereAabb3(b, a);
        }
      } else if (ta === "capsule" && tb === "capsule"){
        det = capsuleCapsule3(a, b);
      }
      if (!det) return null;
      return { a:a, b:b, normal:det.normal, depth:det.depth };
    }
  };

  /* ---------- Solver3 ---------- */
  phy3.solver3 = {
    solveManifold: function(m, opts){
      opts = opts || {};
      var iters = opts.iterations || 8;
      var baumgarte = opts.baumgarte || 0.2;
      var slop = opts.slop || 0.01;
      var a = m.a, b = m.b;
      var aStatic = a.isStatic, bStatic = b.isStatic;
      if (aStatic && bStatic) return;
      var invA = aStatic ? 0 : 1/a.mass;
      var invB = bStatic ? 0 : 1/b.mass;
      var invSum = invA + invB;
      if (invSum === 0) return;
      var n = m.normal;
      var nx = n.x, ny = n.y, nz = n.z;
      var ea = a.restitution, eb = b.restitution;
      var e = ea < eb ? ea : eb;
      var avx=a.vx, avy=a.vy, avz=a.vz;
      var bvx=b.vx, bvy=b.vy, bvz=b.vz;
      // erken cikis: uzaklasiyor
      var vn0 = (bvx-avx)*nx + (bvy-avy)*ny + (bvz-avz)*nz;
      if (vn0 > 0) return;
      // konum duzeltme
      var corr = m.depth - slop;
      if (corr > 0){
        corr *= baumgarte / invSum;
        var cx = nx*corr, cy = ny*corr, cz = nz*corr;
        if (!aStatic){ a.x -= cx*invA; a.y -= cy*invA; a.z -= cz*invA; }
        if (!bStatic){ b.x += cx*invB; b.y += cy*invB; b.z += cz*invB; }
      }
      // hiz cozumu (iterasyon)
      for (var it=0; it<iters; it++){
        var rvx = bvx - avx;
        var rvy = bvy - avy;
        var rvz = bvz - avz;
        var vn = rvx*nx + rvy*ny + rvz*nz;
        if (vn > 0) break;
        var j = -(1 + e) * vn / invSum;
        var ix = j*nx, iy = j*ny, iz = j*nz;
        if (!aStatic){ avx -= ix*invA; avy -= iy*invA; avz -= iz*invA; }
        if (!bStatic){ bvx += ix*invB; bvy += iy*invB; bvz += iz*invB; }
      }
      a.vx = avx; a.vy = avy; a.vz = avz;
      b.vx = bvx; b.vy = bvy; b.vz = bvz;
    },
    solve: function(manifolds, opts){
      for (var i=0; i<manifolds.length; i++){
        if (manifolds[i]) phy3.solver3.solveManifold(manifolds[i], opts);
      }
    }
  };

  /* ---------- Sim3 ---------- */
  function Sim3(opts){
    opts = opts || {};
    this.gravity = opts.gravity || {x:0, y:-9.81, z:0};
    this.bodies = [];
    this.iterations = opts.iterations || 8;
    this.baumgarte = opts.baumgarte || 0.2;
    this.slop = opts.slop || 0.01;
    this.stats = {steps:0, contacts:0, totalTime:0};
  }
  Sim3.prototype.add = function(b){ this.bodies.push(b); return this; };
  Sim3.prototype.remove = function(b){
    var i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i,1);
    return this;
  };
  Sim3.prototype.step = function(dt){
    var g = this.gravity;
    var n = this.bodies.length;
    for (var i=0; i<n; i++){
      var b = this.bodies[i];
      if (b.isStatic) continue;
      b.fx += g.x * b.mass;
      b.fy += g.y * b.mass;
      b.fz += g.z * b.mass;
    }
    var manifolds = [];
    for (var p=0; p<n; p++){
      for (var q=p+1; q<n; q++){
        var m = phy3.contact3.manifold(this.bodies[p], this.bodies[q]);
        if (m) manifolds.push(m);
      }
    }
    this.stats.contacts = manifolds.length;
    phy3.solver3.solve(manifolds, {
      iterations: this.iterations,
      baumgarte: this.baumgarte,
      slop: this.slop
    });
    for (var k=0; k<n; k++){
      this.bodies[k].integrate(dt);
    }
    this.stats.steps++;
    this.stats.totalTime += dt;
    return this;
  };
  phy3.sim3 = function(opts){ return new Sim3(opts); };

  /* ---------- Raycast3 ---------- */
  phy3.raycast3 = {
    ray: function(ox, oy, oz, dx, dy, dz, shapes){
      var best = null;
      var len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len === 0) return null;
      var invLen = 1/len;
      var nx = dx*invLen, ny = dy*invLen, nz = dz*invLen;
      var n = shapes.length;
      for (var i=0; i<n; i++){
        var s = shapes[i];
        var t = -1;
        if (s.type === "sphere"){
          var ocx = ox-s.x, ocy = oy-s.y, ocz = oz-s.z;
          var b2 = ocx*nx + ocy*ny + ocz*nz;
          var c = ocx*ocx + ocy*ocy + ocz*ocz - s.r*s.r;
          var disc = b2*b2 - c;
          if (disc >= 0){
            var sq = Math.sqrt(disc);
            var t1 = -b2 - sq;
            var t2 = -b2 + sq;
            t = t1 > 0 ? t1 : (t2 > 0 ? t2 : -1);
          }
        } else if (s.type === "aabb"){
          var hw=s.w/2, hh=s.h/2, hd=s.d/2;
          var minX=s.x-hw, maxX=s.x+hw;
          var minY=s.y-hh, maxY=s.y+hh;
          var minZ=s.z-hd, maxZ=s.z+hd;
          var tmin = -1e30, tmax = 1e30;
          if (nx > 1e-9 || nx < -1e-9){
            var t1x = (minX-ox)/nx, t2x = (maxX-ox)/nx;
            var tA = t1x < t2x ? t1x : t2x;
            var tB = t1x < t2x ? t2x : t1x;
            if (tA > tmin) tmin = tA;
            if (tB < tmax) tmax = tB;
          } else if (ox < minX || ox > maxX) continue;
          if (ny > 1e-9 || ny < -1e-9){
            var t1y = (minY-oy)/ny, t2y = (maxY-oy)/ny;
            var tAy = t1y < t2y ? t1y : t2y;
            var tBy = t1y < t2y ? t2y : t1y;
            if (tAy > tmin) tmin = tAy;
            if (tBy < tmax) tmax = tBy;
          } else if (oy < minY || oy > maxY) continue;
          if (nz > 1e-9 || nz < -1e-9){
            var t1z = (minZ-oz)/nz, t2z = (maxZ-oz)/nz;
            var tAz = t1z < t2z ? t1z : t2z;
            var tBz = t1z < t2z ? t2z : t1z;
            if (tAz > tmin) tmin = tAz;
            if (tBz < tmax) tmax = tBz;
          } else if (oz < minZ || oz > maxZ) continue;
          if (tmax < 0 || tmin > tmax) continue;
          t = tmin > 0 ? tmin : tmax;
        }
        if (t > 0 && (best === null || t < best.t)){
          best = {
            hit: s,
            t: t,
            point: {x:ox+nx*t, y:oy+ny*t, z:oz+nz*t},
            distance: t
          };
        }
      }
      return best;
    }
  };/* ================= phy ================= */
  var phy = {
    v: v, motion: motion, fall: fall, push: push, energy: energy,
    crash: crash, spin: spin, grav: grav, swing: swing,
    step: step, hit: hit,
    projectile: projectile, damped: damped, field: field,
    body: body, world: world, collide: collide,
    constraint: constraint, trajectory: trajectory,
    shape: shape, rigid: rigid, contact: contact, solver: solver,
    raycast: raycast, quadtree: quadtree, forceField: forceField, sim: sim,
    friction: friction, joint: joint, motor: motor, sleeping: sleeping,
    capsule: capsule, polygon: polygon, sat: sat, fracture: fracture,
    broadphase: broadphase, sim2d: sim2d, debug: debug,
    spatialHash: spatialHash, particles: particles,
    bezier: bezier, curve: curve, pathFollow: pathFollow,
    light: light, wind: wind, explosion: explosion,
    character: character, trigger: trigger, layers: layers,
    rope: rope, spring2d: spring2d, tilemap: tilemap,
    destructible: destructible, render: render,
    phy3: phy3,
    rnd: rnd,
    version: VERSION, codename: CODENAME
  };

  
  /* ============================================================
   * ============ 2.2.0 - 3D EXTENDED MODULES ==================
   * ============================================================ */

  /* ---------- 3D Friction ---------- */
  phy3.friction = {
    maxStatic: function(muS, N){ return muS * N; },
    kinetic: function(muK, N){ return muK * N; },
    applyToBody: function(b, muK, normalForce, dirX, dirY, dirZ){
      if (b.isStatic) return b;
      var len = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ);
      if (len === 0) return b;
      var mag = muK * normalForce / len;
      b.fx -= mag * dirX;
      b.fy -= mag * dirY;
      b.fz -= mag * dirZ;
      return b;
    },
    applyNormal: function(b, muK, N, normalX, normalY, normalZ){
      if (b.isStatic) return b;
      var vn = b.vx*normalX + b.vy*normalY + b.vz*normalZ;
      var tx = b.vx - vn*normalX;
      var ty = b.vy - vn*normalY;
      var tz = b.vz - vn*normalZ;
      var tlen = Math.sqrt(tx*tx + ty*ty + tz*tz);
      if (tlen < 1e-6) return b;
      var mag = muK * N / tlen;
      b.fx -= mag * tx;
      b.fy -= mag * ty;
      b.fz -= mag * tz;
      return b;
    }
  };

  /* ---------- 3D Constraint ---------- */
  function Spring3(a, b, opts){
    opts = opts || {};
    this.a = a; this.b = b;
    this.k = opts.k == null ? 100 : opts.k;
    this.damping = opts.damping == null ? 0 : opts.damping;
    this.restLength = opts.restLength == null ? 1 : opts.restLength;
  }
  Spring3.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (dist === 0) return this;
    var inv = 1/dist;
    var nx = dx*inv, ny = dy*inv, nz = dz*inv;
    var F = this.k * (dist - this.restLength);
    var vn = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny + (b.vz - a.vz)*nz;
    F += this.damping * vn;
    var fx = F*nx, fy = F*ny, fz = F*nz;
    if (!a.isStatic){ a.fx += fx; a.fy += fy; a.fz += fz; }
    if (!b.isStatic){ b.fx -= fx; b.fy -= fy; b.fz -= fz; }
    return this;
  };

  function Distance3(a, b, opts){
    opts = opts || {};
    this.a = a; this.b = b;
    this.length = opts.length == null ? 1 : opts.length;
    this.stiffness = opts.stiffness == null ? 1 : opts.stiffness;
  }
  Distance3.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (dist === 0) return this;
    var diff = (dist - this.length) / dist * 0.5 * this.stiffness;
    var ox = dx*diff, oy = dy*diff, oz = dz*diff;
    if (!a.isStatic){ a.x += ox; a.y += oy; a.z += oz; }
    if (!b.isStatic){ b.x -= ox; b.y -= oy; b.z -= oz; }
    return this;
  };

  function Pin3(a, px, py, pz){
    this.a = a; this.px = px; this.py = py; this.pz = pz;
  }
  Pin3.prototype.apply = function(){
    if (this.a.isStatic) return this;
    this.a.x = this.px;
    this.a.y = this.py;
    this.a.z = this.pz;
    this.a.vx = 0; this.a.vy = 0; this.a.vz = 0;
    return this;
  };

  phy3.constraint3 = {
    spring: function(a,b,opts){ return new Spring3(a,b,opts); },
    distance: function(a,b,opts){ return new Distance3(a,b,opts); },
    pin: function(a,px,py,pz){ return new Pin3(a,px,py,pz); }
  };

  /* ---------- 3D Joint ---------- */
  function BallJoint(a, b, px, py, pz){
    this.a = a; this.b = b;
    this.px = px; this.py = py; this.pz = pz;
  }
  BallJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    var dx = (a.x + b.x) * 0.5 - this.px;
    var dy = (a.y + b.y) * 0.5 - this.py;
    var dz = (a.z + b.z) * 0.5 - this.pz;
    if (!a.isStatic){ a.x -= dx; a.y -= dy; a.z -= dz; }
    if (!b.isStatic){ b.x -= dx; b.y -= dy; b.z -= dz; }
    return this;
  };

  function HingeJoint(a, b, axisX, axisY, axisZ){
    this.a = a; this.b = b;
    var alen = Math.sqrt(axisX*axisX + axisY*axisY + axisZ*axisZ) || 1;
    this.ax = axisX/alen; this.ay = axisY/alen; this.az = axisZ/alen;
    this.ox = b.x - a.x;
    this.oy = b.y - a.y;
    this.oz = b.z - a.z;
    var proj = this.ox*this.ax + this.oy*this.ay + this.oz*this.az;
    this.px = this.ox - proj*this.ax;
    this.py = this.oy - proj*this.ay;
    this.pz = this.oz - proj*this.az;
  }
  HingeJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    if (b.isStatic) return this;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dz = b.z - a.z;
    var proj = dx*this.ax + dy*this.ay + dz*this.az;
    b.x = a.x + proj*this.ax + this.px;
    b.y = a.y + proj*this.ay + this.py;
    b.z = a.z + proj*this.az + this.pz;
    return this;
  };

  function SliderJoint(a, b, axisX, axisY, axisZ, min, max){
    this.a = a; this.b = b;
    var alen = Math.sqrt(axisX*axisX + axisY*axisY + axisZ*axisZ) || 1;
    this.ax = axisX/alen; this.ay = axisY/alen; this.az = axisZ/alen;
    this.min = min == null ? -Infinity : min;
    this.max = max == null ? Infinity : max;
  }
  SliderJoint.prototype.apply = function(){
    var a = this.a, b = this.b;
    if (b.isStatic) return this;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dz = b.z - a.z;
    var proj = dx*this.ax + dy*this.ay + dz*this.az;
    if (proj < this.min) proj = this.min;
    if (proj > this.max) proj = this.max;
    b.x = a.x + this.ax*proj;
    b.y = a.y + this.ay*proj;
    b.z = a.z + this.az*proj;
    return this;
  };

  phy3.joint3 = {
    ball: function(a,b,px,py,pz){ return new BallJoint(a,b,px,py,pz); },
    hinge: function(a,b,ax,ay,az){ return new HingeJoint(a,b,ax,ay,az); },
    slider: function(a,b,ax,ay,az,min,max){ return new SliderJoint(a,b,ax,ay,az,min,max); }
  };

  /* ---------- Capsule Collision ---------- */
  function capsuleSphere3(cap, sph){
    var capAxis = phy3.quat.rotate(cap.quat, {x:0, y:1, z:0});
    var half = cap.len/2;
    var p1x = cap.x + capAxis.x*half, p1y = cap.y + capAxis.y*half, p1z = cap.z + capAxis.z*half;
    var p2x = cap.x - capAxis.x*half, p2y = cap.y - capAxis.y*half, p2z = cap.z - capAxis.z*half;
    var d1x = p2x-p1x, d1y = p2y-p1y, d1z = p2z-p1z;
    var r1x = sph.x-p1x, r1y = sph.y-p1y, r1z = sph.z-p1z;
    var a = d1x*d1x + d1y*d1y + d1z*d1z;
    var t = a > 1e-9 ? (r1x*d1x + r1y*d1y + r1z*d1z)/a : 0;
    if (t < 0) t = 0; if (t > 1) t = 1;
    var cx = p1x + d1x*t, cy = p1y + d1y*t, cz = p1z + d1z*t;
    var dx = sph.x-cx, dy = sph.y-cy, dz = sph.z-cz;
    var rr = cap.r + sph.r;
    var d2 = dx*dx + dy*dy + dz*dz;
    if (d2 > rr*rr) return null;
    var d = Math.sqrt(d2) || 1e-9;
    return { normal:{x:dx/d, y:dy/d, z:dz/d}, depth: rr - d };
  }

  function capsuleAabb3(cap, box){
    var capAxis = phy3.quat.rotate(cap.quat, {x:0, y:1, z:0});
    var half = cap.len/2;
    var p1x = cap.x + capAxis.x*half, p1y = cap.y + capAxis.y*half, p1z = cap.z + capAxis.z*half;
    var p2x = cap.x - capAxis.x*half, p2y = cap.y - capAxis.y*half, p2z = cap.z - capAxis.z*half;
    var hw = box.w/2, hh = box.h/2, hd = box.d/2;
    var bx = box.x, by = box.y, bz = box.z;
    // p1 icin en yakin
    var r1x = Math.max(-hw, Math.min(hw, p1x - bx));
    var r1y = Math.max(-hh, Math.min(hh, p1y - by));
    var r1z = Math.max(-hd, Math.min(hd, p1z - bz));
    var c1x = bx + r1x, c1y = by + r1y, c1z = bz + r1z;
    var d1x = p1x-c1x, d1y = p1y-c1y, d1z = p1z-c1z;
    var d1 = Math.sqrt(d1x*d1x + d1y*d1y + d1z*d1z);
    // p2 icin en yakin
    var r2x = Math.max(-hw, Math.min(hw, p2x - bx));
    var r2y = Math.max(-hh, Math.min(hh, p2y - by));
    var r2z = Math.max(-hd, Math.min(hd, p2z - bz));
    var c2x = bx + r2x, c2y = by + r2y, c2z = bz + r2z;
    var d2x = p2x-c2x, d2y = p2y-c2y, d2z = p2z-c2z;
    var d2 = Math.sqrt(d2x*d2x + d2y*d2y + d2z*d2z);
    var px, py, pz, cx, cy, cz, dd;
    if (d1 < d2){ px=p1x; py=p1y; pz=p1z; cx=c1x; cy=c1y; cz=c1z; dd=d1; }
    else { px=p2x; py=p2y; pz=p2z; cx=c2x; cy=c2y; cz=c2z; dd=d2; }
    if (dd > cap.r) return null;
    if (dd > 1e-9){
      var inv = 1/dd;
      return {
        normal: {x:(px-cx)*inv, y:(py-cy)*inv, z:(pz-cz)*inv},
        depth: cap.r - dd
      };
    }
    var penX = hw - Math.abs(cx - bx) + cap.r;
    var penY = hh - Math.abs(cy - by) + cap.r;
    var penZ = hd - Math.abs(cz - bz) + cap.r;
    if (penX < penY && penX < penZ){
      return { normal:{x:(px>bx?1:-1), y:0, z:0}, depth: penX };
    } else if (penY < penZ){
      return { normal:{x:0, y:(py>by?1:-1), z:0}, depth: penY };
    } else {
      return { normal:{x:0, y:0, z:(pz>bz?1:-1)}, depth: penZ };
    }
  }

  // collide3.detect'e capsule-sphere ve capsule-aabb ekle
  var origDetect = phy3.collide3.detect;
  phy3.collide3.detect = function(a, b){
    var ta = a.type, tb = b.type;
    if (ta === "capsule" && tb === "sphere") return capsuleSphere3(a, b);
    if (ta === "sphere" && tb === "capsule") return capsuleSphere3(b, a);
    if (ta === "capsule" && tb === "aabb") return capsuleAabb3(a, b);
    if (ta === "aabb" && tb === "capsule") return capsuleAabb3(b, a);
    return origDetect(a, b);
  };
  phy3.collide3.capsuleSphere = capsuleSphere3;
  phy3.collide3.capsuleAabb = capsuleAabb3;

  /* ---------- 3D Trigger ---------- */
  function Trigger3(shape, opts){
    opts = opts || {};
    this.shape = shape;
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.z = opts.z || 0;
    this.r = opts.r || 0;
    this.w = opts.w || 0;
    this.h = opts.h || 0;
    this.d = opts.d || 0;
    this.onEnter = opts.onEnter || null;
    this.onStay = opts.onStay || null;
    this.onExit = opts.onExit || null;
    this._inside = {};
  }
  Trigger3.prototype.test = function(b){
    if (this.shape === "sphere"){
      var dx = b.x - this.x, dy = b.y - this.y, dz = b.z - this.z;
      var r = this.r + (b.r || 0);
      return dx*dx + dy*dy + dz*dz <= r*r;
    }
    var br = b.r || 0;
    if (b.type === "aabb"){
      var ahw=this.w/2, ahh=this.h/2, ahd=this.d/2;
      var bhw=b.w/2, bhh=b.h/2, bhd=b.d/2;
      return Math.abs(b.x-this.x) <= ahw+bhw &&
             Math.abs(b.y-this.y) <= ahh+bhh &&
             Math.abs(b.z-this.z) <= ahd+bhd;
    }
    var hw=this.w/2, hh=this.h/2, hd=this.d/2;
    var cx = Math.max(-hw, Math.min(hw, b.x - this.x));
    var cy = Math.max(-hh, Math.min(hh, b.y - this.y));
    var cz = Math.max(-hd, Math.min(hd, b.z - this.z));
    var ddx = b.x - (this.x + cx);
    var ddy = b.y - (this.y + cy);
    var ddz = b.z - (this.z + cz);
    return ddx*ddx + ddy*ddy + ddz*ddz <= br*br;
  };
  Trigger3.prototype.update = function(bodies){
    for (var i=0; i<bodies.length; i++){
      var b = bodies[i];
      var inside = this.test(b);
      var was = this._inside[b];
      if (inside && !was){
        this._inside[b] = true;
        if (this.onEnter) this.onEnter(b);
      } else if (inside && was){
        if (this.onStay) this.onStay(b);
      } else if (!inside && was){
        delete this._inside[b];
        if (this.onExit) this.onExit(b);
      }
    }
    return this;
  };
  phy3.trigger3 = function(shape, opts){ return new Trigger3(shape, opts); };

  /* ---------- 3D Spatial Hash ---------- */
  function SpatialHash3(cellSize){
    this.cellSize = cellSize || 64;
    this.cells = {};
    this.bodies = [];
  }
  SpatialHash3.prototype._key = function(cx, cy, cz){
    return cx + "," + cy + "," + cz;
  };
  SpatialHash3.prototype._range = function(b){
    var r = b.r || Math.max(b.w||0, b.h||0, b.d||0)/2;
    var cs = this.cellSize;
    return {
      x0: Math.floor((b.x-r)/cs), x1: Math.floor((b.x+r)/cs),
      y0: Math.floor((b.y-r)/cs), y1: Math.floor((b.y+r)/cs),
      z0: Math.floor((b.z-r)/cs), z1: Math.floor((b.z+r)/cs)
    };
  };
  SpatialHash3.prototype.add = function(b){
    this.bodies.push(b);
    var rng = this._range(b);
    for (var z=rng.z0; z<=rng.z1; z++){
      for (var y=rng.y0; y<=rng.y1; y++){
        for (var x=rng.x0; x<=rng.x1; x++){
          var k = this._key(x, y, z);
          if (!this.cells[k]) this.cells[k] = [];
          this.cells[k].push(b);
        }
      }
    }
    return this;
  };
  SpatialHash3.prototype.query = function(b){
    var rng = this._range(b);
    var seen = {};
    var out = [];
    for (var z=rng.z0; z<=rng.z1; z++){
      for (var y=rng.y0; y<=rng.y1; y++){
        for (var x=rng.x0; x<=rng.x1; x++){
          var cell = this.cells[this._key(x, y, z)];
          if (!cell) continue;
          for (var i=0; i<cell.length; i++){
            if (cell[i] === b) continue;
            var id = cell[i]._shid;
            if (!id) { id = rnd.next(); cell[i]._shid = id; }
            if (seen[id]) continue;
            seen[id] = true;
            out.push(cell[i]);
          }
        }
      }
    }
    return out;
  };
  SpatialHash3.prototype.clear = function(){
    this.cells = {};
    this.bodies = [];
    return this;
  };
  phy3.spatialHash3 = {
    create: function(cellSize){ return new SpatialHash3(cellSize); }
  };

  /* ---------- 3D Raycast: Capsule ---------- */
  phy3.raycast3.capsule = function(ox, oy, oz, dx, dy, dz, cap){
    var capAxis = phy3.quat.rotate(cap.quat, {x:0, y:1, z:0});
    var half = cap.len/2;
    var spheres = [
      {type:"sphere", x:cap.x + capAxis.x*half, y:cap.y + capAxis.y*half, z:cap.z + capAxis.z*half, r:cap.r},
      {type:"sphere", x:cap.x - capAxis.x*half, y:cap.y - capAxis.y*half, z:cap.z - capAxis.z*half, r:cap.r}
    ];
    return phy3.raycast3.ray(ox, oy, oz, dx, dy, dz, spheres);
  };

  /* ============================================================
   * ============ rnd - XORSHIFT128+ PRNG ======================
   * ============================================================ */
  
  var rnd = (function(){
    var _s0 = 0x12345678;
    var _s1 = 0x9ABCDEF0;
    
    function splitmix32(x) {
      x = (x + 0x9E3779B9) | 0;
      x = Math.imul(x ^ x >>> 16, 0x85EBCA6B);
      x = Math.imul(x ^ x >>> 13, 0xC2B2AE35);
      return (x ^ x >>> 16) >>> 0;
    }
    
    function next32() {
      var x = _s0, y = _s1;
      _s0 = y;
      x ^= x << 23;
      _s1 = x ^ y ^ (x >>> 17) ^ (y >>> 26);
      return (x + y) >>> 0;
    }
    
    var api = {
      seed: function(seed) {
        var s = seed >>> 0;
        _s0 = splitmix32(s);
        _s1 = splitmix32(_s0 ^ 0x9E3779B9);
        if (_s0 === 0 && _s1 === 0){ _s0 = 0x12345678; _s1 = 0x9ABCDEF0; }
        // ilk 10 turu at (warming)
        for (var i = 0; i < 10; i++) next32();
        return api;
      },
      next: function() {
        return next32() / 4294967296;
      },
      next32: next32,
      range: function(min, max) {
        return min + (next32() / 4294967296) * (max - min);
      },
      int: function(min, max) {
        return min + (next32() % (max - min + 1));
      },
      chance: function(p) {
        return (next32() / 4294967296) < p;
      },
      pick: function(arr) {
        return arr[next32() % arr.length];
      },
      shuffle: function(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = next32() % (i + 1);
          var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
      },
      gauss: function(mean, stddev) {
        mean = mean || 0;
        stddev = stddev || 1;
        var u1 = (next32() + 1) / 4294967297;
        var u2 = next32() / 4294967296;
        var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stddev;
      },
      angle: function() {
        return (next32() / 4294967296) * Math.PI * 2;
      },
      dir2: function() {
        var a = (next32() / 4294967296) * Math.PI * 2;
        return {x: Math.cos(a), y: Math.sin(a)};
      },
      dir3: function() {
        var z = 2 * (next32() / 4294967296) - 1;
        var a = 2 * Math.PI * (next32() / 4294967296);
        var r = Math.sqrt(1 - z*z);
        return {x: r * Math.cos(a), y: r * Math.sin(a), z: z};
      },
      state: function() {
        return {s0: _s0, s1: _s1};
      },
      restore: function(s0, s1) {
        _s0 = s0 >>> 0;
        _s1 = s1 >>> 0;
        return api;
      }
    };
    
    return api;
  })();

  // phy'ye de ekle (opsiyonel erisim)
  if (typeof global !== "undefined") {
    global.rnd = rnd;
  }
phy.phy3 = phy3;
  
  global.phy = phy;
  if (typeof module !== "undefined" && module.exports) module.exports = phy;
})(typeof window !== "undefined" ? window : globalThis);