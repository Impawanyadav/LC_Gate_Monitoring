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
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
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

    // Thread-safe store for Analytics (Holds up to 2000 logs per gate)
    private Map<String, LinkedList<GateLog>> fullAnalyticsStore = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadDataOnStartup() {
        fetchAndBroadcastData();
    }

    @Scheduled(fixedRate = 40000)
    public void fetchAndBroadcastData() {
        // Global Recent 100 Logs (as requested)
        LinkedList<GateLog> rollingLogs = new LinkedList<>();
        
        // HashMap for Current Active State of each gate
        Map<String, GateLog> currentStates = new HashMap<>();
        
        // HashMap for the Latest 5 Logs per Gate (as requested)
        Map<String, LinkedList<GateLog>> latestFivePerGate = new HashMap<>();
        
        // Analytics store for the REST API
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
                        GateLog logEntry = new GateLog();
                        logEntry.setGateId(gateId);
                        logEntry.setStatus(columns[1].trim());
                        logEntry.setDate(columns[2].trim());
                        logEntry.setTime(columns[3].trim());

                        // --- THE MAGIC: CALCULATE DURATION BY REFERENCE ---
                        // Get the previous log for this gate before we overwrite it
                        GateLog prevLog = currentStates.get(gateId);
                        if (prevLog != null) {
                            LocalDateTime prevDt = parseDateTime(prevLog.getDate(), prevLog.getTime());
                            LocalDateTime currDt = parseDateTime(logEntry.getDate(), logEntry.getTime());
                            
                            if (!prevDt.equals(LocalDateTime.MIN) && !currDt.equals(LocalDateTime.MIN)) {
                                long diffMins = Math.abs(Duration.between(prevDt, currDt).toMinutes());
                                prevLog.setDurationMins(diffMins);
                                prevLog.setDuration(formatDuration(diffMins));
                            }
                        }

                        // 1. Update Current States (this log is now the newest)
                        currentStates.put(gateId, logEntry);
                        
                        // 2. Global Rolling Logs (Max 100 drop logic)
                        rollingLogs.add(logEntry);
                        if (rollingLogs.size() > 100) {
                            rollingLogs.removeFirst();
                        }
                        
                        // 3. HashMap for Latest 5 Gate Logs
                        latestFivePerGate.computeIfAbsent(gateId, k -> new LinkedList<>()).add(logEntry);
                        if (latestFivePerGate.get(gateId).size() > 5) {
                            latestFivePerGate.get(gateId).removeFirst();
                        }

                        // 4. Gate-Specific Analytics (Max 2000 per gate)
                        tempAnalytics.computeIfAbsent(gateId, k -> new LinkedList<>()).add(logEntry);
                        if (tempAnalytics.get(gateId).size() > 2000) {
                            tempAnalytics.get(gateId).removeFirst();
                        }
                    }
                }
            }
            reader.close();
            
            // --- SET "CURRENT STATE" FOR THE ACTIVE LOGS ---
            // After reading all rows, the logs left in currentStates are the active ones.
            for (GateLog activeLog : currentStates.values()) {
                activeLog.setDurationMins(0);
                activeLog.setDuration("Current State"); // Frontend JavaScript will turn this into a live ticking clock!
            }
            
            // Safely overwrite the main analytics store
            this.fullAnalyticsStore = new ConcurrentHashMap<>(tempAnalytics);
            
            // Build the Payload for the Live Dashboard (`index.html`)
            Map<String, Object> payload = new HashMap<>();
            payload.put("currentStates", currentStates.values()); 
            
            // Reverse rolling logs so the absolute newest logs are at the top of the frontend table
            Collections.reverse(rollingLogs);
            payload.put("history", rollingLogs); 
            
            // Add latest 5 per gate just in case the frontend needs it
            payload.put("latestFive", latestFivePerGate);

            this.lastBroadcastedPayload = payload;

            messagingTemplate.convertAndSend("/topic/gatelogs", (Object) payload);
            log.info("Broadcasted states for {} gates and {} history logs.", currentStates.size(), rollingLogs.size());
            
        } catch (Exception e) {
            log.error("Failed to fetch data: " + e.getMessage());
        }
    }

    public Map<String, Object> getLastBroadcastedPayload() {
        return lastBroadcastedPayload;
    }

    public List<GateLog> getGateHistory(String gateId) {
        return fullAnalyticsStore.getOrDefault(gateId, new LinkedList<>());
    }
    
    // --- HELPER METHODS ---
    private LocalDateTime parseDateTime(String dateStr, String timeStr) {
        try {
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yy");
            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("H:mm:ss");
            String t = timeStr.split(":").length == 2 ? timeStr + ":00" : timeStr;
            return LocalDateTime.of(LocalDate.parse(dateStr, dateFormatter), LocalTime.parse(t, timeFormatter));
        } catch (Exception e) { return LocalDateTime.MIN; }
    }

    private String formatDuration(long diffMins) {
        if (diffMins < 60) return diffMins + " min";
        long hrs = diffMins / 60;
        long mins = diffMins % 60;
        return hrs + " hr " + mins + " min";
    }
}