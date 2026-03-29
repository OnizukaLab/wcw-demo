// Wvlet Scala.js Worker stub
// In production, this would load the actual Scala.js bundle

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  switch (msg.type) {
    case 'compile': {
      // Scala.js not available in this demo build
      self.postMessage({
        type: 'error',
        id: msg.id,
        error: 'Scala.js wvlet-lang not available. Using fallback.',
      });
      break;
    }
  }
};

// Signal ready after a failed init attempt
setTimeout(() => {
  // Don't signal ready since Scala.js is not available
}, 100);
