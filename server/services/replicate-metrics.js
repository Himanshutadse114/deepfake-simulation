function secondsBetween(start, end) {
  const startMs = Date.parse(start || '');
  const endMs = Date.parse(end || '');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Number(((endMs - startMs) / 1000).toFixed(3));
}

function finiteSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(3)) : null;
}

function summarizePrediction(prediction, { label = 'Replicate prediction', wallSeconds = null } = {}) {
  if (!prediction) {
    return {
      label,
      predictionId: null,
      model: null,
      status: 'unknown',
      startupSeconds: null,
      predictSeconds: null,
      totalSeconds: null,
      overheadSeconds: null,
      wallSeconds: finiteSeconds(wallSeconds)
    };
  }

  const predictSeconds = finiteSeconds(prediction.metrics?.predict_time);
  const totalSeconds = finiteSeconds(prediction.metrics?.total_time);
  const startupSeconds = secondsBetween(prediction.created_at, prediction.started_at);
  const overheadSeconds = totalSeconds !== null && predictSeconds !== null
    ? Number(Math.max(0, totalSeconds - predictSeconds).toFixed(3))
    : null;

  return {
    label,
    predictionId: prediction.id || null,
    model: prediction.model || null,
    status: prediction.status || 'unknown',
    createdAt: prediction.created_at || null,
    startedAt: prediction.started_at || null,
    completedAt: prediction.completed_at || null,
    startupSeconds,
    predictSeconds,
    totalSeconds,
    overheadSeconds,
    wallSeconds: finiteSeconds(wallSeconds)
  };
}

function formatMetric(metric) {
  const value = (seconds) => seconds === null || seconds === undefined ? 'n/a' : `${seconds.toFixed(3)}s`;
  return `${metric.label} | id=${metric.predictionId || 'n/a'} | status=${metric.status} | starting=${value(metric.startupSeconds)} | predict=${value(metric.predictSeconds)} | total=${value(metric.totalSeconds)} | overhead=${value(metric.overheadSeconds)} | app_wall=${value(metric.wallSeconds)}`;
}

async function runTrackedReplicatePrediction(replicate, model, options, {
  label = 'Replicate prediction',
  onMetric
} = {}) {
  const started = process.hrtime.bigint();
  let latestPrediction = null;

  const onProgress = (prediction) => {
    latestPrediction = prediction;
  };

  try {
    const output = await replicate.run(model, options, onProgress);
    const wallSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    const metric = summarizePrediction(latestPrediction, { label, wallSeconds });
    console.log(`[replicate-metrics] ${formatMetric(metric)}`);
    if (typeof onMetric === 'function') onMetric(metric);
    return output;
  } catch (error) {
    const wallSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    const metric = summarizePrediction(latestPrediction, { label, wallSeconds });
    metric.status = latestPrediction?.status || 'failed';
    console.warn(`[replicate-metrics] ${formatMetric(metric)} | error=${error.message || error}`);
    if (typeof onMetric === 'function') onMetric(metric);
    throw error;
  }
}

module.exports = {
  runTrackedReplicatePrediction,
  summarizePrediction,
  secondsBetween,
  finiteSeconds,
  formatMetric
};
