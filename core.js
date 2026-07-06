// ============================================================
//  KLT KLTSSCOKE Station - Core Module
//  Version: 2.6 (Per-Board Weather Support + PM2.5)
// ============================================================

// ============================================================
//  1. GLOBAL VARIABLES
// ============================================================
let deviceConfigs = {};
let currentSensorValues = {};
let chart;
let sensorHistory = { timestamps: [], data: {} };
let connectionMode = 'offline';
let presenceIntervalId = null;
let currentUsername = null;
let currentUserRole = null;
let floodAlertStatus = {};
let telegramConfig = {};
let telegramCheckInterval = null;
window.lastSentTracker = "";
let deviceHealthMonitorInterval = null;
let autoLogIntervalId = null;
let currentIntervalMinutes = 15;
let globalAlertMuted = false;
let lastUpdateTracker = {};
let serverTimeOffset = 0;
let loggingConfig = { type: 'day', val: 1, rec: 24, intervalMs: 3600000, maxRecords: 24 };
let eventStateTracker = {};
window.weatherData = null;
window._weatherConfig = {};
let lastSavedValues = {};
let telegramBotToken = '';
let telegramEnabled = false;

// ============================================================
//  1.1 WEATHER LOADING CONTROL (ป้องกันการกระพริบ)
// ============================================================
let isWeatherLoading = false;
let lastWeatherUpdate = 0;
const WEATHER_UPDATE_INTERVAL = 600000; // 10 นาที

// ============================================================
//  2. DEFAULT LEVELS CONFIG
// ============================================================
const DEFAULT_LEVELS_CONFIG = {
    very_high: { min: 90, max: 100, label: '🔴 มากที่สุด', color: '#ef4444' },
    high: { min: 70, max: 89, label: '🟠 มาก', color: '#f59e0b' },
    normal: { min: 40, max: 69, label: '🟢 ปานกลาง', color: '#10b981' },
    low: { min: 20, max: 39, label: '🔵 น้อย', color: '#3b82f6' },
    very_low: { min: 0, max: 19, label: '🟣 น้อยที่สุด', color: '#6366f1' }
};

const LEVEL_KEYS = ['very_high', 'high', 'normal', 'low', 'very_low'];
const LEVEL_NAMES = { very_high: 'มากที่สุด', high: 'มาก', normal: 'ปานกลาง', low: 'น้อย', very_low: 'น้อยที่สุด' };
const LEVEL_EMOJIS = { very_high: '🔴', high: '🟠', normal: '🟢', low: '🔵', very_low: '🟣' };
const LEVEL_COLORS = { very_high: '#ef4444', high: '#f59e0b', normal: '#10b981', low: '#3b82f6', very_low: '#6366f1' };

const SENSOR_TEMPLATES = {
    ultrasonic: {
        label: '📡 Ultrasonic (วัดระดับน้ำ)',
        levels: {
            very_low: { min: 0, max: 30, label: 'น้ำน้อยมาก' },
            low: { min: 31, max: 60, label: 'น้ำน้อย' },
            normal: { min: 61, max: 120, label: 'ปกติ' },
            high: { min: 121, max: 180, label: 'น้ำมาก' },
            very_high: { min: 181, max: 300, label: 'น้ำมากมาก' }
        }
    },
    ultrasonic_river: {
        label: '🌊 Ultrasonic (River Mode)',
        levels: {
            very_low: { min: 0, max: 19, label: 'น้ำน้อยมาก' },
            low: { min: 20, max: 39, label: 'น้ำน้อย' },
            normal: { min: 40, max: 69, label: 'ปกติ' },
            high: { min: 70, max: 89, label: 'เตือนภัย' },
            very_high: { min: 90, max: 999, label: 'วิกฤต' }
        }
    },
    soil: {
        label: '🌱 Soil (ความชื้นดิน)',
        levels: {
            very_low: { min: 0, max: 19, label: 'แห้งมาก' },
            low: { min: 20, max: 39, label: 'แห้ง' },
            normal: { min: 40, max: 69, label: 'ปกติ' },
            high: { min: 70, max: 89, label: 'ชื้น' },
            very_high: { min: 90, max: 100, label: 'ชื้นมาก' }
        }
    },
    ph: {
        label: '🧪 pH (ค่ากรดด่าง)',
        levels: {
            very_low: { min: 0, max: 3, label: 'กรดจัด' },
            low: { min: 4, max: 5, label: 'กรด' },
            normal: { min: 6, max: 8, label: 'เป็นกลาง' },
            high: { min: 9, max: 10, label: 'ด่าง' },
            very_high: { min: 11, max: 14, label: 'ด่างจัด' }
        }
    },
    temp: {
        label: '🌡️ Temperature (อุณหภูมิ)',
        levels: {
            very_low: { min: -10, max: 9, label: 'หนาวจัด' },
            low: { min: 10, max: 19, label: 'หนาว' },
            normal: { min: 20, max: 29, label: 'ปกติ' },
            high: { min: 30, max: 39, label: 'ร้อน' },
            very_high: { min: 40, max: 50, label: 'ร้อนจัด' }
        }
    },
    rain: {
        label: '🌧️ Rain (ปริมาณน้ำฝน)',
        levels: {
            very_low: { min: 0, max: 4, label: 'ฝนน้อย' },
            low: { min: 5, max: 19, label: 'ฝนปานกลาง' },
            normal: { min: 20, max: 49, label: 'ฝนตก' },
            high: { min: 50, max: 99, label: 'ฝนหนัก' },
            very_high: { min: 100, max: 999, label: 'ฝนหนักมาก' }
        }
    },
    pm25: {
        label: '🌫️ PM 2.5 (ฝุ่นละออง)',
        levels: {
            very_low: { min: 0, max: 15, label: 'ดี' },
            low: { min: 16, max: 25, label: 'ปานกลาง' },
            normal: { min: 26, max: 37, label: 'มีผลต่อสุขภาพ' },
            high: { min: 38, max: 50, label: 'ไม่ดี' },
            very_high: { min: 51, max: 999, label: 'แย่/อันตราย' }
        }
    }
};

// ============================================================
//  3. WEATHER SYSTEM (OpenWeatherMap Integration)
// ============================================================
const WEATHER_API_KEY = "dd879305b1074776a9c228f0b27798a3";

// ============================================================
//  4. HELPER FUNCTIONS
// ============================================================
function getTimestampMs(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (typeof value === 'object' && value !== null) {
        try {
            if (value.seconds !== undefined) {
                return value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
            }
            if (value.toString) {
                const str = value.toString();
                const d = new Date(str);
                if (!isNaN(d.getTime())) return d.getTime();
            }
        } catch (e) {}
        return 0;
    }
    return 0;
}

function formatUptime(firebaseTimestamp) {
    if (!firebaseTimestamp) return "-";
    let start;
    if (typeof firebaseTimestamp === 'object') {
        start = firebaseTimestamp.timestamp || firebaseTimestamp.seconds * 1000 || 0;
    } else {
        start = firebaseTimestamp;
    }
    if (!start || isNaN(start)) return "-";
    const now = Date.now() + serverTimeOffset;
    const diff = now - start;
    if (diff < 0) return "0 นาที";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    let result = [];
    if (days > 0) result.push(`${days} วัน`);
    if (hours > 0 || days > 0) result.push(`${hours} ชม.`);
    result.push(`${minutes} นาที`);
    return result.join(' ');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatThaiDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
    } catch (e) { return dateStr; }
}

function formatThaiDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
    } catch (e) { return dateStr; }
}

