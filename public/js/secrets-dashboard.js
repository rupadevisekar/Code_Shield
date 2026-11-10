/**
 * Secrets Dashboard for CodeShield
 * Provides a comprehensive view of all detected secrets with filtering and bulk actions
 */

class SecretsDashboard {
  constructor() {
    this.secrets = [];
    this.filteredSecrets = [];
    this.currentFilters = {
      confidence: 'all',
      type: 'all',
      status: 'all',
      search: ''
    };
    
    this.initializeUI();
  }

  /**
   * Seed demo data for quick verification
   */
  addDemoData() {
    const samples = [
      {
        content: 'AKIAEXAMPLEKEY1234567890',
        type: 'api_key',
        filePath: 'src/server.js',
        lineNumber: 42,
        confidence: 0.93
      },
      {
        content: 'password=SuperSecret@123',
        type: 'password',
        filePath: 'config/.env',
        lineNumber: 12,
        confidence: 0.88
      },
      {
        content: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
        type: 'jwt',
        filePath: 'app/routes/auth.ts',
        lineNumber: 77,
        confidence: 0.81
      }
    ];

    samples.forEach(s => this.addSecret({ ...s }));
    this.applyFilters();
    this.showToast('Loaded demo secrets', 'success');
  }

  /**
   * Refresh dashboard from storage
   */
  refresh() {
    try {
      const savedSecrets = localStorage.getItem('codeshield_secrets');
      this.secrets = savedSecrets ? JSON.parse(savedSecrets) : [];
      this.filteredSecrets = [...this.secrets];
      this.updateUI();
    } catch (e) {
      console.error('Failed to refresh secrets:', e);
    }
  }
  
  /**
   * Initialize the dashboard UI
   */
  initializeUI() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'secrets-dashboard';
    this.container.innerHTML = `
      <div class="dashboard-header">
        <h2>Secrets Dashboard</h2>
        <div class="dashboard-controls">
          <div class="filters">
            <select id="confidence-filter" class="filter-select">
              <option value="all">All Confidence Levels</option>
              <option value="high">High Confidence</option>
              <option value="medium">Medium Confidence</option>
              <option value="low">Low Confidence</option>
            </select>
            
            <select id="type-filter" class="filter-select">
              <option value="all">All Types</option>
              <option value="api_key">API Keys</option>
              <option value="password">Passwords</option>
              <option value="token">Tokens</option>
              <option value="certificate">Certificates</option>
              <option value="custom">Custom Patterns</option>
            </select>
            
            <select id="status-filter" class="filter-select">
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="ignored">Ignored</option>
              <option value="fixed">Fixed</option>
            </select>
            
            <input type="text" id="search-secrets" class="search-input" placeholder="Search secrets...">
          </div>
          
          <div class="bulk-actions">
            <button id="select-all" class="btn btn-outline">Select All</button>
            <button id="deselect-all" class="btn btn-outline">Deselect All</button>
            <select id="bulk-action" class="action-select">
              <option value="">Bulk Actions</option>
              <option value="ignore">Ignore Selected</option>
              <option value="fix">Mark as Fixed</option>
              <option value="delete">Delete Selected</option>
              <option value="export">Export to CSV</option>
            </select>
            <button id="apply-bulk-action" class="btn btn-primary">Apply</button>
            <div class="flex-1"></div>
            <button id="refresh-secrets" class="btn btn-outline">Refresh</button>
            <button id="load-demo-secrets" class="btn btn-primary">Load Demo Data</button>
          </div>
        </div>
      </div>
      
      <div class="dashboard-stats">
        <div class="stat-card">
          <div class="stat-value" id="total-secrets">0</div>
          <div class="stat-label">Total Secrets</div>
        </div>
        <div class="stat-card">
          <div class="stat-value high" id="high-severity">0</div>
          <div class="stat-label">High Severity</div>
        </div>
        <div class="stat-card">
          <div class="stat-value medium" id="medium-severity">0</div>
          <div class="stat-label">Medium Severity</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="fixed-secrets">0</div>
          <div class="stat-label">Fixed</div>
        </div>
      </div>
      
      <div class="secrets-table-container">
        <table class="secrets-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-checkbox"></th>
              <th>Secret</th>
              <th>Type</th>
              <th>Location</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>First Detected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="secrets-table-body">
            <!-- Rows will be populated by JavaScript -->
          </tbody>
        </table>
        <div id="secrets-empty-state" class="text-center text-gray-400 py-8 hidden">
          No secrets yet. Make some edits in the editor or run a scan to populate this dashboard.
        </div>
      </div>
      
      <div class="pagination">
        <button id="prev-page" class="btn btn-outline" disabled>Previous</button>
        <span id="page-info">Page 1 of 1</span>
        <button id="next-page" class="btn btn-outline" disabled>Next</button>
      </div>
    `;
    
