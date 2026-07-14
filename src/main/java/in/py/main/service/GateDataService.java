package in.py.main.service;

import in.py.main.dto.GateLog;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class GateDataService {
    
    @Value("${railway.sheet.url}")
    private String SHEET_URL;

    private final SimpMessagingTemplate messagingTemplate;
    
    private Map<String, Object> lastBroadcastedPayload = new HashMap<>();

    // NEW: Thread-safe store for Analytics (Holds up to 1000 logs per gate)
    private Map<String, LinkedList<GateLog>> fullAnalyticsStore = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadDataOnStartup() {
        fetchAndBroadcastData();
    }

    @Scheduled(fixedRate = 20000)
    public void fetchAndBroadcastData() {
        LinkedList<GateLog> rollingLogs = new LinkedList<>();
        Map<String, GateLog> currentStates = new HashMap<>();
        
        // NEW: Temporary map to build the analytics data during this read cycle
        Map<String, LinkedList<GateLog>> tempAnalytics = new HashMap<>();

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
                        GateLog logEntry = new GateLog(gateId, columns[1].trim(), columns[2].trim(), columns[3].trim());
                        
                        // 1. Update Live Dashboard State
                        currentStates.put(gateId, logEntry);
                        
                        // 2. Global Rolling Logs (Max 100 for the WebSocket)
                        rollingLogs.add(logEntry);
                        if (rollingLogs.size() > 100) {
                            rollingLogs.removeFirst();
                        }

                        // 3. NEW: Gate-Specific Analytics (Max 1000 per gate)
                        tempAnalytics.computeIfAbsent(gateId, k -> new LinkedList<>()).add(logEntry);
                        if (tempAnalytics.get(gateId).size() > 2000) {
                            tempAnalytics.get(gateId).removeFirst(); // Drop the oldest log
                        }
                    }
                }
            }
            reader.close();
            
            // Safely overwrite the main analytics store so the REST API can serve it instantly
            this.fullAnalyticsStore = new ConcurrentHashMap<>(tempAnalytics);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("currentStates", currentStates.values()); 
            payload.put("history", rollingLogs); 

            this.lastBroadcastedPayload = payload;

            messagingTemplate.convertAndSend("/topic/gatelogs", (Object) payload);
            log.info("Broadcasted states for {} unique gates and {} history logs.", currentStates.size(), rollingLogs.size());
            
        } catch (Exception e) {
            log.error("Failed to fetch data: " + e.getMessage());
        }
    }

    public Map<String, Object> getLastBroadcastedPayload() {
        return lastBroadcastedPayload;
    }

    // NEW: Method for your AnalyticsController to fetch the 1000 logs instantly
    public List<GateLog> getGateHistory(String gateId) {
        return fullAnalyticsStore.getOrDefault(gateId, new LinkedList<>());
    }
}