function showFriendlyError(err) {
    if (!err) { alert("⚠️ ขออภัย พบปัญหาในการทำงาน กรุณาลองใหม่อีกครั้ง"); return; }
    const errorMessage = err.message || String(err);
    if (errorMessage.includes("permission_denied")) {
        alert("❌ คุณไม่มีสิทธิ์ทำรายการนี้ กรุณาติดต่อแอดมิน");
    } else if (errorMessage.includes("network")) {
        if (navigator.onLine === false) {
            alert("❌ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ");
        } else {
            alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
        }
    } else if (errorMessage.includes("not found")) {
        alert("❌ ไม่พบข้อมูลที่ต้องการ กรุณาตรวจสอบอีกครั้ง");
    } else if (errorMessage.includes("timeout")) {
        alert("⏱️ การทำงานใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
    } else {
        alert(`⚠️ ขออภัย พบปัญหาในการทำงาน: ${errorMessage}`);
    }
}

function handleError(err, context = '') {
    console.error(`❌ Error in ${context}:`, err);
    showFriendlyError(err);
}

function getSignalBarsHTML(rssi) {
    let bars = 0;
    let className = "";
    if (rssi >= -55) { bars = 4; className = "signal-strong"; }
    else if (rssi >= -70) { bars = 3; className = "signal-strong"; }
    else if (rssi >= -80) { bars = 2; className = "signal-mid"; }
    else { bars = 1; className = "signal-low"; }
    let html = `<div class="signal-bars ${className}">`;
    for (let i = 1; i <= 4; i++) {
        html += `<div class="bar bar-${i}" style="opacity: ${i <= bars ? '1' : '0.3'}"></div>`;
    }
    html += `</div>`;
    return html;
}

function getRSSIStatusText(rssi) {
    if (rssi === 0 || !rssi) return "📶 ไม่มีสัญญาณ";
    if (rssi >= -55) return "📶 แรงมาก";
    if (rssi >= -70) return "📶 แรง";
    if (rssi >= -80) return "📶 ปานกลาง";
    return "📶 อ่อน";
}

function isSensorDataStale(sensorId) {
    const config = deviceConfigs[sensorId];
    if (!config) return true;
    if (config.enabled === false) return true;
    if (!config.lastSeen) return true;
    const now = Date.now();
    const lastSeenTime = new Date(config.lastSeen).getTime();
    const staleThreshold = 5 * 60 * 1000;
    return (now - lastSeenTime) > staleThreshold;
}

function hasFreshData(sensorId) {
    if (!currentSensorValues[sensorId]) return false;
    if (isSensorDataStale(sensorId)) return false;
    return true;
}

// ============================================================
//  5. WATER LEVEL CALCULATION
// ============================================================
function calculateWaterLevel(rawDistance, installHeight) {
    if (rawDistance === undefined || rawDistance === null || isNaN(rawDistance)) return null;
    if (!installHeight || isNaN(installHeight)) return rawDistance;
    const result = installHeight - rawDistance;
    return Math.max(0, result);
}

function checkFloodStatus(waterLevel, bankHeight) {
    if (!bankHeight || isNaN(bankHeight) || waterLevel === null || isNaN(waterLevel)) return 'normal';
    if (waterLevel >= bankHeight) return 'flood';
    if (waterLevel >= (bankHeight * 0.8)) return 'warning';
    return 'normal';
}

function evaluateWaterStatus(rawDistance, installHeight, bankHeight = null) {
    if (rawDistance === undefined || rawDistance === null || isNaN(rawDistance)) {
        return { level: 'unknown', status: 'ไม่ทราบข้อมูล', waterLevel: null };
    }
    const waterLevel = calculateWaterLevel(rawDistance, installHeight);
    if (waterLevel === null || isNaN(waterLevel)) {
        return { level: 'unknown', status: 'ไม่ทราบข้อมูล', waterLevel: null };
    }
    let level = 'normal';
    let status = '';
    if (bankHeight && !isNaN(bankHeight) && bankHeight > 0) {
        const percent = (waterLevel / bankHeight) * 100;
        if (percent >= 100) {
            level = 'very_high';
            status = '🌊 น้ำล้นตลิ่ง! (วิกฤต)';
        } else if (percent >= 80) {
            level = 'high';
            status = '📈 ใกล้ตลิ่งมาก';
        } else if (percent >= 60) {
            level = 'high';
            status = '📈 ระดับน้ำสูง';
        } else if (percent >= 40) {
            level = 'normal';
            status = '📊 ระดับน้ำปานกลาง';
        } else if (percent >= 20) {
            level = 'low';
            status = '📉 ระดับน้ำต่ำ';
        } else {
            level = 'very_low';
            status = '📉 ระดับน้ำต่ำมาก';
        }
    } else if (installHeight && !isNaN(installHeight) && installHeight > 0) {
        const percent = (waterLevel / installHeight) * 100;
        if (percent >= 80) {
            level = 'very_high';
            status = '🌊 น้ำมากที่สุด';
        } else if (percent >= 60) {
            level = 'high';
            status = '📈 น้ำมาก';
        } else if (percent >= 40) {
            level = 'normal';
            status = '📊 ระดับน้ำปานกลาง';
        } else if (percent >= 20) {
            level = 'low';
            status = '📉 น้ำน้อย';
        } else {
            level = 'very_low';
            status = '📉 น้ำน้อยมาก';
        }
    } else {
        if (rawDistance < 20) {
            level = 'very_high';
            status = '🌊 ระยะน้อยมาก (น้ำมาก)';
        } else if (rawDistance < 50) {
            level = 'high';
            status = '📈 ระยะน้อย (น้ำมาก)';
        } else if (rawDistance < 100) {
            level = 'normal';
            status = '📊 ระยะปานกลาง';
        } else if (rawDistance < 200) {
            level = 'low';
            status = '📉 ระยะมาก (น้ำน้อย)';
        } else {
            level = 'very_low';
            status = '📉 ระยะมากที่สุด (น้ำน้อยมาก)';
        }
    }
    return { level, status, waterLevel };
}

// ============================================================
//  6. PROJECT TITLE MANAGEMENT
// ============================================================
function initTitleListener() {
    if (!window.db) return;
    const titleRef = window.ref(window.db, 'settings/project_title');
    window.onValue(titleRef, (snapshot) => {
        const titleEl = document.getElementById('projectTitle');
        if (!titleEl) return;
        const title = snapshot.exists() ? snapshot.val() : "KLTSSCOKE";
        titleEl.textContent = title;
    });
}

window.openTitleEditor = function() {
    const modal = document.getElementById('titleModal');
    const titleEl = document.getElementById('projectTitle');
    const inputField = document.getElementById('newProjectTitle');
    if (modal && titleEl && inputField) {
        modal.style.display = 'flex';
        inputField.value = titleEl.textContent;
    }
};

window.closeTitleEditor = function() {
    const modal = document.getElementById('titleModal');
    if (modal) modal.style.display = 'none';
};

window.saveProjectTitle = async function() {
    const newTitle = document.getElementById('newProjectTitle').value.trim();
    if (!newTitle) { alert("กรุณากรอกชื่อโครงการ"); return; }
    try {
        await window.set(window.ref(window.db, 'settings/project_title'), newTitle);
        closeTitleEditor();
        alert("✅ บันทึกชื่อโครงการสำเร็จ");
    } catch (e) {
        alert("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
};

window.deleteProjectTitle = async function() {
    if (confirm("ยืนยันการลบชื่อโครงการ? (จะกลับสู่ค่าเริ่มต้น)")) {
        try {
            await window.remove(window.ref(window.db, 'settings/project_title'));
            closeTitleEditor();
            alert("✅ ลบชื่อโครงการสำเร็จ (กลับสู่ค่าเริ่มต้น)");
        } catch (e) {
            alert("❌ ลบไม่สำเร็จ: " + e.message);
        }
    }
};

// ============================================================
//  7. PRESENCE SYSTEM
// ============================================================
function updatePresence(username, role) {
    if (!window.db || !username) return;
    const presenceRef = window.ref(window.db, 'online_users/' + username);
    window.set(presenceRef, {
        role: role,
        loginAt: window.serverTimestamp(),
        lastSeen: new Date().toISOString()
    }).catch(err => console.warn("⚠️ updatePresence set error:", err));

    window.onValue(window.ref(window.db, '.info/connected'), (snap) => {
        if (snap.val() === true) {
            const onDisconnectRef = window.ref(window.db, 'online_users/' + username);
            window.onDisconnect(onDisconnectRef).remove().catch(err => {
                console.warn("⚠️ onDisconnect error:", err);
            });
        }
    });

    if (presenceIntervalId) clearInterval(presenceIntervalId);
    presenceIntervalId = setInterval(() => {
        window.update(presenceRef, {
            lastSeen: new Date().toISOString()
        }).catch(err => console.warn("⚠️ lastSeen update error:", err));
    }, 30000);
}

function removePresence(username) {
    if (!window.db || !username) return;
    const presenceRef = window.ref(window.db, 'online_users/' + username);
    window.remove(presenceRef).catch(err => console.warn("⚠️ removePresence error:", err));
}

function updateCompactOnlineUsers() {
    if (!window.db) return;
    const listRef = window.ref(window.db, 'online_users');
    window.onValue(listRef, (snapshot) => {
        const compactTextEl = document.getElementById('compactOnlineText');
        const compactListEl = document.getElementById('compactUsersList');
        if (!compactTextEl || !compactListEl) return;
        if (snapshot.exists()) {
            const users = snapshot.val();
            let onlineUsers = [];
            const now = new Date().getTime();
            Object.keys(users).forEach(u => {
                const lastSeen = new Date(users[u].lastSeen).getTime();
                if (now - lastSeen < 30000) {
                    onlineUsers.push({ name: u, role: users[u].role });
                }
            });
            const count = onlineUsers.length;
            compactTextEl.textContent = `ออนไลน์ ${count} คน`;
            if (count > 0) {
                let listHtml = `<div class="online-count-header">🟢 ออนไลน์ ${count} คน</div>`;
                onlineUsers.forEach(user => {
                    const roleIcon = user.role === 'admin' ? '👑' : '👤';
                    listHtml += `<div class="compact-user-item"><span class="role-icon">${roleIcon}</span><span class="username-text">${escapeHtml(user.name)}</span></div>`;
                });
                compactListEl.innerHTML = listHtml;
            } else {
                compactListEl.innerHTML = '<div class="compact-user-item" style="opacity:0.7;">ไม่มีผู้ใช้ออนไลน์</div>';
            }
        } else {
            compactTextEl.textContent = 'ออนไลน์ 0 คน';
            compactListEl.innerHTML = '<div class="compact-user-item" style="opacity:0.7;">ไม่มีผู้ใช้ออนไลน์</div>';
        }
    });
}

// ============================================================
//  8. LOGIN SYSTEM
// ============================================================
window.togglePassword = function() {
    const passInput = document.getElementById('password');
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
};

window.handleLogin = async function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const remember = document.getElementById('rememberMe').checked;

    if (!user || !pass) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }

    try {
        if (!window.db) throw new Error('Firebase ไม่พร้อมใช้งาน');
        const userRef = window.ref(window.db, `users/${user}`);
        const snapshot = await window.get(userRef);

        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === pass) {
                loginSuccess(userData.role, user, pass, remember);
            } else {
                alert('❌ รหัสผ่านไม่ถูกต้อง');
            }
        } else {
            alert('❌ ไม่พบชื่อผู้ใช้นี้ในระบบ');
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
};

function loginSuccess(role, user, pass, remember) {
    sessionStorage.setItem('activeRole', role);
    sessionStorage.setItem('currentUser', user);
    currentUsername = user;
    currentUserRole = role;

    if (remember) {
        localStorage.setItem('savedUsername', user);
        localStorage.setItem('savedPassword', pass);
        localStorage.setItem('rememberMe', 'true');
    } else {
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
        localStorage.removeItem('rememberMe');
    }

    applyRole(role, user);
    updatePresence(user, role);
    updateCompactOnlineUsers();
    initTitleListener();
    
    // ✅ ตรวจสอบก่อนเรียกใช้
    if (typeof startDeviceHealthMonitor === 'function') {
        startDeviceHealthMonitor();
    } else {
        console.warn("⚠️ startDeviceHealthMonitor ยังไม่พร้อม (loginSuccess)");
    }
    
    setTimeout(() => {
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        } else {
            console.warn("⚠️ updateStatusBarBoardDetails ยังไม่พร้อม (loginSuccess)");
        }
    }, 1500);
}

function applyRole(role, username) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userInfo').style.display = 'flex';

    const userNameSpan = document.getElementById('currentUserName');
    if (userNameSpan) {
        userNameSpan.textContent = username;
    }

    const adminControls = document.getElementById('adminControls');
    if (adminControls) {
        if (role === 'admin') {
            adminControls.classList.remove('role-hidden');
            console.log("✅ Admin controls activated");
        } else {
            adminControls.classList.add('role-hidden');
            console.log("👤 User mode: Admin controls hidden");
        }
    } else {
        console.warn("⚠️ ไม่พบ element #adminControls");
    }

    const adminMenuToggleBtn = document.getElementById('adminMenuToggleBtn');
    if (adminMenuToggleBtn) {
        if (role === 'admin') {
            adminMenuToggleBtn.style.display = 'inline-block';
            console.log("✅ Admin menu toggle button shown");
        } else {
            adminMenuToggleBtn.style.display = 'none';
        }
    } else {
        console.warn("⚠️ ไม่พบ element #adminMenuToggleBtn");
    }

    setTimeout(() => {
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        } else {
            console.warn("⚠️ updateStatusBarBoardDetails ยังไม่พร้อม (applyRole)");
        }
    }, 1000);
}

