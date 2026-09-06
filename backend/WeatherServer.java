import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

public class WeatherServer {

    public static void startServer() {

        try {

            HttpServer server =
                    HttpServer.create(
                            new InetSocketAddress(
    Integer.parseInt(
        System.getenv().getOrDefault("PORT", "8080")
    )
),
                            0
                    );


            /*
             * Current weather
             *
             * /weather?lat=28.3670&lon=79.4304
             */

            server.createContext(
                    "/weather",
                    exchange -> {

                        Map<String, String> params =
                                getQueryParams(exchange.getRequestURI());

                        double lat =
                                Double.parseDouble(
                                        params.get("lat")
                                );

                        double lon =
                                Double.parseDouble(
                                        params.get("lon")
                                );


                        String result =
                                OpenMeteoService.getWeather(
                                        lat,
                                        lon
                                );


                        sendResponse(
                                exchange,
                                result
                        );
                    }
            );


            /*
             * ECMWF
             *
             * /ecmwf?lat=28.3670&lon=79.4304
             */

            server.createContext(
                    "/ecmwf",
                    exchange -> {

                        Map<String, String> params =
                                getQueryParams(exchange.getRequestURI());

                        double lat =
                                Double.parseDouble(
                                        params.get("lat")
                                );

                        double lon =
                                Double.parseDouble(
                                        params.get("lon")
                                );


                        String rawData =
                                OpenMeteoService.getECMWF(
                                        lat,
                                        lon
                                );


                        String formattedData =
                               WeatherFormatter.formatWeatherData(
                                    rawData,
                                    "ECMWF",
                                    lat,
                                    lon
                                );


                        sendResponse(
                                exchange,
                                formattedData
                        );
                    }
            );


            /*
             * GFS
             *
             * /gfs?lat=28.3670&lon=79.4304
             */

            server.createContext(
                    "/gfs",
                    exchange -> {

                        Map<String, String> params =
                                getQueryParams(exchange.getRequestURI());

                        double lat =
                                Double.parseDouble(
                                        params.get("lat")
                                );

                        double lon =
                                Double.parseDouble(
                                        params.get("lon")
                                );


                        String rawData =
                                OpenMeteoService.getGFS(
                                        lat,
                                        lon
                                );


                        String formattedData =
                                WeatherFormatter.formatWeatherData(
                                        rawData,
                                        "GFS",
                                        lat,
                                        lon
                                );


                        sendResponse(
                                exchange,
                                formattedData
                        );
                    }
            );


            /*
             * ICON
             *
             * /icon?lat=28.3670&lon=79.4304
             */

            server.createContext(
                    "/icon",
                    exchange -> {

                        Map<String, String> params =
                                getQueryParams(exchange.getRequestURI());

                        double lat =
                                Double.parseDouble(
                                        params.get("lat")
                                );

                        double lon =
                                Double.parseDouble(
                                        params.get("lon")
                                );


                        String rawData =
                                OpenMeteoService.getICON(
                                        lat,
                                        lon
                                );


                        String formattedData =
                                WeatherFormatter.formatWeatherData(
                                        rawData,
                                        "ICON",
                                        lat,
                                        lon
                                );


                        sendResponse(
                                exchange,
                                formattedData
                        );
                    }
            );


            server.start();

            System.out.println(
                    "Server started on port 8080"
            );

            System.out.println(
                    "Open-Meteo endpoints ready."
            );


        } catch (IOException e) {

            e.printStackTrace();
        }
    }


    /*
     * Reads URL parameters.
     */

    private static Map<String, String> getQueryParams(
            URI uri
    ) {

        Map<String, String> params =
                new HashMap<>();


        String query =
                uri.getQuery();


        if (query == null) {
            return params;
        }


        String[] pairs =
                query.split("&");


        for (String pair : pairs) {

            String[] keyValue =
                    pair.split("=");


            if (keyValue.length == 2) {

                params.put(
                        keyValue[0],
                        keyValue[1]
                );
            }
        }


        return params;
    }


    /*
     * Sends JSON response to browser.
     */

    private static void sendResponse(
            HttpExchange exchange,
            String response
    ) throws IOException {


        exchange.getResponseHeaders()
                .set(
                        "Content-Type",
                        "application/json"
                );


        exchange.sendResponseHeaders(
                200,
                response.getBytes().length
        );


        OutputStream os =
                exchange.getResponseBody();


        os.write(
                response.getBytes()
        );


        os.close();
    }
}
