async function getWeather(lat, lon) {
    try {
        const response = await fetch(
            `https://weather-alert-system-2.onrender.com/weather?lat=${lat}&lon=${lon}`
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

function getLocationAndWeather() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
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
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        }
    );
}

getLocationAndWeather();

```java
/**
 * Sends a JSON response to the browser with CORS enabled.
 */
private static void sendResponse(
        HttpExchange exchange,
        String response
) throws IOException {

    byte[] responseBytes = response.getBytes();

    exchange.getResponseHeaders().set(
            "Content-Type",
            "application/json"
    );

    exchange.getResponseHeaders().set(
            "Access-Control-Allow-Origin",
            "*"
    );

    exchange.sendResponseHeaders(
            200,
            responseBytes.length
    );

    try (OutputStream os = exchange.getResponseBody()) {
        os.write(responseBytes);
    }
}
```
