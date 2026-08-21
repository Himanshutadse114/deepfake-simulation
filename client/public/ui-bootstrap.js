(async function bootAwarenessUi(){
  const mount=document.getElementById('uiBoot');
  try{
    const response=await fetch('/ui.html',{cache:'no-store'});
    if(!response.ok) throw new Error(`UI markup failed (${response.status})`);
    mount.outerHTML=await response.text();
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/ui.js';
      script.defer=true;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('UI runtime failed to load'));
      document.body.appendChild(script);
    });
  }catch(error){
    console.error(error);
    document.body.innerHTML='<main style="font-family:system-ui;background:#06080d;color:white;min-height:100vh;display:grid;place-items:center;padding:24px"><div><h1>UI could not load</h1><p>Please refresh the page.</p></div></main>';
  }
})();
