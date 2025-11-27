// SecurityConfig.java에 사용할 CORS 설정 (더 관대한 버전)

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    
    // 모든 Origin 허용 (프로덕션에서만 사용, 보안 주의)
    configuration.setAllowedOriginPatterns(List.of("*"));  // 또는 특정 도메인만
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
}

