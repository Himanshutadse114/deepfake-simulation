(async function bootAwarenessUi(){
  const mount=document.getElementById('uiBoot');
  const read=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error(`${path} failed (${response.status})`);return response.text()};
  try{
    const [htmlParts,cssParts,jsParts]=await Promise.all([
      Promise.all([1,2,3].map(i=>read(`/ui-html-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-css-${i}.txt`))),
      Promise.all([1,2,3].map(i=>read(`/ui-js-${i}.txt`)))
    ]);
    const style=document.createElement('style');style.textContent=cssParts.join('');document.head.appendChild(style);
    mount.outerHTML=htmlParts.join('');
    const blob=new Blob([jsParts.join('')],{type:'text/javascript'});const url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('UI runtime failed to load'));document.body.appendChild(s)});
    URL.revokeObjectURL(url);
  }catch(error){console.error(error);document.body.innerHTML='<main style="font-family:system-ui;background:#06080d;color:white;min-height:100vh;display:grid;place-items:center;padding:24px"><div><h1>UI could not load</h1><p>Please refresh the page.</p></div></main>'}
})();
