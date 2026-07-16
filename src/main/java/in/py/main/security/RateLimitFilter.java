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

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // Only trigger this check on POST requests to /login
        if (request.getRequestURI().equals("/login") && request.getMethod().equalsIgnoreCase("POST")) {
            if (loginAttemptService.isBlocked(request.getRemoteAddr())) {
                // Redirect them with a special 'locked' parameter
                response.sendRedirect("/login.html?error=locked");
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }
}