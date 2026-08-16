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
    
    // অটো লোড
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
            // ফাইল নেই
            topics = [];
            nextId = 1;
            currentSha = '';
            renderTable();
            showStatus('📭 কোনো ডেটা নেই। নতুন তৈরি করা হবে।', 'warning');
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        currentSha = data.sha;
        
        // Base64 ডিকোড
        const content = atob(data.content);
        const jsonData = JSON.parse(content);
        
        topics = jsonData.topics || [];
        nextId = jsonData.nextId || 1;
        
        renderTable();
        showStatus(`✅ লোড সফল! ${topics.length} টি টপিক পাওয়া গেছে।`, 'success');
        
    } catch (error) {
        console.error('লোড ত্রুটি:', error);
        showStatus(`❌ লোড ব্যর্থ: ${error.message}`, 'error');
        
        // অফলাইনে লোকাল ডেটা দেখান
        if (topics.length === 0) {
            topics = [];
            renderTable();
        }
    }
}

// ========================================
// GitHub API - ডেটা সিঙ্ক (Push)
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
// স্ট্যাটাস বার
// ========================================
function showStatus(message, type) {
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    const colors = {
        info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' },
        success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
        warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' },
        error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' }
    };
    
    const style = colors[type] || colors.info;
    statusDiv.style.background = style.bg;
    statusDiv.style.border = `1px solid ${style.border}`;
    statusDiv.style.color = style.text;
    statusDiv.style.padding = '12px';
    statusDiv.style.borderRadius = '6px';
}

// ========================================
// টেবিল রেন্ডার
// ========================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    
    if (topics.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#999;">
            📭 এখনো কোনো টপিক যোগ করা হয়নি। উপরের ফর্ম দিয়ে যোগ করুন।
        </td></tr>`;
        return;
    }
    
    tbody.innerHTML = topics.map((t, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(t.mainTopic)}</strong></td>
            <td>${escapeHtml(t.subTopic)}</td>
            <td style="font-size:12px;">${escapeHtml(t.questions || '—')}</td>
            <td style="font-size:12px;">${escapeHtml(t.answer || '—')}</td>
            <td style="text-align:center; white-space:nowrap;">
                <span class="badge" style="background:#1a1a2e;">${t.studyCount || 0}</span>
                <button onclick="incrementStudy(${t.id})" class="btn btn-warning" style="padding:2px 10px; font-size:11px;">+1</button>
            </td>
            <td style="text-align:center;">
                <span class="badge" style="background:${getColor(t.captured)};">${t.captured || 0}%</span>
            </td>
            <td class="actions">
                <button onclick="editTopic(${t.id})" class="btn btn-primary" style="padding:2px 12px;" title="এডিট">✏️</button>
                <button onclick="deleteTopic(${t.id})" class="btn btn-danger" style="padding:2px 12px;" title="ডিলিট">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ========================================
// হেল্পার ফাংশন
// ========================================
function getColor(percent) {
    if (percent >= 80) return '#28a745';
    if (percent >= 50) return '#ffc107';
    return '#dc3545';
}

function escapeHtml(text) {
    if (!text) return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// CRUD অপারেশন (লোকাল)
// ========================================
function saveTopic() {
    const id = document.getElementById('editId').value;
    const topic = {
        mainTopic: document.getElementById('mainTopic').value.trim(),
        subTopic: document.getElementById('subTopic').value.trim(),
        questions: document.getElementById('questions').value.trim(),
        answer: document.getElementById('answer').value.trim(),
        source: document.getElementById('source').value.trim(),
        vivaRef: document.getElementById('vivaRef').value.trim(),
        remarks: document.getElementById('remarks').value.trim(),
        captured: parseInt(document.getElementById('captured').value) || 0
    };

    // ভ্যালিডেশন
    if (!topic.mainTopic || !topic.subTopic) {
        alert('⚠️ Main Topic এবং Sub-Topic অবশ্যই পূরণ করুন!');
        return;
    }

    if (id) {
        // এডিট মোড
        const index = topics.findIndex(t => t.id === parseInt(id));
        if (index !== -1) {
            topics[index] = { ...topics[index], ...topic };
        }
    } else {
        // নতুন যোগ
        topic.id = nextId++;
        topic.studyCount = 0;
        topic.dateCreated = new Date().toISOString().split('T')[0];
        topics.push(topic);
    }

    renderTable();
    resetForm();
    showStatus('✅ লোকালে সেভ হয়েছে। GitHub-এ সিঙ্ক করুন!', 'success');
}

function editTopic(id) {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;
    
    document.getElementById('editId').value = id;
    document.getElementById('mainTopic').value = topic.mainTopic;
    document.getElementById('subTopic').value = topic.subTopic;
    document.getElementById('questions').value = topic.questions || '';
    document.getElementById('answer').value = topic.answer || '';
    document.getElementById('source').value = topic.source || '';
    document.getElementById('vivaRef').value = topic.vivaRef || '';
    document.getElementById('remarks').value = topic.remarks || '';
    document.getElementById('captured').value = topic.captured || 0;
    
    document.getElementById('formTitle').textContent = '✏️ টপিক এডিট করুন';
    document.getElementById('saveBtn').textContent = '🔄 আপডেট করুন';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteTopic(id) {
    if (!confirm('⚠️ কি আপনি এই টপিক ডিলিট করতে চান?')) return;
    
    topics = topics.filter(t => t.id !== id);
    renderTable();
    showStatus('🗑️ ডিলিট হয়েছে। GitHub-এ সিঙ্ক করুন।', 'warning');
}

function incrementStudy(id) {
    const topic = topics.find(t => t.id === id);
    if (topic) {
        topic.studyCount = (topic.studyCount || 0) + 1;
        renderTable();
        showStatus('📈 স্টাডি কাউন্ট +১ হয়েছে। সিঙ্ক করুন!', 'info');
    }
}

function resetForm() {
    document.getElementById('editId').value = '';
    document.getElementById('mainTopic').value = '';
    document.getElementById('subTopic').value = '';
    document.getElementById('questions').value = '';
    document.getElementById('answer').value = '';
    document.getElementById('source').value = '';
    document.getElementById('vivaRef').value = '';
    document.getElementById('remarks').value = '';
    document.getElementById('captured').value = '';
    document.getElementById('formTitle').textContent = '➕ নতুন টপিক যোগ করুন';
    document.getElementById('saveBtn').textContent = '💾 সেভ করুন';
}

// ========================================
// পেজ লোড
// ========================================
window.onload = function() {
    loadConfig();
    // কনফিগ থাকলে অটো লোড
    if (config.token && config.repo) {
        loadFromGitHub();
    }
};
