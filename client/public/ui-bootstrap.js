(async function bootAwarenessUi(){
  const mount=document.getElementById('uiBoot');
  const read=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error(`${path} failed (${response.status})`);return response.text()};
  try{
    const [htmlParts,cssParts,jsParts]=await Promise.all([
      Promise.all([1,2,3].map(i=>read(`/ui-html-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-css-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-js-${i}.txt`)))
    ]);
    const style=document.createElement('style');
    style.textContent=cssParts.join('')+`
      .script-card{display:none!important}
      .wa-typing-dots{display:flex;align-items:center;gap:4px;min-width:42px;padding:3px 1px}
      .wa-typing-dots span{width:7px;height:7px;border-radius:50%;background:#8696a0;opacity:.35;animation:waTypingPulse 1.15s infinite ease-in-out}
      .wa-typing-dots span:nth-child(2){animation-delay:.14s}
      .wa-typing-dots span:nth-child(3){animation-delay:.28s}
      @keyframes waTypingPulse{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}
      #waProceedDock{text-align:center!important;width:100%!important}
      #waProceedDock .wide-action{margin-left:auto!important;margin-right:auto!important;display:flex!important}
    `;
    document.head.appendChild(style);
    mount.outerHTML=htmlParts.join('');
    const blob=new Blob([jsParts.join('')],{type:'text/javascript'});const url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('UI runtime failed to load'));document.body.appendChild(s)});
    URL.revokeObjectURL(url);

    // The learner never controls generated speech. Keep the legacy hidden fields
    // populated only so the supplied prototype runtime can continue unchanged;
    // the server ignores these values and snapshots the admin-managed scripts.
    const applyInternalScriptPlaceholders=()=>{
      const wa=document.getElementById('whatsappScriptInput');
      const video=document.getElementById('videoScriptInput');
      if(wa)wa.value='AI awareness script configured by the administrator.';
      if(video)video.value='Deepfake awareness script configured by the administrator.';
      if(typeof window.checkMediaReady==='function')window.checkMediaReady();
    };
    applyInternalScriptPlaceholders();

    if(typeof window.startGeneration==='function'){
      const originalStart=window.startGeneration;
      window.startGeneration=function(...args){applyInternalScriptPlaceholders();return originalStart.apply(this,args)};
    }
    if(typeof window.resetSimulation==='function'){
      const originalReset=window.resetSimulation;
      window.resetSimulation=async function(...args){const result=await originalReset.apply(this,args);applyInternalScriptPlaceholders();return result};
    }
  }catch(error){console.error(error);document.body.innerHTML='<main style="font-family:system-ui;background:#06080d;color:white;min-height:100vh;display:grid;place-items:center;padding:24px"><div><h1>UI could not load</h1><p>Please refresh the page.</p></div></main>'}
})();
