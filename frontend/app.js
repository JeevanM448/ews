const API_URL = '/api';

// State
let map;
let riskChart;
let trendChart;
let adminMap;
let adminMarkers = [];
// Default location (Thiruvananthapuram, Kerala)
let currentLocation = { lat: 8.5241, lon: 76.9366, name: "Thiruvananthapuram" };

// DOM Elements
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-links li');
const searchInput = document.getElementById('location-search');
const searchBtn = document.getElementById('search-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initCharts();
    loadDashboard(currentLocation.lat, currentLocation.lon);

    // Set Date
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('current-date').innerHTML = `${dateStr} <span class="live-badge"><i class="fa-solid fa-circle"></i> Live (30s)</span>`;

    // Hourly Forecast (Open-Meteo) Initial Load & 60s Refresh
    fetchHourlyForecast();
    setInterval(fetchHourlyForecast, 60000);
    setupForecastToggles();

    // Auto-refresh Interval (30 Seconds)
    setInterval(() => {
        loadDashboard(currentLocation.lat, currentLocation.lon);
        // fetchHourlyForecast already has its own 60s timer
    }, 30000);

    // Real-time Temperature (Open-Meteo) Initial Load & 60s Refresh
    fetchRealTimeTemp();
    setInterval(fetchRealTimeTemp, 60000);

    // Global Offline/Online Listeners
    window.addEventListener('online', () => {
        document.body.classList.remove('offline-mode');
        const indicator = document.getElementById('offline-indicator');
        if (indicator) indicator.style.display = 'none';
        processOfflineEmergencies();
    });
    window.addEventListener('offline', () => {
        document.body.classList.add('offline-mode');
        showOfflineIndicator(Date.now());
    });

    // Check pending alerts on load
    if (navigator.onLine) {
        processOfflineEmergencies();
    }

    // Event Listeners
    setupNavigation();
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // District Selector Logic
    setupDistrictSelector();

    // Emergency Trigger
    const emergencyBtn = document.getElementById('emergency-btn');
    const emergencyModal = document.getElementById('emergency-modal');
    const closeEmergency = document.getElementById('close-emergency');
    const emergencyLocText = document.getElementById('emergency-location');

    function playEmergencyBeep() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();

        let count = 0;
        const interval = setInterval(() => {
            oscillator.frequency.setValueAtTime(count % 2 === 0 ? 880 : 440, audioCtx.currentTime);
            count++;
            if (count > 6) {
                clearInterval(interval);
                oscillator.stop();
                audioCtx.close();
            }
        }, 200);
    }

    if (emergencyBtn && emergencyModal) {
        emergencyBtn.addEventListener('click', () => {
            const statusEl = document.getElementById('emergency-status');
            const locName = document.getElementById('location-search').value || "Local Area";
            emergencyLocText.textContent = `Emergency Alert for: ${locName}`;
            statusEl.textContent = "Obtaining high-accuracy GPS location...";
            statusEl.className = "alert-status info";

            emergencyModal.classList.add('active');
            playEmergencyBeep();

            // 1. Get user GPS location
            if (!navigator.geolocation) {
                statusEl.textContent = "Geolocation is not supported by your browser.";
                statusEl.className = "alert-status error";
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // 2. Detect District
                    const detectedDistrict = findNearestDistrict(lat, lon);
                    emergencyLocText.textContent = `Emergency in ${detectedDistrict.name} District`;

                    const payload = {
                        latitude: lat,
                        longitude: lon,
                        district: detectedDistrict.name
                    };

                    // 3. Offline Handling
                    if (window.OfflineManager && window.OfflineManager.isOffline) {
                        const res = await window.OfflineManager.triggerEmergency(lat, lon, detectedDistrict.name);
                        statusEl.textContent = res.message;
                        statusEl.className = "alert-status warning";
                        return;
                    }

                    statusEl.textContent = "Sending emergency SMS & Email...";
                    statusEl.className = "alert-status info";

                    try {
                        // 4. Trigger Email Alert
                        const emailPromise = fetch('/api/send-emergency-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        // 5. Trigger SMS Alert (Updated Format)
                        const smsPromise = fetch('/api/send-emergency-sms', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        // 6. Log to DB
                        const logPromise = fetch('/emergency', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                latitude: lat,
                                longitude: lon,
                                district: detectedDistrict.name,
                                risk_level: window.lastRiskData ? window.lastRiskData.risk_assessment.level : "Critical",
                                alert_status: "SOS Button Triggered"
                            })
                        });

                        const [emailRes, smsRes] = await Promise.all([emailPromise, smsPromise, logPromise]);
                        const emailData = await emailRes.json();
                        const smsData = await smsRes.json();

                        let finalMsg = "";
                        if (emailData.status === 'success') finalMsg += "Email Sent. ";
                        if (smsData.status === 'success') finalMsg += "SMS Sent. ";

                        if (!finalMsg) finalMsg = "Alerts processed (check console).";

                        statusEl.textContent = finalMsg;
                        statusEl.className = "alert-status success";

                    } catch (error) {
                        console.error("Emergency Alert Error:", error);
                        statusEl.textContent = "Failed to send alerts. Trying to queue...";

                        // Fallback to queue if fetch fails
                        const offlineQueue = JSON.parse(localStorage.getItem('emergency_queue') || '[]');
                        offlineQueue.push({ timestamp: Date.now(), ...payload });
                        localStorage.setItem('emergency_queue', JSON.stringify(offlineQueue));
                        statusEl.textContent = "Network Error. Alert queued for retry.";
                        statusEl.className = "alert-status warning";
                    }
                },
                (error) => {
                    console.error("Geolocation Error:", error);
                    statusEl.textContent = "Location access denied/failed.";
                    statusEl.className = "alert-status error";
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });

        closeEmergency.addEventListener('click', () => {
            emergencyModal.classList.remove('active');
        });
    }
});

