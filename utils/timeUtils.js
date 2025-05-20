// utils/timeUtils.js
const DURATION_RE = /(\d+)([smhd])/g;

/**
 * Parse a duration string like "1h30m", "45m", "10s" into milliseconds.
 * Returns NaN on invalid input.
 */
function parseDuration(str) {
  let total = 0;
  let match;
  while ((match = DURATION_RE.exec(str)) !== null) {
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': total += n * 1000; break;
      case 'm': total += n * 60_000; break;
      case 'h': total += n * 60 * 60_000; break;
      case 'd': total += n * 24 * 60 * 60_000; break;
    }
  }
  return total > 0 ? total : NaN;
}

function formatDuration(ms) {
  if (isNaN(ms) || ms <= 0) return '0s';
  const parts = [];
  let s = ms / 1000;
  const days = Math.floor(s / 86400);
  if (days) { parts.push(`${days}d`); s %= 86400; }
  const hours = Math.floor(s / 3600);
  if (hours) { parts.push(`${hours}h`); s %= 3600; }
  const mins = Math.floor(s / 60);
  if (mins) { parts.push(`${mins}m`); s %= 60; }
  const secs = Math.floor(s);
  if (secs) { parts.push(`${secs}s`); }
  return parts.join('');
}

module.exports = { parseDuration, formatDuration };