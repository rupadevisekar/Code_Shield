// Real-Time Secret Detector for CodeShield
class RealTimeSecretDetector {
    constructor(editor, options = {}) {
        this.editor = editor;
        this.aiDetector = window.aiSecretDetector;
        this.debounceTime = options.debounceTime || 1000; // Default 1 second debounce
        this.debounceTimer = null;
        this.decorations = [];
        this.currentFileType = options.fileType || '';
        
        // Initialize the editor with our custom decorations
        this.initializeEditor();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    initializeEditor() {
        // Define decoration styles for different confidence levels
        this.decorationTypes = {
            high: {
                overviewRuler: {
                    color: 'rgba(220, 38, 38, 0.8)', // Red
                    position: monaco.editor.OverviewRulerLane.Right
                },
                inlineClassName: 'secret-highlight-high',
                glyphMarginClassName: 'secret-glyph-high',
                hoverMessage: {
                    value: '**High confidence secret detected**'
                }
            },
            medium: {
                overviewRuler: {
                    color: 'rgba(234, 179, 8, 0.8)', // Yellow
                    position: monaco.editor.OverviewRulerLane.Right
                },
                inlineClassName: 'secret-highlight-medium',
                glyphMarginClassName: 'secret-glyph-medium',
                hoverMessage: {
                    value: '**Potential secret detected**'
                }
            },
            info: {
                overviewRuler: {
                    color: 'rgba(59, 130, 246, 0.8)', // Blue
                    position: monaco.editor.OverviewRulerLane.Right
                },
                inlineClassName: 'secret-highlight-info',
                glyphMarginClassName: 'secret-glyph-info',
                hoverMessage: {
                    value: '**Info: This might be a secret**'
                }
            }
        };
        
        // Register hover provider for additional information
        this.registerHoverProvider();
    }
    
    setupEventListeners() {
        // Debounced content change handler
        this.editor.onDidChangeModelContent(() => {
            this.scheduleScan();
        });
        
        // Handle cursor changes to show quick fixes
        this.editor.onDidChangeCursorPosition((e) => {
            this.handleCursorChange(e);
        });
        
        // Handle clicks on the glyph margin for quick actions
        this.editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                this.handleGlyphClick(e);
            }
        });
    }
    
    scheduleScan() {
        // Clear any pending scans
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Schedule a new scan
        this.debounceTimer = setTimeout(() => {
            this.scanDocument();
        }, this.debounceTime);
    }
    
    async scanDocument() {
        if (!this.aiDetector || !this.aiDetector.settings.enabled) {
            return;
        }
        
        const model = this.editor.getModel();
        if (!model) return;
        
        const content = model.getValue();
        if (!content) return;
        
        try {
            // Get the current file type from the model's language
            const fileType = this.currentFileType || this.editor.getModel()?.getLanguageId() || '';
            
            // Use the AI detector to find secrets
            const findings = await this.aiDetector.detectSecrets(content, fileType);
            
            // Update decorations based on findings
            this.updateDecorations(findings);

            // Push findings into the Secrets Dashboard storage so the dashboard displays data
            try {
                if (Array.isArray(findings) && findings.length > 0) {
                    const filePath = (model && model.uri && (model.uri.fsPath || model.uri.path || model.uri.toString())) || 'untitled';
                    // Load current stored secrets
                    let stored = [];
                    try { stored = JSON.parse(localStorage.getItem('codeshield_secrets') || '[]'); } catch (_) { stored = []; }

                    const byKey = new Set(stored.map(s => `${s.content}@@${s.filePath}@@${s.lineNumber}`));

                    const additions = [];
                    findings.forEach(f => {
                        const item = {
                            id: (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString() + Math.random().toString(36).slice(2)),
                            content: f.content || '',
                            type: f.type || 'ai_detected',
                            filePath: filePath,
                            lineNumber: f.line || 1,
                            confidence: typeof f.confidence === 'number' ? f.confidence : (typeof f.score === 'number' ? f.score : 0.5),
                            status: 'new',
                            detectedAt: new Date().toISOString(),
                            context: f.context || ''
                        };
                        const key = `${item.content}@@${item.filePath}@@${item.lineNumber}`;
                        if (!byKey.has(key) && item.content) {
                            byKey.add(key);
                            additions.push(item);
                        }
                    });

                    if (additions.length) {
                        const updated = [...additions, ...stored];
                        try { localStorage.setItem('codeshield_secrets', JSON.stringify(updated)); } catch (_) {}

                        // If the dashboard exists, update it live
                        if (window.secretsDashboard) {
                            try { window.secretsDashboard.refresh(); } catch (_) {}
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to push findings to Secrets Dashboard:', e);
            }

            // Show a status message
            if (findings.length > 0) {
                this.showStatusMessage(`Found ${findings.length} potential secrets`, 'info');
            }

            return findings;
        } catch (error) {
            console.error('Error during real-time scanning:', error);
            this.showStatusMessage('Error during scanning', 'error');
            return [];
        }
    }
    
    updateDecorations(findings) {
        const model = this.editor.getModel();
        if (!model) return;
        
        // Clear existing decorations
        this.decorations = this.editor.deltaDecorations(this.decorations, []);
        
        // Create new decorations for each finding
        const newDecorations = findings.map(finding => {
            const { line, content, confidence, type } = finding;
            const lineContent = model.getLineContent(line);
            const matchIndex = lineContent.indexOf(content);
            
            if (matchIndex === -1) return null;
            
            const startColumn = matchIndex + 1;
            const endColumn = startColumn + content.length;
            
            // Determine decoration type based on confidence or type
            let decorationType = 'info';
            if (type === 'custom_pattern') {
                decorationType = 'high';
            } else if (confidence >= 0.8) {
                decorationType = 'high';
            } else if (confidence >= 0.5) {
                decorationType = 'medium';
            }
            
            const range = {
                startLineNumber: line,
                startColumn: startColumn,
                endLineNumber: line,
                endColumn: endColumn
            };
            
            // Add context to the hover message
            const hoverMessage = {
                ...this.decorationTypes[decorationType].hoverMessage,
                value: this.getHoverMessage(finding)
            };
            
            return {
                range: range,
                options: {
                    ...this.decorationTypes[decorationType],
                    hoverMessage: hoverMessage,
                    className: `secret-${type.replace('_', '-')}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                }
            };
        }).filter(Boolean); // Remove any null entries
        
        // Apply the new decorations
        this.decorations = this.editor.deltaDecorations([], newDecorations);
    }
    
    getHoverMessage(finding) {
        const { type, confidence, content, context, metadata } = finding;
        const confidencePercent = (confidence * 100).toFixed(1);
        
        let message = `**${type === 'custom_pattern' ? 'Custom Pattern Match' : 'AI-Detected Secret'}**\n\n`;
        message += `**Confidence:** ${confidencePercent}%\n`;
        
        if (context?.variableName) {
            message += `**Variable:** \`${context.variableName}\`\n`;
        }
        
        if (metadata?.patternDescription) {
            message += `**Pattern:** ${metadata.patternDescription}\n`;
        }
        
        message += '\n---\n';
        message += '**Content:**\n```\n';
        message += `${content}\n`;
        message += '```\n';
        
        // Add quick fix suggestions
        message += '\n**Quick Fixes:**\n';
        message += '- [ ] Replace with environment variable\n';
        message += '- [ ] Add to ignore list\n';
        message += '- [ ] Mark as false positive\n';
        
        return { value: message };
    }
    
    registerHoverProvider() {
        // Register a hover provider for our secret decorations
        monaco.languages.registerHoverProvider('*', {
            provideHover: (model, position) => {
                const lineNumber = position.lineNumber;
                const column = position.column;
                
                // Check if the position is within any of our decorations
                for (const decoration of this.decorations) {
                    const range = decoration.range;
                    if (range.startLineNumber <= lineNumber && 
                        range.endLineNumber >= lineNumber &&
                        range.startColumn <= column && 
                        range.endColumn >= column) {
                        
                        const finding = decoration.finding;
                        if (finding) {
                            return {
                                contents: [
                                    { value: this.getHoverMessage(finding).value }
                                ]
                            };
                        }
                    }
                }
                
                return null;
            }
        });
    }
    
    handleCursorChange(e) {
        // Show quick fix suggestions when cursor is on a line with a secret
        const lineNumber = e.position.lineNumber;
        const column = e.position.column;
        
        // Check if cursor is on a line with a secret
        for (const decoration of this.decorations) {
            const range = decoration.range;
            if (range.startLineNumber <= lineNumber && 
                range.endLineNumber >= lineNumber) {
                
                // Show quick fix suggestions
                this.showQuickFixes(lineNumber, column);
                return;
            }
        }
    }
    
    handleGlyphClick(e) {
        // Handle clicks on the glyph margin for quick actions
        const lineNumber = e.target.position.lineNumber;
        const column = e.target.position.column;
        
        // Find the secret at this position
        for (const decoration of this.decorations) {
            const range = decoration.range;
            if (range.startLineNumber <= lineNumber && 
                range.endLineNumber >= lineNumber) {
                
                // Show context menu with quick actions
                this.showContextMenu(e.event.browserEvent, lineNumber, column, decoration.finding);
                return;
            }
        }
    }
    
    showContextMenu(event, lineNumber, column, finding) {
        // Create context menu items
        const items = [
            {
                label: 'Replace with environment variable',
                action: () => this.replaceWithEnvVar(finding)
            },
            {
                label: 'Add to ignore list',
                action: () => this.addToIgnoreList(finding)
            },
            { type: 'separator' },
            {
                label: 'Mark as false positive',
                action: () => this.markAsFalsePositive(finding)
            },
            {
                label: 'Learn from this example',
                action: () => this.learnFromExample(finding, false)
            }
        ];
        
        // Show the context menu
        // This is a simplified version - in a real implementation, you would use a proper context menu library
        // or Monaco's built-in context menu system
        console.log('Show context menu at:', { x: event.clientX, y: event.clientY }, 'for finding:', finding);
    }
    
    showQuickFixes(lineNumber, column) {
        // Show quick fix suggestions in the editor
        // This is a placeholder - in a real implementation, you would use Monaco's editor actions
        // or show a lightbulb widget
        console.log('Show quick fixes at line:', lineNumber, 'column:', column);
    }
    
    async replaceWithEnvVar(finding) {
        const { line, content } = finding;
        const model = this.editor.getModel();
        const lineContent = model.getLineContent(line);
        const matchIndex = lineContent.indexOf(content);
        
        if (matchIndex === -1) return;
        
        // Prompt user for environment variable name
        const varName = prompt('Enter environment variable name (e.g., API_KEY):');
        if (!varName) return;
        
        // Replace the content with the environment variable reference
        const newLineContent = 
            lineContent.substring(0, matchIndex) + 
            `process.env.${varName}` + 
            lineContent.substring(matchIndex + content.length);
        
        // Apply the edit
        model.pushEditOperations(
            [],
            [{
                range: {
                    startLineNumber: line,
                    startColumn: 1,
                    endLineNumber: line,
                    endColumn: lineContent.length + 1
                },
                text: newLineContent
            }],
            () => null
        );
        
        this.showStatusMessage(`Replaced with environment variable: ${varName}`, 'success');
    }
    
    async addToIgnoreList(finding) {
        // Add the pattern to the ignore list
        const { content } = finding;
        
        try {
            // Escape special regex characters
            const escapedContent = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Add as a custom pattern
            await this.aiDetector.addCustomPattern(
                escapedContent,
                `Ignored secret: ${content.substring(0, 20)}...`
            );
            
            // Remove the decoration
            this.decorations = this.decorations.filter(d => d.finding !== finding);
            
            this.showStatusMessage('Added to ignore list', 'success');
        } catch (error) {
            console.error('Error adding to ignore list:', error);
            this.showStatusMessage('Failed to add to ignore list', 'error');
        }
    }
    
    markAsFalsePositive(finding) {
        // Mark the finding as a false positive
        this.aiDetector.learnFromFeedback([], [{
            text: finding.content,
            context: finding.context
        }]);
        
        // Remove the decoration
        this.decorations = this.decorations.filter(d => d.finding !== finding);
        
        this.showStatusMessage('Marked as false positive', 'info');
    }
    
    learnFromExample(finding, isPositive = true) {
        // Learn from this example (positive or negative)
        if (isPositive) {
            this.aiDetector.learnFromFeedback([{
                text: finding.content,
                context: finding.context
            }], []);
        } else {
            this.aiDetector.learnFromFeedback([], [{
                text: finding.content,
                context: finding.context
            }]);
        }
        
        // Remove the decoration
        this.decorations = this.decorations.filter(d => d.finding !== finding);
        
        this.showStatusMessage(
            isPositive ? 'Learned as positive example' : 'Learned as negative example', 
            'info'
        );
    }
    
    showStatusMessage(message, type = 'info') {
        // Show a status message in the editor
        // This is a simplified version - in a real implementation, you would use a proper notification system
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Example of showing a status bar message
        if (window.showEditorStatus) {
            window.showEditorStatus(message, type === 'error', 3000);
        }
    }
    
    dispose() {
        // Clean up event listeners and resources
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Clear all decorations
        if (this.editor && this.decorations.length > 0) {
            this.editor.deltaDecorations(this.decorations, []);
            this.decorations = [];
        }
    }
}

// Export the RealTimeSecretDetector class
window.RealTimeSecretDetector = RealTimeSecretDetector;
