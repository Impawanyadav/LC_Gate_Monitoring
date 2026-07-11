package in.py.main.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class GateLog {
	private String gateId;
    private String status;
    private String date;
    private String time;

}
