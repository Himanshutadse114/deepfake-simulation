(() => {
  const recorder = document.getElementById('recordContainer');
  if (!recorder || recorder.dataset.guideReady === 'true') return;
  recorder.dataset.guideReady = 'true';

  const scriptText = 'Hello, this is my voice sample for the security awareness simulation. I am speaking clearly at my normal pace. A familiar voice can be copied, so unusual requests should always be verified through a trusted channel.';

  const timer = document.getElementById('recordTimer');
  const guide = document.createElement('div');
  guide.className = 'voice-read-guide';
  guide.innerHTML = `
    <div class="voice-read-label"><span></span>Read this aloud</div>
    <p>${scriptText}</p>
    <small>Speak naturally and clearly. Keep a steady pace and avoid background noise.</small>
  `;

  if (timer) timer.insertAdjacentElement('afterend', guide);
  else recorder.appendChild(guide);

  const style = document.createElement('style');
  style.textContent = `
    #recordContainer{
      padding:clamp(16px,2.4vw,26px)!important;
      overflow-y:auto!important;
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
    }
    .voice-read-guide{
      width:min(560px,92%);
      margin:0 auto 16px;
      padding:14px 16px;
      border:1px solid rgba(241,90,36,.28);
      border-radius:14px;
      background:linear-gradient(180deg,rgba(241,90,36,.08),rgba(255,255,255,.025));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
      text-align:left;
    }
    .voice-read-label{
      display:flex;
      align-items:center;
      gap:8px;
      margin-bottom:8px;
      color:var(--orange,#f15a24);
      font-size:11px;
      line-height:1;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .voice-read-label span{
      width:7px;
      height:7px;
      flex:0 0 7px;
      border-radius:50%;
      background:currentColor;
      box-shadow:0 0 0 4px rgba(241,90,36,.1);
    }
    .voice-read-guide p{
      margin:0 0 8px!important;
      color:var(--text,#f5f7fb)!important;
      font-size:clamp(13px,1.08vw,16px)!important;
      line-height:1.55!important;
      font-weight:600!important;
      letter-spacing:0!important;
    }
    .voice-read-guide small{
      display:block;
      color:var(--muted,#98a4b5);
      font-size:10px;
      line-height:1.4;
    }
    #recordContainer #recordTimer{
      margin:7px 0 12px!important;
      font-size:20px!important;
    }
    @media(max-width:640px){
      #recordContainer{
        justify-content:flex-start!important;
        padding:18px 12px 22px!important;
      }
      #recordContainer>div:first-child{margin-top:2px!important}
      .voice-read-guide{
        width:100%;
        margin:0 auto 12px;
        padding:12px 13px;
        border-radius:12px;
      }
      .voice-read-guide p{
        font-size:13px!important;
        line-height:1.48!important;
      }
      .voice-read-guide small{font-size:9.5px}
      #recordContainer #recordTimer{font-size:18px!important;margin-bottom:10px!important}
      #recordContainer>div:last-child{
        flex-wrap:wrap;
        justify-content:center;
        width:100%;
      }
      #recordContainer>div:last-child button{
        min-width:128px;
      }
    }
    @media(max-width:390px){
      .voice-read-guide p{font-size:12.5px!important}
      #recordContainer>div:last-child button{
        width:100%;
        min-width:0;
      }
    }
  `;
  document.head.appendChild(style);
})();
