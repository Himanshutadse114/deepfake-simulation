function renderDemoPage() {
  return `<!doctype html>
<html lang="en" data-theme="dark" data-demo-instance="true">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#06080d" />
<meta name="robots" content="noindex,nofollow" />
<meta name="description" content="Internal no-AI preview of the deepfake awareness simulation" />
<title>Deepfake Awareness Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:ital,wght@0,600;0,700;0,900;1,600&display=swap" rel="stylesheet" />
<style>
  html[data-demo-instance="true"] .intro-actions .demo-action{display:none!important}
  html[data-demo-instance="true"] .intro-actions{justify-content:center!important}
  html[data-demo-instance="true"] .intro-actions .primary{width:min(620px,100%)!important;margin-inline:auto!important}
</style>
</head>
<body data-demo-instance="true">
<div id="uiBoot" style="min-height:100vh;background:#06080d"></div>
<script src="/voice-recording-prompt.js?v=1" defer></script>
<script src="/ui-bootstrap.js?v=network-recovery-20260822-1" defer></script>
</body>
</html>`;
}

module.exports = { renderDemoPage };
