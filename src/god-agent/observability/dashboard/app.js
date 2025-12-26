/**
 * God Agent Observability Dashboard
 * Vanilla JavaScript with SSE streaming
 */

class DashboardApp {
    constructor() {
        this.eventSource = null;
        this.reconnectTimeout = null;
        this.reconnectDelay = 5000;
        this.activities = [];
        this.agents = new Map();
        this.pipelines = new Map();
        this.routingDecisions = [];
        this.qualityChart = null;
        this.componentFilter = '';
        this.statusFilter = '';
        this.currentTab = 'interaction-store';
        this.domainSearchTerm = '';
        this.ucmMetrics = {};
        this.idescMetrics = {};
        this.episodeMetrics = {};
        this.hyperedgeMetrics = {};
        this.tokenMetrics = {};
        this.daemonMetrics = {};
        this.registryMetrics = { total: 264, categories: 30 };
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        this.setupEventListeners();
        this.initializeChart();
        await this.loadInitialData();
        this.connectSSE();
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Filters
        document.getElementById('componentFilter').addEventListener('change', (e) => {
            this.componentFilter = e.target.value;
            this.renderActivities();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.statusFilter = e.target.value;
            this.renderActivities();
        });

        // Tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Domain search
        document.getElementById('domainSearch').addEventListener('input', (e) => {
            this.domainSearchTerm = e.target.value.toLowerCase();
            this.renderInteractionStore();
        });
    }

