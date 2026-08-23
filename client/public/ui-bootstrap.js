(async function bootAwarenessUi(){
  const mount=document.getElementById('uiBoot');
  const demoInstance=document.body?.dataset?.demoInstance==='true'||location.pathname==='/demo';
  const read=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error(`${path} failed (${response.status})`);return response.text()};
  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`${src} failed to load`));document.body.appendChild(s)});
  try{
    const [htmlParts,cssParts,jsParts]=await Promise.all([
      Promise.all([1,2,3].map(i=>read(`/ui-html-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-css-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-js-${i}.txt`)))
    ]);
    const style=document.createElement('style');
    style.textContent=cssParts.join('')+`
      .script-card{display:none!important}
      .screen[hidden],.screen:not(.active){display:none!important;visibility:hidden!important;pointer-events:none!important}
      .screen.active{display:block!important;visibility:visible!important;pointer-events:auto!important}
      .wa-typing-dots{display:flex;align-items:center;gap:4px;min-width:42px;padding:3px 1px}
      .wa-typing-dots span{width:7px;height:7px;border-radius:50%;background:#8696a0;opacity:.35;animation:waTypingPulse 1.15s infinite ease-in-out}
      .wa-typing-dots span:nth-child(2){animation-delay:.14s}
      .wa-typing-dots span:nth-child(3){animation-delay:.28s}
      @keyframes waTypingPulse{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}
      #waProceedDock{text-align:center!important;width:100%!important}
      #waProceedDock .wide-action{margin-left:auto!important;margin-right:auto!important;display:flex!important}
      .demo-instance-badge{position:fixed;left:18px;top:max(14px,env(safe-area-inset-top));z-index:95;padding:9px 12px;border-radius:999px;background:rgba(20,27,38,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 32px rgba(0,0,0,.28);backdrop-filter:blur(14px);font-size:10px;line-height:1;color:#dce5ef;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
      .demo-instance-badge i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#25d366;margin-right:7px;box-shadow:0 0 12px rgba(37,211,102,.6)}
      html[data-demo-instance="true"] .intro-actions .primary{width:min(520px,calc(100% - 32px))!important;margin-inline:auto!important}
      .hero-visual .face-card img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;display:block!important}
      @media(max-width:640px){.demo-instance-badge{left:12px;top:12px;font-size:9px;padding:8px 10px}.intro-actions .primary{width:calc(100% - 24px)!important}}
    `;
    document.head.appendChild(style);
    mount.outerHTML=htmlParts.join('');

    const app=document.getElementById('app');
    const orphanGenerateCopy=document.querySelector('.generate-copy:not(.generate-wrap .generate-copy)');
    if(app&&!app.querySelector('.screen[data-screen="generate"]')&&orphanGenerateCopy){
      const generationScreen=document.createElement('section');
      generationScreen.className='screen';
      generationScreen.dataset.screen='generate';
      generationScreen.hidden=true;
      generationScreen.setAttribute('aria-hidden','true');
      generationScreen.innerHTML=`
        <div class="screen-inner">
          <div class="viewport center">
            <div class="generate-wrap">
              <div class="scan-stage" aria-label="Simulation preparation preview">
                <img class="shared-face" src="/Deepfake.png?v=5" alt="Portrait being prepared for the awareness simulation">
                <div class="scan-tint"></div>
                <div class="scan-glow"></div>
                <div class="scan-line"></div>
                <div class="scan-label"><span>Secure awareness pipeline</span><strong id="scanState">0%</strong></div>
              </div>
            </div>
          </div>
        </div>`;
      generationScreen.querySelector('.generate-wrap').appendChild(orphanGenerateCopy);
      const mediaScreen=app.querySelector('.screen[data-screen="media"]');
      if(mediaScreen)mediaScreen.after(generationScreen);else app.appendChild(generationScreen);
    }

    const heroImage=document.querySelector('.hero-visual .face-card img');
    if(heroImage){
      heroImage.src='/Deepfake.png?v=5';
      heroImage.alt='Deepfake awareness illustration';
    }

    const blob=new Blob([jsParts.join('')],{type:'text/javascript'});const url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('UI runtime failed to load'));document.body.appendChild(s)});
    URL.revokeObjectURL(url);
    await loadScript('/wa-polish.js?v=4');
    await loadScript('/experience-polish.js?v=1');
    await loadScript('/editorial-newspaper.js?v=2');
    await loadScript('/editorial-scroll-reset.js?v=1');
    await loadScript('/responsive-polish.js?v=2');
    await loadScript('/qr-polish.js?v=1');
    await loadScript('/wa-flow-fix.js?v=3');
    await loadScript('/wa-replay-reset.js?v=1');
    await loadScript('/editorial-cta-fix.js?v=1');
    await loadScript('/final-flow-polish.js?v=2');
    await loadScript('/wa-call-ringtone.js?v=1');
    await loadScript('/camera-face-guide.js?v=2');
    await loadScript('/instagram-video-grid.js?v=1mp-3photos-20260823-1');
    const enforceScreenVisibility=(name)=>{
      document.querySelectorAll('.screen').forEach(screen=>{
        const active=screen.dataset.screen===name;
        screen.classList.toggle('active',active);
        screen.hidden=!active;
        screen.setAttribute('aria-hidden',active?'false':'true');
      });
    };
    if(typeof window.go==='function'){
      const originalGo=window.go;
      window.go=function(name){
        enforceScreenVisibility(name);
        const result=originalGo.call(this,name);
        enforceScreenVisibility(name);
        return result;
      };
    }
    enforceScreenVisibility('intro');

    const applyInternalScriptPlaceholders=()=>{
      const wa=document.getElementById('whatsappScriptInput');
      const video=document.getElementById('videoScriptInput');
      if(wa)wa.value='AI awareness script configured by the administrator.';
      if(video)video.value='Deepfake awareness script configured by the administrator.';
      if(typeof window.checkMediaReady==='function')window.checkMediaReady();
    };
    applyInternalScriptPlaceholders();

    if(demoInstance){
      document.documentElement.dataset.demoInstance='true';
      document.title='Deepfake Awareness Demo';
      window.runMode='demo';
      const badge=document.createElement('div');
      badge.className='demo-instance-badge';
      badge.innerHTML='<i></i>Internal demo · no AI calls';
      document.body.appendChild(badge);
      const introActions=document.querySelector('.intro-actions');
      if(introActions){introActions.innerHTML='<button class="primary wide-action" onclick="selectRunMode(\'demo\')">Start demo <span>→</span></button>'}
      if(typeof window.selectRunMode==='function'){
        const originalSelect=window.selectRunMode;
        window.selectRunMode=function(){window.runMode='demo';return originalSelect.call(this,'demo')};
      }
    }

    if(typeof window.startGeneration==='function'){
      const originalStart=window.startGeneration;
      window.startGeneration=function(...args){
        applyInternalScriptPlaceholders();
        if(demoInstance)window.runMode='demo';
        enforceScreenVisibility('generate');
        const result=originalStart.apply(this,args);
        queueMicrotask(()=>enforceScreenVisibility('generate'));
        return result;
      };
    }
    if(typeof window.resetSimulation==='function'){
      const originalReset=window.resetSimulation;
      window.resetSimulation=async function(...args){const result=await originalReset.apply(this,args);applyInternalScriptPlaceholders();if(demoInstance)window.runMode='demo';enforceScreenVisibility('intro');return result};
    }
  }catch(error){console.error(error);document.body.innerHTML='<main style="font-family:system-ui;background:#06080d;color:white;min-height:100vh;display:grid;place-items:center;padding:24px"><div><h1>UI could not load</h1><p>Please refresh the page.</p></div></main>'}
})();
