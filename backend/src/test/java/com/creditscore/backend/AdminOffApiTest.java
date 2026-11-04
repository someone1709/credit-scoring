package com.creditscore.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** With no key set, an empty key must not unlock anything. Its own database, since it's a separate setup. */
@TestPropertySource(properties = {"spring.datasource.url=jdbc:h2:mem:adminoff;MODE=MySQL;DB_CLOSE_DELAY=-1", "app.admin.key="})
class AdminOffApiTest extends ApiTestSupport {

    @Test
    void theRoutesDontExistWithoutAKey() throws Exception {
        mvc.perform(get("/api/v1/admin/lenders").contextPath("/api/v1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/admin/lenders").contextPath("/api/v1").header("X-Admin-Key", "")).andExpect(status().isNotFound());
    }
}