    /**
     * Initialize Chart.js quality chart
     */
    initializeChart() {
        const ctx = document.getElementById('qualityChart').getContext('2d');
        this.qualityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Quality Score',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            color: '#a0a0a0'
                        },
                        grid: {
                            color: '#2a2a3e'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#a0a0a0'
                        },
                        grid: {
                            color: '#2a2a3e'
                        }
                    }
                }
            }
        });
    }

    /**
     * Load initial data from API endpoints
     */
    async loadInitialData() {
        try {
            // Load events
            const eventsRes = await fetch('/api/events?limit=50');
            if (eventsRes.ok) {
                const data = await eventsRes.json();
                const events = data.events || data || [];
                this.activities = events.map(e => this.mapEventToActivity(e));
                this.renderActivities();
            }

            // Load agents
            const agentsRes = await fetch('/api/agents');
            if (agentsRes.ok) {
                const data = await agentsRes.json();
                const agents = data.agents || data || [];
                agents.forEach(agent => {
                    this.agents.set(agent.agentId, agent);
                });
                this.renderAgents();
            }

            // Load pipelines
            const pipelinesRes = await fetch('/api/pipelines');
            if (pipelinesRes.ok) {
                const data = await pipelinesRes.json();
                const pipelines = data.pipelines || data || [];
                pipelines.forEach(pipeline => {
                    this.pipelines.set(pipeline.pipelineId, pipeline);
                });
                this.renderPipelines();
            }

            // Load learning stats
            const statsRes = await fetch('/api/learning/stats');
            if (statsRes.ok) {
                const stats = await statsRes.json();
                this.updateLearningMetrics(stats);
            }

            // Load comprehensive system metrics
            const metricsRes = await fetch('/api/system/metrics');
            if (metricsRes.ok) {
                const metrics = await metricsRes.json();
                // Apply metrics directly
                if (metrics.ucm) this.ucmMetrics = metrics.ucm;
                if (metrics.idesc) this.idescMetrics = metrics.idesc;
                if (metrics.episode) this.episodeMetrics = metrics.episode;
                if (metrics.hyperedge) this.hyperedgeMetrics = metrics.hyperedge;
                if (metrics.token) this.tokenMetrics = metrics.token;
                if (metrics.daemon) this.daemonMetrics = metrics.daemon;
                if (metrics.registry) this.registryMetrics = metrics.registry;
                this.updateAllPanels();
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    /**
     * Connect to SSE stream
     */
    connectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.updateConnectionStatus('connecting');

        try {
            this.eventSource = new EventSource('/api/stream');

            this.eventSource.onopen = () => {
                this.updateConnectionStatus('connected');
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };

            this.eventSource.onerror = () => {
                this.updateConnectionStatus('disconnected');
                this.eventSource.close();
                this.scheduleReconnect();
            };

            // Event handlers
            this.eventSource.addEventListener('agent_started', (e) => this.handleAgentStarted(e));
            this.eventSource.addEventListener('agent_completed', (e) => this.handleAgentCompleted(e));
            this.eventSource.addEventListener('pipeline_started', (e) => this.handlePipelineStarted(e));
            this.eventSource.addEventListener('pipeline_completed', (e) => this.handlePipelineCompleted(e));
            this.eventSource.addEventListener('routing_decision', (e) => this.handleRoutingDecision(e));
            this.eventSource.addEventListener('activity', (e) => this.handleActivity(e));
            this.eventSource.addEventListener('learning_update', (e) => this.handleLearningUpdate(e));
            this.eventSource.addEventListener('ucm_update', (e) => this.handleUcmUpdate(e));
            this.eventSource.addEventListener('idesc_update', (e) => this.handleIdescUpdate(e));
            this.eventSource.addEventListener('episode_update', (e) => this.handleEpisodeUpdate(e));
            this.eventSource.addEventListener('hyperedge_update', (e) => this.handleHyperedgeUpdate(e));
            this.eventSource.addEventListener('token_update', (e) => this.handleTokenUpdate(e));
            this.eventSource.addEventListener('daemon_update', (e) => this.handleDaemonUpdate(e));
            this.eventSource.addEventListener('metrics_update', (e) => this.handleMetricsUpdate(e));

        } catch (error) {
            console.error('SSE connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            return;
        }

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connectSSE();
        }, this.reconnectDelay);
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status) {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');

        dot.className = `status-dot ${status}`;

        switch (status) {
            case 'connected':
                text.textContent = 'Connected';
                break;
            case 'connecting':
                text.textContent = 'Connecting...';
                break;
            case 'disconnected':
                text.textContent = 'Disconnected';
                break;
        }
    }

    /**
     * SSE Event Handlers
     */
    handleAgentStarted(event) {
        const data = JSON.parse(event.data);
        this.agents.set(data.agentId, {
            agentId: data.agentId,
            type: data.type,
            startTime: data.startTime,
            status: 'running'
        });
        this.renderAgents();
        this.addActivity('agent', 'running', `Agent ${data.type} started`, data);
    }

    handleAgentCompleted(event) {
        const data = JSON.parse(event.data);
        const agent = this.agents.get(data.agentId);
        if (agent) {
            agent.status = data.success ? 'success' : 'error';
            agent.endTime = data.endTime;
            agent.duration = data.duration;
            // Remove from active agents after a delay
            setTimeout(() => {
                this.agents.delete(data.agentId);
                this.renderAgents();
            }, 3000);
        }
        this.renderAgents();
        this.addActivity('agent', data.success ? 'success' : 'error',
            `Agent ${agent?.type || data.agentId} ${data.success ? 'completed' : 'failed'}`, data);
    }

    handlePipelineStarted(event) {
        const data = JSON.parse(event.data);
        this.pipelines.set(data.pipelineId, {
            pipelineId: data.pipelineId,
            type: data.type,
            totalSteps: data.totalSteps || 0,
            completedSteps: 0,
            status: 'running',
            startTime: data.startTime
        });
        this.renderPipelines();
        this.addActivity('pipeline', 'running', `Pipeline ${data.type} started`, data);
    }

    handlePipelineCompleted(event) {
        const data = JSON.parse(event.data);
        const pipeline = this.pipelines.get(data.pipelineId);
        if (pipeline) {
            pipeline.status = data.success ? 'success' : 'error';
            pipeline.completedSteps = pipeline.totalSteps;
            pipeline.endTime = data.endTime;
            // Remove from active pipelines after a delay
            setTimeout(() => {
                this.pipelines.delete(data.pipelineId);
                this.renderPipelines();
            }, 3000);
        }
        this.renderPipelines();
        this.addActivity('pipeline', data.success ? 'success' : 'error',
            `Pipeline ${pipeline?.type || data.pipelineId} ${data.success ? 'completed' : 'failed'}`, data);
    }

    handleRoutingDecision(event) {
        const data = JSON.parse(event.data);
        this.routingDecisions.unshift(data);
        if (this.routingDecisions.length > 20) {
            this.routingDecisions.pop();
        }
        this.renderRoutingDecisions();
        this.addActivity('routing', 'info', `Routed to ${data.selectedAgent}`, data);
    }

    handleActivity(event) {
        const data = JSON.parse(event.data);
        this.addActivity(data.component || 'system', data.status || 'info', data.message, data);
    }

    handleLearningUpdate(event) {
        const data = JSON.parse(event.data);
        this.updateLearningMetrics(data);
    }

    /**
     * Handle UCM updates
     */
    handleUcmUpdate(event) {
        const data = JSON.parse(event.data);
        this.ucmMetrics = { ...this.ucmMetrics, ...data };
        this.updateUcmPanel();
    }

    /**
     * Handle IDESC updates
     */
    handleIdescUpdate(event) {
        const data = JSON.parse(event.data);
        this.idescMetrics = { ...this.idescMetrics, ...data };
        this.updateIdescPanel();
    }

    /**
     * Handle Episode updates
     */
    handleEpisodeUpdate(event) {
        const data = JSON.parse(event.data);
        this.episodeMetrics = { ...this.episodeMetrics, ...data };
        this.updateEpisodePanel();
    }

    /**
     * Handle Hyperedge updates
     */
    handleHyperedgeUpdate(event) {
        const data = JSON.parse(event.data);
        this.hyperedgeMetrics = { ...this.hyperedgeMetrics, ...data };
        this.updateHyperedgePanel();
    }

    /**
     * Handle Token Budget updates
     */
    handleTokenUpdate(event) {
        const data = JSON.parse(event.data);
        this.tokenMetrics = { ...this.tokenMetrics, ...data };
        this.updateTokenPanel();
    }

    /**
     * Handle Daemon updates
     */
    handleDaemonUpdate(event) {
        const data = JSON.parse(event.data);
        this.daemonMetrics = { ...this.daemonMetrics, ...data };
        this.updateDaemonPanel();
    }

    /**
     * Handle comprehensive metrics updates
     */
    handleMetricsUpdate(event) {
        const data = JSON.parse(event.data);
        if (data.ucm) this.ucmMetrics = data.ucm;
        if (data.idesc) this.idescMetrics = data.idesc;
        if (data.episode) this.episodeMetrics = data.episode;
        if (data.hyperedge) this.hyperedgeMetrics = data.hyperedge;
        if (data.token) this.tokenMetrics = data.token;
        if (data.daemon) this.daemonMetrics = data.daemon;
        if (data.registry) this.registryMetrics = data.registry;
        this.updateAllPanels();
    }

    /**
     * Update UCM & IDESC panel
     */
    updateUcmPanel() {
        document.getElementById('ucmEpisodesStored').textContent = 
            (this.ucmMetrics.episodesStored || 0).toLocaleString();
        document.getElementById('ucmContextSize').textContent = 
            (this.ucmMetrics.contextSize || 0).toLocaleString();
    }

    /**
     * Update IDESC panel
     */
    updateIdescPanel() {
        document.getElementById('idescOutcomes').textContent = 
            (this.idescMetrics.outcomesRecorded || 0).toLocaleString();
        document.getElementById('idescInjectionRate').textContent = 
            ((this.idescMetrics.injectionRate || 0) * 100).toFixed(1) + '%';
        document.getElementById('idescNegativeWarnings').textContent = 
            (this.idescMetrics.negativeWarnings || 0).toString();
        document.getElementById('idescThresholdAdj').textContent = 
            (this.idescMetrics.thresholdAdjustments || 0).toString();
    }

    /**
     * Update Episode panel
     */
    updateEpisodePanel() {
        document.getElementById('episodesLinked').textContent = 
            (this.episodeMetrics.linked || 0).toLocaleString();
        document.getElementById('timeIndexSize').textContent = 
            (this.episodeMetrics.timeIndexSize || 0).toLocaleString();
    }

    /**
     * Update Hyperedge panel
     */
    updateHyperedgePanel() {
        document.getElementById('qaHyperedges').textContent = 
            (this.hyperedgeMetrics.qaCount || 0).toLocaleString();
        document.getElementById('causalChains').textContent = 
            (this.hyperedgeMetrics.causalChains || 0).toLocaleString();
        document.getElementById('loopsDetected').textContent = 
            (this.hyperedgeMetrics.loopsDetected || 0).toString();
        document.getElementById('communities').textContent = 
            (this.hyperedgeMetrics.communities || 0).toString();
    }

    /**
     * Update Token Budget panel
     */
    updateTokenPanel() {
        document.getElementById('tokenBudgetUsage').textContent = 
            ((this.tokenMetrics.usage || 0) * 100).toFixed(1) + '%';
        document.getElementById('tokenWarnings').textContent = 
            (this.tokenMetrics.warnings || 0).toString();
        document.getElementById('summarizations').textContent = 
            (this.tokenMetrics.summarizations || 0).toString();
        document.getElementById('rollingWindowSize').textContent = 
            (this.tokenMetrics.rollingWindowSize || 0).toLocaleString();
    }

    /**
     * Update Daemon Health panel
     */
    updateDaemonPanel() {
        const statusEl = document.getElementById('daemonStatus');
        const status = this.daemonMetrics.status || 'healthy';
        statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusEl.className = 'metric-value status-' + status;
        
        document.getElementById('daemonUptime').textContent = 
            this.formatUptime(this.daemonMetrics.uptime || 0);
        document.getElementById('daemonEvents').textContent = 
            (this.daemonMetrics.eventsProcessed || 0).toLocaleString();
        document.getElementById('daemonMemory').textContent = 
            ((this.daemonMetrics.memoryUsage || 0) / 1024 / 1024).toFixed(1) + ' MB';
    }

    /**
     * Update Agent Registry panel
     */
    updateRegistryPanel() {
        document.getElementById('registryTotal').textContent = 
            (this.registryMetrics.total || 264).toString();
        document.getElementById('registryCategories').textContent = 
            (this.registryMetrics.categories || 30).toString();
        document.getElementById('registrySelections').textContent = 
            (this.registryMetrics.selectionsToday || 0).toLocaleString();
        document.getElementById('embeddingDim').textContent = 
            (this.registryMetrics.embeddingDimensions || 1536).toString();
    }

    /**
     * Update all panels
     */
    updateAllPanels() {
        this.updateUcmPanel();
        this.updateIdescPanel();
        this.updateEpisodePanel();
        this.updateHyperedgePanel();
        this.updateTokenPanel();
        this.updateDaemonPanel();
        this.updateRegistryPanel();
    }

    /**
     * Format uptime in human-readable form
     */
    formatUptime(seconds) {
        if (seconds < 60) return seconds + 's';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
        return Math.floor(seconds / 86400) + 'd';
    }

    /**
     * Add activity to the stream
     */
    addActivity(component, status, message, metadata) {
        const activity = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            component,
            status,
            message,
            metadata
        };

        this.activities.unshift(activity);
        if (this.activities.length > 100) {
            this.activities.pop();
        }

        this.renderActivities();
    }

    /**
     * Map API event to activity format
     */
    mapEventToActivity(event) {
        return {
            id: event.eventId || Date.now() + Math.random(),
            timestamp: event.timestamp,
            component: event.eventType?.split('_')[0] || 'system',
            status: event.metadata?.status || 'info',
            message: this.formatEventMessage(event),
            metadata: event.metadata
        };
    }

    /**
     * Format event message for display
     */
    formatEventMessage(event) {
        const type = event.eventType;
        const meta = event.metadata || {};

        if (type?.includes('agent')) {
            return `Agent ${meta.type || meta.agentId} ${type.includes('started') ? 'started' : 'completed'}`;
        } else if (type?.includes('pipeline')) {
            return `Pipeline ${meta.type || meta.pipelineId} ${type.includes('started') ? 'started' : 'completed'}`;
        } else if (type?.includes('routing')) {
            return `Routed to ${meta.selectedAgent || 'unknown'}`;
        }

        return event.message || type || 'System event';
    }

    /**
     * Render activities with filters
     */
    renderActivities() {
        const list = document.getElementById('activityList');

        const filtered = this.activities.filter(activity => {
            if (this.componentFilter && activity.component !== this.componentFilter) {
                return false;
            }
            if (this.statusFilter && activity.status !== this.statusFilter) {
                return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            list.innerHTML = '<li class="activity-item"><div class="activity-info">No activities to display</div></li>';
            return;
        }

        list.innerHTML = filtered.map(activity => {
            const time = new Date(activity.timestamp).toLocaleTimeString();
            const message = this.escapeHtml(activity.message);

            return `
                <li class="activity-item">
                    <div class="activity-info">
                        <div class="activity-message">${message}</div>
                        <div class="activity-meta">${time} • ${activity.component}</div>
                    </div>
                    <span class="status-badge ${activity.status}">${activity.status}</span>
                </li>
            `;
        }).join('');
    }

    /**
     * Render active agents
     */
    renderAgents() {
        const list = document.getElementById('agentList');
        const count = document.getElementById('agentCount');

        const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'running');
        count.textContent = activeAgents.length.toString();

        if (activeAgents.length === 0) {
            list.innerHTML = '<li class="agent-item"><div class="agent-name">No active agents</div></li>';
            return;
        }

        list.innerHTML = activeAgents.map(agent => {
            const type = this.escapeHtml(agent.type || agent.agentId);
            const agentId = this.escapeHtml(agent.agentId);

            return `
                <li class="agent-item">
                    <div class="agent-name">${type}</div>
                    <div class="agent-type">${agentId}</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Render active pipelines with progress
     */
    renderPipelines() {
        const list = document.getElementById('pipelineList');
        const count = document.getElementById('pipelineCount');

        const activePipelines = Array.from(this.pipelines.values()).filter(p => p.status === 'running');
        count.textContent = activePipelines.length.toString();

        if (activePipelines.length === 0) {
            list.innerHTML = '<li class="pipeline-item"><div class="pipeline-name">No active pipelines</div></li>';
            return;
        }

        list.innerHTML = activePipelines.map(pipeline => {
            const progress = pipeline.totalSteps > 0
                ? (pipeline.completedSteps / pipeline.totalSteps * 100).toFixed(0)
                : 0;
            const type = this.escapeHtml(pipeline.type || pipeline.pipelineId);

            return `
                <li class="pipeline-item">
                    <div class="pipeline-name">${type}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="pipeline-stats">${pipeline.completedSteps} / ${pipeline.totalSteps} steps</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Render routing decisions
     */
    renderRoutingDecisions() {
        const list = document.getElementById('routingList');

        if (this.routingDecisions.length === 0) {
            list.innerHTML = '<li class="routing-item"><div class="routing-decision">No routing decisions yet</div></li>';
            return;
        }

        list.innerHTML = this.routingDecisions.slice(0, 10).map(decision => {
            const agent = this.escapeHtml(decision.selectedAgent || 'unknown');
            const reasoning = this.escapeHtml(decision.reasoning || 'No reasoning provided');
            const confidence = decision.confidence || 0;

            return `
                <li class="routing-item">
                    <div class="routing-decision">Selected: ${agent}</div>
                    <div class="routing-reasoning">${reasoning}</div>
                    <div class="routing-confidence">Confidence: ${(confidence * 100).toFixed(1)}%</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Update learning metrics and chart
     */
    updateLearningMetrics(stats) {
        // Update summary metrics
        document.getElementById('patternCount').textContent = (stats.patternCount || 0).toString();
        document.getElementById('avgQuality').textContent = (stats.avgQuality || 0).toFixed(2);

        // Update chart with quality history
        if (stats.qualityHistory && Array.isArray(stats.qualityHistory)) {
            const labels = stats.qualityHistory.map((_, i) => i.toString());
            const data = stats.qualityHistory.map(h => h.quality || 0);

            this.qualityChart.data.labels = labels;
            this.qualityChart.data.datasets[0].data = data;
            this.qualityChart.update();
        }
    }

    /**
     * Switch memory tabs
     */
    switchTab(tabId) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        this.currentTab = tabId;

        // Load tab data
        if (tabId === 'interaction-store') {
            this.loadInteractionStore();
        } else if (tabId === 'reasoning-bank') {
            this.loadReasoningBank();
        } else if (tabId === 'episode-store') {
            this.loadEpisodeStore();
        } else if (tabId === 'ucm-context') {
            this.loadUcmContext();
        } else if (tabId === 'hyperedge-store') {
            this.loadHyperedgeStore();
        }
    }

    /**
     * Load InteractionStore data
     */
    async loadInteractionStore() {
        try {
            const res = await fetch('/api/memory/interactions');
            if (res.ok) {
                const data = await res.json();
                this.interactionStoreData = data;
                this.renderInteractionStore();
            }
        } catch (error) {
            console.error('Error loading InteractionStore:', error);
        }
    }

    /**
     * Render InteractionStore entries
     */
    renderInteractionStore() {
        const list = document.getElementById('interactionList');

        if (!this.interactionStoreData || this.interactionStoreData.length === 0) {
            list.innerHTML = '<li class="memory-item">No entries in InteractionStore</li>';
            return;
        }

        const filtered = this.interactionStoreData.filter(entry => {
            if (!this.domainSearchTerm) return true;
            return entry.domain?.toLowerCase().includes(this.domainSearchTerm);
        });

        list.innerHTML = filtered.map(entry => {
            const domain = this.escapeHtml(entry.domain || 'unknown');
            const content = this.escapeHtml(entry.content?.substring(0, 200) || 'No content');
            const tags = entry.tags || [];
            const tagsHtml = tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('');

            return `
                <li class="memory-item">
                    <div class="memory-domain">${domain}</div>
                    <div class="memory-content">${content}</div>
                    <div class="memory-tags">${tagsHtml}</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Load ReasoningBank data
     */
    async loadReasoningBank() {
        try {
            const res = await fetch('/api/memory/reasoning');
            if (res.ok) {
                const data = await res.json();
                this.reasoningBankData = data;
                this.renderReasoningBank();
            }
        } catch (error) {
            console.error('Error loading ReasoningBank:', error);
        }
    }

    /**
     * Render ReasoningBank entries
     */
    renderReasoningBank() {
        const statsDiv = document.getElementById('reasoningStats');
        const list = document.getElementById('reasoningList');

        if (!this.reasoningBankData) {
            list.innerHTML = '<li class="memory-item">No data in ReasoningBank</li>';
            return;
        }

        // Render stats
        const stats = this.reasoningBankData.stats || {};
        statsDiv.innerHTML = `
            <div class="memory-stats">
                <div class="stat-card">
                    <div class="metric-label">Total Patterns</div>
                    <div class="metric-value">${stats.totalPatterns || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Avg Quality</div>
                    <div class="metric-value">${(stats.avgQuality || 0).toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Total Feedback</div>
                    <div class="metric-value">${stats.totalFeedback || 0}</div>
                </div>
            </div>
        `;

        // Render recent patterns
        const patterns = this.reasoningBankData.recentPatterns || [];
        if (patterns.length === 0) {
            list.innerHTML = '<li class="memory-item">No recent patterns</li>';
            return;
        }

        list.innerHTML = patterns.map(pattern => {
            const id = this.escapeHtml(pattern.id || 'unknown');
            const quality = (pattern.quality || 0).toFixed(2);

            return `
                <li class="memory-item">
                    <div class="memory-domain">Pattern: ${id}</div>
                    <div class="memory-content">Quality: ${quality}</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Load EpisodeStore data
     */
    async loadEpisodeStore() {
        try {
            const res = await fetch('/api/memory/episodes');
            if (res.ok) {
                const data = await res.json();
                this.episodeStoreData = data;
                this.renderEpisodeStore();
            }
        } catch (error) {
            console.error('Error loading EpisodeStore:', error);
        }
    }

    /**
     * Render EpisodeStore entries
     */
    renderEpisodeStore() {
        const statsDiv = document.getElementById('episodeStats');
        const list = document.getElementById('episodeList');

        if (!this.episodeStoreData) {
            list.innerHTML = '<li class="memory-item">No data in EpisodeStore</li>';
            return;
        }

        const stats = this.episodeStoreData.stats || {};
        statsDiv.innerHTML = `
            <div class="memory-stats">
                <div class="stat-card">
                    <div class="metric-label">Total Episodes</div>
                    <div class="metric-value">${stats.totalEpisodes || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Linked</div>
                    <div class="metric-value">${stats.linkedEpisodes || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Time Index Size</div>
                    <div class="metric-value">${stats.timeIndexSize || 0}</div>
                </div>
            </div>
        `;

        const episodes = this.episodeStoreData.recentEpisodes || [];
        if (episodes.length === 0) {
            list.innerHTML = '<li class="memory-item">No recent episodes</li>';
            return;
        }

        list.innerHTML = episodes.map(episode => {
            const id = this.escapeHtml(episode.id || 'unknown');
            const type = this.escapeHtml(episode.type || 'unknown');
            const timestamp = new Date(episode.timestamp).toLocaleString();

            return `
                <li class="memory-item">
                    <div class="memory-domain">Episode: ${id}</div>
                    <div class="memory-content">Type: ${type} | ${timestamp}</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Load UCM Context data
     */
    async loadUcmContext() {
        try {
            const res = await fetch('/api/memory/ucm');
            if (res.ok) {
                const data = await res.json();
                this.ucmContextData = data;
                this.renderUcmContext();
            }
        } catch (error) {
            console.error('Error loading UCM Context:', error);
        }
    }

    /**
     * Render UCM Context entries
     */
    renderUcmContext() {
        const statsDiv = document.getElementById('ucmStats');
        const list = document.getElementById('ucmContextList');

        if (!this.ucmContextData) {
            list.innerHTML = '<li class="memory-item">No data in UCM Context</li>';
            return;
        }

        const stats = this.ucmContextData.stats || {};
        statsDiv.innerHTML = `
            <div class="memory-stats">
                <div class="stat-card">
                    <div class="metric-label">Context Size</div>
                    <div class="metric-value">${stats.contextSize || 0} tokens</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Pinned Items</div>
                    <div class="metric-value">${stats.pinnedItems || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Rolling Window</div>
                    <div class="metric-value">${stats.rollingWindowSize || 0}</div>
                </div>
            </div>
        `;

        const entries = this.ucmContextData.contextEntries || [];
        if (entries.length === 0) {
            list.innerHTML = '<li class="memory-item">No context entries</li>';
            return;
        }

        list.innerHTML = entries.map(entry => {
            const tier = this.escapeHtml(entry.tier || 'unknown');
            const preview = this.escapeHtml((entry.content || '').substring(0, 200));

            return `
                <li class="memory-item">
                    <div class="memory-domain">Tier: ${tier}</div>
                    <div class="memory-content">${preview}...</div>
                </li>
            `;
        }).join('');
    }

    /**
     * Load Hyperedge Store data
     */
    async loadHyperedgeStore() {
        try {
            const res = await fetch('/api/memory/hyperedges');
            if (res.ok) {
                const data = await res.json();
                this.hyperedgeStoreData = data;
                this.renderHyperedgeStore();
            }
        } catch (error) {
            console.error('Error loading Hyperedge Store:', error);
        }
    }

    /**
     * Render Hyperedge Store entries
     */
    renderHyperedgeStore() {
        const statsDiv = document.getElementById('hyperedgeStats');
        const list = document.getElementById('hyperedgeList');

        if (!this.hyperedgeStoreData) {
            list.innerHTML = '<li class="memory-item">No data in Hyperedge Store</li>';
            return;
        }

        const stats = this.hyperedgeStoreData.stats || {};
        statsDiv.innerHTML = `
            <div class="memory-stats">
                <div class="stat-card">
                    <div class="metric-label">Q&A Pairs</div>
                    <div class="metric-value">${stats.qaPairs || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Causal Chains</div>
                    <div class="metric-value">${stats.causalChains || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="metric-label">Communities</div>
                    <div class="metric-value">${stats.communities || 0}</div>
                </div>
            </div>
        `;

        const hyperedges = this.hyperedgeStoreData.recentHyperedges || [];
        if (hyperedges.length === 0) {
            list.innerHTML = '<li class="memory-item">No recent hyperedges</li>';
            return;
        }

        list.innerHTML = hyperedges.map(edge => {
            const type = this.escapeHtml(edge.type || 'unknown');
            const id = this.escapeHtml(edge.id || 'unknown');
            const nodes = edge.nodeCount || 0;

            return `
                <li class="memory-item">
                    <div class="memory-domain">${type}: ${id}</div>
                    <div class="memory-content">Nodes: ${nodes}</div>
                </li>
            `;
        }).join('');
    }

    /**
     * XSS prevention: Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Expose DashboardApp globally for testing
if (typeof window !== 'undefined') {
    window.DashboardApp = DashboardApp;
}

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', () => {
    const app = new DashboardApp();
    app.init();
});
