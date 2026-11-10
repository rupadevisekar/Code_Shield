// Web Worker for background secret detection
const tf = self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js');

class DetectionWorker {
  constructor() {
    this.customPatterns = [];
    this.model = null;
    this.encoder = null;
    this.initialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Load model and encoder in parallel
      const [model, encoder] = await Promise.all([
        tf.loadLayersModel('/models/secret-detection/model.json'),
        this.loadUniversalSentenceEncoder()
      ]);
      
      this.model = model;
      this.encoder = encoder;
      this.initialized = true;
      
      // Notify main thread that worker is ready
      self.postMessage({ type: 'initialized' });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        error: 'Failed to initialize worker: ' + error.message 
      });
    }
  }

  async loadUniversalSentenceEncoder() {
    // Implementation for loading the Universal Sentence Encoder
    // This is a placeholder - you'll need to implement this based on your requirements
    return {
      embed: async (texts) => {
        // Mock implementation - replace with actual USE embedding
        return tf.randomNormal([texts.length, 512]);
      }
    };
  }

  async processChunk(chunk, fileType) {
    if (!this.initialized) {
      throw new Error('Worker not initialized');
    }

    const findings = [];
    const lines = chunk.split('\n');
    
    // Process each line in the chunk
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // Check against custom patterns
      for (const pattern of this.customPatterns) {
        const regex = new RegExp(pattern.pattern, pattern.flags || 'g');
        let match;
        
        while ((match = regex.exec(line)) !== null) {
          findings.push({
            type: 'custom_pattern',
            content: match[0],
            line: lineNumber,
            column: match.index + 1,
            confidence: 0.95, // High confidence for exact pattern matches
            context: {
              lineContent: line,
              fileType: fileType
            },
            metadata: {
              patternName: pattern.name || 'Custom Pattern',
              patternDescription: pattern.description || ''
            }
          });
        }
      }
      
      // Use AI model for more complex detection
      if (this.model && line.length > 10) { // Skip very short lines
        const embeddings = await this.encoder.embed([line]);
        const prediction = this.model.predict(embeddings);
        const [scores] = await prediction.array();
        
        if (scores[1] > 0.7) { // Threshold for detection
          findings.push({
            type: 'ai_detected',
            content: line.trim(),
            line: lineNumber,
            column: 1,
            confidence: scores[1],
            context: {
              lineContent: line,
              fileType: fileType
            }
          });
        }
        
        // Clean up tensors to prevent memory leaks
        tf.dispose([embeddings, prediction]);
      }
    }
    
    return findings;
  }

  updateSettings(settings) {
    if (settings.customPatterns) {
      this.customPatterns = settings.customPatterns;
    }
  }
}

// Initialize worker
const worker = new DetectionWorker();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'process':
        const { chunk, fileType } = payload;
        const findings = await worker.processChunk(chunk, fileType);
        self.postMessage({ 
          type: 'findings', 
          payload: { findings } 
        });
        break;
        
      case 'updateSettings':
        worker.updateSettings(payload);
        self.postMessage({ type: 'settingsUpdated' });
        break;
        
      case 'ping':
        self.postMessage({ type: 'pong' });
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error.message 
    });
  }
});
