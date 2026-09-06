import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class WeatherFormatter {

    // =========================================================
    // CURRENT TIME IN INDIA
    // =========================================================

    private static String getCurrentISTTime() {

        ZonedDateTime now =
                ZonedDateTime.now(
                        ZoneId.of("Asia/Kolkata")
                );

        return now.format(
                DateTimeFormatter.ofPattern(
                        "yyyy-MM-dd'T'HH:00"
                )
        );
    }


    // =========================================================
    // FIND CURRENT TIME INDEX
    // =========================================================

    private static int getCurrentTimeIndex(String json) {

        String currentTime =
                getCurrentISTTime();

        Pattern pattern =
                Pattern.compile(
                        "\"time\"\\s*:\\s*\\[(.*?)\\]",
                        Pattern.DOTALL
                );

        Matcher matcher =
                pattern.matcher(json);

        if (!matcher.find()) {
            return -1;
        }

        String timeArray =
                matcher.group(1);

        Pattern timePattern =
                Pattern.compile("\"([^\"]+)\"");

        Matcher timeMatcher =
                timePattern.matcher(timeArray);

        int index = 0;

        while (timeMatcher.find()) {

            String time =
                    timeMatcher.group(1);

            if (time.equals(currentTime)) {

                return index;
            }

            index++;
        }

        return -1;
    }


 
    // =========================================================
    // GET NUMERICAL ARRAY
    // =========================================================

    private static double[] getArray(
            String json,
            String variable
    ) {

        try {

            String pattern =
                    "\"" + variable
                    + "\"\\s*:\\s*\\[(.*?)\\]";

            Pattern p =
                    Pattern.compile(
                            pattern,
                            Pattern.DOTALL
                    );

            Matcher m =
                    p.matcher(json);

            if (!m.find()) {
                return new double[0];
            }

            String array =
                    m.group(1);

            String[] values =
                    array.split(",");

            double[] result =
                    new double[values.length];

            for (int i = 0;
                 i < values.length;
                 i++) {

                String value =
                        values[i].trim();

                if (value.equals("null")) {

                    result[i] =
                            Double.NaN;

                } else {

                    result[i] =
                            Double.parseDouble(value);
                }
            }

            return result;

        } catch (Exception e) {

            System.out.println(
                    "Error reading "
                    + variable
                    + ": "
                    + e.getMessage()
            );

            return new double[0];
        }
    }


    // =========================================================
    // GET VALUE AT INDEX
    // =========================================================

    private static double getValue(
            double[] array,
            int index
    ) {

        if (index < 0 ||
            index >= array.length) {

            return Double.NaN;
        }

        return array[index];
    }


    // =========================================================
    // SUM PREVIOUS HOURS OF RAIN
    // =========================================================

    private static double getRainHistory(
            double[] rain,
            int currentIndex,
            int hours
    ) {

        double sum = 0;

        int start =
                Math.max(
                        0,
                        currentIndex - hours
                );

        // IMPORTANT:
        // We start BEFORE the current hour.
        // So current hour rain is NOT included.

        for (int i = start;
             i < currentIndex;
             i++) {

            if (!Double.isNaN(rain[i])) {

                sum += rain[i];
            }
        }

        return sum;
    }


    // =========================================================
    // FORMAT WEATHER DATA
    // =========================================================

    public static String formatWeatherData(
            String json,
            String modelName,
            double latitude,
            double longitude
    ) {

        // Find current hour
        int currentIndex =
                getCurrentTimeIndex(json);


        if (currentIndex == -1) {

            System.out.println(
                    "Current IST time not found."
            );

            return "{\"error\":\"Current time not found\"}";
        }


        // =====================================================
        // GET ALL OPEN-METEO ARRAYS
        // =====================================================

        double[] temperature =
                getArray(
                        json,
                        "temperature_2m"
                );

        double[] humidity =
                getArray(
                        json,
                        "relative_humidity_2m"
                );

        double[] dewPoint =
                getArray(
                        json,
                        "dew_point_2m"
                );

        double[] pressure =
                getArray(
                        json,
                        "pressure_msl"
                );

        double[] windSpeed =
                getArray(
                        json,
                        "wind_speed_10m"
                );

        double[] windGust =
                getArray(
                        json,
                        "wind_gusts_10m"
                );

        double[] precipitation =
                getArray(
                        json,
                        "precipitation"
                );

        double[] rain =
                getArray(
                        json,
                        "rain"
                );

        double[] cloudCover =
                getArray(
                        json,
                        "cloud_cover"
                );


        // =====================================================
        // CURRENT VALUES
        // =====================================================

        double currentTemperature =
                getValue(
                        temperature,
                        currentIndex
                );

        double currentHumidity =
                getValue(
                        humidity,
                        currentIndex
                );

        double currentDewPoint =
                getValue(
                        dewPoint,
                        currentIndex
                );

        double currentPressure =
                getValue(
                        pressure,
                        currentIndex
                );

        double currentWind =
                getValue(
                        windSpeed,
                        currentIndex
                );

        double currentWindGust =
                getValue(
                        windGust,
                        currentIndex
                );

        double currentPrecipitation =
                getValue(
                        precipitation,
                        currentIndex
                );

        double currentRain =
                getValue(
                        rain,
                        currentIndex
                );

        double currentCloudCover =
                getValue(
                        cloudCover,
                        currentIndex
                );


        // =====================================================
        // PREVIOUS HOUR VALUES
        // =====================================================

        int previousIndex =
                currentIndex - 1;


        double previousTemperature =
                getValue(
                        temperature,
                        previousIndex
                );

        double previousHumidity =
                getValue(
                        humidity,
                        previousIndex
                );

        double previousPressure =
                getValue(
                        pressure,
                        previousIndex
                );

        double previousWind =
                getValue(
                        windSpeed,
                        previousIndex
                );


        // =====================================================
        // 1 HOUR CHANGES
        // =====================================================

        double tempChange1h =
                currentTemperature
                - previousTemperature;


        double humidityChange1h =
                currentHumidity
                - previousHumidity;


        double pressureChange1h =
                currentPressure
                - previousPressure;


        double windChange1h =
                currentWind
                - previousWind;


        // =====================================================
        // RAIN HISTORY
        // =====================================================

        double rainLast3h =
                getRainHistory(
                        rain,
                        currentIndex,
                        3
                );


        double rainLast6h =
                getRainHistory(
                        rain,
                        currentIndex,
                        6
                );


        // =====================================================
        // TIME
        // =====================================================

        String timestamp =
                getCurrentISTTime();


        ZonedDateTime now =
                ZonedDateTime.now(
                        ZoneId.of("Asia/Kolkata")
                );


        int hour =
                now.getHour();


        int month =
                now.getMonthValue();


        // =====================================================
        // BUILD FINAL JSON
        // =====================================================

        String formattedJson =
                "{"

                + "\"time\":\""
                + timestamp
                + "\","

                + "\"temperature_2m\":"
                + currentTemperature
                + ","

                + "\"relative_humidity_2m\":"
                + currentHumidity
                + ","

                + "\"dew_point_2m\":"
                + currentDewPoint
                + ","

                + "\"surface_pressure\":"
                + currentPressure
                + ","

                + "\"wind_speed_10m\":"
                + currentWind
                + ","

                + "\"wind_gusts_10m\":"
                + currentWindGust
                + ","

                + "\"precipitation\":"
                + currentPrecipitation
                + ","

                + "\"rain\":"
                + currentRain
                + ","

                + "\"cloud_cover\":"
                + currentCloudCover
                + ","

                + "\"latitude\":"
                + latitude
                + ","

                + "\"longitude\":"
                + longitude
                + ","

                + "\"hour\":"
                + hour
                + ","

                + "\"month\":"
                + month
                + ","

                + "\"temp_change_1h\":"
                + tempChange1h
                + ","

                + "\"humidity_change_1h\":"
                + humidityChange1h
                + ","

                + "\"pressure_change_1h\":"
                + pressureChange1h
                + ","

                + "\"wind_change_1h\":"
                + windChange1h
                + ","

                + "\"rain_last_3h\":"
                + rainLast3h
                + ","

                + "\"rain_last_6h\":"
                + rainLast6h

                + "}";


        return formattedJson;
    }
}