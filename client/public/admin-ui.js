(() => {
  const key = document.getElementById('adminKey');
  const whatsapp = document.getElementById('whatsappScript');
  const video = document.getElementById('videoScript');
  const whatsappCount = document.getElementById('whatsappCount');
  const videoCount = document.getElementById('videoCount');
  const status = document.getElementById('adminStatus');
  const storageStatus = document.getElementById('storageStatus');
  const loadBtn = document.getElementById('loadScripts');
  const saveBtn = document.getElementById('saveScripts');
  const testStorageBtn = document.getElementById('testStorage');

  const count = () => {
    whatsappCount.textContent = String(whatsapp.value.length);
    videoCount.textContent = String(video.value.length);
  };

  const show = (target, message, kind = '') => {
    target.textContent = message;
    target.className = `status ${kind}`.trim();
  };

  async function apiRequest(path, method = 'GET', body) {
    const adminKey = key.value.trim();
    if (!adminKey) throw new Error('Enter the ADMIN_KEY first.');
    const response = await fetch(path, {
      method,
      headers: {
        'x-admin-key': adminKey,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  async function load() {
    show(status, 'Loading…');
    try {
      const payload = await apiRequest('/api/admin/scripts');
      whatsapp.value = payload.scripts?.whatsapp || '';
      video.value = payload.scripts?.video || '';
      count();
      show(status, payload.updatedAt ? `Loaded. Last saved ${new Date(payload.updatedAt).toLocaleString()}.` : 'Loaded default scripts.', 'ok');
    } catch (error) {
      show(status, error.message, 'err');
    }
  }

  async function save() {
    show(status, 'Saving…');
    try {
      const payload = await apiRequest('/api/admin/scripts', 'PUT', { whatsapp: whatsapp.value, video: video.value });
      whatsapp.value = payload.scripts?.whatsapp || whatsapp.value;
      video.value = payload.scripts?.video || video.value;
      count();
      show(status, 'Saved. New simulation sessions will use these scripts.', 'ok');
    } catch (error) {
      show(status, error.message, 'err');
    }
  }

  async function testStorage() {
    if (!testStorageBtn) return;
    testStorageBtn.disabled = true;
    const previous = testStorageBtn.textContent;
    testStorageBtn.textContent = 'Testing…';
    show(storageStatus, 'Checking write, read and delete access…');
    try {
      const payload = await apiRequest('/api/admin/storage-test', 'POST');
      const checks = Array.isArray(payload.checks) ? payload.checks.join(' / ') : 'write / read / delete';
      show(
        storageStatus,
        `Connected to ${payload.bucket || 'R2'} (${payload.region || 'auto'}). ${checks} passed in ${Number(payload.latencyMs || 0)} ms.`,
        'ok'
      );
    } catch (error) {
      show(storageStatus, error.message, 'err');
    } finally {
      testStorageBtn.disabled = false;
      testStorageBtn.textContent = previous;
    }
  }

  [whatsapp, video].forEach((el) => el.addEventListener('input', count));
  loadBtn.addEventListener('click', load);
  saveBtn.addEventListener('click', save);
  testStorageBtn?.addEventListener('click', testStorage);
  key.addEventListener('keydown', (event) => { if (event.key === 'Enter') load(); });
  count();
})();
