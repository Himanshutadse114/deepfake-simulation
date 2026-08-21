(() => {
  const key = document.getElementById('adminKey');
  const whatsapp = document.getElementById('whatsappScript');
  const video = document.getElementById('videoScript');
  const whatsappCount = document.getElementById('whatsappCount');
  const videoCount = document.getElementById('videoCount');
  const status = document.getElementById('adminStatus');
  const loadBtn = document.getElementById('loadScripts');
  const saveBtn = document.getElementById('saveScripts');

  const count = () => {
    whatsappCount.textContent = String(whatsapp.value.length);
    videoCount.textContent = String(video.value.length);
  };

  const show = (message, kind = '') => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  async function request(method, body) {
    const adminKey = key.value.trim();
    if (!adminKey) throw new Error('Enter the ADMIN_KEY first.');
    const response = await fetch('/api/admin/scripts', {
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
    show('Loading…');
    try {
      const payload = await request('GET');
      whatsapp.value = payload.scripts?.whatsapp || '';
      video.value = payload.scripts?.video || '';
      count();
      show(payload.updatedAt ? `Loaded. Last saved ${new Date(payload.updatedAt).toLocaleString()}.` : 'Loaded default scripts.', 'ok');
    } catch (error) {
      show(error.message, 'err');
    }
  }

  async function save() {
    show('Saving…');
    try {
      const payload = await request('PUT', { whatsapp: whatsapp.value, video: video.value });
      whatsapp.value = payload.scripts?.whatsapp || whatsapp.value;
      video.value = payload.scripts?.video || video.value;
      count();
      show('Saved. New simulation sessions will use these scripts.', 'ok');
    } catch (error) {
      show(error.message, 'err');
    }
  }

  [whatsapp, video].forEach((el) => el.addEventListener('input', count));
  loadBtn.addEventListener('click', load);
  saveBtn.addEventListener('click', save);
  key.addEventListener('keydown', (event) => { if (event.key === 'Enter') load(); });
  count();
})();
