const TRANSLATIONS = {
    en: {
        app_name: "Kerala SafeAI",
        dashboard_header: "Kerala SafeAI Dashboard",
        nav_dashboard: "Dashboard",
        nav_map: "Live Map",
        nav_admin: "Admin Panel",
        system_online: "System Online",
        search_placeholder: "Search Place in Kerala...",
        analyze: "Analyze",
        quick_select: "Quick Select District",
        risk_title: "Risk Assessment",
        monitoring: "Monitoring District Conditions...",
        temp_title: "Temperature",
        aqi_title: "Air Quality",
        humid_title: "Humidity",
        social_title: "Social Stress",
        current_temp_title: "Current Temperature",
        spot_check_title: "Spot Humidity Check",
        spot_check_placeholder: "Enter city name (e.g. London)...",
        risk_breakdown: "Risk Components Breakdown",
        hourly_forecast: "Hourly Forecast Trend",
        recent_alerts: "Recent Alerts",
        social_pulse: "Social Pulse",
        live_risk_map: "Live Risk Map",
        legend_low: "Low",
        legend_mod: "Moderate",
        legend_high: "High",
        legend_crit: "Critical",

        // Alert Types
        "Flood Warning": "Flood Warning",
        "Severe Flood Warning": "Severe Flood Warning",
        "Flood Alert": "Flood Alert",
        "Landslide Risk": "Landslide Risk",
        "Landslide Warning": "Landslide Warning",
        "Heatwave Alert": "Heatwave Alert",
        "Heat Warning": "Heat Warning",
        "Heavy Rain Alert": "Heavy Rain Alert",
        "High Temperature": "High Temperature",

        // Alert Descriptions (Static Mapping for Demo)
        "idukki_flood_desc": "Dam levels rising rapidly due to continuous heavy rainfall.",
        "wayanad_landslide_desc": "Soil saturation critical in Meppadi region. Evacuation advised.",
        "palakkad_heat_desc": "Temperatures exceeding 40°C. Stay hydrated and indoors.",

        "safe": "Safe",
        "moderate": "Moderate",
        "high": "High",
        "critical": "Critical"
    },
    ml: {
        app_name: "കേരള സേഫ് എഐ",
        dashboard_header: "കേരള സേഫ് എഐ ഡാഷ്ബോർഡ്",
        nav_dashboard: "ഡാഷ്ബോർഡ്",
        nav_map: "തത്സമയ മാപ്പ്",
        nav_admin: "അഡ്മിൻ പാനൽ",
        system_online: "സിസ്റ്റം ഓൺലൈൻ",
        search_placeholder: "സ്ഥലം തിരയുക...",
        analyze: "വിശകലനം",
        quick_select: "ജില്ല തിരഞ്ഞെടുക്കുക",
        risk_title: "റിസ്ക് വിലയിരുത്തൽ",
        monitoring: "ജില്ലാ സാഹചര്യം നിരീക്ഷിക്കുന്നു...",
        temp_title: "താപനില",
        aqi_title: "വായു ഗുണനിലവാരം",
        humid_title: "അന്തരീക്ഷ ഈർപ്പം",
        social_title: "സാമൂഹിക പ്രതികരണം",
        current_temp_title: "നിലവിലെ താപനില",
        spot_check_title: "ഹ്യുമിഡിറ്റി പരിശോധന",
        spot_check_placeholder: "നഗരത്തിന്റെ പേര് നൽകുക...",
        risk_breakdown: "റിസ്ക് ഘടകങ്ങൾ",
        hourly_forecast: "മണിക്കൂർ അടിസ്ഥാനത്തിലുള്ള പ്രവചനം",
        recent_alerts: "അടിയന്തര മുന്നറിയിപ്പുകൾ",
        social_pulse: "സോഷ്യൽ പൾസ്",
        live_risk_map: "തത്സമയ റിസ്ക് മാപ്പ്",
        legend_low: "കുറഞ്ഞ",
        legend_mod: "മിതമായ",
        legend_high: "ഉയർന്ന",
        legend_crit: "ഗുരുതരം",

        // Alert Types
        "Flood Warning": "വെള്ളപ്പൊക്ക മുന്നറിയിപ്പ്",
        "Severe Flood Warning": "രൂക്ഷമായ വെള്ളപ്പൊക്ക മുന്നറിയിപ്പ്",
        "Flood Alert": "വെള്ളപ്പൊക്ക ജാഗ്രത",
        "Landslide Risk": "ഉരുൾപൊട്ടൽ ഭീഷണി",
        "Landslide Warning": "ഉരുൾപൊട്ടൽ മുന്നറിയിപ്പ്",
        "Heatwave Alert": "ഉഷ്ണതരംഗ മുന്നറിയിപ്പ്",
        "Heat Warning": "ഉഷ്ണ ജാഗ്രത",
        "Heavy Rain Alert": "കനത്ത മഴ മുന്നറിയിപ്പ്",
        "High Temperature": "ഉയർന്ന താപനില",

        // Alert Descriptions
        "idukki_flood_desc": "തുടർച്ചയായ കനത്ത മഴ മൂലം ഡാം ജലനിരപ്പ് ഉയരുന്നു.",
        "wayanad_landslide_desc": "മേപ്പാടി മേഖലയിൽ മണ്ണിലെ ജലാംശം അപകടകരമായ നിലയിൽ. ഒഴിഞ്ഞുപോകാന് നിർദേശം.",
        "palakkad_heat_desc": "താപനില 40°C-ൽ കൂടുതൽ. ജലാംശം നിലനിർത്തുക, വീടിനുള്ളിൽ തുടരുക.",

        "safe": "സുരക്ഷിതം",
        "moderate": "മിതമായ",
        "high": "ഉയർന്ന",
        "critical": "ഗുരുതരം"
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem('app_language', lang);

    // Update active button state
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`lang-${lang}`).classList.add('active');

    updatePageContent();
}

