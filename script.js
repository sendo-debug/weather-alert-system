async function getWeather() {
    const response = await fetch(
        "http://localhost:8080/weather?lat=28.3670&lon=79.4304"
    );

    const data = await response.json();

    console.log(data);
}

getWeather();
