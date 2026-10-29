# SG-PHY - API Reference

**Version:** 2.4.2  
**Codename:** Final  
**Size:** ~75 KB  
**Dependencies:** None

---

## Quick Start

```html
<script src="physics.js"></script>
<script>
  const b = phy.body({ x: 0, y: 10, r: 5 });
  b.applyImpulse(10, 0);
  b.integrate(0.016);

  const b3 = phy.phy3.body3({ x: 0, y: 10, z: 0, r: 5, type: "sphere" });
  b3.applyImpulse(10, 0, 0);
  b3.integrate(0.016);

  rnd.seed(42);
  console.log(rnd.next());
</script>
```

---

## 2D Core

### phy.v - Vector

```js
phy.v.add(a, b)        // {x, y, z}
phy.v.sub(a, b)
phy.v.mul(a, s)
phy.v.dot(a, b)        // number
phy.v.cross(a, b)      // {x, y, z}
phy.v.len(a)           // number
phy.v.norm(a)          // {x, y, z}
phy.v.dist(a, b)
phy.v.lerp(a, b, t)
phy.v.perp(a)
phy.v.rot(a, angle)
phy.v.neg(a)
```

Performance: `add` 12 ns, `dot` 21 ns, `len` 18 ns

### phy.motion - Kinematics

```js
phy.motion.v(x0, v0, a, t)   // v = v0 + a*t
phy.motion.x(x0, v0, a, t)   // x = x0 + v0*t + 0.5*a*t^2
phy.motion.v2(v0, a, dx)     // v^2 = v0^2 + 2*a*dx
phy.motion.t(v0, v, a)       // t = (v - v0)/a
```

### phy.fall / phy.push / phy.energy

```js
phy.fall(t).earth      // 0.5 * 9.81 * t^2
phy.fall(t).moon       // 0.5 * 1.62 * t^2
phy.fall(t).mars       // 0.5 * 3.71 * t^2

+phy.push(m, a)        // F = m*a
phy.push(m, a).fric(mu, N)
phy.push(m, a).spring(k, x)

phy.energy(m, v).ke    // 0.5*m*v^2
phy.energy(m, v).p     // m*v
phy.energy(m, v).pe(h) // m*g*h
```

### phy.crash / phy.spin / phy.grav

```js
phy.crash(m1, v1, m2, v2).elastic     // {v1, v2}
phy.crash(m1, v1, m2, v2).inelastic   // {v}

phy.spin(r, F).cw      // +r*F
phy.spin(r, F).ccw     // -r*F
phy.spin(m, r).ring    // m*r^2
phy.spin(m, r).disk    // 0.5*m*r^2
phy.spin(m, r).rod     // (1/12)*m*r^2

phy.grav(m1, m2, r)    // Newton
phy.grav(M, r).orb     // orbit velocity
phy.grav(M, r).esc     // escape velocity
```

### phy.projectile / phy.damped / phy.field

```js
const p = phy.projectile(v0, angleDeg);
p.range, p.maxH, p.time, p.at(t)

const d = phy.damped(k, c, m);
d.w0, d.zeta, d.wd, d.period, d.ampAt(t)

phy.field(M, x, y)    // {gx, gy, mag}
```

### phy.swing / phy.step

```js
phy.swing(k, m).T      // 2*PI*sqrt(m/k)
phy.swing(k, m).f
phy.swing(L).pend.T    // pendulum
phy.swing(L).pend.f

phy.step.euler(x, v, a, dt)      // {x, v}
phy.step.verlet(x, v, a, dt)
phy.step.eulerVec(x, v, a, dt)
phy.step.verletVec(x, v, a, dt)
phy.step.rk4(f, x, dt)
phy.step.rk4Vec(f, x, dt)
```

### phy.hit / phy.collide

```js
const h = phy.hit(a, b);
h.valueOf()     // true/false
h.det           // {hit, normal, depth}

phy.collide.aabb(a, b)
phy.collide.circle(a, b)
phy.collide.detect(a, b)
phy.collide.resolve(a, b, {restitution: 0.8})
```

### phy.body - Rigid Body

```js
const b = phy.body({
  x, y, vx, vy,
  mass: 1,
  restitution: 0.8,
  r: 0,       // circle
  w: 0, h: 0, // box
  static: false,
  angle: 0,
  angularVelocity: 0,
  inertia: 1,
  layer: 1,
  mask: -1,
  isSensor: false
});

b.applyForce(fx, fy)
b.applyImpulse(ix, iy)
b.applyTorque(t)
b.applyImpulseAt(ix, iy, px, py)
b.integrate(dt)
b.clearForces()
```

### phy.world / phy.constraint

