// AI Secret Detector using TensorFlow.js with enhanced capabilities
class AISecretDetectorEnhanced {
    constructor() {
        this.model = null;
        this.encoder = null;
        this.isModelLoading = false;
        this.modelUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json';
        this.vocabUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/metadata.json';
        this.vocabulary = null;
        this.customPatterns = [];
        this.contextWeights = {
            variableName: 0.3,
            surroundingCode: 0.4,
            fileType: 0.2,
            customPatterns: 0.5
        };
        this.settings = {
            confidenceThreshold: 0.7,
            enabled: true,
            useContextAwareness: true,
            learnFromFeedback: true,
            customPatterns: []
        };
        
        // Initialize with default settings, will be updated when settings are loaded
        this.updateSettings();
        this.loadCustomPatterns();
    }
    
    // Update settings from the settings manager
    updateSettings() {
        if (window.settingsManager) {
            const aiSettings = window.settingsManager.getAIDetectionSettings();
            this.settings = {
                confidenceThreshold: parseFloat(aiSettings.confidenceThreshold) || 0.7,
                enabled: aiSettings.enabled !== false, // Default to true if not set
                useContextAwareness: aiSettings.useContextAwareness !== false, // Default to true
                learnFromFeedback: aiSettings.learnFromFeedback !== false, // Default to true
                customPatterns: aiSettings.customPatterns || []
            };
            
            // Update custom patterns if they've changed
            if (JSON.stringify(this.customPatterns) !== JSON.stringify(this.settings.customPatterns)) {
                this.customPatterns = [...this.settings.customPatterns];
            }
        }
        return this.settings;
    }