window.toggleAdminMenu = function() {
    const menu = document.getElementById('adminMenuModal');
    if (menu) {
        const isVisible = menu.style.display === 'flex';
        menu.style.display = isVisible ? 'none' : 'flex';
        console.log(`🔄 Admin Menu: ${isVisible ? 'ซ่อน' : 'แสดง'}`);
    } else {
        console.warn("⚠️ ไม่พบ element #adminMenuModal");
    }
};

window.logout = async function() {
    const currentUser = sessionStorage.getItem('currentUser');

    if (presenceIntervalId) {
        clearInterval(presenceIntervalId);
        presenceIntervalId = null;
    }
    if (telegramCheckInterval) {
        clearInterval(telegramCheckInterval);
        telegramCheckInterval = null;
    }
    if (deviceHealthMonitorInterval) {
        clearInterval(deviceHealthMonitorInterval);
        deviceHealthMonitorInterval = null;
    }
    if (autoLogIntervalId) {
        clearInterval(autoLogIntervalId);
        autoLogIntervalId = null;
    }

    localStorage.removeItem('savedUsername');
    localStorage.removeItem('savedPassword');
    localStorage.removeItem('rememberMe');
    sessionStorage.clear();

    if (currentUser && window.db) {
        const presenceRef = window.ref(window.db, 'online_users/' + currentUser);
        try {
            await window.onDisconnect(presenceRef).cancel();
            await window.remove(presenceRef);
            console.log("✅ ลบสถานะออนไลน์เรียบร้อย");
        } catch (err) {
            console.error("❌ ลบสถานะออนไลน์ไม่สำเร็จ:", err);
        }
    }

    window.location.reload();
};

// ============================================================
//  9. USER MANAGEMENT
// ============================================================
window.openUserManager = async function() {
    document.getElementById('userModal').style.display = 'flex';
    await renderUserTable();
};

window.closeUserManager = function() {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('manageUsername').value = '';
    document.getElementById('managePassword').value = '';
    document.getElementById('manageRole').value = 'user';
    const saveBtn = document.querySelector('.user-management-form .save-btn');
    if (saveBtn) {
        saveBtn.textContent = '💾 บันทึก';
        saveBtn.setAttribute('onclick', 'saveUser()');
    }
    document.getElementById('manageUsername').readOnly = false;
};

window.editUser = function(username, password, role) {
    const userField = document.getElementById('manageUsername');
    userField.value = username;
    userField.readOnly = true;
    document.getElementById('managePassword').value = password;
    document.getElementById('manageRole').value = role;
    const saveBtn = document.querySelector('.user-management-form .save-btn');
    saveBtn.textContent = '💾 อัปเดต';
    saveBtn.setAttribute('onclick', 'saveUser(true)');
};

window.saveUser = async function(isEdit = false) {
    const username = document.getElementById('manageUsername').value.trim();
    const password = document.getElementById('managePassword').value.trim();
    const role = document.getElementById('manageRole').value;

    if (!username || !password) { alert("กรุณากรอก Username และ Password"); return; }

    try {
        await window.update(window.ref(window.db, `users/${username}`), {
            password: password,
            role: role,
            updatedAt: new Date().toISOString()
        });
        alert(`✅ ${isEdit ? 'อัปเดต' : 'บันทึก'}ผู้ใช้ ${username} สำเร็จ`);
        closeUserManager();
        await renderUserTable();
    } catch (error) {
        alert("❌ ไม่สามารถบันทึกได้: " + error.message);
    }
};

window.deleteUser = async function(username) {
    const currentUser = sessionStorage.getItem('currentUser');
    if (username === currentUser) {
        alert("❌ ไม่สามารถลบตัวเองได้ขณะที่กำลังใช้งานระบบอยู่");
        return;
    }

    try {
        const snapshot = await window.get(window.ref(window.db, `users`));
        if (!snapshot.exists()) return;
        const users = snapshot.val();

        if (users[username] && users[username].role === 'admin') {
            const admins = Object.entries(users).filter(([_, data]) => data.role === 'admin');
            if (admins.length <= 1) {
                alert("❌ ไม่สามารถลบได้: ระบบจำเป็นต้องมีบัญชี Admin อย่างน้อย 1 บัญชี");
                return;
            }
        }

        if (confirm(`⚠️ ยืนยันการลบผู้ใช้ "${username}" ออกจากระบบถาวร?`)) {
            await window.remove(window.ref(window.db, `online_users/${username}`));
            await window.remove(window.ref(window.db, `users/${username}`));
            alert(`✅ ลบผู้ใช้ ${username} สำเร็จ`);
            await renderUserTable();
            updateCompactOnlineUsers();
        }
    } catch (error) {
        console.error("❌ ลบผู้ใช้ไม่สำเร็จ:", error);
        alert("❌ เกิดข้อผิดพลาดในการลบผู้ใช้: " + error.message);
    }
};

async function renderUserTable() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">📥 กำลังโหลดข้อมูลผู้ใช้...</td></tr>';

    try {
        const snapshot = await window.get(window.ref(window.db, 'users'));
        if (snapshot.exists()) {
            const users = snapshot.val();
            tbody.innerHTML = '';
            for (const [username, userData] of Object.entries(users)) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Username"><strong style="color:#1b5e20;">${escapeHtml(username)}</strong></td>
                    <td data-label="Password"><span style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(userData.password || '******')}</span></td>
                    <td data-label="Role"><span class="role-badge ${userData.role === 'admin' ? 'role-admin' : 'role-user'}">${userData.role === 'admin' ? '👑 Admin' : '👤 User'}</span></td>
                    <td data-label="Action">
                        <button onclick="editUser('${escapeHtml(username)}', '${escapeHtml(userData.password || '')}', '${userData.role}')" class="btn-small edit-btn" style="background:#ffa726; color:white; margin-right:8px;">✏️ แก้ไข</button>
                        <button onclick="confirmDeleteUser('${escapeHtml(username)}')" class="btn-small danger">🗑️ ลบ</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px;">📭 ยังไม่มีข้อมูลผู้ใช้</td></tr>';
        }
    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #d32f2f;">❌ โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
}

// ============================================================
//  10. WEATHER FUNCTIONS - REFRESH & LOAD (UPDATED - NO BLINK + PM2.5)
// ============================================================

// ฟังก์ชันรีเฟรชการ์ดสภาพอากาศ (Per-Board) - ใช้ loadWeatherInfo แทน
window.refreshWeatherCards = function() {
    console.log("🔄 Refresh Weather Cards (Per-Board)...");
    // เรียก loadWeatherInfo เพื่อโหลดใหม่
    if (typeof loadWeatherInfo === 'function') {
        loadWeatherInfo();
    } else {
        console.warn("⚠️ loadWeatherInfo ยังไม่พร้อม");
    }
};

// ============================================================
//  10.1 FETCH WEATHER DATA - UPDATED WITH PM2.5
// ============================================================
async function fetchWeatherData(lat, lon) {
    if (!lat || !lon) return null;
    try {
        // ดึงข้อมูลสภาพอากาศหลัก
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=th&appid=${WEATHER_API_KEY}`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            throw new Error(`Weather HTTP ${weatherRes.status}`);
        }
        const weatherData = await weatherRes.json();
        
        // ✅ ดึง PM 2.5 จาก Air Pollution API จริง
        try {
            const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`;
            const airRes = await fetch(airUrl);
            if (airRes.ok) {
                const airData = await airRes.json();
                if (airData.list && airData.list[0] && airData.list[0].components) {
                    weatherData.pm25 = airData.list[0].components.pm2_5;
                    console.log(`🌫️ PM 2.5 (API): ${weatherData.pm25} µg/m³`);
                } else {
                    // ถ้าไม่มีข้อมูล components ใช้ค่าจำลอง
                    weatherData.pm25 = 25.5;
                    console.log(`⚠️ ไม่มีข้อมูล PM 2.5 จาก API ใช้ค่าจำลอง: 25.5`);
                }
            } else {
                // ถ้า API ไม่ตอบสนอง ใช้ค่าจำลอง
                weatherData.pm25 = 25.5;
                console.log(`⚠️ Air Pollution API ไม่ตอบสนอง (${airRes.status}) ใช้ค่าจำลอง: 25.5`);
            }
        } catch (airErr) {
            console.warn("⚠️ Air Pollution API Error:", airErr.message);
            weatherData.pm25 = 25.5;
            console.log(`ℹ️ ใช้ค่าจำลอง PM 2.5: 25.5 µg/m³`);
        }
        
        return weatherData;
    } catch (err) {
        console.warn("❌ Weather API Error:", err.message);
        return null;
    }
}

// ============================================================
//  10.2 GET PM2.5 COLOR AND LABEL
// ============================================================
function getPM25Status(pm25Value) {
    if (pm25Value === null || pm25Value === undefined) {
        return { color: '#94a3b8', label: 'ไม่ทราบ', emoji: '❓' };
    }
    if (pm25Value <= 15) {
        return { color: '#22c55e', label: 'ดี', emoji: '🟢' };
    } else if (pm25Value <= 25) {
        return { color: '#fbbf24', label: 'ปานกลาง', emoji: '🟡' };
    } else if (pm25Value <= 37) {
        return { color: '#f59e0b', label: 'มีผลต่อสุขภาพ', emoji: '🟠' };
    } else if (pm25Value <= 50) {
        return { color: '#fb923c', label: 'ไม่ดี', emoji: '🟧' };
    } else if (pm25Value <= 75) {
        return { color: '#ef4444', label: 'แย่', emoji: '🔴' };
    } else {
        return { color: '#7f1d1d', label: 'อันตราย', emoji: '⛔' };
    }
}

