/* ============================================================
   WeatherGuard AI — live data wiring
   - Current conditions: your Java backend's /weather endpoint
     (passes through Open-Meteo's "current" object as-is)
   - Hourly / daily forecast, sunrise-sunset, historical dates:
     fetched directly from Open-Meteo's free public API, since
     the backend doesn't expose those in display-ready form yet
   ============================================================ */

const WEATHER_API = "https://weather-alert-system-2.onrender.com/weather";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

let lastKnownCoords = null; // filled in once geolocation resolves

/* ---------- small helpers ---------- */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
}

function round(n, decimals = 0) {
    if (typeof n !== "number" || Number.isNaN(n)) return undefined;
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
}

function playReveal(section) {
    section.querySelectorAll(".reveal-up").forEach((el) => {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
    });
}

// WMO weather codes (used by Open-Meteo) -> [icon, description]
const WMO_CODES = {
    0: ["☀️", "Clear sky"],
    1: ["🌤️", "Mainly clear"],
    2: ["⛅", "Partly cloudy"],
    3: ["☁️", "Overcast"],
    45: ["🌫️", "Fog"],
    48: ["🌫️", "Rime fog"],
    51: ["🌦️", "Light drizzle"],
    53: ["🌦️", "Moderate drizzle"],
    55: ["🌦️", "Dense drizzle"],
    56: ["🌧️", "Freezing drizzle"],
    57: ["🌧️", "Freezing drizzle"],
    61: ["🌧️", "Slight rain"],
    63: ["🌧️", "Moderate rain"],
    65: ["🌧️", "Heavy rain"],
    66: ["🌧️", "Freezing rain"],
    67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Slight snow"],
    73: ["🌨️", "Moderate snow"],
    75: ["🌨️", "Heavy snow"],
    77: ["🌨️", "Snow grains"],
    80: ["🌦️", "Rain showers"],
    81: ["🌦️", "Rain showers"],
    82: ["⛈️", "Violent showers"],
    85: ["🌨️", "Snow showers"],
    86: ["🌨️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"],
    96: ["⛈️", "Thunderstorm, hail"],
    99: ["⛈️", "Thunderstorm, hail"],
};
function codeInfo(code) {
    return WMO_CODES[code] || ["🌡️", "Unknown"];
}

function formatHour(dateObj) {
    return dateObj
        .toLocaleTimeString(undefined, { hour: "numeric", hour12: true })
        .replace(" ", "");
}

/* ---------- reverse geocoding for the hero location text ---------- */

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

/* ---------- current conditions (backend) ---------- */

function describeConditions(rainMm, humidity) {
    if (rainMm > 0.5) return "Rain falling right now — grab an umbrella.";
    if (humidity > 80) return "Warm and humid conditions.";
    if (humidity < 30) return "Dry conditions, clear skies likely.";
    return "Mild conditions right now.";
}

function populateCurrentWeather(data, placeName) {
    console.log("Current weather data:", data);

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
    const rain = current.rain || 0;

    if (temp !== undefined) setText("heroTemp", `${temp}°`);
    setText("heroDesc", describeConditions(rain, humidity ?? 50));

    setText("curTemp", temp !== undefined ? `${temp}°C` : undefined);
    setText("curFeels", feelsLike !== undefined ? `${feelsLike}°C` : undefined);
    setText("curHumidity", humidity !== undefined ? `${humidity}%` : undefined);
    setText("curWind", wind !== undefined ? `${wind} km/h` : undefined);
    setText("curPressure", pressure !== undefined ? `${pressure} hPa` : undefined);
    setText("curVisibility", visibilityKm !== undefined ? `${visibilityKm} km` : undefined);
    setText("curUV", uv !== undefined ? `${uv}` : undefined);

    if (humidity !== undefined) {
        const fill = document.getElementById("humidityFill");
        if (fill) fill.style.width = `${humidity}%`;
    }

    const map = document.getElementById("mapFrame");
    if (map) map.src = `https://www.google.com/maps?q=${data.__lat},${data.__lon}&output=embed`;
}

