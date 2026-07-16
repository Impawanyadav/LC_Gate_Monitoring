let stompClient = null;
let latestGateLogs = {}; 

document.addEventListener("DOMContentLoaded", function() {
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
        stompClient.subscribe('/topic/gatelogs', function (message) {
            let payload = JSON.parse(message.body);
            updateDashboard(payload.currentStates, payload.history);
        });
    }, function(error) {
        setTimeout(connectWebSocket, 5000); 
    });
}

function parseLogTimestamp(dateStr, timeStr) {
    if (!dateStr || !timeStr) return Date.now(); 
    try {
        let safeDate = dateStr.replace(/\s+/g, '-'); 
        let dateParts = safeDate.split(/[-/]/); 
        let timeParts = timeStr.split(':');
        
        if (dateParts.length >= 2 && timeParts.length >= 2) {
            let year = dateParts.length === 3 ? 
                (dateParts[2].length === 2 ? 2000 + parseInt(dateParts[2]) : parseInt(dateParts[2])) 
                : new Date().getFullYear();
                
            let seconds = timeParts[2] ? parseInt(timeParts[2]) : 0; 
            let timestamp = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]), seconds).getTime();
            if (!isNaN(timestamp)) return timestamp;
        }
    } catch (e) {}
    return Date.now(); 
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

function updateDashboard(currentStates, historyLogs) {
    const tableBody = document.getElementById("master-log-table");
    tableBody.innerHTML = ""; 
    latestGateLogs = {}; 

    // Store states for live cards
    currentStates.forEach(log => {
        log.timestamp = parseLogTimestamp(log.date, log.time);
        latestGateLogs[log.gateId] = log; 
    });

    // Render historical logs in the table
    historyLogs.forEach(log => {
        let durationStr = log.duration || "-";
        
        if (durationStr === "Current State") {
            let ts = parseLogTimestamp(log.date, log.time);
            // Blue text for live ticking duration in the table
            durationStr = `<span class="live-duration text-primary fw-bold" data-timestamp="${ts}">
                ${formatTimeDifference(ts, Date.now())}
            </span>`;
        } else {
            durationStr = `${durationStr}`;
        }

        let statusText = log.status ? log.status.trim().toUpperCase() : "UNKNOWN";
        
        // STANDARD BADGES FIXED: OPEN = Red (bg-danger), CLOSE = Green (bg-success)
        let badgeClass = statusText === 'OPEN' ? 'bg-danger' : (statusText.includes('CLOSE') ? 'bg-success' : 'bg-secondary');

        let row = `<tr>
            <td class="fw-bold">${log.gateId}</td>
            <td><span class="badge ${badgeClass}">${log.status}</span></td>
            <td>${log.date}</td>
            <td>${log.time}</td>
            <td>${durationStr}</td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', row);
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
            let diffMs = now - log.timestamp;
            let isInactive = diffMs >= 86400000; // 24 hrs

            // Reset inline styles and classes
            statusElement.style.color = ""; 
            statusElement.classList.remove('text-danger', 'text-success', 'text-secondary');

            if (isInactive) {
                statusElement.innerText = "INACTIVE";
                timeElement.innerHTML = ""; 
                cardElement.className = "status-card h-100 text-muted";
                cardElement.style.backgroundColor = "#f8f9fa"; // Slight Grey for inactive
            } else {
                let statusText = log.status ? log.status.trim().toUpperCase() : "";
                statusElement.innerText = log.status;
                
                // SLIGHT BACKGROUND COLORS APPLIED HERE
                if (statusText === 'OPEN') {
                    statusElement.classList.add('text-danger');
                    cardElement.style.backgroundColor = "#ffebee"; // Slight Red
                    cardElement.className = "status-card h-100 text-dark"; 
                } else if (statusText.includes('CLOSE')) {
                    statusElement.classList.add('text-success');
                    cardElement.style.backgroundColor = "#e8f5e9"; // Slight Green
                    cardElement.className = "status-card h-100 text-dark"; 
                } else {
                    cardElement.style.backgroundColor = "#ffffff"; // Default White
                    cardElement.className = "status-card h-100 text-dark"; 
                }
                
                // Exactly as it was before: pure black/dark text
                timeElement.innerHTML = `
                    <div class="small opacity-75 mb-1 text-nowrap text-dark">
                        ${log.date || "No Date"} | ${log.time || "No Time"}
                    </div>
                    <div class="fw-bold text-dark">
                        ${formatTimeDifference(log.timestamp, now)}
                    </div>
                `;
            }
        }
    }

    // Keep table timers ticking
    let liveTableCells = document.querySelectorAll('.live-duration');
    liveTableCells.forEach(cell => {
        let ts = parseInt(cell.getAttribute('data-timestamp'));
        cell.innerText = `${formatTimeDifference(ts, now)}`;
    });
}

// Tick every 1 second
setInterval(() => {
    if (Object.keys(latestGateLogs).length > 0) {
        updateLiveCards();
    }
}, 1000);