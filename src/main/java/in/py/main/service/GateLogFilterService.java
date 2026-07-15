package in.py.main.service;

import in.py.main.dto.GateLog;
import java.util.List;

public interface GateLogFilterService {
    List<GateLog> getFilteredLogs(
            String gateId, 
            String fromDate, 
            String toDate, 
            String status, 
            String durationFilter, 
            String timeOfDay, 
            int page, 
            int size
    );
}
