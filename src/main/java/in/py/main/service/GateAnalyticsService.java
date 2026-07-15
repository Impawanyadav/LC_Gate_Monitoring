package in.py.main.service;

import in.py.main.dto.GateAnalyticsDTO;

public interface GateAnalyticsService {
	GateAnalyticsDTO calculateGateAnalytics(String gateId, String filter);
}