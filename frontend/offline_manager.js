/**
 * Kerala SafeAI - Offline Disaster Manager
 * Handles connectivity, local storage, emergency queuing, and battery optimization.
 */

const OfflineManager = {
    isOffline: !navigator.onLine,
    emergencyContact: localStorage.getItem('emergency_contact_phone') || '+919999999999',

    init() {
        this.setupEventListeners();
        this.checkInitialConnection();
        this.initializeLocalStorage();
        this.startSyncTimer();
        console.log("Offline Manager Initialized");
    },

    setupEventListeners() {
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));
    },

    checkInitialConnection() {
        this.handleConnectionChange(navigator.onLine);
    },

    handleConnectionChange(isOnline) {
        this.isOffline = !isOnline;
        const body = document.body;
        const statusIndicator = document.getElementById('system-status-indicator');

        if (!isOnline) {
            body.classList.add('offline-disaster-mode');
            this.showOfflineNotification(true);
            if (statusIndicator) {
                statusIndicator.innerHTML = '<span class="dot offline"></span> Offline Disaster Mode';
                statusIndicator.style.background = 'rgba(248, 81, 73, 0.1)';
                statusIndicator.style.color = '#f85149';
            }
            this.enableLowPowerMode(true);
        } else {
            body.classList.remove('offline-disaster-mode');
            this.showOfflineNotification(false);
            if (statusIndicator) {
                statusIndicator.innerHTML = '<span class="dot online"></span> System Online';
                statusIndicator.style.background = 'rgba(46, 160, 67, 0.1)';
                statusIndicator.style.color = '#3fb950';
            }
            this.enableLowPowerMode(false);
            this.syncPendingAlerts();
            this.refreshLocalCache();
        }
    },

    showOfflineNotification(show) {
        let banner = document.getElementById('offline-disaster-banner');
        if (!banner && show) {
            banner = document.createElement('div');
            banner.id = 'offline-disaster-banner';
            banner.className = 'disaster-banner';
            banner.innerHTML = `
                <div class="banner-content">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>APP IN OFFLINE DISASTER MODE - NO INTERNET detected</span>
                </div>
            `;
            document.body.prepend(banner);
        }
        if (banner) banner.style.display = show ? 'flex' : 'none';
    },

    enableLowPowerMode(enable) {
        const body = document.body;
        if (enable) {
            body.classList.add('low-power');
            // Disable heavy animations globally via CSS class
            // Background interval tasks in app.js should check OfflineManager.isOffline
        } else {
            body.classList.remove('low-power');
        }
    },

    initializeLocalStorage() {
        if (!localStorage.getItem('emergency_queue')) {
            localStorage.setItem('emergency_queue', JSON.stringify([]));
        }
        if (!localStorage.getItem('offline_districts_risk')) {
            fetch('initial_districts_risk.json')
                .then(r => r.json())
                .then(data => localStorage.setItem('offline_districts_risk', JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                })))
                .catch(e => console.error("Could not load initial districts risk", e));
        }
        // Load initial safety instructions if not present
        if (!localStorage.getItem('safety_instructions')) {
            fetch('safety_instructions.json')
                .then(r => r.json())
                .then(data => localStorage.setItem('safety_instructions', JSON.stringify(data)))
                .catch(e => console.error("Could not load safety instructions", e));
        }
    },

    async refreshLocalCache() {
        if (this.isOffline) return;
        try {
            const res = await fetch('/api/kerala/districts-risk');
            if (res.ok) {
                const districts = await res.json();
                localStorage.setItem('offline_districts_risk', JSON.stringify({
                    timestamp: Date.now(),
                    data: districts
                }));
            }
        } catch (e) {
            console.warn("Failed to refresh local cache", e);
        }
    },

    getDistrictRisk(districtName) {
        const cached = localStorage.getItem('offline_districts_risk');
        if (!cached) return null;
        const districts = JSON.parse(cached).data;
        return districts.find(d => d.district === districtName || d.name === districtName);
    },

    getSafetyInstructions(severity, type = null) {
        const data = localStorage.getItem('safety_instructions');
        if (!data) return [];
        const instructions = JSON.parse(data);

        return instructions.filter(inst => {
            const severityMatch = inst.severity_trigger.includes(severity);
            const typeMatch = type ? inst.type === type : true;
            return severityMatch && typeMatch;
        });
    },

    /**
     * Prepare Emergency SMS
     */
    async triggerEmergency(lat, lon, districtName) {
        const message = `EMERGENCY ALERT\nPerson in danger in ${districtName}, Kerala.\nLocation: ${lat}, ${lon}\nSent from Kerala Disaster Alert App.`;

        console.log("Preparing SMS:", message);

        if (this.isOffline) {
            this.queueEmergency(lat, lon, districtName);
            // Attempt to trigger SMS via sms: protocol (user must still press 'send')
            window.location.href = `sms:${this.emergencyContact}?body=${encodeURIComponent(message)}`;
            return { status: 'queued', message: 'Offline! SMS prepared and alert queued.' };
        } else {
            // Online: handled by app.js (AJAX)
            return { status: 'online' };
        }
    },

    queueEmergency(lat, lon, districtName) {
        const queue = JSON.parse(localStorage.getItem('emergency_queue') || '[]');
        queue.push({
            latitude: lat,
            longitude: lon,
            district: districtName,
            timestamp: Date.now(),
            status: 'pending'
        });
        localStorage.setItem('emergency_queue', JSON.stringify(queue));
        console.log("Alert queued locally");
    },

    async syncPendingAlerts() {
        if (this.isOffline) return;
        const queue = JSON.parse(localStorage.getItem('emergency_queue') || '[]');
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} pending alerts...`);
        const remainingIdx = [];

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            try {
                const res = await fetch('/api/send-emergency-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (res.ok) {
                    console.log(`Alert for ${item.district} synced successfully.`);
                } else {
                    remainingIdx.push(item);
                }
            } catch (e) {
                remainingIdx.push(item);
            }
        }

        localStorage.setItem('emergency_queue', JSON.stringify(remainingIdx));
        if (remainingIdx.length === 0 && queue.length > 0) {
            this.notifySyncSuccess();
        }
    },

    notifySyncSuccess() {
        const toast = document.createElement('div');
        toast.className = 'sync-toast';
        toast.innerHTML = '<i class="fa-solid fa-check-circle"></i> Offline Emergency SMS synced with authorities.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    startSyncTimer() {
        // Periodic check for sync even if event missed
        setInterval(() => {
            if (!this.isOffline) this.syncPendingAlerts();
        }, 60000);
    }
};

OfflineManager.init();
window.OfflineManager = OfflineManager;
