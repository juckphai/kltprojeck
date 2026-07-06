// ============================================================
//  KLT Smart Farm Station - Storage Monitor Module
//  Version: 2.4 (Collapsible with Hide Button)
// ============================================================

// ============================================================
//  1. STORAGE ESTIMATOR
// ============================================================

let storageEstimate = {
    totalBytes: 0,
    usedBytes: 0,
    usedMB: 0,
    totalMB: 0,
    percentUsed: 0,
    estimatedRecords: 0,
    estimatedDays: 0,
    limitBytes: 0,
    lastUpdated: null
};

// ค่าโดยประมาณของ Firebase Realtime Database (ประมาณ 1GB)
const FIREBASE_STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

// ค่าเฉลี่ยของแต่ละ record (โดยประมาณ)
const AVG_RECORD_SIZE_BYTES = 500;

// ✅ ตัวแปรเก็บสถานะการเลือกหัวข้อที่จะลบ
let selectedCleanupNodes = {};
let isStorageStatsVisible = false; // ตัวแปรควบคุมการแสดงผล

// ✅ รายการหัวข้อที่สามารถลบได้ (ยกเว้น settings, users, device_configs ที่สำคัญ)
const CLEANABLE_NODES = [
    'sensor_history',
    'alert_history',
    'online_users',
    'sensor_profiles',
    'device_configs_backup',
    'settings/telegram/history',
    'sensor_history_archive',
];

// ✅ รายการหัวข้อที่ห้ามลบ (การตั้งค่าที่สำคัญ)
const PROTECTED_NODES = [
    'device_configs',
    'users',
    'settings',
];

// ✅ รายการหัวข้อและคำอธิบาย
const NODE_INFO = {
    'sensor_history': {
        name: '📊 ประวัติเซนเซอร์',
        description: 'ข้อมูลประวัติการวัดค่าจากเซนเซอร์ทั้งหมด (มีขนาดใหญ่)',
        icon: '📊',
        color: '#3b82f6'
    },
    'alert_history': {
        name: '🔔 ประวัติการแจ้งเตือน',
        description: 'ประวัติการแจ้งเตือนทั้งหมดที่เคยเกิดขึ้น',
        icon: '🔔',
        color: '#ef4444'
    },
    'online_users': {
        name: '🟢 ผู้ใช้ออนไลน์',
        description: 'สถานะผู้ใช้ที่กำลังออนไลน์ (ข้อมูลชั่วคราว)',
        icon: '🟢',
        color: '#22c55e'
    },
    'sensor_profiles': {
        name: '📁 โปรไฟล์เซนเซอร์',
        description: 'โปรไฟล์เซนเซอร์ที่ผู้ใช้บันทึกไว้',
        icon: '📁',
        color: '#8b5cf6'
    },
    'device_configs_backup': {
        name: '📦 ข้อมูลสำรองอุปกรณ์',
        description: 'ข้อมูลสำรองการตั้งค่าอุปกรณ์เก่า',
        icon: '📦',
        color: '#f59e0b'
    },
    'settings/telegram/history': {
        name: '💬 ประวัติ Telegram',
        description: 'ประวัติการส่งข้อความทาง Telegram',
        icon: '💬',
        color: '#3b82f6'
    },
    'sensor_history_archive': {
        name: '📦 ประวัติเซนเซอร์ (เก็บถาวร)',
        description: 'ข้อมูลประวัติเซนเซอร์ที่ถูกเก็บถาวร',
        icon: '📦',
        color: '#6b7280'
    }
};

// ============================================================
//  2. ฟังก์ชันหลัก
// ============================================================

async function estimateStorageUsage() {
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม");
        return null;
    }
    
    try {
        console.log("📊 กำลังประมาณการพื้นที่จัดเก็บ...");
        
        let totalBytes = 0;
        let totalRecords = 0;
        let nodeSizes = {};
        let nodeRecords = {};
        
        // ✅ ตรวจสอบทุกหัวข้อ
        const allNodes = [
            'device_configs',
            'sensor_history',
            'alert_history',
            'users',
            'settings',
            'online_users',
            'sensor_profiles',
            'device_configs_backup',
            'settings/telegram/history',
            'sensor_history_archive'
        ];
        
        for (const node of allNodes) {
            try {
                const snap = await window.get(window.ref(window.db, node));
                if (snap.exists()) {
                    const data = snap.val();
                    const jsonStr = JSON.stringify(data);
                    const bytes = new Blob([jsonStr]).size;
                    totalBytes += bytes;
                    nodeSizes[node] = bytes;
                    nodeRecords[node] = Object.keys(data).length;
                    totalRecords += Object.keys(data).length;
                }
            } catch (e) {
                // ข้าม node ที่ไม่มี
            }
        }
        
        // ✅ คำนวณค่าต่างๆ
        const usedMB = totalBytes / (1024 * 1024);
        const totalMB = FIREBASE_STORAGE_LIMIT_BYTES / (1024 * 1024);
        const percentUsed = (totalBytes / FIREBASE_STORAGE_LIMIT_BYTES) * 100;
        
        // ✅ ประมาณการจำนวน record ที่เหลือ
        const estimatedRemainingRecords = Math.floor((FIREBASE_STORAGE_LIMIT_BYTES - totalBytes) / AVG_RECORD_SIZE_BYTES);
        
        // ✅ ประมาณการวันที่จะใช้ได้
        const growthRate = await estimateGrowthRate();
        let estimatedDays = 0;
        if (growthRate > 0) {
            const remainingBytes = FIREBASE_STORAGE_LIMIT_BYTES - totalBytes;
            estimatedDays = Math.floor(remainingBytes / growthRate);
        }
        
        storageEstimate = {
            totalBytes: totalBytes,
            usedBytes: totalBytes,
            usedMB: usedMB,
            totalMB: totalMB,
            percentUsed: percentUsed,
            estimatedRecords: estimatedRemainingRecords,
            estimatedDays: estimatedDays,
            limitBytes: FIREBASE_STORAGE_LIMIT_BYTES,
            lastUpdated: new Date().toISOString(),
            nodeSizes: nodeSizes,
            nodeRecords: nodeRecords,
            totalRecords: totalRecords
        };
        
        console.log(`✅ ประมาณการพื้นที่สำเร็จ: ${usedMB.toFixed(2)} MB / ${totalMB.toFixed(0)} MB (${percentUsed.toFixed(1)}%)`);
        
        return storageEstimate;
        
    } catch (error) {
        console.error("❌ estimateStorageUsage error:", error);
        return null;
    }
}

