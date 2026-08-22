(() => {
  const MEDIAPIPE_MODULE = '/vendor/mediapipe/vision_bundle.mjs';
  const MEDIAPIPE_WASM = '/vendor/mediapipe/wasm';
  const FACE_MODEL = '/vendor/mediapipe/blaze_face_short_range.tflite';

  let detector = null;
  let detectorLoading = null;
  let detectionTimer = null;
  let detectorAvailable = false;
  let cameraOpen = false;
  let aligned = false;
  let alignedSince = 0;
  let lastDetectionAt = 0;
  let qualityCanvas = null;
  let qualityContext = null;

  const style = document.createElement('style');
  style.textContent = `
    body.camera-guide-open{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}
    #cameraContainer.camera-guide-fullscreen{
      position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100dvh!important;
      border-radius:0!important;background:#03060b!important;overflow:hidden!important;display:block!important;
    }
    #cameraContainer.camera-guide-fullscreen #cameraVideo{
      position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;
      transform:scaleX(-1);background:#05070b;
    }
    .camera-guide-layer{position:absolute;inset:0;z-index:3;pointer-events:none;color:#fff;font-family:Inter,system-ui,sans-serif}
    .camera-guide-top{position:absolute;left:0;right:0;top:0;padding:max(22px,env(safe-area-inset-top)) 22px 0;text-align:center;text-shadow:0 2px 16px rgba(0,0,0,.65)}
    .camera-guide-top strong{display:block;font-size:clamp(21px,5vw,30px);font-weight:700;letter-spacing:-.02em}
    .camera-guide-top span{display:block;margin-top:6px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.78)}
    .camera-guide-oval{
      position:absolute;left:50%;top:46%;width:min(72vw,370px);aspect-ratio:.76;transform:translate(-50%,-50%);
      border:3px solid rgba(255,255,255,.74);border-radius:50%;box-shadow:0 0 0 200vmax rgba(0,0,0,.58),0 0 34px rgba(255,255,255,.08) inset;
      transition:border-color .18s ease,box-shadow .18s ease;
    }
    .camera-guide-oval:before,.camera-guide-oval:after{content:"";position:absolute;left:50%;width:38%;height:1px;background:rgba(255,255,255,.23);transform:translateX(-50%)}
    .camera-guide-oval:before{top:35%}.camera-guide-oval:after{top:63%}
    #cameraContainer[data-guide-state="ready"] .camera-guide-oval{border-color:#42d980;box-shadow:0 0 0 200vmax rgba(0,0,0,.55),0 0 28px rgba(66,217,128,.34)}
    #cameraContainer[data-guide-state="warn"] .camera-guide-oval{border-color:#ffb15f}
    #cameraContainer[data-guide-state="error"] .camera-guide-oval{border-color:#ff6565}
    .camera-guide-status{
      position:absolute;left:50%;bottom:calc(112px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(90vw,420px);
      padding:11px 16px;border-radius:999px;background:rgba(7,12,20,.76);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(14px);
      text-align:center;font-size:12px;font-weight:650;box-shadow:0 10px 35px rgba(0,0,0,.25)
    }
    .camera-guide-status i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffb15f;margin-right:8px;vertical-align:1px}
    #cameraContainer[data-guide-state="ready"] .camera-guide-status i{background:#42d980;box-shadow:0 0 12px rgba(66,217,128,.65)}
    #cameraContainer[data-guide-state="error"] .camera-guide-status i{background:#ff6565}
    .camera-guide-privacy{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:9px;letter-spacing:.055em;text-transform:uppercase;color:rgba(255,255,255,.58);white-space:nowrap}
    #cameraContainer.camera-guide-fullscreen>div:last-child{z-index:5!important;bottom:max(18px,env(safe-area-inset-bottom))!important;gap:12px!important;padding:0 18px!important}
    #cameraContainer.camera-guide-fullscreen>div:last-child button{min-height:48px!important;padding:0 22px!important;border-radius:999px!important;font-size:13px!important}
    #cameraContainer.camera-guide-fullscreen>div:last-child button[disabled]{opacity:.38!important;cursor:not-allowed!important;filter:saturate(.25)}
    @media(max-width:520px){
      .camera-guide-oval{width:min(76vw,330px);top:45%}
      .camera-guide-status{bottom:calc(116px + env(safe-area-inset-bottom));font-size:11px}
      .camera-guide-privacy{bottom:calc(82px + env(safe-area-inset-bottom));font-size:8px}
      .camera-guide-top{padding-left:18px;padding-right:18px}
    }
    @media(orientation:landscape) and (max-height:600px){
      .camera-guide-oval{width:min(34vw,270px);top:48%}
      .camera-guide-top strong{font-size:20px}.camera-guide-top span{font-size:10px}
      .camera-guide-status{bottom:70px;width:min(62vw,420px)}.camera-guide-privacy{display:none}
    }
  `;
  document.head.appendChild(style);

  function elements() {
    const container = document.getElementById('cameraContainer');
    const video = document.getElementById('cameraVideo');
    const capture = container?.querySelector('button[onclick*="captureCamera"]');
    const cancel = container?.querySelector('button[onclick*="stopCamera"]');
    return { container, video, capture, cancel };
  }

  function ensureGuideUi() {
    const { container } = elements();
    if (!container || container.querySelector('.camera-guide-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'camera-guide-layer';
    layer.innerHTML = `
      <div class="camera-guide-top"><strong>Position your face</strong><span>Look straight at the camera and keep your full face inside the oval.</span></div>
      <div class="camera-guide-oval" aria-hidden="true"></div>
      <div class="camera-guide-status" id="cameraGuideStatus" role="status" aria-live="polite"><i></i><span>Opening front camera…</span></div>
      <div class="camera-guide-privacy">Face alignment is processed on this device</div>`;
    container.appendChild(layer);
  }

  function setGuide(state, message, canCapture = false) {
    const { container, capture } = elements();
    if (!container) return;
    container.dataset.guideState = state;
    const text = container.querySelector('#cameraGuideStatus span');
    if (text && text.textContent !== message) text.textContent = message;
    if (capture) capture.disabled = detectorAvailable ? !canCapture : false;
  }

  async function loadDetector() {
    if (detector) return detector;
    if (detectorLoading) return detectorLoading;
    detectorLoading = (async () => {
      const visionModule = await import(MEDIAPIPE_MODULE);
      const vision = await visionModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      const instance = await visionModule.FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.58,
        minSuppressionThreshold: 0.3
      });
      detector = instance;
      detectorAvailable = true;
      return instance;
    })().catch((error) => {
      detectorAvailable = false;
      detectorLoading = null;
      console.warn('[camera-face-guide] Face detector unavailable; using manual alignment fallback.', error);
      return null;
    });
    return detectorLoading;
  }

  function brightness(video) {
    if (!video.videoWidth || !video.videoHeight) return 128;
    qualityCanvas ||= document.createElement('canvas');
    qualityCanvas.width = 32;
    qualityCanvas.height = 32;
    qualityContext ||= qualityCanvas.getContext('2d', { willReadFrequently: true });
    if (!qualityContext) return 128;
    try {
      qualityContext.drawImage(video, 0, 0, 32, 32);
      const data = qualityContext.getImageData(0, 0, 32, 32).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 16) total += (data[i] * .2126) + (data[i + 1] * .7152) + (data[i + 2] * .0722);
      return total / (data.length / 16);
    } catch (_) {
      return 128;
    }
  }

  function assessFace(video, detections) {
    if (!Array.isArray(detections) || detections.length === 0) return { state: 'warn', message: 'Place your face inside the oval.', ok: false };
    if (detections.length > 1) return { state: 'error', message: 'Only one face should be visible.', ok: false };

    const box = detections[0]?.boundingBox;
    if (!box || !video.videoWidth || !video.videoHeight) return { state: 'warn', message: 'Hold your face clearly inside the oval.', ok: false };

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const widthRatio = Number(box.width || 0) / vw;
    const heightRatio = Number(box.height || 0) / vh;
    const rawCenterX = (Number(box.originX || 0) + (Number(box.width || 0) / 2)) / vw;
    const centerX = 1 - rawCenterX; // preview is mirrored
    const centerY = (Number(box.originY || 0) + (Number(box.height || 0) / 2)) / vh;
    const light = brightness(video);

    if (light < 42) return { state: 'warn', message: 'Move to better lighting so your face is clear.', ok: false };
    if (widthRatio < .22 || heightRatio < .26) return { state: 'warn', message: 'Move a little closer to the camera.', ok: false };
    if (widthRatio > .57 || heightRatio > .69) return { state: 'warn', message: 'Move slightly back so your full face fits.', ok: false };
    if (Math.abs(centerX - .5) > .13 || Math.abs(centerY - .46) > .14) return { state: 'warn', message: 'Move your face toward the centre of the oval.', ok: false };

    return { state: 'ready', message: 'Good position — hold still.', ok: true };
  }

  async function detectLoop() {
    const { container, video } = elements();
    if (!cameraOpen || !container || !video || !video.srcObject) return;
    const now = performance.now();
    if (now - lastDetectionAt < 140) {
      detectionTimer = requestAnimationFrame(detectLoop);
      return;
    }
    lastDetectionAt = now;

    if (!detectorAvailable || !detector) {
      setGuide('warn', 'Face guide unavailable — centre your face manually.', true);
      detectionTimer = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const result = detector.detectForVideo(video, now);
      const assessment = assessFace(video, result?.detections || []);
      if (!assessment.ok) {
        aligned = false;
        alignedSince = 0;
        setGuide(assessment.state, assessment.message, false);
      } else {
        if (!alignedSince) alignedSince = Date.now();
        const stable = Date.now() - alignedSince >= 700;
        aligned = stable;
        setGuide('ready', stable ? 'Face aligned — ready to capture.' : assessment.message, stable);
      }
    } catch (error) {
      console.warn('[camera-face-guide] detection frame failed', error);
      detectorAvailable = false;
      aligned = false;
      setGuide('warn', 'Face guide unavailable — centre your face manually.', true);
    }
    detectionTimer = requestAnimationFrame(detectLoop);
  }

  function stopDetection() {
    cameraOpen = false;
    aligned = false;
    alignedSince = 0;
    if (detectionTimer) cancelAnimationFrame(detectionTimer);
    detectionTimer = null;
    lastDetectionAt = 0;
    document.body.classList.remove('camera-guide-open');
    const { container } = elements();
    container?.classList.remove('camera-guide-fullscreen');
    if (container) delete container.dataset.guideState;
  }

  async function waitForCamera() {
    const { video } = elements();
    for (let i = 0; i < 80; i += 1) {
      if (!cameraOpen) return false;
      if (video?.srcObject && video.readyState >= 2 && video.videoWidth > 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  async function beginGuidance() {
    const { container, video, capture } = elements();
    if (!container || !video) return;
    ensureGuideUi();
    cameraOpen = true;
    aligned = false;
    alignedSince = 0;
    container.classList.add('camera-guide-fullscreen');
    document.body.classList.add('camera-guide-open');
    if (capture) capture.disabled = true;
    setGuide('warn', 'Opening front camera…', false);

    const ready = await waitForCamera();
    if (!ready || !cameraOpen) {
      setGuide('error', 'Camera could not start. Check camera permission and try again.', false);
      return;
    }

    const track = video.srcObject?.getVideoTracks?.()[0];
    track?.applyConstraints?.({ width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 30 } }).catch(() => {});

    setGuide('warn', 'Starting local face alignment…', false);
    const loaded = await loadDetector();
    if (!cameraOpen) return;
    if (!loaded) {
      setGuide('warn', 'Face guide unavailable — centre your face manually.', true);
      if (capture) capture.disabled = false;
    }
    detectLoop();
  }

  function install() {
    if (window.__innviktaCameraFaceGuideInstalled) return;
    const originalStartCamera = window.startCamera;
    const originalStopCamera = window.stopCamera;
    const originalCaptureCamera = window.captureCamera;
    if (typeof originalStartCamera !== 'function' || typeof originalStopCamera !== 'function' || typeof originalCaptureCamera !== 'function') return;

    window.__innviktaCameraFaceGuideInstalled = true;
    ensureGuideUi();

    window.startCamera = function guidedStartCamera(event) {
      ensureGuideUi();
      const { container } = elements();
      if (container) {
        container.classList.add('camera-guide-fullscreen');
        container.style.display = 'block';
      }
      document.body.classList.add('camera-guide-open');
      const result = originalStartCamera.call(this, event);
      beginGuidance().catch((error) => {
        console.warn('[camera-face-guide] guidance startup failed', error);
        detectorAvailable = false;
        setGuide('warn', 'Centre your face manually and capture when ready.', true);
      });
      return result;
    };

    window.stopCamera = function guidedStopCamera(event) {
      stopDetection();
      return originalStopCamera.call(this, event);
    };

    window.captureCamera = function guidedCaptureCamera(event) {
      if (detectorAvailable && !aligned) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setGuide('warn', 'Hold your face inside the oval until the guide turns green.', false);
        return;
      }
      const result = originalCaptureCamera.call(this, event);
      // Original capture completes asynchronously via canvas.toBlob and then
      // calls stopCamera(), which is wrapped above for full cleanup.
      return result;
    };

    window.addEventListener('pagehide', stopDetection);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && cameraOpen) {
        const { video } = elements();
        video?.srcObject?.getTracks?.().forEach((track) => track.stop());
        stopDetection();
        const { container } = elements();
        if (container) container.style.display = 'none';
      }
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
