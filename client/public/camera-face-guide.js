(() => {
  const MODULE_URL = '/vendor/mediapipe/vision_bundle.mjs';
  const WASM_URL = '/vendor/mediapipe/wasm';
  const MODEL_URL = '/vendor/mediapipe/blaze_face_short_range.tflite';

  let detector = null;
  let detectorPromise = null;
  let detectorMode = 'loading'; // loading | active | manual
  let frameRequest = null;
  let cameraOpen = false;
  let aligned = false;
  let alignedSince = 0;
  let lastDetectionAt = 0;
  let sampleCanvas = null;
  let sampleContext = null;

  const style = document.createElement('style');
  style.textContent = `
    body.camera-guide-open{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}
    #cameraContainer.camera-guide-fullscreen{position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100dvh!important;display:block!important;border-radius:0!important;background:#02050a!important;overflow:hidden!important}
    #cameraContainer.camera-guide-fullscreen #cameraVideo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;transform:scaleX(-1);background:#02050a}
    .camera-guide-layer{position:absolute;inset:0;z-index:3;pointer-events:none;color:#fff;font-family:Inter,system-ui,sans-serif}
    .camera-guide-top{position:absolute;left:0;right:0;top:0;padding:max(22px,env(safe-area-inset-top)) 20px 0;text-align:center;text-shadow:0 2px 18px rgba(0,0,0,.7)}
    .camera-guide-top strong{display:block;font-size:clamp(21px,5vw,30px);font-weight:700;letter-spacing:-.02em}
    .camera-guide-top span{display:block;margin:6px auto 0;max-width:420px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.78)}
    .camera-guide-oval{position:absolute;left:50%;top:46%;width:min(72vw,370px);aspect-ratio:.76;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.76);border-radius:50%;box-shadow:0 0 0 200vmax rgba(0,0,0,.58),0 0 34px rgba(255,255,255,.08) inset;transition:border-color .18s ease,box-shadow .18s ease}
    .camera-guide-oval:before,.camera-guide-oval:after{content:"";position:absolute;left:50%;width:38%;height:1px;background:rgba(255,255,255,.22);transform:translateX(-50%)}
    .camera-guide-oval:before{top:35%}.camera-guide-oval:after{top:63%}
    #cameraContainer[data-guide-state="ready"] .camera-guide-oval{border-color:#42d980;box-shadow:0 0 0 200vmax rgba(0,0,0,.55),0 0 30px rgba(66,217,128,.38)}
    #cameraContainer[data-guide-state="warn"] .camera-guide-oval{border-color:#ffb15f}
    #cameraContainer[data-guide-state="error"] .camera-guide-oval{border-color:#ff6565}
    .camera-guide-status{position:absolute;left:50%;bottom:calc(116px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(90vw,430px);padding:11px 16px;border-radius:999px;background:rgba(7,12,20,.78);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(14px);text-align:center;font-size:12px;font-weight:650;box-shadow:0 10px 35px rgba(0,0,0,.28)}
    .camera-guide-status i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffb15f;margin-right:8px;vertical-align:1px}
    #cameraContainer[data-guide-state="ready"] .camera-guide-status i{background:#42d980;box-shadow:0 0 12px rgba(66,217,128,.7)}
    #cameraContainer[data-guide-state="error"] .camera-guide-status i{background:#ff6565}
    .camera-guide-privacy{position:absolute;left:50%;bottom:calc(82px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:8px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.58);white-space:nowrap}
    #cameraContainer.camera-guide-fullscreen .camera-guide-actions{position:absolute!important;left:0!important;right:0!important;bottom:max(18px,env(safe-area-inset-bottom))!important;z-index:5!important;display:flex!important;gap:12px!important;justify-content:center!important;padding:0 18px!important}
    #cameraContainer.camera-guide-fullscreen .camera-guide-actions button{min-height:48px!important;padding:0 22px!important;border-radius:999px!important;font-size:13px!important}
    #cameraContainer.camera-guide-fullscreen .camera-guide-actions button[disabled]{opacity:.38!important;cursor:not-allowed!important;filter:saturate(.25)}
    @media(max-width:520px){.camera-guide-oval{width:min(76vw,330px);top:45%}.camera-guide-status{bottom:calc(120px + env(safe-area-inset-bottom));font-size:11px}.camera-guide-privacy{bottom:calc(87px + env(safe-area-inset-bottom))}.camera-guide-top{padding-left:18px;padding-right:18px}}
    @media(orientation:landscape) and (max-height:600px){.camera-guide-oval{width:min(34vw,270px);top:48%}.camera-guide-top strong{font-size:20px}.camera-guide-top span{font-size:10px}.camera-guide-status{bottom:70px;width:min(62vw,420px)}.camera-guide-privacy{display:none}}
  `;
  document.head.appendChild(style);

  function getUi() {
    const container = document.getElementById('cameraContainer');
    const video = document.getElementById('cameraVideo');
    const capture = container?.querySelector('button[onclick*="captureCamera"]');
    const cancel = container?.querySelector('button[onclick*="stopCamera"]');
    return { container, video, capture, cancel };
  }

  function ensureUi() {
    const { container, capture } = getUi();
    if (!container) return;
    const controls = capture?.parentElement;
    controls?.classList.add('camera-guide-actions');
    if (container.querySelector('.camera-guide-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'camera-guide-layer';
    layer.innerHTML = `
      <div class="camera-guide-top"><strong>Position your face</strong><span>Look straight at the camera. Keep your full face inside the oval with good lighting.</span></div>
      <div class="camera-guide-oval" aria-hidden="true"></div>
      <div class="camera-guide-status" id="cameraGuideStatus" role="status" aria-live="polite"><i></i><span>Opening front camera…</span></div>
      <div class="camera-guide-privacy">Face alignment is processed on this device</div>`;
    container.appendChild(layer);
  }

  function setGuide(state, message, canCapture = false) {
    const { container, capture } = getUi();
    if (!container) return;
    container.dataset.guideState = state;
    const text = container.querySelector('#cameraGuideStatus span');
    if (text && text.textContent !== message) text.textContent = message;
    if (capture) {
      if (detectorMode === 'manual') capture.disabled = false;
      else capture.disabled = !canCapture;
    }
  }

  async function createDetector() {
    if (detector) return detector;
    if (detectorPromise) return detectorPromise;
    detectorPromise = (async () => {
      const visionModule = await import(MODULE_URL);
      const vision = await visionModule.FilesetResolver.forVisionTasks(WASM_URL);
      const common = {
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.58,
        minSuppressionThreshold: 0.3
      };
      try {
        detector = await visionModule.FaceDetector.createFromOptions(vision, {
          ...common,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }
        });
      } catch (_) {
        detector = await visionModule.FaceDetector.createFromOptions(vision, {
          ...common,
          baseOptions: { modelAssetPath: MODEL_URL }
        });
      }
      detectorMode = 'active';
      return detector;
    })().catch((error) => {
      console.warn('[camera-face-guide] Local detector unavailable; manual oval fallback enabled.', error);
      detectorMode = 'manual';
      detectorPromise = null;
      return null;
    });
    return detectorPromise;
  }

  function frameBrightness(video) {
    if (!video.videoWidth || !video.videoHeight) return 128;
    sampleCanvas ||= document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    sampleContext ||= sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) return 128;
    try {
      sampleContext.drawImage(video, 0, 0, 32, 32);
      const data = sampleContext.getImageData(0, 0, 32, 32).data;
      let total = 0;
      let samples = 0;
      for (let i = 0; i < data.length; i += 16) {
        total += (data[i] * .2126) + (data[i + 1] * .7152) + (data[i + 2] * .0722);
        samples += 1;
      }
      return samples ? total / samples : 128;
    } catch (_) {
      return 128;
    }
  }

  function assess(video, detections) {
    if (!detections?.length) return { state: 'warn', message: 'Place your face inside the oval.', ok: false };
    if (detections.length > 1) return { state: 'error', message: 'Only one face should be visible.', ok: false };
    const box = detections[0]?.boundingBox;
    if (!box || !video.videoWidth || !video.videoHeight) return { state: 'warn', message: 'Keep your face clearly inside the oval.', ok: false };

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const widthRatio = Number(box.width || 0) / vw;
    const heightRatio = Number(box.height || 0) / vh;
    const rawCenterX = (Number(box.originX || 0) + Number(box.width || 0) / 2) / vw;
    const displayedCenterX = 1 - rawCenterX;
    const centerY = (Number(box.originY || 0) + Number(box.height || 0) / 2) / vh;

    if (frameBrightness(video) < 42) return { state: 'warn', message: 'Move to better lighting so your face is clear.', ok: false };
    if (widthRatio < .22 || heightRatio < .26) return { state: 'warn', message: 'Move a little closer to the camera.', ok: false };
    if (widthRatio > .57 || heightRatio > .69) return { state: 'warn', message: 'Move slightly back so your full face fits.', ok: false };
    if (Math.abs(displayedCenterX - .5) > .13 || Math.abs(centerY - .46) > .14) return { state: 'warn', message: 'Move your face toward the centre of the oval.', ok: false };
    return { state: 'ready', message: 'Good position — hold still.', ok: true };
  }

  function scheduleLoop() {
    frameRequest = requestAnimationFrame(runDetection);
  }

  function runDetection() {
    const { video } = getUi();
    if (!cameraOpen || !video?.srcObject) return;
    if (detectorMode === 'manual') {
      aligned = false;
      setGuide('warn', 'Live face check is unavailable — align manually inside the oval.', true);
      scheduleLoop();
      return;
    }
    if (detectorMode !== 'active' || !detector) {
      setGuide('warn', 'Starting local face alignment…', false);
      scheduleLoop();
      return;
    }

    const now = performance.now();
    if (now - lastDetectionAt < 140) {
      scheduleLoop();
      return;
    }
    lastDetectionAt = now;

    try {
      const result = detector.detectForVideo(video, now);
      const check = assess(video, result?.detections || []);
      if (!check.ok) {
        aligned = false;
        alignedSince = 0;
        setGuide(check.state, check.message, false);
      } else {
        if (!alignedSince) alignedSince = Date.now();
        aligned = Date.now() - alignedSince >= 700;
        setGuide('ready', aligned ? 'Face aligned — ready to capture.' : check.message, aligned);
      }
    } catch (error) {
      console.warn('[camera-face-guide] Detection frame failed; manual fallback enabled.', error);
      detectorMode = 'manual';
      aligned = false;
      setGuide('warn', 'Live face check is unavailable — align manually inside the oval.', true);
    }
    scheduleLoop();
  }

  function stopGuide() {
    cameraOpen = false;
    aligned = false;
    alignedSince = 0;
    lastDetectionAt = 0;
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = null;
    document.body.classList.remove('camera-guide-open');
    const { container } = getUi();
    container?.classList.remove('camera-guide-fullscreen');
    if (container) delete container.dataset.guideState;
  }

  async function waitForVideo() {
    const { video } = getUi();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (!cameraOpen) return false;
      if (video?.srcObject && video.readyState >= 2 && video.videoWidth > 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  async function beginGuide() {
    const { container, video, capture } = getUi();
    if (!container || !video) return;
    ensureUi();
    cameraOpen = true;
    aligned = false;
    alignedSince = 0;
    detectorMode = detector ? 'active' : 'loading';
    container.classList.add('camera-guide-fullscreen');
    document.body.classList.add('camera-guide-open');
    if (capture) capture.disabled = true;
    setGuide('warn', 'Opening front camera…', false);

    if (!(await waitForVideo()) || !cameraOpen) {
      setGuide('error', 'Camera could not start. Check camera permission and try again.', false);
      return;
    }

    const track = video.srcObject?.getVideoTracks?.()[0];
    track?.applyConstraints?.({ width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 30 } }).catch(() => {});
    setGuide('warn', 'Starting local face alignment…', false);
    await createDetector();
    if (!cameraOpen) return;
    if (detectorMode === 'manual') setGuide('warn', 'Live face check is unavailable — align manually inside the oval.', true);
    runDetection();
  }

  function install() {
    if (window.__innviktaCameraFaceGuideInstalled) return;
    const originalStart = window.startCamera;
    const originalStop = window.stopCamera;
    const originalCapture = window.captureCamera;
    if (typeof originalStart !== 'function' || typeof originalStop !== 'function' || typeof originalCapture !== 'function') return;

    window.__innviktaCameraFaceGuideInstalled = true;
    ensureUi();

    window.startCamera = function guidedStartCamera(event) {
      ensureUi();
      const { container } = getUi();
      if (container) {
        container.classList.add('camera-guide-fullscreen');
        container.style.display = 'block';
      }
      document.body.classList.add('camera-guide-open');
      const result = originalStart.call(this, event);
      beginGuide().catch((error) => {
        console.warn('[camera-face-guide] Guidance startup failed.', error);
        detectorMode = 'manual';
        setGuide('warn', 'Centre your face manually inside the oval.', true);
      });
      return result;
    };

    window.stopCamera = function guidedStopCamera(event) {
      stopGuide();
      return originalStop.call(this, event);
    };

    window.captureCamera = function guidedCaptureCamera(event) {
      if (detectorMode === 'loading') {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setGuide('warn', 'Face guide is starting. Hold still for a moment.', false);
        return;
      }
      if (detectorMode === 'active' && !aligned) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setGuide('warn', 'Hold your face inside the oval until the guide turns green.', false);
        return;
      }
      return originalCapture.call(this, event);
    };

    window.addEventListener('pagehide', stopGuide);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden || !cameraOpen) return;
      const { video, container } = getUi();
      video?.srcObject?.getTracks?.().forEach((track) => track.stop());
      stopGuide();
      if (container) container.style.display = 'none';
    });
  }

  (async () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (typeof window.startCamera === 'function' && document.getElementById('cameraContainer')) {
        install();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  })();
})();