// ============================================================
//  3. ประมาณการอัตราการเติบโต
// ============================================================

async function estimateGrowthRate() {
    try {
        const snap = await window.get(window.ref(window.db, 'sensor_history'));
        if (!snap.exists()) return 0;
        
        const data = snap.val();
        const keys = Object.keys(data);
        if (keys.length < 10) return 0;
        
        const sortedKeys = keys.sort();
        const totalBytes = new Blob([JSON.stringify(data)]).size;
        const avgBytesPerRecord = totalBytes / keys.length;
        
        let firstTimestamp = null;
        let lastTimestamp = null;
        
        for (const key of sortedKeys) {
            const item = data[key];
            if (item && item.timestamp) {
                const ts = new Date(item.timestamp).getTime();
                if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
                if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
            }
        }
        
        if (firstTimestamp && lastTimestamp && lastTimestamp > firstTimestamp) {
            const daysDiff = (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24);
            if (daysDiff > 0) {
                const recordsPerDay = keys.length / daysDiff;
                const bytesPerDay = recordsPerDay * avgBytesPerRecord;
                console.log(`📈 อัตราเติบโต: ~${bytesPerDay.toFixed(0)} bytes/วัน`);
                return bytesPerDay;
            }
        }
        
        return avgBytesPerRecord * 10;
    } catch (e) {
        console.warn("⚠️ estimateGrowthRate error:", e);
        return 0;
    }
}

// ============================================================
//  4. UI RENDER FUNCTIONS - แบบมีปุ่มตรวจสอบและปุ่มยุบ
// ============================================================