```js
const w = phy.world({gravity: {x:0, y:-9.81}, substeps: 2});
w.add(b);
w.remove(b);
w.step(dt);
w.bodies;

phy.constraint.spring(a, b, {k: 100, damping: 0.5, restLength: 2}).apply();
phy.constraint.distance(a, b, {length: 5, stiffness: 1}).apply();
phy.constraint.pin(b, 100, 100).apply();
```

### phy.shape / phy.polygon / phy.capsule

```js
phy.shape.circle(5)
phy.shape.box(10, 5)
phy.shape.aabb(body)
phy.shape.area(shape)
phy.shape.contains(shape, px, py)

phy.polygon.box(10, 10)
phy.polygon.regular(6, 5)       // cached!
phy.polygon.create([{x,y},...])

phy.capsule.create(r, len, angle)
phy.capsule.fromPoints(x1, y1, x2, y2, r)
```

### phy.rigid / phy.contact / phy.solver

```js
phy.rigid({x, y, angle, angularVelocity, ...})

phy.contact.manifold(a, b)     // {a, b, normal, depth, points}

phy.solver.solveManifold(m, {iterations: 8, baumgarte: 0.2, slop: 0.01})
phy.solver.solve(manifolds, opts)
```

### phy.raycast / phy.quadtree

```js
phy.raycast.ray(ox, oy, dx, dy, shapes)
// {hit, t, point, normal, distance}

const qt = phy.quadtree.create(0, 0, 1000, 1000, 8);
qt.insert({x, y, w, h, body});
qt.query(0, 0, 100, 100);
```

### phy.sat / phy.fracture

```js
phy.sat.polyPoly(A, B)
phy.sat.aabbPoly(aabb, poly)
phy.sat.circPoly(cx, cy, r, poly)

phy.fracture.split(poly, ax, ay, bx, by)  // [Polygon]
```

### phy.sim / phy.sim2d

```js
const s = phy.sim({gravity, solverIterations: 8});
s.add(b);
s.remove(b);
s.step(dt);
s.stats;    // {steps, contacts, lastDt, totalTime}

const s2 = phy.sim2d({gravity, broadphase: true});
s2.add(b);
s2.addConstraint(c);
s2.step(dt);
```

---

## 2D Extended

### phy.friction / phy.joint / phy.motor / phy.sleeping

```js
phy.friction.maxStatic(muS, N)
phy.friction.kinetic(muK, N)
phy.friction.applyToBody(b, muK, N, dirX, dirY)

phy.joint.revolute(a, b, px, py).apply()
phy.joint.weld(a, b).apply()
phy.joint.prismatic(a, b, ax, ay, min, max).apply()

phy.motor(body, targetSpeed, maxTorque).apply(dt)

const s = phy.sleeping({timeThreshold: 0.5});
s.update(body, dt);
```

### phy.broadphase / phy.spatialHash

```js
const qt = phy.broadphase.build(bodies, x, y, w, h, maxItems);
phy.broadphase.queryBody(qt, body);

const sh = phy.spatialHash.create(64);
sh.add(b).add(b2);
sh.query(b);
sh.clear();
```

### phy.character / phy.trigger / phy.layers

```js
const c = phy.character({
  body, jumpSpeed: 10, maxJumps: 2,
  coyoteTime: 0.1, jumpBuffer: 0.1
});
c.update(dt, groundY);
c.jump();
c.grounded; c.jumpsLeft;

const t = phy.trigger("circle", {x, y, r, onEnter, onStay, onExit});
t.test(body);
t.update(bodies);

phy.layers.bit(n)
phy.layers.combine(...)
phy.layers.test(a, b)
```

### phy.rope / phy.spring2d / phy.tilemap

```js
phy.rope([b1, b2, b3], {length: 5}).apply();

const s = phy.spring2d.create(a, b, {k, damping, restLength});
s.apply();
s.points();    // 9 points for visual

const t = phy.tilemap.create(20, 15, 32);
t.set(2, 3, true);
t.get(2, 3);
t.solidAt(70, 100);
t.collide(body);
```

### phy.destructible / phy.particles

```js
const d = phy.destructible(poly, {threshold: 0.5});
d.impact(px, py, force);
d.count();

const p = phy.particles(1000);
p.emit(0, 0, 50, 0.5, 5);
p.step(0.016);
p.list();    // [{x, y, life}]
```

### phy.bezier / phy.curve / phy.pathFollow

```js
const b = phy.bezier.create(p0, p1, p2, p3);
b.at(t);
b.samples(n);
b.derivative(t);

const c = phy.curve.create([{x,y},...]);
c.at(t);
c.samples(n);   // cached!

const pf = phy.pathFollow.create(curve, duration, loop);
pf.step(dt);
```

### phy.light / phy.wind / phy.explosion

