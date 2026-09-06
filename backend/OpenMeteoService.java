import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class OpenMeteoService {

    public static String getWeather(
            double latitude,
            double longitude
    ) {

        try {

            String url =
                    "https://api.open-meteo.com/v1/forecast"
                    + "?latitude=" + latitude
                    + "&longitude=" + longitude
                    + "&current="
                    + "temperature_2m,"
                    + "relative_humidity_2m,"
                    + "pressure_msl,"
                    + "wind_speed_10m,"
                    + "rain"
                    + "&timezone=Asia%2FKolkata";;

            HttpClient client =
                    HttpClient.newHttpClient();

            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .GET()
                            .build();

            HttpResponse<String> response =
                    client.send(
                            request,
                            HttpResponse.BodyHandlers.ofString()
                    );

            return response.body();

        } catch (Exception e) {

            return "{\"error\":\""
                    + e.getMessage()
                    + "\"}";
        }
    }
   
   
   
    public static String getECMWF(
        double latitude,
        double longitude
) {

    try {

        String url =
                "https://api.open-meteo.com/v1/ecmwf"
                + "?latitude=" + latitude
                + "&longitude=" + longitude
                + "&hourly="
                + "temperature_2m,"
                + "relative_humidity_2m,"
                + "dew_point_2m,"
                + "pressure_msl,"
                + "wind_speed_10m,"
                + "wind_direction_10m,"
                + "wind_gusts_10m,"
                + "precipitation,"
                + "rain,"
                + "showers,"
                + "cloud_cover,"
                + "cape,"
                + "convective_inhibition"
                + "&timezone=Asia%2FKolkata";

        HttpClient client =
                HttpClient.newHttpClient();

        HttpRequest request =
                HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .GET()
                        .build();

        HttpResponse<String> response =
                client.send(
                        request,
                        HttpResponse.BodyHandlers.ofString()
                );

        return response.body();

    } catch (Exception e) {

        return "{\"error\":\""
                + e.getMessage()
                + "\"}";
    }
}
       public static String getGFS(
        double latitude,
        double longitude
) {

    try {

        String url =
                "https://api.open-meteo.com/v1/gfs"
                + "?latitude=" + latitude
                + "&longitude=" + longitude
                + "&hourly="
                + "temperature_2m,"
                + "relative_humidity_2m,"
                + "dew_point_2m,"
                + "pressure_msl,"
                + "wind_speed_10m,"
                + "wind_direction_10m,"
                + "wind_gusts_10m,"
                + "precipitation,"
                + "rain,"
                + "showers,"
                + "cloud_cover,"
                + "cape,"
                + "convective_inhibition"
                + "&timezone=Asia%2FKolkata";

        HttpClient client =
                HttpClient.newHttpClient();

        HttpRequest request =
                HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .GET()
                        .build();

        HttpResponse<String> response =
                client.send(
                        request,
                        HttpResponse.BodyHandlers.ofString()
                );

        return response.body();

    } catch (Exception e) {

        return "{\"error\":\""
                + e.getMessage()
                + "\"}";
    }
}
public static String getICON(
        double latitude,
        double longitude
) {

    try {

        String url =
                "https://api.open-meteo.com/v1/dwd-icon"
                + "?latitude=" + latitude
                + "&longitude=" + longitude
                + "&hourly="
                + "temperature_2m,"
                + "relative_humidity_2m,"
                + "dew_point_2m,"
                + "pressure_msl,"
                + "wind_speed_10m,"
                + "wind_direction_10m,"
                + "wind_gusts_10m,"
                + "precipitation,"
                + "rain,"
                + "showers,"
                + "cloud_cover,"
                + "cape,"
                + "convective_inhibition"
                + "&timezone=Asia%2FKolkata";

        HttpClient client =
                HttpClient.newHttpClient();

        HttpRequest request =
                HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .GET()
                        .build();

        HttpResponse<String> response =
                client.send(
                        request,
                        HttpResponse.BodyHandlers.ofString()
                );

        return response.body();

    } catch (Exception e) {

        return "{\"error\":\""
                + e.getMessage()
                + "\"}";
    }
}
}
