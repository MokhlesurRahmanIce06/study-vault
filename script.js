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
let filteredTopics = [];
let isSyncing = false;

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
// GitHub API - অটো সিঙ্ক (স্বয়ংক্রিয়)
// ========================================
async function autoSyncToGitHub(operation = '') {
    // কনফিগ চেক
    if (!config.token || !config.repo) {
        console.warn('⚠️ কনফিগ সেট করা নেই, সিঙ্ক হচ্ছে না');
        return false;
    }

    // যদি ইতিমধ্যে সিঙ্ক চলছে
    if (isSyncing) {
        console.log('⏳ ইতিমধ্যে সিঙ্ক চলছে, অপেক্ষা করুন...');
        return false;
    }

    // যদি কোনো ডেটা না থাকে
    if (topics.length === 0) {
        console.log('📭 সিঙ্ক করার মতো কোনো ডেটা নেই');
        return false;
    }

    isSyncing = true;
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ সিঙ্কিং...';

    try {
        const data = { topics, nextId };
        const jsonString = JSON.stringify(data, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
        
        const body = {
            message: `${operation} - ${new Date().toLocaleString('bn-BD')}`,
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
        
        showStatus(`✅ ${operation} সফল! ${new Date().toLocaleTimeString('bn-BD')}`, 'success');
        return true;
        
    } catch (error) {
        console.error('সিঙ্ক ত্রুটি:', error);
        showStatus(`❌ সিঙ্ক ব্যর্থ: ${error.message}`, 'error');
        return false;
    } finally {
        isSyncing = false;
        syncBtn.disabled = false;
        syncBtn.textContent = '☁️ সিঙ্ক';
    }
}

// ========================================
// ম্যানুয়াল সিঙ্ক (যদি প্রয়োজন হয়)
// ========================================
async function syncToGitHub() {
    await autoSyncToGitHub('ম্যানুয়াল সিঙ্ক');
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
// রেন্ডার অল (অটো সিঙ্ক সহ)
// ========================================
function renderAll(operation = '') {
    applyFilters();
    updateDashboard();
    updateFrequentTopics();
    
    // অটো সিঙ্ক - শুধুমাত্র যদি ডেটা থাকে এবং কনফিগ সেট করা থাকে
    if (topics.length > 0 && config.token && config.repo) {
        // ডিবাউন্স - 500ms পর সিঙ্ক হবে (একাধিক কল এড়াতে)
        clearTimeout(window._syncTimeout);
        window._syncTimeout = setTimeout(() => {
            autoSyncToGitHub(operation || 'ডেটা আপডেট');
        }, 500);
    }
}

// ========================================
// ফিল্টার অ্যাপ্লাই
// ========================================
function applyFilters() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const difficultyFilter = document.getElementById('filterDifficulty').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    filteredTopics = topics.filter(t => {
        const matchText = t.mainTopic.toLowerCase().includes(query) ||
                         t.subTopic.toLowerCase().includes(query) ||
                         t.question.toLowerCase().includes(query) ||
                         (t.answer && t.answer.toLowerCase().includes(query));
        
        const matchStatus = statusFilter === 'all' || t.knowledgeStatus === statusFilter;
        const matchDifficulty = difficultyFilter === 'all' || t.difficulty === difficultyFilter;
        
        let matchDate = true;
        if (dateFrom || dateTo) {
            const createdDate = t.dateCreated ? t.dateCreated.split(' ')[0] : '';
            if (dateFrom && createdDate < dateFrom) matchDate = false;
            if (dateTo && createdDate > dateTo) matchDate = false;
        }
        
        return matchText && matchStatus && matchDifficulty && matchDate;
    });
    
    renderTable(filteredTopics);
}

// ========================================
// ডেট রেঞ্জ ক্লিয়ার
// ========================================
function clearDateFilter() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    applyFilters();
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
                <button onclick="openEditModal(${t.id})" class="btn btn-primary" style="padding:2px 10px;" title="এডিট">✏️</button>
                <button onclick="deleteTopic(${t.id})" class="btn btn-danger" style="padding:2px 10px;" title="ডিলিট">🗑️</button>
                <button onclick="openStudyView(${t.id})" class="btn btn-info" style="padding:2px 10px;" title="স্টাডি ভিউ">📖</button>
            </td>
        </tr>
    `).join('');
}

// ========================================
// ডিটেইলস ভিউ
// ========================================
function viewDetails(id) {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;
    
    const details = `
📚 Main Topic: ${topic.mainTopic}
📖 Sub Topic: ${topic.subTopic}
❓ Question: ${topic.question}
✅ Answer: ${topic.answer || 'N/A'}
📊 Status: ${topic.knowledgeStatus || 'New'}
📈 Capture: ${topic.captured || 0}%
💪 Confidence: ${topic.confidence || 0}%
📖 Study Count: ${topic.studyCount || 0}
📅 Created: ${topic.dateCreated || 'N/A'}
📅 Last Studied: ${topic.lastStudied || 'N/A'}
🔄 Version: ${topic.version || 1}
📂 Source: ${topic.source || 'N/A'}
🔗 Viva Ref: ${topic.vivaRef || 'N/A'}
🔗 Related: ${topic.relatedTopics || 'N/A'}
💬 Remarks: ${topic.remarks || 'N/A'}
⭐ Difficulty: ${topic.difficulty || 'Medium'}
📋 Study Type: ${topic.studyType || 'Learn'}
    `;
    
    alert(details);
}

// ========================================
// হেল্পার ফাংশন
// ========================================
function escapeHtml(text) {
    if (!text) return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCurrentDateTime() {
    return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

// ========================================
// MODAL অপেন/ক্লোজ
// ========================================
function openAddModal() {
    document.getElementById('modalTitle').textContent = '➕ নতুন টপিক যোগ করুন';
    document.getElementById('saveBtn').textContent = '💾 সেভ করুন';
    resetModalForm();
    document.getElementById('topicModal').style.display = 'block';
}

function openEditModal(id) {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;
    
    document.getElementById('modalTitle').textContent = '✏️ টপিক এডিট করুন';
    document.getElementById('saveBtn').textContent = '🔄 আপডেট করুন';
    
    document.getElementById('editId').value = id;
    document.getElementById('mainTopic').value = topic.mainTopic;
    document.getElementById('subTopic').value = topic.subTopic;
    document.getElementById('question').value = topic.question;
    document.getElementById('answer').value = topic.answer || '';
    document.getElementById('studyType').value = topic.studyType || 'Learn';
    document.getElementById('studyCount').value = topic.studyCount || 0;
    document.getElementById('lastStudied').value = topic.lastStudied || '';
    document.getElementById('source').value = topic.source || '';
    document.getElementById('vivaRef').value = topic.vivaRef || '';
    document.getElementById('captured').value = topic.captured || 0;
    document.getElementById('confidence').value = topic.confidence || 0;
    document.getElementById('difficulty').value = topic.difficulty || 'Medium';
    document.getElementById('knowledgeStatus').value = topic.knowledgeStatus || 'New';
    document.getElementById('remarks').value = topic.remarks || '';
    document.getElementById('relatedTopics').value = topic.relatedTopics || '';
    document.getElementById('version').value = topic.version || 1;
    
    document.getElementById('topicModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('topicModal').style.display = 'none';
    resetModalForm();
}

function resetModalForm() {
    document.getElementById('editId').value = '';
    document.getElementById('mainTopic').value = '';
    document.getElementById('subTopic').value = '';
    document.getElementById('question').value = '';
    document.getElementById('answer').value = '';
    document.getElementById('studyType').value = 'Learn';
    document.getElementById('studyCount').value = '0';
    document.getElementById('lastStudied').value = '';
    document.getElementById('source').value = '';
    document.getElementById('vivaRef').value = '';
    document.getElementById('captured').value = '';
    document.getElementById('confidence').value = '';
    document.getElementById('difficulty').value = 'Medium';
    document.getElementById('knowledgeStatus').value = 'New';
    document.getElementById('remarks').value = '';
    document.getElementById('relatedTopics').value = '';
    document.getElementById('version').value = '1';
}

// ========================================
// ডুপ্লিকেট ডিটেকশন
// ========================================
function checkDuplicate(question, mainTopic) {
    const normalized = question.toLowerCase().trim();
    const topicNormalized = mainTopic.toLowerCase().trim();
    
    const existing = topics.find(t => 
        t.question.toLowerCase().trim() === normalized &&
        t.mainTopic.toLowerCase().trim() === topicNormalized
    );
    
    return existing || null;
}

function showDuplicateAlert(existing, newData) {
    duplicateData = existing;
    tempTopic = newData;
    
    document.getElementById('duplicateModal').style.display = 'block';
    document.getElementById('duplicateInfo').innerHTML = `
        <strong>Existing:</strong> ${existing.mainTopic} → ${existing.question}<br>
        <strong>Studied:</strong> ${existing.studyCount || 0} times<br>
        <strong>Status:</strong> ${existing.knowledgeStatus || 'New'}<br>
        <strong>Capture:</strong> ${existing.captured || 0}%
    `;
}

function closeDuplicateAlert() {
    document.getElementById('duplicateModal').style.display = 'none';
    duplicateData = null;
    tempTopic = null;
}

function studyExisting() {
    if (duplicateData) {
        incrementStudy(duplicateData.id);
        closeDuplicateAlert();
        closeModal();
        showStatus('📖 Existing topic studied! Count +1', 'success');
    }
}

function addAsVariant() {
    if (tempTopic) {
        tempTopic.question = tempTopic.question + ' (Variant)';
        tempTopic.id = nextId++;
        tempTopic.studyCount = 0;
        tempTopic.dateCreated = getCurrentDateTime();
        topics.push(tempTopic);
        renderAll('ভ্যারিয়েন্ট যোগ');
        closeDuplicateAlert();
        closeModal();
        showStatus('✅ Added as new variant!', 'success');
    }
}

function updateExisting() {
    if (duplicateData && tempTopic) {
        const index = topics.findIndex(t => t.id === duplicateData.id);
        if (index !== -1) {
            topics[index] = { 
                ...topics[index], 
                answer: tempTopic.answer || topics[index].answer,
                version: (topics[index].version || 1) + 1,
                lastUpdated: getCurrentDateTime()
            };
            renderAll('এক্সিস্টিং আপডেট');
            closeDuplicateAlert();
            closeModal();
            showStatus('✅ Existing topic updated!', 'success');
        }
    }
}

function createNew() {
    if (tempTopic) {
        tempTopic.id = nextId++;
        tempTopic.studyCount = 0;
        tempTopic.dateCreated = getCurrentDateTime();
        topics.push(tempTopic);
        renderAll('নতুন টপিক');
        closeDuplicateAlert();
        closeModal();
        showStatus('✅ New topic created successfully!', 'success');
    }
}

// ========================================
// CRUD অপারেশন (অটো সিঙ্ক সহ)
// ========================================
function saveTopic() {
    const id = document.getElementById('editId').value;
    
    const topic = {
        mainTopic: document.getElementById('mainTopic').value.trim(),
        subTopic: document.getElementById('subTopic').value.trim(),
        question: document.getElementById('question').value.trim(),
        answer: document.getElementById('answer').value.trim(),
        studyType: document.getElementById('studyType').value,
        studyCount: parseInt(document.getElementById('studyCount').value) || 0,
        lastStudied: document.getElementById('lastStudied').value || getCurrentDateTime(),
        source: document.getElementById('source').value.trim(),
        vivaRef: document.getElementById('vivaRef').value.trim(),
        captured: parseInt(document.getElementById('captured').value) || 0,
        confidence: parseInt(document.getElementById('confidence').value) || 0,
        difficulty: document.getElementById('difficulty').value,
        knowledgeStatus: document.getElementById('knowledgeStatus').value,
        remarks: document.getElementById('remarks').value.trim(),
        relatedTopics: document.getElementById('relatedTopics').value.trim(),
        version: parseInt(document.getElementById('version').value) || 1,
        dateCreated: getCurrentDateTime()
    };

    if (!topic.mainTopic || !topic.subTopic || !topic.question) {
        alert('⚠️ Main Topic, Sub Topic এবং Question অবশ্যই পূরণ করুন!');
        return;
    }

    if (id) {
        // এডিট মোড
        const index = topics.findIndex(t => t.id === parseInt(id));
        if (index !== -1) {
            topics[index] = { 
                ...topics[index], 
                ...topic,
                version: (topics[index].version || 1) + 1,
                lastUpdated: getCurrentDateTime()
            };
        }
        renderAll('টপিক আপডেট');
        closeModal();
        showStatus('✅ টপিক আপডেট হয়েছে!', 'success');
        return;
    }

    // ডুপ্লিকেট চেক
    const existing = checkDuplicate(topic.question, topic.mainTopic);
    if (existing) {
        showDuplicateAlert(existing, topic);
        return;
    }

    // নতুন যোগ
    topic.id = nextId++;
    topics.push(topic);
    renderAll('নতুন টপিক যোগ');
    closeModal();
    showStatus('✅ টপিক যোগ হয়েছে!', 'success');
}

function deleteTopic(id) {
    if (!confirm('⚠️ কি আপনি এই টপিক ডিলিট করতে চান?')) return;
    
    topics = topics.filter(t => t.id !== id);
    renderAll('টপিক ডিলিট');
    showStatus('🗑️ ডিলিট হয়েছে।', 'warning');
}

function incrementStudy(id) {
    const topic = topics.find(t => t.id === id);
    if (topic) {
        topic.studyCount = (topic.studyCount || 0) + 1;
        topic.lastStudied = getCurrentDateTime();
        renderAll('স্টাডি কাউন্ট +১');
        showStatus('📈 স্টাডি কাউন্ট +১ হয়েছে!', 'info');
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
// স্টাডি ভিউ ওপেন
// ========================================
function openStudyView(id) {
    // প্রথমে ডেটা localStorage-এ সেভ করুন
    const data = { topics, nextId };
    localStorage.setItem('studyVaultData', JSON.stringify(data));
    
    // নতুন ট্যাবে study.html ওপেন করুন
    window.open(`study.html?id=${id}`, '_blank');
}


// ========================================
// মডালের বাইরে ক্লিক করলে বন্ধ
// ========================================
window.onclick = function(event) {
    const modal = document.getElementById('topicModal');
    const duplicateModal = document.getElementById('duplicateModal');
    if (event.target === modal) {
        closeModal();
    }
    if (event.target === duplicateModal) {
        closeDuplicateAlert();
    }
};

// ========================================
// পেজ লোড
// ========================================
window.onload = function() {
    loadConfig();
    if (config.token && config.repo) {
        loadFromGitHub();
    }
    
    // ডিফল্ট ডেট রেঞ্জ - গত ৩০ দিন
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById('dateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('dateTo').value = today.toISOString().split('T')[0];
};