function t(key) {
    return TRANSLATIONS[currentLang][key] || key;
}

function updatePageContent() {
    // Navbar
    updateText('[data-tab="dashboard"] span', 'nav_dashboard');
    updateText('[data-tab="map"] span', 'nav_map');
    updateText('[data-tab="admin"] span', 'nav_admin');

    // Header
    updatePlaceholder('#location-search', 'search_placeholder');
    updateText('#search-btn', 'analyze');
    // For Select option default
    const select = document.getElementById('district-selector');
    if (select && select.options.length > 0) select.options[0].text = t('quick_select');

    // Dashboard
    updateText('.dashboard-header h1', 'dashboard_header');
    updateText('.logo span', 'app_name');

    updateText('#risk-card h3', 'risk_title'); // Card header
    updateText('#risk-desc', 'monitoring'); // Default text

    // Other cards
    const cards = document.querySelectorAll('.stat-card');
    if (cards.length > 1) cards[1].querySelector('h3').innerText = t('temp_title');
    if (cards.length > 2) cards[2].querySelector('h3').innerText = t('aqi_title');
    if (cards.length > 3) cards[3].querySelector('h3').innerText = t('humid_title');
    if (cards.length > 4) cards[4].querySelector('h3').innerText = t('social_title');
    if (cards.length > 5) cards[5].querySelector('h3').innerText = t('current_temp_title');

    // Sections
    updateText('.humidity-checker-card h3', 'spot_check_title', true); // Keep icon
    updatePlaceholder('#spot-humidity-input', 'spot_check_placeholder');

    updateText('.chart-wrapper:not(.forecast-wrapper) h3', 'risk_breakdown');
    updateText('.forecast-header h3', 'hourly_forecast');

    updateText('.alerts-section h3', 'recent_alerts');
    updateText('.social-feed-section h3', 'social_pulse', true);

    updateText('.map-controls h2', 'live_risk_map');

    // Legend
    // This is trickier as it's a list. simpler to just refresh the map UI or update specific spans if possible.
    // .legend spans content is text nodes.
    const legend = document.querySelector('.legend');
    if (legend) {
        legend.innerHTML = `
            <span class="dot low"></span> ${t('legend_low')}
            <span class="dot mod"></span> ${t('legend_mod')}
            <span class="dot high"></span> ${t('legend_high')}
            <span class="dot critical"></span> ${t('legend_crit')}
        `;
    }

    // Trigger re-renders for components that generate dynamic content
    if (typeof fetchKeralaAlerts === 'function') fetchKeralaAlerts();
    if (window.lastRiskData && typeof updateUI === 'function') updateUI(window.lastRiskData);
}

function updateText(selector, key, preserveIcon = false) {
    const el = document.querySelector(selector);
    if (!el) return;

    const text = t(key);
    if (preserveIcon && el.firstElementChild && el.firstElementChild.tagName === 'I') {
        const icon = el.firstElementChild.outerHTML;
        el.innerHTML = icon + ' ' + text;
    } else {
        el.innerText = text;
    }
}

function updatePlaceholder(selector, key) {
    const el = document.querySelector(selector);
    if (el) el.placeholder = t(key);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('app_language') || 'en';

    document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
    document.getElementById('lang-ml').addEventListener('click', () => setLanguage('ml'));

    // Initial set without triggering full re-fetches if possible, but simpler to just set.
    setLanguage(savedLang);
});
