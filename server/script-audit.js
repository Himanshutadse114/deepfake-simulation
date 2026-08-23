const crypto = require('node:crypto');

function describeScript(value) {
  const text = String(value ?? '');
  return {
    length: text.length,
    sha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex')
  };
}

function sameScript(left, right) {
  if (!left || !right) return false;
  return Number(left.length) === Number(right.length) && String(left.sha256) === String(right.sha256);
}

module.exports = { describeScript, sameScript };
