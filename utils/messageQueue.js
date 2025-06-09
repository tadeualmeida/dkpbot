// utils/messageQueue.js
const actionQueue = [];
let isProcessing = false;

/** Enqueue a function that returns a Promise. */
function enqueueAction(fn) {
  actionQueue.push(fn);
  processQueue();
}

async function processQueue() {
  if (isProcessing || actionQueue.length === 0) return;
  isProcessing = true;
  const fn = actionQueue.shift();
  try {
    await fn();
  } catch (err) {
    console.error('Queue action error:', err);
  }
  // Adjust delay to match your throughput goals
  setTimeout(() => {
    isProcessing = false;
    processQueue();
  }, 250); // 250ms spacing = ~4 requests/sec
}

module.exports = { enqueueAction };
