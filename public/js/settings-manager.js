// Settings Manager for CodeShield
class SettingsManager {
    constructor() {
        this.settings = {
            aiDetection: {
                enabled: true,
                confidenceThreshold: 0.7,
                modelUrl: 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json',
                useContextAwareness: true,
                learnFromFeedback: true,
                customPatterns: [],
                realTimeDetection: true,
                showInlayHints: true
            },
            performance: {
                modelCaching: true,
                maxFileSizeMB: 10,
                maxScanThreads: 4
            },
            ui: {
                theme: 'dark',
                fontSize: 14,
                showLineNumbers: true,
                showMinimap: true
            },
            version: '1.1.0'
        };
        
        // Initialize default custom patterns if none exist
        if (this.settings.aiDetection.customPatterns.length === 0) {
            this.settings.aiDetection.customPatterns = this.getDefaultPatterns();
        }
        
        this.initElements();
        this.loadSettings();
        this.setupEventListeners();
    }
    
    initElements() {
        // Toggle switches
        this.elements = {
            // AI Detection
            aiToggle: document.getElementById('ai-detection-toggle'),
            aiConfidence: document.getElementById('ai-confidence'),
            aiConfidenceValue: document.getElementById('confidence-value'),
            aiSettings: document.getElementById('ai-settings'),
            
            // Performance
            modelCachingToggle: document.getElementById('model-caching-toggle'),
            
            // Buttons
            resetBtn: document.getElementById('reset-settings'),
            saveBtn: document.getElementById('close-settings'),
            openSettingsBtn: document.getElementById('open-settings'),
            settingsPanel: document.getElementById('settings-panel')
        };
    }
    
