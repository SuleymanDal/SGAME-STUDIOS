// ============================================================
// SG-AUDIO v1.0.0 (Final) - Cargik Cumle Ses Motoru
// Felsefe: Az Fonksiyon, Cok Is. Ezber Yok, Ritim Var.
// Yenilikler: Web Audio Scheduler, Look-Ahead Timing
// SGame Studios - 2026
// ============================================================
(function(global) {
  "use strict";
  var VERSION = "1.0.0";
  var ctx = null;
  var masterGain = null;
  var sfxGain = null;
  var musicGain = null;
  var ambientGain = null;
  var compressor = null;
  var analyser = null;
  var reverbNode = null;
  var isMuted = false;
  var volumes = { master: 1.0, sfx: 0.9, music: 0.5, ambient: 0.6 };
  var _schedulerTimer = null;
  var _nextNoteTime = 0;
  var _currentStep = 0;
  var _activeMusicConfig = null;
  var _activeMusicGain = null;
  var _activeNodes = [];
  var _cooldowns = {};
  var MAX_VOICES = 64;
  
  var PRIORITY = { ui: 100, player: 80, weapon: 60, enemy: 40, ambient: 20 };
  
  function logError(fn,msg){ console.error("[SG Audio] "+fn+": "+msg); }
  
  function trackNode(node, priority) {
    if (_activeNodes.length >= MAX_VOICES) {
      var lowestIdx = 0, lowestPriority = 999;
      for (var i = 0; i < _activeNodes.length; i++) {
        var p = _activeNodes[i]._priority || 50;
        if (p < lowestPriority) { lowestPriority = p; lowestIdx = i; }
      }
      var toKill = _activeNodes.splice(lowestIdx, 1)[0];
      try { toKill.stop(); } catch(e) {}
    }
    node._priority = priority || 50;
    _activeNodes.push(node);
    node.onended = function() {
      var idx = _activeNodes.indexOf(node);
      if (idx > -1) _activeNodes.splice(idx, 1);
    };
  }
  
  function canPlay(type, cooldownMs) {
    var now = Date.now();
    if (_cooldowns[type] && now - _cooldowns[type] < cooldownMs) return false;
    _cooldowns[type] = now;
    return true;
  }
  
  function createReverbBuffer(duration, decay) {
    var rate = ctx.sampleRate;
    var length = rate * duration;
    var impulse = ctx.createBuffer(2, length, rate);
    var left = impulse.getChannelData(0);
    var right = impulse.getChannelData(1);
    for (var i = 0; i < length; i++) {
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }
  
  function makeDistortionCurve(amount) {
    var k = typeof amount === "number" ? amount : 50;
    var n_samples = 44100;
    var curve = new Float32Array(n_samples);
    var deg = Math.PI / 180;
    for (var i = 0; i < n_samples; ++i) {
      var x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
  
  function applyEnvelope(gainNode, now, attack, decay, sustain, duration) {
    var g = gainNode.gain;
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(sustain, now + attack);
    g.exponentialRampToValueAtTime(sustain * 0.2, now + attack + decay);
    g.setValueAtTime(sustain * 0.2, now + duration - 0.05);
    g.exponentialRampToValueAtTime(0.001, now + duration);
  }
  
  function scheduleNote(time, type, freq, vol, duration, targetGain) {
    if (freq <= 0) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4000;
    filter.Q.value = 1;
    osc.type = type;
    osc.frequency.value = freq;
    applyEnvelope(gain, time, 0.01, duration * 0.2, vol, duration);
    osc.connect(filter); filter.connect(gain); gain.connect(targetGain);
    trackNode(osc, PRIORITY.ambient);
    osc.start(time); osc.stop(time + duration);
  }
  
  function scheduleDrum(time, type, targetGain) {
    if (type === "kick") {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
      applyEnvelope(gain, time, 0.001, 0.05, 1.0, 0.15);
      osc.connect(gain); gain.connect(targetGain); trackNode(osc, PRIORITY.ambient);
      osc.start(time); osc.stop(time + 0.2);
    } else if (type === "snare") {
      var n = ctx.createBufferSource();
      var bS = ctx.sampleRate * 0.15; var buf = ctx.createBuffer(1, bS, ctx.sampleRate);
      var dt = buf.getChannelData(0);
      for (var i = 0; i < bS; i++) dt[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
      var ng = ctx.createGain(); applyEnvelope(ng, time, 0.001, 0.03, 0.5, 0.12);
      n.connect(hp); hp.connect(ng); ng.connect(targetGain);
      trackNode(n, PRIORITY.ambient); n.start(time); n.stop(time + 0.15);
    }
  }
  
  function musicScheduler() {
    if (!_activeMusicConfig) return;
    var config = _activeMusicConfig;
    var tempo = config.tempo || 120;
    var stepLen = (60 / tempo) / 4;
    var swing = config.swing !== undefined ? config.swing : 0;
    var lookAhead = 0.15;
    
    while (_nextNoteTime < ctx.currentTime + lookAhead) {
      var stepInBar = _currentStep % 16;
      var swingOffset = (stepInBar % 2 === 1) ? stepLen * swing : 0;
      var noteTime = _nextNoteTime + swingOffset;
      var humanVol = 0.85 + Math.random() * 0.3;
      
      if (config.bass && stepInBar % 4 === 0) {
        var f = config.bass[Math.floor(stepInBar / 4) % config.bass.length];
        if (f > 0) scheduleNote(noteTime, "sawtooth", f, 0.5 * humanVol, stepLen * 3, _activeMusicGain);
      }
      
      if (config.chords && stepInBar % 8 === 0) {
        config.chords.forEach(function(f) {
          scheduleNote(noteTime, "triangle", f, 0.25 * humanVol, stepLen * 6, _activeMusicGain);
        });
      }
      
      if (config.drums) {
        var drumType = config.drums[stepInBar % config.drums.length];
        if (drumType) scheduleDrum(noteTime, drumType, _activeMusicGain);
      }
      
      _nextNoteTime += stepLen;
      _currentStep++;
    }
    
    if (_activeMusicConfig) {
      _schedulerTimer = setTimeout(musicScheduler, 25);
    }
  }
  
  var sgAudio = {
    version: VERSION,
    
    init: function() {
      if (ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { logError("init", "Web Audio API desteklenmiyor"); return; }
      ctx = new AC();
      masterGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain = ctx.createGain();
      ambientGain = ctx.createGain();
      
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = createReverbBuffer(2.5, 2.0);
      var reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.25;
      
      sfxGain.connect(masterGain);
      ambientGain.connect(masterGain);
      musicGain.connect(compressor);
      compressor.connect(masterGain);
      compressor.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(masterGain);
      
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      
      this.volume(volumes.master, volumes.sfx, volumes.music, volumes.ambient);
    },
    
    resume: function() { if (ctx && ctx.state === "suspended") ctx.resume(); },
    
    stopAll: function() {
      if (!ctx) return;
      if (_schedulerTimer) { clearTimeout(_schedulerTimer); _schedulerTimer = null; }
      _activeMusicConfig = null;
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      }
      setTimeout(function() {
        for (var i = 0; i < _activeNodes.length; i++) {
          try { _activeNodes[i].stop(); } catch(e) {}
        }
        _activeNodes = [];
        if (masterGain) {
          masterGain.gain.setValueAtTime(isMuted ? 0 : volumes.master, ctx.currentTime);
        }
      }, 60);
    },
    
    volume: function(m, s, mu, a) {
      if (typeof m === "number") volumes.master = Math.max(0, Math.min(1, m));
      if (typeof s === "number") volumes.sfx = Math.max(0, Math.min(1, s));
      if (typeof mu === "number") volumes.music = Math.max(0, Math.min(1, mu));
      if (typeof a === "number") volumes.ambient = Math.max(0, Math.min(1, a));
      if (masterGain) masterGain.gain.setTargetAtTime(isMuted ? 0 : volumes.master, ctx.currentTime, 0.05);
      if (sfxGain) sfxGain.gain.setTargetAtTime(volumes.sfx, ctx.currentTime, 0.05);
      if (musicGain) musicGain.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.05);
      if (ambientGain) ambientGain.gain.setTargetAtTime(volumes.ambient, ctx.currentTime, 0.05);
    },
    
    mute: function(state) {
      isMuted = (state !== undefined) ? state : !isMuted;
      if (masterGain) masterGain.gain.setTargetAtTime(isMuted ? 0 : volumes.master, ctx.currentTime, 0.05);
      return isMuted;
    },
    
    getAnalyser: function() { return analyser; },
    
    duck: function() {
      if (!ctx) return;
      if (musicGain) {
        musicGain.gain.setTargetAtTime(volumes.music * 0.3, ctx.currentTime, 0.05);
        setTimeout(function() { if (musicGain) musicGain.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.1); }, 200);
      }
    },
    
    spatialSfx: function(type, x, y, z, velocityX, opt) {
      if (!ctx) return;
      opt = opt || {};
      var vol = opt.vol !== undefined ? opt.vol : 0.5;
      var panner = ctx.createPanner();
      panner.panningModel = "HRTF"; panner.distanceModel = "inverse";
      panner.refDistance = 1; panner.maxDistance = 100; panner.rolloffFactor = 1;
      panner.setPosition(x, y, z); panner.connect(sfxGain);
      if (velocityX !== undefined) panner.velocityX = velocityX;
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
      applyEnvelope(gain, ctx.currentTime, 0.01, 0.05, vol, 0.1);
      osc.connect(gain); gain.connect(panner);
      trackNode(osc, PRIORITY.enemy); osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    
    sfx: function(type, opt) {
      if (!ctx) return;
      opt = opt || {};
      var vol = opt.vol !== undefined ? opt.vol : 0.8;
      var pan = opt.pan || 0;
      if (!canPlay(type, 20)) return;
      
      var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(sfxGain); }
      var out = panner ? panner : sfxGain;
      
      var priority = PRIORITY.enemy;
      if (type.indexOf("ui") === 0) priority = PRIORITY.ui;
      else if (type === "footstep" || type === "jump" || type === "land" || type === "hurt") priority = PRIORITY.player;
      else if (type === "pistol" || type === "rifle" || type === "shotgun" || type === "explosion") priority = PRIORITY.weapon;
      
      if (type === "explosion") {
        var d = 1.5;
        var boom = ctx.createOscillator(); var bGain = ctx.createGain();
        boom.type = "sine"; boom.frequency.setValueAtTime(60, ctx.currentTime);
        boom.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + d * 0.8);
        applyEnvelope(bGain, ctx.currentTime, 0.01, d * 0.3, vol, d);
        boom.connect(bGain); bGain.connect(out); trackNode(boom, priority);
        boom.start(); boom.stop(ctx.currentTime + d);
        
        var n = ctx.createBufferSource();
        var bS = ctx.sampleRate * d; var buf = ctx.createBuffer(1, bS, ctx.sampleRate);
        var dt = buf.getChannelData(0);
        for (var i = 0; i < bS; i++) dt[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(800, ctx.currentTime);
        lp.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + d);
        var nGain = ctx.createGain(); applyEnvelope(nGain, ctx.currentTime, 0.005, d*0.3, vol*0.7, d);
        n.connect(lp); lp.connect(nGain); nGain.connect(out); trackNode(n, priority);
        n.start(); n.stop(ctx.currentTime + d);
        this.duck();
      }
      else if (type === "shotgun" || type === "rifle" || type === "pistol") {
        var conf = {
          pistol: { d: 0.25, cf: 3000, bf: 250, nf: 2500 },
          rifle: { d: 0.4, cf: 2500, bf: 180, nf: 2000 },
          shotgun: { d: 0.8, cf: 1800, bf: 120, nf: 1500 }
        }[type];
        var cOsc = ctx.createOscillator(); var cGain = ctx.createGain();
        cOsc.type = "square"; cOsc.frequency.setValueAtTime(conf.cf, ctx.currentTime);
        cOsc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.02);
        applyEnvelope(cGain, ctx.currentTime, 0.001, 0.01, vol, 0.02);
        cOsc.connect(cGain); cGain.connect(out); trackNode(cOsc, priority);
        cOsc.start(); cOsc.stop(ctx.currentTime + 0.03);
        
        var pOsc = ctx.createOscillator(); var pGain = ctx.createGain();
        pOsc.type = "sine"; pOsc.frequency.setValueAtTime(conf.bf, ctx.currentTime + 0.005);
        pOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + conf.d * 0.6);
        applyEnvelope(pGain, ctx.currentTime + 0.005, 0.005, conf.d * 0.3, vol, conf.d);
        pOsc.connect(pGain); pGain.connect(out); trackNode(pOsc, priority);
        pOsc.start(ctx.currentTime + 0.005); pOsc.stop(ctx.currentTime + conf.d);
        
        var n = ctx.createBufferSource();
        var bS = ctx.sampleRate * conf.d; var buf = ctx.createBuffer(1, bS, ctx.sampleRate);
        var dt = buf.getChannelData(0);
        for (var i = 0; i < bS; i++) dt[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        var nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = conf.nf; nf.Q.value = 0.5;
        var nGain = ctx.createGain(); applyEnvelope(nGain, ctx.currentTime, 0.005, conf.d * 0.2, vol * 0.6, conf.d * 0.8);
        n.connect(nf); nf.connect(nGain); nGain.connect(out); trackNode(n, priority);
        n.start(); n.stop(ctx.currentTime + conf.d);
        this.duck();
      }
      else if (type === "hit") {
        var hOsc = ctx.createOscillator(); var hGain = ctx.createGain();
        hOsc.type = "triangle"; hOsc.frequency.setValueAtTime(120, ctx.currentTime);
        hOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
        applyEnvelope(hGain, ctx.currentTime, 0.005, 0.1, vol, 0.2);
        hOsc.connect(hGain); hGain.connect(out); trackNode(hOsc, priority);
        hOsc.start(); hOsc.stop(ctx.currentTime + 0.2);
      }
      else if (type === "footstep") {
        var fOsc = ctx.createOscillator(); var fGain = ctx.createGain();
        fOsc.type = "triangle"; fOsc.frequency.setValueAtTime(100 + Math.random()*50, ctx.currentTime);
        fOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        applyEnvelope(fGain, ctx.currentTime, 0.001, 0.05, vol, 0.1);
        fOsc.connect(fGain); fGain.connect(out); trackNode(fOsc, priority);
        fOsc.start(); fOsc.stop(ctx.currentTime + 0.1);
      }
      else if (type === "jump") {
        var jOsc = ctx.createOscillator(); var jGain = ctx.createGain();
        jOsc.type = "sine"; jOsc.frequency.setValueAtTime(300, ctx.currentTime);
        jOsc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15);
        applyEnvelope(jGain, ctx.currentTime, 0.01, 0.05, vol, 0.15);
        jOsc.connect(jGain); jGain.connect(out); trackNode(jOsc, priority);
        jOsc.start(); jOsc.stop(ctx.currentTime + 0.15);
      }
      else if (type === "land") {
        var lOsc = ctx.createOscillator(); var lGain = ctx.createGain();
        lOsc.type = "sine"; lOsc.frequency.setValueAtTime(150, ctx.currentTime);
        lOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
        applyEnvelope(lGain, ctx.currentTime, 0.005, 0.1, vol, 0.15);
        lOsc.connect(lGain); lGain.connect(out); trackNode(lOsc, priority);
        lOsc.start(); lOsc.stop(ctx.currentTime + 0.15);
      }
      else if (type === "hurt") {
        var hurtOsc = ctx.createOscillator(); var hurtGain = ctx.createGain();
        hurtOsc.type = "sawtooth"; hurtOsc.frequency.setValueAtTime(100, ctx.currentTime);
        hurtOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
        applyEnvelope(hurtGain, ctx.currentTime, 0.01, 0.2, vol, 0.3);
        hurtOsc.connect(hurtGain); hurtGain.connect(out); trackNode(hurtOsc, priority);
        hurtOsc.start(); hurtOsc.stop(ctx.currentTime + 0.3);
        var tinOsc = ctx.createOscillator(); var tinGain = ctx.createGain();
        tinOsc.type = "sine"; tinOsc.frequency.setValueAtTime(4000, ctx.currentTime);
        tinGain.gain.setValueAtTime(0, ctx.currentTime);
        tinGain.gain.linearRampToValueAtTime(vol * 0.1, ctx.currentTime + 0.05);
        tinGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        tinOsc.connect(tinGain); tinGain.connect(out); trackNode(tinOsc, priority);
        tinOsc.start(); tinOsc.stop(ctx.currentTime + 0.5);
      }
      else if (type === "pickup") {
        var pOsc = ctx.createOscillator(); var pGain = ctx.createGain();
        pOsc.type = "sine"; pOsc.frequency.setValueAtTime(400, ctx.currentTime);
        pOsc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
        applyEnvelope(pGain, ctx.currentTime, 0.005, 0.05, vol, 0.1);
        pOsc.connect(pGain); pGain.connect(out); trackNode(pOsc, priority);
        pOsc.start(); pOsc.stop(ctx.currentTime + 0.1);
      }
      else if (type === "switch") {
        var sOsc = ctx.createOscillator(); var sGain = ctx.createGain();
        sOsc.type = "square"; sOsc.frequency.setValueAtTime(1500, ctx.currentTime);
        sOsc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
        applyEnvelope(sGain, ctx.currentTime, 0.001, 0.02, vol, 0.05);
        sOsc.connect(sGain); sGain.connect(out); trackNode(sOsc, priority);
        sOsc.start(); sOsc.stop(ctx.currentTime + 0.05);
      }
      else if (type === "reload") {
        var rOsc = ctx.createOscillator(); var rGain = ctx.createGain();
        rOsc.type = "triangle"; rOsc.frequency.setValueAtTime(800, ctx.currentTime);
        rOsc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
        applyEnvelope(rGain, ctx.currentTime, 0.01, 0.1, vol, 0.2);
        rOsc.connect(rGain); rGain.connect(out); trackNode(rOsc, priority);
        rOsc.start(); rOsc.stop(ctx.currentTime + 0.2);
      }
      else if (type === "empty") {
        var eOsc = ctx.createOscillator(); var eGain = ctx.createGain();
        eOsc.type = "square"; eOsc.frequency.setValueAtTime(2000, ctx.currentTime);
        eOsc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.03);
        applyEnvelope(eGain, ctx.currentTime, 0.001, 0.01, vol, 0.03);
        eOsc.connect(eGain); eGain.connect(out); trackNode(eOsc, priority);
        eOsc.start(); eOsc.stop(ctx.currentTime + 0.03);
      }
      else if (type === "uiHover") {
        var uOsc = ctx.createOscillator(); var uGain = ctx.createGain();
        uOsc.type = "sine"; uOsc.frequency.value = 600;
        applyEnvelope(uGain, ctx.currentTime, 0.001, 0.02, vol * 0.3, 0.03);
        uOsc.connect(uGain); uGain.connect(out); trackNode(uOsc, priority);
        uOsc.start(); uOsc.stop(ctx.currentTime + 0.03);
      }
      else if (type === "uiClick") {
        var ucOsc = ctx.createOscillator(); var ucGain = ctx.createGain();
        ucOsc.type = "square"; ucOsc.frequency.value = 800;
        applyEnvelope(ucGain, ctx.currentTime, 0.001, 0.02, vol * 0.5, 0.04);
        ucOsc.connect(ucGain); ucGain.connect(out); trackNode(ucOsc, priority);
        ucOsc.start(); ucOsc.stop(ctx.currentTime + 0.04);
      }
      else if (type === "uiError") {
        var ueOsc = ctx.createOscillator(); var ueGain = ctx.createGain();
        ueOsc.type = "sawtooth"; ueOsc.frequency.setValueAtTime(200, ctx.currentTime);
        ueOsc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
        applyEnvelope(ueGain, ctx.currentTime, 0.001, 0.1, vol * 0.6, 0.15);
        ueOsc.connect(ueGain); ueGain.connect(out); trackNode(ueOsc, priority);
        ueOsc.start(); ueOsc.stop(ctx.currentTime + 0.15);
      }
      else if (type === "uiNotify") {
        var unOsc = ctx.createOscillator(); var unGain = ctx.createGain();
        unOsc.type = "sine"; unOsc.frequency.setValueAtTime(600, ctx.currentTime);
        unOsc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.1);
        applyEnvelope(unGain, ctx.currentTime, 0.005, 0.05, vol * 0.5, 0.15);
        unOsc.connect(unGain); unGain.connect(out); trackNode(unOsc, priority);
        unOsc.start(); unOsc.stop(ctx.currentTime + 0.15);
      }
      else if (type === "enemyGrowl") {
        var egOsc = ctx.createOscillator(); var egGain = ctx.createGain();
        egOsc.type = "sawtooth"; egOsc.frequency.setValueAtTime(80, ctx.currentTime);
        egOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
        applyEnvelope(egGain, ctx.currentTime, 0.05, 0.2, vol * 0.5, 0.4);
        egOsc.connect(egGain); egGain.connect(out); trackNode(egOsc, priority);
        egOsc.start(); egOsc.stop(ctx.currentTime + 0.4);
      }
      else if (type === "enemyDeath") {
        var edOsc = ctx.createOscillator(); var edGain = ctx.createGain();
        edOsc.type = "triangle"; edOsc.frequency.setValueAtTime(300, ctx.currentTime);
        edOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
        applyEnvelope(edGain, ctx.currentTime, 0.01, 0.3, vol, 0.5);
        edOsc.connect(edGain); edGain.connect(out); trackNode(edOsc, priority);
        edOsc.start(); edOsc.stop(ctx.currentTime + 0.5);
      }
      else if (type === "enemyAttack") {
        var eaOsc = ctx.createOscillator(); var eaGain = ctx.createGain();
        eaOsc.type = "sawtooth"; eaOsc.frequency.setValueAtTime(500, ctx.currentTime);
        eaOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        applyEnvelope(eaGain, ctx.currentTime, 0.01, 0.1, vol * 0.8, 0.2);
        eaOsc.connect(eaGain); eaGain.connect(out); trackNode(eaOsc, priority);
        eaOsc.start(); eaOsc.stop(ctx.currentTime + 0.2);
      }
    },
    
    startWind: function(vol) {
      if (!ctx) return;
      var windNoise = ctx.createBufferSource();
      var bufferSize = ctx.sampleRate * 2;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      windNoise.buffer = buffer; windNoise.loop = true;
      var windFilter = ctx.createBiquadFilter();
      windFilter.type = "lowpass"; windFilter.frequency.value = 300;
      var windGain = ctx.createGain(); windGain.gain.value = vol || 0.05;
      windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(ambientGain);
      trackNode(windNoise, PRIORITY.ambient); windNoise.start();
    },
    startDistantExplosions: function() {
      if (!ctx) return;
      if (_ambientInterval) clearInterval(_ambientInterval);
      _ambientInterval = setInterval(function() {
        if (Math.random() > 0.7) {
          var dist = ctx.createConvolver(); dist.buffer = reverbNode.buffer;
          var osc = ctx.createOscillator(); var gain = ctx.createGain();
          osc.type = "sine"; osc.frequency.setValueAtTime(60, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.0);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
          osc.connect(gain); gain.connect(dist); dist.connect(ambientGain);
          trackNode(osc, PRIORITY.ambient); osc.start(); osc.stop(ctx.currentTime + 1.0);
        }
      }, 5000);
    },
    startAlarm: function() {
      if (!ctx) return;
      var osc = ctx.createOscillator();
      var dist = ctx.createWaveShaper();
      var gain = ctx.createGain();
      var delay = ctx.createDelay(1.0);
      var feedback = ctx.createGain();
      
      osc.type = "sawtooth";
      dist.curve = makeDistortionCurve(800);
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 1.5);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 3.0);
      delay.delayTime.value = 0.5;
      feedback.gain.value = 0.4;
      gain.gain.value = 0.08;
      osc.connect(dist); dist.connect(gain);
      gain.connect(ambientGain);
      gain.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(ambientGain);
      trackNode(osc, PRIORITY.ambient); osc.start();
      var alarmInterval = setInterval(function() {
        if (_activeNodes.indexOf(osc) === -1) { clearInterval(alarmInterval); return; }
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 1.5);
        osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 3.0);
      }, 3000);
      _activeNodes.push({ stop: function() { clearInterval(alarmInterval); osc.stop(); }, onended: null, _priority: PRIORITY.ambient });
    },
    
    _fadeMusic: function(newPlayFn) {
      if (!ctx) return;
      var oldGain = musicGain.gain.value;
      musicGain.gain.setValueAtTime(oldGain, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(function() {
        newPlayFn();
        musicGain.gain.setValueAtTime(0, ctx.currentTime);
        musicGain.gain.linearRampToValueAtTime(volumes.music, ctx.currentTime + 0.5);
      }, 500);
    },
    
    createMusic: function(config) {
      var self = this;
      this._fadeMusic(function() {
        if (_schedulerTimer) { clearTimeout(_schedulerTimer); _schedulerTimer = null; }
        _activeMusicConfig = config;
        _activeMusicGain = ctx.createGain();
        _activeMusicGain.gain.value = 1.0;
        _activeMusicGain.connect(musicGain);
        _nextNoteTime = ctx.currentTime + 0.1;
        _currentStep = 0;
        musicScheduler();
      });
    },
    
    playSynthwave: function(bpm) {
      this.createMusic({
        tempo: bpm || 120,
        swing: 0.15,
        bass: [55, 65, 82, 110],
        chords: [220, 261, 329],
        drums: ["kick", "", "snare", "", "kick", "", "snare", ""]
      });
    },
    
    playCombatMusic: function() {
      this.createMusic({
        tempo: 140,
        swing: 0.05,
        bass: [55, 55, 55, 55, 65, 65, 82, 82],
        chords: [110, 130, 164],
        drums: ["kick", "snare", "kick", "snare", "kick", "snare", "kick", "snare"]
      });
    },
    
    playAmbientMusic: function() {
      this.createMusic({
        tempo: 60,
        swing: 0,
        bass: [65, 0, 0, 0, 65, 0, 0, 0],
        chords: [130, 164, 196],
        drums: []
      });
    },
    
    playBossMusic: function() {
      this.createMusic({
        tempo: 160,
        swing: 0.25,
        bass: [55, 55, 55, 55, 55, 55, 55, 55],
        chords: [110, 130, 164],
        drums: ["kick", "snare", "kick", "snare", "kick", "snare", "kick", "snare"]
      });
    },
    
    stopMusic: function() {
      if (_schedulerTimer) { clearTimeout(_schedulerTimer); _schedulerTimer = null; }
      _activeMusicConfig = null;
      if (musicGain && ctx) {
        musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(function() { if (musicGain && ctx) musicGain.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.05); }, 100);
      }
    }
  };
  
  global.sgAudio = sgAudio;
  if (typeof module !== "undefined" && module.exports) { module.exports = sgAudio; }
})(typeof window !== "undefined" ? window : global);
