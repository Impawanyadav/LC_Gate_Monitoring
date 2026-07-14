// Global variables for pagination
let currentGateLogs = [];
let displayedCount = 0;
const logsPerPage = 100;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gateId = urlParams.get('id');

    if (gateId) {
        // Update Title and Navigation
        document.getElementById('dynamicTitle').innerText = 'Historical Logs: Gate No. ' + gateId;
        document.getElementById('backToGateBtn').href = 'gate.html?id=' + gateId;
        
        // Fetch and display logs
        initGateLogs(gateId);
    } else {
        document.getElementById('dynamicTitle').innerText = 'Error: No Gate Selected';
    }

    // Attach event listener to the "Load More" button
    document.getElementById('showMoreBtn').addEventListener('click', loadMoreLogs);
});

async function initGateLogs(id) {
    try {
        const response = await fetch(`/api/analytics/${id}`);
        const data = await response.json();
        
        // Reverse so the newest logs show at the top of the table
        currentGateLogs = data.reverse(); 
        
        // Pre-calculate durations for all 1000 logs instantly
        calculateDurations();
        
        document.getElementById('logsTableBody').innerHTML = ''; // Clear "Loading..." message
        loadMoreLogs();
    } catch (error) {
        console.error("Error fetching logs:", error);
        document.getElementById('logsTableBody').innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load data from server.</td></tr>';
    }
}

// Lightning fast duration math (WITH INDIAN DATE FIX)
function calculateDurations() {
    for (let i = 1; i < currentGateLogs.length; i++) {
        let startLog = currentGateLogs[i]; 
        let endLog = currentGateLogs[i-1]; 
        
        // Use the custom parser instead of standard new Date()
        let startTime = parseIndianDate(startLog.date, startLog.time);
        let endTime = parseIndianDate(endLog.date, endLog.time);
        
        if (!isNaN(startTime) && !isNaN(endTime)) {
            let diffMs = endTime - startTime;
            let diffMins = Math.floor(diffMs / 60000);
            
            // Prevent negative durations if data comes in slightly out of order
            if (diffMins < 0) diffMins = 0; 
            
            if (diffMins < 60) {
                startLog.duration = `${diffMins} min`;
            } else {
                let hrs = Math.floor(diffMins / 60);
                let mins = diffMins % 60;
                startLog.duration = `${hrs} hr ${mins} min`;
            }
        } else {
            startLog.duration = '-';
        }
    }
    
    // The very first log (newest) is the current state
    if (currentGateLogs.length > 0) {
        currentGateLogs[0].duration = '<span style="color: #10b981; font-weight: bold;">Current State</span>';
    }
}

// HELPER: Converts "14/07/26" & "19:02:53" into a format JS understands perfectly
// HELPER: Converts dates and times safely, ignoring single-digit formatting issues
function parseIndianDate(dateStr, timeStr) {
    if (!dateStr || !timeStr) return NaN;
    
    // Parse Date
    let dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return NaN;
    
    let day = parseInt(dateParts[0], 10);
    let month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-11
    let year = parseInt(dateParts[2], 10);
    
    if (year < 100) {
        year += 2000; // Convert 26 to 2026
    }
    
    // Parse Time
    let timeParts = timeStr.split(':');
    let hours = parseInt(timeParts[0] || 0, 10);
    let minutes = parseInt(timeParts[1] || 0, 10);
    let seconds = parseInt(timeParts[2] || 0, 10);
    
    // This method bypasses string formatting and creates a perfect date object
    return new Date(year, month, day, hours, minutes, seconds);
}

function loadMoreLogs() {
    const tbody = document.getElementById('logsTableBody');
    const nextBatch = currentGateLogs.slice(displayedCount, displayedCount + logsPerPage);
    
    nextBatch.forEach(log => {
        const row = `<tr>
            <td>${log.date || '-'}</td>
            <td>${log.time || '-'}</td>
            <td><span class="status-badge">${log.status || '-'}</span></td>
            <td>${log.duration || '-'}</td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    
    displayedCount += nextBatch.length;
    
    // Hide "Load More" if we reached the end of the logs
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
        showMoreBtn.style.display = (displayedCount >= currentGateLogs.length || currentGateLogs.length === 0) ? 'none' : 'block';
    }
}