async function getCurrentWeather(lat, lon) {
    try {
        const [weatherRes, placeName] = await Promise.all([
            fetch(`${WEATHER_API}?lat=${lat}&lon=${lon}`),
            reverseGeocode(lat, lon),
        ]);

        if (!weatherRes.ok) throw new Error("Backend request failed");

        const data = await weatherRes.json();
        if (data.error) throw new Error(data.error);

        data.__lat = lat;
        data.__lon = lon;
        populateCurrentWeather(data, placeName);
    } catch (error) {
        console.error("Current weather error:", error);
        setText("heroDesc", "Couldn't load live weather right now — try again shortly.");
    }
}

/* ---------- hourly + daily forecast, cloud cover, alert (Open-Meteo direct) ---------- */

async function getForecastData(lat, lon) {
    try {
        const url =
            `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}` +
            `&hourly=temperature_2m,precipitation_probability,weathercode,cloud_cover` +
            `&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
            `&timezone=auto&forecast_days=7`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Forecast request failed");
        const data = await res.json();
        console.log("Forecast data:", data);

        populateHourly(data);
        populateDaily(data);
        populateAlertAndCloud(data);
        populateAstronomy(data);
    } catch (error) {
        console.error("Forecast error:", error);
        setText("hourlyWeather", undefined);
        const hourly = document.getElementById("hourlyWeather");
        if (hourly) hourly.innerHTML = '<p class="history-empty">Hourly forecast unavailable right now.</p>';
        const grid = document.getElementById("forecastGrid");
        if (grid) grid.innerHTML = '<p class="history-empty">7-day forecast unavailable right now.</p>';
    }
}

function findCurrentHourIndex(times) {
    const now = new Date();
    for (let i = 0; i < times.length; i++) {
        if (new Date(times[i]) >= now) return i;
    }
    return 0;
}

function populateHourly(data) {
    const container = document.getElementById("hourlyWeather");
    if (!container || !data.hourly) return;

    const { time, temperature_2m, weathercode } = data.hourly;
    const startIdx = findCurrentHourIndex(time);
    const slice = time.slice(startIdx, startIdx + 24);

    container.innerHTML = slice
        .map((t, i) => {
            const idx = startIdx + i;
            const temp = round(temperature_2m[idx]);
            const [icon] = codeInfo(weathercode[idx]);
            const isRainy = weathercode[idx] >= 51 && weathercode[idx] < 90;
            const label = i === 0 ? "Now" : formatHour(new Date(t));
            return `<div class="hour${isRainy ? " rainy" : ""}">
                <p>${label}</p>
                <span class="ic">${icon}</span>
                <h3>${temp}°</h3>
            </div>`;
        })
        .join("");
}

function populateDaily(data) {
    const grid = document.getElementById("forecastGrid");
    if (!grid || !data.daily) return;

    const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily;

    grid.innerHTML = time
        .map((t, i) => {
            const [icon, cond] = codeInfo(weathercode[i]);
            const dname =
                i === 0
                    ? "TODAY"
                    : new Date(t)
                          .toLocaleDateString(undefined, { weekday: "short" })
                          .toUpperCase();
            const hi = round(temperature_2m_max[i]);
            const lo = round(temperature_2m_min[i]);
            return `<div class="day-card reveal-up" style="--i:${i + 1}">
                <div class="dname">${dname}</div>
                <span class="ic">${icon}</span>
                <div><span class="hi">${hi}°</span><span class="lo">${lo}°</span></div>
                <div class="cond">${cond}</div>
            </div>`;
        })
        .join("");
}

function populateAlertAndCloud(data) {
    if (!data.hourly) return;
    const { time, precipitation_probability, cloud_cover } = data.hourly;
    const startIdx = findCurrentHourIndex(time);

    const cloud = round(cloud_cover[startIdx]);
    setText("curCloud", cloud !== undefined ? `${cloud}%` : undefined);

    // Look ahead up to 12 hours for the first hour with a real rain risk.
    let rainIdx = -1;
    for (let i = startIdx; i < Math.min(startIdx + 12, precipitation_probability.length); i++) {
        if (precipitation_probability[i] >= 50) {
            rainIdx = i;
            break;
        }
    }

    const box = document.getElementById("alertBox");
    if (rainIdx === -1) {
        if (box) box.style.display = "none";
        setText("rainEta", "☀️ No rain expected");
        setText("rainSub", "No significant rain expected in the next 12 hours.");
        return;
    }

    const hoursAhead = rainIdx - startIdx;
    const prob = precipitation_probability[rainIdx];
    const etaText =
        hoursAhead === 0 ? "🌧️ Rain now" : `🌧️ Rain in ~${hoursAhead}h`;

    setText("rainEta", etaText);
    setText("rainSub", `${prob}% chance of rain around ${formatHour(new Date(time[rainIdx]))}.`);

    if (box) {
        box.style.display = prob >= 70 ? "flex" : "none";
        setText("alertTitle", `Rain likely around ${formatHour(new Date(time[rainIdx]))}`);
        setText("alertBody", "Move outdoor equipment indoors and avoid open areas.");
        setText("riskTag", prob >= 85 ? "HIGH RISK" : "MODERATE RISK");
    }
}

/* ---------- astronomy: sunrise/sunset from Open-Meteo + computed moon phase ---------- */

function getMoonPhase(date) {
    // Days since a known new moon (2000-01-06 18:14 UTC), mod the
    // synodic month (~29.53 days). Standard approximate lunar phase calc.
    const synodic = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const days = (date.getTime() - knownNewMoon) / 86400000;
    const phase = ((days % synodic) + synodic) % synodic;
    const illumination = round((1 - Math.cos((2 * Math.PI * phase) / synodic)) / 2 * 100);

    const stages = [
        [1.84566, "New Moon", "🌑"],
        [5.53699, "Waxing Crescent", "🌒"],
        [9.22831, "First Quarter", "🌓"],
        [12.91963, "Waxing Gibbous", "🌔"],
        [16.61096, "Full Moon", "🌕"],
        [20.30228, "Waning Gibbous", "🌖"],
        [23.99361, "Last Quarter", "🌗"],
        [27.68493, "Waning Crescent", "🌘"],
        [29.53058867, "New Moon", "🌑"],
    ];
    let name = stages[0][1];
    let emoji = stages[0][2];
    for (const [upTo, label, ic] of stages) {
        if (phase < upTo) {
            name = label;
            emoji = ic;
            break;
        }
    }
    return { name, emoji, illumination };
}

function populateAstronomy(data) {
    if (!data.daily) return;
    const sunrise = data.daily.sunrise?.[0];
    const sunset = data.daily.sunset?.[0];

    if (sunrise) setText("sunriseVal", formatHour(new Date(sunrise)));
    if (sunset) setText("sunsetVal", formatHour(new Date(sunset)));

    if (sunrise && sunset) {
        const ms = new Date(sunset) - new Date(sunrise);
        const h = Math.floor(ms / 3600000);
        const m = Math.round((ms % 3600000) / 60000);
        setText("daylenVal", `${h}h ${m}m`);
    }

    const moon = getMoonPhase(new Date());
    setText("moonPhaseVal", moon.name);
    setText("moonEmoji", moon.emoji);
    setText("moonPhaseTitle", `${moon.name} · ${moon.illumination}% illuminated`);
    setText(
        "moonRiseSet",
        "Moonrise/moonset times aren't available from the current data source.",
    );
}

/* ---------- historical date lookup (Open-Meteo archive, real data) ---------- */

async function geocodeCity(name) {
    const res = await fetch(`${OPEN_METEO_GEOCODE}?name=${encodeURIComponent(name)}&count=1`);
    if (!res.ok) throw new Error("Geocoding failed");
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
        throw new Error(`Couldn't find a location matching "${name}"`);
    }
    const r = data.results[0];
    return { lat: r.latitude, lon: r.longitude, label: `${r.name}, ${r.country || ""}`.trim() };
}

