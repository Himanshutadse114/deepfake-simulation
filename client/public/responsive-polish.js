(() => {
  const style = document.createElement('style');
  style.textContent = `
    /* Editorial readability: use the available paper area instead of tiny copy. */
    .paper-story{padding:clamp(18px,1.55vw,26px)!important}
    .story-kicker{font-size:9.5px!important;padding:4px 7px!important;margin-bottom:10px!important}
    .paper-story h4{font-size:clamp(22px,1.55vw,30px)!important;line-height:1.04!important;margin-bottom:12px!important}
    .paper-story p{font-size:clamp(13px,.84vw,15px)!important;line-height:1.48!important;margin-bottom:11px!important}
    .paper-story .dropcap:first-letter{font-size:48px!important;margin-right:8px!important}
    .paper-story blockquote{font-size:clamp(12.5px,.8vw,14px)!important;line-height:1.46!important;padding:12px 0 0 14px!important}
    .story-columns{column-gap:20px!important}
    .story-list{gap:10px!important;margin:8px 0 12px!important}
    .story-list div{padding:11px!important}
    .story-list b{font-size:10.5px!important}
    .story-list span{font-size:12.5px!important;line-height:1.4!important}
    .story-steps{gap:9px!important;margin:8px 0 12px!important}
    .story-step{grid-template-columns:42px 1fr!important;gap:12px!important;padding:12px!important}
    .story-step>span{width:38px!important;height:38px!important;font-size:10px!important}
    .story-step b{font-size:10.5px!important;margin-bottom:4px!important}
    .story-step p{font-size:12.5px!important;line-height:1.4!important}
    .story-number{font-size:clamp(52px,4.2vw,76px)!important;margin-bottom:10px!important}
    .story-quote{font-size:clamp(21px,1.55vw,30px)!important;line-height:1.14!important;padding:22px 12px!important;min-height:132px;display:grid;place-items:center}
    .final-rules{gap:9px!important;margin:10px 0 14px!important}
    .final-rules span{padding:10px 10px!important;font-size:11.5px!important;line-height:1.42!important}
    .editorial-quiz{min-height:52px!important;font-size:14px!important;width:min(100%,440px)!important}
    .story-stamp{font-size:15px!important;padding:7px 14px!important}
    .voice-strip{height:96px!important}
    .voice-strip strong{font-size:13px!important}
    .mini-profile{padding:11px!important}.mini-profile b{font-size:10.5px!important}.mini-profile small{font-size:9.5px!important}
    .editorial-page[data-editorial-page="2"] .paper-story:first-child .story-quote{min-height:185px;font-size:clamp(23px,1.7vw,32px)!important}
    .editorial-page[data-editorial-page="2"] .paper-story:nth-child(2) .story-step{min-height:72px}
    .editorial-page[data-editorial-page="2"] .paper-story:nth-child(3) .final-rules span{min-height:44px;display:flex;align-items:center}

    /* QR: always show a complete square with breathing room. */
    .wa-qr-bubble{max-width:min(100%,290px)!important;padding:12px 12px 20px!important}
    .wa-qr-code{width:164px!important;height:164px!important;padding:8px!important;display:grid!important;place-items:center!important;overflow:visible!important;margin:6px 0 0!important;border-radius:10px!important;background:#fff!important}
    .wa-real-qr{width:148px!important;height:148px!important;max-width:none!important;max-height:none!important;display:block!important;flex:none!important}
    .wa-qr-caption{font-size:9.5px!important;margin-top:7px!important}

    /* General small-screen journey hardening. */
    @media(max-width:700px){
      html,body{width:100%;height:100%;overflow:hidden!important}
      .app{height:100dvh!important;overflow:hidden!important}
      .screen.active{overflow:hidden!important}
      .screen.active>.screen-inner{height:100dvh!important;min-height:0!important;overflow:hidden!important}
      .viewport{height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;padding:18px 14px calc(24px + env(safe-area-inset-bottom))!important}
      .viewport.no-scroll{overflow-y:auto!important;padding-bottom:28px!important}
      .action-dock{padding:12px 14px calc(16px + env(safe-area-inset-bottom))!important;margin-top:12px!important}
      .wide-action{width:100%!important;max-width:520px!important}

      /* Landing */
      .hero{display:block!important;width:100%!important}.hero-copy{max-width:none!important}.hero-copy h1{font-size:clamp(42px,12vw,62px)!important;line-height:.96!important}.hero-copy .muted{font-size:14px!important;line-height:1.55!important}.flow-pills{margin-top:18px!important;margin-bottom:12px!important;gap:6px!important}.flow-pills span{font-size:10px!important;padding:7px 9px!important}.hero-visual{display:none!important}.intro-actions{padding-top:10px!important}.intro-actions .primary{width:min(100%,520px)!important}

      /* Consent and media setup */
      .consent-card{width:100%!important;padding:18px 14px!important}.consent-list{margin:14px 0!important}.consent-item{grid-template-columns:38px 1fr 22px!important;gap:10px!important;padding:12px!important}.consent-item-icon{width:38px!important;height:38px!important}.media-wrap{width:100%!important}.media-heading h2{font-size:34px!important}.media-grid{grid-template-columns:1fr!important}.media-card{min-height:0!important;padding:15px!important}.drop-zone{min-height:210px!important}.name-fields{display:grid!important;grid-template-columns:1fr!important}.name-fields label{min-width:0!important}.media-footer{flex-wrap:wrap!important}

      /* Generation */
      .screen[data-screen="generate"] .viewport{display:block!important}.generate-wrap{display:grid!important;grid-template-columns:1fr!important;width:100%!important;gap:16px!important;padding:6px 0 20px!important}.scan-stage{min-height:280px!important;height:34dvh!important}.generate-copy{text-align:left!important}.generate-copy h2{font-size:36px!important}.progress-number{font-size:64px!important;margin:12px 0 10px!important}.gen-status{margin-top:12px!important}.gen-step{font-size:11px!important;padding:6px 0!important}

      /* WhatsApp: remove desktop rails that were overriding the mobile rule. */
      .screen[data-screen="voiceExperience"] .screen-inner{display:flex!important;flex-direction:column!important;height:100dvh!important}
      .wa-stage{flex:1!important;min-height:0!important;height:auto!important;padding:0!important;display:block!important;overflow:hidden!important}
      .whatsapp{position:relative!important;display:grid!important;grid-template-columns:1fr!important;width:100%!important;height:100%!important;max-height:none!important;border:0!important;border-radius:0!important}
      .wa-nav-rail,.wa-sidebar{display:none!important}
      .wa-main{height:100%!important;min-height:0!important}.wa-chathead{height:56px!important;flex:none!important;padding:8px 10px!important}.wa-chatbody{min-height:0!important;padding:14px 10px 18px!important;overflow-y:auto!important}.wa-input{height:54px!important;flex:none!important;padding:8px 10px!important}.wa-bubble{max-width:90%!important;font-size:12.5px!important}.voice-ui{min-width:0!important;width:min(100%,320px)!important}.wa-wave{min-width:0!important}.wa-real-qr{width:128px!important;height:128px!important}.wa-qr-code{width:144px!important;height:144px!important;padding:8px!important}.wa-qr-bubble{max-width:220px!important}.wa-simulation-complete{max-width:94%!important;font-size:10px!important}
      #waProceedDock{flex:none!important;margin:0!important;padding:10px 12px calc(12px + env(safe-area-inset-bottom))!important;background:#0b141a!important;border-top:1px solid #28333a!important;max-height:42dvh!important;overflow-y:auto!important}.wa-completion-copy{margin-bottom:8px!important}.wa-proceed-actions{gap:8px!important}.wa-proceed-actions button{width:100%!important;min-height:46px!important}

      /* Incoming call + deepfake video */
      .wa-call-screen{padding:70px 18px calc(58px + env(safe-area-inset-bottom))!important}.wa-call-avatar{width:112px!important;height:112px!important}.experience-layout{padding:58px 12px calc(72px + env(safe-area-inset-bottom))!important;height:100%!important}.video-frame{width:min(92vw,390px)!important;max-height:68dvh!important}.call-ended-overlay{padding:18px!important}.call-ended-title{font-size:24px!important}.call-ended-text{font-size:12px!important;line-height:1.45!important}

      /* Instagram: keep the learner's Continue action permanently reachable. */
      .screen[data-screen="profileExperience"] .screen-inner{height:100dvh!important;overflow:hidden!important}.insta-stage{height:100%!important;padding:0!important;display:block!important}.instagram{position:relative!important;display:block!important;width:100%!important;height:100%!important;max-height:none!important;border:0!important;border-radius:0!important;overflow:hidden!important}.ig-side{display:none!important}.ig-main{display:block!important;width:100%!important;height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;padding:16px 0 calc(76px + env(safe-area-inset-bottom))!important;-webkit-overflow-scrolling:touch}.ig-profile-top{grid-template-columns:82px 1fr!important;padding:0 12px!important;gap:11px!important}.ig-profile-avatar{width:76px!important;height:76px!important}.ig-name-row{gap:5px!important}.ig-name-row strong{font-size:14px!important}.ig-btn{padding:6px 8px!important;font-size:10px!important}.ig-stats{gap:9px!important;margin:10px 0!important;font-size:11px!important;flex-wrap:wrap!important}.ig-bio{font-size:11px!important;line-height:1.4!important}.ig-highlights{justify-content:flex-start!important;padding:0 12px!important;gap:14px!important;margin:16px 0!important;overflow-x:auto!important}.ig-highlight{min-width:64px!important}.ig-highlight>div{width:58px!important;height:58px!important}.ig-tabs{gap:24px!important;font-size:9px!important}.ig-grid{grid-template-columns:repeat(3,1fr)!important}.ig-mobilebar{position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:40!important;height:60px!important;padding-bottom:env(safe-area-inset-bottom)!important;display:flex!important;align-items:center!important;justify-content:space-around!important;background:color-mix(in srgb,var(--bg2) 96%,transparent)!important;border-top:1px solid var(--line)!important;box-shadow:0 -10px 30px rgba(0,0,0,.18)!important}.ig-mobilebar .primary{display:inline-flex!important;min-height:40px!important;padding:9px 14px!important;font-size:11px!important;white-space:nowrap!important}
      .ig-popup-overlay{padding:10px!important}.ig-post-detail{width:100%!important;max-height:92dvh!important}.ig-story-container{height:min(88dvh,620px)!important}

      /* Newspaper: readable stacked clippings on mobile. */
      .screen[data-screen="unifiedLearn"] .screen-inner{height:100dvh!important;overflow:hidden!important}.editorial-news{height:100%!important;min-height:0!important;overflow-y:auto!important;padding:14px 12px calc(84px + env(safe-area-inset-bottom))!important;-webkit-overflow-scrolling:touch}.editorial-mast h1{font-size:clamp(40px,12vw,62px)!important;white-space:normal!important}.editorial-meta{font-size:8px!important}.editorial-lead h2{font-size:clamp(32px,9vw,48px)!important}.editorial-lead p{font-size:10.5px!important}.editorial-pages{min-height:0!important;overflow:visible!important}.editorial-page{position:relative!important;inset:auto!important}.editorial-grid{display:block!important}.paper-story{height:auto!important;min-height:0!important;margin-bottom:18px!important;transform:none!important;padding:18px 16px!important}.paper-story h4{font-size:24px!important}.paper-story p{font-size:14px!important;line-height:1.5!important}.story-list span,.story-step p{font-size:13px!important}.paper-story blockquote{font-size:13.5px!important}.story-quote{font-size:23px!important;min-height:130px!important}.editorial-nav{position:fixed!important;left:50%!important;bottom:calc(12px + env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;z-index:96!important}

      /* Quiz and completion */
      .screen[data-screen="quiz"] .viewport,.screen[data-screen="complete"] .viewport{display:block!important}.quiz-shell{width:100%!important;padding:18px 14px!important}.quiz-q{font-size:25px!important;line-height:1.2!important}.quiz-option{padding:12px!important;grid-template-columns:32px 1fr!important}.final-wrap{display:block!important;width:100%!important;height:auto!important}.final-score,.final-learning{padding:16px!important}.final-score{display:block!important}.score-ring{width:128px!important;height:128px!important;margin:14px auto!important}.final-cards{grid-template-columns:1fr!important}
    }

    @media(max-width:380px){
      .hero-copy h1{font-size:40px!important}.wa-bubble{font-size:12px!important}.voice-ui{width:100%!important}.ig-profile-top{grid-template-columns:70px 1fr!important}.ig-profile-avatar{width:64px!important;height:64px!important}.ig-stats{font-size:10px!important}.ig-mobilebar{height:58px!important}.paper-story h4{font-size:21px!important}.paper-story p{font-size:13.5px!important}
    }
  `;
  document.head.appendChild(style);
})();
