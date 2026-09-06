async function getWeather() {
    try {
        const response = await fetch(
            "http://localhost:8080/weather?lat=28.3670&lon=79.4304"
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