async function fetchHistory() {
    const dateVal = document.getElementById("histDate").value;
    const cityInput = document.getElementById("histCity").value.trim();
    const output = document.getElementById("historyOutput");

    if (!dateVal) {
        output.innerHTML = '<p class="history-empty">Please choose a date first.</p>';
        return;
    }

    output.innerHTML = '<p class="history-empty">Looking up historical weather…</p>';

    try {
        let coords;
        let label;
        if (cityInput) {
            const geo = await geocodeCity(cityInput);
            coords = { lat: geo.lat, lon: geo.lon };
            label = geo.label;
        } else if (lastKnownCoords) {
            coords = lastKnownCoords;
            label = "your current location";
        } else {
            throw new Error("Enter a location, or allow location access on this page.");
        }

        const url =
            `${OPEN_METEO_ARCHIVE}?latitude=${coords.lat}&longitude=${coords.lon}` +
            `&start_date=${dateVal}&end_date=${dateVal}` +
            `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
            `&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Historical data request failed");
        const data = await res.json();
        console.log("Historical data:", data);

        if (!data.daily || data.daily.time.length === 0 || data.daily.temperature_2m_max[0] === null) {
            output.innerHTML = '<p class="history-empty">No historical data available for that date/location.</p>';
            return;
        }

        const [icon, cond] = codeInfo(data.daily.weathercode[0]);
        const hi = round(data.daily.temperature_2m_max[0]);
        const lo = round(data.daily.temperature_2m_min[0]);
        const precip = round(data.daily.precipitation_sum[0], 1);
        const wind = round(data.daily.wind_speed_10m_max[0]);

        const formatted = new Date(dateVal + "T00:00:00").toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        output.innerHTML = `
    <div class="section-label reveal-up" style="--i:0">Results for ${formatted} · ${label}</div>
    <div class="cards">
      <div class="card reveal-up" style="--i:1"><span class="ic">${icon}</span><div class="label">Condition</div><div class="value">${cond}</div></div>
      <div class="card reveal-up" style="--i:2"><span class="ic">🌡️</span><div class="label">High / Low</div><div class="value">${hi}° / ${lo}°</div></div>
      <div class="card reveal-up" style="--i:3"><span class="ic">🌧️</span><div class="label">Precipitation</div><div class="value">${precip} mm</div></div>
      <div class="card reveal-up" style="--i:4"><span class="ic">🌬️</span><div class="label">Max wind</div><div class="value">${wind} km/h</div></div>
    </div>
  `;
        playReveal(output);
    } catch (error) {
        console.error("History lookup error:", error);
        output.innerHTML = `<p class="history-empty">${error.message || "Couldn't fetch historical weather."}</p>`;
    }
}
window.fetchHistory = fetchHistory;

/* ---------- kick everything off from geolocation ---------- */

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
            lastKnownCoords = { lat: latitude, lon: longitude };
            getCurrentWeather(latitude, longitude);
            getForecastData(latitude, longitude);
        },
        (error) => {
            console.error("Geolocation error:", error.message);
            setText("heroLoc", "Location permission denied");
            setText("heroDesc", "Enable location access to see live weather for where you are.");
            const hourly = document.getElementById("hourlyWeather");
            if (hourly) hourly.innerHTML = '<p class="history-empty">Enable location access to see the hourly forecast.</p>';
            const grid = document.getElementById("forecastGrid");
            if (grid) grid.innerHTML = '<p class="history-empty">Enable location access to see the 7-day forecast.</p>';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        },
    );
}

getLocationAndWeather();