FROM eclipse-temurin:21-jdk

WORKDIR /app

ENV PREDICTION_API_URL=https://weather-alert-system-local.onrender.com/predict

COPY *.java .

RUN javac *.java

CMD ["java", "Main"]
