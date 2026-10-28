// ENT ECS v2.1.4 - incremental index update
(function(global) {
  "use strict";
  var VERSION = "2.1.4.1";
  var currentScene = "default";
  var scenes = Object.create(null);
  var timers = Object.create(null);
  var timeAccumulator = 0;
  var debugMode = false;
  var nextId = 1;
  var INDEXED_PROPS = ["health","x","y"];
  function logError(fn,msg){ if(debugMode) console.error("[ENT] "+fn+": "+msg); throw new Error("[ENT "+fn+"] "+msg); }
  function logWarn(fn,msg){ if(debugMode) console.warn("[ENT] "+fn+": "+msg); }
  function createSceneState(){
    return { entities:[], typeMap:Object.create(null), groupMap:Object.create(null), typeGroupMap:Object.create(null),
      idx:{health:new Map(),x:new Map(),y:new Map()},
      idxDirty:{health:true,x:true,y:true},
      idxSorted:{health:[],x:[],y:[]}, needsSweep:false };
  }
  function getScene(n){ if(!scenes[n]) scenes[n]=createSceneState(); return scenes[n]; }
  function activeScene(){ return getScene(currentScene); }
  function tgKey(t,g){ return t+"\u0000"+g; }
  function lowerBound(arr,val){ var lo=0,hi=arr.length; while(lo<hi){ var m=(lo+hi)>>>1; if(arr[m].value<val) lo=m+1; else hi=m; } return lo; }
  function upperBound(arr,val){ var lo=0,hi=arr.length; while(lo<hi){ var m=(lo+hi)>>>1; if(arr[m].value<=val) lo=m+1; else hi=m; } return lo; }
  function idxSet(scene,key,e,v){
    var map=scene.idx[key];
    var oldV=map.get(e);
    map.set(e,v);
    if(!scene.idxDirty[key]){
      var sorted=scene.idxSorted[key];
      if(oldV!==undefined){
        var oldPos=lowerBound(sorted,oldV);
        if(oldPos<sorted.length && sorted[oldPos].entity===e) sorted.splice(oldPos,1);
      }
      var newPos=lowerBound(sorted,v);
      sorted.splice(newPos,0,{value:v,entity:e});
    }
  }
  function idxDel(scene,key,e){
    var map=scene.idx[key];
    var oldV=map.get(e);
    map.delete(e);
    if(!scene.idxDirty[key] && oldV!==undefined){
      var sorted=scene.idxSorted[key];
      var pos=lowerBound(sorted,oldV);
      if(pos<sorted.length && sorted[pos].entity===e) sorted.splice(pos,1);
    }
  }
  function idxGetSorted(scene,key){
    if(!scene.idxDirty[key]) return scene.idxSorted[key];
    var m=scene.idx[key]; var arr=new Array(m.size); var i=0;
    m.forEach(function(v,e){ arr[i++]={value:v,entity:e}; });
    arr.sort(function(a,b){ return a.value-b.value; });
    scene.idxSorted[key]=arr; scene.idxDirty[key]=false; return arr;
  }
  function markDirty(scene,key){ scene.idxDirty[key]=true; }
  function rebuildIndexes(scene){
    for(var k=0;k<INDEXED_PROPS.length;k++){
      var key=INDEXED_PROPS[k]; var m=scene.idx[key]; var arr=new Array(m.size); var i=0;
      m.forEach(function(v,e){ arr[i++]={value:v,entity:e}; });
      arr.sort(function(a,b){ return a.value-b.value; });
      scene.idxSorted[key]=arr; scene.idxDirty[key]=false;
    }
  }
  function Entity(type,data,scene){
    this.id=nextId++; this.type=type; this.data={}; this.scene=scene; this.dead=false;
    if(data){ for(var k in data){ if(Object.prototype.hasOwnProperty.call(data,k)) this.data[k]=data[k]; } }
  }
  Entity.prototype.get=function(k){ return this.data[k]; };
  Entity.prototype.has=function(k){ return this.data[k]!==undefined; };
  Entity.prototype.set=function(k,v){
    var o=this.data[k];
    if(o===v) return this;
    if(k==="group"){
      var oldG=o;
      if(oldG!==undefined){ var arrOld=this.scene.typeGroupMap[tgKey(this.type,oldG)]; if(arrOld){ var idx=arrOld.indexOf(this); if(idx>=0) arrOld.splice(idx,1); } }
      this.data[k]=v;
      if(v!==undefined){ var key=tgKey(this.type,v); var arr=this.scene.typeGroupMap[key]; if(!arr){ arr=this.scene.typeGroupMap[key]=[]; } arr.push(this); }
      return this;
    }
    this.data[k]=v;
    if(INDEXED_PROPS.indexOf(k)!==-1){
      if(o===undefined) idxSet(this.scene,k,this,v);
      else if(v===undefined) idxDel(this.scene,k,this);
      else idxSet(this.scene,k,this,v);
    }
    return this;
  };
  Entity.prototype.give=function(k,v){ return this.set(k,v); };
  Entity.prototype.take=function(k){
    var o=this.data[k];
    if(k==="group" && o!==undefined){ var arrOld=this.scene.typeGroupMap[tgKey(this.type,o)]; if(arrOld){ var idx=arrOld.indexOf(this); if(idx>=0) arrOld.splice(idx,1); } }
    delete this.data[k];
    if(INDEXED_PROPS.indexOf(k)!==-1 && o!==undefined) idxDel(this.scene,k,this);
    return this;
  };
  Entity.prototype.kill=function(){ if(this.dead) return; this.dead=true; this.scene.needsSweep=true; };
  function parseOp(op){
    if(typeof op==="number") return {op:"=",v:op};
    if(typeof op==="boolean") return {op:"=",v:op};
    if(typeof op==="string"){
      var m=/^(<=|>=|==|<|>|=)?\s*(.+)$/.exec(op);
      if(!m) return {op:"never"};
      var o=m[1]||"="; if(o==="==") o="=";
      var n=Number(m[2]); return {op:o,v:isNaN(n)?m[2]:n};
    }
    return {op:"never"};
  }
  function compileObj(cond){
    var keys=Object.keys(cond); var specs=new Array(keys.length);
    for(var i=0;i<keys.length;i++){ specs[i]={k:keys[i],p:parseOp(cond[keys[i]])}; }
    return function(e){ for(var i=0;i<specs.length;i++){ var s=specs[i], v=e.data[s.k], p=s.p;
      if(p.op==="="){ if(v!==p.v) return false; }
      else if(p.op==="<"){ if(!(v<p.v)) return false; }
      else if(p.op==="<="){ if(!(v<=p.v)) return false; }
      else if(p.op===">"){ if(!(v>p.v)) return false; }
      else if(p.op===">="){ if(!(v>=p.v)) return false; }
      else return false;
    } return true; };
  }
  function compileCond(cond){ if(typeof cond==="function") return cond; return compileObj(cond); }
  function extractIndexHint(cond){
    if(!cond||typeof cond!=="object"||typeof cond==="function") return null;
    var keys=Object.keys(cond); if(keys.length!==1) return null;
    var k=keys[0]; if(INDEXED_PROPS.indexOf(k)===-1) return null;
    var p=parseOp(cond[k]); if(p.op==="never") return null;
    if(typeof p.v!=="number") return null;
    return {key:k,op:p.op,v:p.v};
  }
  function Builder(getList, getIndexedList){ this._getList=getList; this._getIndexedList=getIndexedList||null; this._cond=null; this._fn=null; this._hint=null; this._negate=false; }
  Builder.prototype.where=function(cond){
    if(cond===null||cond===undefined) logError("where","Kosul null olamaz");
    if(typeof cond!=="function"&&typeof cond!=="object") logError("where","Kosul fn veya obje olmali");
    var b=new Builder(this._getList, this._getIndexedList); b._cond=cond; b._fn=compileCond(cond); b._hint=extractIndexHint(cond); return b;
  };
  Builder.prototype["if"]=Builder.prototype.where;
  Builder.prototype._iterate=function(cb){
    var hint=this._hint, neg=this._negate, fn=this._fn;
    if(hint && !neg && this._getIndexedList){
      var sorted=this._getIndexedList(hint.key);
      var lo=0, hi=sorted.length;
      if(hint.op==="<"){ hi=lowerBound(sorted,hint.v); }
      else if(hint.op==="<="){ hi=upperBound(sorted,hint.v); }
      else if(hint.op===">"){ lo=upperBound(sorted,hint.v); }
      else if(hint.op===">="){ lo=lowerBound(sorted,hint.v); }
      else if(hint.op==="="){ lo=lowerBound(sorted,hint.v); hi=upperBound(sorted,hint.v); }
      else { return; }
      for(var i=lo;i<hi;i++){ var e=sorted[i].entity; if(!e.dead && fn(e)) cb(e); }
      return;
    }
    var list=this._getList(); var len=list.length;
    for(var j=0;j<len;j++){ var e2=list[j]; if(e2.dead) continue; var ok=fn?fn(e2):true; if(neg) ok=!ok; if(ok) cb(e2); }
  };
  Builder.prototype._count=function(){
    var hint=this._hint, neg=this._negate, fn=this._fn;
    if(hint && !neg && this._getIndexedList){
      var sorted=this._getIndexedList(hint.key);
      var lo=0, hi=sorted.length;
      if(hint.op==="<"){ hi=lowerBound(sorted,hint.v); }
      else if(hint.op==="<="){ hi=upperBound(sorted,hint.v); }
      else if(hint.op===">"){ lo=upperBound(sorted,hint.v); }
      else if(hint.op===">="){ lo=lowerBound(sorted,hint.v); }
      else if(hint.op==="="){ lo=lowerBound(sorted,hint.v); hi=upperBound(sorted,hint.v); }
      else { return 0; }
      var n=0; for(var i=lo;i<hi;i++){ var e=sorted[i].entity; if(!e.dead && fn(e)) n++; } return n;
    }
    var list=this._getList(); var len=list.length; var cnt=0;
    if(neg){
      if(fn){ for(var j=0;j<len;j++){ var e2=list[j]; if(e2.dead) continue; if(!fn(e2)) cnt++; } }
      else { for(var k=0;k<len;k++){ if(!list[k].dead) cnt++; } }
    } else if(fn){
      for(var m=0;m<len;m++){ var e3=list[m]; if(e3.dead) continue; if(fn(e3)) cnt++; }
    } else {
      for(var n=0;n<len;n++){ if(!list[n].dead) cnt++; }
    }
    return cnt;
  };
  Object.defineProperty(Builder.prototype,"true",{ get:function(){
    var self=this;
    return {
      count:function(){ return self._count(); },
      list:function(){ var out=[]; self._iterate(function(e){ out.push(e); }); return out; },
      first:function(){ var r=null,done=false; self._iterate(function(e){ if(!done){ r=e; done=true; } }); return r; },
      each:function(fn){ var n=0; self._iterate(function(e){ fn(e,n++); }); return n; },
      do:function(fn){ var n=0; self._iterate(function(e){ fn(e,n++); }); return n; },
      kill:function(){ var n=0,sc=activeScene(); self._iterate(function(e){ e.dead=true; n++; }); if(n){ sc.needsSweep=true; sc.idxDirty.health=true; sc.idxDirty.x=true; sc.idxDirty.y=true; } return n; },
      give:function(k,v){ var n=0; self._iterate(function(e){ e.set(k,v); n++; }); return n; },
      take:function(k){ var n=0; self._iterate(function(e){ e.take(k); n++; }); return n; },
      set:function(k,v){ var n=0; self._iterate(function(e){ e.set(k,v); n++; }); return n; },
      where:function(c){ return self.where(c).true; }
    };
  }});
  Object.defineProperty(Builder.prototype,"false",{ get:function(){
    var b=new Builder(this._getList, this._getIndexedList);
    b._cond=this._cond; b._fn=this._fn; b._hint=null; b._negate=!this._negate;
    return b.true;
  }});
  ["count","list","first","each","do","kill","give","take","set"].forEach(function(m){ Builder.prototype[m]=function(){ return this.true[m].apply(this.true,arguments); }; });
  function spawn(type,data){
    if(typeof type!=="string"||!type) logError("spawn","Type string ve bos olmayan olmali");
    var scene=activeScene(); var e=new Entity(type,data||null,scene);
    scene.entities.push(e);
    var tm=scene.typeMap[type]; if(!tm){ tm=scene.typeMap[type]=[]; } tm.push(e);
    var g=e.data.group; if(g!==undefined){ var gm=scene.groupMap[g]; if(!gm){ gm=scene.groupMap[g]=[]; } gm.push(e);
      var key=tgKey(type,g); var tgm=scene.typeGroupMap[key]; if(!tgm){ tgm=scene.typeGroupMap[key]=[]; } tgm.push(e); }
    for(var k=0;k<INDEXED_PROPS.length;k++){ var p=INDEXED_PROPS[k]; var v=e.data[p]; if(v!==undefined) idxSet(scene,p,e,v); }
    return e;
  }
  function sweep(){
    var scene=activeScene(); if(!scene.needsSweep) return 0;
    scene.idxDirty.health=true; scene.idxDirty.x=true; scene.idxDirty.y=true;
    var ents=scene.entities, kept=[], removed=0;
    for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e.dead){ removed++; for(var k=0;k<INDEXED_PROPS.length;k++) idxDel(scene,INDEXED_PROPS[k],e); } else kept.push(e); }
    scene.entities=kept;
    var tm=Object.create(null); for(var t in scene.typeMap){ if(!Object.prototype.hasOwnProperty.call(scene.typeMap,t)) continue; var src=scene.typeMap[t],out=[]; for(var a=0;a<src.length;a++){ if(!src[a].dead) out.push(src[a]); } if(out.length) tm[t]=out; } scene.typeMap=tm;
    var gm=Object.create(null); for(var g in scene.groupMap){ if(!Object.prototype.hasOwnProperty.call(scene.groupMap,g)) continue; var gs=scene.groupMap[g],go=[]; for(var b=0;b<gs.length;b++){ if(!gs[b].dead) go.push(gs[b]); } if(go.length) gm[g]=go; } scene.groupMap=gm;
    var tgm=Object.create(null); for(var tk in scene.typeGroupMap){ if(!Object.prototype.hasOwnProperty.call(scene.typeGroupMap,tk)) continue; var tgs=scene.typeGroupMap[tk],tgo=[]; for(var c=0;c<tgs.length;c++){ if(!tgs[c].dead) tgo.push(tgs[c]); } if(tgo.length) tgm[tk]=tgo; } scene.typeGroupMap=tgm;
    scene.needsSweep=false; return removed;
  }
  var timerAPI={
    create:function(name,interval,cb){
      if(typeof name!=="string"||!name) logError("timer.create","Name bos olmayan string");
      if(typeof interval!=="number"||interval<=0||!isFinite(interval)) logError("timer.create","Interval pozitif sayi");
      if(typeof cb!=="function") logError("timer.create","Callback fn olmali");
      timers[name]={interval:interval,elapsed:0,callback:cb,active:true,once:false}; return timerAPI;
    },
    once:function(name,interval,cb){ timerAPI.create(name,interval,cb); timers[name].once=true; return timerAPI; },
    stop:function(n){ if(timers[n]) timers[n].active=false; return timerAPI; },
    start:function(n){ if(timers[n]) timers[n].active=true; return timerAPI; },
    remove:function(n){ delete timers[n]; return timerAPI; },
    remaining:function(n){ var t=timers[n]; return t?Math.max(0,t.interval-t.elapsed):0; },
    active:function(n){ return !!(timers[n]&&timers[n].active); },
    list:function(){ return Object.keys(timers); },
    after:function(delay,cb){
      if(typeof delay!=="number"||delay<0||!isFinite(delay)) logError("after","Delay >=0 sayi");
      if(typeof cb!=="function") logError("after","Callback fn olmali");
      if(delay===0){ cb(0); return timerAPI; }
      var n="__after_"+(nextId++); timers[n]={interval:delay,elapsed:0,callback:cb,active:true,once:true}; return timerAPI;
    }
  };
  function update(dt){
    if(typeof dt!=="number"){ logWarn("update","dt sayi"); return; }
    if(!isFinite(dt)||dt<0){ logWarn("update","dt negatif"); return; }
    if(dt===0) return;
    timeAccumulator+=dt;
    for(var name in timers){ if(!Object.prototype.hasOwnProperty.call(timers,name)) continue; var t=timers[name]; if(!t.active) continue; t.elapsed+=dt; var guard=0; while(t.elapsed>=t.interval&&guard++<1000){ try{ t.callback(t.elapsed); }catch(err){ if(debugMode) console.error(err); } if(t.once){ delete timers[name]; break; } t.elapsed-=t.interval; } }
  }
  function builderFromTag(tag,group){
    if(group){
      var key=tgKey(tag,group);
      return new Builder(
        function(){ return activeScene().typeGroupMap[key]||[]; },
        function(prop){ return idxGetSorted(activeScene(),prop); }
      );
    }
    return new Builder(
      function(){ return activeScene().typeMap[tag]||[]; },
      function(prop){ return idxGetSorted(activeScene(),prop); }
    );
  }
  function makeTagProxy(tag){
    return new Proxy({},{ get:function(_t,prop){
      if(typeof prop!=="string") return undefined;
      if(prop==="where") return function(c){ return builderFromTag(tag,null).where(c); };
      if(prop==="count"||prop==="list"||prop==="first"||prop==="kill"||prop==="each"||prop==="do"){ var b=builderFromTag(tag,null); return function(){ return b.true[prop].apply(b.true,arguments); }; }
      return builderFromTag(tag,prop);
    }});
  }
  function sceneBuilder(sceneRef){
    return new Builder(
      function(){ return sceneRef().entities; },
      function(prop){ return idxGetSorted(sceneRef(),prop); }
    );
  }
  var entCore={
    version:VERSION, spawn:spawn, create:spawn, sweep:sweep,
    clear:function(){ var s=activeScene(); s.entities=[]; s.typeMap=Object.create(null); s.groupMap=Object.create(null); s.typeGroupMap=Object.create(null); s.idx={health:new Map(),x:new Map(),y:new Map()}; s.idxDirty={health:true,x:true,y:true}; s.idxSorted={health:[],x:[],y:[]}; s.needsSweep=false; },
    clearAll:function(){ scenes=Object.create(null); scenes["default"]=createSceneState(); currentScene="default"; timers=Object.create(null); timeAccumulator=0; nextId=1; },
    debug:function(on){ debugMode=!!on; return debugMode; },
    update:update,
    tag:function(n){ if(typeof n!=="string"||!n) logError("tag","Tag bos olmayan string"); return makeTagProxy(n); },
    timer:timerAPI,
    after:function(d,cb){ return timerAPI.after(d,cb); },
    scene:function(name){ if(name===undefined) return currentScene; if(typeof name!=="string") logError("scene","Sahne string olmali"); if(name==="") logError("scene","Sahne bos olamaz"); currentScene=name; getScene(name); timeAccumulator=0; return sceneBuilder(function(){ return getScene(name); }); },
    scenes:function(){ return Object.keys(scenes); },
    with:sceneBuilder(activeScene),
    all:sceneBuilder(activeScene)
  };
  Object.defineProperty(entCore,"count",{ get:function(){ sweep(); return activeScene().entities.length; } });
  Object.defineProperty(entCore,"types",{ get:function(){ return Object.keys(activeScene().typeMap); } });
  Object.defineProperty(entCore,"list",{ get:function(){ return activeScene().entities.slice(); } });
  Object.defineProperty(entCore,"time",{ get:function(){ return timeAccumulator; } });
  var ent=new Proxy(entCore,{ get:function(target,prop){
    if(prop in target) return target[prop];
    if(typeof prop!=="string") return undefined;
    var tn=prop;
    return new Builder(function(){ return activeScene().typeMap[tn]||[]; }, function(p){ return idxGetSorted(activeScene(),p); });
  }});
  var helpers={
    distance:function(a,b){ if(!a||!b) return Infinity; var ax=a.get("x")||0, ay=a.get("y")||0, bx=b.get("x")||0, by=b.get("y")||0; var dx=ax-bx, dy=ay-by; return Math.sqrt(dx*dx+dy*dy); },
    near:function(a,b,r){ if(!a||!b) return false; return helpers.distance(a,b)<=(r||100); }
  };
  global.ent=ent; global.EntEntity=Entity; global.EntBuilder=Builder; global.EntHelpers=helpers;
  if(typeof module!=="undefined"&&module.exports){ module.exports={ent:ent,Entity:Entity,Builder:Builder,Helpers:helpers,VERSION:VERSION}; }
})(typeof window!=="undefined"?window:global);