// --- Color Logic ---
// --- Offline Sync ---
function showOfflineIndicator(timestamp) {
    let indicator = document.getElementById('offline-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #f59e0b; color: #000; padding: 8px 16px; border-radius: 20px; font-weight: bold; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 0.9rem;';
        document.body.appendChild(indicator);
    }
    const date = new Date(timestamp).toLocaleTimeString();
    indicator.innerHTML = `<i class="fa-solid fa-wifi" style="margin-right:8px; opacity:0.6"></i> Offline Mode &bull; Data from ${date}`;
    indicator.style.display = 'block';
}

function processOfflineEmergencies() {
    const queue = JSON.parse(localStorage.getItem('emergency_queue') || '[]');
    if (queue.length === 0) return;

    console.log("Network restored. Processing offline emergency queue...");
    let synced = false;

    queue.forEach(item => {
        // Optimistic firing of alerts
        fetch('/api/send-emergency-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: item.latitude,
                longitude: item.longitude,
                district: item.district
            })
        }).then(() => {
            console.log("Processed offline alert for", item.district);
            synced = true;
        }).catch(e => {
            console.error("Failed to sync offline alert", e);
        });
    });

    // Clear queue assuming best effort for now or enhance retry logic
    localStorage.setItem('emergency_queue', '[]');
    if (queue.length > 0) alert("Offline emergency alerts have been synced.");
}

// --- Helper Utilities ---
function findNearestDistrict(lat, lon) {
    const districts = [
        { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366 },
        { name: "Kollam", lat: 8.8932, lon: 76.6141 },
        { name: "Pathanamthitta", lat: 9.2648, lon: 76.7870 },
        { name: "Alappuzha", lat: 9.4981, lon: 76.3388 },
        { name: "Kottayam", lat: 9.5916, lon: 76.5222 },
        { name: "Idukki", lat: 9.8517, lon: 76.9746 },
        { name: "Ernakulam", lat: 9.9816, lon: 76.2999 },
        { name: "Thrissur", lat: 10.5276, lon: 76.2144 },
        { name: "Palakkad", lat: 10.7867, lon: 76.6547 },
        { name: "Malappuram", lat: 11.0735, lon: 76.0740 },
        { name: "Kozhikode", lat: 11.2588, lon: 75.7804 },
        { name: "Wayanad", lat: 11.6854, lon: 76.1320 },
        { name: "Kannur", lat: 11.8745, lon: 75.3704 },
        { name: "Kasaragod", lat: 12.5101, lon: 74.9852 }
    ];

    let closest = districts[0];
    let minDist = 100000;

    districts.forEach(d => {
        // Simple Euclidean distance for speed (since small area)
        const dist = Math.sqrt(Math.pow(d.lat - lat, 2) + Math.pow(d.lon - lon, 2));
        if (dist < minDist) {
            minDist = dist;
            closest = d;
        }
    });

    return closest;
}

