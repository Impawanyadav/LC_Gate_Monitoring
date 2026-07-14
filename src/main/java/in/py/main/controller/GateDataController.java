package in.py.main.controller;

import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import in.py.main.dto.GateLog;
import in.py.main.service.GateDataService;

import java.util.List;
import java.util.Map;

@RestController
@AllArgsConstructor
public class GateDataController {

    private final GateDataService gateDataService;

    // Existing Live Dashboard Endpoint
    @GetMapping("/api/initial-data")
    public Map<String, Object> getInitialData() {
        return gateDataService.getLastBroadcastedPayload();
    }

    // NEW: Analytics Endpoint for 1000 logs per specific gate
    @GetMapping("/api/analytics/{gateId}")
    public List<GateLog> getGateAnalytics(@PathVariable String gateId) {
        return gateDataService.getGateHistory(gateId);
    }
}