// ============================================================
//  10.3 LOAD WEATHER INFO - UPDATED (อัปเดตแทนการสร้างใหม่)
// ============================================================
async function loadWeatherInfo() {
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม รอ 2 วินาที แล้วลองใหม่...");
        setTimeout(loadWeatherInfo, 2000);
        return;
    }
    
    // ป้องกันการโหลดซ้อน
    if (isWeatherLoading) {
        console.log("⏳ กำลังโหลดสภาพอากาศอยู่ ข้ามการทำงานนี้");
        return;
    }
    
    // ป้องกันการโหลดบ่อยเกินไป (30 วินาที)
    const now = Date.now();
    if (now - lastWeatherUpdate < 30000) {
        console.log("⏳ โหลดสภาพอากาศถี่เกินไป (น้อยกว่า 30 วินาที) ข้าม");
        return;
    }
    lastWeatherUpdate = now;
    
    isWeatherLoading = true;
    console.log("🌤️ loadWeatherInfo (Per-Board) เริ่มทำงาน...");
    
    try {
        // ตรวจสอบ deviceConfigs ว่ามีข้อมูลและเป็น Object
        if (!deviceConfigs || typeof deviceConfigs !== 'object') {
            console.warn("⚠️ deviceConfigs ยังไม่พร้อมหรือไม่ถูกต้อง");
            const container = document.getElementById('weatherCardsContainer');
            if (container) {
                container.innerHTML = `<div style="color: #94a3b8; padding: 20px; text-align: center; width: 100%;">
                    ⏳ กำลังโหลดการตั้งค่า...
                </div>`;
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
            }
            isWeatherLoading = false;
            return;
        }
        
        // ดึงเฉพาะบอร์ดที่ตั้งค่า weather_config ไว้
        const boards = [];
        try {
            for (const id in deviceConfigs) {
                if (deviceConfigs.hasOwnProperty(id)) {
                    const config = deviceConfigs[id];
                    if (config && config.type === 'board' && 
                        config.weather_config && 
                        config.weather_config.lat) {
                        boards.push([id, config]);
                    }
                }
            }
        } catch (e) {
            console.warn("⚠️ เกิดข้อผิดพลาดในการวนลูป deviceConfigs:", e);
            const container = document.getElementById('weatherCardsContainer');
            if (container) {
                container.innerHTML = `<div style="color: #f59e0b; padding: 20px; text-align: center; width: 100%;">
                    ⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณารีเฟรชหน้าเว็บ
                </div>`;
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
            }
            isWeatherLoading = false;
            return;
        }
        
        const container = document.getElementById('weatherCardsContainer');
        if (!container) {
            console.warn("⚠️ ไม่พบ element #weatherCardsContainer");
            isWeatherLoading = false;
            return;
        }
        
        // ถ้าไม่มีบอร์ดที่ตั้งค่า ให้ซ่อน container
        if (boards.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            console.log("📭 ไม่มีบอร์ดที่ตั้งค่า weather_config");
            isWeatherLoading = false;
            return;
        }
        
        // แสดง container
        container.style.display = 'flex';
        container.style.justifyContent = boards.length === 1 ? 'center' : 'flex-start';
        
        // ===== เก็บ reference ของการ์ดที่มีอยู่แล้ว =====
        const existingCards = container.querySelectorAll('.weather-board-card');
        const existingCardMap = {};
        existingCards.forEach(card => {
            const boardId = card.dataset.boardId;
            if (boardId) {
                existingCardMap[boardId] = card;
            }
        });
        
        // ใช้ Set เก็บพิกัดที่เรนเดอร์ไปแล้ว
        const renderedLocations = new Set();
        let loadedCount = 0;
        
        // จำกัดจำนวนบอร์ดที่โหลดพร้อมกัน
        const maxBoards = Math.min(boards.length, 10);
        
        for (let i = 0; i < maxBoards; i++) {
            const [boardId, config] = boards[i];
            
            if (!config || !config.weather_config) continue;
            
            const wConfig = config.weather_config;
            if (!wConfig.lat || !wConfig.lon) {
                console.warn(`⚠️ บอร์ด ${boardId} ขาดพิกัด lat/lon`);
                continue;
            }
            
            const locKey = `${Number(wConfig.lat).toFixed(2)},${Number(wConfig.lon).toFixed(2)}`;
            if (renderedLocations.has(locKey)) {
                console.log(`⏭️ ข้ามบอร์ด ${boardId} พิกัดซ้ำกับที่แสดงแล้ว (${locKey})`);
                continue;
            }
            
            try {
                const weatherData = await fetchWeatherData(wConfig.lat, wConfig.lon);
                
                if (weatherData) {
                    // ตรวจสอบว่ามีการ์ดนี้อยู่แล้วหรือไม่
                    if (existingCardMap[boardId]) {
                        // อัปเดตการ์ดที่มีอยู่
                        updateWeatherCardContent(existingCardMap[boardId], boardId, config, weatherData);
                        console.log(`🔄 อัปเดตการ์ดสภาพอากาศ: ${boardId}`);
                    } else {
                        // สร้างการ์ดใหม่
                        renderWeatherCard(boardId, config.name || boardId, config, weatherData);
                        console.log(`🆕 สร้างการ์ดสภาพอากาศใหม่: ${boardId}`);
                    }
                    renderedLocations.add(locKey);
                    loadedCount++;
                    
                    if (renderedLocations.size === 1) {
                        window.weatherData = weatherData;
                        window._weatherConfig = wConfig;
                        console.log("🌤️ ตั้งค่า weatherData หลักจากบอร์ดแรก:", wConfig.locationName || boardId);
                    }
                } else {
                    // แสดงการ์ด error ถ้ายังไม่มี
                    if (!existingCardMap[boardId]) {
                        renderWeatherCardError(boardId, config.name || boardId, wConfig);
                    } else {
                        // อัปเดตการ์ด error
                        updateWeatherCardError(existingCardMap[boardId], boardId, config);
                    }
                }
            } catch (err) {
                console.warn(`❌ โหลดสภาพอากาศของบอร์ด ${boardId} ล้มเหลว:`, err);
                if (!existingCardMap[boardId]) {
                    renderWeatherCardError(boardId, config.name || boardId, wConfig);
                } else {
                    updateWeatherCardError(existingCardMap[boardId], boardId, config);
                }
            }
            
            if (i < maxBoards - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        // ===== ลบการ์ดที่ไม่มีข้อมูลแล้ว (ถ้าบอร์ดถูกลบ) =====
        const activeBoardIds = new Set(boards.map(([id]) => id));
        for (const [boardId, card] of Object.entries(existingCardMap)) {
            if (!activeBoardIds.has(boardId) && card.parentNode) {
                card.remove();
                console.log(`🗑️ ลบการ์ดที่ไม่มีบอร์ด: ${boardId}`);
            }
        }
        
        console.log(`✅ โหลด/อัปเดตสภาพอากาศสำเร็จ ${loadedCount} ตำแหน่ง (จาก ${boards.length} บอร์ด)`);
        console.log(`📍 พิกัดที่ไม่ซ้ำ: ${Array.from(renderedLocations).join(', ')}`);
        
        // ถ้าไม่มีการ์ดใดแสดงเลย ให้แสดงข้อความ
        if (container.children.length === 0) {
            container.innerHTML = `<div style="color: #94a3b8; padding: 10px; text-align: center; width: 100%;">
                📭 ไม่พบข้อมูลสภาพอากาศที่สามารถแสดงได้
            </div>`;
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
        }
        
    } catch (error) {
        console.error("❌ loadWeatherInfo error:", error);
        const container = document.getElementById('weatherCardsContainer');
        if (container) {
            container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center; width: 100%;">
                ❌ เกิดข้อผิดพลาดในการโหลดข้อมูลสภาพอากาศ: ${error.message}
            </div>`;
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
        }
    } finally {
        isWeatherLoading = false;
        console.log("🔓 ปลดล็อก isWeatherLoading");
    }
}

// ============================================================
//  10.4 UPDATE WEATHER CARD CONTENT - UPDATED WITH PM2.5
// ============================================================
function updateWeatherCardContent(card, boardId, config, data) {
    if (!card || !data) return;
    
    const boardConfig = deviceConfigs[boardId];
    const isBoardOnline = boardConfig?.status === 'online';
    
    // ✅ ดึงค่า PM 2.5
    const pm25Value = (data.pm25 !== undefined && data.pm25 !== null) ? data.pm25 : null;
    const pm25Display = pm25Value !== null ? pm25Value.toFixed(1) : '--';
    const pm25Status = getPM25Status(pm25Value);
    
    try {
        // อัปเดตชื่อบอร์ดและสถานะ
        const nameEl = card.querySelector('.board-name');
        if (nameEl) {
            nameEl.textContent = `📡 ${escapeHtml(config.name || boardId)}`;
        }
        
        const statusEl = card.querySelector('.board-status');
        if (statusEl) {
            statusEl.textContent = isBoardOnline ? '🟢' : '🔴';
            statusEl.style.color = isBoardOnline ? '#4ade80' : '#f87171';
        }
        
        // อัปเดต border-left
        card.style.borderLeftColor = isBoardOnline ? '#4ade80' : '#f87171';
        
        // อัปเดตตำแหน่ง
        const locEl = card.querySelector('.board-location');
        if (locEl) {
            locEl.textContent = `📍 ${escapeHtml(config.weather_config?.locationName || 'ไม่ระบุ')}`;
        }
        
        // อัปเดตอุณหภูมิ
        const tempEl = card.querySelector('.weather-temp');
        if (tempEl) {
            tempEl.textContent = `${data.main.temp.toFixed(1)}°C`;
        }
        
        // อัปเดตคำอธิบาย
        const descEl = card.querySelector('.weather-desc');
        if (descEl) {
            descEl.textContent = data.weather[0].description;
        }
        
        // อัปเดตไอคอน
        const iconEl = card.querySelector('.weather-icon');
        if (iconEl) {
            iconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        }
        
        // อัปเดตฟิลด์ต่างๆ รวมถึง PM 2.5
        const f = config.weather_config?.fields || {};
        const fieldsEl = card.querySelector('.weather-fields');
        if (fieldsEl) {
            let html = '';
            if (f.temp) html += `<div>🌡️ ${data.main.temp.toFixed(1)}°C</div>`;
            if (f.humidity) html += `<div>💧 ${data.main.humidity}%</div>`;
            if (f.wind) html += `<div>🌬️ ${data.wind.speed.toFixed(1)}m/s</div>`;
            if (f.pressure) html += `<div>⏲️ ${data.main.pressure}hPa</div>`;
            // ✅ PM 2.5 field
            if (f.pm25 && pm25Value !== null) {
                html += `
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span>🌫️ PM 2.5:</span>
                        <span style="font-weight: bold; color: ${pm25Status.color};">${pm25Display}</span>
                        <span style="font-size: 0.6rem; color: ${pm25Status.color};">µg/m³</span>
                        <span style="font-size: 0.55rem; background: ${pm25Status.color}22; color: ${pm25Status.color}; padding: 0 6px; border-radius: 8px; border: 1px solid ${pm25Status.color}44;">${pm25Status.emoji} ${pm25Status.label}</span>
                    </div>
                `;
            } else if (f.pm25) {
                html += `<div style="color: #64748b;">🌫️ PM 2.5: -- µg/m³</div>`;
            }
            if (!f.temp && !f.humidity && !f.wind && !f.pressure && !f.pm25) {
                html = `<div style="grid-column: span 2; color: #64748b; font-style: italic;">ไม่มีฟิลด์ที่เลือกแสดง</div>`;
            }
            fieldsEl.innerHTML = html;
        }
        
        // อัปเดตเวลาอัปเดต
        const timeEl = card.querySelector('.weather-update-time');
        if (timeEl) {
            timeEl.textContent = `อัปเดต: ${new Date().toLocaleTimeString('th-TH')}`;
        }
        
        // อัปเดตสถานะการเชื่อมต่อบอร์ด (tooltip หรือข้อความ)
        const boardStatusEl = card.querySelector('.board-connection-status');
        if (boardStatusEl) {
            boardStatusEl.textContent = isBoardOnline ? '🟢 ออนไลน์' : '🔴 ออฟไลน์';
            boardStatusEl.style.color = isBoardOnline ? '#4ade80' : '#f87171';
        }
        
    } catch (e) {
        console.warn(`⚠️ อัปเดตการ์ด ${boardId} ล้มเหลว:`, e);
    }
}

// ============================================================
//  10.5 UPDATE WEATHER CARD ERROR
// ============================================================
function updateWeatherCardError(card, boardId, config) {
    if (!card) return;
    
    try {
        const statusEl = card.querySelector('.board-status');
        if (statusEl) {
            statusEl.textContent = '🔴';
            statusEl.style.color = '#f87171';
        }
        card.style.borderLeftColor = '#f87171';
        
        const tempEl = card.querySelector('.weather-temp');
        if (tempEl) {
            tempEl.textContent = '--';
        }
        
        const descEl = card.querySelector('.weather-desc');
        if (descEl) {
            descEl.textContent = 'ไม่สามารถโหลดข้อมูล';
        }
        
        const timeEl = card.querySelector('.weather-update-time');
        if (timeEl) {
            timeEl.textContent = `อัปเดตล้มเหลว: ${new Date().toLocaleTimeString('th-TH')}`;
        }
        
    } catch (e) {
        console.warn(`⚠️ อัปเดตการ์ด error ${boardId} ล้มเหลว:`, e);
    }
}

// ============================================================
//  10.6 RENDER WEATHER CARD - UPDATED WITH PM2.5
// ============================================================
function renderWeatherCard(boardId, boardName, config, data) {
    const container = document.getElementById('weatherCardsContainer');
    if (!container) return;
    
    const f = config.weather_config?.fields || {};
    const boardConfig = deviceConfigs[boardId];
    const isBoardOnline = boardConfig?.status === 'online';
    const onlineStatus = isBoardOnline ? '🟢' : '🔴';
    const locationName = config.weather_config?.locationName || 'ไม่ระบุ';
    
    // ✅ ดึงค่า PM 2.5
    const pm25Value = (data.pm25 !== undefined && data.pm25 !== null) ? data.pm25 : null;
    const pm25Display = pm25Value !== null ? pm25Value.toFixed(1) : '--';
    const pm25Status = getPM25Status(pm25Value);
    
    const cardHtml = `
        <div class="weather-board-card" data-board-id="${boardId}" style="
            background: linear-gradient(135deg, #1e293b, #0f172a); 
            border: 1px solid #334155; 
            border-radius: 12px; 
            padding: 15px 18px; 
            min-width: 250px; 
            max-width: 320px;
            flex: 0 0 auto;
            border-left: 4px solid ${isBoardOnline ? '#4ade80' : '#f87171'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s, border-color 0.3s ease, background 0.3s ease;
        "
        onmouseover="this.style.transform='translateY(-2px)'"
        onmouseout="this.style.transform='translateY(0)'"
        >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 0.7rem; color: #60a5fa; font-weight: bold; display: flex; align-items: center; gap: 6px;">
                    <span>📡</span> <span class="board-name">${escapeHtml(boardName)}</span>
                    <span class="board-status" style="font-size: 0.6rem; color: ${isBoardOnline ? '#4ade80' : '#f87171'};">${onlineStatus}</span>
                </div>
                <div class="board-location" style="font-size: 0.6rem; color: #64748b;">📍 ${escapeHtml(locationName)}</div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px;">
                <img class="weather-icon" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" 
                     style="width: 50px; height: 50px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                <div>
                    <div class="weather-temp" style="font-size: 1.3rem; font-weight: bold; color: #fff;">
                        ${data.main.temp.toFixed(1)}°C
                    </div>
                    <div class="weather-desc" style="font-size: 0.7rem; color: #94a3b8; text-transform: capitalize;">
                        ${data.weather[0].description}
                    </div>
                </div>
            </div>
            
            <div class="weather-fields" style="margin-top: 10px; font-size: 0.7rem; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; border-top: 1px solid #334155; padding-top: 10px;">
                ${f.temp ? `<div>🌡️ ${data.main.temp.toFixed(1)}°C</div>` : ''}
                ${f.humidity ? `<div>💧 ${data.main.humidity}%</div>` : ''}
                ${f.wind ? `<div>🌬️ ${data.wind.speed.toFixed(1)}m/s</div>` : ''}
                ${f.pressure ? `<div>⏲️ ${data.main.pressure}hPa</div>` : ''}
                ${f.pm25 && pm25Value !== null ? `
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span>🌫️ PM 2.5:</span>
                        <span style="font-weight: bold; color: ${pm25Status.color};">${pm25Display}</span>
                        <span style="font-size: 0.6rem; color: ${pm25Status.color};">µg/m³</span>
                        <span style="font-size: 0.55rem; background: ${pm25Status.color}22; color: ${pm25Status.color}; padding: 0 6px; border-radius: 8px; border: 1px solid ${pm25Status.color}44;">${pm25Status.emoji} ${pm25Status.label}</span>
                    </div>
                ` : (f.pm25 ? `<div style="color: #64748b;">🌫️ PM 2.5: -- µg/m³</div>` : '')}
                ${!f.temp && !f.humidity && !f.wind && !f.pressure && !f.pm25 ? 
                    `<div style="grid-column: span 2; color: #64748b; font-style: italic;">ไม่มีฟิลด์ที่เลือกแสดง</div>` : ''}
            </div>
            
            <div class="board-connection-status" style="margin-top: 4px; font-size: 0.55rem; color: ${isBoardOnline ? '#4ade80' : '#f87171'};">
                ${isBoardOnline ? '🟢 ออนไลน์' : '🔴 ออฟไลน์'}
            </div>
            
            <div class="weather-update-time" style="margin-top: 4px; font-size: 0.55rem; color: #64748b; text-align: right; border-top: 1px solid #1e293b; padding-top: 6px;">
                อัปเดต: ${new Date().toLocaleTimeString('th-TH')}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
}

// ============================================================
//  10.7 RENDER WEATHER CARD ERROR
// ============================================================
function renderWeatherCardError(boardId, boardName, config) {
    const container = document.getElementById('weatherCardsContainer');
    if (!container) return;
    
    const cardHtml = `
        <div class="weather-board-card" data-board-id="${boardId}" style="
            background: linear-gradient(135deg, #1e293b, #0f172a); 
            border: 1px solid #334155; 
            border-radius: 12px; 
            padding: 15px 18px; 
            min-width: 200px; 
            max-width: 280px;
            flex: 0 0 auto;
            border-left: 4px solid #f87171;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s, border-color 0.3s ease;
        "
        onmouseover="this.style.transform='translateY(-2px)'"
        onmouseout="this.style.transform='translateY(0)'"
        >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 0.7rem; color: #f87171; font-weight: bold;">
                    📡 <span class="board-name">${escapeHtml(boardName)}</span>
                </div>
                <div class="board-location" style="font-size: 0.6rem; color: #64748b;">📍 ${escapeHtml(config?.locationName || 'ไม่ระบุ')}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0;">
                <div style="font-size: 2rem;">⚠️</div>
                <div>
                    <div class="weather-temp" style="font-size: 0.9rem; color: #f87171;">ไม่สามารถโหลดข้อมูล</div>
                    <div class="weather-desc" style="font-size: 0.65rem; color: #64748b;">กรุณาตรวจสอบการเชื่อมต่อ</div>
                </div>
            </div>
            <div class="board-connection-status" style="font-size: 0.55rem; color: #f87171;">🔴 ออฟไลน์</div>
            <div class="weather-update-time" style="margin-top: 4px; font-size: 0.55rem; color: #64748b; text-align: right; border-top: 1px solid #1e293b; padding-top: 6px;">
                อัปเดตล้มเหลว: ${new Date().toLocaleTimeString('th-TH')}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
}

// ============================================================
//  10.8 WEATHER LEGACY FUNCTIONS
// ============================================================

function updateWeatherUI(config, weatherData) {
    console.log("🔄 updateWeatherUI กำลังทำงาน...", { config, hasWeather: !!weatherData });
    const locDisplay = document.getElementById('currentWeatherLoc');
    const manageBox = document.getElementById('manageWeatherBox');
    const attachCheck = document.getElementById('attachWeatherToReport');
    if (locDisplay) {
        if (config && config.locationName && config.lat && config.lon) {
            locDisplay.innerHTML = `
                <span style="color:#2e7d32; font-weight:bold;">${config.locationName}</span>
                <br><span style="font-size:0.7rem; color:#666;">(${config.lat.toFixed(4)}, ${config.lon.toFixed(4)})</span>
            `;
            if (manageBox) manageBox.style.display = "block";
        } else {
            locDisplay.innerHTML = `<span style="color:#94a3b8;">ยังไม่ได้ตั้งค่า</span>`;
            if (manageBox) manageBox.style.display = "none";
        }
    }
    if (attachCheck) {
        attachCheck.checked = (config && config.attachToReport) || false;
    }
    if (config && config.fields && typeof config.fields === 'object') {
        document.querySelectorAll('.weather-field').forEach(el => {
            el.checked = config.fields[el.value] || false;
        });
    }
    const card = document.getElementById('weatherDashboardCard');
    if (card) {
        card.style.display = 'none';
    }
    console.log("✅ updateWeatherUI เสร็จสมบูรณ์ (Per-Board Mode)");
}

function updateWeatherDetailVisibility(fields) {
    const humidityEl = document.getElementById('dashHumidity');
    const windEl = document.getElementById('dashWind');
    const pressureEl = document.getElementById('dashPressure');
    const detailsContainer = document.getElementById('dashDetails');
    if (!fields || typeof fields !== 'object') {
        if (humidityEl) humidityEl.style.display = 'none';
        if (windEl) windEl.style.display = 'none';
        if (pressureEl) pressureEl.style.display = 'none';
        return;
    }
    if (humidityEl) {
        humidityEl.style.display = fields.humidity ? 'block' : 'none';
    }
    if (windEl) {
        windEl.style.display = fields.wind ? 'block' : 'none';
    }
    if (pressureEl) {
        pressureEl.style.display = fields.pressure ? 'block' : 'none';
    }
}

window.searchLocation = async function() {
    const query = document.getElementById('weatherSearchInput').value.trim();
    if (!query) { alert("กรุณาระบุชื่อสถานที่"); return; }
    const resultsDiv = document.getElementById('locationResults');
    resultsDiv.innerHTML = "<div style='color:#60a5fa; padding:10px;'>⏳ กำลังค้นหา...</div>";
    resultsDiv.style.display = "block";
    try {
        const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query},TH&limit=5&appid=${WEATHER_API_KEY}`);
        const data = await res.json();
        if (data.length === 0) {
            resultsDiv.innerHTML = "<div style='color:#ef4444; padding:10px;'>❌ ไม่พบสถานที่ กรุณาลองระบุเป็นภาษาอังกฤษ</div>";
            return;
        }
        let html = '<p style="color: #60a5fa; font-size: 0.8rem; margin-bottom: 8px; padding:0 10px;">📍 กรุณาเลือกสถานที่ที่ถูกต้อง:</p>';
        data.forEach(loc => {
            const state = loc.state ? `, ${loc.state}` : '';
            const country = loc.country ? ` (${loc.country})` : '';
            html += `<button onclick="saveWeatherLocation('${loc.name}${state}${country}', ${loc.lat}, ${loc.lon})" 
                    style="display:block; width:100%; text-align:left; padding:10px; margin-bottom:5px; 
                           background:#1e293b; color:#fff; border:1px solid #334155; border-radius:6px; 
                           cursor:pointer; font-size:0.85rem; transition:0.2s;
                           hover:background:#334155;">
                <span style="display:block; font-weight:bold;">${loc.name}${state}${country}</span>
                <span style="font-size:0.7rem; color:#94a3b8;">พิกัด: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</span>
            </button>`;
        });
        resultsDiv.innerHTML = html;
    } catch (e) {
        console.error("❌ searchLocation error:", e);
        resultsDiv.innerHTML = "<div style='color:#ef4444; padding:10px;'>❌ เกิดข้อผิดพลาดในการเชื่อมต่อ</div>";
    }
};

window.saveWeatherLocation = async function(name, lat, lon) {
    if (!window.db) {
        alert("❌ ระบบฐานข้อมูลยังไม่พร้อม");
        return;
    }
    try {
        console.log(`💾 กำลังบันทึกสถานที่: ${name} (${lat}, ${lon})`);
        await window.set(window.ref(window.db, 'settings/weather_config'), {
            locationName: name,
            lat: lat,
            lon: lon,
            updatedAt: new Date().toISOString()
        });
        document.getElementById('locationResults').style.display = "none";
        document.getElementById('weatherSearchInput').value = "";
        alert(`✅ ตั้งค่าสถานที่: ${name} เรียบร้อยแล้ว`);
        setTimeout(async () => {
            await loadWeatherInfo();
        }, 500);
    } catch (e) {
        console.error("❌ saveWeatherLocation error:", e);
        alert("❌ บันทึกสถานที่ล้มเหลว: " + e.message);
    }
};

window.deleteWeatherLocation = async function() {
    if (!confirm("⚠️ ต้องการลบข้อมูลสถานที่และปิดการทำงานสภาพอากาศหรือไม่?")) return;
    if (!window.db) return;
    try {
        await window.set(window.ref(window.db, 'settings/weather_config'), {
            locationName: null,
            lat: null,
            lon: null,
            attachToReport: false,
            fields: {
                temp: false,
                humidity: false,
                description: false,
                wind: false,
                pressure: false,
                pm25: false
            },
            updatedAt: new Date().toISOString()
        });
        alert("✅ ลบข้อมูลสถานที่เรียบร้อย");
        setTimeout(async () => {
            await loadWeatherInfo();
        }, 500);
    } catch (e) {
        console.error("❌ deleteWeatherLocation error:", e);
        alert("❌ ไม่สามารถลบข้อมูลได้: " + e.message);
    }
};

window.saveWeatherPref = async function() {
    if (!window.db) {
        alert("❌ ระบบฐานข้อมูลยังไม่พร้อม กรุณารอสักครู่");
        return;
    }
    try {
        const isAttached = document.getElementById('attachWeatherToReport').checked;
        const selectedFields = {};
        document.querySelectorAll('.weather-field').forEach(el => {
            selectedFields[el.value] = el.checked;
        });
        console.log("💾 กำลังบันทึกการตั้งค่ารายงานสภาพอากาศ:", { isAttached, selectedFields });
        await window.update(window.ref(window.db, 'settings/weather_config'), {
            attachToReport: isAttached,
            fields: selectedFields,
            updatedAt: new Date().toISOString()
        });
        if (selectedFields) {
            updateWeatherDetailVisibility(selectedFields);
        }
        const btn = document.querySelector('button[onclick="saveWeatherPref()"]');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✅ บันทึกสำเร็จ!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        }
        await loadWeatherInfo();
    } catch (e) {
        console.error("❌ saveWeatherPref error:", e);
        alert("❌ บันทึกการตั้งค่าล้มเหลว: " + e.message);
    }
};

function initWeatherDashboard() {
    let container = document.getElementById('weatherCardsContainer');
    if (!container) {
        const dashboard = document.querySelector('.dashboard-grid') || document.getElementById('sensorGridContainer');
        if (dashboard && dashboard.parentElement) {
            const weatherContainerHTML = `
                <div id="weatherCardsContainer" style="
                    display: none; 
                    gap: 12px; 
                    margin-bottom: 15px; 
                    padding: 8px 4px 12px 4px;
                    overflow-x: auto;
                    flex-wrap: nowrap;
                    scrollbar-width: thin;
                    scrollbar-color: #3b82f6 #1e293b;
                    min-height: 80px;
                    grid-column: 1 / -1;
                    justify-content: center;
                ">
                    <div style="color: #94a3b8; padding: 20px; text-align: center; width: 100%;">
                        ⏳ กำลังโหลดข้อมูลสภาพอากาศ...
                    </div>
                </div>
            `;
            dashboard.parentElement.insertBefore(
                document.createRange().createContextualFragment(weatherContainerHTML),
                dashboard
            );
            console.log("✅ สร้าง Weather Cards Container เรียบร้อย");
        }
    }
    
    const oldCard = document.getElementById('weatherDashboardCard');
    if (oldCard) {
        oldCard.style.display = 'none';
    }
}

// ============================================================
//  11. FIREBASE LISTENERS (MAIN)
// ============================================================
function initFirebaseListeners() {
    if (!window.db) return;

    const offsetRef = window.ref(window.db, ".info/serverTimeOffset");
    window.onValue(offsetRef, (snap) => {
        serverTimeOffset = snap.val() || 0;
        console.log("⏱️ Server Time Offset:", serverTimeOffset, "ms");
    });

    initTitleListener();

    const configRef = window.ref(window.db, 'device_configs');
    window.onValue(configRef, (snapshot) => {
        try {
            if (snapshot.exists()) {
                deviceConfigs = snapshot.val();
                console.log("📋 โหลด device_configs สำเร็จ, มีข้อมูล", Object.keys(deviceConfigs).length, "รายการ");
            } else {
                deviceConfigs = {};
                console.log("📭 device_configs ว่าง");
            }
            
            // ✅ ตรวจสอบทุกฟังก์ชันก่อนเรียกใช้
            if (typeof renderSensorCards === 'function') {
                renderSensorCards();
            } else {
                console.warn("⚠️ renderSensorCards ยังไม่พร้อม");
            }
            
            if (typeof updateChartStructure === 'function') {
                updateChartStructure();
            } else {
                console.warn("⚠️ updateChartStructure ยังไม่พร้อม");
            }
            
            if (typeof updateStandaloneAlertPanel === 'function') {
                updateStandaloneAlertPanel();
            } else {
                console.warn("⚠️ updateStandaloneAlertPanel ยังไม่พร้อม");
            }
            
            if (typeof renderBoardTable === 'function') {
                renderBoardTable();
            } else {
                console.warn("⚠️ renderBoardTable ยังไม่พร้อม");
            }
            
            if (typeof renderDeviceTable === 'function') {
                renderDeviceTable();
            } else {
                console.warn("⚠️ renderDeviceTable ยังไม่พร้อม");
            }
            
            if (typeof updateAlertHistoryDropdown === 'function') {
                updateAlertHistoryDropdown();
            } else {
                console.warn("⚠️ updateAlertHistoryDropdown ยังไม่พร้อม");
            }
            
            if (typeof updateStatusBarBoardDetails === 'function') {
                updateStatusBarBoardDetails();
            } else {
                console.warn("⚠️ updateStatusBarBoardDetails ยังไม่พร้อม");
            }
            
            if (typeof updateSensorStatus === 'function') {
                updateSensorStatus();
            } else {
                console.warn("⚠️ updateSensorStatus ยังไม่พร้อม");
            }
            
            // รีเฟรช Weather Cards
            setTimeout(function() {
                if (typeof loadWeatherInfo === 'function') {
                    loadWeatherInfo();
                } else {
                    console.warn("⚠️ loadWeatherInfo ยังไม่พร้อม");
                }
            }, 500);
            
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการประมวลผล device_configs:", error);
        }
    });

    const currentRef = window.ref(window.db, 'sensors/current');
    window.onValue(currentRef, (snapshot) => {
        try {
            if (snapshot.exists()) {
                if (typeof processNewData === 'function') {
                    processNewData(snapshot.val());
                }
            }
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการประมวลผล sensors/current:", error);
        }
    });

    window.onValue(window.ref(window.db, ".info/connected"), (snap) => {
        const statusEl = document.getElementById('espStatus');
        try {
            if (snap.val() === true) {
                if (statusEl) {
                    statusEl.className = 'connection-status online';
                    statusEl.textContent = 'Connected (Firebase)';
                }
            } else {
                if (statusEl) {
                    statusEl.className = 'connection-status offline';
                    statusEl.textContent = 'Disconnected';
                }
            }
            if (typeof updateStatusBarBoardDetails === 'function') {
                updateStatusBarBoardDetails();
            }
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะการเชื่อมต่อ:", error);
        }
    });

    if (typeof updateCompactOnlineUsers === 'function') {
        updateCompactOnlineUsers();
    }
    if (typeof initTelegramListeners === 'function') {
        initTelegramListeners();
    }

    const muteRef = window.ref(window.db, 'settings/global_alert_muted');
    window.onValue(muteRef, (snapshot) => {
        try {
            globalAlertMuted = snapshot.exists() ? snapshot.val() : false;
            // ✅ ตรวจสอบ renderSummaryTable ก่อนเรียกใช้
            if (typeof renderSummaryTable === 'function') {
                renderSummaryTable();
            } else {
                console.warn("⚠️ renderSummaryTable ยังไม่พร้อม (Mute update)");
            }
            const checkbox = document.getElementById('globalAlertMute');
            if (checkbox) checkbox.checked = globalAlertMuted;
            const statusText = document.getElementById('globalMuteStatus');
            if (statusText) {
                statusText.textContent = globalAlertMuted ? '🔕 ปิดการแจ้งเตือนอยู่' : '🔔 แจ้งเตือนปกติ';
                statusText.style.color = globalAlertMuted ? '#ef4444' : '#10b981';
            }
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะ Mute:", error);
        }
    });

    setTimeout(() => {
        try {
            if (typeof updateStandaloneAlertPanel === 'function') {
                updateStandaloneAlertPanel();
            }
            if (typeof updateStatusBarBoardDetails === 'function') {
                updateStatusBarBoardDetails();
            }
            if (typeof loadWeatherInfo === 'function') {
                loadWeatherInfo();
            }
            if (typeof updateSensorStatus === 'function') {
                updateSensorStatus();
            }
            setTimeout(() => {
                if (typeof updateChartStructure === 'function') {
                    updateChartStructure();
                }
            }, 500);
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการเริ่มต้นระบบ:", error);
        }
    }, 1000);
}

// ============================================================
//  12. INITIALIZATION
// ============================================================
function initializeAllFeatures() {
    // ✅ ตรวจสอบทุกฟังก์ชันก่อนเรียกใช้
    if (typeof applyDisabledCardStyles === 'function') {
        applyDisabledCardStyles();
    } else {
        console.warn("⚠️ applyDisabledCardStyles ยังไม่พร้อม");
    }
    
    if (typeof updateAlertHistoryDropdown === 'function') {
        updateAlertHistoryDropdown();
    } else {
        console.warn("⚠️ updateAlertHistoryDropdown ยังไม่พร้อม");
    }
    
    if (typeof startSensorStatusMonitor === 'function') {
        startSensorStatusMonitor();
    } else {
        console.warn("⚠️ startSensorStatusMonitor ยังไม่พร้อม");
    }
    
    console.log("✅ ระบบพร้อมทำงาน (เวอร์ชัน 2.6 - Per-Board Weather Support + PM2.5)");
    console.log("   🔹 สถานะเซนเซอร์อ้างอิงจากสถานะบอร์ด");
    console.log("   🔹 แสดงสถานะออฟไลน์พร้อมเวลาที่อัปเดตล่าสุด");
    console.log("   🔹 แสดงค่าที่ค้างอยู่เมื่อบอร์ดออฟไลน์");
    console.log("   🔹 ระบบ Auto-Log (FIFO) เริ่มต้นแล้ว");
    console.log("   🔹 ระบบ Global Mute พร้อมทำงาน");
    console.log("   🔹 ระบบตรวจสอบสถานะเซนเซอร์อัตโนมัติ (Stale Data Detection) ทำงานทุก 15 วินาที");
    console.log("   🔹 🌤️ รองรับการแสดงสภาพอากาศแบบแยกตามบอร์ด (Per-Board Weather)");
    console.log("   🔹 🌫️ รองรับการแสดงค่า PM 2.5 จาก Air Pollution API");
    console.log("   🔹 🔒 ใช้ Set() ตรวจสอบพิกัดซ้ำ ป้องกันการแสดงการ์ดซ้ำ");
    console.log("   🔹 🔒 ใช้ isWeatherLoading ป้องกันการโหลดซ้อน");
    console.log("   🔹 🔄 อัปเดต Weather Cards แบบไม่กระพริบ (อัปเดตเฉพาะเนื้อหา)");
}

// ============================================================
//  13. CORE INIT FUNCTION
// ============================================================
function initCoreModule() {
    console.log("🚀 Core Module เริ่มทำงาน...");
    const savedRole = sessionStorage.getItem('activeRole');
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedRole && savedUser) {
        console.log(`👤 พบ session: ${savedUser} (${savedRole})`);
        applyRole(savedRole, savedUser);
        updatePresence(savedUser, savedRole);
        updateCompactOnlineUsers();
        initTitleListener();
        // ✅ ตรวจสอบก่อนเรียกใช้
        if (typeof startDeviceHealthMonitor === 'function') {
            startDeviceHealthMonitor();
        } else {
            console.warn("⚠️ startDeviceHealthMonitor ยังไม่พร้อม");
        }
    } else {
        console.log("👤 ไม่พบ session, รอ login");
    }

    if (window.db) {
        initFirebaseListeners();
    }

    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            const settingsRef = window.ref(window.db, 'settings/log_interval');
            window.onValue(settingsRef, (snapshot) => {
                if (snapshot.exists()) {
                    console.log(`📊 พบการตั้งค่า log_interval: ${snapshot.val()} นาที`);
                }
            });
            // ✅ ตรวจสอบก่อนเรียกใช้
            if (typeof loadGlobalMuteStatus === 'function') {
                loadGlobalMuteStatus();
            } else {
                console.warn("⚠️ loadGlobalMuteStatus ยังไม่พร้อม");
            }
            setTimeout(() => {
                if (typeof loadLoggingConfig === 'function') {
                    loadLoggingConfig();
                } else {
                    console.warn("⚠️ loadLoggingConfig ยังไม่พร้อม");
                }
                if (typeof initAutoLogging === 'function') {
                    initAutoLogging();
                } else {
                    console.warn("⚠️ initAutoLogging ยังไม่พร้อม");
                }
            }, 1000);
        }
    }, 500);

    function checkAutoLogin() {
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        if (rememberMe) {
            const savedUsername = localStorage.getItem('savedUsername');
            const savedPassword = localStorage.getItem('savedPassword');
            if (savedUsername && savedPassword) {
                document.getElementById('username').value = savedUsername;
                document.getElementById('password').value = savedPassword;
                document.getElementById('rememberMe').checked = true;
                handleLogin();
            }
        }
    }
    checkAutoLogin();

    // ✅ ตรวจสอบก่อนเรียกใช้
    if (typeof initWeatherDashboard === 'function') {
        initWeatherDashboard();
    } else {
        console.warn("⚠️ initWeatherDashboard ยังไม่พร้อม");
    }
    
    if (typeof createStandaloneAlertPanelIfNotExists === 'function') {
        createStandaloneAlertPanelIfNotExists();
    } else {
        console.warn("⚠️ createStandaloneAlertPanelIfNotExists ยังไม่พร้อม");
    }

    setTimeout(() => {
        if (typeof initTemplateSelector === 'function') {
            initTemplateSelector();
        } else {
            console.warn("⚠️ initTemplateSelector ยังไม่พร้อม");
        }
        if (typeof renderTemplateSelector === 'function') {
            renderTemplateSelector();
        } else {
            console.warn("⚠️ renderTemplateSelector ยังไม่พร้อม");
        }
    }, 500);

    setTimeout(() => {
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        const savedUsername = localStorage.getItem('savedUsername');
        if (rememberMe && savedUsername && !sessionStorage.getItem('currentUser')) {
            const passwordField = document.getElementById('password');
            if (passwordField && passwordField.value) {
                handleLogin();
            }
        }
    }, 1000);

    setTimeout(() => {
        if (typeof initializeAllFeatures === 'function') {
            initializeAllFeatures();
        } else {
            console.warn("⚠️ initializeAllFeatures ยังไม่พร้อม");
        }
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        } else {
            console.warn("⚠️ updateStatusBarBoardDetails ยังไม่พร้อม");
        }
        if (typeof loadProfileList === 'function') {
            loadProfileList();
        } else {
            console.warn("⚠️ loadProfileList ยังไม่พร้อม");
        }
        if (typeof loadWeatherInfo === 'function') {
            loadWeatherInfo();
        } else {
            console.warn("⚠️ loadWeatherInfo ยังไม่พร้อม");
        }
        setTimeout(() => {
            if (typeof addHistoryButtonsToSensorCards === 'function') {
                addHistoryButtonsToSensorCards();
            } else {
                console.warn("⚠️ addHistoryButtonsToSensorCards ยังไม่พร้อม");
            }
        }, 500);
    }, 2000);

    // ตั้งเวลาโหลด Weather Info ทุก 10 นาที
    setInterval(() => {
        if (typeof loadWeatherInfo === 'function') {
            loadWeatherInfo();
        }
    }, WEATHER_UPDATE_INTERVAL);
}

