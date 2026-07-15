package in.py.main.service;

import in.py.main.dto.GateLog;
import in.py.main.dto.GateAnalyticsDTO;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class GateAnalyticsServiceImpl implements GateAnalyticsService {

    private final GateDataService gateDataService;

    public GateAnalyticsServiceImpl(GateDataService gateDataService) {
        this.gateDataService = gateDataService;
    }

    @Override
    public GateAnalyticsDTO calculateGateAnalytics(String gateId, String filter) {
        List<GateLog> allLogs = gateDataService.getGateHistory(gateId);
        GateAnalyticsDTO dto = new GateAnalyticsDTO();

        if (allLogs == null || allLogs.isEmpty()) {
            return dto;
        }

        // 1. DETERMINE THE CUTOFF DATE
        LocalDateTime cutoffDate;
        if (filter == null) filter = "all";
        switch (filter) {
            case "last_week": cutoffDate = LocalDateTime.now().minusDays(7); break;
            case "last_month": cutoffDate = LocalDateTime.now().minusDays(30); break;
            case "last_year": cutoffDate = LocalDateTime.now().minusYears(1); break;
            default: cutoffDate = LocalDateTime.MIN; break;
        }

        // 2. FILTER AND SORT
        List<GateLog> logs = new ArrayList<>();
        for (GateLog log : allLogs) {
            LocalDateTime logTime = parseDateTime(log);
            if (logTime != null && !logTime.equals(LocalDateTime.MIN) && logTime.isAfter(cutoffDate)) {
                logs.add(log);
            }
        }
        if (logs.isEmpty()) return dto;
        logs.sort(Comparator.comparing(this::parseDateTime));

        // 3. INITIALIZE VARIABLES
        long totalOpenMins = 0;
        long totalCloseMins = 0;
        long maxBlockage = 0;
        int totalClosures = 0;
        int dayCount = 0;
        int nightCount = 0;
        
        List<Long> openDurations = new ArrayList<>();
        List<Long> closeDurations = new ArrayList<>();
        Set<LocalDate> uniqueDays = new HashSet<>();
        Map<String, Integer> dayOfWeekCounts = new LinkedHashMap<>();
        String[] days = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
        for (String day : days) dayOfWeekCounts.put(day, 0);

        // 4. ROBUST STATE-CHANGE LOOP
        LocalDateTime stateStartTime = null;
        String currentState = null;

        for (GateLog currentLog : logs) {
            LocalDateTime currentTime = parseDateTime(currentLog);
            if (currentTime == null || currentTime.equals(LocalDateTime.MIN)) continue; 

            String status = currentLog.getStatus().trim().toUpperCase();
            if (status.equals("CLOSED")) status = "CLOSE";
            uniqueDays.add(currentTime.toLocalDate());

            // Initialize the very first state
            if (currentState == null) {
                currentState = status;
                stateStartTime = currentTime;
            } 
            // Only calculate duration if the state has CHANGED
            else if (!status.equals(currentState)) {
                long diffMins = Math.abs(Duration.between(stateStartTime, currentTime).toMinutes());
                
                if (diffMins < 1440) { // Safety cap: max 24 hours
                    if (currentState.equals("OPEN")) {
                        openDurations.add(diffMins);
                        totalOpenMins += diffMins;
                    } else if (currentState.equals("CLOSE")) {
                        closeDurations.add(diffMins);
                        totalCloseMins += diffMins;
                        totalClosures++;
                        if (diffMins > maxBlockage) maxBlockage = diffMins;
                    }
                }
                // Reset tracker for the new state
                currentState = status;
                stateStartTime = currentTime;
            }

            // Day/Night and Weekday operations (counted for every log to populate charts)
            int hour = currentTime.getHour();
            if (hour >= 6 && hour < 18) dayCount++;
            else nightCount++;
            String dayName = days[currentTime.getDayOfWeek().getValue() % 7];
            dayOfWeekCounts.put(dayName, dayOfWeekCounts.get(dayName) + 1);
        }

        // 5. POPULATE DTO
        dto.setAvgOpenTime(calculateAverage(openDurations));
        dto.setAvgCloseTime(calculateAverage(closeDurations));
        dto.setMaxBlockageTime(maxBlockage);
        
        // Use proper rounding for daily closures so 1 closure over 2 days doesn't become 0
        int daysTracked = Math.max(1, uniqueDays.size());
        dto.setDailyClosures((int) Math.round((double) totalClosures / daysTracked));

        long totalMinutes = totalOpenMins + totalCloseMins;
        if (totalMinutes > 0) {
            int openPct = (int) Math.round(((double) totalOpenMins / totalMinutes) * 100);
            dto.setOpenPercent(openPct);
            dto.setClosePercent(100 - openPct);
        }

        dto.setDayCount(dayCount);
        dto.setNightCount(nightCount);
        dto.setDayOfWeekCounts(dayOfWeekCounts);
        
        return dto;
    }

    private LocalDateTime parseDateTime(GateLog log) {
        try {
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yy");
            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("H:mm:ss"); 
            String timeStr = log.getTime().split(":").length == 2 ? log.getTime() + ":00" : log.getTime();
            return LocalDateTime.of(LocalDate.parse(log.getDate(), dateFormatter), LocalTime.parse(timeStr, timeFormatter));
        } catch (Exception e) { return LocalDateTime.MIN; }
    }

    private long calculateAverage(List<Long> list) {
        return list.isEmpty() ? 0 : list.stream().mapToLong(Long::longValue).sum() / list.size();
    }
}