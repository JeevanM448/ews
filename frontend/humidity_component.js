/**
 * Humidity Checker Component
 * Modular logic for fetching real-time humidity by city name
 */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('spot-humidity-input');
    const btn = document.getElementById('spot-humidity-btn');
    const resultDiv = document.getElementById('spot-humidity-result');
    const loadingDiv = document.getElementById('spot-humidity-loading');
    const errorDiv = document.getElementById('spot-humidity-error');
    const humidVal = document.getElementById('spot-humid-val');
    const humidLoc = document.getElementById('spot-humid-loc');

    if (!btn) return;

    btn.addEventListener('click', async () => {
        const city = input.value.trim();
        if (!city) return;

        // Reset UI
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');

        try {
            // 1. Geocoding
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error('City not found');
            }

            const { latitude, longitude, name, country } = geoData.results[0];

            // 2. Fetch Humidity
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=relative_humidity_2m`;
            const weatherRes = await fetch(weatherUrl);
            const weatherData = await weatherRes.json();

            if (!weatherData.current) {
                throw new Error('Weather data unavailable');
            }

            const humidity = weatherData.current.relative_humidity_2m;

            // 3. Update UI
            humidVal.textContent = `${humidity}%`;
            humidLoc.textContent = `${name}, ${country}`;

            loadingDiv.classList.add('hidden');
            resultDiv.classList.remove('hidden');

        } catch (err) {
            console.error("Humidity Check Error:", err);
            loadingDiv.classList.add('hidden');
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = err.message || 'An error occurred';
        }
    });

    // Enter key support
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btn.click();
    });
});