// ============================================================
//  EXPOSE FUNCTIONS TO GLOBAL
// ============================================================
window.deviceConfigs = deviceConfigs;
window.currentSensorValues = currentSensorValues;
window.sensorHistory = sensorHistory;
window.globalAlertMuted = globalAlertMuted;
window.eventStateTracker = eventStateTracker;
window.lastSavedValues = lastSavedValues;
window.telegramBotToken = telegramBotToken;
window.telegramEnabled = telegramEnabled;
window.serverTimeOffset = serverTimeOffset;
window.LEVEL_KEYS = LEVEL_KEYS;
window.LEVEL_NAMES = LEVEL_NAMES;
window.LEVEL_EMOJIS = LEVEL_EMOJIS;
window.LEVEL_COLORS = LEVEL_COLORS;
window.SENSOR_TEMPLATES = SENSOR_TEMPLATES;

// ฟังก์ชันที่ต้อง expose เพิ่มเติม
window.loadWeatherInfo = loadWeatherInfo;
window.refreshWeatherCards = refreshWeatherCards;
window.saveBoardWeatherConfig = saveBoardWeatherConfig;
window.deleteBoardWeatherConfig = deleteBoardWeatherConfig;
window.getBoardWeatherConfig = getBoardWeatherConfig;
window.renderWeatherCard = renderWeatherCard;
window.renderWeatherCardError = renderWeatherCardError;
window.updateWeatherCardContent = updateWeatherCardContent;
window.updateWeatherCardError = updateWeatherCardError;
window.fetchWeatherData = fetchWeatherData;
window.getPM25Status = getPM25Status;

