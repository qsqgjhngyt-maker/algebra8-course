(() => {
  "use strict";
  const VERSION="3.0.0-alpha.4.5.1";
  function inventory(){
    const out={legacy:[],v3:[],other:[]};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i); if(!key)continue;
      if(/^a8_|^algebra8|^kitsune_/i.test(key))out.legacy.push(key);
      else if(/^kitsune:v3:/i.test(key))out.v3.push(key);
      else out.other.push(key);
    }
    out.legacy.sort(); out.v3.sort(); return out;
  }
  window.KitsuneMigrationV3={version:VERSION,mode:"read-only-alpha",inventory,canMutate:false};
})();