```js
phy.light.cast(x, y, radius, shapes, count);
// [{angle, point, distance}]

phy.wind.create(px, py, wx, wy, radius).applyTo(body);

phy.explosion.apply(bodies, px, py, force, radius);
```

### phy.debug / phy.render / phy.forceField / phy.trajectory

```js
phy.debug.body(body);        // {points, lines}
phy.debug.manifold(m);

phy.render.camera(x, y, zoom);
phy.render.polyline(points, color);
phy.render.circle(x, y, r, color);
phy.render.polygon(verts, color);

phy.forceField.gravity(gx, gy)
phy.forceField.wind(wx, wy)
phy.forceField.attractor(px, py, strength)
phy.forceField.applyTo(field, body)

phy.trajectory(v0, angleDeg, g).samples(n)
```

---

## 3D Core

### phy.phy3.v - 3D Vector

```js
phy.phy3.v.add(a, b)
phy.phy3.v.sub(a, b)
phy.phy3.v.mul(a, s)
phy.phy3.v.dot(a, b)
phy.phy3.v.cross(a, b)
phy.phy3.v.len(a)
phy.phy3.v.len2(a)
phy.phy3.v.norm(a)
phy.phy3.v.dist(a, b)
phy.phy3.v.dist2(a, b)
phy.phy3.v.lerp(a, b, t)
phy.phy3.v.neg(a)
phy.phy3.v.rotX(a, angle)
phy.phy3.v.rotY(a, angle)
phy.phy3.v.rotZ(a, angle)
```

Performance: `add` 30 ns, `dot` 21 ns, `len` 21 ns

### phy.phy3.quat - Quaternion

```js
phy.phy3.quat.identity()
phy.phy3.quat.fromAxisAngle(axis, angle)
phy.phy3.quat.mul(a, b)
phy.phy3.quat.conjugate(q)
phy.phy3.quat.norm(q)
phy.phy3.quat.rotate(q, v)
```

Performance: `rotate` 49 ns, `mul` ~35 ns

### phy.phy3.mat3 - 3x3 Matrix

```js
phy.phy3.mat3.identity()
phy.phy3.mat3.fromQuat(q)
phy.phy3.mat3.mulVec(m, v)
phy.phy3.mat3.transpose(m)
```

### phy.phy3.body3 - 3D Body

```js
const b = phy.phy3.body3({
  x, y, z,
  vx, vy, vz,
  mass: 1,
  type: "sphere",  // "sphere" | "aabb" | "capsule"
  r: 0,            // sphere/capsule radius
  w: 0, h: 0, d: 0, // AABB
  len: 0,          // capsule length
  static: false,
  restitution: 0.8,
  quat: identity,
  angularVel: {x, y, z},
  inertia: 1
});

b.applyForce(fx, fy, fz)
b.applyImpulse(ix, iy, iz)
b.applyTorque(tx, ty, tz)
b.integrate(dt)
```

### phy.phy3.world3 / sim3

```js
const w = phy.phy3.world3({gravity: {x, y, z}, substeps: 1});
w.add(b);
w.remove(b);
w.step(dt);

const s = phy.phy3.sim3({gravity, iterations: 8});
s.add(b);
s.step(dt);
s.stats;  // {steps, contacts, totalTime}
```

### phy.phy3.collide3 / contact3 / solver3

```js
phy.phy3.collide3.sphereSphere(a, b)
phy.phy3.collide3.aabbAabb(a, b)
phy.phy3.collide3.sphereAabb(s, box)
phy.phy3.collide3.capsuleCapsule(a, b)
phy.phy3.collide3.detect(a, b)
phy.phy3.collide3.overlap(a, b)

phy.phy3.contact3.manifold(a, b)  // {a, b, normal, depth}

phy.phy3.solver3.solveManifold(m, opts)
phy.phy3.solver3.solve(manifolds, opts)
```

### phy.phy3.raycast3

```js
phy.phy3.raycast3.ray(ox, oy, oz, dx, dy, dz, shapes)
// {hit, t, point, distance}
```

---

## 3D Extended

### phy.phy3.friction

```js
phy.phy3.friction.maxStatic(muS, N)
phy.phy3.friction.kinetic(muK, N)
phy.phy3.friction.applyToBody(b, muK, N, dx, dy, dz)
phy.phy3.friction.applyNormal(b, muK, N, nx, ny, nz)
```

### phy.phy3.constraint3 / joint3

```js
phy.phy3.constraint3.spring(a, b, {k, damping, restLength}).apply()
phy.phy3.constraint3.distance(a, b, {length, stiffness}).apply()
phy.phy3.constraint3.pin(b, x, y, z).apply()

phy.phy3.joint3.ball(a, b, px, py, pz).apply()
phy.phy3.joint3.hinge(a, b, ax, ay, az).apply()
phy.phy3.joint3.slider(a, b, ax, ay, az, min, max).apply()
```