// ฟังก์ชันนี้จะถูกเรียกเมื่อคลิกปุ่ม "ตรวจสอบ"
async function showStorageStats() {
    const container = document.getElementById('storageStatsContainer');
    if (!container) return;

    // แสดงสถานะกำลังโหลด
    container.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; text-align: center;">
            <span style="font-size: 2rem;">⏳</span>
            <div style="color: #0f172a; margin-top: 8px; font-weight: 600;">กำลังตรวจสอบพื้นที่จัดเก็บ...</div>
        </div>
    `;

    isStorageStatsVisible = true;
    await refreshStorageStats();
}

// ฟังก์ชันซ่อนข้อมูล (กลับไปแสดงปุ่มตรวจสอบ)
function hideStorageStats() {
    const container = document.getElementById('storageStatsContainer');
    if (!container) return;
    
    isStorageStatsVisible = false;
    // แสดงเฉพาะปุ่มตรวจสอบ
    container.innerHTML = `
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                <span style="font-size: 1.3rem;">💾</span>
                <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.75rem; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">พื้นที่จัดเก็บ Firebase</div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
                        <button onclick="showStorageStats()" class="storage-monitor-btn" style="
                            background: #2563eb; 
                            color: #ffffff; 
                            border: none; 
                            padding: 5px 18px; 
                            border-radius: 6px; 
                            cursor: pointer; 
                            font-size: 0.8rem;
                            font-weight: 600;
                            transition: 0.2s;
                            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
                        " onmouseover="this.style.background='#1d4ed8'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='#2563eb'; this.style.transform='scale(1)'">
                            🔍 ตรวจสอบ
                        </button>
                        <span style="font-size: 0.7rem; color: #94a3b8;">คลิกเพื่อดูรายละเอียดพื้นที่จัดเก็บ</span>
                    </div>
                </div>
                <div style="text-align: right; margin-left: auto; background: #f1f5f9; padding: 4px 14px; border-radius: 12px;">
                    <div style="font-size: 0.6rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">สถานะ</div>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">⏸️ ยังไม่ได้ตรวจสอบ</div>
                </div>
            </div>
        </div>
    `;
}

function renderStorageStats(data) {
    if (!data) {
        return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 30px; text-align: center;">
                <span style="font-size: 2rem;">📊</span>
                <div style="color: #1a202c; margin-top: 8px; font-weight: 600;">ไม่สามารถคำนวณพื้นที่จัดเก็บได้</div>
                <div style="font-size: 0.85rem; color: #64748b;">กรุณารีเฟรชและลองใหม่</div>
                <button onclick="hideStorageStats()" style="margin-top: 12px; background: #64748b; color: white; border: none; padding: 6px 18px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">🔙 กลับ</button>
            </div>
        `;
    }
    
    const usedMB = data.usedMB || 0;
    const totalMB = data.totalMB || 1024;
    const percent = data.percentUsed || 0;
    const remainingMB = totalMB - usedMB;
    
    let color = '#22c55e';
    let statusText = '✅ พื้นที่เพียงพอ';
    let statusColor = '#22c55e';
    if (percent > 80) {
        color = '#dc2626';
        statusColor = '#dc2626';
        statusText = '⚠️ พื้นที่ใกล้เต็ม!';
    } else if (percent > 60) {
        color = '#f59e0b';
        statusColor = '#f59e0b';
        statusText = '⚡ ควรพิจารณาจัดการข้อมูล';
    }
    
    // ✅ รายละเอียดแต่ละส่วนพร้อมปุ่มเลือกและปุ่มเคลียร์
    let nodeDetails = '';
    let totalSelectedSize = 0;
    let totalSelectedCount = 0;
    let cleanableNodes = [];
    
    if (data.nodeSizes) {
        // ✅ กรองเฉพาะหัวข้อที่สามารถลบได้
        for (const key of Object.keys(data.nodeSizes)) {
            if (data.nodeSizes[key] > 0) {
                const isCleanable = CLEANABLE_NODES.some(n => key === n || key.startsWith(n + '/'));
                if (isCleanable) {
                    cleanableNodes.push(key);
                }
            }
        }
        
        // ✅ เรียงตามขนาด
        cleanableNodes.sort((a, b) => (data.nodeSizes[b] || 0) - (data.nodeSizes[a] || 0));
        
        if (cleanableNodes.length > 0) {
            nodeDetails = `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 0.8rem; color: #475569; font-weight: 700;">🗑️ ข้อมูลที่สามารถลบได้:</div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="selectAllCleanupNodes(true)" style="background: #e2e8f0; color: #0f172a; border: none; padding: 4px 14px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">☑️ เลือกทั้งหมด</button>
                            <button onclick="selectAllCleanupNodes(false)" style="background: #e2e8f0; color: #0f172a; border: none; padding: 4px 14px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">☐ ยกเลิก</button>
                        </div>
                    </div>
                    
                    <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 10px; padding: 6px 12px; background: #f1f5f9; border-radius: 4px;">
                        💡 เลือกหัวข้อที่ต้องการลบแล้วกดปุ่ม "🗑️ เคลียร์ที่เลือก" ด้านล่าง
                        <span style="color: #dc2626; font-weight: 600;"> (⚠️ การลบไม่สามารถกู้คืนได้)</span>
                    </div>
            `;
            
            for (const key of cleanableNodes) {
                const bytes = data.nodeSizes[key] || 0;
                const mb = bytes / (1024 * 1024);
                const records = data.nodeRecords?.[key] || 0;
                const percentOfTotal = (bytes / data.totalBytes * 100) || 0;
                const isSelected = selectedCleanupNodes[key] || false;
                
                const info = NODE_INFO[key] || { 
                    name: key, 
                    description: '', 
                    icon: '📄',
                    color: '#64748b'
                };
                
                if (isSelected) {
                    totalSelectedSize += bytes;
                    totalSelectedCount++;
                }
                
                let barColor = '#22c55e';
                if (percentOfTotal > 30) barColor = '#f59e0b';
                if (percentOfTotal > 50) barColor = '#dc2626';
                
                nodeDetails += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 8px; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; background: ${isSelected ? '#fef2f2' : 'transparent'}; border-radius: 6px; transition: 0.2s;"
                         onmouseover="this.style.background='${isSelected ? '#fef2f2' : '#f8fafc'}'"
                         onmouseout="this.style.background='${isSelected ? '#fef2f2' : 'transparent'}'">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                            <input type="checkbox" 
                                   class="cleanup-node-checkbox" 
                                   data-node="${key}"
                                   ${isSelected ? 'checked' : ''}
                                   onchange="toggleCleanupNode('${key}')"
                                   style="width: 18px; height: 18px; cursor: pointer; accent-color: #dc2626; flex-shrink: 0;">
                            <div style="min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                    <span style="color: #0f172a; font-weight: 600;">${info.icon} ${info.name}</span>
                                    <span style="color: #64748b; font-size: 0.65rem;">${info.description}</span>
                                    ${isSelected ? `<span style="color: #dc2626; font-weight: 700; font-size: 0.7rem; background: #fecaca; padding: 1px 8px; border-radius: 10px;">🗑️ เลือก</span>` : ''}
                                </div>
                                <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">
                                    📄 ${records.toLocaleString()} รายการ
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                            <div style="width: 80px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${Math.min(percentOfTotal, 100)}%; height: 100%; background: ${barColor}; border-radius: 3px;"></div>
                            </div>
                            <span style="color: #0f172a; font-weight: 600; min-width: 60px; text-align: right;">${mb.toFixed(2)} MB</span>
                            <span style="color: #64748b; font-size: 0.65rem; min-width: 35px; text-align: right;">${percentOfTotal.toFixed(1)}%</span>
                            <button onclick="quickClearNode('${key}')" 
                                    style="background: #dc2626; color: white; border: none; padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 0.65rem; font-weight: 600; transition: 0.2s; opacity: 0.7;"
                                    onmouseover="this.style.opacity='1'; this.style.transform='scale(1.05)'"
                                    onmouseout="this.style.opacity='0.7'; this.style.transform='scale(1)'"
                                    title="ลบหัวข้อนี้ทันที">
                                🗑️ เคลียร์
                            </button>
                        </div>
                    </div>
                `;
            }
            nodeDetails += `</div>`;
        } else {
            nodeDetails = `
                <div style="margin-top: 16px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
                    <span style="font-size: 1.5rem;">✅</span>
                    <div style="color: #16a34a; font-weight: 600; margin-top: 4px;">ไม่มีข้อมูลที่สามารถลบได้</div>
                    <div style="color: #64748b; font-size: 0.8rem;">ข้อมูลทั้งหมดเป็นการตั้งค่าที่จำเป็น</div>
                </div>
            `;
        }
    }
    
    // ✅ แสดงผลรวมที่เลือก
    let selectedSummary = '';
    if (totalSelectedCount > 0) {
        const selectedMB = totalSelectedSize / (1024 * 1024);
        selectedSummary = `
            <div style="margin-top: 12px; padding: 14px 18px; background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span style="font-weight: 700; color: #991b1b; font-size: 1rem;">🗑️ เลือกแล้ว ${totalSelectedCount} หัวข้อ</span>
                        <span style="color: #64748b; margin-left: 12px; font-size: 0.9rem;">ขนาดรวม: <span style="font-weight: 700; color: #dc2626;">${selectedMB.toFixed(2)} MB</span></span>
                        <span style="color: #64748b; margin-left: 12px; font-size: 0.8rem;">📄 ${totalSelectedCount} หัวข้อ</span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="executeSelectedCleanupNodes()" style="background: #dc2626; color: #ffffff; border: none; padding: 8px 28px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: 0.2s; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);" 
                                onmouseover="this.style.background='#b91c1c'; this.style.transform='scale(1.02)'" 
                                onmouseout="this.style.background='#dc2626'; this.style.transform='scale(1)'">
                            🗑️ เคลียร์ที่เลือก (${totalSelectedCount})
                        </button>
                        <button onclick="selectAllCleanupNodes(false)" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem;" 
                                onmouseover="this.style.background='#e2e8f0'">
                            ☐ ยกเลิกทั้งหมด
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ประมาณการวันที่จะใช้ได้
    let daysEstimateHtml = '';
    if (data.estimatedDays && data.estimatedDays > 0) {
        let daysColor = '#22c55e';
        if (data.estimatedDays < 30) daysColor = '#dc2626';
        else if (data.estimatedDays < 90) daysColor = '#f59e0b';
        
        daysEstimateHtml = `
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 16px; background: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.85rem; color: #475569;">📅 คาดว่าใช้งานได้อีก</span>
                <span style="font-weight: 700; color: ${daysColor}; font-size: 1.2rem;">${data.estimatedDays.toLocaleString()}</span>
                <span style="font-size: 0.85rem; color: #475569;">วัน (โดยประมาณ)</span>
            </div>
        `;
    }
    
    return `
        <div style="background: #ffffff; border-radius: 12px; padding: 20px 24px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;">💾</span>
                    <span style="font-weight: 700; color: #0f172a; font-size: 1.1rem;">พื้นที่จัดเก็บ Firebase</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 3px 12px; border-radius: 12px;">อัปเดต: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString('th-TH') : '-'}</span>
                    <button onclick="hideStorageStats()" style="background: #64748b; color: white; border: none; padding: 3px 14px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600; transition: 0.2s;" onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#64748b'">
                        🔼 ซ่อน
                    </button>
                </div>
            </div>
            
            <!-- Progress Bar -->
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #475569; margin-bottom: 6px;">
                    <span style="color: #0f172a; font-weight: 600;">ใช้ไป <span style="color: #2563eb; font-weight: 700;">${usedMB.toFixed(2)}</span> MB / <span style="color: #475569;">${totalMB.toFixed(0)}</span> MB</span>
                    <span style="color: ${color}; font-weight: 700; font-size: 1rem;">${percent.toFixed(1)}%</span>
                </div>
                <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="width: ${Math.min(percent, 100)}%; height: 100%; background: ${color}; border-radius: 6px; transition: width 0.6s ease; box-shadow: 0 0 16px ${color}60;"></div>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px;">
                <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">พื้นที่ว่าง</div>
                    <div style="font-weight: 700; color: #16a34a; font-size: 1.15rem;">${remainingMB.toFixed(2)} MB</div>
                </div>
                <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">สถานะ</div>
                    <div style="font-weight: 700; color: ${statusColor}; font-size: 1.05rem;">${statusText}</div>
                </div>
                <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">จำนวนเรคคอร์ด</div>
                    <div style="font-weight: 700; color: #2563eb; font-size: 1.15rem;">${(data.totalRecords || 0).toLocaleString()}</div>
                </div>
                <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">คาดการณ์ record ที่เหลือ</div>
                    <div style="font-weight: 700; color: #d97706; font-size: 1.05rem;">${(data.estimatedRecords || 0).toLocaleString()}</div>
                </div>
            </div>
            
            ${daysEstimateHtml}
            
            <!-- Node Details with Checkboxes and Clear Buttons -->
            ${nodeDetails}
            
            <!-- Selected Summary -->
            ${selectedSummary}
            
            <!-- Footer Buttons -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e2e8f0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button onclick="refreshStorageStats()" style="background: #2563eb; color: #ffffff; border: none; padding: 8px 22px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: 0.2s; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);" 
                        onmouseover="this.style.background='#1d4ed8'; this.style.transform='scale(1.02)'" 
                        onmouseout="this.style.background='#2563eb'; this.style.transform='scale(1)'">
                    🔄 ตรวจสอบใหม่
                </button>
                <button onclick="showStorageRecommendations()" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; padding: 8px 22px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: 0.2s;" 
                        onmouseover="this.style.background='#e2e8f0'" 
                        onmouseout="this.style.background='#f1f5f9'">
                    💡 คำแนะนำ
                </button>
                <span style="font-size: 0.65rem; color: #94a3b8; margin-left: auto;">
                    * คำนวณจากขนาดข้อมูลปัจจุบัน (โดยประมาณ)
                </span>
            </div>
        </div>
    `;
}

// ============================================================
//  5. CLEANUP FUNCTIONS
// ============================================================

// ✅ toggle การเลือกหัวข้อ
window.toggleCleanupNode = function(nodeKey) {
    if (selectedCleanupNodes[nodeKey]) {
        delete selectedCleanupNodes[nodeKey];
    } else {
        selectedCleanupNodes[nodeKey] = true;
    }
    // รีเฟรชการแสดงผลโดยไม่ต้องโหลดข้อมูลใหม่
    const container = document.getElementById('storageStatsContainer');
    if (container && storageEstimate.lastUpdated && isStorageStatsVisible) {
        container.innerHTML = renderStorageStats(storageEstimate);
    }
};

// ✅ เลือกทั้งหมด / ยกเลิกทั้งหมด (เฉพาะหัวข้อที่ลบได้)
window.selectAllCleanupNodes = function(selectAll) {
    const data = storageEstimate;
    if (!data || !data.nodeSizes) return;
    
    if (selectAll) {
        // เลือกทุกหัวข้อที่สามารถลบได้และมีข้อมูล
        for (const key of Object.keys(data.nodeSizes)) {
            if (data.nodeSizes[key] > 0) {
                const isCleanable = CLEANABLE_NODES.some(n => key === n || key.startsWith(n + '/'));
                if (isCleanable) {
                    selectedCleanupNodes[key] = true;
                }
            }
        }
    } else {
        selectedCleanupNodes = {};
    }
    // รีเฟรชการแสดงผล
    const container = document.getElementById('storageStatsContainer');
    if (container && storageEstimate.lastUpdated && isStorageStatsVisible) {
        container.innerHTML = renderStorageStats(storageEstimate);
    }
};

// ✅ เคลียร์หัวข้อเดียวทันที
window.quickClearNode = async function(nodeKey) {
    const data = storageEstimate;
    if (!data || !data.nodeSizes) return;
    
    const bytes = data.nodeSizes[nodeKey] || 0;
    const mb = bytes / (1024 * 1024);
    const records = data.nodeRecords?.[nodeKey] || 0;
    const info = NODE_INFO[nodeKey] || { name: nodeKey, icon: '📄' };
    
    const confirmMsg = 
        `⚠️ คุณกำลังจะลบ: ${info.icon} ${info.name}\n\n` +
        `📄 จำนวนเรคคอร์ด: ${records.toLocaleString()} รายการ\n` +
        `💾 ขนาด: ${mb.toFixed(2)} MB\n\n` +
        `❌ การดำเนินการนี้ไม่สามารถกู้คืนได้!\n\n` +
        `ยืนยันการลบ?`;
    
    if (!confirm(confirmMsg)) return;
    
    // ยืนยันด้วยรหัส
    const code = prompt(`🔑 กรอกรหัสยืนยัน "55555" เพื่อดำเนินการลบ:`);
    if (code !== "55555") {
        alert("❌ รหัสยืนยันไม่ถูกต้อง ยกเลิกการลบ");
        return;
    }
    
    try {
        console.log(`🗑️ กำลังลบ ${nodeKey}...`);
        await window.remove(window.ref(window.db, nodeKey));
        
        // ✅ ลบออกจากการเลือก
        delete selectedCleanupNodes[nodeKey];
        
        alert(`✅ ลบ ${info.name} สำเร็จ!\n\n💾 พื้นที่ว่างเพิ่มขึ้น ${mb.toFixed(2)} MB`);
        
        // ✅ รีเฟรชข้อมูลและ UI
        await refreshStorageStats();
        
        // ✅ รีเฟรชส่วนอื่นๆ
        refreshAfterCleanup();
        
    } catch (error) {
        console.error("❌ quickClearNode error:", error);
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
};

// ✅ ดำเนินการลบหัวข้อที่เลือก
window.executeSelectedCleanupNodes = async function() {
    const selectedKeys = Object.keys(selectedCleanupNodes);
    if (selectedKeys.length === 0) {
        alert("⚠️ กรุณาเลือกหัวข้อที่ต้องการลบก่อน");
        return;
    }
    
    // คำนวณขนาดที่จะลบ
    let totalSize = 0;
    let totalRecords = 0;
    const data = storageEstimate;
    if (data && data.nodeSizes) {
        for (const key of selectedKeys) {
            totalSize += data.nodeSizes[key] || 0;
            totalRecords += data.nodeRecords?.[key] || 0;
        }
    }
    const sizeMB = totalSize / (1024 * 1024);
    
    // รายการหัวข้อที่เลือก
    let nodeList = '';
    for (const key of selectedKeys) {
        const info = NODE_INFO[key] || { name: key, icon: '📄' };
        nodeList += `   • ${info.icon} ${info.name}\n`;
    }
    
    const confirmMsg = 
        `⚠️ คำเตือน! คุณกำลังจะลบข้อมูลดังต่อไปนี้:\n\n` +
        `📋 หัวข้อที่เลือก:\n${nodeList}\n` +
        `📄 จำนวนเรคคอร์ด: ${totalRecords.toLocaleString()} รายการ\n` +
        `💾 ขนาดที่จะลบ: ${sizeMB.toFixed(2)} MB\n\n` +
        `❌ การดำเนินการนี้ไม่สามารถกู้คืนได้!\n\n` +
        `ยืนยันการลบ?`;
    
    if (!confirm(confirmMsg)) return;
    
    // ยืนยันด้วยรหัส
    const code = prompt(`🔑 กรอกรหัสยืนยัน "55555" เพื่อดำเนินการลบ:`);
    if (code !== "55555") {
        alert("❌ รหัสยืนยันไม่ถูกต้อง ยกเลิกการลบ");
        return;
    }
    
    try {
        let successCount = 0;
        let failCount = 0;
        const failedItems = [];
        
        for (const key of selectedKeys) {
            try {
                console.log(`🗑️ กำลังลบ ${key}...`);
                await window.remove(window.ref(window.db, key));
                successCount++;
                console.log(`✅ ลบ ${key} สำเร็จ`);
            } catch (err) {
                failCount++;
                failedItems.push(key);
                console.error(`❌ ลบ ${key} ล้มเหลว:`, err);
            }
        }
        
        // ✅ เคลียร์การเลือก
        selectedCleanupNodes = {};
        
        let message = '';
        if (failCount === 0) {
            message = `✅ ลบข้อมูลสำเร็จ ${successCount} หัวข้อ!\n\n💾 พื้นที่ว่างเพิ่มขึ้นประมาณ ${sizeMB.toFixed(2)} MB`;
        } else {
            message = `⚠️ ลบสำเร็จ ${successCount} หัวข้อ, ล้มเหลว ${failCount} หัวข้อ\n\n❌ หัวข้อที่ล้มเหลว:\n${failedItems.join('\n')}`;
        }
        alert(message);
        
        // ✅ รีเฟรชข้อมูลและ UI
        await refreshStorageStats();
        
        // ✅ รีเฟรชส่วนอื่นๆ
        refreshAfterCleanup();
        
    } catch (error) {
        console.error("❌ executeSelectedCleanupNodes error:", error);
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
};

// ✅ รีเฟรชส่วนอื่นๆ ของระบบหลังจากลบข้อมูล
function refreshAfterCleanup() {
    const refreshFunctions = [
        'renderDeviceTable',
        'renderBoardTable', 
        'renderSensorCards',
        'updateStandaloneAlertPanel',
        'renderSummaryTable',
        'updateStatusBarBoardDetails',
        'loadTelegramHistory',
        'loadTelegramSchedules',
        'loadAlertHistory'
    ];
    
    for (const fn of refreshFunctions) {
        if (typeof window[fn] === 'function') {
            try { window[fn](); } catch (e) { /* ignore */ }
        }
    }
    
    if (typeof loadWeatherInfo === 'function') {
        setTimeout(loadWeatherInfo, 1000);
    }
    
    console.log("✅ รีเฟรช UI หลังเคลียร์ข้อมูลเสร็จสมบูรณ์");
}

// ============================================================
//  6. คำแนะนำในการจัดการพื้นที่
// ============================================================

function showStorageRecommendations() {
    const data = storageEstimate;
    if (!data) {
        alert("⚠️ กรุณาตรวจสอบพื้นที่จัดเก็บก่อน (กดปุ่ม 🔄 ตรวจสอบใหม่)");
        return;
    }
    
    const usedPercent = data.percentUsed || 0;
    let recommendations = [];
    
    if (usedPercent > 80) {
        recommendations.push('⚠️ <b>พื้นที่ใกล้เต็ม!</b> ควรดำเนินการล้างข้อมูลเก่าทันที');
        recommendations.push('📊 ใช้ระบบ Cleanup ด้านบนเพื่อเลือกเคลียร์ข้อมูลแต่ละส่วน');
        recommendations.push('🗑️ ล้างประวัติการแจ้งเตือนที่ไม่จำเป็น (🔔 ประวัติการแจ้งเตือน)');
    }
    
    if (usedPercent > 60) {
        recommendations.push('⚡ พิจารณาลดความถี่ในการบันทึก Auto-Log (ตั้งค่าในแท็บ ตั้งค่าระบบ &amp; สำรองข้อมูล)');
        recommendations.push('📦 ใช้ฟังก์ชัน "สร้างไฟล์สำรองข้อมูล" และลบข้อมูลเก่าใน Firebase');
    }
    
    // ตรวจสอบขนาดของแต่ละส่วน
    if (data.nodeSizes) {
        const historySize = data.nodeSizes['sensor_history'] || 0;
        const alertSize = data.nodeSizes['alert_history'] || 0;
        const backupSize = data.nodeSizes['device_configs_backup'] || 0;
        const telegramSize = data.nodeSizes['settings/telegram/history'] || 0;
        
        if (historySize > 5 * 1024 * 1024) {
            recommendations.push(`📊 ประวัติเซนเซอร์มีขนาด ${(historySize / (1024*1024)).toFixed(1)} MB ควรตั้งค่า Auto-Log ให้เก็บข้อมูลน้อยลง`);
        }
        if (alertSize > 2 * 1024 * 1024) {
            recommendations.push(`🔔 ประวัติการแจ้งเตือนมีขนาด ${(alertSize / (1024*1024)).toFixed(1)} MB ควรล้างประวัติเก่า`);
        }
        if (backupSize > 1 * 1024 * 1024) {
            recommendations.push(`📦 ข้อมูลสำรองอุปกรณ์มีขนาด ${(backupSize / (1024*1024)).toFixed(1)} MB พิจารณาลบข้อมูลสำรองเก่า`);
        }
        if (telegramSize > 1 * 1024 * 1024) {
            recommendations.push(`💬 ประวัติ Telegram มีขนาด ${(telegramSize / (1024*1024)).toFixed(1)} MB ควรล้างประวัติเก่า`);
        }
    }
    
    if (data.totalRecords && data.totalRecords > 5000) {
        recommendations.push(`📊 มีข้อมูล ${data.totalRecords.toLocaleString()} เรคคอร์ด พิจารณาลบข้อมูลเก่าออก`);
    }
    
    if (recommendations.length === 0) {
        recommendations.push('✅ พื้นที่จัดเก็บยังเพียงพอ ไม่มีคำแนะนำเพิ่มเติม');
        recommendations.push('💡 ควรตรวจสอบเป็นประจำทุกเดือนเพื่อป้องกันปัญหาพื้นที่เต็ม');
    }
    
    // เพิ่มคำแนะนำทั่วไป
    recommendations.push('');
    recommendations.push('📌 <b>คำแนะนำทั่วไป:</b>');
    recommendations.push('• ตั้งค่า Auto-Log ให้เหมาะสม (ไม่เก็บข้อมูลมากเกินไป)');
    recommendations.push('• ใช้ระบบ Cleanup ด้านบนเพื่อลบข้อมูลแต่ละส่วน');
    recommendations.push('• สำรองข้อมูลเป็นประจำและลบข้อมูลเก่าออกจาก Firebase');
    recommendations.push('• 🔔 ประวัติการแจ้งเตือนและ 📊 ประวัติเซนเซอร์มักมีขนาดใหญ่ที่สุด');
    recommendations.push('• 💬 ประวัติ Telegram สามารถล้างได้โดยไม่กระทบการตั้งค่า');
    
    alert(`💡 คำแนะนำในการจัดการพื้นที่จัดเก็บ:\n\n${recommendations.join('\n')}`);
}

// ============================================================
//  7. REFRESH STORAGE STATS
// ============================================================

async function refreshStorageStats() {
    const container = document.getElementById('storageStatsContainer');
    if (!container) return;
    
    try {
        const result = await estimateStorageUsage();
        if (result) {
            storageEstimate = result;
            container.innerHTML = renderStorageStats(result);
            document.dispatchEvent(new CustomEvent('storageStatsUpdated', { detail: result }));
        } else {
            container.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px; text-align: center;">
                    <span style="font-size: 2rem;">❌</span>
                    <div style="color: #991b1b; margin-top: 8px; font-weight: 600;">ไม่สามารถคำนวณพื้นที่จัดเก็บได้</div>
                    <div style="font-size: 0.85rem; color: #64748b;">กรุณาลองใหม่</div>
                    <button onclick="hideStorageStats()" style="margin-top: 12px; background: #64748b; color: white; border: none; padding: 6px 18px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">🔙 กลับ</button>
                </div>
            `;
        }
    } catch (error) {
        console.error("❌ refreshStorageStats error:", error);
        if (container) {
            container.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px; text-align: center;">
                    <span style="font-size: 2rem;">❌</span>
                    <div style="color: #991b1b; margin-top: 8px; font-weight: 600;">เกิดข้อผิดพลาด</div>
                    <div style="font-size: 0.85rem; color: #64748b;">${error?.message || 'กรุณาลองใหม่'}</div>
                    <button onclick="hideStorageStats()" style="margin-top: 12px; background: #64748b; color: white; border: none; padding: 6px 18px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">🔙 กลับ</button>
                </div>
            `;
        }
    }
}

// ============================================================
//  8. เพิ่มปุ่มใน Admin Menu (ปรับปรุงแล้ว)
// ============================================================

function addStorageMonitorButton() {
    const adminControls = document.getElementById('adminControls');
    if (!adminControls) {
        console.warn("⚠️ ไม่พบ #adminControls");
        return;
    }
    
    if (adminControls.querySelector('.storage-monitor-btn')) {
        return;
    }
    
    let statsContainer = document.getElementById('storageStatsContainer');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'storageStatsContainer';
        statsContainer.style.cssText = `
            margin: 12px 0 8px 0;
            padding: 0;
            width: 100%;
        `;
        adminControls.insertBefore(statsContainer, adminControls.firstChild);
    }
    
    // เริ่มต้นด้วยการแสดงปุ่มตรวจสอบ (ไม่แสดงข้อมูล)
    statsContainer.innerHTML = `
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                <span style="font-size: 1.3rem;">💾</span>
                <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.75rem; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">พื้นที่จัดเก็บ Firebase</div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
                        <button onclick="showStorageStats()" class="storage-monitor-btn" style="
                            background: #2563eb; 
                            color: #ffffff; 
                            border: none; 
                            padding: 5px 18px; 
                            border-radius: 6px; 
                            cursor: pointer; 
                            font-size: 0.8rem;
                            font-weight: 600;
                            transition: 0.2s;
                            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
                        " onmouseover="this.style.background='#1d4ed8'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='#2563eb'; this.style.transform='scale(1)'">
                            🔍 ตรวจสอบ
                        </button>
                        <span style="font-size: 0.7rem; color: #94a3b8;">คลิกเพื่อดูรายละเอียดพื้นที่จัดเก็บ</span>
                    </div>
                </div>
                <div style="text-align: right; margin-left: auto; background: #f1f5f9; padding: 4px 14px; border-radius: 12px;">
                    <div style="font-size: 0.6rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">สถานะ</div>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">⏸️ ยังไม่ได้ตรวจสอบ</div>
                </div>
            </div>
        </div>
    `;
    
    console.log("✅ เพิ่มปุ่มตรวจสอบพื้นที่จัดเก็บใน Admin Menu แล้ว");
}

// ============================================================
//  9. แสดงรายละเอียดพื้นที่จัดเก็บใน Modal
// ============================================================

function showStorageDetails() {
    // ถ้ายังไม่มีการตรวจสอบ หรือไม่มีข้อมูล ให้เรียก showStorageStats() ก่อน
    if (!storageEstimate || !storageEstimate.lastUpdated) {
        showStorageStats();
        return;
    }
    
    const data = storageEstimate;
    
    let modal = document.getElementById('storageDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'storageDetailModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            z-index: 99999;
            justify-content: center;
            align-items: center;
            padding: 20px;
            animation: storageFadeIn 0.3s ease;
        `;
        const style = document.createElement('style');
        style.textContent = `
            @keyframes storageFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 16px; padding: 28px 30px 30px 30px; max-width: 820px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid #e2e8f0; box-shadow: 0 20px 60px rgba(0,0,0,0.2); scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9;">
            <style>
                #storageDetailModal .modal-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                #storageDetailModal .modal-scroll::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                }
                #storageDetailModal .modal-scroll::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                #storageDetailModal .modal-scroll::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            </style>
            <div class="modal-scroll" style="overflow-y: auto; max-height: calc(90vh - 60px);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: sticky; top: 0; background: #ffffff; padding-bottom: 12px; z-index: 1; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="color: #0f172a; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; font-weight: 700;">
                        <span>💾</span> รายละเอียดพื้นที่จัดเก็บ
                    </h3>
                    <button onclick="document.getElementById('storageDetailModal').style.display='none'" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 18px; transition: 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a'" onmouseout="this.style.background='#f1f5f9'; this.style.color='#475569'">✕</button>
                </div>
                ${renderStorageStats(data)}
                <div style="margin-top: 18px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; padding-top: 16px; border-top: 2px solid #e2e8f0;">
                    <button onclick="refreshStorageStats();" style="background: #2563eb; color: #ffffff; border: none; padding: 10px 28px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);" onmouseover="this.style.background='#1d4ed8'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='#2563eb'; this.style.transform='scale(1)'">
                        🔄 ตรวจสอบใหม่
                    </button>
                    <button onclick="showStorageRecommendations()" style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; padding: 10px 28px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        💡 คำแนะนำ
                    </button>
                    <button onclick="openCleanupManager(); document.getElementById('storageDetailModal').style.display='none';" style="background: #7c3aed; color: #ffffff; border: none; padding: 10px 28px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);" onmouseover="this.style.background='#6d28d9'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='#7c3aed'; this.style.transform='scale(1)'">
                        🧹 จัดการความสะอาด (Full)
                    </button>
                </div>
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 0.7rem; color: #94a3b8; text-align: center;">
                    * ข้อมูลนี้เป็นการประมาณการจากขนาดข้อมูลใน Firebase (อาจไม่ตรงกับความเป็นจริง 100%)
                </div>
            </div>
        </div>
    `;
}

// ============================================================
//  10. INITIALIZATION
// ============================================================

function initStorageMonitor() {
    console.log("💾 Storage Monitor Module เริ่มทำงาน (เวอร์ชัน 2.4 - Collapsible with Hide Button)");
    
    setTimeout(() => {
        addStorageMonitorButton();
        // ไม่โหลดข้อมูลอัตโนมัติอีกต่อไป
    }, 1500);
}

// ============================================================
//  EXPOSE FUNCTIONS TO GLOBAL
// ============================================================

window.storageEstimate = storageEstimate;
window.estimateStorageUsage = estimateStorageUsage;
window.refreshStorageStats = refreshStorageStats;
window.renderStorageStats = renderStorageStats;
window.showStorageDetails = showStorageDetails;
window.showStorageRecommendations = showStorageRecommendations;
window.initStorageMonitor = initStorageMonitor;
window.addStorageMonitorButton = addStorageMonitorButton;
window.toggleCleanupNode = toggleCleanupNode;
window.selectAllCleanupNodes = selectAllCleanupNodes;
window.executeSelectedCleanupNodes = executeSelectedCleanupNodes;
window.quickClearNode = quickClearNode;
window.refreshAfterCleanup = refreshAfterCleanup;
window.showStorageStats = showStorageStats;
window.hideStorageStats = hideStorageStats; // เปิดเผยฟังก์ชันซ่อน

console.log("✅ storage-monitor.js โหลดเรียบร้อย (เวอร์ชัน 2.4 - Collapsible with Hide Button)");