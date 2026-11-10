// AI Secret Detector using TensorFlow.js
class AISecretDetector {
    constructor() {
        this.model = null;
        this.isModelLoading = false;
        this.modelUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json';
        this.vocabUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/metadata.json';
        this.vocabulary = null;
        this.settings = {
            confidenceThreshold: 0.7,
            enabled: true
        };
        
        // Initialize with default settings, will be updated when settings are loaded
        this.updateSettings();
    }
    
    // Update settings from the settings manager
    updateSettings() {
        if (window.settingsManager) {
            const aiSettings = window.settingsManager.getAIDetectionSettings();
            this.settings = {
                confidenceThreshold: parseFloat(aiSettings.confidenceThreshold) || 0.7,
                enabled: aiSettings.enabled !== false // Default to true if not set
            };
        }
        return this.settings;
    }

    async loadModel() {
        if (this.model) return true;
        if (this.isModelLoading) return false;

        this.isModelLoading = true;
        try {
            // Load the model and vocabulary
            [this.model, this.vocabulary] = await Promise.all([
                tf.loadLayersModel(this.modelUrl),
                fetch(this.vocabUrl).then(res => res.json())
            ]);
            return true;
        } catch (error) {
            console.error('Failed to load AI model:', error);
            return false;
        } finally {
            this.isModelLoading = false;
        }
    }
    
    preprocessText(text) {
        // Simple tokenization and cleaning
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(word => word.length > 0);
    }
    
    preprocessCode(code, fileType) {
        // Preprocess the code based on file type
        if (fileType === 'text') {
            return code.split('\n').map(line => line.trim());
        }
        // Add other file type handling as needed
        return [];
    }

    textToSequence(tokens) {
        // Convert tokens to sequence of indices
        return tokens.map(token => {
            const index = this.vocabulary.indexOf(token);
            return index !== -1 ? index : 0; // 0 is for unknown words
        });
    }

    padSequence(sequence, maxLen = 100) {
        // Pad or truncate sequence to fixed length
        if (sequence.length > maxLen) {
            return sequence.slice(0, maxLen);
        }
        return sequence.concat(new Array(maxLen - sequence.length).fill(0));
    }
    
    // Prepare a batch of text for prediction
    prepareBatch(texts) {
        const sequences = texts.map(text => {
            const tokens = this.preprocessText(text);
            const sequence = this.textToSequence(tokens);
            return this.padSequence(sequence);
        });
        return tf.tensor2d(sequences);
    }
    
    // Clean up any remaining resources
    cleanup() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
    }
    
    async detectSecrets(code, fileType) {
        // Check if AI detection is enabled
        this.updateSettings();
        if (!this.settings.enabled) {
            return [];
        }

        // Ensure model is loaded
        if (!this.model) {
            const loaded = await this.loadModel();
            if (!loaded) return [];
        }

        try {
            // Preprocess the code
            const processedCode = this.preprocessCode(code, fileType);
            if (processedCode.length === 0) return [];
            
            // Get predictions (batched for better performance)
            const batchSize = 32;
            const results = [];
            const codeLines = code.split('\n');
            
            for (let i = 0; i < processedCode.length; i += batchSize) {
                const batch = processedCode.slice(i, i + batchSize);
                const batchTensor = this.prepareBatch(batch);
                const batchPredictions = await this.model.predict(batchTensor).array();
                batchTensor.dispose(); // Clean up tensor
                
                // Process batch results
                for (let j = 0; j < batchPredictions.length; j++) {
                    const lineIndex = i + j;
                    if (lineIndex < processedCode.length) {
                        const score = batchPredictions[j][0];
                        if (score >= this.settings.confidenceThreshold) {
                            results.push({
                                line: lineIndex + 1,
                                content: (codeLines[lineIndex] || '').trim(),
                                type: 'ai_prediction',
                                confidence: score,
                                score: score
                            });
                        }
                    }
                }
            }
            
            return results;
        } catch (error) {
            console.error('AI Detection Error:', error);
            return [];
        }
    }
}

// Initialize AI detector when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiSecretDetector = new AISecretDetector();
});

export default AISecretDetector;
