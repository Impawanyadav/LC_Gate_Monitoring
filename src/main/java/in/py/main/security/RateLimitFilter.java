package in.py.main.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final LoginAttemptService loginAttemptService;

    public RateLimitFilter(LoginAttemptService loginAttemptService) {
        this.loginAttemptService = loginAttemptService;
    }

    // Helper method to extract the REAL IP behind Render's proxy
    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0].trim();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        if (request.getRequestURI().equals("/login") && request.getMethod().equalsIgnoreCase("POST")) {
            
            // Extract the true IP
            String ip = getClientIP(request);
            
            if (loginAttemptService.isBlocked(ip)) {
                System.out.println("🛡️ BLOCKED request from locked IP: " + ip);
                
                // Bounce them to the locked URL
                response.sendRedirect("/login.html?error=locked");
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }
}