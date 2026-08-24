(() => {
  const VERSION = 1;
  if (window.__innviktaParticipantNameFixVersion === VERSION) return;
  window.__innviktaParticipantNameFixVersion = VERSION;

  const first = document.getElementById('firstNameInput');
  const last = document.getElementById('lastNameInput');
  if (!first || !last) return;

  first.setAttribute('name', 'participant_given_name');
  last.setAttribute('name', 'participant_family_name');
  first.setAttribute('autocomplete', 'given-name');
  last.setAttribute('autocomplete', 'family-name');
  first.setAttribute('data-lpignore', 'true');
  last.setAttribute('data-lpignore', 'true');
  first.setAttribute('data-1p-ignore', 'true');
  last.setAttribute('data-1p-ignore', 'true');
  first.setAttribute('data-form-type', 'other');
  last.setAttribute('data-form-type', 'other');

  let participant = { first: '', last: '' };
  let userStartedNameEntry = false;

  function looksLikeCredentialAutofill() {
    const firstValue = first.value.trim().toLowerCase();
    const lastValue = last.value.trim();
    const passwordLikeSurname = /[!@#$%^&*_=+\[\]{};:<>/?\\|]/.test(lastValue) && lastValue.length >= 8;
    return firstValue === 'innvikta' || passwordLikeSurname;
  }

  function clearCredentialAutofill() {
    if (userStartedNameEntry || !looksLikeCredentialAutofill()) return;
    first.value = '';
    last.value = '';
    participant = { first: '', last: '' };
    try { window.setIdentity?.('Alex', 'Morgan'); } catch (_) {}
    try { window.checkMediaReady?.(); } catch (_) {}
  }

  function captureParticipantIdentity({ requireValid = false } = {}) {
    const firstValue = first.value.trim();
    const lastValue = last.value.trim();

    if (looksLikeCredentialAutofill()) {
      first.value = '';
      last.value = '';
      participant = { first: '', last: '' };
      try { window.setIdentity?.('Alex', 'Morgan'); } catch (_) {}
      try { window.checkMediaReady?.(); } catch (_) {}
      if (requireValid) {
        try { window.go?.('media'); } catch (_) {}
        try { window.toast?.('Enter your first name and surname to continue.'); } catch (_) {}
      }
      return false;
    }

    if (!firstValue || !lastValue) {
      if (requireValid) {
        try { window.go?.('media'); } catch (_) {}
        try { window.toast?.('Enter your first name and surname to continue.'); } catch (_) {}
      }
      return false;
    }

    participant = { first: firstValue, last: lastValue };
    try { window.setIdentity?.(participant.first, participant.last); } catch (_) {}
    return true;
  }

  function syncParticipantIdentity() {
    if (participant.first && participant.last) {
      try { window.setIdentity?.(participant.first, participant.last); } catch (_) {}
      return true;
    }
    return captureParticipantIdentity();
  }

  first.addEventListener('beforeinput', () => { userStartedNameEntry = true; });
  last.addEventListener('beforeinput', () => { userStartedNameEntry = true; });
  first.addEventListener('paste', () => { userStartedNameEntry = true; });
  last.addEventListener('paste', () => { userStartedNameEntry = true; });

  [first, last].forEach((input) => {
    input.addEventListener('input', () => {
      if (!looksLikeCredentialAutofill()) captureParticipantIdentity();
    });
    input.addEventListener('change', () => {
      if (!looksLikeCredentialAutofill()) captureParticipantIdentity();
    });
  });

  // Credential managers can fill the first text fields after redirect from the
  // login page. Remove that value before the learner reaches Media setup.
  clearCredentialAutofill();
  setTimeout(clearCredentialAutofill, 80);
  setTimeout(clearCredentialAutofill, 350);

  if (typeof window.startGeneration === 'function' && !window.startGeneration.__participantNameGuard) {
    const originalStartGeneration = window.startGeneration;
    const guardedStartGeneration = function guardedStartGeneration(...args) {
      if (!captureParticipantIdentity({ requireValid: true })) return;
      return originalStartGeneration.apply(this, args);
    };
    guardedStartGeneration.__participantNameGuard = true;
    window.startGeneration = guardedStartGeneration;
  }

  if (typeof window.startWhatsAppSimulation === 'function' && !window.startWhatsAppSimulation.__participantNameSync) {
    const originalStartWhatsApp = window.startWhatsAppSimulation;
    const syncedStartWhatsApp = function syncedStartWhatsApp(...args) {
      syncParticipantIdentity();
      return originalStartWhatsApp.apply(this, args);
    };
    syncedStartWhatsApp.__participantNameSync = true;
    window.startWhatsAppSimulation = syncedStartWhatsApp;
  }

  window.__innviktaCaptureParticipantIdentity = captureParticipantIdentity;
  window.__innviktaSyncParticipantIdentity = syncParticipantIdentity;
})();
