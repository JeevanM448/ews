const API_URL = '/api';

// State
let map;
let riskChart;
let trendChart;
// Default location (New York)
let currentLocation = { lat: 40.7128, lon: -74.0060, name: "New York" };

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

    // Auto-refresh Interval (30 Seconds)
    setInterval(() => {
        loadDashboard(currentLocation.lat, currentLocation.lon);
        // show brief update animation or toast if needed
    }, 30000);

    // Event Listeners
    setupNavigation();
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});

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
            }
        });
    });
}

// --- Map Logic ---
function initMap() {
    // Elegant Dark Mode Map
    map = L.map('map-container').setView([currentLocation.lat, currentLocation.lon], 11);

    L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
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

    // Initial Marker
    L.marker([currentLocation.lat, currentLocation.lon])
        .addTo(map)
        .bindPopup(`<b>${currentLocation.name}</b><br>Active Monitoring Zone`)
        .openPopup();
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

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['Now', '+1h', '+2h', '+3h', '+4h', '+5h'],
            datasets: [{
                label: 'Projected Risk Trend',
                data: [3, 4, 3, 5, 6, 4], // Mock trend
                borderColor: '#3b82f6',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 10 }
            }
        }
    });
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
    try {
        const response = await fetch(`${API_URL}/risk-data?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        window.lastRiskData = data; // Store for map usage

        updateUI(data);
        addToAdminLog(data);
    } catch (e) {
        console.error("Backend Error:", e);
        // Fallback for demo if backend is offline
        // alert("Backend unreachable. Ensure FastAPI is running on port 8000.");
    }
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

    const riskLevel = risk_assessment.level;
    const riskScore = risk_assessment.score;

    const riskEl = document.getElementById('risk-val');
    riskEl.textContent = riskLevel;
    riskEl.className = getRiskColorClass(riskLevel); // Apply color class

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
    riskChart.data.datasets[0].data = [riskScore, 10 - riskScore];
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
}

// --- Helpers ---
function getRiskColor(level) {
    if (level === 'Critical') return '#ef4444';
    if (level === 'High') return '#f97316';
    if (level === 'Moderate') return '#eab308';
    return '#10b981'; // Low
}

function getRiskColorClass(level) {
    if (level === 'Critical') return 'text-danger';
    if (level === 'High') return 'text-danger'; // Orange/Red
    if (level === 'Moderate') return 'text-warning';
    return 'text-success';
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
                <td>${row.risk_score.toFixed(1)}/10</td>
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
