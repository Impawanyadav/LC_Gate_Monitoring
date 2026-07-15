package in.py.main.dto;

import lombok.Data;
import java.util.Map;

@Data
public class GateAnalyticsDTO {
    private long avgOpenTime;
    private long avgCloseTime;
    private long maxBlockageTime;
    private long dailyClosures;
    private int openPercent;
    private int closePercent;
    private int dayCount;
    private int nightCount;
    private Map<String, Integer> dayOfWeekCounts;
}
