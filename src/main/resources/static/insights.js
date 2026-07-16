document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gateId = urlParams.get('id');
    const filterDropdown = document.getElementById('timeFilter');

    if (gateId) {
        document.getElementById('dynamicTitle').innerText = 'Advanced Analytics: LC Gate  ' + gateId;
        document.getElementById('backToGateBtn').href = 'gate.html?id=' + gateId;
        
        // NEW LOGIC: Determine the station name based on the Gate ID
        let stationName = "";
        if (gateId === '111' || gateId === '114' || gateId === '115') {
            stationName = "Gauriganj";
        } else if (gateId === '193' || gateId === '194') {
            stationName = "Mohanlalganj";
        }
        
        // Inject the station name into the subtitle tag
        if (stationName) {
            document.getElementById('stationSubtitle').innerText = 'Station: ' + stationName;
        }
        
        // 1. Initial load using the default dropdown value
        fetchAndRenderInsights(gateId, filterDropdown.value);

        // 2. IMPORTANT: Listen for changes to the dropdown
        filterDropdown.addEventListener('change', (event) => {
            fetchAndRenderInsights(gateId, event.target.value);
        });
    } else {
        document.getElementById('dynamicTitle').innerText = 'Error: No Gate Selected';
    }
});

// GLOBAL VARIABLES to store chart instances so we can destroy them
let dayNightChartInstance = null;
let dayOfWeekChartInstance = null;

async function fetchAndRenderInsights(id, filter) {
    try {
        // CORRECT: Sends the filter as a URL query parameter
        const response = await fetch(`/api/analytics/${id}?filter=${filter}`);
        const data = await response.json(); 
        
        if (!data || data.avgOpenTime === undefined) return;

        // 1. Render KPIs
        document.getElementById('avgOpenTime').innerText = data.avgOpenTime + ' min';
        document.getElementById('avgCloseTime').innerText = data.avgCloseTime + ' min';
        
        let maxBlockageText = data.maxBlockageTime + ' min';
        if (data.maxBlockageTime >= 60) {
            let hrs = Math.floor(data.maxBlockageTime / 60);
            let mins = data.maxBlockageTime % 60;
            maxBlockageText = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
        }
        document.getElementById('maxBlockageTime').innerText = maxBlockageText;
        document.getElementById('dailyClosures').innerText = data.dailyClosures;

        // 2. Render Downtime Progress Bar
        document.getElementById('progressBar').style.width = data.openPercent + '%';
        document.getElementById('openPercentText').innerText = `Open: ${data.openPercent}%`;
        document.getElementById('closePercentText').innerText = `Closed: ${data.closePercent}%`;

        // 3. Render Charts (with .destroy() to clear previous data)
        renderDayNightChart(data.dayCount, data.nightCount);
        renderDayOfWeekChart(data.dayOfWeekCounts);

    } catch (error) {
        console.error("Error fetching insights data:", error);
    }
}

function renderDayNightChart(dayCount, nightCount) {
    const ctx = document.getElementById('dayNightChart').getContext('2d');
    if (dayNightChartInstance) dayNightChartInstance.destroy();
    
    dayNightChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Daytime (6 AM - 6 PM)', 'Nighttime (6 PM - 6 AM)'],
            datasets: [{
                data: [dayCount, nightCount],
                backgroundColor: ['#f59e0b', '#1e293b'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
    });
}

function renderDayOfWeekChart(dayOfWeekCounts) {
    if(!dayOfWeekCounts) return;
    const orderedDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dataValues = orderedDays.map(day => dayOfWeekCounts[day] || 0);

    const ctx = document.getElementById('dayOfWeekChart').getContext('2d');
    if (dayOfWeekChartInstance) dayOfWeekChartInstance.destroy();

    dayOfWeekChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: orderedDays,
            datasets: [{
                label: 'Total Operations',
                data: dataValues,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}