(async function bootAwarenessUi(){
  const mount=document.getElementById('uiBoot');
  const read=async(path)=>{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok) throw new Error(`${path} failed (${response.status})`);
    return response.text();
  };
  try{
    const [markup,css,code]=await Promise.all([read('/ui.html'),read('/ui.css'),read('/ui.js')]);
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
    mount.outerHTML=markup;
    const blob=new Blob([code],{type:'text/javascript'});
    const url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('UI runtime failed to load'));document.body.appendChild(s)});
    URL.revokeObjectURL(url);
  }catch(error){
    console.error(error);
    document.body.innerHTML='<main style="font-family:system-ui;background:#06080d;color:white;min-height:100vh;display:grid;place-items:center;padding:24px"><div><h1>UI could not load</h1><p>Please refresh the page.</p></div></main>';
  }
})();
