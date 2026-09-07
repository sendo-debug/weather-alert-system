/* ============================================================
   WeatherGuard AI — live data wiring
   1. Ask the browser for the user's real GPS coordinates
   2. Reverse-geocode those coordinates into a place name
   3. Fetch live weather for those coordinates from the backend
   4. Push everything into the DOM (no more hardcoded 31° / campus name)
   ============================================================ */

const WEATHER_API = "https://weather-alert-system-2.onrender.com/weather";

function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
}

/* Pull a value out of the response no matter how the backend nested it.
   Add/reorder paths here if you check the console log and see different
   field names — this tries the common shapes so nothing breaks silently. */
function pick(obj, paths, fallback) {
    for (const path of paths) {
        const val = path.split(".").reduce(
            (o, k) => (o && o[k] !== undefined ? o[k] : undefined),
            obj,
        );
        if (val !== undefined && val !== null && val !== "") return val;
    }
    return fallback;
}

function round(n) {
    return typeof n === "number" ? Math.round(n) : n;
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

function populateWeatherUI(data, placeName) {
    console.log("Weather data:", data);

    setText("heroLoc", placeName);

    const temp = round(
        pick(data, [
            "temperature",
            "temp",
            "current.temperature",
            "current.temp",
            "current_weather.temperature",
            "main.temp",
        ]),
    );
    if (temp !== undefined) setText("heroTemp", `${temp}°`);

    const feelsLike = round(
        pick(data, [
            "feels_like",
            "feelsLike",
            "current.feels_like",
            "main.feels_like",
        ]),
    );
    const humidity = round(
        pick(data, ["humidity", "current.humidity", "main.humidity"]),
    );
    const wind = round(
        pick(data, [
            "wind_speed",
            "windSpeed",
            "wind.speed",
            "current.wind_speed",
            "current_weather.windspeed",
        ]),
    );
    const pressure = round(
        pick(data, ["pressure", "current.pressure", "main.pressure"]),
    );
    const visibility = pick(data, ["visibility", "current.visibility"]);
    const uv = pick(data, ["uv_index", "uvi", "current.uvi"]);
    const cloud = round(
        pick(data, ["cloud_cover", "clouds.all", "current.clouds"]),
    );
    const description = pick(data, [
        "description",
        "condition",
        "weather.0.description",
        "current.condition.text",
        "summary",
    ]);
    const alertMsg = pick(data, ["alert", "alert_message", "warning"]);

    setText(
        "heroDesc",
        description || "Live conditions for your current location.",
    );

    setText("curTemp", temp !== undefined ? `${temp}°C` : undefined);
    setText("curFeels", feelsLike !== undefined ? `${feelsLike}°C` : undefined);
    setText("curHumidity", humidity !== undefined ? `${humidity}%` : undefined);
    setText("curWind", wind !== undefined ? `${wind} km/h` : undefined);
    setText("curPressure", pressure !== undefined ? `${pressure} hPa` : undefined);
    setText("curVisibility", visibility !== undefined ? `${visibility} km` : undefined);
    setText("curUV", uv !== undefined ? `${uv}` : undefined);
    setText("curCloud", cloud !== undefined ? `${cloud}%` : undefined);

    if (humidity !== undefined) {
        const fill = document.getElementById("humidityFill");
        if (fill) fill.style.width = `${humidity}%`;
    }

    if (alertMsg) {
        const box = document.getElementById("alertBox");
        if (box) box.style.display = "flex";
        setText("alertTitle", alertMsg);
    }

    // Point the embedded map at the real coordinates too
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

        populateWeatherUI(data, placeName);
    } catch (error) {
        console.error("Error:", error);
        setText("heroDesc", "Couldn't load live weather right now.");
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