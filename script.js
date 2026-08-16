// ========================================
// কনফিগারেশন
// ========================================
let config = {
    token: '',
    repo: '',
    path: 'data.json'
};

let topics = [];
let nextId = 1;
let currentSha = '';
let duplicateData = null;
let tempTopic = null;

// ========================================
// কনফিগ ম্যানেজমেন্ট
// ========================================
function saveConfig() {
    const token = document.getElementById('githubToken').value.trim();
    const repo = document.getElementById('repoName').value.trim();
    
    if (!token || !repo) {
        alert('⚠️ টোকেন এবং রিপোজিটরি নাম অবশ্যই দিতে হবে!');
        return;
    }
    
    config.token = token;
    config.repo = repo;
    
    localStorage.setItem('githubConfig', JSON.stringify(config));
    document.getElementById('statusMsg').textContent = '✅ কনফিগ সেভ হয়েছে!';
    document.getElementById('statusMsg').style.color = '#28a745';
    
    loadFromGitHub();
}

function loadConfig() {
    const saved = localStorage.getItem('githubConfig');
    if (saved) {
        try {
            config = JSON.parse(saved);
            document.getElementById('githubToken').value = config.token || '';
            document.getElementById('repoName').value = config.repo || '';
        } catch(e) {
            console.error('কনফিগ লোড ত্রুটি:', e);
        }
    }
}

// ========================================
// GitHub API - ডেটা লোড
// ========================================
async function loadFromGitHub() {
    if (!config.token || !config.repo) {
        alert('⚠️ আগে কনফিগ সেভ করুন!');
        return;
    }

    showStatus('⏳ GitHub থেকে ডেটা লোড হচ্ছে...', 'info');

    try {
        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 404) {
            topics = [];
            nextId = 1;
            currentSha = '';
            renderAll();
            showStatus('📭 কোনো ডেটা নেই। নতুন তৈরি করা হবে।', 'warning');
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        currentSha = data.sha;
        
        const content = atob(data.content);
        const jsonData = JSON.parse(content);
        
        topics = jsonData.topics || [];
        nextId = jsonData.nextId || 1;
        
        renderAll();
        showStatus(`✅ লোড সফল! ${topics.length} টি টপিক পাওয়া গেছে।`, 'success');
        
    } catch (error) {
        console.error('লোড ত্রুটি:', error);
        showStatus(`❌ লোড ব্যর্থ: ${error.message}`, 'error');
        
        if (topics.length === 0) {
            topics = [];
            renderAll();
        }
    }
}

