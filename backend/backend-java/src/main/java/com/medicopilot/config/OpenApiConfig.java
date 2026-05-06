package com.medicopilot.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI mediCopilotOpenAPI() {
        Schema<?> apiResponseSchema = new Schema<>()
                .type("object")
                .description("Standard API response wrapper")
                .addProperty("success", new Schema<>().type("boolean"))
                .addProperty("message", new StringSchema())
                .addProperty("data", new Schema<>().type("object"))
                .addProperty("errorCode", new StringSchema().nullable(true))
                .addProperty("timestamp", new StringSchema().format("date-time"));

        return new OpenAPI()
                .info(new Info()
                        .title("MediCopilot API")
                        .description("Event-Driven Dual-Agent Radiology AI Assistant API")
                        .version("v1.0.0"))
                .schema("ApiResponse", apiResponseSchema);
    }
}
