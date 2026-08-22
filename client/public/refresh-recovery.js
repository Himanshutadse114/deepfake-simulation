(() => {
  const STORAGE_KEY = 'innvikta.deepfake.resume.v1';
  const MAX_NETWORK_RETRIES = 5;
  let restoring = false;
  let resetting = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function readState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === 1 ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeState(next) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        ...next
      }));
    } catch (_) {}
  }

  function clearState() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function cloneQuizState() {
    try {
      if (typeof quizState === 'undefined') return null;
      return JSON.parse(JSON.stringify(quizState));
    } catch (_) {
      return null;
    }
  }

  function captureScores() {
    try {
      if (typeof scores === 'undefined') return null;
      return {
        video: Number(scores.video || 0),
        voice: Number(scores.voice || 0),
        profile: Number(scores.profile || 0)
      };
    } catch (_) {
      return null;
    }
  }

  function currentNewspaperPage() {
    const active = document.querySelector('[data-editorial-page].active');
    const value = Number(active?.dataset?.editorialPage);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  function patchState(patch = {}) {
    const current = readState() || {};
    writeState({
      ...current,
      ...patch,
      quizState: patch.quizState ?? cloneQuizState() ?? current.quizState ?? null,
      scores: patch.scores ?? captureScores() ?? current.scores ?? null,
      newspaperPage: patch.newspaperPage ?? currentNewspaperPage()
    });
  }

  function captureSessionFromCreate(path, options, payload) {
    if (path !== '/api/simulation/session' || !payload?.id || !payload?.token) return;
    let participant = null;
    try {
      const body = typeof options?.body === 'string' ? JSON.parse(options.body) : null;
      participant = body?.participant || null;
    } catch (_) {}

    writeState({
      session: { id: payload.id, token: payload.token, mode: payload.mode || 'ai' },
      participant,
      screen: 'generate',
      status: 'collecting',
      newspaperPage: 0,
      quizState: null,
      scores: { video: 0, voice: 0, profile: 0 }
    });
  }

  function captureStatus(path, payload) {
    if (!/\/api\/simulation\/[^/]+\/status(?:\?|$)/.test(String(path || '')) || !payload?.status) return;
    patchState({ status: payload.status, mode: payload.mode || readState()?.mode });
  }

  function restoreIdentity(saved) {
    const first = saved?.participant?.firstName || 'Participant';
    const last = saved?.participant?.lastName || '';
    const firstInput = document.getElementById('firstNameInput');
    const lastInput = document.getElementById('lastNameInput');
    if (firstInput) firstInput.value = first;
    if (lastInput) lastInput.value = last;
    try { window.setIdentity?.(first, last); } catch (_) {}
  }

  function restoreGeneratedFaceFallback() {
    try {
      if (Array.isArray(window.variantUrls) && window.variantUrls[0]) {
        window.uploadedPhotoUrl = window.variantUrls[0];
        window.setSharedFace?.(window.variantUrls[0]);
      }
    } catch (_) {}
  }

  function restoreNewspaperPage(targetPage) {
    const target = Math.max(0, Math.min(2, Number(targetPage || 0)));
    requestAnimationFrame(() => {
      const first = document.querySelector('[data-editorial-page="0"]');
      const next = document.getElementById('editorialNext');
      if (!first || !next) return;
      for (let i = 0; i < target; i += 1) next.click();
      window.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    });
  }

  function restoreQuiz(saved) {
    try {
      if (saved?.scores && typeof scores !== 'undefined') {
        scores.video = Number(saved.scores.video || 0);
        scores.voice = Number(saved.scores.voice || 0);
        scores.profile = Number(saved.scores.profile || 0);
      }
      if (saved?.quizState && typeof quizState !== 'undefined') {
        quizState = {
          ...saved.quizState,
          selected: null,
          answered: Array.isArray(saved.quizState.answered) ? saved.quizState.answered : []
        };
      }
      window.go?.('quiz');
      window.renderQuiz?.();
    } catch (error) {
      console.warn('[refresh-recovery] quiz restore failed', error);
      window.startQuiz?.();
    }
  }

  function restoreCompletion(saved) {
    const score = saved?.scores || { video: 0, voice: 0, profile: 0 };
    const total = Number(score.video || 0) + Number(score.voice || 0) + Number(score.profile || 0);
    try {
      if (typeof scores !== 'undefined') {
        scores.video = Number(score.video || 0);
        scores.voice = Number(score.voice || 0);
        scores.profile = Number(score.profile || 0);
      }
    } catch (_) {}
    const finalScore = document.getElementById('finalScore');
    const scoreRing = document.getElementById('scoreRing');
    if (finalScore) finalScore.textContent = `${total}/9`;
    if (scoreRing) scoreRing.style.setProperty('--scorepct', Math.round(total / 9 * 100));
    window.go?.('complete');
  }

  async function statusWithRetry(session) {
    let lastError;
    for (let attempt = 0; attempt < MAX_NETWORK_RETRIES; attempt += 1) {
      try {
        return await window.apiRequest(`/api/simulation/${session.id}/status`, {}, session.token);
      } catch (error) {
        lastError = error;
        if (!error?.isNetworkError) throw error;
        await sleep(Math.min(5000, 700 + (attempt * 900)));
      }
    }
    throw lastError || new Error('Could not reconnect to the simulation session.');
  }

  async function restoreCompletedExperience(saved, payload) {
    window.generationInProgress = false;
    window.runMode = payload.mode || saved.session?.mode || 'ai';
    window.prepareGeneratedAssets?.(payload);
    restoreIdentity(saved);
    restoreGeneratedFaceFallback();

    const screen = saved.screen || 'voiceExperience';
    if (screen === 'quiz') {
      restoreQuiz(saved);
      return;
    }
    if (screen === 'unifiedLearn') {
      window.go?.('unifiedLearn');
      restoreNewspaperPage(saved.newspaperPage);
      return;
    }
    if (screen === 'profileExperience') {
      window.go?.('profileExperience');
      return;
    }
    if (screen === 'waVideoCall' || screen === 'videoExperience') {
      // Restart at the incoming call instead of auto-playing media after refresh.
      window.triggerIncomingVideoCall?.();
      return;
    }
    if (screen === 'complete') {
      restoreCompletion(saved);
      return;
    }

    // WhatsApp/QR/chat animation state is intentionally restarted from the
    // beginning of the scene. It reuses existing generated assets and costs $0.
    window.startWhatsAppSimulation?.();
  }

  async function restoreSavedSession() {
    if (restoring) return;
    const saved = readState();
    if (!saved) return;
    restoring = true;

    try {
      if (!saved.session?.id || !saved.session?.token) {
        if (saved.screen === 'complete') restoreCompletion(saved);
        else clearState();
        return;
      }

      window.liveSession = {
        id: saved.session.id,
        token: saved.session.token,
        mode: saved.session.mode || 'ai'
      };
      window.runMode = saved.session.mode || 'ai';
      restoreIdentity(saved);

      let payload;
      try {
        payload = await statusWithRetry(saved.session);
      } catch (error) {
        if (/not found|expired/i.test(String(error?.message || ''))) {
          window.liveSession = null;
          if (saved.screen === 'complete') restoreCompletion({ ...saved, session: null });
          else {
            clearState();
            window.go?.('intro');
            window.toast?.('Your previous simulation session has expired. Please start again.');
          }
          return;
        }

        // A network-only failure must not start another paid generation. Keep
        // the same session and hand control to the existing polling loop.
        window.generationInProgress = true;
        window.go?.('generate');
        window.updateGenerationFromServer?.({
          status: 'reconnecting',
          detail: 'Reconnecting to your existing simulation. No new AI generation is being started.'
        });
        window.pollGenerationUntilReady?.().catch((pollError) => {
          window.generationInProgress = false;
          window.toast?.(pollError.message);
        });
        return;
      }

      patchState({ status: payload.status, mode: payload.mode || window.runMode });

      if (payload.status === 'completed') {
        await restoreCompletedExperience(saved, payload);
        return;
      }

      if (payload.status === 'failed') {
        window.generationInProgress = false;
        window.go?.('generate');
        window.updateGenerationFromServer?.(payload);
        const actions = document.getElementById('generationFailureActions');
        if (actions) actions.style.display = 'block';
        window.toast?.('Your previous generation stopped safely. You can use Retry safely if available.');
        return;
      }

      if (payload.status === 'collecting') {
        // Browser File objects cannot survive a refresh. No paid AI work has
        // started yet, so remove the interrupted setup and ask for fresh media.
        await window.apiRequest(`/api/simulation/${saved.session.id}`, { method: 'DELETE' }, saved.session.token).catch(() => {});
        window.liveSession = null;
        clearState();
        window.go?.('media');
        window.toast?.('The setup was refreshed before generation started. Please re-upload your photo and voice sample.');
        return;
      }

      // Queued / validating / Qwen / FLUX / Pruna / watermarking: reconnect to
      // the same status loop. IMPORTANT: refresh recovery never calls /generate.
      window.generationInProgress = true;
      window.go?.('generate');
      window.updateGenerationFromServer?.(payload);
      await window.pollGenerationUntilReady?.();
    } catch (error) {
      console.error('[refresh-recovery]', error);
      window.generationInProgress = false;
      window.toast?.('Could not restore the previous simulation automatically.');
    } finally {
      restoring = false;
    }
  }

  function installTracking() {
    if (window.__innviktaRefreshRecoveryInstalled) return;
    window.__innviktaRefreshRecoveryInstalled = true;

    const originalApiRequest = window.apiRequest;
    if (typeof originalApiRequest === 'function') {
      window.apiRequest = async function recoveryAwareApiRequest(path, options = {}, token = '') {
        const payload = await originalApiRequest.call(this, path, options, token);
        captureSessionFromCreate(path, options, payload);
        captureStatus(path, payload);
        return payload;
      };
    }

    const originalGo = window.go;
    if (typeof originalGo === 'function') {
      window.go = function recoveryAwareGo(name, ...args) {
        const result = originalGo.call(this, name, ...args);
        const saved = readState();
        if (saved?.session || name === 'complete') {
          patchState({ screen: name, scores: captureScores(), quizState: cloneQuizState() });
        }
        return result;
      };
    }

    const originalCleanup = window.cleanupLiveSession;
    if (typeof originalCleanup === 'function') {
      window.cleanupLiveSession = async function recoveryAwareCleanup(...args) {
        const before = readState();
        const result = await originalCleanup.apply(this, args);
        if (!window.liveSession) {
          if (!resetting && before?.screen === 'complete') {
            writeState({ ...before, session: null, status: 'completed', scores: captureScores() || before.scores });
          } else {
            clearState();
          }
        }
        return result;
      };
    }

    const originalReset = window.resetSimulation;
    if (typeof originalReset === 'function') {
      window.resetSimulation = async function recoveryAwareReset(...args) {
        resetting = true;
        try {
          return await originalReset.apply(this, args);
        } finally {
          clearState();
          resetting = false;
        }
      };
    }

    const originalAbandon = window.abandonFailedGeneration;
    if (typeof originalAbandon === 'function') {
      window.abandonFailedGeneration = async function recoveryAwareAbandon(...args) {
        try { return await originalAbandon.apply(this, args); }
        finally { clearState(); }
      };
    }

    ['selectQuizOption', 'nextQuizQuestion', 'renderQuiz'].forEach((name) => {
      const original = window[name];
      if (typeof original !== 'function') return;
      window[name] = function recoveryAwareQuizAction(...args) {
        const result = original.apply(this, args);
        queueMicrotask(() => patchState({ screen: 'quiz', quizState: cloneQuizState(), scores: captureScores() }));
        return result;
      };
    });

    document.addEventListener('click', (event) => {
      if (!event.target?.closest?.('#editorialNext,#editorialPrev')) return;
      queueMicrotask(() => patchState({ screen: 'unifiedLearn', newspaperPage: currentNewspaperPage() }));
    }, true);

    window.addEventListener('pagehide', () => {
      const saved = readState();
      if (!saved) return;
      patchState({
        screen: typeof currentScreen !== 'undefined' ? currentScreen : saved.screen,
        quizState: cloneQuizState(),
        scores: captureScores(),
        newspaperPage: currentNewspaperPage()
      });
    });
  }

  async function waitForRuntime() {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const ready = typeof window.go === 'function'
        && typeof window.apiRequest === 'function'
        && typeof window.pollGenerationUntilReady === 'function'
        && typeof window.prepareGeneratedAssets === 'function'
        && typeof window.stopWhatsAppCallRingtone === 'function'
        && document.querySelector('.screen[data-screen="intro"]');
      if (ready) {
        // Let ui-bootstrap finish its final synchronous wrappers and initial
        // visibility pass before restoration changes the active screen.
        await sleep(120);
        return true;
      }
      await sleep(50);
    }
    return false;
  }

  (async () => {
    if (!(await waitForRuntime())) return;
    installTracking();
    await restoreSavedSession();
  })();
})();
