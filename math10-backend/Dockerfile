FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src src
# Test dùng DB nhúng và đang đỏ sẵn 11 ca, không chạy lúc build image.
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Render gói free chỉ có 512MB RAM.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"
# Render cấp cổng qua biến PORT.
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
