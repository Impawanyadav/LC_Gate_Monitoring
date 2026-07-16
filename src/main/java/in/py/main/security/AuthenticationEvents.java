/*package in.py.main.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class AuthenticationEvents {

    private final LoginAttemptService loginAttemptService;

    public AuthenticationEvents(LoginAttemptService loginAttemptService) {
        this.loginAttemptService = loginAttemptService;
    }

    // Helper method to extract the REAL IP behind Render's proxy
    private String getClientIP() {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        String xfHeader = request.getHeader("X-Forwarded-For");
        
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr(); // Fallback for local testing
        }
        // Proxies can append multiple IPs, the first one is the original client
        return xfHeader.split(",")[0].trim();
    }

    @EventListener
    public void onFailure(AuthenticationFailureBadCredentialsEvent event) {
        String ip = getClientIP();
        loginAttemptService.loginFailed(ip);
        
        System.out.println("❌ FAILED LOGIN");
    }

    @EventListener
    public void onSuccess(AuthenticationSuccessEvent event) {
        String ip = getClientIP();
        loginAttemptService.loginSucceeded(ip);
        
       
    }
}*/