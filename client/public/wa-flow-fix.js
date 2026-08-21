(() => {
  const chatBody = document.getElementById('waChatBody');
  if (!chatBody) return;

  // Completion/navigation belongs inside the conversation itself. Remove the
  // legacy dock so it can never cover the bottom of the chat or fall below a
  // mobile viewport.
  document.getElementById('waProceedDock')?.remove();

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
      setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 80);
    });
  }

  function installInlineCompletionActions() {
    const marker = document.getElementById('waSimulationComplete');
    if (!marker || document.getElementById('waInlineCompletion')) return;

    const block = document.createElement('div');
    block.id = 'waInlineCompletion';
    block.className = 'wa-inline-completion';
    block.innerHTML = `
      <div class="wa-inline-completion-copy">
        <strong>You saw the scam succeed.</strong>
        <span>The familiar voice, urgency and payment prompt were enough to convince the simulated victim.</span>
      </div>
      <div class="wa-inline-actions">
        <button class="secondary wa-inline-replay" type="button" onclick="replayWhatsAppSimulation()">↻ Replay</button>
        <button class="primary wa-inline-next" type="button" onclick="openProfileExperience()">Convinced? Let’s move further →</button>
      </div>
    `;
    marker.insertAdjacentElement('afterend', block);
    scrollChatToBottom();
  }

  // The completion marker is created asynchronously by wa-polish.js.
  const observer = new MutationObserver(() => installInlineCompletionActions());
  observer.observe(chatBody, { childList: true });
  installInlineCompletionActions();

  // Rebuild the header actions as independent controls so the identity stays on
  // the left and all utility icons remain aligned on the right on narrow phones.
  const actions = document.querySelector('.wa-chathead .wa-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="wa-head-action" type="button" onclick="triggerIncomingVideoCall()" aria-label="Video call" title="Video call">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
      </button>
      <span class="wa-head-action wa-head-static" aria-label="Search" title="Search">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
      </span>
      <span class="wa-head-action wa-head-static" aria-label="Menu" title="Menu">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
      </span>
    `;
  }

  // Desktop wheel events can otherwise be consumed by the viewport while the
  // chat itself is the element that owns overflow. Forward wheel movement to
  // the conversation whenever it has scrollable content.
  const waMain = chatBody.closest('.wa-main');
  if (waMain) {
    waMain.addEventListener('wheel', (event) => {
      const max = Math.max(0, chatBody.scrollHeight - chatBody.clientHeight);
      if (!max) return;
      const before = chatBody.scrollTop;
      chatBody.scrollTop = Math.max(0, Math.min(max, before + event.deltaY));
      if (chatBody.scrollTop !== before) event.preventDefault();
    }, { passive: false });
  }

  chatBody.setAttribute('tabindex', '0');

  const style = document.createElement('style');
  style.textContent = `
    /* =========================================================
       WHATSAPP VIEWPORT / SCROLL CHAIN
       Keep header + composer fixed and make only chat history scroll.
    ========================================================== */
    .screen[data-screen="voiceExperience"] .screen-inner{
      height:100dvh!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .screen[data-screen="voiceExperience"] .wa-stage{
      box-sizing:border-box!important;
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
      display:grid!important;
      place-items:center!important;
    }
    .screen[data-screen="voiceExperience"] .whatsapp{
      min-height:0!important;
      height:100%!important;
      max-height:790px!important;
      overflow:hidden!important;
    }
    .screen[data-screen="voiceExperience"] .wa-main{
      display:flex!important;
      flex-direction:column!important;
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .screen[data-screen="voiceExperience"] .wa-chathead,
    .screen[data-screen="voiceExperience"] .wa-input{
      flex:0 0 auto!important;
    }
    .screen[data-screen="voiceExperience"] .wa-chatbody{
      flex:1 1 0!important;
      height:auto!important;
      min-height:0!important;
      max-height:none!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      overscroll-behavior:contain!important;
      -webkit-overflow-scrolling:touch!important;
      touch-action:pan-y!important;
      scroll-behavior:smooth!important;
      scrollbar-gutter:stable!important;
      padding-bottom:34px!important;
      scroll-padding-bottom:34px!important;
    }
    .wa-chatbody::-webkit-scrollbar{width:8px}
    .wa-chatbody::-webkit-scrollbar-track{background:rgba(255,255,255,.02)}
    .wa-chatbody::-webkit-scrollbar-thumb{background:#37444b;border-radius:999px}
    .wa-chatbody::-webkit-scrollbar-thumb:hover{background:#4a5a63}

    /* No external WhatsApp completion footer on any viewport. */
    #waProceedDock{display:none!important}

    /* Header: avatar + identity on the left, actions locked to the right. */
    .wa-chathead{
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr) auto!important;
      align-items:center!important;
      column-gap:10px!important;
    }
    .wa-chathead>.wa-avatar-photo{grid-column:1!important;width:40px!important;height:40px!important;min-width:40px!important}
    .wa-chathead>div:not(.wa-actions){grid-column:2!important;min-width:0!important;overflow:hidden!important}
    .wa-chathead .full-name{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .wa-chathead .wa-actions{
      grid-column:3!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:12px!important;
      min-width:max-content!important;
      margin-left:auto!important;
      letter-spacing:0!important;
      color:#aebac1!important;
      flex:none!important;
    }
    .wa-head-action{
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      flex:0 0 34px;
      padding:0;
      margin:0;
      border:0;
      border-radius:50%;
      background:transparent;
      color:#aebac1;
      line-height:1;
    }
    button.wa-head-action{cursor:pointer}
    button.wa-head-action:hover{background:rgba(255,255,255,.06);color:#e9edef}

    /* Completion becomes part of the scrollable conversation itself. */
    .wa-simulation-complete{
      flex:none!important;
      width:min(620px,94%)!important;
      max-width:min(620px,94%)!important;
      margin:14px auto 6px!important;
      padding:12px 16px!important;
      border-radius:14px!important;
    }
    .wa-inline-completion{
      align-self:center;
      flex:none;
      width:min(620px,94%);
      margin:4px auto 22px;
      padding:14px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:14px;
      background:rgba(17,27,33,.9);
      box-shadow:0 10px 26px rgba(0,0,0,.18);
    }
    .wa-inline-completion-copy{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:4px;
      text-align:center;
      margin-bottom:12px;
    }
    .wa-inline-completion-copy strong{font-size:13px;color:#e9edef}
    .wa-inline-completion-copy span{font-size:10.5px;line-height:1.42;color:#8696a0;max-width:520px}
    .wa-inline-actions{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      flex-wrap:wrap;
    }
    .wa-inline-actions button{min-height:46px;border-radius:10px}
    .wa-inline-replay{min-width:130px}
    .wa-inline-next{min-width:min(360px,100%);padding-inline:22px}

    @media(max-width:700px){
      /* The floating demo badge otherwise covers the contact header on phones. */
      body:has(.screen[data-screen="voiceExperience"].active) .demo-instance-badge{display:none!important}

      .screen[data-screen="voiceExperience"] .wa-stage{padding:0!important;display:block!important}
      .screen[data-screen="voiceExperience"] .whatsapp{
        width:100%!important;
        height:100%!important;
        max-height:none!important;
        border:0!important;
        border-radius:0!important;
      }
      .screen[data-screen="voiceExperience"] .wa-main{width:100%!important}

      .wa-chathead{
        height:58px!important;
        grid-template-columns:38px minmax(0,1fr) auto!important;
        column-gap:8px!important;
        padding:8px 10px!important;
      }
      .wa-chathead>.wa-avatar-photo{width:38px!important;height:38px!important;min-width:38px!important}
      .wa-chathead .full-name{font-size:13px!important;line-height:1.15!important}
      .wa-chathead #waStatus{font-size:10px!important;margin-top:2px!important}
      .wa-chathead .wa-actions{gap:3px!important}
      .wa-head-action{width:32px;height:32px;flex-basis:32px}
      .wa-head-action svg{width:18px;height:18px}

      .wa-chatbody{padding:14px 10px 26px!important}
      .wa-simulation-complete{width:94%!important;max-width:94%!important;margin-top:12px!important}
      .wa-inline-completion{width:94%;margin:4px auto 18px;padding:12px}
      .wa-inline-actions{flex-direction:column-reverse;gap:8px}
      .wa-inline-actions button{width:100%!important;min-width:0!important;min-height:46px!important}
      .wa-inline-completion-copy strong{font-size:12.5px}
      .wa-inline-completion-copy span{font-size:10px}
    }

    @media(max-width:380px){
      .wa-chathead{grid-template-columns:34px minmax(0,1fr) auto!important;padding-inline:8px!important;column-gap:6px!important}
      .wa-chathead>.wa-avatar-photo{width:34px!important;height:34px!important;min-width:34px!important}
      .wa-chathead .wa-actions{gap:1px!important}
      .wa-head-action{width:29px;height:29px;flex-basis:29px}
      .wa-head-action svg{width:17px;height:17px}
    }
  `;
  document.head.appendChild(style);
})();
