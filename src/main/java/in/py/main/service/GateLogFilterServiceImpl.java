package in.py.main.service;

import in.py.main.dto.GateLog;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GateLogFilterServiceImpl implements GateLogFilterService {

    private final GateDataService gateDataService;

    public GateLogFilterServiceImpl(GateDataService gateDataService) {
        this.gateDataService = gateDataService;
    }

    @Override
    public List<GateLog> getFilteredLogs(
            String gateId, String fromDate, String toDate,
            String status, String durationFilter, String timeOfDay,
            int page, int size) {

        List<GateLog> rawLogs = gateDataService.getGateHistory(gateId);
        if (rawLogs == null || rawLogs.isEmpty()) return Collections.emptyList();

        // 1. Sort chronologically (Oldest first) to accurately calculate durations
        List<GateLog> logs = new ArrayList<>(rawLogs);
        logs.sort(Comparator.comparing(this::parseDateTime));

        // 2. Calculate durations (time from current log to the next log)
        for (int i = 0; i < logs.size(); i++) {
            GateLog currentLog = logs.get(i);
            LocalDateTime currentDt = parseDateTime(currentLog);

            if (i < logs.size() - 1) {
                LocalDateTime nextDt = parseDateTime(logs.get(i + 1));
                long diffMins = Math.abs(Duration.between(currentDt, nextDt).toMinutes());
                
                currentLog.setDurationMins(diffMins);
                currentLog.setDuration(formatDuration(diffMins));
            } else {
                // The very last log is the current active state
                currentLog.setDurationMins(0);
                currentLog.setDuration("Current State");
            }
        }

        // 3. Reverse so Newest logs appear first
        Collections.reverse(logs);

        // 4. Apply Filters
        List<GateLog> filtered = logs.stream().filter(log -> {
            LocalDateTime logDt = parseDateTime(log);
            if (logDt.equals(LocalDateTime.MIN)) return false;

            // STATUS FILTER
            String logStatus = log.getStatus().trim().toUpperCase();
            if (logStatus.equals("CLOSED")) logStatus = "CLOSE";
            if (!status.equals("all") && !logStatus.equals(status.toUpperCase())) {
                return false;
            }

            // DATE RANGE FILTER
            LocalDate logDate = logDt.toLocalDate();
            if (fromDate != null && !fromDate.isEmpty()) {
                if (logDate.isBefore(LocalDate.parse(fromDate))) return false;
            }
            if (toDate != null && !toDate.isEmpty()) {
                if (logDate.isAfter(LocalDate.parse(toDate))) return false;
            }

            // TIME OF DAY FILTER
            if (!timeOfDay.equals("all")) {
                int hour = logDt.getHour();
                boolean isMorning = (hour >= 6 && hour < 18);
                if (timeOfDay.equals("morning") && !isMorning) return false;
                if (timeOfDay.equals("night") && isMorning) return false;
            }

            // DURATION FILTER
            if (!durationFilter.equals("all")) {
                long mins = log.getDurationMins();
                if (durationFilter.equals("<1") && mins >= 1) return false;
                if (durationFilter.equals("<10") && mins >= 10) return false;
                if (durationFilter.equals("<60") && mins >= 60) return false;
                if (durationFilter.equals(">60") && mins <= 60) return false;
            }

            return true;
        }).collect(Collectors.toList());

        // 5. Apply Pagination (Limit & Offset)
        int start = page * size;
        if (start >= filtered.size()) {
            return Collections.emptyList(); // Return empty array if page exceeds data
        }
        int end = Math.min(start + size, filtered.size());
        
        return filtered.subList(start, end);
    }

    private LocalDateTime parseDateTime(GateLog log) {
        try {
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yy");
            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("H:mm:ss");
            String timeStr = log.getTime().split(":").length == 2 ? log.getTime() + ":00" : log.getTime();
            return LocalDateTime.of(LocalDate.parse(log.getDate(), dateFormatter), LocalTime.parse(timeStr, timeFormatter));
        } catch (Exception e) { return LocalDateTime.MIN; }
    }

    private String formatDuration(long diffMins) {
        if (diffMins < 60) return diffMins + " min";
        long hrs = diffMins / 60;
        long mins = diffMins % 60;
        return hrs + " hr " + mins + " min";
    }
}