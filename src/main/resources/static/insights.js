document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gateId = urlParams.get('id');

    if (gateId) {
        document.getElementById('dynamicTitle').innerText = 'Advanced Analytics: Gate No. ' + gateId;
        document.getElementById('backToGateBtn').href = 'gate.html?id=' + gateId;
        fetchAndRenderInsights(gateId);
    } else {
        document.getElementById('dynamicTitle').innerText = 'Error: No Gate Selected';
    }
});

async function fetchAndRenderInsights(id) {
    try {
        const response = await fetch(`/api/analytics/${id}`);
        const data = await response.json();
        
        if (data.length === 0) return;

        calculateAllMetrics(data);

    } catch (error) {
        console.error("Error fetching insights data:", error);
    }
}

function calculateAllMetrics(logs) {
    let openDurations = [];
    let closeDurations = [];
    let maxBlockage = 0;
    let totalOpenMinutes = 0;
    let totalCloseMinutes = 0;
    let uniqueDays = new Set();
    
    let dayNightCounts = { day: 0, night: 0 };
    let dayOfWeekCounts = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalClosures = 0;

    // Explicitly sort the data chronologically (Oldest to Newest).
    logs.sort((a, b) => parseIndianDate(a.date, a.time) - parseIndianDate(b.date, b.time));

    // Loop through chronologically to calculate differences between events
    for (let i = 0; i < logs.length - 1; i++) {
        let startLog = logs[i];      // The older event (State starts)
        let endLog = logs[i+1];      // The newer event (State ends)

        let startTime = parseIndianDate(startLog.date, startLog.time);
        let endTime = parseIndianDate(endLog.date, endLog.time);

        uniqueDays.add(startLog.date);

        if (!isNaN(startTime) && !isNaN(endTime)) {
            let diffMins = Math.floor((endTime - startTime) / 60000);
            
            // Because we sorted it, diffMins will always be positive!
            if (diffMins >= 0) {
                // Trim added to strip any accidental spaces from Google Sheets
                let status = startLog.status.trim().toUpperCase(); 

                if (status === 'OPEN') {
                    openDurations.push(diffMins);
                    totalOpenMinutes += diffMins;
                } else if (status === 'CLOSE') {
                    closeDurations.push(diffMins);
                    totalCloseMinutes += diffMins;
                    totalClosures++;
                    
                    if (diffMins > maxBlockage) {
                        maxBlockage = diffMins;
                    }
                }
            }

            // Day vs Night (Day = 6 AM to 6 PM)
            let hour = startTime.getHours();
            if (hour >= 6 && hour < 18) {
                dayNightCounts.day++;
            } else {
                dayNightCounts.night++;
            }

            // Day of Week Traffic
            let dayName = daysArr[startTime.getDay()];
            dayOfWeekCounts[dayName]++;
        }
    }

    // 1. Render KPIs
    const getAvg = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    
    document.getElementById('avgOpenTime').innerText = getAvg(openDurations) + ' min';
    document.getElementById('avgCloseTime').innerText = getAvg(closeDurations) + ' min';
    
    // Formatting Max Blockage Time into hours and minutes
    let maxBlockageText = maxBlockage + ' min';
    if (maxBlockage >= 60) {
        let hrs = Math.floor(maxBlockage / 60);
        let mins = maxBlockage % 60;
        maxBlockageText = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
    }
    document.getElementById('maxBlockageTime').innerText = maxBlockageText;
    
    let daysTracked = uniqueDays.size > 0 ? uniqueDays.size : 1;
    document.getElementById('dailyClosures').innerText = Math.round(totalClosures / daysTracked);

    // 2. Render Downtime Progress Bar
    let totalMinutes = totalOpenMinutes + totalCloseMinutes;
    if (totalMinutes > 0) {
        let openPercent = Math.round((totalOpenMinutes / totalMinutes) * 100);
        let closePercent = 100 - openPercent;
        
        document.getElementById('progressBar').style.width = openPercent + '%';
        document.getElementById('openPercentText').innerText = `Open: ${openPercent}%`;
        document.getElementById('closePercentText').innerText = `Closed: ${closePercent}%`;
    }

    // 3. Render Charts
    renderDayNightChart(dayNightCounts);
    renderDayOfWeekChart(dayOfWeekCounts);
}

function renderDayNightChart(counts) {
    const ctx = document.getElementById('dayNightChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Daytime (6 AM - 6 PM)', 'Nighttime (6 PM - 6 AM)'],
            datasets: [{
                data: [counts.day, counts.night],
                backgroundColor: ['#f59e0b', '#1e293b'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, // Forces chart to respect container height
            cutout: '65%' 
        }
    });
}

function renderDayOfWeekChart(counts) {
    const ctx = document.getElementById('dayOfWeekChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: 'Total Operations',
                data: Object.values(counts),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Forces chart to respect container height
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

// Our flawless mathematical Indian Date Parser
function parseIndianDate(dateStr, timeStr) {
    if (!dateStr || !timeStr) return NaN;
    let dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return NaN;
    
    let day = parseInt(dateParts[0], 10);
    let month = parseInt(dateParts[1], 10) - 1;
    let year = parseInt(dateParts[2], 10);
    if (year < 100) year += 2000;
    
    let timeParts = timeStr.split(':');
    let hours = parseInt(timeParts[0] || 0, 10);
    let minutes = parseInt(timeParts[1] || 0, 10);
    let seconds = parseInt(timeParts[2] || 0, 10);
    
    return new Date(year, month, day, hours, minutes, seconds);
}