    // Get default patterns for common secret types
    getDefaultPatterns() {
        return [
            {
                id: 'api_key',
                name: 'API Key',
                pattern: '([a-zA-Z0-9]{32,})',
                description: 'Generic API key (32+ alphanumeric characters)',
                severity: 'high',
                enabled: true
            },
            {
                id: 'aws_key',
                name: 'AWS Access Key',
                pattern: 'AKIA[0-9A-Z]{16}',
                description: 'AWS Access Key ID',
                severity: 'high',
                enabled: true
            },
            {
                id: 'aws_secret',
                name: 'AWS Secret Key',
                pattern: '(?i)aws[_-]?(?:secret[_-]?)?access[_-]?key(?:[^\w]|$).*?([a-zA-Z0-9+\/]{40})',
                description: 'AWS Secret Access Key',
                severity: 'high',
                enabled: true
            },
            {
                id: 'password_in_code',
                name: 'Password in Code',
                pattern: '(?i)(password|passwd|pwd)[\s]*[=:][\s\"\']*([^\s\"\']+)',
                description: 'Password assignment in code',
                severity: 'high',
                enabled: true
            },
            {
                id: 'jwt',
                name: 'JWT Token',
                pattern: 'eyJ[a-zA-Z0-9\/\r\n+]*=*\.[a-zA-Z0-9\/\r\n+]*=*\.[a-zA-Z0-9\/\r\n+]*=*',
                description: 'JSON Web Token',
                severity: 'medium',
                enabled: true
            },
            {
                id: 'email',
                name: 'Email Address',
                pattern: '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                description: 'Email address (may be sensitive in some contexts)',
                severity: 'low',
                enabled: false
            }
        ];
    }
    
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('codeshield-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                
                // Merge settings with defaults, preserving arrays and nested objects
                this.mergeSettings(this.settings, parsed);
                
                // Ensure custom patterns have all required fields
                if (this.settings.aiDetection.customPatterns) {
                    this.settings.aiDetection.customPatterns = this.settings.aiDetection.customPatterns.map(pattern => ({
                        id: pattern.id || `custom_${Date.now()}`,
                        name: pattern.name || 'Custom Pattern',
                        pattern: pattern.pattern || '',
                        description: pattern.description || 'Custom pattern',
                        severity: pattern.severity || 'medium',
                        enabled: pattern.enabled !== false // Default to true if not specified
                    }));
                }
                
                // Migrate settings from older versions if needed
                this.migrateSettings();
            }
        } catch (e) {
            console.error('Error loading settings:', e);
            // Reset to defaults on error
            this.settings = this.getDefaultSettings();
        }
        
        // Save the merged settings back to ensure all defaults are set
        this.saveSettings();
        
        // Notify listeners that settings have been loaded
        this.notifySettingsChanged();
    }
    
    // Deep merge settings objects
    mergeSettings(target, source) {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // If the property is an object (and not an array), merge it recursively
                if (!target[key]) {
                    target[key] = {};
                }
                this.mergeSettings(target[key], source[key]);
            } else if (Array.isArray(source[key])) {
                // For arrays, we want to replace the entire array
                target[key] = [...source[key]];
            } else {
                // For primitives, just copy the value
                target[key] = source[key];
            }
        });
    }
    
    // Migrate settings from older versions if needed
    migrateSettings() {
        // Migration from version 1.0.0 to 1.1.0
        if (!this.settings.version || this.settings.version === '1.0.0') {
            // Add new settings with defaults
            this.settings.aiDetection.useContextAwareness = true;
            this.settings.aiDetection.learnFromFeedback = true;
            this.settings.aiDetection.realTimeDetection = true;
            this.settings.aiDetection.showInlayHints = true;
            
            // Add performance settings
            if (!this.settings.performance) {
                this.settings.performance = {
                    modelCaching: true,
                    maxFileSizeMB: 10,
                    maxScanThreads: 4
                };
            }
            
            // Add UI settings
            if (!this.settings.ui) {
                this.settings.ui = {
                    theme: 'dark',
                    fontSize: 14,
                    showLineNumbers: true,
                    showMinimap: true
                };
            }
            
            // Update version
            this.settings.version = '1.1.0';
        }
    }
    
    // Get default settings
    getDefaultSettings() {
        return {
            aiDetection: {
                enabled: true,
                confidenceThreshold: 0.7,
                modelUrl: 'https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json',
                useContextAwareness: true,
                learnFromFeedback: true,
                customPatterns: this.getDefaultPatterns(),
                realTimeDetection: true,
                showInlayHints: true
            },
            performance: {
                modelCaching: true,
                maxFileSizeMB: 10,
                maxScanThreads: 4
            },
            ui: {
                theme: 'dark',
                fontSize: 14,
                showLineNumbers: true,
                showMinimap: true
            },
            version: '1.1.0'
        };
    }
    
    // Update UI based on current settings
    updateUI() {
        if (!this.elements) return;
        
        // Update AI Detection Toggle
        if (this.elements.aiToggle) {
            this.elements.aiToggle.checked = this.settings.aiDetection.enabled;
        }
        
        // Update Confidence Slider
        if (this.elements.aiConfidence) {
            this.elements.aiConfidence.value = this.settings.aiDetection.confidenceThreshold * 100;
        }
        
        // Update Confidence Value Display
        if (this.elements.aiConfidenceValue) {
            this.elements.aiConfidenceValue.textContent = `${Math.round(this.settings.aiDetection.confidenceThreshold * 100)}%`;
        }
        
        // Update Model Caching Toggle
        if (this.elements.modelCachingToggle) {
            this.elements.modelCachingToggle.checked = this.settings.performance.modelCaching;
        }
    }
    
    saveSettings() {
        try {
            // Make sure we have valid settings
            if (!this.settings) {
                console.error('No settings to save');
                return false;
            }
            
            // Save to localStorage
            localStorage.setItem('codeshield-settings', JSON.stringify(this.settings));
            
            // Notify any listeners that settings have changed
            this.notifySettingsChanged();
            
            console.log('Settings saved successfully:', this.settings);
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            
            // Show error to user
            const event = new CustomEvent('show-notification', {
                detail: {
                    message: 'Failed to save settings: ' + error.message,
                    type: 'error',
                    duration: 5000
                }
            });
            document.dispatchEvent(event);
            
            return false;
        }
    }
    
    // Notify listeners that settings have changed
    notifySettingsChanged() {
        const event = new CustomEvent('settingsChanged', { detail: this.settings });
        window.dispatchEvent(event);
    }
    
    showNotification(message, type = 'info') {
        try {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md text-white ${
                type === 'success' ? 'bg-green-500' :
                type === 'error' ? 'bg-red-500' :
                'bg-blue-500'
            } shadow-lg transition-opacity duration-300 opacity-0`;
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Trigger reflow to enable transition
            requestAnimationFrame(() => {
                notification.classList.remove('opacity-0');
                notification.classList.add('opacity-100');
                
                // Auto-remove after delay
                setTimeout(() => {
                    notification.classList.remove('opacity-100');
                    notification.classList.add('opacity-0');
                    setTimeout(() => {
                        if (notification && notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 3000);
            });
            
            return true;
        } catch (error) {
            console.error('Error showing notification:', error);
            return false;
        }
    }
    
    // Get AI detection settings
    getAIDetectionSettings() {
        return { ...this.settings.aiDetection };
    }
    
    // Update AI detection settings
    async updateAIDetectionSettings(updates) {
        this.settings.aiDetection = { ...this.settings.aiDetection, ...updates };
        this.saveSettings();
        
        // Update the AI detector if it exists
        if (window.aiSecretDetector) {
            await window.aiSecretDetector.updateSettings();
        }
        
        // Update UI to reflect changes
        this.updateUI();
        
        return this.settings.aiDetection;
    }
    
    // Reset all settings to defaults
    resetToDefaults() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
        this.updateUI();
        this.notifySettingsChanged();
        return true;
    }
    
    updateUI() {
        const { aiDetection, performance } = this.settings;
        const { 
            aiToggle, 
            aiConfidence, 
            aiConfidenceValue, 
            aiSettings,
            modelCachingToggle
        } = this.elements;
        
        // AI Detection
        aiToggle.checked = aiDetection.enabled;
        aiConfidence.value = aiDetection.confidenceThreshold;
        aiConfidenceValue.textContent = aiDetection.confidenceThreshold;
        aiSettings.style.display = aiDetection.enabled ? 'block' : 'none';
        
        // Performance
        modelCachingToggle.checked = performance.modelCaching;
    }
    
    setupEventListeners() {
        const { 
            aiToggle, 
            aiConfidence, 
            resetBtn, 
            saveBtn, 
            openSettingsBtn,
            settingsPanel,
            modelCachingToggle
        } = this.elements;
        
        // Toggle AI Detection
        aiToggle.addEventListener('change', (e) => {
            this.settings.aiDetection.enabled = e.target.checked;
            this.updateUI();
        });
        
        // AI Confidence Slider
        aiConfidence.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.settings.aiDetection.confidenceThreshold = value;
            this.elements.aiConfidenceValue.textContent = value.toFixed(2);
        });
        
        // Model Caching Toggle
        modelCachingToggle.addEventListener('change', (e) => {
            this.settings.performance.modelCaching = e.target.checked;
        });
        
        // Reset Button
        resetBtn.addEventListener('click', () => this.resetToDefaults());
        
        // Save Button
        saveBtn.addEventListener('click', () => {
            if (this.saveSettings()) {
                settingsPanel.classList.add('hidden');
            }
        });
        
        // Open Settings Panel
        openSettingsBtn.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
        });
        
        // Close when clicking outside
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) {
                settingsPanel.classList.add('hidden');
            }
        });
    }
    
    showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
            isError ? 'bg-red-600' : 'bg-green-600'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Getters for settings
    getAIDetectionSettings() {
        return this.settings.aiDetection;
    }
    
    getPerformanceSettings() {
        return this.settings.performance;
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

