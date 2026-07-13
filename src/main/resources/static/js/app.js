let stompClient = null;
let latestGateLogs = {}; 

document.addEventListener("DOMContentLoaded", function() {
    
    // 1. INITIAL LOAD: Handle the new dual-payload format
    fetch('/api/initial-data')
        .then(response => response.json())
        .then(data => {
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
        console.log('Connected to SCADA WebSocket');

        stompClient.subscribe('/topic/gatelogs', function (message) {
            let payload = JSON.parse(message.body);
            // Pass BOTH arrays to the dashboard updater
            updateDashboard(payload.currentStates, payload.history);
        });
    }, function(error) {
        console.error("WebSocket connection lost. Retrying...", error);
        setTimeout(connectWebSocket, 5000); 
    });
}

// UPGRADED: Now handles hours if duration exceeds 60 minutes
function formatTimeDifference(startTimestamp, endTimestamp) {
    let diffMs = endTimestamp - startTimestamp;
    if (diffMs < 0) diffMs = 0; 
    
    let diffHrs = Math.floor(diffMs / 3600000); 
    let diffMins = Math.floor((diffMs % 3600000) / 60000);
    let diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffHrs > 0) {
        return `${diffHrs}h ${diffMins}m ${diffSecs}s`;
    } else {
        return `${diffMins}m ${diffSecs}s`;
    }
}

// Reusable Date Shield: Protects against corrupted hardware math
function parseLogTimestamp(log) {
    let dateParts = log.date.split(/[-/]/); 
    let timeParts = log.time.split(':');
    
    if (dateParts.length >= 3 && timeParts.length >= 2) {
        let year = 2000 + parseInt(dateParts[2]); 
        let seconds = timeParts[2] ? parseInt(timeParts[2]) : 0; 
        let timestamp = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]), seconds).getTime();
        
        if (!isNaN(timestamp)) return timestamp;
    }
    console.warn("Ignored log with corrupted date/time:", log);
    return null;
}

function updateDashboard(currentStates, historyLogs) {
    const tableBody = document.getElementById("master-log-table");
    tableBody.innerHTML = ""; 
    latestGateLogs = {}; 

    // --- 1. GUARANTEED CARD UPDATES (From currentStates) ---
    currentStates.forEach(log => {
        let timestamp = parseLogTimestamp(log);
        if (timestamp) {
            log.timestamp = timestamp;
            latestGateLogs[log.gateId] = log; 
        }
    });

    // --- 2. THE HISTORY TABLE CLEANER (From historyLogs) ---
    let cleanHistoryArray = [];
    let previousStatusTracker = {};
    let gateHistory = {};
    const validGates = ["111", "114", "115", "193", "194"]; 

    historyLogs.forEach(log => {
        let timestamp = parseLogTimestamp(log);
        if (!timestamp) return; // Drop bad logs
        log.timestamp = timestamp;

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
        let tableActionText = 'Duration';

        if (index < history.length - 1) {
            // HISTORICAL LOG
            let nextLog = history[index + 1];
            let timeFormatted = formatTimeDifference(log.timestamp, nextLog.timestamp);
            durationStr = `${tableActionText} ${timeFormatted}`;
        } else {
            // LATEST LOG IN HISTORY
            let timeFormatted = formatTimeDifference(log.timestamp, Date.now());
            durationStr = `<span class="live-duration text-primary fw-bold" data-timestamp="${log.timestamp}" data-status="${log.status}">
                ${tableActionText} ${timeFormatted}
            </span>`;
        }

        let row = `<tr>
            <td class="fw-bold">${log.gateId}</td>
            <td><span class="badge ${log.status === 'OPEN' ? 'bg-success' : 'bg-danger'}">${log.status}</span></td>
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
        let timeFormatted = formatTimeDifference(log.timestamp, now);
        
        let cardElement = document.getElementById(`card-${gateId}`);
        let statusElement = document.getElementById(`status-${gateId}`);
        let timeElement = document.getElementById(`time-${gateId}`);

        if (cardElement && statusElement && timeElement) {
            statusElement.innerText = log.status;
            timeElement.innerText = `Duration ${timeFormatted}`;
            
            if (log.status === 'OPEN') {
                cardElement.className = "status-card bg-open h-100";
            } else {
                cardElement.className = "status-card bg-closed h-100";
            }
        }
    }

    let liveTableCells = document.querySelectorAll('.live-duration');
    liveTableCells.forEach(cell => {
        let ts = parseInt(cell.getAttribute('data-timestamp'));
        let timeFormatted = formatTimeDifference(ts, now);
        cell.innerText = `Duration ${timeFormatted}`;
    });
}

setInterval(() => {
    updateLiveCards();
}, 1000);