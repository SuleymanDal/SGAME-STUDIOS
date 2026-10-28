// ============================================================
// SGNET v3.2.0 - Typing + Queue + Interpolation + Rate Limit
// Peer Metadata + Binary Events + Huffman + Delta Snapshot
// Connection Quality + Session + Priority
// ============================================================
(function(global) {
  "use strict";
  var VERSION = "3.2.0";
  var room = null, syncAction = null, evtAction = null, audioAction = null;
  var myAlias = null, myRoom = null, myPassHash = null;
  var listeners = {}, peers = {};
  var stats = { sent: 0, received: 0, bytesSent: 0, bytesReceived: 0, syncSent: 0, syncReceived: 0, audioSent: 0, audioReceived: 0, evtSent: 0, evtReceived: 0, rolledBack: 0, predicted: 0, bytesSaved: 0, retries: 0, acks: 0, chunksSent: 0, chunksReceived: 0, dropped: 0, compressed: 0, queued: 0, rateLimited: 0, priorityHigh: 0, priorityMed: 0, priorityLow: 0 };
  var syncInterval = null, syncRate = 60;
  var lastSnapshot = {}, predictionBuffer = [], localSeq = 0, tickRate = 60, tickTimer = null;
  var audioStream = null, audioEnabled = false;
  var priorityEntities = {};
  var reconnectAttempts = 0, maxReconnectAttempts = 5;
  var peerTimeouts = {}, peerTimeoutMs = 5000, peerPings = {};
  var reliableQueue = {}, nextMsgId = 1, maxRetries = 3;
  var compressionEnabled = false, compressionMode = "rle";
  var bandwidthLimit = 0, bandwidthWindow = [], BANDWIDTH_WINDOW_MS = 1000;
  var CHUNK_SIZE = 8192, chunkBuffer = {};
  
  // v3.2.0 yeni durumlar
  var queueEnabled = false, messageQueue = [];
  var interpolationMs = 0;
  var rateLimit = 0, rateLimitWindow = [];
  var peerMetadata = {}; // peerId -> { connectedAt, messagesSent, messagesReceived }
  var eventRegistry = {}; // name -> id, id -> name
  var nextEventId = 0x80;
  var sessionId = null;
  var typingTimers = {};
  var deltaProps = null; // syncDelta için

  function log(m) { if (global.sgNet._debug) console.log("[SGNET] " + m); }
  function emit(n, d) { if (listeners[n]) listeners[n].forEach(function(f){ try{f(d)}catch(e){} }); }
  function hash(s) { var h=0; for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return h.toString(36); }
  function nowMs() { return Date.now(); }

  var MQTT_BROKERS = [
    "wss://mqtt.eclipseprojects.io/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://broker.emqx.io:8084/mqtt"
  ];

  var T_INT16 = 0x01, T_FLOAT32 = 0x02, T_BOOL = 0x03, T_STRING = 0x04, T_NULL = 0x05;

  // =========================================================
  // UNIVERSAL DATA (v3.0.0 ayni)
  // =========================================================
  var D_STRING = 0x10, D_NUMBER = 0x11, D_BOOL = 0x12, D_NULL = 0x13, D_OBJ = 0x14,
      D_ARRAY = 0x15, D_FLOAT32 = 0x16, D_BUFFER = 0x17, D_MAP = 0x18, D_SET = 0x19, D_UNDEF = 0x1A;

  function encodeData(val, out) {
    if (val === null) { out.push(D_NULL); return; }
    if (val === undefined) { out.push(D_UNDEF); return; }
    var t = typeof val;
    if (t === "string") {
      out.push(D_STRING);
      var bytes = [];
      for (var i = 0; i < val.length; i++) {
        var c = val.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) { bytes.push(0xC0|(c>>6), 0x80|(c&0x3F)); }
        else { bytes.push(0xE0|(c>>12), 0x80|((c>>6)&0x3F), 0x80|(c&0x3F)); }
      }
      out.push((bytes.length>>24)&0xFF, (bytes.length>>16)&0xFF, (bytes.length>>8)&0xFF, bytes.length&0xFF);
      for (var i = 0; i < bytes.length; i++) out.push(bytes[i]);
    } else if (t === "number") {
      out.push(D_NUMBER);
      if (Number.isInteger(val) && val >= -32768 && val <= 32767) {
        out.push(0x01); out.push((val>>8)&0xFF, val&0xFF);
      } else {
        out.push(0x02);
        var nb = new Uint8Array(new Float64Array([val]).buffer);
        for (var i = 0; i < 8; i++) out.push(nb[i]);
      }
    } else if (t === "boolean") {
      out.push(D_BOOL, val ? 1 : 0);
    } else if (val instanceof Float32Array) {
      out.push(D_FLOAT32);
      out.push((val.length>>24)&0xFF, (val.length>>16)&0xFF, (val.length>>8)&0xFF, val.length&0xFF);
      var f32 = new Uint8Array(val.buffer);
      for (var i = 0; i < f32.length; i++) out.push(f32[i]);
    } else if (val instanceof ArrayBuffer) {
      out.push(D_BUFFER);
      var len = val.byteLength;
      out.push((len>>24)&0xFF, (len>>16)&0xFF, (len>>8)&0xFF, len&0xFF);
      var buf = new Uint8Array(val);
      for (var i = 0; i < buf.length; i++) out.push(buf[i]);
    } else if (val instanceof Map) {
      out.push(D_MAP);
      out.push((val.size>>24)&0xFF, (val.size>>16)&0xFF, (val.size>>8)&0xFF, val.size&0xFF);
      var entries = []; val.forEach(function(v, k) { entries.push([k, v]); });
      for (var i = 0; i < entries.length; i++) { encodeData(entries[i][0], out); encodeData(entries[i][1], out); }
    } else if (val instanceof Set) {
      out.push(D_SET);
      out.push((val.size>>24)&0xFF, (val.size>>16)&0xFF, (val.size>>8)&0xFF, val.size&0xFF);
      var arr = []; val.forEach(function(v) { arr.push(v); });
      for (var i = 0; i < arr.length; i++) encodeData(arr[i], out);
    } else if (Array.isArray(val)) {
      out.push(D_ARRAY);
      out.push((val.length>>24)&0xFF, (val.length>>16)&0xFF, (val.length>>8)&0xFF, val.length&0xFF);
      for (var i = 0; i < val.length; i++) encodeData(val[i], out);
    } else if (t === "object") {
      var keys = Object.keys(val);
      out.push(D_OBJ);
      out.push((keys.length>>24)&0xFF, (keys.length>>16)&0xFF, (keys.length>>8)&0xFF, keys.length&0xFF);
      for (var i = 0; i < keys.length; i++) { encodeData(keys[i], out); encodeData(val[keys[i]], out); }
    } else { out.push(D_NULL); }
  }

  function decodeData(bytes, pos) {
    var type = bytes[pos++];
    if (type === D_NULL) return { v: null, p: pos };
    if (type === D_UNDEF) return { v: undefined, p: pos };
    if (type === D_BOOL) return { v: bytes[pos++] === 1, p: pos };
    if (type === D_STRING) {
      var len = (bytes[pos]<<24) | (bytes[pos+1]<<16) | (bytes[pos+2]<<8) | bytes[pos+3]; pos += 4;
      var str = ""; var end = pos + len;
      while (pos < end) {
        var b = bytes[pos++];
        if (b < 0x80) str += String.fromCharCode(b);
        else if ((b & 0xE0) === 0xC0) { var b2 = bytes[pos++]; str += String.fromCharCode(((b&0x1F)<<6)|(b2&0x3F)); }
        else { var b2 = bytes[pos++]; var b3 = bytes[pos++]; str += String.fromCharCode(((b&0x0F)<<12)|((b2&0x3F)<<6)|(b3&0x3F)); }
      }
      return { v: str, p: pos };
    }
    if (type === D_NUMBER) {
      var sub = bytes[pos++];
      if (sub === 0x01) { var high = bytes[pos++], low = bytes[pos++]; var v = (high<<8)|low; if (v & 0x8000) v -= 0x10000; return { v: v, p: pos }; }
      else { var nb = new Uint8Array(8); for (var i = 0; i < 8; i++) nb[i] = bytes[pos++]; return { v: new Float64Array(nb.buffer)[0], p: pos }; }
    }
    if (type === D_FLOAT32) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var buf = new Uint8Array(len * 4); for (var i = 0; i < buf.length; i++) buf[i] = bytes[pos++]; return { v: new Float32Array(buf.buffer), p: pos }; }
    if (type === D_BUFFER) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var buf = new Uint8Array(len); for (var i = 0; i < len; i++) buf[i] = bytes[pos++]; return { v: buf.buffer, p: pos }; }
    if (type === D_ARRAY) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var arr = []; for (var i = 0; i < len; i++) { var r = decodeData(bytes, pos); arr.push(r.v); pos = r.p; } return { v: arr, p: pos }; }
    if (type === D_OBJ) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var obj = {}; for (var i = 0; i < len; i++) { var kr = decodeData(bytes, pos); pos = kr.p; var vr = decodeData(bytes, pos); pos = vr.p; obj[kr.v] = vr.v; } return { v: obj, p: pos }; }
    if (type === D_MAP) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var map = new Map(); for (var i = 0; i < len; i++) { var kr = decodeData(bytes, pos); pos = kr.p; var vr = decodeData(bytes, pos); pos = vr.p; map.set(kr.v, vr.v); } return { v: map, p: pos }; }
    if (type === D_SET) { var len = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3]; pos += 4; var set = new Set(); for (var i = 0; i < len; i++) { var r = decodeData(bytes, pos); set.add(r.v); pos = r.p; } return { v: set, p: pos }; }
    return { v: null, p: pos };
  }

  // =========================================================
  // COMPRESSION (RLE + Huffman-lite)
  // =========================================================
  function compress(bytes) {
    if (!compressionEnabled || bytes.length < 100) return bytes;
    if (compressionMode === "huffman") return huffmanCompress(bytes);
    return rleCompress(bytes);
  }
  
  function decompress(bytes) {
    if (!compressionEnabled) return bytes;
    if (compressionMode === "huffman") return huffmanDecompress(bytes);
    return rleDecompress(bytes);
  }
  
  function rleCompress(bytes) {
    var out = [], i = 0;
    while (i < bytes.length) {
      var b = bytes[i], count = 1;
      while (i + count < bytes.length && bytes[i + count] === b && count < 255) count++;
      if (count >= 4) { out.push(0xFF, b, count); i += count; }
      else { out.push(b); i++; }
    }
    if (out.length < bytes.length) { stats.compressed++; return new Uint8Array(out); }
    return bytes;
  }
  
  function rleDecompress(bytes) {
    var out = [], i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0xFF && i + 2 < bytes.length) {
        var b = bytes[i+1], count = bytes[i+2];
        for (var j = 0; j < count; j++) out.push(b);
        i += 3;
      } else { out.push(bytes[i]); i++; }
    }
    return new Uint8Array(out);
  }
  
  // Huffman-lite: frekans bazli basit sikistirma (deneysel)
  function huffmanCompress(bytes) {
    // Basit: en yaygin byte'lari 2 byte ile, digerlerini 1 byte ile kodla
    // (Gerci RLE'den farkli, ama boyut kazanci dusuk)
    return rleCompress(bytes); // Simdilik RLE fallback
  }
  
  function huffmanDecompress(bytes) {
    return rleDecompress(bytes);
  }

  // =========================================================
  // EVENT ENCODER (Binary Event Type destekli)
  // =========================================================
  function encodeEvent(name, payload) {
    var out = [0x05, 0x04]; // v4
    // Event ID varsa onu kullan, yoksa isim
    var evtId = eventRegistry[name];
    if (evtId !== undefined) {
      out.push(0x01); // ID modu
      out.push(evtId);
    } else {
      out.push(0x02); // isim modu
      var nameBytes = [];
      for (var i = 0; i < name.length; i++) nameBytes.push(name.charCodeAt(i));
      out.push(nameBytes.length);
      for (var i = 0; i < nameBytes.length; i++) out.push(nameBytes[i]);
    }
    encodeData(payload, out);
    return new Uint8Array(out).buffer;
  }

  function decodeEvent(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    if (bytes[0] !== 0x05) return null;
    var version = bytes[1];
    var pos = 2;
    var mode = bytes[pos++];
    var name;
    if (mode === 0x01) {
      var id = bytes[pos++];
      name = eventRegistry[id] || ("evt_" + id);
    } else {
      var nlen = bytes[pos++];
      name = "";
      for (var i = 0; i < nlen; i++) name += String.fromCharCode(bytes[pos++]);
    }
    var r = decodeData(bytes, pos);
    return { name: name, payload: r.v };
  }

  // =========================================================
  // SNAPSHOT (delta props destekli)
  // =========================================================
  function detectType(val) {
    if (typeof val === "number") return (Number.isInteger(val) && val >= -32768 && val <= 32767) ? T_INT16 : T_FLOAT32;
    if (typeof val === "boolean") return T_BOOL;
    if (typeof val === "string") return T_STRING;
    return T_NULL;
  }

  function encodeSnapshot(entities) {
    var typeDict = [], typeIndex = {}, schemaDict = [], schemaIndex = {};
    var idList = Object.keys(entities);
    for (var i = 0; i < idList.length; i++) {
      var e = entities[idList[i]];
      if (typeIndex[e.type] === undefined) { typeIndex[e.type] = typeDict.length; typeDict.push(e.type); }
      var sk = Object.keys(e.data).sort();
      var schemaKey = e.type + "|" + sk.join(",");
      if (schemaIndex[schemaKey] === undefined) {
        var kt = [];
        for (var k = 0; k < sk.length; k++) kt.push(detectType(e.data[sk[k]]));
        schemaIndex[schemaKey] = schemaDict.length;
        schemaDict.push({ type: e.type, keys: sk, keyTypes: kt });
      }
    }
    var buffer = [0x01, 0x04, typeDict.length];
    for (var i = 0; i < typeDict.length; i++) {
      var name = typeDict[i];
      buffer.push(name.length);
      for (var j = 0; j < name.length; j++) buffer.push(name.charCodeAt(j));
    }
    buffer.push(schemaDict.length);
    for (var i = 0; i < schemaDict.length; i++) {
      var s = schemaDict[i];
      buffer.push(typeIndex[s.type], s.keys.length);
      for (var k = 0; k < s.keys.length; k++) {
        var key = s.keys[k];
        buffer.push(key.length);
        for (var j = 0; j < key.length; j++) buffer.push(key.charCodeAt(j));
        buffer.push(s.keyTypes[k]);
      }
    }
    var count = idList.length;
    buffer.push((count >> 8) & 0xFF, count & 0xFF);
    for (var i = 0; i < idList.length; i++) {
      var id = parseInt(idList[i]);
      var e = entities[idList[i]];
      buffer.push((id >> 24) & 0xFF, (id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF);
      var sk = Object.keys(e.data).sort();
      var schemaKey = e.type + "|" + sk.join(",");
      buffer.push(schemaIndex[schemaKey]);
      var schema = schemaDict[schemaIndex[schemaKey]];
      for (var k = 0; k < schema.keys.length; k++) {
        var val = e.data[schema.keys[k]];
        var vt = schema.keyTypes[k];
        if (vt === T_INT16) buffer.push((val >> 8) & 0xFF, val & 0xFF);
        else if (vt === T_FLOAT32) { var nb = new Uint8Array(new Float32Array([val]).buffer); for (var j = 0; j < 4; j++) buffer.push(nb[j]); }
        else if (vt === T_BOOL) buffer.push(val ? 1 : 0);
        else if (vt === T_STRING) { buffer.push(val.length); for (var j = 0; j < val.length; j++) buffer.push(val.charCodeAt(j)); }
      }
    }
    return new Uint8Array(buffer).buffer;
  }

  function decodeSnapshot(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var pos = 0;
    if (bytes[pos++] !== 0x01) return null;
    var version = bytes[pos++];
    var typeCount = bytes[pos++];
    var typeDict = [];
    for (var i = 0; i < typeCount; i++) {
      var len = bytes[pos++]; var name = "";
      for (var j = 0; j < len; j++) name += String.fromCharCode(bytes[pos++]);
      typeDict.push(name);
    }
    var schemaCount = bytes[pos++];
    var schemaDict = [];
    for (var i = 0; i < schemaCount; i++) {
      var tIdx = bytes[pos++], keyCount = bytes[pos++];
      var keys = [], keyTypes = [];
      for (var k = 0; k < keyCount; k++) {
        var klen = bytes[pos++]; var key = "";
        for (var j = 0; j < klen; j++) key += String.fromCharCode(bytes[pos++]);
        keys.push(key); keyTypes.push(bytes[pos++]);
      }
      schemaDict.push({ type: typeDict[tIdx], keys: keys, keyTypes: keyTypes });
    }
    var count = (bytes[pos++] << 8) | bytes[pos++];
    var entities = {};
    for (var i = 0; i < count; i++) {
      var id = (bytes[pos++] << 24) | (bytes[pos++] << 16) | (bytes[pos++] << 8) | bytes[pos++];
      var sIdx = bytes[pos++];
      var schema = schemaDict[sIdx];
      var data = {};
      for (var k = 0; k < schema.keys.length; k++) {
        var key = schema.keys[k]; var vt = schema.keyTypes[k];
        if (vt === T_INT16) { var high = bytes[pos++], low = bytes[pos++]; var val = (high << 8) | low; if (val & 0x8000) val -= 0x10000; data[key] = val; }
        else if (vt === T_FLOAT32) { var nb = new Uint8Array(4); for (var j = 0; j < 4; j++) nb[j] = bytes[pos++]; data[key] = new Float32Array(nb.buffer)[0]; }
        else if (vt === T_BOOL) data[key] = bytes[pos++] === 1;
        else if (vt === T_STRING) { var vlen = bytes[pos++]; var val = ""; for (var j = 0; j < vlen; j++) val += String.fromCharCode(bytes[pos++]); data[key] = val; }
        else data[key] = null;
      }
      entities[id] = { type: schema.type, data: data };
    }
    return entities;
  }

  // =========================================================
  // BANDWIDTH / RATE LIMIT
  // =========================================================
  function canSend(bytes) {
    if (bandwidthLimit <= 0) return true;
    var now = nowMs();
    bandwidthWindow = bandwidthWindow.filter(function(w) { return now - w.ts < BANDWIDTH_WINDOW_MS; });
    var total = 0;
    for (var i = 0; i < bandwidthWindow.length; i++) total += bandwidthWindow[i].bytes;
    return total + bytes <= bandwidthLimit;
  }
  function recordBytes(bytes) {
    if (bandwidthLimit <= 0) return;
    bandwidthWindow.push({ ts: nowMs(), bytes: bytes });
  }
  
  function checkRateLimit(peerId) {
    if (rateLimit <= 0) return true;
    var now = nowMs();
    rateLimitWindow = rateLimitWindow.filter(function(w) { return now - w.ts < 1000 && w.peerId === peerId; });
    if (rateLimitWindow.length >= rateLimit) { stats.rateLimited++; return false; }
    rateLimitWindow.push({ ts: now, peerId: peerId });
    return true;
  }

  // =========================================================
  // CHUNKING
  // =========================================================
  async function sendChunked(name, data) {
    var bytes = new Uint8Array(data);
    var id = nextMsgId++;
    var chunks = [];
    for (var i = 0; i < bytes.length; i += CHUNK_SIZE) {
      chunks.push(bytes.slice(i, Math.min(i + CHUNK_SIZE, bytes.length)));
    }
    for (var i = 0; i < chunks.length; i++) {
      var nameBytes = [];
      for (var j = 0; j < name.length; j++) nameBytes.push(name.charCodeAt(j));
      var combined = new Uint8Array(8 + nameBytes.length + chunks[i].length);
      combined[0] = 0x06;
      combined[1] = (id>>24)&0xFF; combined[2] = (id>>16)&0xFF; combined[3] = (id>>8)&0xFF; combined[4] = id&0xFF;
      combined[5] = i; combined[6] = chunks.length;
      combined[7] = nameBytes.length;
      combined.set(nameBytes, 8);
      combined.set(chunks[i], 8 + nameBytes.length);
      try { await evtAction.send(combined.buffer); stats.chunksSent++; } catch(e) {}
    }
  }

  function assembleChunk(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    if (bytes[0] !== 0x06) return null;
    var id = (bytes[1]<<24) | (bytes[2]<<16) | (bytes[3]<<8) | bytes[4];
    var idx = bytes[5], total = bytes[6], nlen = bytes[7];
    var name = "";
    for (var i = 0; i < nlen; i++) name += String.fromCharCode(bytes[8+i]);
    var data = bytes.slice(8 + nlen);
    
    if (!chunkBuffer[id]) chunkBuffer[id] = { name: name, total: total, chunks: [] };
    chunkBuffer[id].chunks[idx] = data;
    
    if (chunkBuffer[id].chunks.length === total && chunkBuffer[id].chunks.every(function(c) { return c; })) {
      var fullLen = 0;
      for (var i = 0; i < chunkBuffer[id].chunks.length; i++) fullLen += chunkBuffer[id].chunks[i].length;
      var full = new Uint8Array(fullLen); var off = 0;
      for (var i = 0; i < chunkBuffer[id].chunks.length; i++) { full.set(chunkBuffer[id].chunks[i], off); off += chunkBuffer[id].chunks[i].length; }
      var result = { name: chunkBuffer[id].name, data: full.buffer };
      delete chunkBuffer[id];
      stats.chunksReceived++;
      return result;
    }
    return null;
  }

  // =========================================================
  // PRIORITY + QUEUE
  // =========================================================
  function priorityValue(p) {
    if (p === "high") return 0;
    if (p === "med") return 1;
    if (p === "low") return 2;
    return 1;
  }
  
  function sendPayload(payload, target, priority, reliable, onFail) {
    var pVal = priorityValue(priority);
    if (pVal === 0) stats.priorityHigh++;
    else if (pVal === 2) stats.priorityLow++;
    else stats.priorityMed++;
    
    if (queueEnabled && Object.keys(peers).length === 0) {
      messageQueue.push({ payload: payload, target: target, priority: priority, reliable: reliable, onFail: onFail });
      stats.queued++;
      return -1;
    }
    
    if (reliable) {
      var msgId = nextMsgId++;
      var encoded = encodeEvent("__reliable", { msgId: msgId, payload: payload });
      var entry = { data: encoded, target: target, attempts: 0, onFail: onFail };
      reliableQueue[msgId] = entry;
      sendWithRetry(msgId);
      return msgId;
    }
    
    var encoded2 = encodeEvent("data", payload);
    if (!canSend(encoded2.byteLength)) {
      stats.dropped++;
      if (onFail) onFail("bandwidth");
      return 0;
    }
    recordBytes(encoded2.byteLength);
    
    try {
      if (!target || target === "Q") { evtAction.send(encoded2); stats.evtSent++; return Object.keys(peers).length; }
      var targets = target.split(",").map(function(s){return s.trim();});
      var count = 0;
      for (var pid in peers) if (targets.indexOf(peers[pid].alias) !== -1) { evtAction.send(encoded2, pid); count++; }
      stats.evtSent += count;
      return count;
    } catch(e) { return 0; }
  }
  
  function flushQueue() {
    if (!queueEnabled || messageQueue.length === 0) return;
    messageQueue.sort(function(a, b) { return priorityValue(a.priority) - priorityValue(b.priority); });
    while (messageQueue.length > 0) {
      var msg = messageQueue.shift();
      sendPayload(msg.payload, msg.target, msg.priority, msg.reliable, msg.onFail);
    }
  }

  function sendWithRetry(msgId) {
    var entry = reliableQueue[msgId];
    if (!entry || entry.attempts >= maxRetries) {
      if (entry) { delete reliableQueue[msgId]; stats.dropped++; if (entry.onFail) entry.onFail("timeout"); emit("dropped", { msgId: msgId }); }
      return;
    }
    entry.attempts++;
    if (entry.attempts > 1) stats.retries++;
    try {
      if (entry.target && entry.target !== "Q") evtAction.send(entry.data, entry.target);
      else evtAction.send(entry.data);
    } catch(e) {}
    entry.timer = setTimeout(function() { sendWithRetry(msgId); }, 500 * entry.attempts);
  }

  // =========================================================
  // PING
  // =========================================================
  async function ping(peerId) {
    var start = nowMs();
    var pingId = nextMsgId++;
    try {
      await evtAction.send(encodeEvent("__ping", { id: pingId, ts: start }), peerId);
      return await new Promise(function(resolve) {
        var timeout = setTimeout(function() { resolve(-1); }, 5000);
        var handler = function(d) {
          if (d.id === pingId) {
            clearTimeout(timeout);
            var rtt = nowMs() - start;
            peerPings[peerId] = rtt;
            resolve(rtt);
          }
        };
        if (!listeners["__pong"]) listeners["__pong"] = [];
        listeners["__pong"].push(handler);
        setTimeout(function() {
          var idx = listeners["__pong"].indexOf(handler);
          if (idx > -1) listeners["__pong"].splice(idx, 1);
        }, 5100);
      });
    } catch(e) { return -1; }
  }

  // =========================================================
  // PREDICTION
  // =========================================================
  function startPredictionLoop() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(function() {
      if (global.ent) {
        var inputs = emit("captureInput", {}) || {};
        localSeq++;
        predictionBuffer.push({ seq: localSeq, inputs: inputs, ts: nowMs() });
        if (predictionBuffer.length > 120) predictionBuffer.shift();
        emit("predict", { seq: localSeq, inputs: inputs });
      }
    }, 1000 / tickRate);
  }

  async function startAudio() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioEnabled = true;
      emit("audioStarted", {});
    } catch(e) { emit("audioError", { error: e.message }); }
  }

  function stopAudio() {
    if (audioStream) { audioStream.getTracks().forEach(function(t) { t.stop(); }); audioStream = null; }
    audioEnabled = false;
    emit("audioStopped", {});
  }

  // =========================================================
  // INTERPOLATION
  // =========================================================
  function interpolateEntity(entity, targetData, alpha) {
    for (var k in targetData) {
      if (!targetData.hasOwnProperty(k)) continue;
      var cur = entity.get(k);
      var target = targetData[k];
      if (typeof cur === "number" && typeof target === "number") {
        entity.set(k, cur + (target - cur) * alpha);
      } else {
        entity.set(k, target);
      }
    }
  }

  // =========================================================
  // OUT BUILDER (Zincirlenebilir)
  // =========================================================
  function OutBuilder(payload, target) {
    this.payload = payload;
    this.target = target;
    this._priority = "med";
    this._reliable = false;
    this._onFail = null;
  }
  
  OutBuilder.prototype._send = function() {
    return sendPayload(this.payload, this.target, this._priority, this._reliable, this._onFail);
  };
  
  Object.defineProperty(OutBuilder.prototype, "high", {
    get: function() { this._priority = "high"; return this; }
  });
  Object.defineProperty(OutBuilder.prototype, "med", {
    get: function() { this._priority = "med"; return this; }
  });
  Object.defineProperty(OutBuilder.prototype, "low", {
    get: function() { this._priority = "low"; return this; }
  });
  Object.defineProperty(OutBuilder.prototype, "reliable", {
    get: function() { this._reliable = true; return this; }
  });
  Object.defineProperty(OutBuilder.prototype, "onFail", {
    get: function() { 
      var self = this;
      return function(cb) { self._onFail = cb; return self; };
    }
  });
  
  // Otomatik gonderim icin Proxy
  function wrapOutBuilder(builder) {
    return new Proxy(builder, {
      get: function(target, prop) {
        if (prop === "then") {
          // Promise gibi davran
          return function(resolve, reject) {
            try { resolve(target._send()); } catch(e) { reject(e); }
          };
        }
        if (prop === "high" || prop === "med" || prop === "low" || prop === "reliable") {
          return target[prop];
        }
        if (prop === "onFail") {
          return target.onFail;
        }
        return target[prop];
      }
    });
  }

  // =========================================================
  // ANA API
  // =========================================================
  var sgNet = {
    version: VERSION, _debug: false,

    create: async function(server, pass) {
      return await connectRoom(server, pass, "host");
    },

    join: async function(server, pass, alias) {
      return await connectRoom(server, pass, alias || "p_" + Math.random().toString(36).substr(2,4));
    },

    // Zincirlenebilir out: sgNet.out(data, "Q").high / .med / .low / .reliable
    out: function(msg, target) {
      var builder = new OutBuilder(msg, target);
      return wrapOutBuilder(builder);
    },

    sendLarge: async function(name, data) {
      if (!evtAction) return false;
      await sendChunked(name, data);
      return true;
    },

    ping: function(peerId) { return ping(peerId); },
    getPing: function(peerId) { return peerPings[peerId] || -1; },

    setPeerTimeout: function(ms) { peerTimeoutMs = ms; },
    setCompression: function(mode) { compressionEnabled = true; compressionMode = mode || "rle"; },
    setBandwidthLimit: function(bps) { bandwidthLimit = bps; },
    getBandwidthUsage: function() {
      var now = nowMs();
      bandwidthWindow = bandwidthWindow.filter(function(w) { return now - w.ts < BANDWIDTH_WINDOW_MS; });
      var total = 0;
      for (var i = 0; i < bandwidthWindow.length; i++) total += bandwidthWindow[i].bytes;
      return total;
    },
    setReconnect: function(max) { maxReconnectAttempts = max || 5; },
    setQueue: function(on) { queueEnabled = on; if (on) flushQueue(); },
    setInterpolation: function(ms) { interpolationMs = ms; },
    setRateLimit: function(perSec) { rateLimit = perSec; },
    
    // Typing indicator
    typing: function(on) {
      if (!evtAction) return;
      evtAction.send(encodeEvent("__typing", { from: myAlias, on: on }));
    },
    
    // Event registration
    registerEvent: function(name, id) {
      if (id === undefined) id = nextEventId++;
      eventRegistry[name] = id;
      eventRegistry[id] = name;
      return id;
    },
    
    // Delta snapshot (sadece belirli property'ler)
    syncDelta: async function(prop1, prop2) {
      deltaProps = [prop1, prop2].filter(function(p) { return p; });
      return await sgNet.sync("Q");
    },
    
    // Connection quality
    getConnectionQuality: function() {
      var peerList = Object.keys(peers);
      if (peerList.length === 0) return "disconnected";
      var avgPing = 0, count = 0;
      for (var i = 0; i < peerList.length; i++) {
        var p = peerPings[peerList[i]];
        if (p !== undefined) { avgPing += p; count++; }
      }
      if (count === 0) return "good";
      avgPing /= count;
      if (avgPing < 50) return "excellent";
      if (avgPing < 150) return "good";
      return "poor";
    },
    
    // Session
    getSessionId: function() { return sessionId; },
    joinWithSession: async function(sid) {
      sessionId = sid;
      var parts = sid.split("|");
      if (parts.length >= 2) {
        return await connectRoom(parts[0], parts[1], parts[2] || "p_" + Math.random().toString(36).substr(2,4));
      }
      return null;
    },
    
    // Peer info
    getPeerInfo: function(peerId) {
      if (!peerMetadata[peerId]) return null;
      return {
        alias: peers[peerId] ? peers[peerId].alias : "unknown",
        ping: peerPings[peerId] || -1,
        connectedAt: peerMetadata[peerId].connectedAt,
        messagesSent: peerMetadata[peerId].messagesSent,
        messagesReceived: peerMetadata[peerId].messagesReceived
      };
    },

    sync: async function(target) {
      if (!syncAction || !global.ent) return 0;
      var current = collectEntities();
      if (!target || target === "Q") {
        for (var pid in peers) {
          var delta = buildDelta(pid, current);
          if (!delta) continue;
          var encoded = encodeSnapshot(delta);
          await syncAction.send({ from: myAlias, pass: myPassHash, binary: encoded });
          stats.syncSent++; stats.bytesSent += encoded.byteLength;
        }
        return Object.keys(peers).length;
      }
      return 0;
    },

    startAutoSync: function(rate) {
      syncRate = rate || 60;
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(function() { sgNet.sync("Q"); }, 1000 / syncRate);
    },
    stopAutoSync: function() { if (syncInterval) { clearInterval(syncInterval); syncInterval = null; } },
    setTickRate: function(rate) { tickRate = rate || 60; startPredictionLoop(); },
    getPredictionBuffer: function() { return predictionBuffer.slice(); },
    startAudio: startAudio,
    stopAudio: stopAudio,
    isAudioActive: function() { return audioEnabled; },
    sendAudio: async function(audioData) {
      if (!audioAction) return 0;
      var buffer = [0x04];
      buffer.push((audioData.length >> 8) & 0xFF, audioData.length & 0xFF);
      var f32 = new Uint8Array(audioData.buffer);
      for (var i = 0; i < f32.length; i++) buffer.push(f32[i]);
      try { await audioAction.send(new Uint8Array(buffer).buffer); stats.audioSent++; return 1; } catch(e) { return 0; }
    },

    on: function(n, cb) { (listeners[n] = listeners[n] || []).push(cb); return this; },
    off: function(n, cb) {
      if (!listeners[n]) return this;
      if (cb) listeners[n] = listeners[n].filter(function(f) { return f !== cb; });
      else delete listeners[n];
      return this;
    },
    getAlias: function() { return myAlias; },
    getServer: function() { return myRoom; },
    peers: function() { return Object.keys(peers).map(function(k){return peers[k].alias;}); },
    getStats: function() { return Object.assign({}, stats, { peers: Object.keys(peers).length, queue: messageQueue.length }); },
    leave: async function() {
      sgNet.stopAutoSync(); sgNet.stopAudio();
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (room) await room.leave();
      room = null; syncAction = null; evtAction = null; audioAction = null;
      peers = {}; myAlias = null; myRoom = null;
      lastSnapshot = {}; predictionBuffer = [];
    }
  };

  async function connectRoom(server, pass, alias) {
    if (!global.trysteroMQTT) return null;
    myRoom = server; myPassHash = hash(pass||""); myAlias = alias;
    sessionId = server + "|" + pass + "|" + alias;
    try {
      room = global.trysteroMQTT.joinRoom({
        appId: "sgn-" + server,
        relayUrls: MQTT_BROKERS,
        rtcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      }, server);
      setupRoom();
      startPredictionLoop();
      reconnectAttempts = 0;
      return { server: server, alias: myAlias };
    } catch(e) {
      emit("disconnect", { reason: e.message });
      return null;
    }
  }

  function buildDelta(peerId, current) {
    var last = lastSnapshot[peerId] || {}, delta = {}, count = 0;
    for (var id in current) {
      if (!current.hasOwnProperty(id)) continue;
      var cur = current[id], prev = last[id];
      if (!prev) { delta[id] = cur; count++; }
      else {
        var changes = {};
        for (var k in cur.data) {
          if (!cur.data.hasOwnProperty(k)) continue;
          if (deltaProps && deltaProps.indexOf(k) === -1) continue;
          if (cur.data[k] !== prev.data[k]) changes[k] = cur.data[k];
        }
        if (Object.keys(changes).length > 0) { delta[id] = { type: cur.type, data: changes }; count++; }
      }
    }
    lastSnapshot[peerId] = current;
    return count > 0 ? delta : null;
  }

  function collectEntities() {
    if (!global.ent) return {};
    var tick = stats.syncSent, snapshot = {}, list = global.ent.list;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      var prio = priorityEntities[e.id] || 0;
      if (prio === 1 || tick % 3 === 0) snapshot[e.id] = { type: e.type, data: e.data };
    }
    return snapshot;
  }

  function setupRoom() {
    syncAction = room.makeAction("sync");
    syncAction.onMessage = function(data, peerId) {
      stats.syncReceived++;
      if (!data || data.pass !== myPassHash) return;
      var entities = decodeSnapshot(data.binary);
      if (!entities) return;
      stats.bytesReceived += data.binary.byteLength;
      if (global.ent) {
        var added = 0, updated = 0;
        for (var id in entities) {
          if (!entities.hasOwnProperty(id)) continue;
          var eid = parseInt(id), existing = null, list = global.ent.list;
          for (var i = 0; i < list.length; i++) if (list[i].id === eid) { existing = list[i]; break; }
          if (existing) {
            if (interpolationMs > 0) {
              // Basit interpolation
              var alpha = Math.min(1, 16 / interpolationMs);
              interpolateEntity(existing, entities[id].data, alpha);
            } else {
              var d = entities[id].data;
              for (var k in d) if (d.hasOwnProperty(k)) existing.set(k, d[k]);
            }
            updated++;
          } else { global.ent.spawn(entities[id].type, entities[id].data); added++; }
        }
        emit("sync", { from: peerId, added: added, updated: updated });
      }
    };

    evtAction = room.makeAction("evt");
    evtAction.onMessage = function(data, peerId) {
      stats.evtReceived++;
      
      if (peerMetadata[peerId]) peerMetadata[peerId].messagesReceived++;
      
      // Rate limit
      if (!checkRateLimit(peerId)) return;
      
      var chunk = assembleChunk(data);
      if (chunk) { emit(chunk.name, chunk.data); return; }
      
      var evt = decodeEvent(data);
      if (!evt) return;
      
      if (evt.name === "data") {
        if (peerMetadata[peerId]) peerMetadata[peerId].messagesSent++;
        emit("data", evt.payload);
      }
      else if (evt.name === "__reliable") {
        try { evtAction.send(encodeEvent("__ack", { msgId: evt.payload.msgId }), peerId); } catch(e) {}
        emit("reliable", evt.payload.payload);
      }
      else if (evt.name === "__ping") {
        try { evtAction.send(encodeEvent("__pong", evt.payload), peerId); } catch(e) {}
      }
      else if (evt.name === "__pong") {
        if (listeners["__pong"]) listeners["__pong"].forEach(function(h) { h(evt.payload); });
      }
      else if (evt.name === "__ack") {
        var q = reliableQueue[evt.payload.msgId];
        if (q) { clearTimeout(q.timer); delete reliableQueue[evt.payload.msgId]; stats.acks++; }
      }
      else if (evt.name === "__typing") {
        emit("typing", evt.payload);
      }
      else {
        emit(evt.name, evt.payload);
      }
    };

    audioAction = room.makeAction("aud");
    audioAction.onMessage = function(data, peerId) {
      stats.audioReceived++;
      var bytes = new Uint8Array(data);
      if (bytes[0] !== 0x04) return;
      var len = (bytes[1] << 8) | bytes[2];
      var f32 = new Uint8Array(len * 4);
      for (var i = 0; i < f32.length; i++) f32[i] = bytes[3 + i];
      emit("audio", { samples: new Float32Array(f32.buffer), peerId: peerId });
    };

    room.onPeerJoin = function(peerId) {
      peerMetadata[peerId] = { connectedAt: nowMs(), messagesSent: 0, messagesReceived: 0 };
      peers[peerId] = { alias: "peer_" + peerId.substr(0, 6) };
      emit("connected", { alias: peers[peerId].alias, id: peerId });
      flushQueue();
    };

    room.onPeerLeave = function(peerId) {
      if (peers[peerId]) { emit("left", { alias: peers[peerId].alias }); delete peers[peerId]; }
      delete peerMetadata[peerId];
    };

    setInterval(function() {
      var peerList = Object.keys(peers);
      for (var i = 0; i < peerList.length; i++) {
        var pid = peerList[i];
        ping(pid).then(function(rtt) {
          if (rtt < 0 && peerTimeoutMs > 0) {
            var last = peerPings[pid] || 0;
            if (nowMs() - last > peerTimeoutMs) {
              emit("timeout", { peerId: pid });
              delete peers[pid];
            }
          }
        });
      }
    }, 3000);
  }

  global.sgNet = sgNet;
})(typeof window !== "undefined" ? window : global);
