import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PredictionService {

    // Change this if your Python API runs somewhere other than
    // localhost:8000 (e.g. a deployed Render/HF Spaces URL).
    private static final String PREDICTION_API_URL =
            System.getenv().getOrDefault(
                    "PREDICTION_API_URL",
                    "https://weather-alert-system-local.onrender.com/predict"
            );

    /**
     * Extracts a numeric field from a flat JSON string like the one
     * produced by WeatherFormatter.formatWeatherData().
     */
    private static double extractField(String json, String field) {

        Pattern p = Pattern.compile(
                "\"" + field + "\"\\s*:\\s*(-?[0-9.]+)"
        );

        Matcher m = p.matcher(json);

        if (m.find()) {
            return Double.parseDouble(m.group(1));
        }

        return Double.NaN;
    }

    /**
     * Takes the formatted weather JSON (from WeatherFormatter) and a
     * point name, builds the request body the Python model expects,
     * calls it, and returns the raw prediction JSON.
     */
    public static String getPrediction(
            String formattedWeatherJson,
            String pointName
    ) {

        try {

            String requestBody =
                    "{"
                    + "\"point_name\":\"" + pointName + "\","
                    + "\"temperature_2m\":" + extractField(formattedWeatherJson, "temperature_2m") + ","
                    + "\"relative_humidity_2m\":" + extractField(formattedWeatherJson, "relative_humidity_2m") + ","
                    + "\"surface_pressure\":" + extractField(formattedWeatherJson, "surface_pressure") + ","
                    + "\"wind_speed_10m\":" + extractField(formattedWeatherJson, "wind_speed_10m") + ","
                    + "\"wind_gusts_10m\":" + extractField(formattedWeatherJson, "wind_gusts_10m") + ","
                    + "\"pressure_change_3h\":" + extractField(formattedWeatherJson, "pressure_change_3h") + ","
                    + "\"humidity_change_3h\":" + extractField(formattedWeatherJson, "humidity_change_3h") + ","
                    + "\"precip_last_3h\":" + extractField(formattedWeatherJson, "precip_last_3h") + ","
                    + "\"wind_change_3h\":" + extractField(formattedWeatherJson, "wind_change_3h")
                    + "}";

            HttpClient client = HttpClient.newHttpClient();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(PREDICTION_API_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response =
                    client.send(request, HttpResponse.BodyHandlers.ofString());

            return response.body();

        } catch (Exception e) {

            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}
