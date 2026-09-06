async function getWeather() {
    try {
        const response = await fetch(
            "https://weather-alert-system-2.onrender.com/weather?lat=28.3670&lon=79.4304"
        );

        if (!response.ok) {
            throw new Error("Backend request failed");
        }

        const data = await response.json();

        console.log("Weather data:", data);
    } catch (error) {
        console.error("Error:", error);
    }
}

getWeather();
