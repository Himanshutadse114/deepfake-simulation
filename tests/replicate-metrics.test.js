const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizePrediction,
  secondsBetween,
  formatMetric
} = require('../server/services/replicate-metrics');

test('calculates Replicate starting, prediction and overhead time', () => {
  const prediction = {
    id: 'prediction-123',
    model: 'prunaai/p-video-avatar',
    status: 'succeeded',
    created_at: '2026-09-15T04:00:00.000Z',
    started_at: '2026-09-15T04:00:03.250Z',
    completed_at: '2026-09-15T04:00:18.500Z',
    metrics: {
      predict_time: 15.1,
      total_time: 18.5
    }
  };

  const metric = summarizePrediction(prediction, {
    label: 'Pruna avatar video',
    wallSeconds: 18.9
  });

  assert.equal(metric.startupSeconds, 3.25);
  assert.equal(metric.predictSeconds, 15.1);
  assert.equal(metric.totalSeconds, 18.5);
  assert.equal(metric.overheadSeconds, 3.4);
  assert.equal(metric.wallSeconds, 18.9);
  assert.match(formatMetric(metric), /starting=3\.250s/);
});

test('handles missing Replicate timestamps without inventing timing values', () => {
  assert.equal(secondsBetween(null, null), null);
  const metric = summarizePrediction(null, { label: 'Qwen', wallSeconds: 2.34567 });
  assert.equal(metric.startupSeconds, null);
  assert.equal(metric.predictSeconds, null);
  assert.equal(metric.wallSeconds, 2.346);
});
