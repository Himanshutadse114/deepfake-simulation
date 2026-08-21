(() => {
  function installRecorderPrompt() {
    const recorder = document.getElementById('recordContainer');
    if (!recorder || recorder.dataset.scriptPromptReady === 'true') return false;

    const timer = document.getElementById('recordTimer');
    if (!timer) return false;

    recorder.dataset.scriptPromptReady = 'true';

    const prompt = document.createElement('div');
    prompt.className = 'voice-read-prompt';
    prompt.innerHTML = `
      <div class="voice-read-label"><span></span> Read this aloud</div>
      <p>“Hello, this is my voice sample for an authorised security awareness simulation. Today I am speaking clearly and naturally at my normal pace. A familiar voice can be imitated by AI, so unusual requests should always be verified through a trusted channel.”</p>
      <small>Speak naturally and clearly. Keep a steady pace and avoid background noise.</small>
    `;
    timer.insertAdjacentElement('beforebegin', prompt);
    return true;
  }

  if (!document.getElementById('voiceRecordingPromptStyles')) {
    const style = document.createElement('style');
    style.id = 'voiceRecordingPromptStyles';
    style.textContent = `
      #recordContainer{
        padding:18px 20px!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        -webkit-overflow-scrolling:touch;
        text-align:center;
      }
      .voice-read-prompt{
        width:min(560px,92%);
        margin:12px auto;
        padding:14px 16px;
        border:1px solid rgba(241,90,36,.28);
        border-radius:12px;
        background:rgba(241,90,36,.07);
        text-align:left;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
      }
      .voice-read-label{
        display:flex;
        align-items:center;
        gap:7px;
        margin-bottom:7px;
        color:var(--orange2,#ff7445);
        font-size:10px;
        line-height:1;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .voice-read-label span{
        width:7px;
        height:7px;
        flex:none;
        border-radius:50%;
        background:var(--orange2,#ff7445);
        box-shadow:0 0 10px rgba(241,90,36,.45);
      }
      .voice-read-prompt p{
        margin:0!important;
        color:var(--text,#f2f5f8)!important;
        font-size:13px!important;
        line-height:1.55!important;
        font-weight:500;
      }
      .voice-read-prompt small{
        display:block;
        margin-top:8px;
        color:var(--muted,#9ba7b4);
        font-size:10px;
        line-height:1.4;
      }
      #recordTimer{
        margin:5px 0 12px!important;
        font-size:22px!important;
      }

      @media(max-width:700px){
        #recordContainer{
          justify-content:flex-start!important;
          padding:16px 12px 20px!important;
        }
        .voice-read-prompt{
          width:100%;
          margin:9px auto;
          padding:12px 13px;
        }
        .voice-read-prompt p{
          font-size:12.5px!important;
          line-height:1.48!important;
        }
        .voice-read-prompt small{font-size:9.5px}
        #recordTimer{font-size:20px!important}
      }

      @media(max-height:680px){
        .voice-read-prompt{
          margin:7px auto;
          padding:9px 11px;
        }
        .voice-read-prompt p{
          font-size:11.5px!important;
          line-height:1.42!important;
        }
        .voice-read-prompt small{margin-top:5px}
        #recordTimer{margin:3px 0 8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  if (installRecorderPrompt()) return;

  const observer = new MutationObserver(() => {
    if (installRecorderPrompt()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('load', installRecorderPrompt, { once: true });
})();
