document.addEventListener('DOMContentLoaded', () => {

    async function fetchLiveData() {
        try {
            // Fetching from our local Node.js proxy server
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            processKPIs(data);
            processTasks(data);
        } catch (error) {
            console.error("Could not fetch live sheet data via proxy.", error);
            document.getElementById('kpi-grid').innerHTML = '<p style="color:red; font-weight:bold;">Error: Make sure the Node server (server.js) is running on port 3000.</p>';
        }
    }

    function processKPIs(data) {
        const totalCandidates = data.length;

        let llmQualified = 0;
        let videoCallsAttempted = 0;
        let videoWatchedCount = 0;
        let interviewsCompleted = 0;
        let aiRecommended = 0;
        let humanApproved = 0;
        let totalRejected = 0;
        let onHold = 0;
        let meetingsBooked = 0;

        data.forEach(row => {
            // Field Maps
            const score = parseFloat(row['LLM Resume Score'] || 0);
            const r1Date = row['R1 Call Date'];
            const r1Outcome = row['R1 Outcome'];
            const videoWatched = row['Video Watched'];
            const aiRec = row['AI Recommendation'];
            const humanDec = row['Human Decision'];
            const status = row['Status'];
            const finalMeeting = row['Final Meeting Date/Time'];

            if (score >= 7.0) llmQualified++;
            if (r1Date) videoCallsAttempted++;
            if (videoWatched === 'Yes') videoWatchedCount++;
            if (r1Outcome === 'Completed') interviewsCompleted++;
            if (aiRec === 'Proceed') aiRecommended++;
            if (humanDec === 'Approve') humanApproved++;
            if (status === 'Disqualified' || status === 'R1 Rejected' || humanDec === 'Reject') totalRejected++;
            if (status === 'On Hold' || humanDec === 'Hold') onHold++;
            if (finalMeeting) meetingsBooked++;
        });

        const dropOffRate = totalCandidates > 0 ? Math.round(((totalCandidates - meetingsBooked) / totalCandidates) * 100) + '%' : '0%';

        const kpis = [
            { title: "Total Candidates Sourced", value: totalCandidates, subtitle: "Total entries in CRM" },
            { title: "LLM Qualified (Score ≥ 7)", value: llmQualified, subtitle: Math.round((llmQualified / totalCandidates) * 100 || 0) + "% Pass Rate" },
            { title: "Video Calls Attempted", value: videoCallsAttempted, subtitle: "Agent 1 Outbound" },
            { title: "Video Confirmed Watched", value: videoWatchedCount, subtitle: Math.round((videoWatchedCount / videoCallsAttempted) * 100 || 0) + "% of connected" },
            { title: "Interviews Completed", value: interviewsCompleted, subtitle: Math.round((interviewsCompleted / videoWatchedCount) * 100 || 0) + "% completion rate" },
            { title: "AI Recommended Proceed", value: aiRecommended, subtitle: Math.round((aiRecommended / interviewsCompleted) * 100 || 0) + "% of completed calls" },
            { title: "Human Approved", value: humanApproved, subtitle: Math.round((humanApproved / aiRecommended) * 100 || 0) + "% human agree rate" },
            { title: "Total Rejected", value: totalRejected, subtitle: "Across all funnel stages" },
            { title: "On Hold", value: onHold, subtitle: "Candidates parked by human" },
            { title: "Final Meetings Booked", value: meetingsBooked, subtitle: Math.round((meetingsBooked / humanApproved) * 100 || 0) + "% human approved" },
            { title: "Drop-off Rate by Stage", value: dropOffRate, subtitle: "Overall funnel leak" },
            { title: "Time to Meeting Booked", value: "2.4h", subtitle: "Avg time from application (est.)" }
        ];

        renderKPIs(kpis);
    }

    function processTasks(data) {
        // Today & Follow up logic
        let callsToday = [];
        let followUps = [];

        data.forEach(row => {
            // Find anyone with upcoming valid meetings / calls
            // Just sorting generic R1 or Final meetings roughly into a list for demo
            if (row['R1 Schedule Date'] || row['Final Meeting Date/Time']) {
                const time = row['Final Meeting Date/Time'] || row['R1 Schedule Date'] || 'Today';
                if (callsToday.length < 5 && row['Full Name']) {
                    callsToday.push({
                        name: row['Full Name'],
                        agent: row['Final Meeting Date/Time'] ? "Final Human Meeting" : "Agent 2 - Interview",
                        time: time.substring(0, 16) || "Scheduled"
                    });
                }
            }

            // Find follow-ups: Status No Answer or Not completed
            if (row['R1 Outcome'] === 'No Answer' && followUps.length < 4) {
                followUps.push({
                    name: row['Full Name'],
                    status: "No Answer (Attempt 1)"
                });
            } else if (row['Video Watched'] === 'No' && followUps.length < 4) {
                followUps.push({
                    name: row['Full Name'],
                    status: "Video Not Watched"
                });
            }
        });

        // Fallbacks if data empty
        if (callsToday.length === 0) callsToday = [{ name: "No calls scheduled", agent: "-", time: "-" }];
        if (followUps.length === 0) followUps = [{ name: "All caught up!", status: "0 tasks" }];

        renderTasks('calls-today-list', callsToday, true);
        renderTasks('follow-ups-list', followUps, false);
    }

    function renderKPIs(kpis) {
        const grid = document.getElementById('kpi-grid');
        grid.innerHTML = '';
        kpis.forEach((kpi, index) => {
            const card = document.createElement('div');
            card.className = 'kpi-card';
            card.style.animationDelay = `${index * 0.05}s`;

            card.innerHTML = `
                <div class="kpi-title">${kpi.title}</div>
                <div>
                    <div class="kpi-value">${kpi.value}</div>
                    <div class="kpi-subtitle">${kpi.subtitle}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function renderTasks(containerId, items, isCalls = false) {
        const list = document.getElementById(containerId);
        list.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'task-item';

            if (isCalls) {
                li.innerHTML = `
                    <div>
                        <strong>${item.name}</strong><br>
                        <span style="color: #666; font-size: 0.85rem;">${item.agent}</span>
                    </div>
                    <span class="task-badge">${item.time}</span>
                `;
            } else {
                li.innerHTML = `
                    <div>
                        <strong>${item.name}</strong>
                    </div>
                    <span class="task-badge" style="background-color: #555;">${item.status}</span>
                `;
            }
            list.appendChild(li);
        });
    }

    // Initialize UI
    fetchLiveData();

    // Auto-refresh every 15 seconds
    setInterval(fetchLiveData, 15000);
});