    // Add styles
    this.addStyles();
  }
  
  /**
   * Add styles for the dashboard
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .secrets-dashboard {
        font-family: 'Inter', sans-serif;
        color: #e2e8f0;
        padding: 1.5rem;
        background-color: #1a202c;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .dashboard-header {
        margin-bottom: 1.5rem;
      }
      
      .dashboard-header h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #f7fafc;
      }
      
      .dashboard-controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .filters, .bulk-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .filter-select, .action-select, .search-input {
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        border: 1px solid #4a5568;
        background-color: #2d3748;
        color: #e2e8f0;
        font-size: 0.875rem;
      }
      
      .search-input {
        min-width: 250px;
        flex-grow: 1;
      }
      
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
      }
      
      .btn-primary {
        background-color: #4299e1;
        color: white;
      }
      
      .btn-primary:hover {
        background-color: #3182ce;
      }
      
      .btn-outline {
        background-color: transparent;
        border-color: #4a5568;
        color: #e2e8f0;
      }
      
      .btn-outline:hover {
        border-color: #718096;
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .stat-card {
        background-color: #2d3748;
        border-radius: 0.5rem;
        padding: 1.25rem;
        text-align: center;
      }
      
      .stat-value {
        font-size: 1.875rem;
        font-weight: 700;
        color: #4299e1;
        margin-bottom: 0.25rem;
      }
      
      .stat-value.high {
        color: #f56565;
      }
      
      .stat-value.medium {
        color: #ecc94b;
      }
      
      .stat-label {
        font-size: 0.875rem;
        color: #a0aec0;
      }
      
      .secrets-table-container {
        overflow-x: auto;
        margin-bottom: 1.5rem;
        background-color: #2d3748;
        border-radius: 0.5rem;
        border: 1px solid #4a5568;
      }
      
      .secrets-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .secrets-table th, 
      .secrets-table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #4a5568;
      }
      
      .secrets-table th {
        background-color: #2d3748;
        font-weight: 600;
        color: #a0aec0;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
      }
      
      .secrets-table tbody tr:hover {
        background-color: rgba(74, 85, 104, 0.2);
      }
      
      .confidence-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .confidence-bar {
        height: 6px;
        border-radius: 3px;
        background-color: #4a5568;
        flex-grow: 1;
        overflow: hidden;
      }
      
      .confidence-level {
        height: 100%;
        border-radius: 3px;
      }
      
      .confidence-high {
        background-color: #f56565;
      }
      
      .confidence-medium {
        background-color: #ecc94b;
      }
      
      .confidence-low {
        background-color: #48bb78;
      }
      
      .status-badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
      }
      
      .status-new {
        background-color: #4299e1;
        color: white;
      }
      
      .status-ignored {
        background-color: #a0aec0;
        color: #1a202c;
      }
      
      .status-fixed {
        background-color: #48bb78;
        color: white;
      }
      
      .action-buttons {
        display: flex;
        gap: 0.5rem;
      }
      
      .action-btn {
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-view {
        background-color: #4299e1;
        color: white;
      }
      
      .btn-ignore {
        background-color: #ecc94b;
        color: #1a202c;
      }
      
      .btn-fix {
        background-color: #48bb78;
        color: white;
      }
      
      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        margin-top: 1.5rem;
      }
      
      #page-info {
        font-size: 0.875rem;
        color: #a0aec0;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Set up event listeners for the dashboard
   */
  setupEventListeners() {
    // Filter change events (container-scoped)
    this.container.querySelector('#confidence-filter')?.addEventListener('change', (e) => {
      this.currentFilters.confidence = e.target.value;
      this.applyFilters();
    });

    // Refresh

  // Refresh
  this.container.querySelector('#refresh-secrets')?.addEventListener('click', () => {
    this.refresh();
  });

  // Load demo data
  this.container.querySelector('#load-demo-secrets')?.addEventListener('click', () => {
    this.addDemoData();
  });
    this.container.querySelector('#status-filter')?.addEventListener('change', (e) => {
      this.currentFilters.status = e.target.value;
      this.applyFilters();
    });
    
    // Search input with debounce
    let searchTimeout;
    this.container.querySelector('#search-secrets')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.currentFilters.search = e.target.value.toLowerCase();
        this.applyFilters();
      }, 300);
    });
    
    // Select all/none
    this.container.querySelector('#select-all')?.addEventListener('click', () => {
      this.container.querySelectorAll('.secret-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
    });
    
    this.container.querySelector('#deselect-all')?.addEventListener('click', () => {
      this.container.querySelectorAll('.secret-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
    });
    
    // Bulk actions
    this.container.querySelector('#apply-bulk-action')?.addEventListener('click', () => {
      const action = this.container.querySelector('#bulk-action').value;
      if (!action) return;
      
      const selectedSecrets = [];
      this.container.querySelectorAll('.secret-checkbox:checked').forEach(checkbox => {
        selectedSecrets.push(checkbox.dataset.secretId);
      });
      
      if (selectedSecrets.length === 0) {
        alert('Please select at least one secret to perform this action.');
        return;
      }
      
      this.performBulkAction(action, selectedSecrets);
    });

    // Event delegation fallback for clicks
    this.container.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      const is = (sel) => t.closest(sel);

      if (is('#load-demo-secrets')) {
        e.preventDefault();
        this.addDemoData();
        return;
      }
      if (is('#refresh-secrets')) {
        e.preventDefault();
        this.refresh();
        return;
      }
      if (is('#select-all')) {
        e.preventDefault();
        this.container.querySelectorAll('.secret-checkbox').forEach(cb => cb.checked = true);
        return;
      }
      if (is('#deselect-all')) {
        e.preventDefault();
        this.container.querySelectorAll('.secret-checkbox').forEach(cb => cb.checked = false);
        return;
      }
      if (is('#apply-bulk-action')) {
        e.preventDefault();
        const action = this.container.querySelector('#bulk-action')?.value || '';
        const selected = Array.from(this.container.querySelectorAll('.secret-checkbox:checked')).map(cb => cb.dataset.secretId);
        if (action && selected.length) this.performBulkAction(action, selected);
        return;
      }
      if (t.classList.contains('action-btn') && t.dataset.action) {
        e.preventDefault();
        this.handleAction(t.dataset.action, t.dataset.secretId);
        return;
      }
    }, true);

    // Delegation for select/filter changes
    this.container.addEventListener('change', (e) => {
      const t = e.target;
      if (!t) return;
      if (t.id === 'confidence-filter') { this.currentFilters.confidence = t.value; this.applyFilters(); }
      if (t.id === 'type-filter') { this.currentFilters.type = t.value; this.applyFilters(); }
      if (t.id === 'status-filter') { this.currentFilters.status = t.value; this.applyFilters(); }
      if (t.id === 'bulk-action') { /* no-op until Apply */ }
    });
  }
  
  /**
   * Apply filters to the secrets list
   */
  applyFilters() {
    this.filteredSecrets = this.secrets.filter(secret => {
      // Filter by confidence
      if (this.currentFilters.confidence !== 'all') {
        if (this.currentFilters.confidence === 'high' && secret.confidence < 0.8) return false;
        if (this.currentFilters.confidence === 'medium' && 
            (secret.confidence >= 0.8 || secret.confidence < 0.5)) return false;
        if (this.currentFilters.confidence === 'low' && secret.confidence >= 0.5) return false;
      }
      
      // Filter by type
      if (this.currentFilters.type !== 'all' && secret.type !== this.currentFilters.type) {
        return false;
      }
      
      // Filter by status
      if (this.currentFilters.status !== 'all' && secret.status !== this.currentFilters.status) {
        return false;
      }
      
      // Filter by search term
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const matchesContent = secret.content.toLowerCase().includes(searchTerm);
        const matchesFile = secret.filePath.toLowerCase().includes(searchTerm);
        const matchesType = secret.type.toLowerCase().includes(searchTerm);
        
        if (!matchesContent && !matchesFile && !matchesType) {
          return false;
        }
      }
      
      return true;
    });
    
    this.updateUI();
  }
  
  /**
   * Update the UI with filtered secrets
   */
  updateUI() {
    const tbody = this.container.querySelector('#secrets-table-body');
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';

    // Empty state
    const emptyEl = this.container.querySelector('#secrets-empty-state');
    if (emptyEl) {
      if (!this.filteredSecrets || this.filteredSecrets.length === 0) {
        emptyEl.classList.remove('hidden');
      } else {
        emptyEl.classList.add('hidden');
      }
    }
    
    // Update stats
    this.updateStats();
    
    // Add rows for each secret
    this.filteredSecrets.forEach(secret => {
      const row = document.createElement('tr');
      
      // Format confidence level
      let confidenceClass = 'confidence-low';
      if (secret.confidence >= 0.8) confidenceClass = 'confidence-high';
      else if (secret.confidence >= 0.5) confidenceClass = 'confidence-medium';
      
      const confidencePercent = Math.round(secret.confidence * 100);
      
      // Format status badge
      const statusClass = `status-${secret.status || 'new'}`;
      
      // Create row HTML
      row.innerHTML = `
        <td><input type="checkbox" class="secret-checkbox" data-secret-id="${secret.id}"></td>
        <td class="font-mono text-sm">${this.truncate(secret.content, 30)}</td>
        <td>${this.formatType(secret.type)}</td>
        <td title="${secret.filePath}">${this.truncate(secret.filePath, 30)}</td>
        <td>
          <div class="confidence-cell">
            ${confidencePercent}%
            <div class="confidence-bar">
              <div class="confidence-level ${confidenceClass}" style="width: ${confidencePercent}%"></div>
            </div>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${secret.status || 'new'}</span></td>
        <td>${this.formatDate(secret.detectedAt)}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn btn-view" data-action="view" data-secret-id="${secret.id}">View</button>
            <button class="action-btn btn-ignore" data-action="ignore" data-secret-id="${secret.id}">Ignore</button>
            <button class="action-btn btn-fix" data-action="fix" data-secret-id="${secret.id}">Fix</button>
          </div>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    this.container.querySelectorAll('.action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const secretId = e.target.dataset.secretId;
        this.handleAction(action, secretId);
      });
    });
  }
  
  /**
   * Update the statistics cards
   */
  updateStats() {
    const totalSecrets = this.filteredSecrets.length;
    const highSeverity = this.filteredSecrets.filter(s => s.confidence >= 0.8).length;
    const mediumSeverity = this.filteredSecrets.filter(s => s.confidence >= 0.5 && s.confidence < 0.8).length;
    const fixedSecrets = this.filteredSecrets.filter(s => s.status === 'fixed').length;
    
    const setText = (sel, val) => {
      const el = this.container.querySelector(sel);
      if (el) el.textContent = val;
    };
    setText('#total-secrets', totalSecrets);
    setText('#high-severity', highSeverity);
    setText('#medium-severity', mediumSeverity);
    setText('#fixed-secrets', fixedSecrets);
  }
  
  /**
   * Handle action button clicks
   */
  handleAction(action, secretId) {
    const secret = this.secrets.find(s => s.id === secretId);
    if (!secret) return;
    
    switch (action) {
      case 'view':
        this.showSecretDetails(secret);
        break;
        
      case 'ignore':
        this.updateSecretStatus(secretId, 'ignored');
        break;
        
      case 'fix':
        this.updateSecretStatus(secretId, 'fixed');
        break;
    }
  }
  
  /**
   * Show detailed view of a secret
   */
  showSecretDetails(secret) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Secret Details</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">Secret Value:</span>
            <div class="secret-value">${this.maskSecret(secret.content)}</div>
            <button class="btn-copy" data-secret="${secret.content}">Copy</button>
            <button class="btn-reveal">Reveal</button>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Type:</span>
            <span>${this.formatType(secret.type)}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Confidence:</span>
            <span>${Math.round(secret.confidence * 100)}%</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">File:</span>
            <span>${secret.filePath}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Line:</span>
            <span>${secret.lineNumber}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">First Detected:</span>
            <span>${this.formatDate(secret.detectedAt)}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <select class="status-select" data-secret-id="${secret.id}">
              <option value="new" ${secret.status === 'new' ? 'selected' : ''}>New</option>
              <option value="ignored" ${secret.status === 'ignored' ? 'selected' : ''}>Ignored</option>
              <option value="fixed" ${secret.status === 'fixed' ? 'selected' : ''}>Fixed</option>
            </select>
          </div>
          
          <div class="detail-row full-width">
            <span class="detail-label">Context:</span>
            <pre class="code-context">${this.highlightSecretInContext(secret.context, secret.content)}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline close-modal">Close</button>
          <button class="btn btn-primary" id="go-to-file" data-file="${secret.filePath}" data-line="${secret.lineNumber}">
            Go to File
          </button>
        </div>
      </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 1rem;
      }
      
      .modal-content {
        background-color: #2d3748;
        border-radius: 0.5rem;
        width: 100%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #4a5568;
      }
      
      .modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #f7fafc;
      }
      
      .close-modal {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #a0aec0;
        padding: 0.25rem;
        line-height: 1;
      }
      
      .modal-body {
        padding: 1.5rem;
      }
      
      .detail-row {
        display: flex;
        margin-bottom: 1rem;
        align-items: flex-start;
      }
      
      .detail-row.full-width {
        flex-direction: column;
      }
      
      .detail-label {
        font-weight: 600;
        color: #a0aec0;
        min-width: 120px;
        flex-shrink: 0;
      }
      
      .secret-value {
        font-family: 'Fira Code', monospace;
        background-color: #1a202c;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        margin-right: 0.5rem;
        flex-grow: 1;
        word-break: break-all;
      }
      
      .btn-copy, .btn-reveal {
        background: none;
        border: 1px solid #4a5568;
        color: #e2e8f0;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        margin-left: 0.5rem;
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s;
      }
      
      .btn-copy:hover, .btn-reveal:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .code-context {
        background-color: #1a202c;
        padding: 1rem;
        border-radius: 0.25rem;
        margin-top: 0.5rem;
        font-family: 'Fira Code', monospace;
        white-space: pre-wrap;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .code-context .highlight {
        background-color: rgba(239, 68, 68, 0.2);
        padding: 0.1rem 0.2rem;
        border-radius: 0.2rem;
      }
      
      .status-select {
        background-color: #2d3748;
        border: 1px solid #4a5568;
        color: #e2e8f0;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
      }
      
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 1rem 1.5rem;
        border-top: 1px solid #4a5568;
        gap: 0.75rem;
      }
    `;
    
    // Add modal to the document
    document.body.appendChild(modal);
    document.head.appendChild(style);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    });
    
    // Close modal when clicking outside content
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(style);
      }
    });
    
    // Copy secret to clipboard
    const copyBtn = modal.querySelector('.btn-copy');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(secret.content)
        .then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy secret:', err);
          alert('Failed to copy secret to clipboard');
        });
    });
    
    // Toggle secret visibility
    const revealBtn = modal.querySelector('.btn-reveal');
    const secretValue = modal.querySelector('.secret-value');
    let isRevealed = false;
    
    revealBtn.addEventListener('click', () => {
      isRevealed = !isRevealed;
      if (isRevealed) {
        secretValue.textContent = secret.content;
        revealBtn.textContent = 'Hide';
      } else {
        secretValue.textContent = this.maskSecret(secret.content);
        revealBtn.textContent = 'Reveal';
      }
    });
    
    // Update status
    const statusSelect = modal.querySelector('.status-select');
    statusSelect.addEventListener('change', (e) => {
      this.updateSecretStatus(secret.id, e.target.value);
    });
    
    // Go to file
    const goToFileBtn = modal.querySelector('#go-to-file');
    goToFileBtn.addEventListener('click', () => {
      this.navigateToFile(secret.filePath, secret.lineNumber);
      document.body.removeChild(modal);
      document.head.removeChild(style);
    });
  }
  
  /**
   * Perform bulk action on selected secrets
   */
  performBulkAction(action, secretIds) {
    switch (action) {
      case 'ignore':
        secretIds.forEach(id => this.updateSecretStatus(id, 'ignored'));
        break;
        
      case 'fix':
        secretIds.forEach(id => this.updateSecretStatus(id, 'fixed'));
        break;
        
      case 'delete':
        if (window.confirmDialog) {
          window.confirmDialog('Delete Secrets', `Are you sure you want to delete ${secretIds.length} selected secrets?`, { variant: 'danger', confirmText: 'Delete' })
            .then(ok => { if (ok) this.deleteSecrets(secretIds); });
        } else {
          if (confirm(`Are you sure you want to delete ${secretIds.length} selected secrets?`)) {
            this.deleteSecrets(secretIds);
          }
        }
        break;
        
      case 'export':
        this.exportToCSV(secretIds);
        break;
    }
  }
  
  /**
   * Update the status of a secret
   */
  updateSecretStatus(secretId, status) {
    const secret = this.secrets.find(s => s.id === secretId);
    if (!secret) return;
    
    // Update the secret status
    secret.status = status;
    secret.updatedAt = new Date().toISOString();
    
    // Save to storage
    this.saveSecrets();
    
    // Update the UI
    this.applyFilters();
    
    // Show success message
    this.showToast(`Secret marked as ${status}`, 'success');
  }
  
  /**
   * Delete secrets
   */
  deleteSecrets(secretIds) {
    this.secrets = this.secrets.filter(secret => !secretIds.includes(secret.id));
    this.saveSecrets();
    this.applyFilters();
    this.showToast(`${secretIds.length} secrets deleted`, 'success');
  }
  
  /**
   * Export secrets to CSV
   */
  exportToCSV(secretIds) {
    const selectedSecrets = this.secrets.filter(secret => secretIds.includes(secret.id));
    
    // Create CSV header
    let csvContent = 'Type,Secret,Confidence,Status,File,Line,Detected At\n';
    
    // Add rows
    selectedSecrets.forEach(secret => {
      const row = [
        `"${this.formatType(secret.type)}"`,
        `"${secret.content.replace(/"/g, '""')}"`,
        `${Math.round(secret.confidence * 100)}%`,
        `"${secret.status || 'new'}"`,
        `"${secret.filePath}"`,
        secret.lineNumber,
        `"${this.formatDate(secret.detectedAt)}"`
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `secrets-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Save secrets to storage
   */
  saveSecrets() {
    try {
      localStorage.setItem('codeshield_secrets', JSON.stringify(this.secrets));
    } catch (error) {
      console.error('Failed to save secrets to storage:', error);
    }
  }
  
  /**
   * Load secrets from storage
   */
  loadSecrets() {
    try {
      const savedSecrets = localStorage.getItem('codeshield_secrets');
      if (savedSecrets) {
        this.secrets = JSON.parse(savedSecrets);
        this.filteredSecrets = [...this.secrets];
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to load secrets from storage:', error);
    }
  }
  
  /**
   * Add a new secret to the dashboard
   */
  addSecret(secret) {
    // Check if secret already exists
    const exists = this.secrets.some(s => 
      s.content === secret.content && 
      s.filePath === secret.filePath && 
      s.lineNumber === secret.lineNumber
    );
    
    if (!exists) {
      secret.id = crypto.randomUUID();
      secret.detectedAt = new Date().toISOString();
      secret.status = 'new';
      
      this.secrets.unshift(secret);
      this.saveSecrets();
      this.applyFilters();
      
      // Show notification for high confidence secrets
      if (secret.confidence >= 0.8) {
        this.showToast(`New high confidence secret detected in ${secret.filePath.split('/').pop()}`, 'warning');
      }
    }
  }
  
  /**
   * Navigate to a specific file and line in the editor
   */
  navigateToFile(filePath, lineNumber) {
    // This would be implemented to work with your editor
    console.log(`Navigating to ${filePath}:${lineNumber}`);
    // Example: window.editor.openFile(filePath, lineNumber);
  }
  
  /**
   * Show a toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Add styles if not already present
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.375rem;
          color: white;
          font-weight: 500;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }
        
        .toast-info {
          background-color: #4299e1;
        }
        
        .toast-success {
          background-color: #48bb78;
        }
        
        .toast-warning {
          background-color: #ecc94b;
          color: #1a202c;
        }
        
        .toast-error {
          background-color: #f56565;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Remove toast after delay
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }
  
  /**
   * Helper function to truncate text with ellipsis
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  
  /**
   * Format secret type for display
   */
  formatType(type) {
    if (!type) return 'Unknown';
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Mask sensitive parts of a secret
   */
  maskSecret(secret) {
    if (!secret) return '';
    if (secret.length <= 8) return '*'.repeat(secret.length);
    
    const firstFour = secret.substring(0, 4);
    const lastFour = secret.substring(secret.length - 4);
    return `${firstFour}${'*'.repeat(secret.length - 8)}${lastFour}`;
  }
  
  /**
   * Highlight secret in context
   */
  highlightSecretInContext(context, secret) {
    if (!context) return 'No context available';
    
    // Simple highlighting - replace the secret with a highlighted version
    return context.replace(
      new RegExp(this.escapeRegExp(secret), 'g'), 
      match => `<span class="highlight">${match}</span>`
    );
  }
  
  /**
   * Escape special regex characters
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Initialize the dashboard
   */
  init() {
    this.loadSecrets();
    // Bind events after UI is created (container-scoped)
    this.setupEventListeners();
    return this.container;
  }
}

// Export the dashboard class
window.SecretsDashboard = SecretsDashboard;
