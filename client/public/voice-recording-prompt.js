(() => {
  const PROMPT_TEXT = 'Hello, this is my voice sample for an authorised security awareness simulation. Today I am speaking clearly and naturally at my normal pace. A familiar voice can be imitated by AI, so unusual requests should always be verified through a trusted channel.';

  function installRecorderPrompt() {
    const recorder = document.getElementById('recordContainer');
    if (!recorder || recorder.dataset.teleprompterReady === 'true') return false;

    recorder.dataset.teleprompterReady = 'true';
    recorder.setAttribute('role', 'dialog');
    recorder.setAttribute('aria-modal', 'true');
    recorder.setAttribute('aria-labelledby', 'voiceTeleprompterTitle');

    // Keep the recorder outside the media card so position:fixed remains tied
    // to the viewport even if a browser treats an ancestor as a containing block.
    if (recorder.parentElement !== document.body) document.body.appendChild(recorder);

    recorder.innerHTML = `
      <div class="voice-teleprompter-shell">
        <header class="voice-teleprompter-head">
          <div>
            <div class="voice-teleprompter-kicker"><i></i> Voice sample</div>
            <h2 id="voiceTeleprompterTitle">Read this aloud naturally</h2>
            <p>Look at the words, speak at your normal pace, and keep the microphone close enough to hear you clearly.</p>
          </div>
          <div class="voice-recording-pill" aria-label="Recording timer">
            <span class="voice-recording-dot"></span>
            <strong>Recording</strong>
            <span id="recordTimer">00:00</span>
          </div>
        </header>

        <main class="voice-teleprompter-stage">
          <div class="voice-teleprompter-script" aria-label="Text to read aloud">“${PROMPT_TEXT}”</div>
          <div class="voice-teleprompter-tip">
            <span>Speak clearly</span>
            <span>Natural pace</span>
            <span>Low background noise</span>
          </div>
        </main>

        <footer class="voice-teleprompter-actions">
          <button type="button" class="primary voice-use-recording" onclick="stopRecording(event)">Use recording</button>
          <button type="button" class="secondary voice-cancel-recording" onclick="cancelRecording(event)">Cancel</button>
        </footer>
      </div>`;

    return true;
  }

  if (!document.getElementById('voiceRecordingPromptStyles')) {
    const style = document.createElement('style');
    style.id = 'voiceRecordingPromptStyles';
    style.textContent = `
      #recordContainer{
        position:fixed!important;
        inset:0!important;
        z-index:2147482900!important;
        width:100vw!important;
        height:100vh!important;
        height:100dvh!important;
        min-height:100%!important;
        margin:0!important;
        padding:0!important;
        border-radius:0!important;
        overflow:hidden!important;
        background:#05070c!important;
        color:#f7f8fb!important;
        align-items:stretch!important;
        justify-content:stretch!important;
        text-align:left!important;
        overscroll-behavior:none;
        -webkit-overflow-scrolling:auto;
      }

      .voice-teleprompter-shell{
        width:100%;
        height:100%;
        min-height:0;
        display:grid;
        grid-template-rows:auto minmax(0,1fr) auto;
        background:
          radial-gradient(circle at 14% 12%,rgba(241,90,36,.12),transparent 28%),
          radial-gradient(circle at 86% 15%,rgba(106,168,255,.08),transparent 27%),
          #05070c;
      }

      .voice-teleprompter-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:24px;
        padding:max(24px,env(safe-area-inset-top)) max(24px,4vw) 18px;
        border-bottom:1px solid rgba(255,255,255,.09);
        background:rgba(5,7,12,.88);
        backdrop-filter:blur(18px);
      }
      .voice-teleprompter-head>div:first-child{max-width:720px}
      .voice-teleprompter-kicker{
        display:flex;align-items:center;gap:8px;margin-bottom:9px;
        color:#ff9d55;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
      }
      .voice-teleprompter-kicker i,.voice-recording-dot{
        width:8px;height:8px;border-radius:50%;background:#f15a24;box-shadow:0 0 14px rgba(241,90,36,.55);flex:none;
      }
      .voice-teleprompter-head h2{
        margin:0!important;color:#f7f8fb!important;font-family:Inter,system-ui,sans-serif!important;
        font-size:clamp(21px,2.6vw,34px)!important;line-height:1.08!important;font-weight:700!important;letter-spacing:-.025em!important;
      }
      .voice-teleprompter-head p{
        margin:8px 0 0!important;color:#98a2b4!important;font-size:12px!important;line-height:1.5!important;max-width:680px;
      }
      .voice-recording-pill{
        display:flex;align-items:center;gap:9px;flex:none;padding:10px 13px;border-radius:999px;
        border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);
        font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;
      }
      .voice-recording-dot{background:#ff5d68;box-shadow:0 0 14px rgba(255,93,104,.55);animation:voiceRecordPulse 1.15s ease-in-out infinite}
      .voice-recording-pill strong{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#ffd5d9}
      #recordTimer{font-size:17px!important;font-weight:800!important;margin:0!important;color:#fff!important;min-width:48px;text-align:right}
      @keyframes voiceRecordPulse{50%{opacity:.38;transform:scale(.78)}}

      .voice-teleprompter-stage{
        min-height:0;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:24px;
        padding:clamp(24px,5vh,60px) max(22px,7vw);
        overflow:hidden;
      }
      .voice-teleprompter-script{
        width:min(980px,100%);
        margin:auto;
        color:#fff;
        font-family:Inter,system-ui,sans-serif;
        font-size:clamp(24px,3.4vw,48px);
        font-weight:560;
        line-height:1.38;
        letter-spacing:-.018em;
        text-align:center;
        text-wrap:balance;
      }
      .voice-teleprompter-tip{
        display:flex;justify-content:center;gap:8px;flex-wrap:wrap;
      }
      .voice-teleprompter-tip span{
        padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);
        color:#aeb7c5;font-size:10px;font-weight:650;
      }

      .voice-teleprompter-actions{
        display:flex;
        justify-content:center;
        gap:10px;
        padding:16px max(18px,4vw) max(18px,env(safe-area-inset-bottom));
        border-top:1px solid rgba(255,255,255,.09);
        background:rgba(5,7,12,.92);
        backdrop-filter:blur(18px);
      }
      .voice-teleprompter-actions button{min-height:50px!important;border-radius:999px!important;padding:0 24px!important}
      .voice-use-recording{width:min(360px,64vw)}

      @media(max-width:700px){
        .voice-teleprompter-head{
          display:grid;grid-template-columns:1fr auto;align-items:start;gap:10px 12px;
          padding:max(18px,env(safe-area-inset-top)) 16px 13px;
        }
        .voice-teleprompter-head>div:first-child{min-width:0}
        .voice-teleprompter-head h2{font-size:20px!important}
        .voice-teleprompter-head p{font-size:10.5px!important;line-height:1.4!important;margin-top:5px!important}
        .voice-recording-pill{padding:8px 10px;gap:6px}
        .voice-recording-pill strong{display:none}
        #recordTimer{font-size:15px!important;min-width:42px}
        .voice-teleprompter-stage{padding:18px 18px 14px;gap:16px}
        .voice-teleprompter-script{
          width:min(680px,100%);
          font-size:clamp(21px,6.1vw,32px);
          line-height:1.42;
          text-align:left;
          text-wrap:pretty;
        }
        .voice-teleprompter-tip{justify-content:flex-start;width:100%}
        .voice-teleprompter-tip span{font-size:9px;padding:6px 8px}
        .voice-teleprompter-actions{padding:12px 14px max(14px,env(safe-area-inset-bottom));}
        .voice-teleprompter-actions button{min-height:48px!important;padding:0 16px!important}
        .voice-use-recording{flex:1;width:auto}
      }

      @media(max-height:620px){
        .voice-teleprompter-head p,.voice-teleprompter-tip{display:none}
        .voice-teleprompter-head{padding-top:max(12px,env(safe-area-inset-top));padding-bottom:10px}
        .voice-teleprompter-stage{padding:10px 18px}
        .voice-teleprompter-script{font-size:clamp(18px,4.5vh,27px);line-height:1.34}
        .voice-teleprompter-actions{padding-top:9px;padding-bottom:max(9px,env(safe-area-inset-bottom))}
        .voice-teleprompter-actions button{min-height:42px!important}
      }

      @media(orientation:landscape) and (max-height:560px){
        .voice-teleprompter-head h2{font-size:18px!important}
        .voice-teleprompter-kicker{margin-bottom:4px}
        .voice-teleprompter-script{font-size:clamp(17px,3.5vw,25px);line-height:1.32;max-width:1000px}
      }

      @media(prefers-reduced-motion:reduce){.voice-recording-dot{animation:none}}
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