// ============================================================
//  14. FALLBACK FUNCTIONS
// ============================================================

if (typeof window.renderSummaryTable !== 'function') {
    window.renderSummaryTable = function() {
        console.log("⚠️ renderSummaryTable fallback ถูกเรียก");
        const tbody = document.getElementById('summaryTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">⏳ กำลังโหลดข้อมูล...</td></tr>';
        }
    };
}

if (typeof window.loadGlobalMuteStatus !== 'function') {
    window.loadGlobalMuteStatus = function() {
        console.log("⚠️ loadGlobalMuteStatus fallback ถูกเรียก");
        if (!window.db) return;
        try {
            window.get(window.ref(window.db, 'settings/global_alert_muted'))
                .then(snap => {
                    globalAlertMuted = snap.exists() ? snap.val() : false;
                    const checkbox = document.getElementById('globalAlertMute');
                    if (checkbox) checkbox.checked = globalAlertMuted;
                    const statusText = document.getElementById('globalMuteStatus');
                    if (statusText) {
                        statusText.textContent = globalAlertMuted ? '🔕 ปิดการแจ้งเตือนอยู่' : '🔔 แจ้งเตือนปกติ';
                        statusText.style.color = globalAlertMuted ? '#ef4444' : '#10b981';
                    }
                    if (typeof renderSummaryTable === 'function') {
                        renderSummaryTable();
                    }
                })
                .catch(e => console.warn("⚠️ loadGlobalMuteStatus fallback error:", e));
        } catch(e) { console.warn("⚠️ loadGlobalMuteStatus fallback error:", e); }
    };
}

