package in.py.main.controller;

import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import in.py.main.dto.GateAnalyticsDTO;
import in.py.main.service.GateDataService;
import in.py.main.service.GateLogFilterService;
import in.py.main.service.GateAnalyticsService; // NEW

import java.util.Map;
import in.py.main.dto.GateLog;
import java.util.List;

@RestController
@AllArgsConstructor
public class GateDataController {

    private final GateDataService gateDataService;
    private final GateAnalyticsService gateAnalyticsService; // NEW
    private final GateLogFilterService gateLogFilterService;

    @GetMapping("/api/initial-data")
    public Map<String, Object> getInitialData() {
        return gateDataService.getLastBroadcastedPayload();
    }
    
    @GetMapping("/api/analytics/{gateId}")
    public GateAnalyticsDTO getGateAnalytics(
            @PathVariable String gateId, 
            @RequestParam(defaultValue = "all") String filter) {
        
        
        return gateAnalyticsService.calculateGateAnalytics(gateId, filter);
    }

    // UPDATED: Now returns the pre-calculated math, not raw logs
   /* @GetMapping("/api/analytics/{gateId}")
    public GateAnalyticsDTO getGateAnalytics(
            @PathVariable String gateId, 
            @RequestParam(defaultValue = "all") String filter) { // NEW PARAMETER
        return gateAnalyticsService.calculateGateAnalytics(gateId, filter);
    }*/
    
    @GetMapping("/api/logs/{gateId}")
    public List<GateLog> getGateLogs(
            @PathVariable String gateId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "all") String duration,
            @RequestParam(defaultValue = "all") String timeOfDay,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        // Hands off all logic to the Backend Service
        return gateLogFilterService.getFilteredLogs(
                gateId, fromDate, toDate, status, duration, timeOfDay, page, size
        );
    }
}