/**
 * Kerala Disaster Early Warning Module
 * Monitors disaster risks specifically for Kerala's 14 districts.
 * Focused on Flood, Landslide, and Heatwave alerts.
 */

const KERALA_DISTRICTS = [
    { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, hilly: false },
    { name: "Kollam", lat: 8.8932, lon: 76.6141, hilly: false },
    { name: "Pathanamthitta", lat: 9.2648, lon: 76.7870, hilly: true },
    { name: "Alappuzha", lat: 9.4981, lon: 76.3388, hilly: false },
    { name: "Kottayam", lat: 9.5916, lon: 76.5222, hilly: false },
    { name: "Idukki", lat: 9.8517, lon: 76.9746, hilly: true },
    { name: "Ernakulam", lat: 9.9816, lon: 76.2999, hilly: false },
    { name: "Thrissur", lat: 10.5276, lon: 76.2144, hilly: false },
    { name: "Palakkad", lat: 10.7867, lon: 76.6547, hilly: false },
    { name: "Malappuram", lat: 11.0735, lon: 76.0740, hilly: true },
    { name: "Kozhikode", lat: 11.2588, lon: 75.7804, hilly: false },
    { name: "Wayanad", lat: 11.6854, lon: 76.1320, hilly: true },
    { name: "Kannur", lat: 11.8745, lon: 75.3704, hilly: false },
    { name: "Kasaragod", lat: 12.5101, lon: 74.9852, hilly: false }
];

document.addEventListener('DOMContentLoaded', () => {
    fetchKeralaAlerts();
    setInterval(fetchKeralaAlerts, 5 * 60 * 1000);
});

async function fetchKeralaAlerts() {
    const list = document.getElementById('alert-list');
    if (!list) return;

    if (list.innerHTML === '' || list.innerHTML.includes('No active')) {
        list.innerHTML = `<div class="loading-alerts"><i class="fa-solid fa-circle-notch fa-spin"></i> ${t('monitoring')}</div>`;
    }

    // 1. Define Mandatory Demo Alerts (as requested)
    const demoAlerts = [
        {
            type_key: "Flood Warning",
            level: "Critical",
            location: "Idukki",
            desc_key: "idukki_flood_desc",
            icon: "fa-house-flood-water",
            time: "10 mins ago"
        },
        {
            type_key: "Landslide Risk",
            level: "High",
            location: "Wayanad",
            desc_key: "wayanad_landslide_desc",
            icon: "fa-mountain",
            time: "25 mins ago"
        },
        {
            type_key: "Heatwave Alert",
            level: "Moderate",
            location: "Palakkad",
            desc_key: "palakkad_heat_desc",
            icon: "fa-temperature-high",
            time: "1 hour ago"
        }
    ];

    try {
        let liveAlerts = [];
        // Fetch real data for other districts to keep it dynamic
        // optimized to only fetch a few to save bandwidth for this demo
        const districtsToFetch = KERALA_DISTRICTS.filter(d => !["Idukki", "Wayanad", "Palakkad"].includes(d.name)).slice(0, 3);

        const fetchPromises = districtsToFetch.map(async (district) => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${district.lat}&longitude=${district.lon}&current=temperature_2m,precipitation&forecast_days=1`;
                const res = await fetch(url);
                const data = await res.json();
                return processDistrictData(district, data);
            } catch (e) {
                return [];
            }
        });

        const results = await Promise.all(fetchPromises);
        results.forEach(res => liveAlerts = liveAlerts.concat(res));

        // Combine Demo + Real
        const allAlerts = [...demoAlerts, ...liveAlerts];
        renderAlerts(allAlerts);

    } catch (e) {
        console.error("Alerts Process Error:", e);
        renderAlerts(demoAlerts); // Fallback to demo alerts
    }
}

function processDistrictData(district, data) {
    const alerts = [];
    const current = data.current;
    if (!current) return [];

    const temp = current.temperature_2m;
    const rain = current.precipitation;

    if (rain > 5) {
        alerts.push({
            type: "Heavy Rain Alert",
            level: "Moderate",
            location: district.name,
            desc: `Continuous rainfall (${rain}mm) observed. Drive carefully.`,
            icon: "fa-cloud-showers-heavy",
            time: "Just now"
        });
    }

    if (temp > 35) {
        alerts.push({
            type: "High Temperature",
            level: "Moderate",
            location: district.name,
            desc: `recorded temp ${temp}°C.`,
            icon: "fa-sun",
            time: "Just now"
        });
    }

    return alerts;
}

function renderAlerts(alerts) {
    const list = document.getElementById('alert-list');
    if (!list) return;

    list.innerHTML = '';

    if (alerts.length === 0) {
        list.innerHTML = `<div class="no-alerts-msg">${t('No active alerts at this moment.')}</div>`;
        return;
    }

    alerts.forEach(alert => {
        const li = document.createElement('li');
        // Map Severity to CSS Class
        let severityClass = 'alert-safe'; // default
        if (alert.level === 'Critical') severityClass = 'alert-critical';
        if (alert.level === 'High') severityClass = 'alert-high';
        if (alert.level === 'Moderate') severityClass = 'alert-moderate';

        li.className = `alert-card ${severityClass}`;

        // Translation Logic
        const translatedType = alert.type_key ? t(alert.type_key) : (t(alert.type) || alert.type);
        const translatedDesc = alert.desc_key ? t(alert.desc_key) : alert.desc;

        const sevMap = {
            'Critical': t('critical'),
            'High': t('high'),
            'Moderate': t('moderate'),
            'Safe': t('safe')
        };
        const activeSev = sevMap[alert.level] || alert.level;

        li.innerHTML = `
            <div class="alert-icon">
                <i class="fa-solid ${alert.icon}"></i>
            </div>
            <div class="alert-details">
                <div class="alert-top">
                    <span class="alert-location">${alert.location}</span>
                    <span class="alert-time">${alert.time}</span>
                </div>
                <div class="alert-type">${translatedType}</div>
                <div class="alert-desc-text" style="font-size: 0.85rem; color: #a0aec0; margin-bottom: 4px;">${translatedDesc}</div>
                <div class="alert-severity badge-${alert.level.toLowerCase()} ignore-translate">${activeSev}</div>
            </div>
        `;

        list.appendChild(li);
    });
}
