let stompClient = null;
let latestGateLogs = {}; 

document.addEventListener("DOMContentLoaded", function() {
    
    // 1. INITIAL LOAD: Instantly grab the server's RAM cache so the screen paints immediately
    fetch('/api/initial-data')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                updateDashboard(data);
            }
        })
        .catch(err => console.error("Could not fetch initial data", err));

    // 2. LIVE UPDATES: Open the WebSocket tunnel to listen for future broadcasts
    connectWebSocket();
});

function connectWebSocket() {
    let socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);

    // Disable debug logs in the console for a clean production look
    stompClient.debug = null; 

    stompClient.connect({}, function (frame) {
        console.log('Connected to SCADA WebSocket');

        // Subscribe to the broadcast channel
        stompClient.subscribe('/topic/gatelogs', function (message) {
            let liveDataArray = JSON.parse(message.body);
            updateDashboard(liveDataArray);
        });
    }, function(error) {
        console.error("WebSocket connection lost. Retrying...", error);
        // Auto-reconnect if the server restarts
        setTimeout(connectWebSocket, 5000); 
    });
}

// Reusable function to format milliseconds into "Xm Ys"
function formatTimeDifference(startTimestamp, endTimestamp) {
    let diffMs = endTimestamp - startTimestamp;
    if (diffMs < 0) diffMs = 0; // Safeguard against system clock drift
    
    let diffMins = Math.floor(diffMs / 60000);
    let diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    return `${diffMins}m ${diffSecs}s`;
}

function updateDashboard(rawGateLogsArray) {
    const tableBody = document.getElementById("master-log-table");
    tableBody.innerHTML = ""; 
    latestGateLogs = {}; 

    // --- 1. THE DATA SHIELD (Run this FIRST to drop corrupted hardware data) ---
    let bulletproofLogsArray = []; 

    rawGateLogsArray.forEach(log => {
        // Handle both slashes (10/07/26) and dashes (10-07-26) safely
        let dateParts = log.date.split(/[-/]/); 
        let timeParts = log.time.split(':');
        
        // Only attempt math if the string actually contained a date and time
        if (dateParts.length >= 3 && timeParts.length >= 2) {
            let year = 2000 + parseInt(dateParts[2]); 
            let seconds = timeParts[2] ? parseInt(timeParts[2]) : 0; // Default to 0 if seconds are missing
            
            let timestamp = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]), seconds).getTime();
            
            // Check if the math resulted in a real number, not NaN
            if (!isNaN(timestamp)) {
                log.timestamp = timestamp;
                bulletproofLogsArray.push(log); // It survived the shield! Keep it.
            } else {
                console.warn("Ignored log with corrupted date math:", log);
            }
        } else {
            console.warn("Ignored log with missing date/time format:", log);
        }
    });

    // --- 2. THE DATA CLEANER (Run this SECOND to filter duplicate states and bad IDs) ---
    let cleanLogsArray = [];
    let previousStatusTracker = {};
    let gateHistory = {};
    const validGates = ["111", "114", "115", "193", "194"]; 

    bulletproofLogsArray.forEach(log => {
        if (!validGates.includes(log.gateId)) return; 
        if (previousStatusTracker[log.gateId] === log.status) return; 

        // If it survives, track it and add it to our final clean arrays
        previousStatusTracker[log.gateId] = log.status;
        cleanLogsArray.push(log);
        
        if (!gateHistory[log.gateId]) gateHistory[log.gateId] = [];
        gateHistory[log.gateId].push(log);
    });
    // -------------------------------------------------------------------

    // Calculate Durations and Render the Master Table
    cleanLogsArray.forEach(log => {
        let history = gateHistory[log.gateId];
        let index = history.indexOf(log);
        
        let durationStr = "";
        let tableActionText = log.status === 'OPEN' ? 'Duration' : 'Duration';

        if (index < history.length - 1) {
            // HISTORICAL LOG: Subtract from the NEXT status log
            let nextLog = history[index + 1];
            let timeFormatted = formatTimeDifference(log.timestamp, nextLog.timestamp);
            durationStr = `${tableActionText} ${timeFormatted}`;
        } else {
            // LATEST LOG: Prepare to tick live against the computer's clock
            latestGateLogs[log.gateId] = log; 
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
        
        // Pushes newest logs to the very top of the table
        tableBody.insertAdjacentHTML('afterbegin', row);
    });

    // Instantly render cards so they don't wait for the 1-second interval
    updateLiveCards();
}

function updateLiveCards() {
    let now = Date.now();
    
    // 1. Update the Top Cards
    for (let gateId in latestGateLogs) {
        let log = latestGateLogs[gateId];
        let timeFormatted = formatTimeDifference(log.timestamp, now);
        
        let cardElement = document.getElementById(`card-${gateId}`);
        let statusElement = document.getElementById(`status-${gateId}`);
        let timeElement = document.getElementById(`time-${gateId}`);

        if (cardElement && statusElement && timeElement) {
            statusElement.innerText = log.status;
            
            let cardActionText = log.status === 'OPEN' ? 'Duration' : 'Duration';
            timeElement.innerText = `${cardActionText} ${timeFormatted}`;
            
            if (log.status === 'OPEN') {
                cardElement.className = "status-card bg-open h-100";
            } else {
                cardElement.className = "status-card bg-closed h-100";
            }
        }
    }

    // 2. Update the Latest Row in the Table
    let liveTableCells = document.querySelectorAll('.live-duration');
    liveTableCells.forEach(cell => {
        let ts = parseInt(cell.getAttribute('data-timestamp'));
        let status = cell.getAttribute('data-status');
        let timeFormatted = formatTimeDifference(ts, now);
        
        let tableActionText = status === 'OPEN' ? 'Duration' : 'Duration';
        cell.innerText = `${tableActionText} ${timeFormatted}`;
    });
}

// BACKGROUND LOOP: Ticks the live timers up automatically every 1,000 ms (1 second)
setInterval(() => {
    updateLiveCards();
}, 1000);