### phy.phy3.collide3 (extended)

```js
phy.phy3.collide3.capsuleSphere(cap, sph)
phy.phy3.collide3.capsuleAabb(cap, box)
```

### phy.phy3.trigger3

```js
const t = phy.phy3.trigger3("sphere", {
  x, y, z, r,
  onEnter, onStay, onExit
});
t.test(b);
t.update(bodies);
```

### phy.phy3.spatialHash3

```js
const sh = phy.phy3.spatialHash3.create(64);
sh.add(b);
sh.query(b);
sh.clear();
```

### phy.phy3.raycast3.capsule

```js
phy.phy3.raycast3.capsule(ox, oy, oz, dx, dy, dz, cap)
```

---

## Deterministic PRNG

### rnd - Xorshift128+

Deterministic pseudo-random number generator. Same seed = same sequence, always.

```js
rnd.seed(42);           // set seed
rnd.next();             // 0-1 float
rnd.next32();           // 0-4294967295
rnd.range(min, max);    // float in range
rnd.int(min, max);      // int in range (inclusive)
rnd.chance(p);          // true with probability p
rnd.pick(arr);          // random element
rnd.shuffle(arr);       // Fisher-Yates shuffle (in-place)
rnd.gauss(mean, stddev);// normal distribution
rnd.angle();            // 0-2*PI
rnd.dir2();             // {x, y} unit vector
rnd.dir3();             // {x, y, z} unit vector
rnd.state();            // {s0, s1} for serialization
rnd.restore(s0, s1);    // restore state
```

**Algorithm:** Xorshift128+ (Vigna 2014)  
**Seed derivation:** SplitMix32 (2x)  
**State:** 128-bit (s0, s1)  
**Warming:** 10 iterations after seed

**Performance:** `next` 56 ns, `int` 51 ns, `dir3` 205 ns

**Determinism:**
- Algoritmik: YES
- Yerel (same machine): YES
- Capraz platform: NO (`Math.sin/cos/sqrt/log` CPU-dependent)

**Usage:**

```js
rnd.seed(42);
var a = [rnd.next(), rnd.next()];

rnd.seed(42);
var b = [rnd.next(), rnd.next()];

// a === b (always)
```

**Particles are deterministic:**

```js
rnd.seed(42);
var p1 = phy.particles(100);
p1.emit(0, 0, 10);
var l1 = p1.list();

rnd.seed(42);
var p2 = phy.particles(100);
p2.emit(0, 0, 10);
var l2 = p2.list();

// l1 === l2 (identical particles)
```

---

## Performance

1M iterations, Chrome V8, Windows 11:

| Function | ns | ops/s | Grade |
|---|---|---|---|
| phy.v.add | 12 | 82M | ULTRA |
| phy.v.len | 18 | 55M | ULTRA |
| phy.v.dot | 21 | 47M | HIZLI |
| phy.tilemap.solidAt | 20 | 50M | ULTRA |
| phy.motion.x | 23 | 44M | HIZLI |
| phy.contact.manifold | 83 | 12M | HIZLI |
| phy.phy3.contact3.manifold | 60 | 17M | HIZLI |
| phy.phy3.solver3 | 122 | 8M | HIZLI |
| phy.phy3.body3.integrate | 146 | 7M | HIZLI |
| phy.sat.polyPoly | 597 | 1.7M | IYI |
| rnd.next | 56 | 18M | HIZLI |

**Target:** 10-100 body. For 1000+ bodies, use native (Box2D, Rapier).

---

## Limits

**Not implemented:**
- Continuous Collision Detection (CCD) - fast bodies can tunnel
- Cross-platform determinism (floating point differences)
- Soft body / cloth
- Fluid simulation
- Complex mesh collision (only sphere, AABB, capsule)
- Convex decomposition

**Recommended for:**
- 2D/3D games with 10-100 bodies
- Educational simulations
- Prototyping
- Single-file CDN usage

**Not recommended for:**
- 1000+ body simulations (use Rapier)
- Multiplayer with rollback (use Rapier/Planck.js)
- Production AAA games (use Unity/Godot)
- Scientific simulation

---

## Version History

- **2.4.2** - Math.random replaced with rnd (deterministic particles)
- **2.4.1** - Xorshift128+ PRNG added
- **2.3.2** - Final optimization pass
- **2.3.1** - 2.2.0 modules restored
- **2.3.0** - Unified 2D + 3D test suite
- **2.2.0** - 3D friction, constraint, joint, trigger, spatialHash, capsule
- **2.1.5** - 3D optimization pass
- **2.0.0** - 3D added (sphere, AABB, capsule)
- **1.5.10** - 2D extended (character, trigger, tilemap, destructible)
- **1.0.0** - 2D full release

---

## License

MIT