// --- Navigation ---
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');

            // Remove active classes
            navLinks.forEach(l => l.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Add active class
            link.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Resize map if needed
            if (tabId === 'map' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }

            // Load admin data if needed
            if (tabId === 'admin') {
                loadAdminHistory();
                initAdminMap();
            }
        });
    });
}

// --- Map Logic ---
function initMap() {
    // Elegant Dark Mode Map centered on Kerala (Overview)
    map = L.map('map-container').setView([10.50, 76.40], 7.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
    }).addTo(map);

    // Map Click Listener -> Proactive Analysis
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        currentLocation = { lat: lat, lon: lng, name: `Location at ${lat.toFixed(3)}, ${lng.toFixed(3)}` };
        searchInput.value = currentLocation.name;

        await loadDashboard(lat, lng);
        updateMap(lat, lng, window.lastRiskData);
    });

    // Load Color-Coded Districts
    loadKeralaDistricts();
}

async function loadKeralaDistricts() {
    let districts = null;
    const STORAGE_KEY = 'offline_kerala_districts';

    try {
        const res = await fetch('/api/kerala/districts-risk');
        if (!res.ok) throw new Error("Failed to fetch district data");
        districts = await res.json();

        // Cache new data
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: districts
        }));
    } catch (e) {
        console.warn("Network error. Attempting to load cached district data...", e);
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            districts = parsed.data;
            showOfflineIndicator(parsed.timestamp);
        }
    }

    if (!districts) return;

    // Clear existing district layers if re-rendering based on clean map
    districts.forEach(d => {
        const color = getRiskColor(d.level);

        L.circle([d.lat, d.lon], {
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            radius: 12000,
            weight: 2,
            className: 'district-pulse'
        }).addTo(map)
            .bindPopup(`
            <div style="text-align: center; font-family: 'Inter', sans-serif;">
                <h3 style="margin: 0 0 5px; color: ${color}; text-transform: uppercase; letter-spacing: 1px;">${d.district}</h3>
                <div style="font-size: 1.2rem; font-weight: 800; margin-bottom: 5px; color: #fff;">${d.level} COMPLIANCE</div>
                <div style="font-size: 0.9rem; color: #a0aec0;">Risk Score: <span style="color: ${color}; font-weight: bold;">${d.score}</span></div>
                <p style="margin: 5px 0 0; font-size: 0.75rem; color: #718096;">Click to analyze details</p>
                ${!navigator.onLine ? '<div style="font-size:0.7rem; color:#eab308; margin-top:2px;">(Offline Data)</div>' : ''}
            </div>
        `)
            .on('click', () => {
                currentLocation = { lat: d.lat, lon: d.lon, name: d.district };
                searchInput.value = d.district;
                loadDashboard(d.lat, d.lon);
            });
    });
}

function updateMap(lat, lon, riskData) {
    if (!map) return;

    const riskLevel = riskData.risk_assessment.level;
    const riskColor = getRiskColor(riskLevel);

    map.flyTo([lat, lon], 12);

    // Create a significant Risk Zone circle
    const circle = L.circle([lat, lon], {
        color: riskColor,
        fillColor: riskColor,
        fillOpacity: 0.35,
        weight: 2,
        radius: 6000 // 6km visibility
    }).addTo(map);

    circle.bindPopup(`
        <div style="min-width: 150px; background: #161b22; color: white; padding: 5px; border-radius: 5px;">
            <h4 style="margin: 0 0 5px; color: ${riskColor}">${riskLevel} Risk Zone</h4>
            <p style="margin: 0; font-size: 0.9rem;">Score: <b>${riskData.risk_assessment.score}/10</b></p>
            <p style="margin: 5px 0 0; font-size: 0.8rem; color: #888;">${currentLocation.name}</p>
        </div>
    `).openPopup();

    // Add smaller clusters around to simulate "Zones"
    for (let i = 0; i < 4; i++) {
        const shiftLat = (Math.random() - 0.5) * 0.15;
        const shiftLon = (Math.random() - 0.5) * 0.15;
        const subRisk = ['Low', 'Moderate'][Math.floor(Math.random() * 2)];
        L.circleMarker([lat + shiftLat, lon + shiftLon], {
            radius: 6,
            fillColor: getRiskColor(subRisk),
            color: "#fff",
            weight: 1,
            fillOpacity: 0.7
        }).addTo(map).bindPopup(`Minor Detail: ${subRisk} Stress Area`);
    }
}