    async loadModel() {
        if (this.model && this.encoder) return true;
        if (this.isModelLoading) return false;

        this.isModelLoading = true;
        try {
            // Load the Universal Sentence Encoder and model in parallel
            [this.encoder, this.model, this.vocabulary] = await Promise.all([
                use.load(),
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
    
    // Load custom patterns from storage
    async loadCustomPatterns() {
        try {
            const savedPatterns = localStorage.getItem('aiCustomPatterns');
            if (savedPatterns) {
                this.customPatterns = JSON.parse(savedPatterns);
                if (window.settingsManager) {
                    window.settingsManager.updateAIDetectionSettings({ 
                        customPatterns: this.customPatterns 
                    });
                }
            }
        } catch (error) {
            console.error('Error loading custom patterns:', error);
        }
    }

    // Save custom patterns to storage
    async saveCustomPatterns() {
        try {
            localStorage.setItem('aiCustomPatterns', JSON.stringify(this.customPatterns));
            if (window.settingsManager) {
                await window.settingsManager.updateAIDetectionSettings({ 
                    customPatterns: this.customPatterns 
                });
            }
        } catch (error) {
            console.error('Error saving custom patterns:', error);
        }
    }

    // Add a new custom pattern
    async addCustomPattern(pattern, description = '') {
        try {
            // Test if the pattern is a valid regex
            new RegExp(pattern);
            
            const newPattern = {
                id: Date.now().toString(),
                pattern,
                description,
                createdAt: new Date().toISOString(),
                matches: 0
            };
            
            this.customPatterns.push(newPattern);
            await this.saveCustomPatterns();
            return newPattern;
        } catch (error) {
            console.error('Invalid regex pattern:', error);
            throw new Error('Invalid regular expression pattern');
        }
    }

    // Remove a custom pattern by ID
    async removeCustomPattern(patternId) {
        const initialLength = this.customPatterns.length;
        this.customPatterns = this.customPatterns.filter(p => p.id !== patternId);
        
        if (this.customPatterns.length < initialLength) {
            await this.saveCustomPatterns();
            return true;
        }
        return false;
    }

    // Analyze code context to improve detection
    analyzeContext(code, lineNumber, fileType) {
        const lines = code.split('\n');
        const context = {
            variableName: this.extractVariableName(lines[lineNumber - 1]),
            surroundingCode: this.getSurroundingCode(lines, lineNumber),
            fileType: fileType || 'unknown',
            customPatternMatches: this.checkCustomPatterns(lines[lineNumber - 1])
        };
        
        return context;
    }
    
    // Extract variable name from a line of code
    extractVariableName(line) {
        // Match common variable assignment patterns
        const varMatch = line.match(/\b(?:const|let|var|private|protected|public)?\s+([a-zA-Z_$][\w$]*)\s*[=:]/);
        return varMatch ? varMatch[1] : null;
    }
    
    // Get surrounding code for context
    getSurroundingCode(lines, lineNumber, contextLines = 2) {
        const start = Math.max(0, lineNumber - 1 - contextLines);
        const end = Math.min(lines.length, lineNumber + contextLines);
        return lines.slice(start, end).join('\n');
    }
    
    // Check for matches against custom patterns
    checkCustomPatterns(line) {
        if (!this.customPatterns.length) return [];
        
        const matches = [];
        for (const pattern of this.customPatterns) {
            const regex = new RegExp(pattern.pattern, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                matches.push({
                    patternId: pattern.id,
                    patternDescription: pattern.description,
                    match: match[0],
                    index: match.index
                });
                
                // Update match count
                pattern.matches = (pattern.matches || 0) + 1;
            }
        }
        
        // Save updated match counts
        if (matches.length > 0) {
            this.saveCustomPatterns();
        }
        
        return matches;
    }

    // Enhanced text preprocessing with context
    preprocessText(text, context = {}) {
        // Basic preprocessing
        let processed = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Add context information if available
        if (context.variableName) {
            processed = `${context.variableName} ${processed}`;
        }
        
        if (context.fileType) {
            processed = `${context.fileType} ${processed}`;
        }
        
        return processed;
    }
    
    preprocessCode(code, fileType) {
        // Preprocess the code based on file type
        // Default: split into trimmed lines for ALL file types so detection can run
        // Specific file-type adjustments can be added above this default behavior
        const lines = code.split('\n').map(line => line.trim());
        return lines;
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

    // Generate embeddings for text using Universal Sentence Encoder
    async generateEmbeddings(text) {
        if (!this.encoder) {
            await this.loadModel();
        }
        
        try {
            const embeddings = await this.encoder.embed([text]);
            return embeddings;
        } catch (error) {
            console.error('Error generating embeddings:', error);
            throw error;
        }
    }

    // Calculate similarity between two pieces of text
    async calculateSimilarity(text1, text2) {
        try {
            const [embeddings1, embeddings2] = await Promise.all([
                this.generateEmbeddings(text1),
                this.generateEmbeddings(text2)
            ]);
            
            // Calculate cosine similarity
            const similarity = await tf.tidy(() => {
                const a = tf.tensor2d(embeddings1.dataSync(), [1, -1]);
                const b = tf.tensor2d(embeddings2.dataSync(), [1, -1]);
                
                const aNorm = a.norm('euclidean', 1, true);
                const bNorm = b.norm('euclidean', 1, true);
                
                // Avoid division by zero
                const aSafe = a.div(aNorm.add(1e-8));
                const bSafe = b.div(bNorm.add(1e-8));
                
                return aSafe.mul(bSafe).sum(1).dataSync()[0];
            });
            
            return similarity;
        } catch (error) {
            console.error('Error calculating similarity:', error);
            return 0;
        }
    }

    // Learn from user feedback to improve future detections
    async learnFromFeedback(positiveExamples = [], negativeExamples = []) {
        if (!this.settings.learnFromFeedback) return;
        
        try {
            // Process positive examples (confirmed secrets)
            for (const example of positiveExamples) {
                const { text, context } = example;
                // Here you would typically update your model or patterns
                // For now, we'll just log it
                console.log('Learning from positive example:', { text, context });
            }
            
            // Process negative examples (false positives)
            for (const example of negativeExamples) {
                const { text, context } = example;
                // Here you would typically update your model or patterns
                // For now, we'll just log it
                console.log('Learning from negative example:', { text, context });
            }
            
            // In a real implementation, you would:
            // 1. Update model weights
            // 2. Adjust confidence thresholds
            // 3. Add to a retraining dataset
        } catch (error) {
            console.error('Error learning from feedback:', error);
        }
    }

    // Main detection method with context awareness
    async detectSecrets(code, fileType = '') {
        if (!this.settings.enabled) return [];
        
        const lines = code.split('\n');
        const findings = [];
        
        // Process each line with context
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            
            // Skip empty lines or lines that are too short
            if (!line.trim() || line.trim().length < 5) continue;
            
            // Analyze context for this line
            const context = this.analyzeContext(code, lineNumber, fileType);
            
            // Check custom patterns first (faster than AI)
            if (context.customPatternMatches.length > 0) {
                for (const match of context.customPatternMatches) {
                    findings.push({
                        line: lineNumber,
                        content: line,
                        type: 'custom_pattern',
                        confidence: 0.9, // High confidence for explicit patterns
                        context,
                        metadata: {
                            patternId: match.patternId,
                            patternDescription: match.patternDescription
                        }
                    });
                }
                continue;
            }
            
            // Skip AI detection if disabled or context suggests it's not needed
            if (!this.settings.useContextAwareness || !this.shouldUseAIForLine(line, context)) {
                continue;
            }
            
            try {
                // Use AI to detect potential secrets
                await this.loadModel();
                
                // Preprocess the text with context
                const processedText = this.preprocessText(line, context);
                
                // Generate embeddings and make prediction
                const embeddings = await this.generateEmbeddings(processedText);
                const prediction = this.model.predict(embeddings);
                const confidence = prediction.dataSync()[0];
                
                if (confidence >= this.settings.confidenceThreshold) {
                    findings.push({
                        line: lineNumber,
                        content: line,
                        type: 'ai_detected',
                        confidence,
                        context,
                        metadata: {
                            detectionMethod: 'AI + Context Analysis'
                        }
                    });
                }
            } catch (error) {
                console.error(`Error processing line ${lineNumber}:`, error);
            }
        }
        
        return findings;
    }
    
    // Determine if AI should be used for a specific line based on context
    shouldUseAIForLine(line, context) {
        // Skip comments and common non-secret patterns
        if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
            return false;
        }
        
        // Skip common non-secret patterns
        const commonNonSecrets = [
            'http://', 'https://', // URLs (unless they contain tokens)
            'example.com', 'localhost', // Common non-secret hosts
            'TODO', 'FIXME', 'HACK' // Common code comments
        ];
        
        if (commonNonSecrets.some(term => line.includes(term))) {
            return false;
        }
        
        // Check variable names for common non-secret patterns
        if (context.variableName) {
            const varName = context.variableName.toLowerCase();
            const nonSecretVarPatterns = [
                'temp', 'count', 'index', 'i', 'j', 'k', // Common loop variables
                'name', 'title', 'description', 'label'  // Common non-secret fields
            ];
            
            if (nonSecretVarPatterns.some(term => varName.includes(term))) {
                return false;
            }
            
            // Check for common secret-like variable names
            const secretVarPatterns = [
                'key', 'secret', 'token', 'password', 'passwd', 'pwd',
                'api[_-]?key', 'api[_-]?secret', 'access[_-]?token',
                'auth[_-]?token', 'private[_-]?key'
            ];
            
            const secretVarRegex = new RegExp(secretVarPatterns.join('|'), 'i');
            if (secretVarRegex.test(varName)) {
                return true; // Higher chance this is a secret
            }
        }
        
        return true; // Default to using AI if no rules matched
    }
}

// Initialize AI detector when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize the enhanced AI detector
    window.aiSecretDetector = new AISecretDetectorEnhanced();
    
    // For backward compatibility, keep the old reference
    window.AISecretDetector = window.aiSecretDetector;
    
    // Load the model in the background
    window.aiSecretDetector.loadModel().then(loaded => {
        if (loaded) {
            console.log('AI Secret Detector initialized successfully');
        } else {
            console.warn('AI Secret Detector failed to load model');
        }
    });
});

export default AISecretDetectorEnhanced;
