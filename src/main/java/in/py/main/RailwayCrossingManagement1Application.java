package in.py.main;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling  
public class RailwayCrossingManagement1Application {

	public static void main(String[] args) {
		SpringApplication.run(RailwayCrossingManagement1Application.class, args);
	}

}