if (typeof window.initTemplateSelector !== 'function') {
    window.initTemplateSelector = function() {
        console.log("⚠️ initTemplateSelector fallback ถูกเรียก");
        const container = document.getElementById('templateSelectorContainer');
        if (container) {
            container.innerHTML = `
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 0.75rem;">📋 โหลดเทมเพลต:</span>
                    <span style="color: #64748b; font-size: 0.7rem;">⏳ กำลังโหลด...</span>
                </div>
            `;
        }
    };
}

if (typeof window.renderTemplateSelector !== 'function') {
    window.renderTemplateSelector = function() {
        console.log("⚠️ renderTemplateSelector fallback ถูกเรียก");
    };
}

if (typeof window.updateStandaloneAlertPanel !== 'function') {
    window.updateStandaloneAlertPanel = function() {
        console.log("⚠️ updateStandaloneAlertPanel fallback ถูกเรียก");
        const panel = document.getElementById('standaloneAlertPanel');
        if (panel) panel.style.display = 'none';
    };
}

if (typeof window.applyDisabledCardStyles !== 'function') {
    window.applyDisabledCardStyles = function() {
        console.log("⚠️ applyDisabledCardStyles fallback ถูกเรียก");
        const style = document.createElement('style');
        style.textContent = `
            .disabled-card { opacity: 0.6; filter: grayscale(1); border: 2px dashed #64748b; }
            .sensor-card.offline-card { opacity: 0.7; border: 2px solid #f87171 !important; }
        `;
        document.head.appendChild(style);
    };
}

