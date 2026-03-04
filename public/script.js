document.addEventListener('DOMContentLoaded', () => {
    let globalData = [];

    async function fetchLiveData() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Network response was not ok');
            globalData = await response.json();

            processKPIs(globalData);
            processTasks(globalData);
            renderCandidates('all');
        } catch (error) {
            console.error("Could not fetch live sheet data via proxy.", error);
            document.getElementById('kpi-grid').innerHTML = '<p style="color:red; font-weight:bold;">Error: Make sure the Node server (server.js) is running on port 3000.</p>';
        }
    }

    // Navigation Logic
    const dashLink = document.getElementById('nav-dashboard');
    const candLink = document.getElementById('nav-candidates');
    const dashView = document.getElementById('dashboard-view');
    const candView = document.getElementById('candidates-view');

    dashLink.addEventListener('click', (e) => {
        e.preventDefault();
        dashView.style.display = 'block';
        candView.style.display = 'none';
        dashLink.classList.add('active');
        candLink.classList.remove('active');
    });

    candLink.addEventListener('click', (e) => {
        e.preventDefault();
        dashView.style.display = 'none';
        candView.style.display = 'block';
        candLink.classList.add('active');
        dashLink.classList.remove('active');
        renderCandidates('all');
    });

    // KPI and Task processing remains the same basically
    function processKPIs(data) {
        const totalCandidates = data.length;
        let llmQualified = 0, videoCallsAttempted = 0, videoWatchedCount = 0, interviewsCompleted = 0, aiRecommended = 0, humanApproved = 0, totalRejected = 0, onHold = 0, meetingsBooked = 0;

        data.forEach(row => {
            const score = parseFloat(row['LLM Resume Score'] || 0);
            if (score >= 7.0) llmQualified++;
            if (row['R1 Call Date']) videoCallsAttempted++;
            if (row['Video Watched'] === 'Yes') videoWatchedCount++;
            if (row['R1 Outcome'] === 'Completed') interviewsCompleted++;
            if (row['AI Recommendation'] === 'Proceed') aiRecommended++;
            if (row['Human Decision'] === 'Approve') humanApproved++;
            if (row['Status'] === 'Disqualified' || row['Status'] === 'R1 Rejected' || row['Human Decision'] === 'Reject') totalRejected++;
            if (row['Status'] === 'On Hold' || row['Human Decision'] === 'Hold') onHold++;
            if (row['Final Meeting Date/Time']) meetingsBooked++;
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
            { title: "Time to Meeting Booked", value: "2.4h", subtitle: "Avg time from application" }
        ];
        renderKPIs(kpis);
    }

    function processTasks(data) {
        let callsToday = [], followUps = [];
        data.forEach(row => {
            if (row['R1 Schedule Date'] || row['Final Meeting Date/Time']) {
                const time = row['Final Meeting Date/Time'] || row['R1 Schedule Date'] || 'Today';
                if (callsToday.length < 5 && row['Full Name']) {
                    callsToday.push({ name: row['Full Name'], agent: row['Final Meeting Date/Time'] ? "Final Human Meeting" : "Agent 2 - Interview", time: time.substring(0, 16) || "Scheduled" });
                }
            }
            if (row['R1 Outcome'] === 'No Answer' && followUps.length < 4) {
                followUps.push({ name: row['Full Name'], status: "No Answer (Attempt 1)" });
            } else if (row['Video Watched'] === 'No' && followUps.length < 4) {
                followUps.push({ name: row['Full Name'], status: "Video Not Watched" });
            }
        });
        if (callsToday.length === 0) callsToday = [{ name: "No calls scheduled", agent: "-", time: "-" }];
        if (followUps.length === 0) followUps = [{ name: "All caught up!", status: "0 tasks" }];
        renderTasks('calls-today-list', callsToday, true);
        renderTasks('follow-ups-list', followUps, false);
    }

    // Candidate Rendering & Filtering
    function renderCandidates(filterStatus) {
        const listContainer = document.getElementById('candidate-list');
        listContainer.innerHTML = '';

        const filtered = filterStatus === 'all'
            ? globalData
            : globalData.filter(c => c['Human Decision'] === filterStatus);

        filtered.forEach((c, index) => {
            const item = document.createElement('div');
            item.className = 'candidate-item';
            item.style.animationDelay = `${index * 0.03}s`;

            const statusClass = `status-${(c['Human Decision'] || 'pending').toLowerCase()}`;

            item.innerHTML = `
                <div class="candidate-info">
                    <h3>${c['Full Name']}</h3>
                    <p>${c['Location']} | ${c['Source']}</p>
                </div>
                <div class="candidate-actions">
                    <span class="status-label ${statusClass}">${c['Human Decision'] || 'In Review'}</span>
                    <button onclick="window.viewProfile('${c['ID']}')">View Profile</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCandidates(btn.dataset.filter);
        });
    });

    // Profile View (Attached to window for inline onclick)
    window.viewProfile = (id) => {
        const c = globalData.find(cand => cand['ID'] === id);
        if (!c) return;

        const modal = document.getElementById('profile-modal');
        const container = document.getElementById('modal-container');

        // Define important keys to show first
        const impKeys = ['Full Name', 'Email', 'Phone', 'Location', 'Status', 'LLM Resume Score', 'Human Decision'];

        let impHTML = '';
        let addHTML = '';

        // Generate key-value pairs
        Object.keys(c).forEach(key => {
            const val = c[key] || 'N/A';
            const html = `
                <div class="info-item">
                    <div class="info-key">${key}</div>
                    <div class="info-value">${val}</div>
                </div>
            `;
            if (impKeys.includes(key)) impHTML += html;
            else addHTML += html;
        });

        container.innerHTML = `
            <div class="profile-card">
                <h2>${c['Full Name']} <span style="font-size: 1rem; color: #888;">#${c['ID']}</span></h2>
                
                <div class="profile-section">
                    <h3>Core Information</h3>
                    <div class="info-grid">
                        ${impHTML}
                    </div>
                </div>

                <div class="profile-section">
                    <h3>Pipeline & Additional Details</h3>
                    <div class="info-grid">
                        ${addHTML}
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    };

    // Modal Close
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

    // Common Renderers
    function renderKPIs(kpis) {
        const grid = document.getElementById('kpi-grid');
        grid.innerHTML = '';
        kpis.forEach((kpi, index) => {
            const card = document.createElement('div');
            card.className = 'kpi-card';
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `<div class="kpi-title">${kpi.title}</div><div><div class="kpi-value">${kpi.value}</div><div class="kpi-subtitle">${kpi.subtitle}</div></div>`;
            grid.appendChild(card);
        });
    }

    function renderTasks(containerId, items, isCalls = false) {
        const list = document.getElementById(containerId);
        list.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'task-item';
            if (isCalls) li.innerHTML = `<div><strong>${item.name}</strong><br><span style="color: #666; font-size: 0.85rem;">${item.agent}</span></div><span class="task-badge">${item.time}</span>`;
            else li.innerHTML = `<div><strong>${item.name}</strong></div><span class="task-badge" style="background-color: #555;">${item.status}</span>`;
            list.appendChild(li);
        });
    }

    fetchLiveData();
    setInterval(fetchLiveData, 15000);
});
