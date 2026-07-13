package in.py.main.controller;

import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import in.py.main.service.GateDataService;
import java.util.Map;

@RestController
@AllArgsConstructor
public class GateDataController {

    private final GateDataService gateDataService;

    
    @GetMapping("/api/initial-data")
    public Map<String, Object> getInitialData() {
        return gateDataService.getLastBroadcastedPayload();
    }
}