/* ============================================================
   WeatherGuard AI — live data wiring
   Talks to the Java backend's /weather endpoint, which passes
   through Open-Meteo's raw "current" object unmodified:
   { current: { temperature_2m, relative_humidity_2m,
     pressure_msl, wind_speed_10m, rain, uv_index,
     apparent_temperature, visibility } }
   ============================================================ */

const WEATHER_API = "https://weather-alert-system-2.onrender.com/weather";

function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
}

function round(n, decimals = 0) {
    if (typeof n !== "number" || Number.isNaN(n)) return undefined;
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        );
        if (!res.ok) throw new Error("Reverse geocode failed");
        const data = await res.json();
        return (
            data.locality ||
            data.city ||
            data.principalSubdivision ||
            `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        );
    } catch (err) {
        console.warn("Reverse geocoding failed, falling back to coords:", err);
        return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
}

function describeConditions(rainMm, humidity) {
    if (rainMm > 0.5) return "Rain falling right now — grab an umbrella.";
    if (humidity > 80) return "Warm and humid conditions.";
    if (humidity < 30) return "Dry conditions, clear skies likely.";
    return "Mild conditions right now.";
}

function populateWeatherUI(data, placeName) {
    console.log("Weather data:", data);

    const current = data.current || {};

    setText("heroLoc", placeName);

    const temp = round(current.temperature_2m);
    const feelsLike = round(current.apparent_temperature);
    const humidity = round(current.relative_humidity_2m);
    const wind = round(current.wind_speed_10m);
    const pressure = round(current.pressure_msl);
    const visibilityKm =
        current.visibility !== undefined
            ? round(current.visibility / 1000, 1)
            : undefined;
    const uv = round(current.uv_index, 1);
    const rain = current.rain;

    if (temp !== undefined) setText("heroTemp", `${temp}°`);
    setText("heroDesc", describeConditions(rain || 0, humidity ?? 50));

    setText("curTemp", temp !== undefined ? `${temp}°C` : undefined);
    setText("curFeels", feelsLike !== undefined ? `${feelsLike}°C` : undefined);
    setText("curHumidity", humidity !== undefined ? `${humidity}%` : undefined);
    setText("curWind", wind !== undefined ? `${wind} km/h` : undefined);
    setText("curPressure", pressure !== undefined ? `${pressure} hPa` : undefined);
    setText("curVisibility", visibilityKm !== undefined ? `${visibilityKm} km` : undefined);
    setText("curUV", uv !== undefined ? `${uv}` : undefined);
    // Your /weather endpoint doesn't request cloud_cover, so this stays
    // blank unless you add "cloud_cover" to OpenMeteoService.getWeather().
    setText("curCloud", "—");

    if (humidity !== undefined) {
        const fill = document.getElementById("humidityFill");
        if (fill) fill.style.width = `${humidity}%`;
    }

    if (rain && rain > 2) {
        const box = document.getElementById("alertBox");
        if (box) box.style.display = "flex";
        setText("alertTitle", "Rain is currently falling in your area");
        setText("alertBody", "Move outdoor equipment indoors and avoid open areas.");
    }

    const map = document.getElementById("mapFrame");
    if (map && data.__lat !== undefined && data.__lon !== undefined) {
        map.src = `https://www.google.com/maps?q=${data.__lat},${data.__lon}&output=embed`;
    }
}

async function getWeather(lat, lon) {
    try {
        const [weatherRes, placeName] = await Promise.all([
            fetch(`${WEATHER_API}?lat=${lat}&lon=${lon}`),
            reverseGeocode(lat, lon),
        ]);

        if (!weatherRes.ok) {
            throw new Error("Backend request failed");
        }

        const data = await weatherRes.json();
        data.__lat = lat;
        data.__lon = lon;

        if (data.error) {
            throw new Error(data.error);
        }

        populateWeatherUI(data, placeName);
    } catch (error) {
        console.error("Error:", error);
        setText("heroDesc", "Couldn't load live weather right now — try again shortly.");
    }
}

function getLocationAndWeather() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        setText("heroLoc", "Location unavailable");
        setText("heroDesc", "Your browser doesn't support geolocation.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`Location acquired: lat=${latitude}, lon=${longitude}`);
            getWeather(latitude, longitude);
        },
        (error) => {
            console.error("Geolocation error:", error.message);
            setText("heroLoc", "Location permission denied");
            setText(
                "heroDesc",
                "Enable location access to see live weather for where you are.",
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        },
    );
}

getLocationAndWeather();