// ========================================
// GitHub API - ডেটা সিঙ্ক
// ========================================
async function syncToGitHub() {
    if (!config.token || !config.repo) {
        alert('⚠️ আগে কনফিগ সেভ করুন!');
        return;
    }

    if (topics.length === 0) {
        alert('⚠️ সিঙ্ক করার মতো কোনো ডেটা নেই!');
        return;
    }

    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ সিঙ্কিং...';

    showStatus('⏳ GitHub-এ আপলোড হচ্ছে...', 'info');

    try {
        const data = { topics, nextId };
        const jsonString = JSON.stringify(data, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
        
        const body = {
            message: `Update data.json - ${new Date().toLocaleString('bn-BD')}`,
            content: base64Content,
            sha: currentSha || undefined
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        currentSha = result.content.sha;
        
        showStatus(`✅ সিঙ্ক সফল! ${new Date().toLocaleTimeString('bn-BD')}`, 'success');
        
    } catch (error) {
        console.error('সিঙ্ক ত্রুটি:', error);
        showStatus(`❌ সিঙ্ক ব্যর্থ: ${error.message}`, 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '☁️ সিঙ্ক';
    }
}

// ========================================
// ড্যাশবোর্ড আপডেট
// ========================================
function updateDashboard() {
    const total = topics.length;
    let totalQuestions = 0;
    let totalStudies = 0;
    let totalCapture = 0;
    let needsRevision = 0;
    let interviewReady = 0;
    let captureCount = 0;

    topics.forEach(t => {
        totalQuestions++;
        totalStudies += (t.studyCount || 0);
        if (t.captured) {
            totalCapture += t.captured;
            captureCount++;
        }
        if (t.knowledgeStatus === 'Needs Revision') needsRevision++;
        if (t.knowledgeStatus === 'Interview Ready') interviewReady++;
    });

    document.getElementById('totalTopics').textContent = total;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('totalStudies').textContent = totalStudies;
    document.getElementById('avgCapture').textContent = captureCount > 0 ? Math.round(totalCapture / captureCount) + '%' : '0%';
    document.getElementById('needsRevision').textContent = needsRevision;
    document.getElementById('interviewReady').textContent = interviewReady;
}

// ========================================
// ফ্রিকোয়েন্টলি স্টাডিয়েড আপডেট
// ========================================
function updateFrequentTopics() {
    const freqDiv = document.getElementById('frequentTopics');
    
    if (topics.length === 0) {
        freqDiv.innerHTML = '<span style="color:#999; font-size:14px;">কোনো ডেটা নেই</span>';
        return;
    }

    // সাজানো
    const sorted = [...topics].sort((a, b) => (b.studyCount || 0) - (a.studyCount || 0));
    const top5 = sorted.slice(0, 5).filter(t => t.studyCount > 0);
    
    if (top5.length === 0) {
        freqDiv.innerHTML = '<span style="color:#999; font-size:14px;">এখনো কোনো টপিক স্টাডি করা হয়নি</span>';
        return;
    }

    freqDiv.innerHTML = top5.map(t => `
        <span class="frequent-item">
            ${t.mainTopic} — <span class="count">${t.studyCount} times</span>
        </span>
    `).join('');
}

// ========================================
// রেন্ডার অল
// ========================================
function renderAll() {
    renderTable();
    updateDashboard();
    updateFrequentTopics();
}

// ========================================
// সার্চ
// ========================================
function searchTopics() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const difficultyFilter = document.getElementById('filterDifficulty').value;
    
    const filtered = topics.filter(t => {
        const matchText = t.mainTopic.toLowerCase().includes(query) ||
                         t.subTopic.toLowerCase().includes(query) ||
                         t.question.toLowerCase().includes(query) ||
                         (t.answer && t.answer.toLowerCase().includes(query));
        
        const matchStatus = statusFilter === 'all' || t.knowledgeStatus === statusFilter;
        const matchDifficulty = difficultyFilter === 'all' || t.difficulty === difficultyFilter;
        
        return matchText && matchStatus && matchDifficulty;
    });
    
    renderTable(filtered);
}

// ========================================
// টেবিল রেন্ডার
// ========================================
function renderTable(data = null) {
    const tbody = document.getElementById('tableBody');
    const items = data || topics;
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#999;">
            📭 কোনো টপিক পাওয়া যায়নি
        </td></tr>`;
        return;
    }
    
    tbody.innerHTML = items.map((t, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(t.mainTopic)}</strong></td>
            <td>${escapeHtml(t.subTopic)}</td>
            <td style="font-size:12px;">${escapeHtml(t.question)}</td>
            <td style="font-size:12px;">${escapeHtml(t.answer ? t.answer.substring(0, 60) + (t.answer.length > 60 ? '...' : '') : '—')}</td>
            <td><span class="status-badge status-${t.knowledgeStatus ? t.knowledgeStatus.replace(/ /g, '\\ ') : 'New'}">${t.knowledgeStatus || 'New'}</span></td>
            <td style="text-align:center; white-space:nowrap;">
                <span class="badge badge-info">${t.studyCount || 0}</span>
                <button onclick="incrementStudy(${t.id})" class="btn btn-warning" style="padding:2px 10px; font-size:11px;">+1</button>
            </td>
            <td style="text-align:center;">
                <span class="badge ${t.captured >= 80 ? 'badge-success' : t.captured >= 50 ? 'badge-warning' : 'badge-danger'}">${t.captured || 0}%</span>
            </td>
            <td class="actions">
                <button onclick="editTopic(${t.id})" class="btn btn-primary" style="padding:2px 10px;" title="এডিট">✏️</button>
                <button onclick="deleteTopic(${t.id})" class="btn btn-danger" style="padding:2px 10px;" title="ডিলিট">🗑️</button>
                <button onclick="viewDetails(${t.id})" class="btn btn-info" style="padding:2px 10px;" title="ডিটেইলস">📄</button>
            </td>
        </tr>
    `).join('');
}

// ========================================
// ডিটেইলস ভিউ
// ========================================
function viewDetails(id) {
    const topic = topics.find(t => t.id
