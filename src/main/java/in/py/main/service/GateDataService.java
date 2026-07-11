package in.py.main.service;

import in.py.main.dto.GateLog;
import jakarta.annotation.PostConstruct;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GateDataService {
	@Value("${railway.sheet.url}")
    private String SHEET_URL;

    //private final String SHEET_URL = "";

   
    private final SimpMessagingTemplate messagingTemplate;
    private List<GateLog> latestDataCache = new ArrayList<>();
    @PostConstruct
    public void loadDataOnStartup() {
        fetchAndBroadcastData();
    }

    // Run this method automatically every 10 seconds (10000 ms)
    @Scheduled(fixedRate = 20000)
    public void fetchAndBroadcastData() {
        List<GateLog> allLogs = new ArrayList<>();

        try {
            URL url = new URL(SHEET_URL);
            BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()));
            String line;
            boolean isFirstRow = true;

            while ((line = reader.readLine()) != null) {
                if (isFirstRow) { isFirstRow = false; continue; }

                String[] columns = line.split(",");
                if (columns.length >= 4) {
                    String gateId = columns[0].trim();
                    if (gateId.matches("\\d+")) {
                        allLogs.add(new GateLog(gateId, columns[1].trim(), columns[2].trim(), columns[3].trim()));
                    }
                }
            }
            reader.close();
            this.latestDataCache = allLogs;
            // Blast the final array to the frontend!
            messagingTemplate.convertAndSend("/topic/gatelogs", allLogs);
            log.info("Successfully fetched and broadcasted {} gate logs.", allLogs.size());
            
        } catch (Exception e) {
            log.error("Failed to fetch data: " + e.getMessage());
        }
    }
    public List<GateLog> getLatestDataCache() {
        return latestDataCache;}
}