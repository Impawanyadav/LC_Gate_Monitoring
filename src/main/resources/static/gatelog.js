let currentPage = 0;
const pageSize = 50;
let currentGateId = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentGateId = urlParams.get('id');

    if (currentGateId) {
        document.getElementById('dynamicTitle').innerText = 'Activity Logs: LC Gate  ' + currentGateId;
        document.getElementById('backToGateBtn').href = 'gate.html?id=' + currentGateId;
        
        // NEW LOGIC: Determine the station name based on the Gate ID
        let stationName = "";
        if (currentGateId === '111' || currentGateId === '114' || currentGateId === '115') {
            stationName = "Gauriganj";
        } else if (currentGateId === '193' || currentGateId === '194') {
            stationName = "Mohanlalganj";
        }
        
        // Inject the station name into the subtitle tag
        if (stationName) {
            document.getElementById('stationSubtitle').innerText = 'Station: ' + stationName;
        }

        fetchLogs(true); // true means it's a fresh search (page 0)
    } else {
        document.getElementById('dynamicTitle').innerText = 'Error: No Gate Selected';
    }

    document.getElementById('showMoreBtn').addEventListener('click', () => fetchLogs(false));
    document.getElementById('applyFiltersBtn').addEventListener('click', () => fetchLogs(true));
});

async function fetchLogs(isNewSearch) {
    if (isNewSearch) {
        currentPage = 0;
        document.getElementById('logsTableBody').innerHTML = ''; // Clear table
    }

    // Grab values from filters
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const status = document.getElementById('filterStatus').value;
    const duration = document.getElementById('filterDuration').value;
    const timeOfDay = document.getElementById('filterTime').value;

    // Build the query URL
    let url = `/api/logs/${currentGateId}?page=${currentPage}&size=${pageSize}&status=${status}&duration=${duration}&timeOfDay=${timeOfDay}`;
    if (fromDate) url += `&fromDate=${fromDate}`;
    if (toDate) url += `&toDate=${toDate}`;

    try {
        const response = await fetch(url);
        const logs = await response.json();
        
        renderLogs(logs);

        // If the backend sent back fewer than 50 logs, we've hit the end of the database!
        const showMoreBtn = document.getElementById('showMoreBtn');
        if (logs.length < pageSize) {
            showMoreBtn.style.display = 'none';
        } else {
            showMoreBtn.style.display = 'block';
            currentPage++; // Advance to next page for the next click
        }
        
    } catch (error) {
        console.error("Error fetching logs:", error);
        if (isNewSearch) {
            document.getElementById('logsTableBody').innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load data from server.</td></tr>';
        }
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    
    if (logs.length === 0 && currentPage === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">No logs found matching your filters.</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        let statusText = log.status.trim().toUpperCase();
        if (statusText === 'CLOSED') statusText = 'CLOSE';
        
        let badgeStyle = statusText === 'OPEN' 
            ? 'background-color: #dbeafe; color: #1e40af;' 
            : 'background-color: #fee2e2; color: #991b1b;';
            
        // "Current State" text styling check
        let durationDisplay = log.duration === "Current State" 
            ? '<span style="color: #10b981; font-weight: bold;">Current State</span>' 
            : log.duration;

        const row = `<tr>
            <td>${log.date || '-'}</td>
            <td>${log.time || '-'}</td>
            <td><span class="status-badge" style="${badgeStyle}">${statusText}</span></td>
            <td>${durationDisplay}</td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}