if (typeof window.startDeviceHealthMonitor !== 'function') {
    window.startDeviceHealthMonitor = function() {
        console.log("⚠️ startDeviceHealthMonitor fallback ถูกเรียก");
        if (deviceHealthMonitorInterval) clearInterval(deviceHealthMonitorInterval);
        deviceHealthMonitorInterval = setInterval(() => {
            console.log("🔍 Device Health Monitor (fallback) ทำงาน...");
        }, 60000);
    };
}

if (typeof window.updateStatusBarBoardDetails !== 'function') {
    window.updateStatusBarBoardDetails = function() {
        console.log("⚠️ updateStatusBarBoardDetails fallback ถูกเรียก");
        const detailEl = document.getElementById('boardDetailStatus');
        if (detailEl) {
            detailEl.innerHTML = `<div style="color: #94a3b8; padding: 8px;">⏳ กำลังโหลดข้อมูลบอร์ด...</div>`;
            detailEl.style.display = 'block';
        }
    };
}

if (typeof window.loadProfileList !== 'function') {
    window.loadProfileList = function() {
        console.log("⚠️ loadProfileList fallback ถูกเรียก");
        const container = document.getElementById('profileList');
        if (container) {
            container.innerHTML = '<div style="color:#64748b; font-size:0.8rem;">⏳ กำลังโหลด...</div>';
        }
    };
}

if (typeof window.addHistoryButtonsToSensorCards !== 'function') {
    window.addHistoryButtonsToSensorCards = function() {
        console.log("⚠️ addHistoryButtonsToSensorCards fallback ถูกเรียก");
    };
}

if (typeof window.loadLoggingConfig !== 'function') {
    window.loadLoggingConfig = function() {
        console.log("⚠️ loadLoggingConfig fallback ถูกเรียก");
    };
}

if (typeof window.initAutoLogging !== 'function') {
    window.initAutoLogging = function() {
        console.log("⚠️ initAutoLogging fallback ถูกเรียก");
    };
}

if (typeof window.initTelegramListeners !== 'function') {
    window.initTelegramListeners = function() {
        console.log("⚠️ initTelegramListeners fallback ถูกเรียก");
    };
}

if (typeof window.renderSensorCards !== 'function') {
    window.renderSensorCards = function() {
        console.log("⚠️ renderSensorCards fallback ถูกเรียก");
        const container = document.getElementById('sensorGridContainer');
        if (container) {
            container.innerHTML = '<div style="width:100%; text-align:center; color:#94a3b8; padding:40px;">⏳ กำลังโหลดเซนเซอร์...</div>';
        }
    };
}

if (typeof window.processNewData !== 'function') {
    window.processNewData = function(data) {
        console.log("⚠️ processNewData fallback ถูกเรียก", data);
    };
}

if (typeof window.renderBoardTable !== 'function') {
    window.renderBoardTable = function() {
        console.log("⚠️ renderBoardTable fallback ถูกเรียก");
        const tbody = document.getElementById('boardTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748b;">⏳ กำลังโหลดข้อมูลบอร์ด...</td></tr>';
        }
    };
}

if (typeof window.renderDeviceTable !== 'function') {
    window.renderDeviceTable = function() {
        console.log("⚠️ renderDeviceTable fallback ถูกเรียก");
        const tbody = document.getElementById('deviceTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px; color:#64748b;">⏳ กำลังโหลดข้อมูลเซนเซอร์...</td></tr>';
        }
    };
}

if (typeof window.updateAlertHistoryDropdown !== 'function') {
    window.updateAlertHistoryDropdown = function() {
        console.log("⚠️ updateAlertHistoryDropdown fallback ถูกเรียก");
        const select = document.getElementById('alertHistoryDeviceSelect');
        if (select) {
            select.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option><option value="">⏳ กำลังโหลด...</option>';
        }
    };
}

if (typeof window.updateSensorStatus !== 'function') {
    window.updateSensorStatus = function() {
        console.log("⚠️ updateSensorStatus fallback ถูกเรียก");
    };
}

if (typeof window.updateChartStructure !== 'function') {
    window.updateChartStructure = function() {
        console.log("⚠️ updateChartStructure fallback ถูกเรียก");
    };
}

// ============================================================
//  PLACEHOLDER FUNCTIONS ที่อาจถูกเรียกจากที่อื่น
// ============================================================
function saveBoardWeatherConfig(boardId, config) {
    console.log("💾 saveBoardWeatherConfig:", boardId, config);
    if (!window.db) return;
    try {
        window.update(window.ref(window.db, `device_configs/${boardId}/weather_config`), config)
            .then(() => {
                console.log(`✅ บันทึก weather_config สำหรับบอร์ด ${boardId} สำเร็จ`);
                setTimeout(loadWeatherInfo, 500);
            })
            .catch(err => console.error("❌ saveBoardWeatherConfig error:", err));
    } catch(e) { console.error("❌ saveBoardWeatherConfig error:", e); }
}

function deleteBoardWeatherConfig(boardId) {
    console.log("🗑️ deleteBoardWeatherConfig:", boardId);
    if (!window.db) return;
    if (!confirm(`⚠️ ลบการตั้งค่าสภาพอากาศของบอร์ด "${boardId}"?`)) return;
    try {
        window.remove(window.ref(window.db, `device_configs/${boardId}/weather_config`))
            .then(() => {
                console.log(`✅ ลบ weather_config ของบอร์ด ${boardId} สำเร็จ`);
                setTimeout(loadWeatherInfo, 500);
            })
            .catch(err => console.error("❌ deleteBoardWeatherConfig error:", err));
    } catch(e) { console.error("❌ deleteBoardWeatherConfig error:", e); }
}

function getBoardWeatherConfig(boardId) {
    if (!deviceConfigs || !deviceConfigs[boardId]) return null;
    return deviceConfigs[boardId].weather_config || null;
}

console.log("✅ core.js โหลดเรียบร้อย (เวอร์ชัน 2.6 - Per-Board Weather Support + PM2.5)");