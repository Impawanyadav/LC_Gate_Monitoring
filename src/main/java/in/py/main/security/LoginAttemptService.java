package in.py.main.security;

import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginAttemptService {

    private final int MAX_ATTEMPT = 5;
    private final long LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    
    private ConcurrentHashMap<String, Attempt> attemptsCache = new ConcurrentHashMap<>();

    public void loginSucceeded(String key) {
        attemptsCache.remove(key);
    }

    public void loginFailed(String key) {
        Attempt attempt = attemptsCache.getOrDefault(key, new Attempt(0, System.currentTimeMillis()));
        attempt.count++;
        attempt.lastModified = System.currentTimeMillis();
        attemptsCache.put(key, attempt);
    }

    public boolean isBlocked(String key) {
        Attempt attempt = attemptsCache.get(key);
        if (attempt != null) {
            if (System.currentTimeMillis() - attempt.lastModified > LOCKOUT_DURATION) {
                attemptsCache.remove(key); // 15 minutes passed, unlock
                return false;
            }
            return attempt.count >= MAX_ATTEMPT;
        }
        return false;
    }
    
    private static class Attempt {
        int count;
        long lastModified;
        
        public Attempt(int count, long lastModified) {
            this.count = count;
            this.lastModified = lastModified;
        }
    }
}