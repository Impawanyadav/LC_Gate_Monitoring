package in.py.main.controller;

import in.py.main.dto.GateLog;
import in.py.main.service.GateDataService;
import lombok.AllArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
@AllArgsConstructor
@RestController
public class GateDataController {

    
    private final GateDataService gateDataService;

    // This endpoint reads the server's RAM instantly without hitting Google Sheets
    @GetMapping("/api/initial-data")
    public List<GateLog> getInitialData() {
        return gateDataService.getLatestDataCache();
    }
}