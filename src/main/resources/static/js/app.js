let stompClient = null;
let latestGateLogs = {}; 

document.addEventListener("DOMContentLoaded", function() {
    fetch('/api/initial-data')
        .then(response => response.json())
        .then(data => {
            console.log("📥 Data from Backend:", data); // Check F12 Console if issues persist
            if (data && data.currentStates && data.history) {
                updateDashboard(data.currentStates, data.history);
            }
        })
        .catch(err => console.error("Could not fetch initial data", err));

    connectWebSocket();
});

function connectWebSocket() {
    let socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; 

    stompClient.connect({}, function (frame) {
        stompClient.subscribe('/topic/gatelogs', function (message) {
            let payload = JSON.parse(message.body);
            updateDashboard(payload.currentStates, payload.history);
        });
    }, function(error) {
        setTimeout(connectWebSocket, 5000); 
    });
}

function formatTimeDifference(startTimestamp, endTimestamp) {
    let diffMs = endTimestamp - startTimestamp;
    if (diffMs < 0) diffMs = 0; 
    
    let diffHrs = Math.floor(diffMs / 3600000); 
    let diffMins = Math.floor((diffMs % 3600000) / 60000);
    let diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m ${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
}

// 🛡️ AUTO-HEALING TRANSLATOR: Fixes Java field name mismatches automatically
function autoNormalizeLog(rawLog) {
    return {
        gateId: String(rawLog.gateId || rawLog.id || rawLog.GateId || rawLog.gate_id || "UNKNOWN"),
        status: String(rawLog.status || rawLog.state || rawLog.Status || rawLog.currentSignal || "UNKNOWN").toUpperCase(),
        date: String(rawLog.date || rawLog.Date || rawLog.localDate || ""),
        time: String(rawLog.time || rawLog.Time || rawLog.localTime || "")
    };
}

// 🛡️ BULLETPROOF DATE SHIELD: Will never crash, even on bad Google Sheet formats
function parseLogTimestamp(log) {
    if (!log.date || !log.time) return Date.now(); // Fallback to current time if missing

    try {
        let safeDate = log.date.replace(/\s+/g, '-'); // Fixes spaces in dates
        let dateParts = safeDate.split(/[-/]/); 
        let timeParts = log.time.split(':');
        
        if (dateParts.length >= 2 && timeParts.length >= 2) {
            // Auto-guess the year if Google Sheets left it out
            let year = dateParts.length === 3 ? 
                (dateParts[2].length === 2 ? 2000 + parseInt(dateParts[2]) : parseInt(dateParts[2])) 
                : new Date().getFullYear();
                
            let seconds = timeParts[2] ? parseInt(timeParts[2]) : 0; 
            let timestamp = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]), seconds).getTime();
            
            if (!isNaN(timestamp)) return timestamp;
        }
    } catch (e) {
        console.error("Date Shield caught an error:", e);
    }
    
    return Date.now(); // Force it to draw the UI even if the math fails
}

function updateDashboard(rawCurrentStates, rawHistoryLogs) {
    const tableBody = document.getElementById("master-log-table");
    tableBody.innerHTML = ""; 
    latestGateLogs = {}; 

    // --- 1. GUARANTEED CARD UPDATES ---
    rawCurrentStates.forEach(rawLog => {
        let log = autoNormalizeLog(rawLog); 
        log.timestamp = parseLogTimestamp(log);
        latestGateLogs[log.gateId] = log; 
    });

    // --- 2. THE HISTORY TABLE CLEANER ---
    let cleanHistoryArray = [];
    let previousStatusTracker = {};
    let gateHistory = {};
    const validGates = ["111", "114", "115", "193", "194"]; 

    rawHistoryLogs.forEach(rawLog => {
        let log = autoNormalizeLog(rawLog);
        log.timestamp = parseLogTimestamp(log);

        if (!validGates.includes(log.gateId)) return; 
        if (previousStatusTracker[log.gateId] === log.status) return; 

        previousStatusTracker[log.gateId] = log.status;
        cleanHistoryArray.push(log);
        
        if (!gateHistory[log.gateId]) gateHistory[log.gateId] = [];
        gateHistory[log.gateId].push(log);
    });

    // --- 3. RENDER THE MASTER TABLE ---
    cleanHistoryArray.forEach(log => {
        let history = gateHistory[log.gateId];
        let index = history.indexOf(log);
        
        let durationStr = "";
        if (index < history.length - 1) {
            let nextLog = history[index + 1];
            durationStr = `Duration ${formatTimeDifference(log.timestamp, nextLog.timestamp)}`;
        } else {
            durationStr = `<span class="live-duration text-primary fw-bold" data-timestamp="${log.timestamp}">
                Duration ${formatTimeDifference(log.timestamp, Date.now())}
            </span>`;
        }

        // Updated to use .includes() for safety against "CLOSE" vs "CLOSED"
        let badgeClass = log.status === 'OPEN' ? 'bg-success' : (log.status.includes('CLOSE') ? 'bg-danger' : 'bg-secondary');

        let row = `<tr>
            <td class="fw-bold">${log.gateId}</td>
            <td><span class="badge ${badgeClass}">${log.status}</span></td>
            <td>${log.date}</td>
            <td>${log.time}</td>
            <td>${durationStr}</td>
        </tr>`;
        
        tableBody.insertAdjacentHTML('afterbegin', row);
    });

    updateLiveCards();
}

function updateLiveCards() {
    let now = Date.now();
    
    for (let gateId in latestGateLogs) {
        let log = latestGateLogs[gateId];
        
        let cardElement = document.getElementById(`card-${gateId}`);
        let statusElement = document.getElementById(`status-${gateId}`);
        let timeElement = document.getElementById(`time-${gateId}`);

        if (cardElement && statusElement && timeElement) {
            
            // 🕒 24-HOUR INACTIVITY CHECK (24 hrs = 86,400,000 ms)
            let diffMs = now - log.timestamp;
            let isInactive = diffMs >= 86400000;

            if (isInactive) {
                // 1. Set text to INACTIVE
                statusElement.innerText = "INACTIVE";
                
                // 2. Wipe out the Date, Time, and Duration completely
                timeElement.innerHTML = ""; 
                
                // 3. Make the box greyed out
                cardElement.className = "status-card h-100 bg-light text-muted";
                
            } else {
                // ACTIVE GATE LOGIC
                statusElement.innerText = log.status;
                
                // Draw the Date, Time, and Duration
                timeElement.innerHTML = `
                    <div class="small opacity-75 mb-1 text-nowrap text-dark">
                        ${log.date || "No Date"} | ${log.time || "No Time"}
                    </div>
                    <div class="fw-bold">
                        Duration ${formatTimeDifference(log.timestamp, now)}
                    </div>
                `;
                
                // Paint the box Pure White
                if (log.status === 'OPEN' || log.status.includes('CLOSE')) {
                    cardElement.className = "status-card h-100 bg-white text-dark";
                } else {
                    cardElement.className = "status-card h-100 bg-light text-dark";
                }
            }
        }
    }

    let liveTableCells = document.querySelectorAll('.live-duration');
    liveTableCells.forEach(cell => {
        let ts = parseInt(cell.getAttribute('data-timestamp'));
        cell.innerText = `Duration ${formatTimeDifference(ts, now)}`;
    });
}

setInterval(() => {
    updateLiveCards();
}, 1000);