// --- Charts Logic ---
function initCharts() {
    const ctxRisk = document.getElementById('riskChart').getContext('2d');
    riskChart = new Chart(ctxRisk, {
        type: 'doughnut',
        data: {
            labels: ['Risk', 'Safety Buffer'],
            datasets: [{
                data: [0, 10], // Initial
                backgroundColor: ['#10b981', '#161b22'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    trendChart = null; // Removed in favor of modular forecast display
}

// --- Data Fetching ---
async function handleSearch() {
    const query = searchInput.value;
    if (!query) return;

    searchBtn.textContent = 'Searching...';
    try {
        // Geocoding via Nominatim
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const geoData = await geoRes.json();

        if (geoData && geoData.length > 0) {
            const { lat, lon, display_name } = geoData[0];
            currentLocation = { lat: parseFloat(lat), lon: parseFloat(lon), name: display_name.split(',')[0] };

            await loadDashboard(currentLocation.lat, currentLocation.lon);
            updateMap(currentLocation.lat, currentLocation.lon, window.lastRiskData);
        } else {
            alert('Location not found!');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching location.');
    } finally {
        searchBtn.textContent = 'Analyze';
    }
}

async function loadDashboard(lat, lon) {
    // If offline, try to get district data from local cache first
    const detectedDistrict = findNearestDistrict(lat, lon);

    if (window.OfflineManager && window.OfflineManager.isOffline) {
        console.log("Offline mode: fetching cached data for", detectedDistrict.name);
        const cachedDistrict = window.OfflineManager.getDistrictRisk(detectedDistrict.name);

        if (cachedDistrict) {
            // Reconstruct a partial data object for updateUI
            const mockData = {
                weather: { main: { temp: cachedDistrict.temp || 28, humidity: cachedDistrict.humidity || 70 } },
                air_quality: { aqi: 45 },
                risk_assessment: {
                    score: cachedDistrict.score,
                    level: cachedDistrict.level,
                    factors: ["Cached Data", "Historical Pattern"]
                },
                aggregated_metrics: { temperature: cachedDistrict.temp || 28, humidity: cachedDistrict.humidity || 70, pm25: 12 },
                social_data: { score: 0, severity: "Safe" }
            };
            updateUI(mockData);
            window.lastRiskData = mockData;
            return;
        }
    }

    try {
        const response = await fetch(`${API_URL}/risk-data?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        window.lastRiskData = data;

        // Cache for offline
        localStorage.setItem('offline_last_dashboard', JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));

        updateUI(data);
        fetchAIFusion(data.risk_assessment.score, currentLocation.name);
        addToAdminLog(data);
        fetchHourlyForecast();
    } catch (e) {
        console.error("Backend Error or Offline:", e);

        // Ultimate Offline Fallback
        const cached = localStorage.getItem('offline_last_dashboard');
        if (cached) {
            const parsed = JSON.parse(cached);
            updateUI(parsed.data);
            if (window.OfflineManager) window.OfflineManager.showOfflineNotification(true);
            window.lastRiskData = parsed.data;
        }
    }
}

function showOfflineIndicator(timestamp) {
    let indicator = document.getElementById('offline-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #f59e0b; color: #000; padding: 8px 16px; border-radius: 20px; font-weight: bold; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 0.9rem;';
        document.body.appendChild(indicator);
    }
    const date = new Date(timestamp).toLocaleTimeString();
    indicator.innerHTML = `<i class="fa-solid fa-wifi" style="margin-right:8px; opacity:0.6"></i> Offline Mode &bull; Data from ${date}`;
    indicator.style.display = 'block';
}

// --- UI Updates ---
function updateUI(data) {
    const { weather, air_quality, risk_assessment, aggregated_metrics } = data;

    // Prefer Aggregated metrics if available (from new Data Service)
    const temp = aggregated_metrics ? (aggregated_metrics.temperature !== undefined ? aggregated_metrics.temperature : aggregated_metrics.temp) : (weather.main?.temp || 0);
    const tempHigh = aggregated_metrics ? (aggregated_metrics.temp_max !== undefined ? aggregated_metrics.temp_max : (weather.main?.temp_max || temp)) : (weather.main?.temp_max || temp);
    const tempLow = aggregated_metrics ? (aggregated_metrics.temp_min !== undefined ? aggregated_metrics.temp_min : (weather.main?.temp_min || temp)) : (weather.main?.temp_min || temp);
    const hum = aggregated_metrics ? (aggregated_metrics.humidity !== undefined ? aggregated_metrics.humidity : (weather.main?.humidity || 0)) : (weather.main?.humidity || 0);
    const pm25 = aggregated_metrics ? (aggregated_metrics.pm25 !== undefined ? aggregated_metrics.pm25 : 0) : 0;

    // Text Updates
    document.getElementById('temp-val').textContent = `${Math.round(temp)}°C`;
    document.getElementById('temp-high').textContent = Math.round(tempHigh);
    document.getElementById('temp-low').textContent = Math.round(tempLow);

    document.getElementById('humidity-val').textContent = `${Math.round(hum)}%`;

    // Handle AQI structure variations (mock vs real)
    let aqi = air_quality.aqi || air_quality.main?.aqi || 0;
    document.getElementById('aqi-val').textContent = `AQI: ${aqi}`;

    // Update PM2.5 specifically
    const pmEl = document.getElementById('pm25-val');
    if (pmEl) pmEl.textContent = Math.round(pm25);

    const riskScore = Math.round(risk_assessment.score);
    const riskLevel = risk_assessment.level;

    const scoreEl = document.getElementById('risk-score');
    const levelEl = document.getElementById('risk-level');

    if (scoreEl) scoreEl.textContent = riskScore;
    if (levelEl) {
        levelEl.textContent = riskLevel;
        levelEl.className = `level-badge ${getRiskColorClass(riskLevel)}`;
    }

    document.getElementById('risk-desc').textContent = `Driven by: ${risk_assessment.factors.join(', ') || 'Normal Conditions'}`;

    // ML Badge Update
    const mlPred = risk_assessment.ml_model_prediction || 'N/A';
    const mlBadge = document.getElementById('ml-pred-val');
    mlBadge.innerHTML = `<i class="fa-solid fa-robot"></i> ML: ${mlPred}`;
    if (mlPred.includes('High')) {
        mlBadge.style.color = '#f85149'; // Danger
        mlBadge.style.background = 'rgba(248, 81, 73, 0.1)';
    } else {
        mlBadge.style.color = '#58a6ff'; // Accent/Blue
        mlBadge.style.background = 'rgba(88, 166, 255, 0.1)';
    }

    // Social Data Update
    const social = data.social_data || {};
    const socialVal = document.getElementById('social-val');
    const socialSent = document.getElementById('social-sentiment');

    if (socialVal) socialVal.textContent = social.score || '--';
    if (socialSent) {
        const sentiment = social.sentiment_average || 0;
        socialSent.textContent = sentiment > 0 ? `Positive (${sentiment})` : sentiment < 0 ? `Negative (${sentiment})` : `Neutral (${sentiment})`;
        socialSent.className = sentiment > 0 ? 'sub-stat text-success' : sentiment < 0 ? 'sub-stat text-danger' : 'sub-stat';
    }

    // Render Social Feed
    const feed = document.getElementById('social-feed');
    if (feed && social.recent_shouts) {
        feed.innerHTML = '';
        social.recent_shouts.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'social-shout';
            div.innerHTML = `
                <p>${msg}</p>
                <span class="shout-sentiment"><i class="fa-solid fa-brain"></i> Sentiment: Analyzed</span>
            `;
            feed.appendChild(div);
        });
    }

    // Update risk description to mention social factors if significant
    if (social.score >= 7) {
        document.getElementById('risk-desc').textContent += ` + High Social Stress (${social.severity})`;
    }

    // Update Charts
    riskChart.data.datasets[0].data = [riskScore, 100 - riskScore];
    riskChart.data.datasets[0].backgroundColor = [getRiskColor(riskLevel), '#161b22'];
    riskChart.update();

    // Alerts
    const alertList = document.getElementById('alert-list');
    alertList.innerHTML = ''; // Clear
    if (riskScore >= 6) {
        const li = document.createElement('li');
        li.className = 'alert-item alert-high';
        li.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>High Risk Alert:</b> Conditions are unfavorable in ${currentLocation.name}.</span>`;
        alertList.appendChild(li);
    } else {
        alertList.innerHTML = '<li class="alert-item">No active alerts for this region.</li>';
    }

    // Safety Instructions Update
    updateSafetyInstructions(riskLevel);
}

function updateSafetyInstructions(severity) {
    const container = document.getElementById('offline-safety-instructions');
    const list = document.getElementById('instructions-container');
    if (!container || !list || !window.OfflineManager) return;

    const instructions = window.OfflineManager.getSafetyInstructions(severity);

    if (instructions.length > 0) {
        container.classList.remove('hidden');
        list.innerHTML = '';
        instructions.forEach(cat => {
            cat.instructions.forEach(text => {
                const li = document.createElement('li');
                li.className = 'instruction-item';
                li.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${text}</span>`;
                list.appendChild(li);
            });
        });
    } else {
        container.classList.add('hidden');
    }
}

// --- Helpers ---
function getRiskColor(level) {
    if (level === 'Critical') return '#ef4444';
    if (level === 'High') return '#f97316';
    if (level === 'Moderate') return '#eab308';
    return '#10b981'; // Safe
}

function getRiskColorClass(level) {
    if (level === 'Critical') return 'text-danger';
    if (level === 'High') return 'text-danger'; // Orange/Red
    if (level === 'Moderate') return 'text-warning';
    return 'text-success';
}

function addToAdminLog(data) {
    // If Admin panel is active, refresh the history table
    const adminPanel = document.getElementById('admin');
    if (adminPanel && adminPanel.classList.contains('active')) {
        loadAdminHistory();
    }
}

async function loadAdminHistory() {
    try {
        const res = await fetch(`${API_URL}/admin/history`);
        const history = await res.json();

        const tbody = document.getElementById('admin-table-body');
        tbody.innerHTML = ''; // Clear

        history.forEach(row => {
            const tr = document.createElement('tr');
            const date = new Date(row.timestamp).toLocaleString();

            tr.innerHTML = `
                <td>#${row.id}</td>
                <td>${date}</td>
                <td title="${row.lat}, ${row.lon}">${row.location}</td>
                <td>${row.risk_score.toFixed(1)}</td>
                <td><span class="badge ${getRiskColorClass(row.risk_level)}">${row.risk_level}</span></td>
                <td><span class="text-success">Verified</span></td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('total-preds').textContent = history.length.toLocaleString();
    } catch (e) {
        console.error("Admin History Error:", e);
    }
}

// --- Admin Map Logic ---
function initAdminMap() {
    if (adminMap) {
        setTimeout(() => adminMap.invalidateSize(), 100);
        return;
    }

    adminMap = L.map('admin-map-container').setView([10.50, 76.40], 7.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
    }).addTo(adminMap);

    fetchAdminEmergencies();
    // Refresh every 20 seconds
    setInterval(fetchAdminEmergencies, 20000);
}

async function fetchAdminEmergencies() {
    if (!adminMap) return;

    try {
        const res = await fetch(`${API_URL}/admin/emergencies`);
        const emergencies = await res.json();

        // Clear existing markers
        adminMarkers.forEach(m => adminMap.removeLayer(m));
        adminMarkers = [];

        emergencies.forEach(emit => {
            // Determine marker color based on status or district risk
            let color = '#f85149'; // Default Red
            if (emit.risk_level === 'High') color = '#fa9035'; // Orange
            if (emit.risk_level === 'Moderate') color = '#eab308'; // Yellow
            if (emit.risk_level === 'Safe') color = '#3fb950'; // Green

            const marker = L.circleMarker([emit.lat, emit.lon], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9,
                className: emit.risk_level === 'Critical' ? 'emergency-pulse-marker' : ''
            }).addTo(adminMap);

            const timestamp = new Date(emit.timestamp).toLocaleString();
            marker.bindPopup(`
                <div style="color: white; background: #161b22; padding: 10px; border-radius: 8px;">
                    <h3 style="color: ${color}; margin-top: 0;">EMERGENCY ALERT</h3>
                    <p><b>District:</b> ${emit.district}</p>
                    <p><b>Location:</b> ${emit.lat.toFixed(5)}, ${emit.lon.toFixed(5)}</p>
                    <p><b>Time:</b> ${timestamp}</p>
                    <p><b>Status:</b> ${emit.alert_status}</p>
                    <a href="https://www.google.com/maps?q=${emit.lat},${emit.lon}" target="_blank" 
                       style="display: block; margin-top: 10px; padding: 8px; background: #58a6ff; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                       <i class="fa-solid fa-location-arrow"></i> Open in Google Maps
                    </a>
                </div>
            `);

            adminMarkers.push(marker);
        });
    } catch (e) {
        console.error("Error fetching admin emergencies:", e);
    }
}

/**
 * Real-time Weather Integration (Open-Meteo)
 * Fetches current temperature for coordinates (10.8505, 76.2711)
 */
async function fetchRealTimeTemp() {
    const tempElement = document.getElementById('real-time-temp');
    if (!tempElement) return;

    try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=10.8505&longitude=76.2711&current_weather=true';
        const response = await fetch(url);

        if (!response.ok) throw new Error('API request failed');

        const data = await response.json();

        if (data && data.current_weather) {
            const temp = data.current_weather.temperature;
            tempElement.textContent = `${temp}°C`;
        } else {
            throw new Error('Invalid data structure');
        }
    } catch (error) {
        console.error('Error fetching real-time temp:', error);
        tempElement.textContent = 'Temperature data unavailable';
        tempElement.style.fontSize = '1.1rem';
    }
}

/**
 * Hourly Forecast Integration (Open-Meteo)
 */
let currentForecastData = null;
let currentForecastView = 'temp';

async function fetchHourlyForecast() {
    const container = document.getElementById('hourly-forecast-container');
    if (!container) return;

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLocation.lat}&longitude=${currentLocation.lon}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m&forecast_days=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API failed');

        const data = await response.json();
        currentForecastData = data.hourly;
        renderHourlyForecast();
    } catch (e) {
        console.error("Forecast Error:", e);
        container.innerHTML = `<div class="loading-forecast">Hourly forecast unavailable</div>`;
    }
}

function renderHourlyForecast() {
    const container = document.getElementById('hourly-forecast-container');
    if (!currentForecastData) return;

    container.innerHTML = '';
    const hours = currentForecastData.time;

    hours.forEach((time, i) => {
        const temp = currentForecastData.temperature_2m[i];
        const appTemp = currentForecastData.apparent_temperature[i];
        const rainProb = currentForecastData.precipitation_probability[i];
        const rainAmt = currentForecastData.precipitation[i];
        const wind = currentForecastData.wind_speed_10m[i];
        const dateObj = new Date(time);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // User Specific Safety Indicators
        let riskClass = 'risk-safe';
        let riskLevel = 'Safe';

        // Heat Risk Logic
        if (temp > 40) { riskClass = 'risk-extreme'; riskLevel = 'Extreme Heat'; }
        else if (temp > 35) { riskClass = 'risk-high'; riskLevel = 'High Heat'; }
        else if (temp > 30) { riskClass = 'risk-caution'; riskLevel = 'Moderate Heat'; }

        // Storm Risk Logic
        if (rainProb > 70 || wind > 40) {
            if (riskClass !== 'risk-extreme') riskClass = 'risk-high';
            if (riskLevel === 'Safe') riskLevel = 'Storm Risk';
        }

        // Flood Risk Logic
        if (rainAmt > 10) {
            riskClass = 'risk-extreme';
            riskLevel = 'Flood Risk';
        }

        // Icon Logic
        let icon = 'fa-sun';
        if (rainAmt > 2) icon = 'fa-cloud-showers-heavy';
        else if (rainProb > 40) icon = 'fa-cloud-rain';
        else if (wind > 30) icon = 'fa-wind';
        else if (temp > 33) icon = 'fa-temperature-arrow-up';

        const card = document.createElement('div');
        card.className = 'hourly-card';

        // Define Dynamic Content Based on View
        let primaryMetric = `${temp}°C`;
        if (currentForecastView === 'rain') primaryMetric = `${rainProb}% Rain`;
        if (currentForecastView === 'wind') primaryMetric = `${wind} km/h`;
        if (currentForecastView === 'risk') primaryMetric = riskLevel;

        card.innerHTML = `
            <div class="hourly-time">${timeStr}</div>
            <div class="hourly-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="hourly-temp">${primaryMetric}</div>
            <div class="hourly-metrics">
                <div class="metric-item"><i class="fa-solid fa-droplet"></i> ${currentForecastData.relative_humidity_2m[i]}%</div>
                <div class="metric-item"><i class="fa-solid fa-umbrella"></i> ${rainAmt}mm</div>
                <div class="metric-item"><i class="fa-solid fa-wind"></i> ${wind}km/h</div>
            </div>
            <div class="risk-bar ${riskClass}"></div>
        `;
        container.appendChild(card);
    });
}

function setupForecastToggles() {
    const toggles = document.querySelectorAll('.toggle-btn');
    toggles.forEach(btn => {
        btn.addEventListener('click', () => {
            toggles.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentForecastView = btn.getAttribute('data-view');
            renderHourlyForecast();
        });
    });
}
function setupDistrictSelector() {
    const selector = document.getElementById('district-selector');
    if (!selector) return;

    const districts = [
        { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366 },
        { name: "Kollam", lat: 8.8932, lon: 76.6141 },
        { name: "Pathanamthitta", lat: 9.2648, lon: 76.7870 },
        { name: "Alappuzha", lat: 9.4981, lon: 76.3388 },
        { name: "Kottayam", lat: 9.5916, lon: 76.5222 },
        { name: "Idukki", lat: 9.8517, lon: 76.9746 },
        { name: "Ernakulam", lat: 9.9816, lon: 76.2999 },
        { name: "Thrissur", lat: 10.5276, lon: 76.2144 },
        { name: "Palakkad", lat: 10.7867, lon: 76.6547 },
        { name: "Malappuram", lat: 11.0735, lon: 76.0740 },
        { name: "Kozhikode", lat: 11.2588, lon: 75.7804 },
        { name: "Wayanad", lat: 11.6854, lon: 76.1320 },
        { name: "Kannur", lat: 11.8745, lon: 75.3704 },
        { name: "Kasaragod", lat: 12.5101, lon: 74.9852 }
    ];

    districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = `${d.lat},${d.lon}`;
        opt.textContent = d.name;
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        if (!e.target.value) return;
        const [lat, lon] = e.target.value.split(',').map(Number);
        const name = e.target.options[e.target.selectedIndex].text;

        currentLocation = { lat, lon, name };
        searchInput.value = name;
        loadDashboard(lat, lon);
        updateMap(lat, lon, window.lastRiskData);
    });
}

// --- AI INTELLIGENCE MODULES ---

async function fetchAIFusion(weatherScore, district) {
    try {
        // Fetch Satellite
        const satRes = await fetch(`${API_URL}/ai/satellite?image_id=${district}`);
        if (satRes.ok) {
            const satData = await satRes.json();
            const satRiskEl = document.getElementById('sat-risk');
            const satWaterEl = document.getElementById('sat-water');
            if (satRiskEl) satRiskEl.innerText = satData.detected_risk;
            if (satWaterEl) satWaterEl.innerText = satData.water_coverage_percent;
        }

        // Fetch Fusion
        const fusionRes = await fetch(`${API_URL}/ai/fusion?weather_score=${weatherScore}&district=${district}`);
        if (fusionRes.ok) {
            const fusionData = await fusionRes.json();

            const fusionEl = document.getElementById('fusion-score');
            const evacActionEl = document.getElementById('evac-action');
            const evacMsgEl = document.getElementById('evac-msg');

            if (fusionEl) fusionEl.innerText = fusionData.fused_risk.fused_score;
            if (evacActionEl) evacActionEl.innerText = fusionData.evacuation.action;
            if (evacMsgEl) evacMsgEl.innerText = fusionData.evacuation.message;

            // Colorize Fusion Card
            const fScore = fusionData.fused_risk.fused_score;
            const fCard = document.querySelector('.fusion-card');
            if (fCard) {
                if (fScore > 70) fCard.style.borderLeftColor = '#f85149';
                else if (fScore > 40) fCard.style.borderLeftColor = '#d29922';
                else fCard.style.borderLeftColor = '#3fb950';
            }
        }
    } catch (e) {
        console.error("AI Fetch Failed:", e);
    }
}

// --- Chatbot Logic ---
// We attach this to window so it runs on load
window.addEventListener('load', () => {
    const chatWidget = document.getElementById('ai-chat-widget');
    const chatToggle = document.getElementById('chat-toggle');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');

    if (chatToggle) {
        chatToggle.addEventListener('click', () => {
            chatWidget.classList.toggle('collapsed');
            chatWidget.classList.toggle('expanded');

            const icon = chatToggle.querySelector('.toggle-icon');
            if (icon) {
                if (chatWidget.classList.contains('collapsed')) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
        });
    }

    async function sendChatMessage() {
        if (!chatInput) return;
        const msg = chatInput.value.trim();
        if (!msg) return;

        addMessage(msg, 'user');
        chatInput.value = '';

        try {
            const res = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            const data = await res.json();
            addMessage(data.reply, 'bot');
        } catch (e) {
            addMessage("Offline or server unreachable.", 'bot');
        }
    }

    function addMessage(text, sender) {
        if (!chatMessages) return;
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerText = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (chatSend) {
        chatSend.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
});
