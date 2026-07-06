// ============================================================
//  KLT Smart Farm Station - Sensors Module
//  Version: 3.1 (Fixed Loading Text + Board Update)
// ============================================================

// ============================================================
//  1. DEVICE MANAGEMENT
// ============================================================
window.openDeviceManager = function() {
    const modal = document.getElementById('deviceModal');
    if (modal) {
        modal.style.display = 'flex';
        renderDeviceTable();
        renderBoardTable();
        resetDeviceForm();
        populateBoardSelector();
        addCleanupButtonToDeviceManager();
        setTimeout(() => {
            initTemplateSelector();
            renderTemplateSelector();
            renderSensorModeSelector();
            const devId = document.getElementById('devId').value;
            if (devId && deviceConfigs[devId] && deviceConfigs[devId].levels) {
                const levels = deviceConfigs[devId].levels;
                if (Array.isArray(levels) && levels.length > 0) {
                    loadDynamicLevelsFromArray(levels);
                }
            }
        }, 100);
        setTimeout(() => {
            loadProfileList();
        }, 800);
    }
};

window.closeDeviceManager = function() {
    const modal = document.getElementById('deviceModal');
    if (modal) {
        modal.style.display = 'none';
        resetDeviceForm();
    }
};

window.toggleDevice = async function(id, currentStatus) {
    try {
        await window.update(window.ref(window.db, `device_configs/${id}`), { enabled: !currentStatus });
        renderDeviceTable();
        renderBoardTable();
        renderSensorCards();
        updateChartStructure();
        updateStatusBarBoardDetails();
    } catch (e) {
        console.error("❌ toggleDevice error:", e);
        alert("❌ เปลี่ยนสถานะไม่สำเร็จ: " + e.message);
    }
};

window.deleteDevice = async function(id) {
    if (confirm(`⚠️ ยืนยันการลบอุปกรณ์ ${id} ออกจากระบบถาวร?`)) {
        try {
            await window.remove(window.ref(window.db, `device_configs/${id}`));
            renderDeviceTable();
            renderBoardTable();
            renderSensorCards();
            updateChartStructure();
            updateStandaloneAlertPanel();
            renderSummaryTable();
            updateAlertHistoryDropdown();
            updateStatusBarBoardDetails();
        } catch (e) {
            console.error("❌ deleteDevice error:", e);
            alert("❌ ลบไม่สำเร็จ: " + e.message);
        }
    }
};

function resetDeviceForm() {
    document.getElementById('devId').value = '';
    document.getElementById('devId').readOnly = false;
    document.getElementById('devName').value = '';
    document.getElementById('devUnit').value = '';
    document.getElementById('devTypeCustom').value = '';
    document.getElementById('installHeight').value = '';
    document.getElementById('bankHeight').value = '';
    document.getElementById('horizontalMaxRange').value = '';
    document.getElementById('horizontalWarningRange').value = '';
    const alertCheckbox = document.getElementById('devAlertEnabled');
    if (alertCheckbox) alertCheckbox.checked = true;
    document.getElementById('alertThreshold').value = '';
    document.getElementById('alertRateChange').value = '';
    document.getElementById('alertRateTime').value = '';
    document.getElementById('alertLimit').value = '';
    document.getElementById('alertInterval').value = '';
    const container = document.getElementById('dynamicLevelsContainer');
    if (container) container.innerHTML = '';
    document.getElementById('eventModeEnabled').checked = false;
    document.getElementById('eventSettings').style.display = 'none';
    document.getElementById('eventDebounceTime').value = 2;
    const saveBtn = document.getElementById('saveSensorBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 บันทึกข้อมูลเซนเซอร์';
        saveBtn.setAttribute('onclick', 'saveDeviceWithThresholds(false)');
    }
    const modeSelect = document.getElementById('levelModeSelect');
    if (modeSelect) modeSelect.value = 'manual';
    if (typeof toggleLevelMode === 'function') toggleLevelMode();
    document.getElementById('autoMin').value = '';
    document.getElementById('autoMax').value = '';
    const genCountInput = document.getElementById('genCountInput');
    if (genCountInput) genCountInput.value = 3;
    document.getElementById('riverMin').value = '';
    document.getElementById('riverNormal').value = '';
    document.getElementById('riverWarning').value = '';
    document.getElementById('riverCritical').value = '';
    const autoLevelCount = document.getElementById('autoLevelCount');
    if (autoLevelCount) autoLevelCount.value = 5;
    const modeSelectEl = document.getElementById('sensorModeSelect');
    if (modeSelectEl) {
        modeSelectEl.value = 'vertical';
        updateSensorModeUI('vertical');
    }
}

// ============================================================
//  checkAllBoardsStatus() - ตรวจสอบสถานะบอร์ดทั้งหมด
//  ใช้ lastSeen เป็นหลัก ไม่ใช้ config.status
//  ✅ นับเฉพาะบอร์ดที่ส่งข้อมูลจริง (มี lastSeen อัปเดตภายใน 10 นาที)
// ============================================================

function checkAllBoardsStatus() {
    const boardStatus = {};
    const now = Date.now() + (window.serverTimeOffset || 0);
    const timeout = 180000; // 3 นาที
    
    for (const [id, config] of Object.entries(deviceConfigs)) {
        if (config.type === 'board') {
            const lastSeen = config.lastSeen ? new Date(config.lastSeen).getTime() : 0;
            const diffMs = now - lastSeen;
            
            // ✅ สำคัญ: ใช้ timestamp จากบอร์ดเป็นหลัก ไม่ใช้ config.status
            const isOnline = diffMs < timeout && lastSeen > 0;
            
            // ✅ คำนวณเวลาที่ออฟไลน์หรือออนไลน์ให้ละเอียดขึ้น
            let durationText = "";
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) {
                durationText = "เมื่อครู่";
            } else if (mins < 60) {
                durationText = `${mins} นาทีที่แล้ว`;
            } else {
                const hours = Math.floor(mins / 60);
                const remainingMins = mins % 60;
                if (remainingMins === 0) {
                    durationText = `${hours} ชั่วโมงที่แล้ว`;
                } else {
                    durationText = `${hours} ชั่วโมง ${remainingMins} นาทีที่แล้ว`;
                }
            }

            // ✅ ถ้าบอร์ดออฟไลน์ ให้อัปเดตสถานะใน deviceConfigs (เฉพาะ UI)
            // แต่ไม่เขียนกลับไป Firebase (ให้บอร์ดเป็นผู้เขียนเท่านั้น)
            if (!isOnline && config.status !== 'offline') {
                deviceConfigs[id].status = 'offline';
                // ❌ ไม่มีการ update ไป Firebase ที่นี่
                // ปล่อยให้บอร์ดเป็นผู้เขียน lastSeen เท่านั้น
            } else if (isOnline && config.status !== 'online') {
                deviceConfigs[id].status = 'online';
            }

            boardStatus[id] = {
                isOnline: isOnline,
                lastSeen: config.lastSeen || null,
                diffMs: diffMs,
                durationText: durationText,
                name: config.name || id,
                rssi: config.wifi_rssi || 0,
                isActive: isOnline && lastSeen > 0,
                status: isOnline ? 'online' : 'offline'
            };
        }
    }
    return boardStatus;
}
// ✅ Export ให้ global
window.checkAllBoardsStatus = checkAllBoardsStatus;

// ============================================================
//  2. TEMPLATE APPLICATION WITH MODE
// ============================================================

window.applyTemplate = function(templateKey, sensorId = null) {
    if (!templateKey || !SENSOR_TEMPLATES[templateKey]) {
        alert('⚠️ ไม่พบเทมเพลตที่เลือก');
        return false;
    }
    
    const template = SENSOR_TEMPLATES[templateKey];
    const levels = template.levels;
    const levelsArray = [];
    
    for (const key of LEVEL_KEYS) {
        if (levels[key]) {
            levelsArray.push({
                label: levels[key].label || key,
                min: levels[key].min || 0,
                max: levels[key].max || 100,
                color: LEVEL_COLORS[key] || '#3b82f6',
                alert: (key === 'very_high' || key === 'high')
            });
        }
    }
    
    if (levelsArray.length > 0) {
        loadDynamicLevelsFromArray(levelsArray);
    }
    
    let sensorMode = 'vertical';
    if (templateKey === 'ultrasonic' || templateKey === 'ultrasonic_river') {
        sensorMode = 'vertical';
    } else if (templateKey === 'soil' || templateKey === 'temp' || templateKey === 'ph') {
        sensorMode = 'horizontal';
    } else if (templateKey === 'rain') {
        sensorMode = 'horizontal';
    }
    
    const modeSelect = document.getElementById('sensorModeSelect');
    if (modeSelect) {
        modeSelect.value = sensorMode;
        updateSensorModeUI(sensorMode);
    }
    
    const typeSelect = document.getElementById('devType');
    const typeMap = {
        'ultrasonic': 'ultrasonic',
        'ultrasonic_river': 'ultrasonic',
        'soil': 'soil',
        'ph': 'ph',
        'temp': 'temp',
        'rain': 'rain'
    };
    if (typeSelect && typeMap[templateKey]) {
        typeSelect.value = typeMap[templateKey];
        updateCustomTypeVisibility();
    }
    
    console.log(`✅ ใช้เทมเพลต ${template.label} (โหมด: ${sensorMode})`);
    return true;
};

window.updateSensorModeUI = function(mode) {
    const verticalConfig = document.getElementById('ultrasonicVerticalConfig');
    const horizontalConfig = document.getElementById('ultrasonicHorizontalConfig');
    const modeHint = document.getElementById('sensorModeHint');
    const installHeightLabel = document.getElementById('installHeightLabel');
    const bankHeightLabel = document.getElementById('bankHeightLabel');
    
    if (mode === 'vertical') {
        if (verticalConfig) verticalConfig.style.display = 'block';
        if (horizontalConfig) horizontalConfig.style.display = 'none';
        if (modeHint) {
            modeHint.innerHTML = `
                <div style="color: #60a5fa; font-size: 0.85rem; padding: 8px 12px; background: #0f172a; border-radius: 6px; border-left: 3px solid #3b82f6;">
                    📏 <b>โหมดแนวตั้ง (Vertical)</b> - ใช้สำหรับวัดระดับน้ำ ของเหลว หรือวัสดุ<br>
                    <span style="font-size: 0.7rem; color: #94a3b8;">ระบบจะคำนวณระดับจริงจาก: ระดับติดตั้ง − ระยะที่วัดได้</span>
                </div>
            `;
        }
        if (installHeightLabel) installHeightLabel.textContent = '📏 ระยะติดตั้ง (เซนเซอร์ถึงก้นบ่อ)';
        if (bankHeightLabel) bankHeightLabel.textContent = '⚠️ ระดับตลิ่ง (วัดจากก้นบ่อขึ้นมา)';
    } else if (mode === 'horizontal') {
        if (verticalConfig) verticalConfig.style.display = 'none';
        if (horizontalConfig) horizontalConfig.style.display = 'block';
        if (modeHint) {
            modeHint.innerHTML = `
                <div style="color: #fbbf24; font-size: 0.85rem; padding: 8px 12px; background: #0f172a; border-radius: 6px; border-left: 3px solid #f59e0b;">
                    📐 <b>โหมดแนวนอน (Horizontal)</b> - ใช้สำหรับวัดระยะห่าง ตรวจจับวัตถุ หรือวัดระยะเปิด-ปิด<br>
                    <span style="font-size: 0.7rem; color: #94a3b8;">ระบบจะแสดงค่าระยะที่วัดได้โดยตรง</span>
                </div>
            `;
        }
        if (installHeightLabel) installHeightLabel.textContent = '📏 ระยะอ้างอิงสูงสุด (Max Range)';
        if (bankHeightLabel) bankHeightLabel.textContent = '⚠️ ระยะเตือน (Warning Range)';
    }
};

// ============================================================
//  3. RENDER SENSOR MODE SELECTOR (ปรับปรุงให้อ่านง่าย)
// =============================================
window.renderSensorModeSelector = function() {
    const container = document.getElementById('sensorModeContainer');
    if (!container) {
        console.warn("⚠️ ไม่พบ #sensorModeContainer ใน HTML");
        return;
    }
    
    const currentMode = document.getElementById('sensorModeSelect')?.value || 'vertical';
    
    // ปรับพื้นหลังเป็นสีฟ้าอ่อน ตัวหนังสือสีน้ำเงินเข้ม
    container.innerHTML = `
        <div style="margin-top: 12px; margin-bottom: 12px; padding: 16px; background: #f0f7ff; border-radius: 12px; border: 1px solid #bbdefb;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <label style="color: #0d47a1; font-size: 0.95rem; font-weight: 700;">📐 โหมดการทำงาน:</label>
                <select id="sensorModeSelect" onchange="updateSensorModeUI(this.value)" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #90caf9; background: #ffffff; color: #0d47a1; cursor: pointer; font-weight: 600;">
                    <option value="vertical" ${currentMode === 'vertical' ? 'selected' : ''}>📏 แนวตั้ง (Vertical)</option>
                    <option value="horizontal" ${currentMode === 'horizontal' ? 'selected' : ''}>📐 แนวนอน (Horizontal)</option>
                </select>
                <span style="font-size: 0.8rem; color: #546e7a; font-weight: 500;">(เหมาะสำหรับ Ultrasonic, วัดระดับ, วัดระยะ)</span>
            </div>
            <div id="sensorModeHint" style="margin-top: 12px;"></div>
        </div>
    `;
    
    updateSensorModeUI(currentMode);
};

// =============================================
//  UPDATE SENSOR MODE UI (ปรับปรุงสี Hint ให้อ่านง่าย)
// =============================================
window.updateSensorModeUI = function(mode) {
    const verticalConfig = document.getElementById('ultrasonicVerticalConfig');
    const horizontalConfig = document.getElementById('ultrasonicHorizontalConfig');
    const modeHint = document.getElementById('sensorModeHint');
    const installHeightLabel = document.getElementById('installHeightLabel');
    const bankHeightLabel = document.getElementById('bankHeightLabel');
    
    if (mode === 'vertical') {
        if (verticalConfig) verticalConfig.style.display = 'block';
        if (horizontalConfig) horizontalConfig.style.display = 'none';
        if (modeHint) {
            // ปรับสี Hint เป็นตัวหนังสือสีน้ำเงินเข้ม บนพื้นฟ้าอ่อน
            modeHint.innerHTML = `
                <div style="color: #0d47a1; font-size: 0.85rem; padding: 10px 15px; background: #e3f2fd; border-radius: 8px; border-left: 5px solid #1976d2; line-height: 1.5;">
                    <b style="font-size: 0.95rem;">📏 โหมดแนวตั้ง (Vertical)</b><br>
                    ใช้สำหรับวัดระดับน้ำ ของเหลว หรือวัสดุในถัง/บ่อ<br>
                    <span style="font-size: 0.8rem; color: #1565c0; font-weight: bold;">💡 ระบบจะคำนวณ: ระดับติดตั้ง − ระยะที่วัดได้ = ระดับน้ำจริง</span>
                </div>
            `;
        }
        if (installHeightLabel) installHeightLabel.textContent = '📏 ระยะติดตั้ง (เซนเซอร์ถึงก้นบ่อ)';
        if (bankHeightLabel) bankHeightLabel.textContent = '⚠️ ระดับตลิ่ง (วัดจากก้นบ่อขึ้นมา)';
    } else if (mode === 'horizontal') {
        if (verticalConfig) verticalConfig.style.display = 'none';
        if (horizontalConfig) horizontalConfig.style.display = 'block';
        if (modeHint) {
            // ปรับสี Hint เป็นตัวหนังสือสีส้มเข้ม บนพื้นส้มอ่อน
            modeHint.innerHTML = `
                <div style="color: #bf360c; font-size: 0.85rem; padding: 10px 15px; background: #fff3e0; border-radius: 8px; border-left: 5px solid #fb8c00; line-height: 1.5;">
                    <b style="font-size: 0.95rem;">📐 โหมดแนวนอน (Horizontal)</b><br>
                    ใช้สำหรับวัดระยะห่างตรงๆ ตรวจจับวัตถุ หรือวัดความกว้าง<br>
                    <span style="font-size: 0.8rem; color: #e65100; font-weight: bold;">💡 ระบบจะแสดงค่า "ระยะห่าง" ที่เซนเซอร์อ่านได้โดยตรง</span>
                </div>
            `;
        }
        if (installHeightLabel) installHeightLabel.textContent = '📏 ระยะอ้างอิงสูงสุด (Max Range)';
        if (bankHeightLabel) bankHeightLabel.textContent = '⚠️ ระยะเตือน (Warning Range)';
    }
};
// ============================================================
//  3. CLONE DEVICE
// ============================================================

window.cloneDevice = function(sourceId) {
    const sourceConfig = deviceConfigs[sourceId];
    if (!sourceConfig) {
        alert("❌ ไม่พบข้อมูลอุปกรณ์ต้นทาง");
        return;
    }
    
    if (sourceConfig.type === 'board') {
        alert("❌ ไม่สามารถคัดลอกบอร์ดได้ (ใช้เฉพาะเซนเซอร์)");
        return;
    }
    
    const newId = prompt("🆔 ระบุ ID ใหม่สำหรับอุปกรณ์ที่คัดลอก:", `${sourceId}_copy`);
    if (!newId) return;
    
    if (deviceConfigs[newId]) {
        alert(`❌ ID "${newId}" มีอยู่ในระบบแล้ว กรุณาใช้ ID อื่น`);
        return;
    }
    
    if (!/^[a-zA-Z0-9_\-]+$/.test(newId)) {
        alert("❌ ID ต้องใช้ตัวอักษรภาษาอังกฤษ ตัวเลข ขีดล่าง (_) หรือขีดกลาง (-) เท่านั้น");
        return;
    }
    
    const newConfig = JSON.parse(JSON.stringify(sourceConfig));
    newConfig.name = `${sourceConfig.name} (คัดลอก)`;
    newConfig.alert_count = 0;
    newConfig.is_acknowledged = false;
    newConfig.last_alert_time = null;
    newConfig.createdAt = new Date().toISOString();
    newConfig.updatedAt = new Date().toISOString();
    newConfig.enabled = true;
    delete newConfig.lastSeen;
    delete newConfig.onlineSince;
    delete newConfig.status;
    
    try {
        window.set(window.ref(window.db, `device_configs/${newId}`), newConfig)
            .then(() => {
                alert(`✅ คัดลอกอุปกรณ์ "${sourceConfig.name}" ไปเป็น "${newConfig.name}" (ID: ${newId}) สำเร็จ`);
                renderDeviceTable();
                renderBoardTable();
                renderSensorCards();
                updateChartStructure();
                updateStandaloneAlertPanel();
                renderSummaryTable();
                updateAlertHistoryDropdown();
                updateStatusBarBoardDetails();
            })
            .catch(err => {
                console.error("❌ cloneDevice error:", err);
                alert("❌ คัดลอกไม่สำเร็จ: " + err.message);
            });
    } catch (error) {
        console.error("❌ cloneDevice error:", error);
        alert("❌ คัดลอกไม่สำเร็จ: " + error.message);
    }
};

window.bulkCloneDevices = function(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        alert("⚠️ กรุณาเลือกอุปกรณ์ที่ต้องการคัดลอก");
        return;
    }
    
    if (!confirm(`⚠️ ยืนยันการคัดลอกอุปกรณ์ ${ids.length} รายการ?`)) return;
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    for (const sourceId of ids) {
        const sourceConfig = deviceConfigs[sourceId];
        if (!sourceConfig || sourceConfig.type === 'board') {
            failCount++;
            continue;
        }
        
        const newId = `${sourceId}_copy_${Date.now().toString().slice(-4)}`;
        const newConfig = JSON.parse(JSON.stringify(sourceConfig));
        newConfig.name = `${sourceConfig.name} (คัดลอก)`;
        newConfig.alert_count = 0;
        newConfig.is_acknowledged = false;
        newConfig.last_alert_time = null;
        newConfig.createdAt = new Date().toISOString();
        newConfig.updatedAt = new Date().toISOString();
        newConfig.enabled = true;
        delete newConfig.lastSeen;
        delete newConfig.onlineSince;
        delete newConfig.status;
        
        try {
            window.set(window.ref(window.db, `device_configs/${newId}`), newConfig);
            successCount++;
            results.push({ sourceId, newId, status: 'success' });
        } catch (e) {
            failCount++;
            results.push({ sourceId, newId: null, status: 'failed', error: e.message });
        }
    }
    
    alert(`✅ คัดลอกสำเร็จ ${successCount} รายการ, ❌ ล้มเหลว ${failCount} รายการ`);
    renderDeviceTable();
    renderBoardTable();
    renderSensorCards();
    updateChartStructure();
    updateStandaloneAlertPanel();
    renderSummaryTable();
    updateAlertHistoryDropdown();
    updateStatusBarBoardDetails();
};

// ============================================================
//  4. LEVEL CONFIG
// ============================================================
// ============================================================
//  4. LEVEL CONFIG - ปรับปรุงสไตล์ Clean & Professional
// ============================================================

window.addDynamicLevelRow = function(data = { label: '', min: 0, max: 100, color: '#3b82f6', alert: false }) {
    const container = document.getElementById('dynamicLevelsContainer');
    if (!container) {
        console.warn("⚠️ ไม่พบ #dynamicLevelsContainer");
        return;
    }

    const rowId = 'row_' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    // ✅ กำหนดค่าพื้นฐาน
    const label = data.label || '';
    const min = data.min !== undefined ? data.min : 0;
    const max = data.max !== undefined ? data.max : 100;
    const color = data.color || '#3b82f6';
    const isAlert = data.alert || false;
    
    const html = `
        <div class="level-row-item" id="${rowId}" style="
            display: grid;
            grid-template-columns: 2.5fr 1fr 1fr 50px 55px 42px;
            gap: 10px;
            align-items: start;
            background: #ffffff;
            padding: 14px 16px 14px 16px;
            border-radius: 14px;
            border: 1px solid #e2e8f0;
            margin-bottom: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
            transition: all 0.25s ease;
        " 
        onmouseover="
            this.style.borderColor='#3b82f6'; 
            this.style.boxShadow='0 4px 16px rgba(59, 130, 246, 0.08)';
            this.style.transform='translateY(-1px)';
        "
        onmouseout="
            this.style.borderColor='#e2e8f0'; 
            this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.02)';
            this.style.transform='translateY(0)';
        ">
            
            <!-- 🏷️ ชื่อระดับ -->
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="
                    font-size: 0.6rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-left: 2px;
                ">
                    🏷️ ชื่อระดับ
                </label>
                <input type="text" class="lvl-label" value="${escapeHtml(label)}" placeholder="เช่น ปกติ, วิกฤต, แห้ง" style="
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1.5px solid #dbeafe;
                    background: #f8faff;
                    color: #1e40af;
                    font-size: 0.9rem;
                    font-weight: 600;
                    width: 100%;
                    outline: none;
                    transition: all 0.2s ease;
                    font-family: inherit;
                " 
                onfocus="this.style.borderColor='#3b82f6'; this.style.background='#ffffff'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                onblur="this.style.borderColor='#dbeafe'; this.style.background='#f8faff'; this.style.boxShadow='none'"
                >
            </div>

            <!-- 📉 ค่า Min -->
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="
                    font-size: 0.6rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    text-align: center;
                ">
                    📉 Min
                </label>
                <input type="number" class="lvl-min" value="${min}" placeholder="0" step="any" style="
                    padding: 8px 6px;
                    border-radius: 8px;
                    border: 1.5px solid #dbeafe;
                    background: #ffffff;
                    color: #2563eb;
                    font-size: 0.85rem;
                    font-weight: 700;
                    width: 100%;
                    text-align: center;
                    outline: none;
                    transition: all 0.2s ease;
                    font-family: inherit;
                " 
                onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                onblur="this.style.borderColor='#dbeafe'; this.style.boxShadow='none'"
                >
            </div>

            <!-- 📈 ค่า Max -->
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="
                    font-size: 0.6rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    text-align: center;
                ">
                    📈 Max
                </label>
                <input type="number" class="lvl-max" value="${max}" placeholder="100" step="any" style="
                    padding: 8px 6px;
                    border-radius: 8px;
                    border: 1.5px solid #dbeafe;
                    background: #ffffff;
                    color: #2563eb;
                    font-size: 0.85rem;
                    font-weight: 700;
                    width: 100%;
                    text-align: center;
                    outline: none;
                    transition: all 0.2s ease;
                    font-family: inherit;
                " 
                onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                onblur="this.style.borderColor='#dbeafe'; this.style.boxShadow='none'"
                >
            </div>

            <!-- 🎨 เลือกสี (วงกลม) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <label style="
                    font-size: 0.6rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">
                    🎨 สี
                </label>
                <input type="color" class="lvl-color" value="${color}" style="
                    width: 34px;
                    height: 34px;
                    border: 2px solid #ffffff;
                    border-radius: 50%;
                    cursor: pointer;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    transition: all 0.2s ease;
                "
                onmouseover="this.style.transform='scale(1.08)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'"
                >
            </div>

            <!-- 🔔 แจ้งเตือน (สวิตช์) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <label style="
                    font-size: 0.6rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">
                    🔔 เตือน
                </label>
                <input type="checkbox" class="lvl-alert" ${isAlert ? 'checked' : ''} style="
                    width: 22px;
                    height: 22px;
                    cursor: pointer;
                    accent-color: #ef4444;
                    border-radius: 4px;
                    transition: all 0.15s ease;
                "
                onmouseover="this.style.transform='scale(1.1)'"
                onmouseout="this.style.transform='scale(1)'"
                >
            </div>

            <!-- 🗑️ ปุ่มลบ -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <label style="font-size: 0.6rem; color: transparent; user-select: none;">-</label>
                <button onclick="document.getElementById('${rowId}').remove()" style="
                    background: #ffffff;
                    color: #f87171;
                    border: 1.5px solid #fee2e2;
                    border-radius: 8px;
                    cursor: pointer;
                    height: 36px;
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    font-size: 1rem;
                    font-weight: 700;
                    padding: 0;
                    line-height: 1;
                " 
                onmouseover="
                    this.style.background='#ef4444';
                    this.style.color='#ffffff';
                    this.style.borderColor='#ef4444';
                    this.style.transform='scale(1.05)';
                    this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.25)';
                "
                onmouseout="
                    this.style.background='#ffffff';
                    this.style.color='#f87171';
                    this.style.borderColor='#fee2e2';
                    this.style.transform='scale(1)';
                    this.style.boxShadow='none';
                "
                title="ลบระดับนี้">
                    ✕
                </button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
};

// ============================================================
//  ฟังก์ชันอื่นๆ ที่เกี่ยวข้อง (ไม่ต้องแก้)
// ============================================================
function loadDynamicLevelsFromArray(levelsArray) {
    // ... โค้ดเดิม (ไม่ต้องแก้)
}

function getDynamicLevelsFromUI() {
    // ... โค้ดเดิม (ไม่ต้องแก้)
}

// ... ฟังก์ชันอื่นๆ ต่อไปตามเดิม

function loadDynamicLevelsFromArray(levelsArray) {
    const container = document.getElementById('dynamicLevelsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (Array.isArray(levelsArray) && levelsArray.length > 0) {
        levelsArray.forEach(level => {
            window.addDynamicLevelRow({
                label: level.label || '',
                min: level.min !== undefined ? level.min : 0,
                max: level.max !== undefined ? level.max : 100,
                color: level.color || '#3b82f6',
                alert: level.alert || false
            });
        });
    }
}

function getDynamicLevelsFromUI() {
    const rows = document.querySelectorAll('.level-row-item');
    const levels = [];
    rows.forEach(row => {
        const label = row.querySelector('.lvl-label').value.trim();
        const min = parseFloat(row.querySelector('.lvl-min').value);
        const max = parseFloat(row.querySelector('.lvl-max').value);
        const color = row.querySelector('.lvl-color').value;
        const alert = row.querySelector('.lvl-alert').checked;
        if (!isNaN(min) && !isNaN(max) && min < max) {
            levels.push({ label: label || `ระดับ ${levels.length + 1}`, min, max, color, alert });
        }
    });
    return levels;
}

window.generateAutoLevels = function(isCustom = false) {
    const min = parseFloat(document.getElementById(isCustom ? 'autoMin' : 'genMin').value);
    const max = parseFloat(document.getElementById(isCustom ? 'autoMax' : 'genMax').value);
    const count = parseInt(document.getElementById(isCustom ? 'genCountInput' : 'genCount').value);
    if (isNaN(min) || isNaN(max) || isNaN(count) || count < 1) {
        alert("⚠️ กรุณากรอกข้อมูลให้ครบและถูกต้อง");
        return;
    }
    if (max <= min) {
        alert("⚠️ ค่า Max ต้องมากกว่า Min");
        return;
    }
    const step = (max - min) / count;
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#b91c1c', '#7c3aed', '#ec4899', '#f97316', '#14b8a6'];
    const container = document.getElementById('dynamicLevelsContainer');
    if (container) container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const lMin = min + (step * i);
        const lMax = (i === count - 1) ? max : (min + (step * (i + 1)) - 0.01);
        window.addDynamicLevelRow({
            label: `ระดับที่ ${i + 1}`,
            min: Math.round(lMin * 100) / 100,
            max: Math.round(lMax * 100) / 100,
            color: colors[i % colors.length],
            alert: (i >= Math.floor(count / 2))
        });
    }
    console.log(`✅ สร้าง ${count} ระดับ เรียบร้อย`);
};

window.applyCustomAutoLevels = function() {
    const min = parseFloat(document.getElementById('autoMin').value);
    const max = parseFloat(document.getElementById('autoMax').value);
    const count = parseInt(document.getElementById('genCountInput').value);
    if (isNaN(min) || isNaN(max) || isNaN(count)) {
        alert('⚠️ กรุณากรอก Min, Max และจำนวนระดับให้ครบ');
        return;
    }
    if (max <= min) {
        alert('⚠️ ค่า Max ต้องมากกว่า Min');
        return;
    }
    if (count < 1 || count > 20) {
        alert('⚠️ จำนวนระดับต้องอยู่ระหว่าง 1-20');
        return;
    }
    const step = (max - min) / count;
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#b91c1c', '#7c3aed', '#ec4899', '#f97316', '#14b8a6', '#8b5cf6', '#d946ef', '#f472b6', '#fb923c', '#eab308', '#84cc16', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
    const defaultNames = ["น้อยที่สุด", "น้อย", "ปานกลาง", "มาก", "มากที่สุด", "ระดับที่ 6", "ระดับที่ 7", "ระดับที่ 8", "ระดับที่ 9", "ระดับที่ 10"];
    const container = document.getElementById('dynamicLevelsContainer');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const lMin = min + (step * i);
        const lMax = (i === count - 1) ? max : (min + (step * (i + 1)) - 0.01);
        let levelName = i < defaultNames.length ? defaultNames[i] : `ระดับที่ ${i + 1}`;
        if (count === 2) levelName = (i === 0) ? "ปกติ" : "แจ้งเตือน";
        window.addDynamicLevelRow({
            label: levelName,
            min: Math.round(lMin * 100) / 100,
            max: Math.round(lMax * 100) / 100,
            color: colors[i % colors.length],
            alert: (i >= Math.floor(count / 2))
        });
    }
    console.log(`✅ สร้าง ${count} ระดับ ตามค่าที่กำหนด เรียบร้อย`);
};

window.calculateAndApplyWaterLevels = function() {
    const installHeight = parseFloat(document.getElementById('installHeight').value);
    const bankHeight = parseFloat(document.getElementById('bankHeight').value);
    const count = parseInt(document.getElementById('autoLevelCount')?.value || 5);
    if (isNaN(installHeight) || isNaN(bankHeight)) {
        alert("⚠️ กรุณากรอกระยะติดตั้งและระดับตลิ่งให้ถูกต้องก่อน");
        return;
    }
    if (bankHeight >= installHeight) {
        alert("⚠️ ระดับตลิ่งต้องต่ำกว่าระยะติดตั้ง (ก้นบ่อ)!");
        return;
    }
    const step = bankHeight / count;
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const levels = [];
    for (let i = 0; i < count; i++) {
        const min = Math.round(step * i);
        const max = Math.round(step * (i + 1));
        levels.push({
            label: `ระดับที่ ${i + 1} (${min}-${max} cm)`,
            min: min,
            max: max,
            color: colors[i % colors.length],
            alert: (i >= count - 2)
        });
    }
    loadDynamicLevelsFromArray(levels);
    alert(`✅ คำนวณ ${count} ระดับ เรียบร้อยแล้ว!\nตรวจสอบรายการด้านล่าง แล้วกด "💾 บันทึกข้อมูลเซนเซอร์" เพื่อยืนยัน`);
};

function evaluateLevelWithCustom(value, levels) {
    if (!levels) {
        return { key: 'unknown', label: 'ไม่ได้ตั้งค่า', color: '#9ca3af', shouldAlert: false };
    }
    if (Array.isArray(levels) && levels.length > 0) {
        const result = levels.find(l => value >= parseFloat(l.min) && value <= parseFloat(l.max));
        if (result) {
            return { 
                key: 'custom', 
                label: result.label || `ระดับ ${levels.indexOf(result) + 1}`, 
                color: result.color || '#3b82f6',
                shouldAlert: result.alert || false
            };
        }
        return { key: 'out_of_range', label: 'นอกเกณฑ์', color: '#9ca3af', shouldAlert: false };
    }
    if (typeof levels === 'object' && !Array.isArray(levels)) {
        for (const key of LEVEL_KEYS) {
            const level = levels[key];
            if (level && value >= level.min && value <= level.max) {
                return { key: key, label: level.label || key, color: level.color || LEVEL_COLORS[key] || '#9ca3af', shouldAlert: (key === 'very_high' || key === 'high') };
            }
        }
    }
    return { key: 'unknown', label: 'ไม่มีข้อมูล', color: '#9ca3af', shouldAlert: false };
}

function createLevelBarsHTML(levels) {
    if (!levels) return '<span style="color:#64748b; font-size:0.6rem;">-</span>';
    let html = '';
    for (const key in levels) {
        const level = levels[key];
        if (level) {
            html += `<span style="background:${level.color || '#9ca3af'}; color:white; padding:2px 6px; border-radius:4px; font-size:0.6rem; margin-right:2px; display:inline-block;" title="${level.min}-${level.max}">${level.label || key}</span>`;
        }
    }
    return html || '<span style="color:#64748b; font-size:0.6rem;">-</span>';
}

// ============================================================
//  5. SAVE & EDIT DEVICE
// ============================================================
window.saveDeviceWithThresholds = async function(isEdit = false) {
    const id = document.getElementById('devId').value.trim();
    const name = document.getElementById('devName').value.trim();
    const unit = document.getElementById('devUnit').value.trim();
    const boardId = document.getElementById('devBoardId').value.trim() || null;
    const selectedType = document.getElementById('devType').value;
    let type = selectedType;
    if (selectedType === 'other') {
        const customType = document.getElementById('devTypeCustom');
        if (customType) {
            type = customType.value.trim() || 'other';
        } else {
            type = 'other';
        }
    }
    
    const modeSelect = document.getElementById('sensorModeSelect');
    const sensorMode = modeSelect ? modeSelect.value : 'vertical';
    
    const levels = getDynamicLevelsFromUI();
    if (levels.length === 0) {
        alert("⚠️ กรุณาเพิ่มระดับอย่างน้อย 1 ระดับ (ใช้ปุ่ม ➕ เพิ่มระดับ)");
        return;
    }
    const sorted = [...levels].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].max >= sorted[i + 1].min) {
            alert(`⚠️ ช่วงค่าระดับ "${sorted[i].label}" (${sorted[i].min}-${sorted[i].max}) ทับซ้อนกับ "${sorted[i+1].label}" (${sorted[i+1].min}-${sorted[i+1].max})`);
            return;
        }
    }
    const alertEnabledCheckbox = document.getElementById('devAlertEnabled');
    const alertEnabled = alertEnabledCheckbox ? alertEnabledCheckbox.checked : true;
    const alertThresholdInput = document.getElementById('alertThreshold');
    const alertRateChangeInput = document.getElementById('alertRateChange');
    const alertRateTimeInput = document.getElementById('alertRateTime');
    const advancedAlert = {
        threshold: alertThresholdInput?.value !== '' ? Number(alertThresholdInput.value) : null,
        rateChange: alertRateChangeInput?.value !== '' ? Number(alertRateChangeInput.value) : null,
        rateTime: alertRateTimeInput?.value !== '' ? Number(alertRateTimeInput.value) : null
    };
    const alertLimitInput = document.getElementById('alertLimit');
    const alertIntervalInput = document.getElementById('alertInterval');
    const alertLimit = alertLimitInput?.value !== '' ? parseInt(alertLimitInput.value) : 3;
    const alertInterval = alertIntervalInput?.value !== '' ? parseInt(alertIntervalInput.value) : 5;
    const installHeight = document.getElementById('installHeight').value !== '' ? Number(document.getElementById('installHeight').value) : null;
    const bankHeight = document.getElementById('bankHeight').value !== '' ? Number(document.getElementById('bankHeight').value) : null;
    const horizontalMaxRange = document.getElementById('horizontalMaxRange').value !== '' ? Number(document.getElementById('horizontalMaxRange').value) : null;
    const horizontalWarningRange = document.getElementById('horizontalWarningRange').value !== '' ? Number(document.getElementById('horizontalWarningRange').value) : null;
    const eventModeEnabled = document.getElementById('eventModeEnabled').checked;
    const eventDebounceTime = parseFloat(document.getElementById('eventDebounceTime').value) || 2;
    
    if (type === 'ultrasonic' && sensorMode === 'vertical' && installHeight !== null && bankHeight !== null) {
        if (bankHeight > installHeight) {
            alert("⚠️ คำเตือน: ระดับตลิ่งไม่ควรสูงกว่าระยะติดตั้ง (ก้นบ่อ)!");
            return;
        }
    }
    if (!id || !name) { alert("กรุณากรอก ID และ ชื่อจุดติดตั้ง"); return; }
    if (!isEdit) {
        try {
            const checkSnapshot = await window.get(window.ref(window.db, `device_configs/${id}`));
            if (checkSnapshot.exists()) {
                alert(`❌ ID ${id} มีอยู่ในระบบแล้ว กรุณาใช้ ID อื่น`);
                return;
            }
        } catch (err) {
            console.warn("⚠️ ตรวจสอบ ID ซ้ำไม่สำเร็จ:", err);
        }
    }
    try {
        const updateData = {
            name: name,
            type: type,
            unit: unit,
            levels: levels,
            advancedAlert: advancedAlert,
            alertEnabled: alertEnabled,
            alertLimit: alertLimit,
            alertInterval: alertInterval,
            installHeight: installHeight,
            bankHeight: bankHeight,
            horizontalMaxRange: horizontalMaxRange,
            horizontalWarningRange: horizontalWarningRange,
            sensorMode: sensorMode,
            eventModeEnabled: eventModeEnabled,
            eventDebounceTime: eventDebounceTime,
            boardId: boardId,
            updatedAt: new Date().toISOString()
        };
        if (!isEdit) {
            updateData.enabled = true;
            updateData.alert_count = 0;
            updateData.is_acknowledged = false;
            updateData.last_alert_time = null;
            updateData.lastSeen = new Date().toISOString();
        }
        await window.update(window.ref(window.db, `device_configs/${id}`), updateData);
        if (deviceConfigs[id]) {
            deviceConfigs[id] = { ...deviceConfigs[id], ...updateData };
        }
        const actionText = isEdit ? 'อัปเดต' : 'เพิ่ม';
        alert(`✅ ${actionText}อุปกรณ์ ${id} สำเร็จ`);
        resetDeviceForm();
        renderDeviceTable();
        renderBoardTable();
        renderSensorCards();
        updateChartStructure();
        updateStandaloneAlertPanel();
        renderSummaryTable();
        updateAlertHistoryDropdown();
        updateStatusBarBoardDetails();
    } catch (error) {
        alert("❌ ไม่สามารถบันทึกอุปกรณ์ได้: " + error.message);
        console.error("❌ saveDeviceWithThresholds error:", error);
    }
};

window.handleEditClickWithThresholds = function(id) {
    const config = deviceConfigs[id];
    if (!config) { alert("ไม่พบข้อมูลอุปกรณ์"); return; }
    document.getElementById('devId').value = id;
    document.getElementById('devId').readOnly = true;
    document.getElementById('devName').value = config.name || '';
    document.getElementById('devUnit').value = config.unit || '';
    if (document.getElementById('devBoardId')) {
        document.getElementById('devBoardId').value = config.boardId || '';
    }
    const typeSelect = document.getElementById('devType');
    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('devTypeCustom');
    const optionExists = Array.from(typeSelect.options).some(opt => opt.value === config.type);
    if (optionExists) {
        typeSelect.value = config.type;
        if (customContainer) customContainer.style.display = 'none';
    } else {
        typeSelect.value = 'other';
        if (customContainer) customContainer.style.display = 'block';
        if (customInput) customInput.value = config.type || '';
    }
    
    const modeSelect = document.getElementById('sensorModeSelect');
    if (modeSelect && config.sensorMode) {
        modeSelect.value = config.sensorMode;
        updateSensorModeUI(config.sensorMode);
    }
    
    const alertCheckbox = document.getElementById('devAlertEnabled');
    if (alertCheckbox) {
        alertCheckbox.checked = (config.alertEnabled !== false);
    }
    if (config.advancedAlert) {
        const adv = config.advancedAlert;
        document.getElementById('alertThreshold').value = adv.threshold !== undefined && adv.threshold !== null ? adv.threshold : '';
        document.getElementById('alertRateChange').value = adv.rateChange !== undefined && adv.rateChange !== null ? adv.rateChange : '';
        document.getElementById('alertRateTime').value = adv.rateTime !== undefined && adv.rateTime !== null ? adv.rateTime : '';
    } else {
        document.getElementById('alertThreshold').value = '';
        document.getElementById('alertRateChange').value = '';
        document.getElementById('alertRateTime').value = '';
    }
    const alertLimitInput = document.getElementById('alertLimit');
    const alertIntervalInput = document.getElementById('alertInterval');
    if (alertLimitInput) {
        alertLimitInput.value = config.alertLimit !== undefined ? config.alertLimit : 3;
    }
    if (alertIntervalInput) {
        alertIntervalInput.value = config.alertInterval !== undefined ? config.alertInterval : 5;
    }
    document.getElementById('installHeight').value = config.installHeight !== undefined && config.installHeight !== null ? config.installHeight : '';
    document.getElementById('bankHeight').value = config.bankHeight !== undefined && config.bankHeight !== null ? config.bankHeight : '';
    document.getElementById('horizontalMaxRange').value = config.horizontalMaxRange !== undefined && config.horizontalMaxRange !== null ? config.horizontalMaxRange : '';
    document.getElementById('horizontalWarningRange').value = config.horizontalWarningRange !== undefined && config.horizontalWarningRange !== null ? config.horizontalWarningRange : '';
    const eventModeCheckbox = document.getElementById('eventModeEnabled');
    if (eventModeCheckbox) {
        eventModeCheckbox.checked = config.eventModeEnabled || false;
    }
    const eventDebounceInput = document.getElementById('eventDebounceTime');
    if (eventDebounceInput) {
        eventDebounceInput.value = config.eventDebounceTime || 2;
    }
    const eventSettings = document.getElementById('eventSettings');
    if (eventSettings) {
        eventSettings.style.display = (config.eventModeEnabled) ? 'block' : 'none';
    }
    if (config.levels && Array.isArray(config.levels) && config.levels.length > 0) {
        loadDynamicLevelsFromArray(config.levels);
    } else if (config.levels && typeof config.levels === 'object' && !Array.isArray(config.levels)) {
        const converted = [];
        for (const key of LEVEL_KEYS) {
            if (config.levels[key]) {
                converted.push({
                    label: config.levels[key].label || key,
                    min: config.levels[key].min || 0,
                    max: config.levels[key].max || 100,
                    color: config.levels[key].color || LEVEL_COLORS[key] || '#3b82f6',
                    alert: (key === 'very_high' || key === 'high')
                });
            }
        }
        if (converted.length > 0) {
            loadDynamicLevelsFromArray(converted);
        } else {
            loadDynamicLevelsFromArray([
                { label: 'น้อยที่สุด', min: 0, max: 9.99, color: '#6366f1', alert: false },
                { label: 'น้อย', min: 10, max: 19.99, color: '#3b82f6', alert: false },
                { label: 'ปานกลาง', min: 20, max: 29.99, color: '#10b981', alert: false },
                { label: 'มาก', min: 30, max: 39.99, color: '#f59e0b', alert: true },
                { label: 'มากที่สุด', min: 40, max: 50, color: '#ef4444', alert: true }
            ]);
        }
    } else {
        loadDynamicLevelsFromArray([
            { label: 'น้อยที่สุด', min: 0, max: 9.99, color: '#6366f1', alert: false },
            { label: 'น้อย', min: 10, max: 19.99, color: '#3b82f6', alert: false },
            { label: 'ปานกลาง', min: 20, max: 29.99, color: '#10b981', alert: false },
            { label: 'มาก', min: 30, max: 39.99, color: '#f59e0b', alert: true },
            { label: 'มากที่สุด', min: 40, max: 50, color: '#ef4444', alert: true }
        ]);
    }
    const saveBtn = document.getElementById('saveSensorBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 อัปเดตข้อมูลเซนเซอร์';
        saveBtn.setAttribute('onclick', 'saveDeviceWithThresholds(true)');
    }
    const modal = document.getElementById('deviceModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    updateCustomTypeVisibility();
    renderDeviceTable();
    renderBoardTable();
    updateAlertHistoryDropdown();
};

// ============================================================
//  6. SENSOR SCAN (ฉลาดขึ้น - กรอง bank_height, install_height)
// ============================================================

function detectSensorType(id, value) {
    const lowerId = id.toLowerCase();
    
    if (lowerId.includes('height') || 
        lowerId.includes('install') || 
        lowerId.includes('bank') ||
        lowerId.includes('config') ||
        lowerId.includes('setting')) {
        return null;
    }
    
    if (lowerId.includes('us') || lowerId.includes('dist') || lowerId.includes('hc-sr04')) {
        return 'ultrasonic';
    }
    if (lowerId.includes('soil') || lowerId.includes('moist') || lowerId.includes('humidity')) {
        return 'soil';
    }
    if (lowerId.includes('temp') || lowerId.includes('temperature') || lowerId.includes('ds18b20')) {
        return 'temp';
    }
    if (lowerId.includes('ph') || lowerId.includes('ph_') || lowerId.includes('ph-')) {
        return 'ph';
    }
    if (lowerId.includes('rain') || lowerId.includes('rainfall') || lowerId.includes('water')) {
        return 'rain';
    }
    
    if (typeof value === 'number') {
        if (value >= 0 && value <= 100 && !lowerId.includes('temp')) return 'soil';
        if (value >= 0 && value <= 14) return 'ph';
        if (value >= -10 && value <= 50) return 'temp';
        if (value >= 0 && value <= 500) return 'ultrasonic';
    }
    
    return 'ultrasonic';
}

window.scanForNewSensors = async function() {
    console.log("🔄 กำลังสแกนหาเซนเซอร์จากทุกบอร์ด...");
    const resultsContainer = document.getElementById('discoveryResults');
    if (!resultsContainer) {
        console.warn("⚠️ ไม่พบ #discoveryResults");
        return;
    }
    
    try {
        const snapshot = await window.get(window.ref(window.db, 'sensors'));
        if (!snapshot.exists()) {
            resultsContainer.innerHTML = `<span style="color: #fbbf24;">📭 ยังไม่มีข้อมูลจากบอร์ดใดๆ</span>`;
            return;
        }
        
        const allData = snapshot.val();
        const foundSensors = [];
        const IGNORE_FIELDS = [
            'timestamp', 'install_height', 'bank_height', 'status', 
            'water_level', 'online', 'sensor_error', 'board_id', 
            'savedAt', '_', 'meta', 'config', 'settings'
        ];
        
        for (const boardFolder in allData) {
            if (boardFolder === 'current' || boardFolder === 'history') {
                console.log(`⏭️ ข้ามโฟลเดอร์ระบบ: ${boardFolder}`);
                continue;
            }
            
            const boardData = allData[boardFolder];
            if (typeof boardData !== 'object' || boardData === null) continue;

            for (const [id, value] of Object.entries(boardData)) {
                if (IGNORE_FIELDS.includes(id)) continue;
                if (typeof value !== 'number' || isNaN(value)) continue;
                
                const sensorType = detectSensorType(id, value);
                if (!sensorType) {
                    console.log(`⏭️ ข้าม ${id} (ไม่ใช่เซนเซอร์)`);
                    continue;
                }
                
                if (!deviceConfigs[id]) {
                    foundSensors.push({
                        id: id,
                        value: value,
                        boardId: boardFolder,
                        type: sensorType
                    });
                }
            }
        }
        
        const uniqueMap = new Map();
        for (const sensor of foundSensors) {
            if (!uniqueMap.has(sensor.id)) {
                uniqueMap.set(sensor.id, sensor);
            }
        }
        const uniqueSensors = Array.from(uniqueMap.values());
        
        if (uniqueSensors.length === 0) {
            resultsContainer.innerHTML = `<span style="color: #4ade80;">✅ เซนเซอร์ทุกตัวถูกลงทะเบียนหมดแล้ว</span>`;
            return;
        }
        
        let html = `<div style="width:100%;">
            <span style="color: #4ade80; font-weight:bold;">🔍 พบเซนเซอร์ใหม่ที่ยังไม่ได้ตั้งค่า ${uniqueSensors.length} รายการ:</span>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">`;
        
        uniqueSensors.forEach(sensor => {
            const typeLabel = sensor.type === 'ultrasonic' ? '📡' :
                             sensor.type === 'soil' ? '🌱' :
                             sensor.type === 'temp' ? '🌡️' :
                             sensor.type === 'ph' ? '🧪' :
                             sensor.type === 'rain' ? '🌧️' : '🔍';
            
            html += `
                <button onclick="quickAddSensor('${sensor.id}', ${sensor.value}, '${sensor.type}', '${sensor.boardId}')" 
                        style="background: #1e293b; color: #e2e8f0; border: 1px solid #3b82f6; 
                               padding: 8px 16px; border-radius: 8px; cursor: pointer; 
                               transition:0.2s; display:flex; align-items:center; gap:8px;"
                        onmouseover="this.style.background='#334155'"
                        onmouseout="this.style.background='#1e293b'">
                    <span>${typeLabel}</span>
                    <span style="font-weight:bold;">🆔 ${sensor.id}</span>
                    <span style="color: #60a5fa; font-weight:bold;">${sensor.value}</span>
                    <span style="font-size:0.7rem; color:#94a3b8;">(จาก ${sensor.boardId})</span>
                    <span style="color:#4ade80;">➕ เพิ่ม</span>
                </button>`;
        });
        html += `</div></div>`;
        resultsContainer.innerHTML = html;
        
        console.log(`✅ พบเซนเซอร์ใหม่ ${uniqueSensors.length} รายการ:`, uniqueSensors.map(s => s.id).join(', '));
        
    } catch (error) {
        console.error("❌ scanForNewSensors error:", error);
        resultsContainer.innerHTML = `
            <span style="color: #ef4444;">❌ เกิดข้อผิดพลาด: ${error.message}</span>
        `;
    }
};

// ============================================================
//  6.1 QUICK ADD SENSOR
// ============================================================
window.quickAddSensor = async function(sensorId, value, type, detectedBoardId) {
    if (!sensorId) {
        alert("❌ ไม่พบ ID ของเซนเซอร์");
        return;
    }
    
    try {
        const isExisting = !!deviceConfigs[sensorId];
        
        if (isExisting) {
            const confirmOverwrite = confirm(
                `⚠️ เซนเซอร์ "${sensorId}" มีอยู่ในระบบแล้ว\n\n` +
                `ชื่อปัจจุบัน: ${deviceConfigs[sensorId].name || sensorId}\n` +
                `ชนิด: ${deviceConfigs[sensorId].type || 'ไม่ระบุ'}\n\n` +
                `ต้องการเขียนทับข้อมูลใหม่ใช่หรือไม่?`
            );
            if (!confirmOverwrite) return;
            
            try {
                const backupKey = `${sensorId}_backup_${Date.now()}`;
                await window.set(
                    window.ref(window.db, `device_configs_backup/${backupKey}`), 
                    deviceConfigs[sensorId]
                );
                console.log(`📦 บันทึกข้อมูลเก่าของ ${sensorId} ไว้ที่ ${backupKey}`);
            } catch (e) {
                console.warn("⚠️ บันทึกข้อมูลเก่าไม่สำเร็จ:", e);
            }
        }
        
        const sensorType = type || 'ultrasonic';
        let sensorName = '';
        if (!isExisting) {
            const inputName = prompt(
                `🆔 กรุณาตั้งชื่อสำหรับเซนเซอร์ ${sensorId}:`,
                `เซนเซอร์ ${sensorId}`
            );
            if (inputName === null) return;
            sensorName = inputName.trim() || `เซนเซอร์ ${sensorId}`;
        } else {
            const inputName = prompt(
                `🆔 เปลี่ยนชื่อเซนเซอร์ ${sensorId} (เว้นว่างไว้เพื่อใช้ชื่อเดิม):`,
                deviceConfigs[sensorId].name || `เซนเซอร์ ${sensorId}`
            );
            if (inputName === null) return;
            sensorName = inputName.trim() || deviceConfigs[sensorId].name || `เซนเซอร์ ${sensorId}`;
        }
        
        let boardId = detectedBoardId || null;
        
        if (!boardId) {
            try {
                const snapshot = await window.get(window.ref(window.db, 'sensors/current'));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    if (data.board_id) boardId = data.board_id;
                }
            } catch (e) {
                console.warn("⚠️ อ่าน board_id ไม่สำเร็จ:", e);
            }
        }
        
        if (!boardId) {
            const boards = Object.entries(deviceConfigs).filter(([id, config]) => config.type === 'board');
            if (boards.length === 1) {
                boardId = boards[0][0];
            } else if (boards.length > 1) {
                const boardList = boards.map(([id, config]) => `${id} (${config.name || id})`).join('\n');
                const input = prompt(`🔌 เลือกบอร์ดที่เชื่อมต่อ:\n${boardList}\n\nกรอก Board ID:`);
                if (input && boards.some(([id]) => id === input.trim())) {
                    boardId = input.trim();
                } else {
                    alert("❌ ไม่พบบอร์ดที่เลือก หรือยกเลิกการเพิ่มเซนเซอร์");
                    return;
                }
            } else {
                boardId = "esp32_node_02";
                console.log(`⚠️ ไม่พบบอร์ดในระบบ ใช้ค่าเริ่มต้น: ${boardId}`);
            }
        }
        
        // ============================================================
        //  ถ้ายังไม่มีบอร์ดในระบบ ให้สร้างใหม่
        // ============================================================
        if (!deviceConfigs[boardId]) {
            console.log(`📌 กำลังสร้างบอร์ด ${boardId} ในระบบ...`);
            
            // ✅ ตรวจสอบชื่อที่มีอยู่แล้วใน Firebase ก่อน
            let existingName = null;
            try {
                const nameSnap = await window.get(window.ref(window.db, `device_configs/${boardId}/name`));
                if (nameSnap.exists()) {
                    existingName = nameSnap.val();
                }
            } catch (e) {
                console.warn(`⚠️ ตรวจสอบชื่อบอร์ด ${boardId} ไม่สำเร็จ:`, e);
            }
            
            // ✅ ถ้ามีชื่อใน Firebase แล้ว ใช้ชื่อนั้น (ไม่เขียนทับ)
            // ✅ ถ้ายังไม่มี ใช้ค่าเริ่มต้น
            const boardName = existingName || `บอร์ด ${boardId}`;
            
            await window.set(window.ref(window.db, `device_configs/${boardId}`), {
                name: boardName,
                type: "board",
                enabled: true,
                status: "online",
                onlineSince: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
            deviceConfigs[boardId] = {
                name: boardName,
                type: "board",
                enabled: true,
                status: "online",
                onlineSince: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            console.log(`✅ สร้างบอร์ด ${boardId} สำเร็จ (ชื่อ: ${boardName}) - ${existingName ? 'ใช้ชื่อที่มีอยู่แล้ว' : 'ใช้ชื่อเริ่มต้น'}`);
        }
        
        const unitMap = {
            'ultrasonic': 'cm',
            'soil': '%',
            'temp': '°C',
            'ph': 'pH',
            'rain': 'mm'
        };
        const unit = unitMap[sensorType] || '';
        
        const levelMap = {
            'ultrasonic': [
                { label: 'น้ำน้อยมาก', min: 0, max: 19, color: '#6366f1', alert: false },
                { label: 'น้ำน้อย', min: 20, max: 39, color: '#3b82f6', alert: false },
                { label: 'ปกติ', min: 40, max: 69, color: '#10b981', alert: false },
                { label: 'สูง', min: 70, max: 89, color: '#f59e0b', alert: true },
                { label: 'วิกฤต', min: 90, max: 999, color: '#ef4444', alert: true }
            ],
            'soil': [
                { label: 'แห้งมาก', min: 0, max: 19, color: '#f59e0b', alert: true },
                { label: 'แห้ง', min: 20, max: 39, color: '#fbbf24', alert: false },
                { label: 'พอดี', min: 40, max: 69, color: '#10b981', alert: false },
                { label: 'ชื้น', min: 70, max: 89, color: '#3b82f6', alert: false },
                { label: 'แฉะ/น้ำขัง', min: 90, max: 100, color: '#6366f1', alert: true }
            ],
            'temp': [
                { label: 'หนาวจัด', min: -20, max: -5, color: '#6366f1', alert: true },
                { label: 'หนาว', min: -4, max: 14, color: '#3b82f6', alert: false },
                { label: 'ปกติ', min: 15, max: 29, color: '#10b981', alert: false },
                { label: 'ร้อน', min: 30, max: 39, color: '#f59e0b', alert: true },
                { label: 'ร้อนจัด', min: 40, max: 50, color: '#ef4444', alert: true }
            ],
            'ph': [
                { label: 'กรดจัด', min: 0, max: 3, color: '#ef4444', alert: true },
                { label: 'กรด', min: 4, max: 5, color: '#f59e0b', alert: false },
                { label: 'กลาง', min: 6, max: 8, color: '#10b981', alert: false },
                { label: 'ด่าง', min: 9, max: 11, color: '#3b82f6', alert: false },
                { label: 'ด่างจัด', min: 12, max: 14, color: '#6366f1', alert: true }
            ]
        };
        
        const defaultLevels = levelMap[sensorType] || [
            { label: 'น้อยที่สุด', min: 0, max: 19, color: '#6366f1', alert: false },
            { label: 'น้อย', min: 20, max: 39, color: '#3b82f6', alert: false },
            { label: 'ปานกลาง', min: 40, max: 69, color: '#10b981', alert: false },
            { label: 'มาก', min: 70, max: 89, color: '#f59e0b', alert: true },
            { label: 'มากที่สุด', min: 90, max: 100, color: '#ef4444', alert: true }
        ];
        
        const sensorData = {
            name: sensorName,
            type: sensorType,
            unit: unit,
            enabled: true,
            boardId: boardId,
            levels: defaultLevels,
            alertEnabled: true,
            alertLimit: 3,
            alertInterval: 5,
            installHeight: sensorType === 'ultrasonic' ? 50 : null,
            bankHeight: sensorType === 'ultrasonic' ? 25 : null,
            sensorMode: sensorType === 'ultrasonic' ? 'vertical' : 'horizontal',
            createdAt: isExisting ? deviceConfigs[sensorId]?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            status: 'online'
        };
        
        await window.set(window.ref(window.db, `device_configs/${sensorId}`), sensorData);
        deviceConfigs[sensorId] = sensorData;
        
        const unitDisplay = unit ? ` ${unit}` : '';
        alert(`✅ ${isExisting ? 'อัปเดต' : 'เพิ่ม'}เซนเซอร์ "${sensorId}" สำเร็จ!\n` +
              `📛 ชื่อ: ${sensorName}\n` +
              `📊 ค่าปัจจุบัน: ${value}${unitDisplay}\n` +
              `🔌 เชื่อมต่อบอร์ด: ${boardId}`);
        
        const refreshFunctions = [
            'renderDeviceTable', 'renderBoardTable', 'renderSensorCards',
            'updateChartStructure', 'updateStatusBarBoardDetails',
            'updateStandaloneAlertPanel', 'renderSummaryTable',
            'updateAlertHistoryDropdown', 'populateBoardSelector'
        ];
        
        for (const fn of refreshFunctions) {
            if (typeof window[fn] === 'function') {
                try { window[fn](); } catch (e) { /* ignore */ }
            }
        }
        
        if (typeof scanForNewSensors === 'function') {
            setTimeout(async () => await scanForNewSensors(), 500);
        }
        
        console.log("🔄 กำลังรีโหลดหน้าเว็บเพื่อแสดงผลการเปลี่ยนแปลง...");
        setTimeout(() => location.reload(), 1500);
        
    } catch (error) {
        console.error("❌ quickAddSensor error:", error);
        alert(`❌ ไม่สามารถดำเนินการได้: ${error.message}`);
    }
};
// ============================================================
//  7. PROVISIONING (USB)
// ============================================================
window.startProvisioningProcess = async function() {
    if (!("serial" in navigator)) {
        alert("❌ เบราว์เซอร์ของคุณไม่รองรับการติดตั้งผ่าน USB (กรุณาใช้ Chrome หรือ Edge)");
        return;
    }
    try {
        let port;
        try {
            port = await navigator.serial.requestPort();
        } catch (e) {
            console.log("ผู้ใช้ยกเลิกการเลือกพอร์ต");
            return;
        }
        const boardId = prompt("🆔 กรุณาระบุ ID สำหรับบอร์ดนี้ (เช่น esp32_node_01):");
        if (!boardId) return;
        const ssid = prompt("📶 ชื่อ WiFi (SSID):");
        if (!ssid) return;
        const pass = prompt("🔑 รหัสผ่าน WiFi:");
        await port.open({ baudRate: 115200 });
        console.log("⏳ กำลังรอให้บอร์ดบูตเสร็จ...");
        await new Promise(resolve => setTimeout(resolve, 2500));
        console.log("📡 กำลังรอสัญญาณ READY จากบอร์ด...");
        let ready = false;
        let readyTimeout = false;
        const timeoutId = setTimeout(() => {
            readyTimeout = true;
            console.warn("⏱️ หมดเวลารอ READY (5 วินาที)");
        }, 5000);
        try {
            const reader = port.readable.getReader();
            let buffer = '';
            while (!ready && !readyTimeout) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = new TextDecoder().decode(value);
                buffer += chunk;
                if (buffer.includes("READY")) {
                    ready = true;
                    console.log("✅ ได้รับสัญญาณ READY จากบอร์ด!");
                    break;
                }
                if (buffer.length > 1024) buffer = buffer.slice(-512);
            }
            reader.releaseLock();
        } catch (e) {
            console.warn("⚠️ อ่าน Serial ไม่สำเร็จ:", e);
        }
        clearTimeout(timeoutId);
        const configData = { id: boardId, ssid: ssid, password: pass || "" };
        console.log("📤 กำลังส่งข้อมูล Provisioning:", configData);
        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(JSON.stringify(configData) + "\n"));
        writer.releaseLock();
        console.log("⏳ กำลังรอให้บอร์ดประมวลผล...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (window.db) {
            const boardRef = window.ref(window.db, `device_configs/${boardId}`);
            const snap = await window.get(boardRef);
            if (!snap.exists()) {
                await window.set(boardRef, {
                    name: "บอร์ดควบคุม (" + boardId + ")",
                    type: "board",
                    enabled: true,
                    status: "online",
                    onlineSince: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                });
                console.log(`✅ สร้างบอร์ด ${boardId} ใน Firebase สำเร็จ`);
            } else {
                await window.update(boardRef, {
                    status: "online",
                    onlineSince: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                });
                console.log(`✅ อัปเดตสถานะบอร์ด ${boardId} สำเร็จ`);
            }
        }
        await port.close();
        alert(`✅ ติดตั้งบอร์ด ${boardId} สำเร็จ!`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        renderBoardTable();
        renderDeviceTable();
        renderSensorCards();
        updateStandaloneAlertPanel();
        updateStatusBarBoardDetails();
        populateBoardSelector();
        
        console.log(`🔄 รีเฟรช UI หลังจากติดตั้งบอร์ด ${boardId} เรียบร้อย`);
        
    } catch (error) {
        console.error("❌ Provisioning Error:", error);
        alert("❌ การติดตั้งล้มเหลว: " + error.message);
    }
};

// ============================================================
//  8. RENDER SENSOR CARDS (FIXED - CLEAR LOADING TEXT)
// ============================================================
function renderSensorCards() {
    const container = document.getElementById('sensorGridContainer');
    if (!container) return;
    
    // ✅ ล้างข้อความ "กำลังโหลด..." และข้อความ placeholder อื่นๆ
    const loadingMessages = [
        "กำลังโหลดการตั้งค่าอุปกรณ์",
        "⏳ กำลังโหลดการตั้งค่าอุปกรณ์...",
        "⏳ กำลังโหลด...",
        "Loading..."
    ];
    
    const hasLoadingText = loadingMessages.some(msg => container.innerHTML.includes(msg));
    if (hasLoadingText) {
        container.innerHTML = '';
    }
    
    // ล้างการ์ดที่ไม่มีข้อมูล (ถ้ามี)
    const existingCards = {};
    container.querySelectorAll('.sensor-card').forEach(card => {
        const id = card.id.replace('card_', '');
        if (id) existingCards[id] = card;
    });
    
    let hasEnabledDevice = false;
    const boardStatusMap = checkAllBoardsStatus();
    const activeIds = new Set();
    let cardCount = 0;
    
    // ✅ ถ้ายังไม่มีข้อมูลเซนเซอร์ใดๆ ให้แสดงข้อความ "ไม่มีเซนเซอร์"
    const sensors = Object.entries(deviceConfigs).filter(([id, config]) => {
        if (config.type === 'board') return false;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        return !isAutoGenerated;
    });
    
    // ถ้าไม่มีเซนเซอร์ที่ติดตั้งด้วยตนเอง
    if (sensors.length === 0) {
        container.innerHTML = `
            <div style="width:100%; text-align:center; color:#94a3b8; padding:40px 20px;">
                <div style="font-size:3rem; margin-bottom:10px;">📭</div>
                <div style="font-size:1.1rem; color:#e2e8f0;">ยังไม่มีเซนเซอร์ที่ติดตั้ง</div>
                <div style="font-size:0.85rem; margin-top:8px; color:#64748b;">กรุณาเพิ่มเซนเซอร์ด้วยตนเองผ่านปุ่ม ⚙️ จัดการอุปกรณ์</div>
            </div>
        `;
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        return;
    }
    
    // นับจำนวนการ์ดที่จะแสดง
    for (const [id, config] of Object.entries(deviceConfigs)) {
        if (config.type === 'board') continue;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) continue;
        cardCount++;
    }
    
    for (const [id, config] of Object.entries(deviceConfigs)) {
        if (config.type === 'board') continue;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) {
            console.log(`⏭️ ข้ามเซนเซอร์อัตโนมัติ: ${id}`);
            continue;
        }
        activeIds.add(id);
        hasEnabledDevice = true;
        
        const isEnabled = config.enabled !== false;
        
        let boardStatus = null;
        let isBoardOnline = false;
        let boardName = 'ไม่ระบุบอร์ด';
        let boardIdDisplay = 'N/A';
        
        if (config.boardId && boardStatusMap[config.boardId]) {
            boardStatus = boardStatusMap[config.boardId];
            isBoardOnline = boardStatus.isOnline;
            boardName = boardStatus.name;
            boardIdDisplay = config.boardId;
        } else {
            const lastSeenTime = config.lastSeen ? new Date(config.lastSeen).getTime() : 0;
            isBoardOnline = (Date.now() - lastSeenTime) < 600000; // ✅ 10 นาที
            boardName = 'ไม่ระบุบอร์ด';
            boardIdDisplay = config.boardId || 'N/A';
        }
        
        const isSensorOnline = isEnabled && isBoardOnline;
        const hasRealData = currentSensorValues[id] !== undefined && 
                           currentSensorValues[id] !== null && 
                           !isNaN(currentSensorValues[id]);
        
        if (existingCards[id]) {
            updateSensorCardContent(existingCards[id], id, config, boardStatusMap, isBoardOnline, isSensorOnline, hasRealData);
            delete existingCards[id];
        } else {
            createSensorCard(container, id, config, boardStatusMap, isBoardOnline, isSensorOnline, hasRealData);
        }
    }
    
    for (const [id, card] of Object.entries(existingCards)) {
        if (!activeIds.has(id) && card.parentNode) {
            card.remove();
            console.log(`🗑️ ลบการ์ดที่ไม่มีข้อมูล: ${id}`);
        }
    }
    
    if (cardCount === 1) {
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'wrap';
        container.style.gap = '12px';
    } else if (cardCount > 1) {
        container.style.display = 'flex';
        container.style.justifyContent = 'flex-start';
        container.style.alignItems = 'stretch';
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'wrap';
        container.style.gap = '12px';
    }
    
    if (!hasEnabledDevice) {
        container.innerHTML = `
            <div style="width:100%; text-align:center; color:#94a3b8; grid-column: 1 / -1; padding:40px 20px;">
                <div style="font-size:3rem; margin-bottom:10px;">📭</div>
                <div style="font-size:1.1rem; color:#e2e8f0;">ยังไม่มีเซนเซอร์ที่ติดตั้ง</div>
                <div style="font-size:0.85rem; margin-top:8px; color:#64748b;">กรุณาเพิ่มเซนเซอร์ด้วยตนเองผ่านปุ่ม ⚙️ จัดการอุปกรณ์</div>
            </div>
        `;
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
    }
    
    renderSummaryTable();
    updateChartStructure();
    setTimeout(addHistoryButtonsToSensorCards, 100);
}

// ============================================================
//  8.1 CREATE NEW SENSOR CARD
// ============================================================
function createSensorCard(container, id, config, boardStatusMap, isBoardOnline, isSensorOnline, hasRealData) {
    const isEnabled = config.enabled !== false;
    const iconMap = { ultrasonic: '📡', soil: '🌱', rain: '🌧️', ph: '🧪', temp: '🌡️' };
    const icon = iconMap[config.type] || '🔍';
    
    let boardName = 'ไม่ระบุบอร์ด';
    let boardIdDisplay = 'N/A';
    if (config.boardId && boardStatusMap[config.boardId]) {
        boardName = boardStatusMap[config.boardId].name;
        boardIdDisplay = config.boardId;
    }
    
    let cardClass = isEnabled ? "sensor-card" : "sensor-card disabled-card";
    if (isEnabled && !isBoardOnline) {
        cardClass = "sensor-card offline-card";
    }
    
    const cardHTML = `
        <div class="${cardClass}" id="card_${id}" style="min-height: 220px; min-width: 260px; max-width: 320px; flex: 0 0 auto; box-sizing: border-box; contain: layout style paint; margin: 0 auto;">
            <div class="sensor-title" style="min-height: 1.8rem;">${icon} ${escapeHtml(config.name)}</div>
            <div class="sensor-value" style="min-height: 2.5rem; display: flex; align-items: baseline; gap: 4px; font-size: 1.8rem;">
                <span id="val_${id}">--</span>
                <span class="sensor-unit" style="font-size: 0.9rem;">${isSensorOnline ? escapeHtml(config.unit) : ''}</span>
            </div>
            <div class="sensor-status-badge" id="statusBadge_${id}" style="min-height: 1.6rem;"></div>
            <div id="levelBadge_${id}" class="sensor-level-badge-container" style="min-height: 1.5rem;"></div>
            <div id="diff_${id}" style="min-height: 70px; font-size: 0.8rem;"></div>
            <div class="timestamp" id="time_${id}" style="min-height: 1.2rem; font-size: 0.65rem;"></div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHTML);
    
    updateSensorCardContent(
        document.getElementById(`card_${id}`), 
        id, config, boardStatusMap, isBoardOnline, isSensorOnline, hasRealData
    );
}

// ============================================================
//  8.2 UPDATE EXISTING SENSOR CARD
// ============================================================
function updateSensorCardContent(card, id, config, boardStatusMap, isBoardOnline, isSensorOnline, hasRealData) {
    if (!card) return;
    
    const isEnabled = config.enabled !== false;
    let boardName = 'ไม่ระบุบอร์ด';
    let boardIdDisplay = 'N/A';
    if (config.boardId && boardStatusMap[config.boardId]) {
        boardName = boardStatusMap[config.boardId].name;
        boardIdDisplay = config.boardId;
    }
    
    const valEl = document.getElementById(`val_${id}`);
    const timeEl = document.getElementById(`time_${id}`);
    const diffEl = document.getElementById(`diff_${id}`);
    const levelBadgeEl = document.getElementById(`levelBadge_${id}`);
    const statusBadgeEl = document.getElementById(`statusBadge_${id}`);
    
    let displayValue = '--';
    let lastSeenDisplay = '--';
    let levelLabel = 'ไม่ได้ตั้งค่า';
    let levelColor = '#94a3b8';
    let shouldAlert = false;
    let diffHTML = '';
    let statusBadgeHTML = '';
    let alertBadgeHTML = '';
    let isFlooding = false;
    let overBankAmount = 0;
    let rawDistance = '--';
    let waterLevel = null;
    
    // ✅ แสดงชื่อบอร์ดเฉพาะใน statusBadge (ตำแหน่งเดียว)
    const boardStatusHtml = isBoardOnline 
        ? `<span style="color: #4ade80;">🟢 ออนไลน์</span>`
        : `<span style="color: #f87171;">🔴 ออฟไลน์</span>`;
    
    // ===== กรณีอุปกรณ์ปิดอยู่ =====
    if (!isEnabled) {
        statusBadgeHTML = `
            <div class="sensor-status-badge offline" style="color: #94a3b8; font-size: 0.7rem; margin-top: 4px;">
                ⏸️ อุปกรณ์ปิดอยู่
            </div>
        `;
        displayValue = '⏸️ ปิดอยู่';
        lastSeenDisplay = '⏸️ ปิดอยู่';
        diffHTML = `
            <div style="color: #94a3b8; font-size: 0.6rem; margin-top: 2px;">
                🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
            </div>
        `;
        if (valEl) valEl.textContent = displayValue;
        if (timeEl) timeEl.textContent = lastSeenDisplay;
        if (diffEl) diffEl.innerHTML = diffHTML;
        if (statusBadgeEl) statusBadgeEl.outerHTML = statusBadgeHTML;
        return;
    }
    
    // ===== กรณีบอร์ดออฟไลน์ =====
    if (!isBoardOnline) {
        const boardLastSeen = config.lastSeen;
        const lastSeenTime = boardLastSeen ? new Date(boardLastSeen).getTime() : 0;
        const mins = lastSeenTime ? Math.round((Date.now() - lastSeenTime) / 60000) : 0;
        let durationText = '';
        if (mins < 60) {
            durationText = `${mins} นาที`;
        } else {
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            durationText = `${hours} ชั่วโมง ${remainingMins} นาที`;
        }
        statusBadgeHTML = `
            <div class="sensor-status-badge offline" style="color: #f87171; font-size: 0.7rem; margin-top: 4px; font-weight: bold;">
                ⛔ บอร์ดออฟไลน์ (หยุดทำงาน ${durationText})
            </div>
        `;
        const lastSeenDisplayTime = boardLastSeen ? new Date(boardLastSeen).toLocaleTimeString('th-TH') : 'ไม่ทราบ';
        lastSeenDisplay = `⏸️ อัปเดตล่าสุด: ${lastSeenDisplayTime}`;
        const stuckValue = hasRealData ? currentSensorValues[id] : '--';
        diffHTML = `
            <div style="color: #94a3b8; font-size: 0.6rem; margin-top: 2px;">
                🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
            </div>
            <div style="color: #64748b; font-size: 0.6rem; margin-top: 2px;">
                🕐 ค่าที่ค้างอยู่: ${stuckValue}
            </div>
        `;
        displayValue = '--';
        if (valEl) valEl.textContent = displayValue;
        if (timeEl) timeEl.textContent = lastSeenDisplay;
        if (diffEl) diffEl.innerHTML = diffHTML;
        if (statusBadgeEl) statusBadgeEl.outerHTML = statusBadgeHTML;
        return;
    }
    
    // ===== กรณีบอร์ดออนไลน์และมีข้อมูล =====
    if (isBoardOnline && hasRealData) {
        // ✅ แสดงสถานะบอร์ดใน statusBadge (ตำแหน่งเดียว)
        statusBadgeHTML = `
            <div class="sensor-status-badge online" style="color: #4ade80; font-size: 0.7rem; margin-top: 4px;">
                🟢 กำลังทำงาน
            </div>
        `;
        displayValue = currentSensorValues[id];
        
        // ✅ ใช้เวลาปัจจุบันจาก window._lastDataTime หรือเวลาปัจจุบัน
        const nowTime = window._lastDataTime ? new Date(window._lastDataTime).toLocaleTimeString('th-TH') : new Date().toLocaleTimeString('th-TH');
        lastSeenDisplay = `🟢 อัปเดต: ${nowTime}`;
        
        const numValue = parseFloat(displayValue);
        if (!isNaN(numValue)) {
            const result = evaluateLevelWithCustom(numValue, config.levels);
            levelLabel = result.label || 'ไม่ได้ตั้งค่า';
            levelColor = result.color || '#94a3b8';
            shouldAlert = result.shouldAlert || false;
        }
        
        // ===== กรณี Ultrasonic =====
        if (config.type === 'ultrasonic' && config.installHeight) {
            const raw = parseFloat(currentSensorValues[id]);
            const installHeight = parseFloat(config.installHeight);
            if (!isNaN(raw) && !isNaN(installHeight)) {
                waterLevel = installHeight - raw;
                if (waterLevel < 0) waterLevel = 0;
                displayValue = waterLevel.toFixed(2);
                rawDistance = raw;
                const bankHeight = parseFloat(config.bankHeight) || 25;
                const distanceToBank = bankHeight - waterLevel;
                
                const waterLevelNum = parseFloat(waterLevel);
                if (!isNaN(waterLevelNum)) {
                    const waterResult = evaluateLevelWithCustom(waterLevelNum, config.levels);
                    levelLabel = waterResult.label || 'ไม่ได้ตั้งค่า';
                    levelColor = waterResult.color || '#60a5fa';
                    shouldAlert = waterResult.shouldAlert || false;
                }
                
                if (distanceToBank < 0) {
                    isFlooding = true;
                    overBankAmount = Math.abs(distanceToBank);
                }
                
                let statusText = '';
                let detailColor = '#60a5fa';
                
                if (isFlooding) {
                    statusText = `🌊 น้ำท่วม! สูงกว่าตลิ่ง ${overBankAmount.toFixed(2)} ซม.`;
                    detailColor = '#d32f2f';
                } else {
                    statusText = `ระดับน้ำ: ${waterLevel.toFixed(2)} ซม. (ห่างตลิ่ง ${distanceToBank.toFixed(2)} ซม.)`;
                    detailColor = levelColor;
                }
                
                // ✅ diff แสดงข้อมูลเฉพาะเซนเซอร์ (ไม่ซ้ำชื่อบอร์ด)
                // 🔥 แก้ไข: ตัดข้อความน้ำท่วมออกไปบ้าง เพื่อไม่ให้ซ้ำกับ alert-badge
                diffHTML = `
                    <div style="font-weight: bold; color: ${detailColor};">
                        ${isFlooding ? '🌊 น้ำล้นตลิ่ง! สูงกว่า ' + overBankAmount.toFixed(2) + ' ซม.' : statusText}
                    </div>
                    <div style="color: #94a3b8; font-size: 0.6rem;">📏 ระยะที่วัดได้: ${raw.toFixed(2)} ซม.</div>
                    <div style="color: ${detailColor}; font-size: 0.7rem;">📌 สถานะ: ${levelLabel}</div>
                    <div style="color: #64748b; font-size: 0.55rem; margin-top: 2px;">
                        🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
                    </div>
                `;
                
                // ✅ alertBadge แสดงเฉพาะข้อความสั้นๆ ไม่ซ้ำ
                if (isFlooding) {
                    alertBadgeHTML = `<div class="alert-badge flood" style="background: #d32f2f; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; margin-top: 8px; text-align: center; animation: alertPulse 1.5s infinite;">🌊 น้ำท่วม!</div>`;
                } else if (shouldAlert) {
                    alertBadgeHTML = `<div class="alert-badge warning" style="background: #f57c00; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; margin-top: 8px; text-align: center;">⚠️ ${levelLabel}</div>`;
                }
            }
        }
        
        // ===== กรณีเซนเซอร์อื่นๆ (ไม่ใช่ Ultrasonic) =====
        if (config.type !== 'ultrasonic') {
            const val = parseFloat(displayValue);
            if (!isNaN(val)) {
                const result = evaluateLevelWithCustom(val, config.levels);
                if (result && result.label !== 'ไม่ได้ตั้งค่า' && result.label !== 'ไม่มีข้อมูล') {
                    const statusEmoji = result.shouldAlert ? '⚠️ ' : '📊 ';
                    levelLabel = result.label;
                    levelColor = result.color || '#60a5fa';
                    shouldAlert = result.shouldAlert || false;
                    diffHTML = `
                        <div style="color: ${levelColor}; font-size: 0.7rem; margin-top: 4px;">
                            ${statusEmoji} สถานะ: ${levelLabel}
                        </div>
                        <div style="color: #64748b; font-size: 0.55rem; margin-top: 2px;">
                            🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
                        </div>
                    `;
                    if (shouldAlert) {
                        alertBadgeHTML = `<div class="alert-badge warning" style="background: #f57c00; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; margin-top: 8px; text-align: center;">⚠️ ${levelLabel}</div>`;
                    }
                }
            }
        }
        
    // ===== กรณีบอร์ดออนไลน์แต่ยังไม่มีข้อมูล =====
    } else if (isBoardOnline && !hasRealData) {
        statusBadgeHTML = `
            <div class="sensor-status-badge waiting" style="color: #fbbf24; font-size: 0.7rem; margin-top: 4px;">
                ⏳ รอข้อมูล...
            </div>
        `;
        displayValue = '--';
        lastSeenDisplay = `⏳ รอข้อมูล...`;
        diffHTML = `
            <div style="color: #fbbf24; font-size: 0.6rem;">
                ⏳ กำลังรอข้อมูล
            </div>
            <div style="color: #64748b; font-size: 0.55rem; margin-top: 2px;">
                🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
            </div>
        `;
    }
    
    // ===== อัปเดต DOM =====
    if (valEl) {
        valEl.textContent = displayValue;
        valEl.style.color = (displayValue !== '--' && displayValue !== '⏸️ ปิดอยู่') ? '' : '#94a3b8';
    }
    
    if (timeEl) {
        timeEl.textContent = lastSeenDisplay;
        if (isBoardOnline && hasRealData) {
            timeEl.style.color = '#0d6b2a';
        } else if (!isBoardOnline) {
            timeEl.style.color = '#b71c1c';
        } else {
            timeEl.style.color = '#bf360c';
        }
    }
    
    if (diffEl) {
        diffEl.innerHTML = diffHTML;
    }
    
    if (statusBadgeEl) {
        statusBadgeEl.outerHTML = statusBadgeHTML;
    }
    
    if (levelBadgeEl) {
        if (levelLabel && levelLabel !== 'ไม่ได้ตั้งค่า' && levelLabel !== 'ไม่มีข้อมูล') {
            levelBadgeEl.innerHTML = `
                <span style="background: ${levelColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.65rem;">
                    ${levelLabel}
                </span>
            `;
        } else {
            levelBadgeEl.innerHTML = '';
        }
    }
    
    // ===== จัดการ Alert Badge =====
    let existingAlertBadge = card.querySelector('.alert-badge');
    if (alertBadgeHTML) {
        if (existingAlertBadge) {
            existingAlertBadge.outerHTML = alertBadgeHTML;
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = alertBadgeHTML;
            card.appendChild(tempDiv.firstElementChild);
        }
    } else {
        if (existingAlertBadge) {
            existingAlertBadge.remove();
        }
    }
    
    // ===== จัดการ Class ของการ์ด =====
    card.classList.remove('flood-alert', 'warning-alert');
    if (isFlooding) {
        card.classList.add('flood-alert');
    } else if (shouldAlert) {
        card.classList.add('warning-alert');
    }
}
// ============================================================
//  9. CHART - UPDATED (No Blink with chart.update('none'))
// ============================================================
function initChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                title: { 
                    display: true, 
                    text: 'Real-time Data (เฉพาะอุปกรณ์ที่เปิด)',
                    color: '#0d2b1a',  // ✅ เข้มขึ้น
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    labels: { 
                        color: '#1a202c',  // ✅ เข้มขึ้น
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: '#1a202c',  // ✅ เข้มขึ้น
                        maxTicksLimit: 15,
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    grid: { 
                        color: 'rgba(0, 0, 0, 0.08)'  // ✅ จางลง
                    }
                },
                y: {
                    ticks: { 
                        color: '#1a202c',  // ✅ เข้มขึ้น
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    },
                    grid: { 
                        color: 'rgba(0, 0, 0, 0.08)'  // ✅ จางลง
                    }
                }
            }
        }
    });
    updateChartStructure();
}

// ============================================================
//  9.1 UPDATE CHART STRUCTURE
// ============================================================
function updateChartStructure() {
    if (!chart) return;
    
    const oldDatasets = chart.data.datasets || [];
    const newDatasets = [];
    let index = 0;
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'];
    
    Object.keys(deviceConfigs).forEach((id) => {
        const config = deviceConfigs[id];
        if (!config.enabled || config.type === 'board') return;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) return;
        
        if (!sensorHistory.data[id]) {
            sensorHistory.data[id] = [];
        }
        const currentVal = currentSensorValues[id];
        if (currentVal !== undefined && currentVal !== null && !isNaN(currentVal)) {
            const val = parseFloat(currentVal);
            if (!isNaN(val)) {
                const lastIdx = sensorHistory.data[id].length - 1;
                if (lastIdx < 0 || sensorHistory.data[id][lastIdx] !== val) {
                    sensorHistory.data[id].push(val);
                    if (sensorHistory.data[id].length > 100) {
                        sensorHistory.data[id].shift();
                    }
                }
            }
        }
        
        const color = colors[index % colors.length];
        let existingDataset = null;
        for (const ds of oldDatasets) {
            if (ds.label && ds.label.includes(id)) {
                existingDataset = ds;
                break;
            }
        }
        
        if (existingDataset) {
            newDatasets.push({
                label: existingDataset.label || `${config.name} (${config.unit || ''})`,
                data: sensorHistory.data[id] || [],
                borderColor: existingDataset.borderColor || color,
                backgroundColor: existingDataset.backgroundColor || (color + '33'),
                tension: existingDataset.tension || 0.1,
                fill: existingDataset.fill !== undefined ? existingDataset.fill : true,
                pointRadius: existingDataset.pointRadius || 2,
                pointHoverRadius: existingDataset.pointHoverRadius || 6
            });
        } else {
            newDatasets.push({
                label: `${config.name} (${config.unit || ''})`,
                data: sensorHistory.data[id] || [],
                borderColor: color,
                backgroundColor: color + '33',
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 6
            });
        }
        index++;
    });
    
    const maxDataLength = Math.max(...Object.values(sensorHistory.data).map(arr => arr.length), 0);
    let newLabels = sensorHistory.timestamps || [];
    if (newLabels.length < maxDataLength) {
        const lastLabel = newLabels.length > 0 ? newLabels[newLabels.length - 1] : '--:--:--';
        while (newLabels.length < maxDataLength) {
            newLabels.push(lastLabel);
        }
    } else if (newLabels.length > maxDataLength && newLabels.length > 0) {
        newLabels = newLabels.slice(0, maxDataLength);
    }
    
    chart.data.datasets = newDatasets;
    chart.data.labels = newLabels;
    chart.update('none');
    
    // ✅ เพิ่ม resize เพื่อปรับขนาดกราฟให้พอดีเมื่อมีการเปลี่ยนแปลง
    setTimeout(() => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    }, 100);
    
    console.log("📊 อัปเดตกราฟ (no blink):", newDatasets.length, "ชุด,", chart.data.labels.length, "จุดเวลา");
}
// ============================================================
//  9.2 GET HISTORY FOR CHART
// ============================================================
async function getHistoryForChart(deviceId, points = 100, timeWindow = 24) {
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม");
        return [];
    }
    try {
        const historyRef = window.ref(window.db, 'sensor_history');
        const snapshot = await window.get(historyRef);
        if (!snapshot.exists()) {
            console.log("📭 ไม่มีข้อมูลประวัติในระบบ");
            return [];
        }
        let rawData = [];
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - timeWindow);
        snapshot.forEach((child) => {
            const item = child.val();
            if (item && item.timestamp && item.values && item.values[deviceId] !== undefined) {
                const time = new Date(item.timestamp);
                if (time >= cutoffTime) {
                    rawData.push({
                        time: time,
                        val: Number(item.values[deviceId])
                    });
                }
            }
        });
        rawData.sort((a, b) => a.time - b.time);
        if (rawData.length === 0) {
            return [];
        }
        if (rawData.length <= points) {
            return rawData;
        }
        const step = Math.floor(rawData.length / points);
        const sampledData = [];
        for (let i = 0; i < rawData.length; i += step) {
            sampledData.push(rawData[i]);
        }
        while (sampledData.length < points && sampledData.length < rawData.length) {
            const lastIndex = sampledData.length - 1;
            if (lastIndex + 1 < rawData.length) {
                sampledData.push(rawData[lastIndex + 1]);
            } else {
                break;
            }
        }
        const interpolatedData = [];
        if (sampledData.length < 2) {
            return sampledData;
        }
        for (let i = 0; i < sampledData.length - 1; i++) {
            const current = sampledData[i];
            const next = sampledData[i + 1];
            interpolatedData.push(current);
            const timeDiff = next.time.getTime() - current.time.getTime();
            if (timeDiff > 5 * 60 * 1000) {
                const steps = Math.min(Math.floor(timeDiff / (60 * 1000)), 30);
                const stepValue = (next.val - current.val) / (steps + 1);
                for (let j = 1; j <= steps; j++) {
                    const interpolatedTime = new Date(current.time.getTime() + (timeDiff / (steps + 1)) * j);
                    const interpolatedVal = current.val + stepValue * j;
                    interpolatedData.push({
                        time: interpolatedTime,
                        val: Number(interpolatedVal.toFixed(2))
                    });
                }
            }
        }
        if (sampledData.length > 0) {
            interpolatedData.push(sampledData[sampledData.length - 1]);
        }
        if (interpolatedData.length > points) {
            const finalStep = Math.floor(interpolatedData.length / points);
            const finalData = [];
            for (let i = 0; i < interpolatedData.length; i += finalStep) {
                finalData.push(interpolatedData[i]);
            }
            return finalData;
        }
        return interpolatedData;
    } catch (error) {
        console.error("❌ getHistoryForChart error:", error);
        return [];
    }
}

// ============================================================
//  9.3 HISTORY CHART MODAL FUNCTIONS
// ============================================================
window.openHistoryChart = function() {
    const sensors = Object.entries(deviceConfigs)
        .filter(([id, config]) => config.type !== 'board' && config.enabled !== false);
    if (sensors.length === 0) {
        alert("📭 ไม่มีเซนเซอร์ที่เปิดใช้งาน");
        return;
    }
    const modal = document.getElementById('historyChartModal');
    if (!modal) {
        createHistoryChartModal(sensors);
    } else {
        modal.style.display = 'flex';
        populateHistoryChartDropdown(sensors);
    }
};

function createHistoryChartModal(sensors) {
    const modalHTML = `
        <div id="historyChartModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; justify-content:center; align-items:center; padding:20px;">
            <div style="background:#1e293b; border-radius:12px; padding:24px; max-width:900px; width:100%; max-height:90vh; overflow-y:auto; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="color:#e2e8f0; margin:0;">📊 กราฟประวัติเซนเซอร์</h3>
                    <button onclick="closeHistoryChart()" style="background:#ef4444; color:white; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; font-size:18px;">✕</button>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
                    <select id="historyChartDeviceSelect" style="flex:1; min-width:150px; padding:8px 12px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#e2e8f0;">
                        <option value="">-- เลือกอุปกรณ์ --</option>
                    </select>
                    <select id="historyChartTimeWindow" style="padding:8px 12px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#e2e8f0;">
                        <option value="6">6 ชั่วโมง</option>
                        <option value="12">12 ชั่วโมง</option>
                        <option value="24" selected>24 ชั่วโมง</option>
                        <option value="48">48 ชั่วโมง</option>
                        <option value="72">3 วัน</option>
                        <option value="168">7 วัน</option>
                    </select>
                    <select id="historyChartPoints" style="padding:8px 12px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#e2e8f0;">
                        <option value="50">50 จุด</option>
                        <option value="100" selected>100 จุด</option>
                        <option value="200">200 จุด</option>
                        <option value="500">500 จุด</option>
                    </select>
                    <button onclick="loadHistoryChart()" style="background:#3b82f6; color:white; border:none; padding:8px 20px; border-radius:6px; cursor:pointer;">🔄 โหลด</button>
                    <button onclick="exportHistoryChart()" style="background:#10b981; color:white; border:none; padding:8px 20px; border-radius:6px; cursor:pointer;">📥 CSV</button>
                </div>
                <div style="background:#0f172a; border-radius:8px; padding:16px; border:1px solid #334155;">
                    <canvas id="historyChartCanvas" style="width:100%; height:300px;"></canvas>
                </div>
                <div id="historyChartStats" style="margin-top:12px; display:flex; gap:20px; flex-wrap:wrap; font-size:0.85rem; color:#94a3b8;">
                    <span>📊 จำนวนจุด: <span id="historyDataCount">0</span></span>
                    <span>📅 ช่วงเวลา: <span id="historyTimeRange">-</span></span>
                    <span>📈 ค่าสูงสุด: <span id="historyMaxVal">-</span></span>
                    <span>📉 ค่าต่ำสุด: <span id="historyMinVal">-</span></span>
                    <span>📊 ค่าเฉลี่ย: <span id="historyAvgVal">-</span></span>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    populateHistoryChartDropdown(sensors);
}

function populateHistoryChartDropdown(sensors) {
    const select = document.getElementById('historyChartDeviceSelect');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
    sensors.forEach(([id, config]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${config.name || id} (${config.type})`;
        select.appendChild(option);
    });
    if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

window.closeHistoryChart = function() {
    const modal = document.getElementById('historyChartModal');
    if (modal) modal.style.display = 'none';
};

window.loadHistoryChart = async function() {
    const deviceId = document.getElementById('historyChartDeviceSelect')?.value;
    const timeWindow = parseInt(document.getElementById('historyChartTimeWindow')?.value) || 24;
    const points = parseInt(document.getElementById('historyChartPoints')?.value) || 100;
    if (!deviceId) {
        alert("⚠️ กรุณาเลือกอุปกรณ์");
        return;
    }
    try {
        const historyData = await getHistoryForChart(deviceId, points, timeWindow);
        if (historyData.length === 0) {
            alert(`📭 ไม่มีข้อมูลของอุปกรณ์นี้ในช่วง ${timeWindow} ชั่วโมงที่ผ่านมา`);
            return;
        }
        const values = historyData.map(d => d.val);
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
        document.getElementById('historyDataCount').textContent = historyData.length;
        document.getElementById('historyTimeRange').textContent = 
            `${historyData[0].time.toLocaleString('th-TH')} - ${historyData[historyData.length-1].time.toLocaleString('th-TH')}`;
        document.getElementById('historyMaxVal').textContent = maxVal.toFixed(2);
        document.getElementById('historyMinVal').textContent = minVal.toFixed(2);
        document.getElementById('historyAvgVal').textContent = avgVal.toFixed(2);
        const canvas = document.getElementById('historyChartCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        const config = deviceConfigs[deviceId];
        const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyData.map(d => d.time.toLocaleString('th-TH')),
                datasets: [{
                    label: `${config ? config.name : deviceId} (${config ? config.unit : ''})`,
                    data: historyData.map(d => d.val),
                    borderColor: color,
                    backgroundColor: color + '33',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    },
                    title: {
                        display: true,
                        text: `📊 ประวัติข้อมูล ${config ? config.name : deviceId} (${timeWindow} ชั่วโมง)`,
                        color: '#e2e8f0'
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#94a3b8',
                            maxTicksLimit: 15,
                            maxRotation: 45,
                            autoSkip: true
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        console.log(`✅ โหลดกราฟประวัติของ ${deviceId} สำเร็จ (${historyData.length} จุด)`);
    } catch (error) {
        console.error("❌ loadHistoryChart error:", error);
        alert("❌ โหลดกราฟไม่สำเร็จ: " + error.message);
    }
};

window.exportHistoryChart = async function() {
    const deviceId = document.getElementById('historyChartDeviceSelect')?.value;
    const timeWindow = parseInt(document.getElementById('historyChartTimeWindow')?.value) || 24;
    if (!deviceId) {
        alert("⚠️ กรุณาเลือกอุปกรณ์");
        return;
    }
    try {
        const historyData = await getHistoryForChart(deviceId, 10000, timeWindow);
        if (historyData.length === 0) {
            alert(`📭 ไม่มีข้อมูลของอุปกรณ์นี้ในช่วง ${timeWindow} ชั่วโมงที่ผ่านมา`);
            return;
        }
        let csv = "\ufeffเวลา,ค่า\n";
        historyData.forEach(d => {
            csv += `${d.time.toISOString()},${d.val}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `History_${deviceId}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        console.log(`✅ ส่งออก CSV ของ ${deviceId} สำเร็จ (${historyData.length} รายการ)`);
    } catch (error) {
        console.error("❌ exportHistoryChart error:", error);
        alert("❌ ส่งออก CSV ไม่สำเร็จ: " + error.message);
    }
};

window.openHistoryChartForDevice = function(deviceId) {
    const modal = document.getElementById('historyChartModal');
    if (!modal) {
        const sensors = Object.entries(deviceConfigs)
            .filter(([id, config]) => config.type !== 'board' && config.enabled !== false);
        createHistoryChartModal(sensors);
    }
    const select = document.getElementById('historyChartDeviceSelect');
    if (select) {
        select.value = deviceId;
    }
    const modalEl = document.getElementById('historyChartModal');
    if (modalEl) {
        modalEl.style.display = 'flex';
    }
    setTimeout(() => {
        loadHistoryChart();
    }, 300);
};

// ============================================================
//  10. PROCESS NEW DATA - UPDATED
//  ✅ ไม่มีการอัปเดตชื่อบอร์ดจาก ESP32
// ============================================================
async function processNewData(dataObj) {
    if (!dataObj) return;
    
    console.log("📡 รับข้อมูลใหม่:", dataObj);
    window._lastDataTime = Date.now();
    
    const boardId = dataObj.board_id || null;
    const timeNow = new Date();

    // ✅ ตรวจสอบว่ามีข้อมูลเซนเซอร์จริงหรือไม่
    const sensorKeys = Object.keys(dataObj).filter(key => 
        !['timestamp', 'board_id', 'wifi_rssi', 'rssi', 'status', 'online', 'install_height', 'bank_height', '_timestamp', 'savedAt'].includes(key) &&
        typeof dataObj[key] === 'number' &&
        !isNaN(dataObj[key])
    );

    // ✅ ถ้าไม่มีเซนเซอร์ในข้อมูลนี้ ให้ข้ามการอัปเดตบอร์ด
    if (sensorKeys.length === 0) {
        console.log(`⏭️ ข้ามอัปเดตบอร์ด ${boardId || 'ไม่ระบุ'} (ไม่มีข้อมูลเซนเซอร์)`);
    }

    // ============================================================
    //  🔥 สำคัญ: ไม่มีการอัปเดต boardRef ใน processNewData
    //  ปล่อยให้ checkBoardStatusFromSensors เป็นผู้จัดการ
    //  และไม่เขียนทับชื่อที่ผู้ใช้ตั้งไว้
    // ============================================================

    // 2. กรองเฉพาะ ID ที่เป็นเซนเซอร์ (ตัวเลข)
    const IGNORE_FIELDS = ['timestamp', 'install_height', 'status', 'water_level', '_', 'meta', 'savedAt', 'board_id', 'wifi_rssi', 'rssi', '_timestamp'];
    const sensorKeys2 = Object.keys(dataObj).filter(key => 
        !IGNORE_FIELDS.includes(key) && 
        typeof dataObj[key] === 'number' && 
        !isNaN(dataObj[key])
    );

    // 3. เก็บค่า Raw ลงใน currentSensorValues
    sensorKeys2.forEach(id => {
        currentSensorValues[id] = dataObj[id];
    });

    // 4. วนลูปอัปเดตการแสดงผลทีละเซนเซอร์
    sensorKeys2.forEach(async (id) => {
        const config = deviceConfigs[id];
        if (!config || !config.enabled) return;

        let rawVal = dataObj[id];
        let waterLevel = null;
        let displayValue = '--';

        if (config.type === 'ultrasonic') {
            const installHeight = parseFloat(config.installHeight) || 0;
            if (installHeight > 0) {
                waterLevel = Math.max(0, installHeight - rawVal);
            } else {
                waterLevel = rawVal;
            }
            displayValue = waterLevel !== null ? waterLevel.toFixed(2) : rawVal.toFixed(2);
            currentSensorValues[`${id}_water`] = waterLevel !== null ? waterLevel : rawVal;
        } else {
            displayValue = rawVal.toFixed(2);
        }

        const valEl = document.getElementById(`val_${id}`);
        if (valEl) {
            valEl.textContent = displayValue;
            valEl.style.color = '';
        }

        const diffEl = document.getElementById(`diff_${id}`);
        if (diffEl) {
            if (config.type === 'ultrasonic' && waterLevel !== null) {
                const bankHeight = parseFloat(config.bankHeight) || 0;
                const distanceToBank = bankHeight - waterLevel;
                const result = evaluateLevelWithCustom(waterLevel, config.levels);
                
                let isFlooding = distanceToBank < 0;
                let statusText = isFlooding ? 
                    `🌊 น้ำท่วม! สูงกว่าตลิ่ง ${Math.abs(distanceToBank).toFixed(2)} ซม.` :
                    `ระดับน้ำ: ${waterLevel.toFixed(2)} ซม. (อีก ${distanceToBank.toFixed(2)} ซม. ถึงตลิ่ง)`;

                diffEl.innerHTML = `
                    <div style="font-weight: bold; color: ${isFlooding ? '#f87171' : result.color};">${statusText}</div>
                    <div style="color: #94a3b8; font-size: 0.7rem;">📏 ระยะห่างเซนเซอร์ (Raw): ${rawVal.toFixed(2)} ซม.</div>
                    <div style="color: ${result.color}; font-size: 0.8rem;">📌 สถานะ: ${result.label}</div>
                `;
            }
        }

        const historyValue = (config.type === 'ultrasonic' && waterLevel !== null) ? waterLevel : rawVal;
        if (!sensorHistory.data[id]) sensorHistory.data[id] = [];
        sensorHistory.data[id].push(historyValue);
        if (sensorHistory.data[id].length > 100) sensorHistory.data[id].shift();

        const checkVal = (config.type === 'ultrasonic' && waterLevel !== null) ? waterLevel : rawVal;
        await checkAllAlertConditions(id, checkVal, config);
    });

    if (chart) updateChartStructure();
    updateSensorStatus();
    updateStatusBarBoardDetails();
}
// ============================================================
//  10.1 CHECK BOARD STATUS FROM SENSORS
// ============================================================

async function checkBoardStatusFromSensors() {
    if (!window.db) return;
    
    try {
        const snapshot = await window.get(window.ref(window.db, 'sensors'));
        if (!snapshot.exists()) return;
        
        const allData = snapshot.val();
        const now = Date.now();
        const timeout = 180000; // 3 นาที
        
        for (const [boardId, boardData] of Object.entries(allData)) {
            // ข้ามโฟลเดอร์ระบบ
            if (boardId === 'history' || boardId === 'current') continue;
            if (typeof boardData !== 'object' || boardData === null) continue;
            
            // ============================================================
            //  1. ตรวจสอบ timestamp จากบอร์ด
            // ============================================================
            const timestamp = boardData.timestamp || boardData._timestamp || null;
            let lastSeenTime = 0;
            let isRecent = false;
            
            if (timestamp) {
                lastSeenTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
                isRecent = (now - lastSeenTime) < timeout;
            }
            
            // ============================================================
            //  2. อัปเดตเฉพาะบอร์ดที่มีอยู่ในระบบแล้ว
            // ============================================================
            if (deviceConfigs[boardId]) {
                const currentConfig = deviceConfigs[boardId];
                
                // ✅ อัปเดตเฉพาะ status และ lastSeen
                // ❌ ไม่เขียนทับ name, installHeight, bankHeight, levels, weather_config
                if (isRecent) {
                    if (currentConfig.status !== 'online') {
                        // ✅ อัปเดตเฉพาะในหน่วยความจำ (UI)
                        deviceConfigs[boardId].status = 'online';
                        deviceConfigs[boardId].lastSeen = new Date(lastSeenTime).toISOString();
                        
                        // ✅ อัปเดต wifi_rssi ถ้ามี
                        if (boardData.wifi_rssi !== undefined) {
                            deviceConfigs[boardId].wifi_rssi = boardData.wifi_rssi;
                        }
                        if (boardData.rssi !== undefined) {
                            deviceConfigs[boardId].wifi_rssi = boardData.rssi;
                        }
                        
                        console.log(`✅ อัปเดตสถานะบอร์ด ${boardId} เป็น Online (ใน UI) - ไม่เขียนทับชื่อ`);
                    } else {
                        // ✅ อัปเดต lastSeen ทุกครั้งที่มีข้อมูลใหม่
                        deviceConfigs[boardId].lastSeen = new Date(lastSeenTime).toISOString();
                        if (boardData.wifi_rssi !== undefined) {
                            deviceConfigs[boardId].wifi_rssi = boardData.wifi_rssi;
                        }
                        if (boardData.rssi !== undefined) {
                            deviceConfigs[boardId].wifi_rssi = boardData.rssi;
                        }
                    }
                } else {
                    if (currentConfig.status !== 'offline') {
                        deviceConfigs[boardId].status = 'offline';
                        console.log(`⚠️ บอร์ด ${boardId} ถูกตั้งเป็น Offline (ใน UI) - ข้อมูลเก่าเกิน ${timeout/60000} นาที`);
                    }
                }
            } else {
                // ============================================================
                //  3. ถ้ายังไม่มีบอร์ดในระบบ ให้สร้างใหม่ (เฉพาะบอร์ดที่มีข้อมูล)
                // ============================================================
                if (isRecent) {
                    console.log(`📌 พบบอร์ดใหม่ ${boardId} กำลังสร้างในระบบ...`);
                    
                    // 🔥 สำคัญ: ใช้ชื่อที่ผู้ใช้ตั้งไว้ ถ้ามีอยู่แล้วใน Firebase
                    // ตรวจสอบชื่อที่มีอยู่แล้วใน Firebase ก่อน
                    let existingName = null;
                    try {
                        const nameSnap = await window.get(window.ref(window.db, `device_configs/${boardId}/name`));
                        if (nameSnap.exists()) {
                            existingName = nameSnap.val();
                        }
                    } catch (e) {
                        console.warn(`⚠️ ตรวจสอบชื่อบอร์ด ${boardId} ไม่สำเร็จ:`, e);
                    }
                    
                    // ✅ ถ้ามีชื่อใน Firebase แล้ว ใช้ชื่อนั้น (ไม่เขียนทับ)
                    // ✅ ถ้ายังไม่มี ใช้ชื่อจาก ESP32 หรือค่าเริ่มต้น
                    const boardName = existingName || boardData.name || boardData.board_name || `ESP32 Node ${boardId}`;
                    
                    // ✅ สร้างบอร์ดใหม่ด้วยชื่อที่ถูกต้อง (ไม่เขียนทับชื่อที่มีอยู่)
                    await window.set(window.ref(window.db, `device_configs/${boardId}`), {
                        name: boardName,
                        type: "board",
                        enabled: true,
                        status: "online",
                        onlineSince: new Date().toISOString(),
                        lastSeen: new Date(lastSeenTime).toISOString(),
                        wifi_rssi: boardData.wifi_rssi || boardData.rssi || 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    
                    // ✅ อัปเดตในหน่วยความจำ
                    deviceConfigs[boardId] = {
                        name: boardName,
                        type: "board",
                        enabled: true,
                        status: "online",
                        onlineSince: new Date().toISOString(),
                        lastSeen: new Date(lastSeenTime).toISOString(),
                        wifi_rssi: boardData.wifi_rssi || boardData.rssi || 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    console.log(`✅ สร้างบอร์ดใหม่ ${boardId} (ชื่อ: ${boardName}) - ${existingName ? 'ใช้ชื่อที่มีอยู่แล้ว' : 'ใช้ชื่อจาก ESP32'}`);
                }
            }
            
            // ============================================================
            //  4. ตรวจสอบ board_id ที่อยู่ในข้อมูลด้วย (เผื่อกรณี)
            // ============================================================
            if (boardData.board_id && deviceConfigs[boardData.board_id]) {
                const timestamp = boardData.timestamp || boardData._timestamp || null;
                if (timestamp) {
                    const lastSeenTime2 = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
                    const isRecent2 = (now - lastSeenTime2) < timeout;
                    
                    if (isRecent2 && deviceConfigs[boardData.board_id].status !== 'online') {
                        // ✅ อัปเดตเฉพาะในหน่วยความจำ (UI)
                        // ❌ ไม่เขียนทับ name, installHeight, bankHeight, levels
                        deviceConfigs[boardData.board_id].lastSeen = new Date(lastSeenTime2).toISOString();
                        deviceConfigs[boardData.board_id].status = 'online';
                        if (boardData.wifi_rssi !== undefined) {
                            deviceConfigs[boardData.board_id].wifi_rssi = boardData.wifi_rssi;
                        }
                        if (boardData.rssi !== undefined) {
                            deviceConfigs[boardData.board_id].wifi_rssi = boardData.rssi;
                        }
                        console.log(`✅ อัปเดตสถานะบอร์ด ${boardData.board_id} เป็น Online (จาก board_id) - ไม่เขียนทับชื่อ`);
                    }
                }
            }
        }
        
        // ============================================================
        //  5. รีเฟรช UI หลังจากอัปเดต
        // ============================================================
        if (typeof renderBoardTable === 'function') {
            renderBoardTable();
        }
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        }
        if (typeof updateSensorStatus === 'function') {
            updateSensorStatus();
        }
        
    } catch (error) {
        console.warn("⚠️ checkBoardStatusFromSensors error:", error);
    }
}
async function loadBoardNameFromFirebase(boardId) {
    if (!window.db || !boardId) return null;
    try {
        const snapshot = await window.get(window.ref(window.db, `device_configs/${boardId}/name`));
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.warn(`⚠️ loadBoardNameFromFirebase (${boardId}) error:`, error);
        return null;
    }
}

// ✅ Export ให้ global
window.loadBoardNameFromFirebase = loadBoardNameFromFirebase;
// ============================================================
//  10.2 LOAD WEATHER INFO
// ============================================================
async function loadWeatherInfo() {
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม รอ 2 วินาที แล้วลองใหม่...");
        setTimeout(loadWeatherInfo, 2000);
        return;
    }
    
    if (isWeatherLoading) {
        console.log("⏳ กำลังโหลดสภาพอากาศอยู่ ข้ามการทำงานนี้");
        return;
    }
    
    const now = Date.now();
    if (now - lastWeatherUpdate < 30000) {
        console.log("⏳ โหลดสภาพอากาศถี่เกินไป (น้อยกว่า 30 วินาที) ข้าม");
        return;
    }
    lastWeatherUpdate = now;
    
    isWeatherLoading = true;
    console.log("🌤️ loadWeatherInfo (Per-Board) เริ่มทำงาน...");
    
    try {
        if (!deviceConfigs || typeof deviceConfigs !== 'object') {
            console.warn("⚠️ deviceConfigs ยังไม่พร้อมหรือไม่ถูกต้อง");
            const container = document.getElementById('weatherCardsContainer');
            if (container) {
                container.innerHTML = `<div style="color: #94a3b8; padding: 20px; text-align: center; width: 100%;">
                    ⏳ กำลังโหลดการตั้งค่า...
                </div>`;
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
            }
            isWeatherLoading = false;
            return;
        }
        
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
                container.style.alignItems = 'center';
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
        
        if (boards.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            console.log("📭 ไม่มีบอร์ดที่ตั้งค่า weather_config");
            isWeatherLoading = false;
            return;
        }
        
        const children = container.children;
        if (children.length === 1 && children[0]?.textContent?.includes('กำลังโหลด')) {
            container.innerHTML = '';
        }
        
        if (boards.length === 1) {
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            container.style.flexDirection = 'row';
            container.style.flexWrap = 'nowrap';
            container.style.gap = '12px';
            container.style.minHeight = '100px';
        } else if (boards.length > 1) {
            container.style.display = 'flex';
            container.style.justifyContent = 'flex-start';
            container.style.alignItems = 'center';
            container.style.flexDirection = 'row';
            container.style.flexWrap = 'nowrap';
            container.style.gap = '12px';
            container.style.overflowX = 'auto';
            container.style.minHeight = '100px';
        }
        
        const existingCards = container.querySelectorAll('.weather-board-card');
        const existingCardMap = {};
        existingCards.forEach(card => {
            const boardId = card.dataset.boardId;
            if (boardId) {
                existingCardMap[boardId] = card;
            }
        });
        
        const renderedLocations = new Set();
        let loadedCount = 0;
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
                    if (existingCardMap[boardId]) {
                        updateWeatherCardContent(existingCardMap[boardId], boardId, config, weatherData);
                        console.log(`🔄 อัปเดตการ์ดสภาพอากาศ: ${boardId}`);
                    } else {
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
                    if (!existingCardMap[boardId]) {
                        renderWeatherCardError(boardId, config.name || boardId, wConfig);
                    } else {
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
        
        const activeBoardIds = new Set(boards.map(([id]) => id));
        for (const [boardId, card] of Object.entries(existingCardMap)) {
            if (!activeBoardIds.has(boardId) && card.parentNode) {
                card.remove();
                console.log(`🗑️ ลบการ์ดที่ไม่มีบอร์ด: ${boardId}`);
            }
        }
        
        console.log(`✅ โหลด/อัปเดตสภาพอากาศสำเร็จ ${loadedCount} ตำแหน่ง (จาก ${boards.length} บอร์ด)`);
        console.log(`📍 พิกัดที่ไม่ซ้ำ: ${Array.from(renderedLocations).join(', ')}`);
        
        if (container.children.length === 0) {
            container.innerHTML = `<div style="color: #94a3b8; padding: 10px; text-align: center; width: 100%;">
                📭 ไม่พบข้อมูลสภาพอากาศที่สามารถแสดงได้
            </div>`;
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
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
            container.style.alignItems = 'center';
        }
    } finally {
        isWeatherLoading = false;
        console.log("🔓 ปลดล็อก isWeatherLoading");
    }
}

// ============================================================
//  11. FIREBASE LISTENERS (UPDATED WITH BOARD CHECK)
// ============================================================
function initFirebaseListeners() {
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม รอการเชื่อมต่อ...");
        return;
    }

    console.log("🔥 เริ่มต้น Firebase Listeners...");

    const offsetRef = window.ref(window.db, ".info/serverTimeOffset");
    window.onValue(offsetRef, (snap) => {
        serverTimeOffset = snap.val() || 0;
        console.log("⏱️ Server Time Offset:", serverTimeOffset, "ms");
    });

    const configRef = window.ref(window.db, 'device_configs');
    window.onValue(configRef, (snapshot) => {
        try {
            console.log("📡 รับการเปลี่ยนแปลง device_configs...");
            if (snapshot.exists()) {
                deviceConfigs = snapshot.val();
                console.log("📋 โหลด device_configs สำเร็จ, มีข้อมูล", Object.keys(deviceConfigs).length, "รายการ");
            } else {
                deviceConfigs = {};
                console.log("📭 device_configs ว่าง");
            }
            renderSensorCards();
            updateChartStructure();
            updateStandaloneAlertPanel();
            renderBoardTable();
            renderDeviceTable();
            updateAlertHistoryDropdown();
            updateStatusBarBoardDetails();
            updateSensorStatus();
            renderSummaryTable();
            loadProfileList();
            setTimeout(function() {
                if (typeof loadWeatherInfo === 'function') {
                    loadWeatherInfo();
                }
            }, 500);
            populateBoardSelector();
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการประมวลผล device_configs:", error);
        }
    });

    // ============================================================
    //  ฟังข้อมูลที่ /sensors (root) รองรับหลายบอร์ด
    // ============================================================
    const sensorsRootRef = window.ref(window.db, 'sensors');
    window.onValue(sensorsRootRef, async (snapshot) => {
        try {
            if (!snapshot.exists()) {
                console.log("📭 ไม่มีข้อมูลเซนเซอร์ในระบบ");
                return;
            }
            
            const allData = snapshot.val();
            console.log("📡 รับข้อมูลจากทุกบอร์ด:", Object.keys(allData));
            
            // ✅ ตรวจสอบสถานะบอร์ดจาก sensors/
            await checkBoardStatusFromSensors();
            
            for (const [boardId, boardData] of Object.entries(allData)) {
                if (boardId === 'history' || boardId === 'current') {
                    continue;
                }
                
                if (boardData && typeof boardData === 'object') {
                    console.log(`📡 ข้อมูลจากบอร์ด ${boardId}:`, Object.keys(boardData));
                    boardData.board_id = boardId;
                    processNewData(boardData);
                }
            }
            
            if (allData.current) {
                console.log("📡 พบข้อมูลที่ /sensors/current (โหมดเก่า)");
                processNewData(allData.current);
            }
            
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการประมวลผล sensors/:", error);
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
            updateStatusBarBoardDetails();
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะการเชื่อมต่อ:", error);
        }
    });

    const muteRef = window.ref(window.db, 'settings/global_alert_muted');
    window.onValue(muteRef, (snapshot) => {
        try {
            globalAlertMuted = snapshot.exists() ? snapshot.val() : false;
            renderSummaryTable();
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
            loadGlobalMuteStatus();
            if (typeof loadLoggingConfig === 'function') {
                loadLoggingConfig();
            }
            if (typeof initAutoLogging === 'function') {
                initAutoLogging();
            }
            updateStandaloneAlertPanel();
            updateStatusBarBoardDetails();
            if (typeof loadWeatherInfo === 'function') {
                loadWeatherInfo();
            }
            updateSensorStatus();
            setTimeout(updateChartStructure, 500);
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการเริ่มต้นระบบ:", error);
        }
    }, 1000);
}

// ============================================================
//  12. BOARD WEATHER SETTINGS (PER-BOARD)
// ============================================================
window._currentWeatherBoardId = null;

window.openBoardWeatherSettings = function(boardId) {
    if (!boardId) {
        alert("❌ ไม่พบ ID ของบอร์ด");
        return;
    }
    if (!deviceConfigs[boardId] || deviceConfigs[boardId].type !== 'board') {
        alert(`❌ ไม่พบบอร์ด "${boardId}" ในระบบ`);
        return;
    }
    window._currentWeatherBoardId = boardId;
    const boardName = deviceConfigs[boardId].name || boardId;
    const config = deviceConfigs[boardId].weather_config || {};
    const titleEl = document.getElementById('boardWeatherTitle');
    if (titleEl) {
        titleEl.textContent = `🌤️ ตั้งค่าสภาพอากาศสำหรับบอร์ด: ${boardName}`;
    }
    const locDisplay = document.getElementById('boardCurrentWeatherLoc');
    const manageBox = document.getElementById('boardManageWeatherBox');
    if (locDisplay) {
        if (config.locationName && config.lat && config.lon) {
            locDisplay.innerHTML = `
                <span style="color:#4ade80; font-weight:bold;">${escapeHtml(config.locationName)}</span>
                <br><span style="font-size:0.7rem; color:#64748b;">(${config.lat.toFixed(4)}, ${config.lon.toFixed(4)})</span>
            `;
            if (manageBox) manageBox.style.display = 'block';
        } else {
            locDisplay.innerHTML = `<span style="color:#94a3b8;">ยังไม่ได้ตั้งค่า</span>`;
            if (manageBox) manageBox.style.display = 'none';
        }
    }
    const attachCheck = document.getElementById('boardAttachWeatherToReport');
    if (attachCheck) {
        attachCheck.checked = (config.attachToReport === true);
    }
    const fields = config.fields || { temp: true, humidity: true };
    document.querySelectorAll('.board-weather-field').forEach(el => {
        el.checked = fields[el.value] !== undefined ? fields[el.value] : true;
    });
    const modal = document.getElementById('boardWeatherModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        alert("❌ ไม่พบ Modal สำหรับตั้งค่าสภาพอากาศ กรุณาตรวจสอบไฟล์ HTML");
    }
};

window.closeBoardWeatherSettings = function() {
    const modal = document.getElementById('boardWeatherModal');
    if (modal) {
        modal.style.display = 'none';
    }
    window._currentWeatherBoardId = null;
    const searchInput = document.getElementById('boardWeatherSearchInput');
    if (searchInput) searchInput.value = '';
    const resultsDiv = document.getElementById('boardLocationResults');
    if (resultsDiv) resultsDiv.style.display = 'none';
};

window.searchBoardLocation = async function() {
    const query = document.getElementById('boardWeatherSearchInput').value.trim();
    if (!query) { 
        alert("กรุณาระบุชื่อสถานที่"); 
        return; 
    }
    const resultsDiv = document.getElementById('boardLocationResults');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = "<div style='color:#60a5fa; padding:10px;'>⏳ กำลังค้นหา...</div>";
    resultsDiv.style.display = "block";
    try {
        const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)},TH&limit=5&appid=dd879305b1074776a9c228f0b27798a3`);
        const data = await res.json();
        if (!data || data.length === 0) {
            resultsDiv.innerHTML = "<div style='color:#ef4444; padding:10px;'>❌ ไม่พบสถานที่ กรุณาลองระบุเป็นภาษาอังกฤษ</div>";
            return;
        }
        let html = '<p style="color: #60a5fa; font-size: 0.8rem; margin-bottom: 8px; padding:0 10px;">📍 กรุณาเลือกสถานที่:</p>';
        data.forEach(loc => {
            const state = loc.state ? `, ${loc.state}` : '';
            const country = loc.country ? ` (${loc.country})` : '';
            const displayName = loc.name + state + country;
            html += `<button onclick="saveBoardWeatherLocation('${displayName.replace(/'/g, "\\'")}', ${loc.lat}, ${loc.lon})" 
                    style="display:block; width:100%; text-align:left; padding:10px; margin-bottom:5px; 
                           background:#1e293b; color:#fff; border:1px solid #334155; border-radius:6px; 
                           cursor:pointer; font-size:0.85rem; transition:0.2s;"
                    onmouseover="this.style.background='#334155'"
                    onmouseout="this.style.background='#1e293b'">
                <span style="display:block; font-weight:bold;">${escapeHtml(displayName)}</span>
                <span style="font-size:0.7rem; color:#94a3b8;">พิกัด: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</span>
            </button>`;
        });
        resultsDiv.innerHTML = html;
    } catch (e) {
        console.error("❌ searchBoardLocation error:", e);
        resultsDiv.innerHTML = "<div style='color:#ef4444; padding:10px;'>❌ เกิดข้อผิดพลาดในการเชื่อมต่อ</div>";
    }
};

window.saveBoardWeatherLocation = async function(name, lat, lon) {
    const boardId = window._currentWeatherBoardId;
    if (!boardId) {
        alert("❌ ไม่พบ ID บอร์ด");
        return;
    }
    try {
        if (!deviceConfigs[boardId] || deviceConfigs[boardId].type !== 'board') {
            alert(`❌ ไม่พบบอร์ด "${boardId}" ในระบบ`);
            return;
        }
        await window.update(window.ref(window.db, `device_configs/${boardId}/weather_config`), {
            locationName: name,
            lat: lat,
            lon: lon,
            updatedAt: new Date().toISOString()
        });
        const resultsDiv = document.getElementById('boardLocationResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        const searchInput = document.getElementById('boardWeatherSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        alert(`✅ ตั้งค่าสถานที่: ${name} สำหรับบอร์ด ${boardId} เรียบร้อยแล้ว`);
        await refreshBoardWeatherDisplay(boardId);
        if (typeof loadWeatherInfo === 'function') {
            await loadWeatherInfo();
        }
        renderBoardTable();
    } catch (e) {
        console.error("❌ saveBoardWeatherLocation error:", e);
        alert("❌ บันทึกสถานที่ล้มเหลว: " + e.message);
    }
};

window.deleteBoardWeatherLocation = async function() {
    const boardId = window._currentWeatherBoardId;
    if (!boardId) {
        alert("❌ ไม่พบ ID บอร์ด");
        return;
    }
    if (!confirm(`⚠️ ต้องการลบข้อมูลสภาพอากาศของบอร์ด "${boardId}" ใช่หรือไม่?`)) return;
    try {
        await window.remove(window.ref(window.db, `device_configs/${boardId}/weather_config`));
        alert("✅ ลบข้อมูลสภาพอากาศเรียบร้อย");
        const locDisplay = document.getElementById('boardCurrentWeatherLoc');
        const manageBox = document.getElementById('boardManageWeatherBox');
        if (locDisplay) {
            locDisplay.innerHTML = `<span style="color:#94a3b8;">ยังไม่ได้ตั้งค่า</span>`;
        }
        if (manageBox) manageBox.style.display = 'none';
        if (typeof loadWeatherInfo === 'function') {
            await loadWeatherInfo();
        }
        renderBoardTable();
    } catch (e) {
        console.error("❌ deleteBoardWeatherLocation error:", e);
        alert("❌ ไม่สามารถลบข้อมูลได้: " + e.message);
    }
};

window.saveBoardWeatherSettings = async function() {
    const boardId = window._currentWeatherBoardId;
    if (!boardId) {
        alert("❌ ไม่พบ ID บอร์ด");
        return;
    }
    try {
        const isAttached = document.getElementById('boardAttachWeatherToReport').checked;
        const selectedFields = {};
        document.querySelectorAll('.board-weather-field').forEach(el => {
            selectedFields[el.value] = el.checked;
        });
        const currentConfig = deviceConfigs[boardId]?.weather_config || {};
        if (!currentConfig.lat || !currentConfig.lon) {
            alert("⚠️ กรุณาเลือกสถานที่ก่อนบันทึก");
            return;
        }
        await window.update(window.ref(window.db, `device_configs/${boardId}/weather_config`), {
            attachToReport: isAttached,
            fields: selectedFields,
            updatedAt: new Date().toISOString()
        });
        alert(`✅ บันทึกการตั้งค่าสภาพอากาศสำหรับบอร์ด ${boardId} สำเร็จ`);
        closeBoardWeatherSettings();
        if (typeof loadWeatherInfo === 'function') {
            await loadWeatherInfo();
        }
        renderBoardTable();
    } catch (e) {
        console.error("❌ saveBoardWeatherSettings error:", e);
        alert("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
};

async function refreshBoardWeatherDisplay(boardId) {
    if (!boardId) return;
    if (typeof loadWeatherInfo === 'function') {
        await loadWeatherInfo();
    }
    const modal = document.getElementById('boardWeatherModal');
    if (modal && modal.style.display === 'flex') {
        const config = deviceConfigs[boardId]?.weather_config || {};
        const locDisplay = document.getElementById('boardCurrentWeatherLoc');
        const manageBox = document.getElementById('boardManageWeatherBox');
        if (locDisplay) {
            if (config.locationName && config.lat && config.lon) {
                locDisplay.innerHTML = `
                    <span style="color:#4ade80; font-weight:bold;">${escapeHtml(config.locationName)}</span>
                    <br><span style="font-size:0.7rem; color:#64748b;">(${config.lat.toFixed(4)}, ${config.lon.toFixed(4)})</span>
                `;
                if (manageBox) manageBox.style.display = 'block';
            } else {
                locDisplay.innerHTML = `<span style="color:#94a3b8;">ยังไม่ได้ตั้งค่า</span>`;
                if (manageBox) manageBox.style.display = 'none';
            }
        }
    }
}

// ============================================================
//  13. RENDER BOARD TABLE
// ============================================================
window.renderBoardTable = function() {
    const tbody = document.getElementById('boardTableBody');
    if (!tbody) {
        console.warn("⚠️ ไม่พบ boardTableBody ใน DOM");
        return;
    }
    
    const boards = Object.entries(deviceConfigs).filter(([id, config]) => {
        return config.type === 'board' && id !== 'current' && id !== 'history';
    });

    if (boards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color:#64748b;">📭 ยังไม่มีบอร์ดที่ลงทะเบียนในระบบ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    const now = Date.now();
    const timeout = 600000; // ✅ 10 นาที

    for (const [id, config] of boards) {
        const tr = document.createElement('tr');
        const lastSeen = config.lastSeen ? new Date(config.lastSeen).getTime() : 0;
        const isOnline = (now - lastSeen) < timeout;
        const statusText = isOnline ? '🟢 ออนไลน์' : '🔴 ออฟไลน์';
        const statusColor = isOnline ? '#4ade80' : '#f87171';
        const rssi = config.wifi_rssi || 0;
        const rssiStatus = getRSSIStatusText(rssi);
        
        let sensorCount = 0;
        for (const [sId, sCfg] of Object.entries(deviceConfigs)) {
            if (sCfg.boardId === id && sCfg.type !== 'board') {
                sensorCount++;
            }
        }
        
        const hasWeather = !!(config.weather_config && config.weather_config.lat);
        const weatherBtnText = hasWeather ? '🌤️ แก้ไข' : '🌤️ ตั้งค่า';
        const weatherBtnStyle = hasWeather ? 'background:#10b981;' : 'background:#3b82f6;';
        const weatherStatusText = hasWeather ? '✅ ตั้งค่าแล้ว' : '❌ ยังไม่ได้ตั้ง';
        const weatherStatusColor = hasWeather ? '#4ade80' : '#f87171';

        tr.innerHTML = `
            <td style="padding: 12px; font-family: monospace; color: #60a5fa; font-weight: 600;">${escapeHtml(id)}</td>
            <td style="padding: 12px; color: #e2e8f0;">
                <strong id="boardNameDisplay_${id}">${escapeHtml(config.name || id)}</strong>
                <button class="btn-small" style="background:#ffa726; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; margin-left:6px; font-size:0.6rem;" 
                        onclick="editBoardName('${escapeHtml(id)}')" title="เปลี่ยนชื่อบอร์ด">
                    ✏️
                </button>
            </td>
            <td style="text-align:center; padding: 12px;">
                <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
            </td>
            <td style="text-align:center; padding: 12px;">
                <span style="color: ${rssi > -60 ? '#4ade80' : rssi > -80 ? '#fbbf24' : '#f87171'};">${rssi} dBm</span>
                <span style="font-size:0.6rem; color:#64748b; display:block;">${rssiStatus}</span>
            </td>
            <td style="text-align:center; padding: 12px;">
                <span style="color: #34d399;">📡 ${sensorCount} ตัว</span>
            </td>
            <td style="text-align:center; padding: 12px;">
                <span style="color: ${weatherStatusColor}; font-size:0.7rem;">${weatherStatusText}</span>
            </td>
            <td style="text-align:center; padding: 12px;">
                <button class="btn-small" style="${weatherBtnStyle} color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:4px;" 
                        onclick="openBoardWeatherSettings('${escapeHtml(id)}')" title="ตั้งค่าสภาพอากาศสำหรับบอร์ดนี้">
                    ${weatherBtnText}
                </button>
                <button class="btn-small" style="background:#d32f2f; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" 
                        onclick="confirmDeleteDevice('${escapeHtml(id)}')">
                    🗑️ ลบ
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    }
};
// ============================================================
//  populateBoardSelector - อัปเดตรายชื่อบอร์ดใน dropdown
//  ✅ ใช้ชื่อที่ผู้ใช้ตั้งไว้ (ไม่ใช่ ESP32 Node 01)
// ============================================================

window.populateBoardSelector = function() {
    const select = document.getElementById('devBoardId');
    if (!select) {
        console.warn("⚠️ ไม่พบ element #devBoardId");
        return;
    }
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- เลือกบอร์ดที่เชื่อมต่อ --</option>';
    
    // กรองเฉพาะบอร์ด (type === 'board')
    const boards = Object.entries(deviceConfigs).filter(([id, config]) => {
        return config.type === 'board' && id !== 'current' && id !== 'history';
    });
    
    if (boards.length === 0) {
        select.innerHTML = '<option value="">-- ยังไม่มีบอร์ดในระบบ --</option>';
        return;
    }
    
    boards.forEach(([id, config]) => {
        const option = document.createElement('option');
        option.value = id;
        // ✅ สำคัญ: ใช้ชื่อที่ผู้ใช้ตั้งไว้ (config.name)
        // ถ้าไม่มีชื่อให้ใช้ id แทน
        const displayName = config.name || id;
        option.textContent = `${displayName} (${id})`;
        select.appendChild(option);
    });
    
    // คืนค่าเดิมถ้ามี
    if (currentValue && document.querySelector(`#devBoardId option[value="${currentValue}"]`)) {
        select.value = currentValue;
    }
    
    console.log(`✅ populateBoardSelector: โหลดบอร์ด ${boards.length} รายการ`);
};

// ============================================================
//  renderDeviceTable - แสดงตารางเซนเซอร์ทั้งหมด
//  ✅ แสดงชื่อบอร์ดที่เชื่อมต่อโดยใช้ชื่อที่ผู้ใช้ตั้งไว้
// ============================================================

// ============================================================
//  RENDER DEVICE TABLE - สไตล์ Clean & Blue Contrast
//  จัดระเบียบด้วย Flexbox ให้ทุกคอลัมน์อยู่ในแนวเดียวกัน
// ============================================================

window.renderDeviceTable = function() {
    const tbody = document.getElementById('deviceTableBody');
    if (!tbody) {
        console.warn("⚠️ ไม่พบ deviceTableBody ใน DOM");
        return;
    }
    
    const devices = Object.entries(deviceConfigs).filter(([id, config]) => {
        if (config.type === 'board') return false;
        if (id === 'current' || id === 'history') return false;
        return true;
    });
    
    // ✅ กรณีไม่มีอุปกรณ์
    if (devices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="
                    text-align: center;
                    padding: 40px 20px;
                    background: #ffffff;
                    color: #94a3b8;
                    font-size: 0.95rem;
                    border-radius: 12px;
                ">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">📭</div>
                    <div style="font-weight: 500;">ยังไม่มีเซนเซอร์ในระบบ</div>
                    <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px;">กรุณาเพิ่มเซนเซอร์ผ่านปุ่ม ⚙️ จัดการอุปกรณ์</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    // ✅ สร้างแต่ละแถว
    for (const [id, config] of devices) {
        const tr = document.createElement('tr');
        tr.style.background = "#ffffff";
        tr.style.transition = "background 0.15s ease";
        
        // ✅ Hover Effect
        tr.onmouseover = function() {
            this.style.background = "#f8fafc";
        };
        tr.onmouseout = function() {
            this.style.background = "#ffffff";
        };
        
        // ✅ ชื่อบอร์ด
        let boardDisplayName = 'ไม่ระบุบอร์ด';
        if (config.boardId && deviceConfigs[config.boardId]) {
            boardDisplayName = deviceConfigs[config.boardId].name || config.boardId;
        }
        
        // ✅ ตรวจสอบว่าสร้างอัตโนมัติหรือไม่
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        const displayName = isAutoGenerated ? `เซนเซอร์ ${id}` : config.name;
        
        // ✅ สร้างข้อมูลระดับแบบย่อ
        let levelsDisplay = '-';
        if (config.levels && Array.isArray(config.levels) && config.levels.length > 0) {
            const alertLevels = config.levels.filter(l => l.alert === true);
            const alertCount = alertLevels.length;
            levelsDisplay = `${config.levels.length} ระดับ`;
            if (alertCount > 0) {
                levelsDisplay += ` ⚠️${alertCount}`;
            }
        }
        
        // ✅ ค่า Alert
        const alertThreshold = config.advancedAlert?.threshold ?? '-';
        const rateChange = config.advancedAlert?.rateChange ?? '-';
        const rateTime = config.advancedAlert?.rateTime ?? '-';
        const alertLimit = config.alertLimit ?? 3;
        const alertInterval = config.alertInterval ?? 5;
        
        // ✅ สร้าง HTML
        tr.innerHTML = `
            <!-- ID -->
            <td style="
                padding: 12px 10px;
                font-family: 'JetBrains Mono', 'SF Mono', monospace;
                color: #1e40af;
                font-size: 0.78rem;
                font-weight: 600;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${escapeHtml(id)}
            </td>
            
            <!-- ชื่อ -->
            <td style="
                padding: 12px 10px;
                color: #1e3a8a;
                font-weight: 700;
                font-size: 0.9rem;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${escapeHtml(displayName)}
            </td>
            
            <!-- ประเภท -->
            <td style="
                padding: 12px 10px;
                color: #2563eb;
                font-size: 0.85rem;
                font-weight: 600;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${escapeHtml(config.type || '-')}
            </td>
            
            <!-- หน่วย -->
            <td style="
                padding: 12px 10px;
                color: #1e40af;
                font-weight: 600;
                font-size: 0.85rem;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${escapeHtml(config.unit || '-')}
            </td>
            
            <!-- ระดับ -->
            <td style="
                padding: 12px 10px;
                color: #1e40af;
                font-size: 0.8rem;
                font-weight: 500;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${levelsDisplay}
            </td>
            
            <!-- Threshold -->
            <td style="
                padding: 12px 10px;
                text-align: center;
                color: ${alertThreshold !== '-' ? '#2563eb' : '#94a3b8'};
                font-weight: ${alertThreshold !== '-' ? '700' : '400'};
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${alertThreshold}
            </td>
            
            <!-- Rate Change -->
            <td style="
                padding: 12px 10px;
                text-align: center;
                color: ${rateChange !== '-' ? '#2563eb' : '#94a3b8'};
                font-weight: ${rateChange !== '-' ? '700' : '400'};
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${rateChange}
            </td>
            
            <!-- Rate Time -->
            <td style="
                padding: 12px 10px;
                text-align: center;
                color: ${rateTime !== '-' ? '#2563eb' : '#94a3b8'};
                font-weight: ${rateTime !== '-' ? '700' : '400'};
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${rateTime}
            </td>
            
            <!-- Alert Limit -->
            <td style="
                padding: 12px 10px;
                text-align: center;
                color: #1e40af;
                font-weight: 600;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${alertLimit}
            </td>
            
            <!-- Alert Interval -->
            <td style="
                padding: 12px 10px;
                text-align: center;
                color: #1e40af;
                font-weight: 600;
                border-bottom: 1px solid #f1f5f9;
                white-space: nowrap;
            ">
                ${alertInterval}
            </td>
            
            <!-- ✅ จัดการ - อยู่ในบรรทัดเดียวกันทั้งหมด -->
            <td style="
                padding: 10px 10px;
                border-bottom: 1px solid #f1f5f9;
                min-width: 260px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: nowrap;
                ">
                    <!-- ชื่อบอร์ด (Pill Style) -->
                    <div style="
                        background: #eff6ff;
                        color: #2563eb;
                        border: 1px solid #bfdbfe;
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-size: 0.65rem;
                        font-weight: 700;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        white-space: nowrap;
                        max-width: 120px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    " title="${escapeHtml(boardDisplayName)}">
                        <span style="font-size: 0.7rem;">🔌</span>
                        <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(boardDisplayName)}</span>
                    </div>

                    <!-- ปุ่มแก้ไข -->
                    <button onclick="handleEditClickWithThresholds('${escapeHtml(id)}')" 
                            style="
                                background: #ffffff;
                                color: #2563eb;
                                border: 1px solid #bfdbfe;
                                padding: 5px 9px;
                                border-radius: 6px;
                                cursor: pointer;
                                transition: all 0.15s ease;
                                font-size: 0.8rem;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                min-width: 30px;
                                min-height: 30px;
                            "
                            onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#60a5fa'; this.style.transform='scale(1.05)'"
                            onmouseout="this.style.background='#ffffff'; this.style.borderColor='#bfdbfe'; this.style.transform='scale(1)'"
                            title="แก้ไขเซนเซอร์">
                        <span>✏️</span>
                    </button>

                    <!-- ปุ่มคัดลอก -->
                    <button onclick="cloneDevice('${escapeHtml(id)}')" 
                            style="
                                background: #ffffff;
                                color: #10b981;
                                border: 1px solid #bbf7d0;
                                padding: 5px 9px;
                                border-radius: 6px;
                                cursor: pointer;
                                transition: all 0.15s ease;
                                font-size: 0.8rem;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                min-width: 30px;
                                min-height: 30px;
                            "
                            onmouseover="this.style.background='#ecfdf5'; this.style.borderColor='#34d399'; this.style.transform='scale(1.05)'"
                            onmouseout="this.style.background='#ffffff'; this.style.borderColor='#bbf7d0'; this.style.transform='scale(1)'"
                            title="คัดลอกเซนเซอร์">
                        <span>📋</span>
                    </button>

                    <!-- ปุ่มลบ -->
                    <button onclick="confirmDeleteDevice('${escapeHtml(id)}')" 
                            style="
                                background: #ffffff;
                                color: #ef4444;
                                border: 1px solid #fecaca;
                                padding: 5px 9px;
                                border-radius: 6px;
                                cursor: pointer;
                                transition: all 0.15s ease;
                                font-size: 0.8rem;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                min-width: 30px;
                                min-height: 30px;
                            "
                            onmouseover="this.style.background='#fef2f2'; this.style.borderColor='#f87171'; this.style.transform='scale(1.05)'"
                            onmouseout="this.style.background='#ffffff'; this.style.borderColor='#fecaca'; this.style.transform='scale(1)'"
                            title="ลบเซนเซอร์">
                        <span>🗑️</span>
                    </button>

                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }
    
    console.log(`✅ renderDeviceTable: แสดง ${devices.length} เซนเซอร์`);
};
// ✅ Export ให้ global
window.populateBoardSelector = window.populateBoardSelector;
window.renderDeviceTable = window.renderDeviceTable;
// ============================================================
//  14. UPDATE LAST SEEN
// ============================================================
async function updateDeviceLastSeen(id) {
    if (!window.db || !id) return;
    const now = Date.now();
    const THROTTLE_INTERVAL = window.__THROTTLE_INTERVAL_MS || 15000;
    if (lastUpdateTracker[id] && (now - lastUpdateTracker[id] < THROTTLE_INTERVAL)) {
        return;
    }
    try {
        const hasRealData = currentSensorValues[id] !== undefined && 
                           currentSensorValues[id] !== null && 
                           !isNaN(currentSensorValues[id]);
        const nowIso = new Date().toISOString();
        const config = deviceConfigs[id];
        const updateData = {};
        if (hasRealData) {
            updateData.lastSeen = nowIso;
            if (config && (config.status === "offline" || config.status === undefined)) {
                updateData.status = "online";
                updateData.onlineSince = nowIso;
                updateData.alert_count = 0;
                updateData.is_acknowledged = false;
                updateData.last_alert_time = null;
            } else if (config && config.status !== "offline") {
                if (!config.onlineSince) {
                    updateData.onlineSince = config.lastSeen || nowIso;
                }
            }
        } else {
            const lastSeenTime = config?.lastSeen ? new Date(config.lastSeen).getTime() : 0;
            const isStale = (now - lastSeenTime) > 600000; // ✅ 10 นาที
            if (isStale && config && config.status !== "offline") {
                updateData.status = "offline";
            } else if (!config || !config.lastSeen) {
                updateData.status = "waiting";
            }
        }
        if (Object.keys(updateData).length > 0) {
            await window.update(window.ref(window.db, `device_configs/${id}`), updateData);
            lastUpdateTracker[id] = now;
            if (deviceConfigs[id]) {
                Object.assign(deviceConfigs[id], updateData);
                renderBoardTable();
                updateStandaloneAlertPanel();
                renderSummaryTable();
                updateStatusBarBoardDetails();
            }
        }
    } catch (error) {
        console.error(`❌ อัปเดต lastSeen ของ ${id} ล้มเหลว:`, error);
    }
}

// ============================================================
//  15. UPDATE SENSOR STATUS (FIXED - BOARD STATUS DEPENDENCY)
// ============================================================

function updateSensorStatus() {
    const now = Date.now();
    const staleThreshold = 180000;
    const boardStatusMap = checkAllBoardsStatus();
    
    for (const [id, config] of Object.entries(deviceConfigs)) {
        if (config.type === 'board') continue;
        if (!config.enabled) continue;
        
        const card = document.getElementById(`card_${id}`);
        if (!card) continue;
        
        const valEl = document.getElementById(`val_${id}`);
        const timeEl = document.getElementById(`time_${id}`);
        const diffEl = document.getElementById(`diff_${id}`);
        const levelBadgeEl = document.getElementById(`levelBadge_${id}`);
        
        let isBoardOnline = false;
        let boardName = 'ไม่ระบุบอร์ด';
        let boardIdDisplay = 'N/A';
        let boardStatusInfo = { isOnline: false, durationText: "ไม่ทราบข้อมูล" };
        
        if (config.boardId && boardStatusMap[config.boardId]) {
            isBoardOnline = boardStatusMap[config.boardId].isOnline;
            boardName = boardStatusMap[config.boardId].name;
            boardIdDisplay = config.boardId;
            boardStatusInfo = boardStatusMap[config.boardId];
        } else {
            const lastSeen = config.lastSeen ? new Date(config.lastSeen).getTime() : 0;
            isBoardOnline = (now - lastSeen) < staleThreshold;
        }
        
        const boardStatusHtml = isBoardOnline 
            ? `<span style="color: #4ade80;">🟢 ออนไลน์</span>`
            : `<span style="color: #f87171;">🔴 ออฟไลน์ (${boardStatusInfo.durationText || 'ไม่ทราบเวลา'})</span>`;
        
        const hasRealData = currentSensorValues[id] !== undefined && 
                           currentSensorValues[id] !== null && 
                           !isNaN(currentSensorValues[id]);
        
        // ✅ สำคัญ: เซนเซอร์ออนไลน์ก็ต่อเมื่อบอร์ดออนไลน์และมีข้อมูล
        const isSensorOnline = isBoardOnline && hasRealData;
        
        if (isSensorOnline) {
            // ✅ บอร์ดออนไลน์และมีข้อมูล
            let displayValue = currentSensorValues[id];
            if (config.type === 'ultrasonic' && config.installHeight) {
                const raw = parseFloat(currentSensorValues[id]);
                const installHeight = parseFloat(config.installHeight);
                if (!isNaN(raw) && !isNaN(installHeight)) {
                    const waterLevel = Math.max(0, installHeight - raw);
                    displayValue = waterLevel.toFixed(2);
                }
            }
            if (valEl) {
                valEl.textContent = displayValue;
                valEl.style.color = '';
                const unitSpan = valEl.nextElementSibling;
                if (unitSpan && unitSpan.classList.contains('sensor-unit')) {
                    unitSpan.textContent = config.unit || '';
                }
            }
            
            let statusBadge = card.querySelector('.sensor-status-badge');
            if (statusBadge) {
                statusBadge.outerHTML = `
                    <div class="sensor-status-badge online" style="color: #4ade80; font-size: 0.7rem; margin-top: 4px;">
                        🟢 กำลังทำงาน
                    </div>
                `;
            }
            
            if (timeEl) {
                const nowTime = window._lastDataTime ? new Date(window._lastDataTime).toLocaleTimeString('th-TH') : new Date().toLocaleTimeString('th-TH');
                timeEl.textContent = `🟢 อัปเดต: ${nowTime}`;
                timeEl.style.color = '#0d6b2a';
            }
            
            if (levelBadgeEl) {
                const val = parseFloat(currentSensorValues[id]);
                if (!isNaN(val)) {
                    let checkVal = val;
                    if (config.type === 'ultrasonic' && config.installHeight) {
                        const raw = parseFloat(currentSensorValues[id]);
                        const installHeight = parseFloat(config.installHeight);
                        if (!isNaN(raw) && !isNaN(installHeight)) {
                            checkVal = Math.max(0, installHeight - raw);
                        }
                    }
                    const result = evaluateLevelWithCustom(checkVal, config.levels);
                    if (result && result.label !== 'ไม่ได้ตั้งค่า' && result.label !== 'ไม่มีข้อมูล') {
                        levelBadgeEl.innerHTML = `
                            <span style="background: ${result.color || '#60a5fa'}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.65rem;">
                                ${result.label}
                            </span>
                        `;
                    }
                }
            }
            
            card.classList.remove('offline-card');
            
        } else if (!isBoardOnline) {
            // ✅ บอร์ดออฟไลน์
            if (valEl) {
                valEl.textContent = '--';
                valEl.style.color = '#94a3b8';
                const unitSpan = valEl.nextElementSibling;
                if (unitSpan && unitSpan.classList.contains('sensor-unit')) {
                    unitSpan.textContent = '';
                }
            }
            
            const boardLastSeen = config.boardId && boardStatusMap[config.boardId] ? 
                boardStatusMap[config.boardId].lastSeen : config.lastSeen;
            const lastSeenTime = boardLastSeen ? new Date(boardLastSeen).getTime() : 0;
            const mins = lastSeenTime ? Math.round((Date.now() - lastSeenTime) / 60000) : 0;
            let durationText = '';
            if (mins < 60) {
                durationText = `${mins} นาที`;
            } else {
                const hours = Math.floor(mins / 60);
                const remainingMins = mins % 60;
                durationText = `${hours} ชั่วโมง ${remainingMins} นาที`;
            }
            
            let statusBadge = card.querySelector('.sensor-status-badge');
            if (statusBadge) {
                statusBadge.outerHTML = `
                    <div class="sensor-status-badge offline" style="color: #f87171; font-size: 0.7rem; margin-top: 4px; font-weight: bold;">
                        ⛔ บอร์ดออฟไลน์ (${durationText})
                    </div>
                `;
            }
            
            if (timeEl) {
                const lastSeenDisplay = boardLastSeen ? 
                    new Date(boardLastSeen).toLocaleTimeString('th-TH') : 'ไม่ทราบ';
                timeEl.textContent = `⏸️ อัปเดตล่าสุด: ${lastSeenDisplay}`;
                timeEl.style.color = '#b71c1c';
            }
            
            if (diffEl) {
                const stuckValue = hasRealData ? currentSensorValues[id] : '--';
                diffEl.innerHTML = `
                    <div style="color: #94a3b8; font-size: 0.6rem; margin-top: 2px;">
                        🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
                    </div>
                    <div style="color: #64748b; font-size: 0.6rem; margin-top: 2px;">
                        📊 ค่าล่าสุด: ${stuckValue} ${config.unit || ''} (ข้อมูลค้าง)
                    </div>
                    <div style="color: #f87171; font-size: 0.6rem; margin-top: 2px;">
                        ⛔ บอร์ดหยุดทำงาน ${durationText}
                    </div>
                `;
            }
            
            if (levelBadgeEl) {
                levelBadgeEl.innerHTML = '';
            }
            
            let existingAlertBadge = card.querySelector('.alert-badge');
            if (existingAlertBadge) {
                existingAlertBadge.remove();
            }
            
            card.classList.remove('flood-alert', 'warning-alert');
            card.classList.add('offline-card');
            
        } else {
            // ✅ บอร์ดออนไลน์แต่ยังไม่มีข้อมูล
            if (valEl) {
                valEl.textContent = '--';
                valEl.style.color = '#94a3b8';
            }
            
            let statusBadge = card.querySelector('.sensor-status-badge');
            if (statusBadge) {
                statusBadge.outerHTML = `
                    <div class="sensor-status-badge waiting" style="color: #fbbf24; font-size: 0.7rem; margin-top: 4px;">
                        ⏳ รอข้อมูล...
                    </div>
                `;
            }
            
            if (timeEl) {
                timeEl.textContent = `⏳ รอข้อมูล...`;
                timeEl.style.color = '#bf360c';
            }
            
            if (diffEl) {
                diffEl.innerHTML = `
                    <div style="color: #fbbf24; font-size: 0.6rem;">
                        ⏳ กำลังรอข้อมูล
                    </div>
                    <div style="color: #64748b; font-size: 0.55rem; margin-top: 2px;">
                        🔌 ${escapeHtml(boardName)} ${boardStatusHtml}
                    </div>
                `;
            }
        }
    }
}

// ✅ Export ให้ global
window.updateSensorStatus = updateSensorStatus;
// ============================================================
//  16. SENSOR STATUS MONITOR
// ============================================================
function startSensorStatusMonitor() {
    if (window._sensorStatusInterval) {
        clearInterval(window._sensorStatusInterval);
    }
    window._sensorStatusInterval = setInterval(() => {
        updateSensorStatus();
        if (chart) {
            updateChartStructure();
        }
    }, 15000);
    console.log("✅ เริ่มระบบตรวจสอบสถานะเซนเซอร์อัตโนมัติ (ทุก 15 วินาที)");
}

// ============================================================
//  17. DEVICE HEALTH MONITOR - FIXED TIMEOUT
// ============================================================

async function monitorDeviceHealth() {
    const now = Date.now() + serverTimeOffset;
    const timeout = 180000;
    
    const boardStatusMap = checkAllBoardsStatus();
    
    for (const [id, status] of Object.entries(boardStatusMap)) {
        const config = deviceConfigs[id];
        if (!config || config.enabled === false) continue;
        if (config.type === 'board') continue;
        
        const isOnline = status?.isOnline || false;
        const lastSeenTime = status?.lastSeen ? new Date(status.lastSeen).getTime() : 0;
        const diffMs = status?.diffMs || (now - lastSeenTime);
        const hasRealData = currentSensorValues[id] !== undefined && 
                           currentSensorValues[id] !== null && 
                           !isNaN(currentSensorValues[id]);
        
        // ❌ ไม่มีการเขียนกลับ Firebase
        // ✅ อัปเดตเฉพาะในหน่วยความจำ (UI) เท่านั้น
        if (!isOnline || !hasRealData) {
            if (config.status !== "offline") {
                const minutesOffline = Math.round(diffMs / 60000);
                console.log(`⚠️ อุปกรณ์ ${id} ขาดการติดต่อ (${minutesOffline} นาที) - อัปเดตเฉพาะ UI`);
                
                deviceConfigs[id].status = "offline";
                
                if (!config.is_acknowledged && config.alertEnabled !== false) {
                    const limit = config.alertLimit || 3;
                    const interval = (config.alertInterval || 5) * 60000;
                    await sendHealthAlert(id, config, "🚨 อุปกรณ์ออฟไลน์", limit, interval, now, "offline");
                }
            }
        } else {
            if (config.status === "offline") {
                console.log(`✅ ตรวจพบสัญญาณจาก ${id} - อัปเดตเฉพาะ UI`);
                
                deviceConfigs[id].status = "online";
                deviceConfigs[id].onlineSince = new Date().toISOString();
                deviceConfigs[id].alert_count = 0;
                deviceConfigs[id].is_acknowledged = false;
                deviceConfigs[id].last_alert_time = null;
                
                await sendHealthAlert(id, config, "✅ อุปกรณ์กลับมาออนไลน์", 1, 0, now, "online");
            }
        }
    }
    
    updateStandaloneAlertPanel();
    renderBoardTable();
    updateStatusBarBoardDetails();
}

async function sendHealthAlert(id, config, title, limit, interval, now, type) {
    const muted = await isAlertMuted();
    if (muted) return;
    const count = config.alert_count || 0;
    const lastTime = config.last_alert_time || 0;
    let body = "";
    
    if (type === "online") {
        body = `✅ <b>อุปกรณ์กลับมาออนไลน์</b>\n📛 ชื่อ: ${config.name}\n🆔 ID: ${id}`;
        const finalMsg = formatTelegramMessage(body, "ระบบตรวจสอบสุขภาพ", title);
        await sendTelegramMessage(finalMsg);
        
        deviceConfigs[id].alert_count = 0;
        deviceConfigs[id].is_acknowledged = false;
        
        updateStandaloneAlertPanel();
        renderDeviceTable();
        renderBoardTable();
        renderSummaryTable();
        updateStatusBarBoardDetails();
        return;
    }
    
    if (count < limit && (now - lastTime) >= interval) {
        body = `🚨 <b>อุปกรณ์ขาดการติดต่อ (Offline)</b>\n📛 ชื่อ: ${config.name}\n🆔 ID: ${id}\n🔢 ครั้งที่แจ้ง: ${count + 1}/${limit}`;
        const finalMsg = formatTelegramMessage(body, "ระบบตรวจสอบสุขภาพ", title);
        const success = await sendTelegramMessage(finalMsg);
        if (success) {
            deviceConfigs[id].alert_count = count + 1;
            deviceConfigs[id].last_alert_time = now;
            
            updateStandaloneAlertPanel();
            renderDeviceTable();
            renderBoardTable();
            renderSummaryTable();
            updateStatusBarBoardDetails();
        }
    }
}

function startDeviceHealthMonitor() {
    if (deviceHealthMonitorInterval) {
        clearInterval(deviceHealthMonitorInterval);
        deviceHealthMonitorInterval = null;
    }
    deviceHealthMonitorInterval = setInterval(async () => {
        try {
            const currentUser = sessionStorage.getItem('currentUser');
            if (!currentUser) return;
            await monitorDeviceHealth();
            await checkAllAlertConditionsForAllDevices();
            updateStatusBarBoardDetails();
        } catch (error) {
            console.error("❌ deviceHealthMonitor error:", error);
        }
    }, 45000);
    console.log("✅ เริ่มระบบตรวจสอบสุขภาพอุปกรณ์อัตโนมัติ (เฉพาะ UI - ไม่เขียน Firebase)");
}

// ============================================================
//  18. ALERT SYSTEM
// ============================================================
async function checkEventBasedAlert(id, value, config) {
    if (config.alertEnabled === false) return;
    if (!config.enabled) return;
    if (config.is_acknowledged === true) return;
    if (config.type === 'board') return;
    const debounceTimeMs = (config.eventDebounceTime || 2) * 60 * 1000;
    const now = Date.now();
    const currentLevel = evaluateLevelWithCustom(value, config.levels);
    if (!eventStateTracker[id]) {
        eventStateTracker[id] = { 
            lastConfirmedLevel: currentLevel.label, 
            pendingLevel: null, 
            lastChangeTime: now,
            shouldAlert: false
        };
    }
    const state = eventStateTracker[id];
    if (currentLevel.shouldAlert && state.pendingLevel !== currentLevel.label && currentLevel.label !== state.lastConfirmedLevel) {
        state.lastConfirmedLevel = currentLevel.label;
        state.pendingLevel = null;
        await sendTelegramMessage(`🚨 [แจ้งเตือน] ${config.name}\nสถานะ: ${currentLevel.label}\nค่าที่วัดได้: ${value.toFixed(2)} ${config.unit || ''}`);
        console.log(`🚨 แจ้งเตือนทันที ${id}: ${currentLevel.label}`);
        return;
    }
    if (currentLevel.label !== state.lastConfirmedLevel) {
        if (currentLevel.label === state.pendingLevel) {
            if (now - state.lastChangeTime >= debounceTimeMs) {
                state.lastConfirmedLevel = currentLevel.label;
                state.pendingLevel = null;
                state.shouldAlert = currentLevel.shouldAlert;
                await sendTelegramMessage(`✅ [สถานะปกติ] ${config.name}\nสถานะ: ${currentLevel.label}\nค่าที่วัดได้: ${value.toFixed(2)} ${config.unit || ''}`);
                console.log(`✅ ยืนยันสถานะ ${id}: ${currentLevel.label}`);
            }
        } else {
            state.pendingLevel = currentLevel.label;
            state.lastChangeTime = now;
            console.log(`⏳ ตรวจพบการเปลี่ยนสถานะของ ${id} เป็น ${currentLevel.label}, กำลังรอให้ค่านิ่ง...`);
        }
    } else {
        if (state.pendingLevel) {
            state.pendingLevel = null;
            console.log(`↩️ ${id} กลับสู่สถานะเดิม ${currentLevel.label}, ยกเลิกการรอ`);
        }
    }
}

async function checkAllAlertConditions(sensorId, value, config) {
    if (!config.enabled || config.alertEnabled === false) return;
    if (config.is_acknowledged === true) return;
    let alertMessages = [];
    let checkValue = value;
    if (config.type === 'ultrasonic' && config.installHeight) {
        if (typeof value === 'number' && value < config.installHeight) {
            checkValue = config.installHeight - value;
            if (checkValue < 0) checkValue = 0;
        }
    }
    const levelMsg = await checkLevelAlert(sensorId, checkValue, config);
    if (levelMsg) alertMessages.push(levelMsg);
    const advanced = config.advancedAlert || {};
    if (advanced.threshold !== null && checkValue >= advanced.threshold) {
        alertMessages.push(`⚠️ วิกฤต: ค่า ${checkValue.toFixed(2)} เกินเกณฑ์ (${advanced.threshold})`);
    }
    if (advanced.rateChange !== null && advanced.rateTime) {
        const history = await getHistoryFromFirebase(sensorId, advanced.rateTime);
        if (history.length > 0) {
            const oldestValue = parseFloat(history[0]);
            if (!isNaN(oldestValue)) {
                const delta = checkValue - oldestValue;
                if (delta >= advanced.rateChange) {
                    alertMessages.push(`📈 อัตราการเพิ่มสูง: เพิ่มขึ้น ${delta.toFixed(2)} ${config.unit || ''} ใน ${advanced.rateTime} นาที (เกณฑ์ ${advanced.rateChange})`);
                }
            }
        }
    }
    if (alertMessages.length > 0) {
        await sendUnifiedAlert(sensorId, config, alertMessages);
    }
}

async function checkLevelAlert(sensorId, value, config) {
    if (config.levels) {
        const result = evaluateLevelWithCustom(value, config.levels);
        if (result && result.shouldAlert) {
            return `⚠️ ระดับ ${result.label}: ค่า ${value.toFixed(2)} ${config.unit || ''}`;
        }
    }
    return null;
}

async function sendUnifiedAlert(sensorId, config, messages) {
    if (!messages || messages.length === 0) return false;
    const combinedMessage = messages.join('\n');
    const finalMessage = `🚨 [อุปกรณ์ ${config.name}]\n${combinedMessage}`;
    return await sendCombinedAlert(sensorId, config, finalMessage, 'unified');
}

async function checkAllAlertConditionsForAllDevices() {
    try {
        for (const [id, config] of Object.entries(deviceConfigs)) {
            const value = currentSensorValues[id];
            if (value === undefined || value === null || isNaN(value)) continue;
            let checkValue = value;
            if (config.type === 'ultrasonic' && config.installHeight) {
                const rawDistance = parseFloat(value);
                if (!isNaN(rawDistance)) {
                    checkValue = calculateWaterLevel(rawDistance, config.installHeight);
                }
            }
            if (checkValue !== null && !isNaN(checkValue)) {
                await checkAllAlertConditions(id, checkValue, config);
            }
        }
    } catch (error) {
        console.error('❌ checkAllAlertConditionsForAllDevices error:', error);
    }
}

async function getHistoryFromFirebase(id, minutes) {
    if (!window.db) return [];
    const now = Date.now();
    const startTime = now - (minutes * 60 * 1000);
    const historyRef = window.ref(window.db, 'sensor_history');
    try {
        const snapshot = await window.get(historyRef);
        if (!snapshot.exists()) return [];
        let history = [];
        snapshot.forEach((child) => {
            const data = child.val();
            if (data && data.values && data.values[id] !== undefined) {
                const logTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;
                if (!isNaN(logTime) && logTime >= startTime) {
                    history.push(data.values[id]);
                }
            } else if (data && data[id] !== undefined) {
                const logTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;
                if (!isNaN(logTime) && logTime >= startTime) {
                    history.push(data[id]);
                }
            }
        });
        return history;
    } catch (error) {
        console.error("❌ getHistoryFromFirebase error:", error);
        return [];
    }
}

const alertLock = {};

async function sendCombinedAlert(sensorId, config, message, alertType = 'general') {
    if (!sensorId || !message) return false;
    const muted = await isAlertMuted();
    if (muted) {
        console.log(`🔕 ระบบ Mute ทำงานอยู่: งดส่งแจ้งเตือน ${sensorId}`);
        return false;
    }
    const now = Date.now();
    const LOCK_TIME = 10 * 60 * 1000;
    if (alertLock[sensorId] && (now - alertLock[sensorId] < LOCK_TIME)) {
        console.log(`⏳ Anti-Spam: ${sensorId} ถูกล็อกไว้`);
        return false;
    }
    try {
        const configSnap = await window.get(window.ref(window.db, 'settings/telegram/config'));
        const token = configSnap.val()?.botToken;
        if (!token || token.trim() === '') {
            console.warn("⚠️ ไม่มี Bot Token");
            return false;
        }
        const subsSnap = await window.get(window.ref(window.db, 'settings/telegram/subscribers'));
        let success = false;
        if (subsSnap.exists()) {
            const subs = subsSnap.val();
            for (let subId in subs) {
                const chatId = subs[subId].chatId;
                if (chatId) {
                    const finalMessage = formatTelegramMessage(message, "ระบบแจ้งเตือนอัตโนมัติ", "🚨 แจ้งเตือนด่วน");
                    const result = await sendTelegramTextManual(token, chatId, finalMessage);
                    if (result) success = true;
                }
            }
        }
        if (success) {
            await saveAlertHistory(sensorId, {
                message: message,
                type: alertType,
                status: 'sent'
            });
            alertLock[sensorId] = now;
            await window.update(window.ref(window.db, `device_configs/${sensorId}`), {
                alert_count: (config.alert_count || 0) + 1,
                last_alert_time: now
            });
            updateStandaloneAlertPanel();
            renderAlertHistoryTable(sensorId);
            updateStatusBarBoardDetails();
            console.log(`✅ ส่งแจ้งเตือน ${sensorId} สำเร็จ (${alertType})`);
        }
        return success;
    } catch (error) {
        console.error("❌ sendCombinedAlert error:", error);
        return false;
    }
}

// ============================================================
//  19. ALERT HISTORY
// ============================================================
async function getAlertHistory(deviceId, limit = 50) {
    if (!window.db) return [];
    try {
        const historyRef = window.ref(window.db, `alert_history/${deviceId}`);
        const snapshot = await window.get(historyRef);
        if (!snapshot.exists()) return [];
        const history = [];
        snapshot.forEach((child) => {
            const data = child.val();
            if (data) {
                history.push({ id: child.key, ...data });
            }
        });
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return history.slice(0, limit);
    } catch (error) {
        console.error("❌ getAlertHistory error:", error);
        return [];
    }
}

async function saveAlertHistory(deviceId, alertData) {
    if (!window.db) return false;
    try {
        const historyRef = window.ref(window.db, `alert_history/${deviceId}`);
        await window.push(historyRef, {
            ...alertData,
            timestamp: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error("❌ saveAlertHistory error:", error);
        return false;
    }
}

async function renderAlertHistoryTable(deviceId) {
    const container = document.getElementById('alertHistoryContainer');
    if (!container) return;
    if (!deviceId) {
        container.innerHTML = `<div style="text-align:center; padding:30px 20px; color:#64748b; background: #0f172a; border-radius: 8px; border: 1px dashed #334155;"><span style="font-size:2rem; display:block; margin-bottom:10px;">📭</span>กรุณาเลือกอุปกรณ์จากรายการด้านบนเพื่อแสดงประวัติการแจ้งเตือน</div>`;
        return;
    }
    const history = await getAlertHistory(deviceId);
    if (history.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px 20px; color:#64748b; background: #0f172a; border-radius: 8px; border: 1px dashed #334155;"><span style="font-size:2rem; display:block; margin-bottom:10px;">📭</span>ยังไม่มีประวัติการแจ้งเตือนสำหรับอุปกรณ์นี้</div>`;
        return;
    }
    let html = `
        <div style="margin-bottom: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; background: #0f172a; padding: 10px 14px; border-radius: 8px; border: 1px solid #334155;">
            <button onclick="deleteSelectedAlertHistory('${deviceId}')" style="background:#d32f2f; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.8rem;">🗑️ ลบรายการที่เลือก</button>
            <button onclick="clearAllAlertHistory('${deviceId}')" style="background:#b91c1c; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.8rem;">🔥 ล้างประวัติทั้งหมด</button>
            <span style="color:#94a3b8; font-size:0.8rem; margin-left:auto;">รวม ${history.length} รายการ</span>
        </div>
        <div style="overflow-x:auto; border-radius:8px; border:1px solid #1e293b;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background: #0f172a; border-bottom: 2px solid #1e293b;">
                        <th style="text-align:center; width:40px; padding:10px 6px;"><input type="checkbox" id="selectAllAlerts" onchange="toggleSelectAllAlerts()" style="cursor:pointer; width:17px; height:17px; accent-color:#3b82f6;"></th>
                        <th style="text-align:left; padding:10px 12px; color:#94a3b8; font-weight:600; font-size:0.8rem;">⏱️ เวลา</th>
                        <th style="text-align:left; padding:10px 12px; color:#94a3b8; font-weight:600; font-size:0.8rem;">📝 ข้อความ</th>
                        <th style="text-align:center; padding:10px 12px; color:#94a3b8; font-weight:600; font-size:0.8rem;">📌 สถานะ</th>
                    </tr>
                </thead>
                <tbody>
    `;
    history.forEach(item => {
        const statusDisplay = item.status === 'sent' ? '✅ ส่งแล้ว' : '⚠️ รอดำเนินการ';
        const statusColor = item.status === 'sent' ? '#4caf50' : '#f59e0b';
        html += `
            <tr style="border-bottom: 1px solid #1e293b; transition:0.15s;">
                <td style="text-align:center; padding:8px 6px;"><input type="checkbox" class="alert-checkbox" value="${escapeHtml(item.id)}" style="cursor:pointer; width:16px; height:16px; accent-color:#3b82f6;"></td>
                <td style="padding:8px 12px; color:#94a3b8; font-size:0.8rem; white-space:nowrap;">${formatThaiDateTime(item.timestamp)}</td>
                <td style="padding:8px 12px; color:#e2e8f0; font-size:0.85rem; word-break:break-word; line-height:1.4;">${escapeHtml(item.message || 'ไม่ระบุข้อความ')}</td>
                <td style="padding:8px 12px; text-align:center;"><span style="color:${statusColor}; font-weight:bold; font-size:0.8rem; background:${statusColor}15; padding:2px 10px; border-radius:12px;">${statusDisplay}</span></td>
            </tr>
        `;
    });
    html += `</tbody></table></div><div style="margin-top:10px; color:#64748b; font-size:0.7rem;">💡 เลือกช่อง ☑ เพื่อเลือกรายการ | 📌 เลือกหลายรายการเพื่อลบพร้อมกัน | ⚠️ การลบไม่สามารถกู้คืนได้</div>`;
    container.innerHTML = html;
}

function updateAlertHistoryDropdown() {
    const select = document.getElementById('alertHistoryDeviceSelect');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
    const sensors = Object.entries(deviceConfigs).filter(([id, config]) => config.type !== 'board');
    sensors.forEach(([id, config]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${config.name || id} (${id})`;
        select.appendChild(option);
    });
    if (currentValue && document.querySelector(`#alertHistoryDeviceSelect option[value="${currentValue}"]`)) {
        select.value = currentValue;
    }
}

window.loadAlertHistory = function() {
    const select = document.getElementById('alertHistoryDeviceSelect');
    if (!select) return;
    renderAlertHistoryTable(select.value);
};

window.toggleSelectAllAlerts = function() {
    const selectAllCheckbox = document.getElementById('selectAllAlerts');
    if (!selectAllCheckbox) return;
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = document.querySelectorAll('.alert-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
};

window.deleteSelectedAlertHistory = async function(deviceId) {
    if (!deviceId) { alert("❌ ไม่พบ ID อุปกรณ์"); return; }
    const selectedCheckboxes = document.querySelectorAll('.alert-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    if (selectedIds.length === 0) {
        alert("⚠️ กรุณาเลือกรายการที่ต้องการลบอย่างน้อย 1 รายการ");
        return;
    }
    if (!confirm(`⚠️ ยืนยันการลบประวัติที่เลือก ${selectedIds.length} รายการ?`)) return;
    try {
        let successCount = 0;
        let failCount = 0;
        const container = document.getElementById('alertHistoryContainer');
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:30px; color:#60a5fa;">⏳ กำลังลบข้อมูล ${selectedIds.length} รายการ...</div>`;
        }
        for (const historyId of selectedIds) {
            try {
                await window.remove(window.ref(window.db, `alert_history/${deviceId}/${historyId}`));
                successCount++;
            } catch (err) {
                failCount++;
                console.error(`❌ ลบรายการ ${historyId} ล้มเหลว:`, err);
            }
        }
        if (failCount === 0) {
            alert(`✅ ลบประวัติ ${successCount} รายการสำเร็จ`);
        } else {
            alert(`⚠️ ลบสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`);
        }
        await renderAlertHistoryTable(deviceId);
        const selectAll = document.getElementById('selectAllAlerts');
        if (selectAll) selectAll.checked = false;
    } catch (error) {
        console.error("❌ deleteSelectedAlertHistory error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    }
};

window.clearAllAlertHistory = async function(deviceId) {
    if (!deviceId) { alert("❌ ไม่พบ ID อุปกรณ์"); return; }
    const history = await getAlertHistory(deviceId);
    if (history.length === 0) {
        alert("📭 ไม่มีประวัติการแจ้งเตือนสำหรับอุปกรณ์นี้");
        return;
    }
    if (!confirm(`⚠️ ยืนยันการลบประวัติทั้งหมด ${history.length} รายการของอุปกรณ์นี้?`)) return;
    const container = document.getElementById('alertHistoryContainer');
    if (container) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#f87171;">⏳ กำลังล้างประวัติทั้งหมด ${history.length} รายการ...</div>`;
    }
    try {
        await window.remove(window.ref(window.db, `alert_history/${deviceId}`));
        alert(`✅ ล้างประวัติทั้งหมด ${history.length} รายการสำเร็จ`);
        await renderAlertHistoryTable(deviceId);
    } catch (error) {
        console.error("❌ clearAllAlertHistory error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
        await renderAlertHistoryTable(deviceId);
    }
};

// ============================================================
//  20. STANDALONE ALERT PANEL
// ============================================================
function updateStandaloneAlertPanel() {
    const panel = document.getElementById('standaloneAlertPanel');
    const container = document.getElementById('alertListContainer');
    if (!panel || !container) return;
    let alerts = Object.entries(deviceConfigs).filter(([id, cfg]) => {
        if (cfg.type === 'board') return false;
        if (cfg.alert_count <= 0) return false;
        if (cfg.is_acknowledged === true) return false;
        if (cfg.enabled !== true) return false;
        if (cfg.alertEnabled === false) return false;
        const isAutoGenerated = !cfg.name || 
                               cfg.name === `เซนเซอร์ (${id})` || 
                               cfg.name === '' ||
                               cfg.name === id;
        return !isAutoGenerated;
    });
    if (alerts.length > 0) {
        panel.style.display = 'block';
        container.innerHTML = '';
        alerts.forEach(([id, cfg]) => {
            const btn = document.createElement('button');
            const alertCount = cfg.alert_count || 0;
            btn.innerHTML = `✅ รับทราบ: ${cfg.name || id} (แจ้งเตือน ${alertCount} ครั้ง)`;
            btn.style.cssText = `
                background: #b91c1c; 
                color: white; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 8px; 
                cursor: pointer; 
                font-weight: bold; 
                transition: 0.3s; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                margin: 4px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            `;
            btn.onmouseover = function() { 
                this.style.transform = 'scale(1.05)'; 
                this.style.background = '#7f1d1d';
            };
            btn.onmouseout = function() { 
                this.style.transform = 'scale(1)'; 
                this.style.background = '#b91c1c';
            };
            btn.onclick = () => window.acknowledgeAlert(id);
            container.appendChild(btn);
        });
        if (alerts.length > 1) {
            const dismissAllBtn = document.createElement('button');
            dismissAllBtn.innerHTML = `✅ รับทราบทั้งหมด (${alerts.length} รายการ)`;
            dismissAllBtn.style.cssText = `
                background: #1e293b; 
                color: #e2e8f0; 
                border: 1px solid #475569; 
                padding: 12px 20px; 
                border-radius: 8px; 
                cursor: pointer; 
                font-weight: bold; 
                transition: 0.3s;
                margin: 4px;
            `;
            dismissAllBtn.onmouseover = function() { 
                this.style.background = '#334155'; 
            };
            dismissAllBtn.onmouseout = function() { 
                this.style.background = '#1e293b'; 
            };
            dismissAllBtn.onclick = async () => {
                if (!confirm(`⚠️ ยืนยันรับทราบการแจ้งเตือนทั้งหมด ${alerts.length} รายการ?`)) return;
                for (const [id] of alerts) {
                    try {
                        await window.update(window.ref(window.db, `device_configs/${id}`), {
                            is_acknowledged: true,
                            alert_count: 0,
                            last_alert_time: null
                        });
                    } catch (e) {
                        console.error(`❌ รับทราบ ${id} ล้มเหลว:`, e);
                    }
                }
                updateStandaloneAlertPanel();
                renderDeviceTable();
                renderBoardTable();
                renderSummaryTable();
                updateStatusBarBoardDetails();
                alert(`✅ รับทราบการแจ้งเตือนทั้งหมด ${alerts.length} รายการเรียบร้อย`);
            };
            container.appendChild(dismissAllBtn);
        }
        const countBadge = document.createElement('div');
        countBadge.style.cssText = `
            background: #ef4444;
            color: white;
            border-radius: 50%;
            padding: 2px 10px;
            font-size: 0.8rem;
            font-weight: bold;
            display: inline-block;
            margin-left: 10px;
        `;
        countBadge.textContent = alerts.length;
        const titleEl = panel.querySelector('h3');
        if (titleEl) {
            const existingBadge = titleEl.querySelector('.alert-count-badge');
            if (existingBadge) existingBadge.remove();
            titleEl.appendChild(countBadge);
        }
    } else {
        panel.style.display = 'none';
    }
}

// ============================================================
//  21. GLOBAL MUTE
// ============================================================
async function isAlertMuted() {
    if (!window.db) return false;
    try {
        const snap = await window.get(window.ref(window.db, 'settings/global_alert_muted'));
        return snap.exists() ? snap.val() : false;
    } catch (error) {
        console.warn("⚠️ ตรวจสอบสถานะ Mute ไม่สำเร็จ:", error);
        return false;
    }
}

window.toggleGlobalMute = async function(isMuted) {
    try {
        await window.set(window.ref(window.db, 'settings/global_alert_muted'), isMuted);
        globalAlertMuted = isMuted;
        renderSummaryTable();
        const checkbox = document.getElementById('globalAlertMute');
        if (checkbox) checkbox.checked = isMuted;
        const statusText = document.getElementById('globalMuteStatus');
        if (statusText) {
            statusText.textContent = isMuted ? '🔕 ปิดการแจ้งเตือนอยู่' : '🔔 แจ้งเตือนปกติ';
            statusText.style.color = isMuted ? '#ef4444' : '#10b981';
        }
        console.log(`🔕 ระบบ Mute: ${isMuted ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`);
    } catch (e) {
        console.error("❌ ไม่สามารถเปลี่ยนสถานะ Mute ได้:", e);
        alert("❌ ไม่สามารถเปลี่ยนสถานะได้: " + e.message);
    }
};

async function loadGlobalMuteStatus() {
    if (!window.db) return;
    try {
        const snap = await window.get(window.ref(window.db, 'settings/global_alert_muted'));
        globalAlertMuted = snap.exists() ? snap.val() : false;
        const checkbox = document.getElementById('globalAlertMute');
        if (checkbox) checkbox.checked = globalAlertMuted;
        const statusText = document.getElementById('globalMuteStatus');
        if (statusText) {
            statusText.textContent = globalAlertMuted ? '🔕 ปิดการแจ้งเตือนอยู่' : '🔔 แจ้งเตือนปกติ';
            statusText.style.color = globalAlertMuted ? '#ef4444' : '#10b981';
        }
        renderSummaryTable();
    } catch (error) {
        console.warn("⚠️ โหลดสถานะ Mute ไม่สำเร็จ:", error);
    }
}

// ============================================================
//  22. GLOBAL ALERT SETTINGS
// ============================================================
window.openGlobalAlertSettings = async function() {
    const modal = document.getElementById('globalAlertModal');
    if (!modal) {
        alert("กรุณาเพิ่ม Modal สำหรับตั้งค่าการแจ้งเตือนในไฟล์ HTML");
        return;
    }
    modal.style.display = 'flex';
    await loadGlobalMuteStatus();
    await loadGlobalAlertDefaults();
    renderGlobalAlertDeviceList();
};

window.closeGlobalAlertSettings = function() {
    const modal = document.getElementById('globalAlertModal');
    if (modal) modal.style.display = 'none';
    const resultDiv = document.getElementById('globalAlertResult');
    if (resultDiv) {
        resultDiv.style.display = 'none';
        resultDiv.textContent = '';
    }
};

async function loadGlobalAlertDefaults() {
    if (!window.db) return;
    try {
        const snap = await window.get(window.ref(window.db, 'settings/global_alert_defaults'));
        const limitInput = document.getElementById('globalAlertLimit');
        const intervalInput = document.getElementById('globalAlertInterval');
        if (snap.exists()) {
            const config = snap.val();
            if (limitInput) limitInput.value = config.limit || 3;
            if (intervalInput) intervalInput.value = config.interval || 5;
        } else {
            if (limitInput) limitInput.value = 3;
            if (intervalInput) intervalInput.value = 5;
        }
    } catch (error) {
        console.warn("⚠️ โหลดค่าเริ่มต้น Global Alert ไม่สำเร็จ:", error);
    }
}

// ============================================================
//  RENDER GLOBAL ALERT DEVICE LIST - สไตล์ Clean & Blue Contrast
// ============================================================

function renderGlobalAlertDeviceList() {
    const container = document.getElementById('globalAlertDeviceList');
    if (!container) {
        console.warn("⚠️ ไม่พบ element #globalAlertDeviceList");
        return;
    }

    const devices = Object.entries(deviceConfigs)
        .filter(([id, config]) => config.type !== 'board' && config.enabled !== false);

    // ✅ กรณีไม่มีอุปกรณ์
    if (devices.length === 0) {
        container.innerHTML = `
            <div style="
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 24px 20px;
                text-align: center;
            ">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">📭</div>
                <div style="color: #64748b; font-size: 0.95rem; font-weight: 500;">ยังไม่มีอุปกรณ์ที่เปิดใช้งานในระบบ</div>
                <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 4px;">กรุณาเพิ่มเซนเซอร์หรือเปิดใช้งานอุปกรณ์ก่อน</div>
            </div>
        `;
        return;
    }

    // ✅ ไอคอนแมป
    const iconMap = { 
        ultrasonic: '📡', 
        soil: '🌱', 
        rain: '🌧️', 
        ph: '🧪', 
        temp: '🌡️' 
    };

    // ✅ สร้าง HTML
    let html = `
        <div style="
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 20px 22px 18px 22px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        "
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'"
        >
            <!-- หัวข้อ -->
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 2px solid #eff6ff;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="
                        background: #eff6ff;
                        color: #2563eb;
                        padding: 4px 10px;
                        border-radius: 8px;
                        font-size: 1.1rem;
                    ">📋</span>
                    <span style="
                        color: #1e40af;
                        font-size: 0.95rem;
                        font-weight: 800;
                        letter-spacing: 0.3px;
                    ">รายการอุปกรณ์ที่ได้รับผล</span>
                    <span style="
                        background: #2563eb;
                        color: #ffffff;
                        font-size: 0.7rem;
                        font-weight: 700;
                        padding: 2px 12px;
                        border-radius: 20px;
                        margin-left: 4px;
                    ">${devices.length}</span>
                </div>
                <span style="
                    color: #94a3b8;
                    font-size: 0.65rem;
                    font-weight: 500;
                ">ทั้งหมด ${devices.length} รายการ</span>
            </div>

            <!-- รายการอุปกรณ์แบบ Pills -->
            <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 16px;
                min-height: 40px;
            ">
    `;

    // ✅ สร้าง Pills แต่ละอุปกรณ์
    devices.forEach(([id, config], index) => {
        const icon = iconMap[config.type] || '🔍';
        const displayName = config.name || id;
        
        // สลับสีพื้นหลังเล็กน้อยเพื่อความหลากหลาย
        const bgColors = ['#eff6ff', '#f0f9ff', '#f5f3ff', '#ecfdf5', '#fff7ed'];
        const borderColors = ['#bfdbfe', '#bae6fd', '#c4b5fd', '#a7f3d0', '#fed7aa'];
        const textColors = ['#2563eb', '#0284c7', '#7c3aed', '#059669', '#d97706'];
        
        const colorIndex = index % bgColors.length;
        
        html += `
            <div style="
                background: ${bgColors[colorIndex]};
                color: ${textColors[colorIndex]};
                border: 1px solid ${borderColors[colorIndex]};
                padding: 6px 14px 6px 12px;
                border-radius: 50px;
                font-size: 0.8rem;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
                transition: all 0.15s ease;
                cursor: default;
            "
            onmouseover="
                this.style.background='${textColors[colorIndex]}';
                this.style.color='#ffffff';
                this.style.transform='translateY(-2px)';
                this.style.boxShadow='0 4px 12px ${textColors[colorIndex]}33';
                this.style.borderColor='${textColors[colorIndex]}';
            "
            onmouseout="
                this.style.background='${bgColors[colorIndex]}';
                this.style.color='${textColors[colorIndex]}';
                this.style.transform='translateY(0)';
                this.style.boxShadow='0 1px 2px rgba(0,0,0,0.03)';
                this.style.borderColor='${borderColors[colorIndex]}';
            ">
                <span style="font-size: 0.9rem;">${icon}</span>
                <span>${escapeHtml(displayName)}</span>
                <span style="
                    font-size: 0.55rem;
                    opacity: 0.6;
                    font-weight: 400;
                ">${id.length > 12 ? id.substring(0, 10) + '…' : id}</span>
            </div>
        `;
    });

    html += `
            </div>

            <!-- ส่วนสรุปท้าย -->
            <div style="
                background: #f8fafc;
                border-radius: 10px;
                padding: 12px 16px;
                border: 1px solid #f1f5f9;
            ">
                <div style="
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="
                            color: #1e40af;
                            font-weight: 700;
                            font-size: 0.85rem;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        ">
                            <span style="color: #3b82f6;">📊</span>
                            สรุป
                        </span>
                        <span style="
                            color: #475569;
                            font-size: 0.78rem;
                        ">
                            <span style="font-weight: 700; color: #2563eb;">${devices.length}</span> อุปกรณ์
                            <span style="color: #94a3b8; margin: 0 4px;">·</span>
                            <span style="font-weight: 700; color: #2563eb;">${Object.keys(iconMap).filter(k => devices.some(([_, c]) => c.type === k)).length}</span> ประเภท
                        </span>
                    </div>
                    <div style="
                        color: #64748b;
                        font-size: 0.72rem;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    ">
                        <span style="
                            background: #eff6ff;
                            color: #3b82f6;
                            padding: 2px 10px;
                            border-radius: 12px;
                            font-size: 0.7rem;
                            font-weight: 600;
                        ">ℹ️</span>
                        <span>การเปลี่ยนแปลงจะมีผลกับทุกอุปกรณ์ทันที</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
// ============================================================
//  23. SUMMARY TABLE
// ============================================================
function renderSummaryTable() {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    const sensors = Object.entries(deviceConfigs).filter(([id, config]) => {
        if (config.type === 'board') return false;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        return !isAutoGenerated;
    });
    if (sensors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">📭 ยังไม่มีอุปกรณ์ที่กำหนดค่า</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    sensors.forEach(([id, config]) => {
        const isEnabled = config.enabled !== false;
        const isAlertEnabled = config.alertEnabled !== false;
        let alertStatusText = "";
        let alertStatusColor = "";
        if (globalAlertMuted) {
            alertStatusText = "🔕 ปิด (ระบบส่วนกลาง)";
            alertStatusColor = "#f87171";
        } else {
            alertStatusText = isAlertEnabled ? "🔊 เปิดปกติ" : "🔇 ปิดเฉพาะจุด";
            alertStatusColor = isAlertEnabled ? "#4caf50" : "#ef4444";
        }
        const tr = document.createElement('tr');
        const iconMap = { ultrasonic: '📡', soil: '🌱', rain: '🌧️', ph: '🧪', temp: '🌡️' };
        const icon = iconMap[config.type] || '🔍';
        let ultrasonicInfo = '';
        if (config.type === 'ultrasonic' && (config.installHeight || config.bankHeight)) {
            ultrasonicInfo = `<div style="font-size:0.6rem; color:#60a5fa;">📏 ติดตั้ง: ${config.installHeight || '-'} cm | ตลิ่ง: ${config.bankHeight || '-'} cm</div>`;
        }
        let modeInfo = '';
        if (config.sensorMode) {
            const modeLabel = config.sensorMode === 'vertical' ? '📏 แนวตั้ง' : '📐 แนวนอน';
            modeInfo = `<div style="font-size:0.6rem; color:#fbbf24;">${modeLabel}</div>`;
        }
        tr.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid #334155; color: #e2e8f0; font-weight: 500;">${icon} ${escapeHtml(config.name)}${ultrasonicInfo}${modeInfo}</td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; text-align: center; color: #94a3b8; font-size: 0.85rem;">${config.type}</td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; text-align: center;"><span style="color: ${isEnabled ? '#4caf50' : '#ef4444'}; font-weight: bold;">${isEnabled ? '✅ พร้อมทำงาน' : '❌ ไม่พร้อม'}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; text-align: center;"><span style="font-weight: bold; color: ${alertStatusColor};">${alertStatusText}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; text-align: center; display: flex; gap: 5px; justify-content: center;">
                <button class="toggle-alert-btn ${isEnabled ? 'active' : ''}" style="background: ${isEnabled ? '#4caf50' : '#64748b'}" onclick="toggleDevice('${id}', ${isEnabled})">${isEnabled ? '⏸️ ปิด' : '▶️ เปิด'}</button>
                <button class="toggle-alert-btn ${isAlertEnabled && !globalAlertMuted ? 'active' : ''}" ${globalAlertMuted ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="toggleAlertEnabled('${id}')">${isAlertEnabled ? '🔔 ปิดแจ้งเตือน' : '🔕 เปิดแจ้งเตือน'}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
//  24. ANALYTICAL SUMMARY
// ============================================================
window.setAnalyticsPreset = function(preset) {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    switch (preset) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'yesterday':
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            break;
        case '24h':
            start.setHours(now.getHours() - 24);
            end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            break;
        case '3d':
            start.setDate(now.getDate() - 3);
            start.setHours(0, 0, 0, 0);
            break;
        case '7d':
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        case 'custom':
            const days = parseInt(document.getElementById('customBacktrackDays').value) || 1;
            start.setDate(now.getDate() - days);
            start.setHours(now.getHours(), now.getMinutes(), 0, 0);
            break;
        default:
            return;
    }
    const format = (date) => {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().slice(0, 16);
    };
    const startInput = document.getElementById('summaryStart');
    const endInput = document.getElementById('summaryEnd');
    if (startInput) startInput.value = format(start);
    if (endInput) endInput.value = format(end);
    checkLoggingLimit(start);
    window.runSummaryQuery();
};

async function checkLoggingLimit(selectedStartDate) {
    if (!window.db) return;
    try {
        const snap = await window.get(window.ref(window.db, 'settings/logging_config'));
        const hint = document.getElementById('dataLimitHint');
        if (snap.exists() && hint) {
            const config = snap.val();
            let maxDays = 1;
            if (config.type === 'day') maxDays = config.val;
            else if (config.type === 'hour') maxDays = Math.ceil(config.val / 24);
            else if (config.type === 'minute') maxDays = Math.ceil(config.val / (24 * 60));
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - maxDays);
            if (selectedStartDate < limitDate) {
                hint.style.display = 'inline';
                hint.title = `ระบบตั้งค่าเก็บข้อมูลย้อนหลังไว้ประมาณ ${maxDays} วัน`;
            } else {
                hint.style.display = 'none';
            }
        }
    } catch (e) { 
        console.warn("⚠️ checkLoggingLimit:", e); 
    }
}

window.exportSummaryToCSV = function() {
    const rows = document.querySelectorAll('#summaryTableBody tr');
    if (rows.length === 0 || (rows.length === 1 && rows[0].textContent.includes('📭'))) {
        alert("ไม่มีข้อมูลให้ดาวน์โหลด");
        return;
    }
    let csv = "\ufeff";
    csv += "ช่วงเวลา,อุปกรณ์,ค่าเริ่มต้น,ค่าสุดท้าย,การเปลี่ยนแปลง,สถานะ\n";
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length === 5) {
            const period = cols[0].textContent.trim();
            const name = cols[1].textContent.trim();
            const valuesText = cols[2].textContent.trim();
            const change = cols[3].textContent.trim();
            const status = cols[4].textContent.trim();
            let startVal = '';
            let endVal = '';
            const parts = valuesText.split('➔');
            if (parts.length === 2) {
                startVal = parts[0].trim();
                endVal = parts[1].trim();
                if (endVal.includes('(min:')) {
                    endVal = endVal.split('(min:')[0].trim();
                }
            } else {
                startVal = valuesText;
                endVal = valuesText;
            }
            csv += `"${period}","${name}","${startVal}","${endVal}","${change}","${status}"\n`;
        }
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Summary_Report_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

window.setDefaultSummaryTimeRange = function() {
    window.setAnalyticsPreset('24h');
};

// ============================================================
//  25. TEMPLATES
// ============================================================
function renderTemplateSelector() {
    const container = document.getElementById('templateSelectorContainer');
    if (!container) return;
    let html = `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;"><span style="color: #94a3b8; font-size: 0.75rem; display: flex; align-items: center;">📋 โหลดเทมเพลต:</span>`;
    for (const [key, template] of Object.entries(SENSOR_TEMPLATES)) {
        html += `<button type="button" onclick="loadSensorTemplate('${key}')" style="background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; hover:background:#334155;">${template.label}</button>`;
    }
    html += `<button type="button" onclick="resetLevelConfigInline()" style="background: #ef4444; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">🔄 รีเซ็ต</button></div>`;
    container.innerHTML = html;
}

function initTemplateSelector() {
    const levelConfigContainer = document.getElementById('levelConfigInlineContainer');
    if (levelConfigContainer) {
        const parent = levelConfigContainer.parentElement;
        if (parent) {
            let templateContainer = document.getElementById('templateSelectorContainer');
            if (!templateContainer) {
                templateContainer = document.createElement('div');
                templateContainer.id = 'templateSelectorContainer';
                templateContainer.style.cssText = 'margin-bottom: 8px;';
                parent.insertBefore(templateContainer, levelConfigContainer);
            }
            renderTemplateSelector();
        }
    }
}

window.loadSensorTemplate = function(templateKey) {
    if (!templateKey || !SENSOR_TEMPLATES[templateKey]) {
        alert('⚠️ ไม่พบเทมเพลตสำหรับชนิดนี้');
        return;
    }
    const template = SENSOR_TEMPLATES[templateKey];
    const levels = template.levels;
    const levelsArray = [];
    for (const key of LEVEL_KEYS) {
        if (levels[key]) {
            levelsArray.push({
                label: levels[key].label || key,
                min: levels[key].min || 0,
                max: levels[key].max || 100,
                color: LEVEL_COLORS[key] || '#3b82f6',
                alert: (key === 'very_high' || key === 'high')
            });
        }
    }
    if (levelsArray.length > 0) {
        loadDynamicLevelsFromArray(levelsArray);
    }
    const modeSelect = document.getElementById('levelModeSelect');
    if (modeSelect) {
        modeSelect.value = 'manual';
        if (typeof toggleLevelMode === 'function') toggleLevelMode();
    }
    console.log(`✅ โหลดเทมเพลต ${template.label} สำเร็จ`);
};

window.autoGenerateLevels = function() {
    const minInput = document.getElementById('autoMin');
    const maxInput = document.getElementById('autoMax');
    if (!minInput || !maxInput) {
        console.warn("⚠️ ไม่พบฟิลด์ autoMin หรือ autoMax");
        return;
    }
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    if (isNaN(min) || isNaN(max)) {
        alert('⚠️ กรุณากรอกค่าต่ำสุดและสูงสุดให้ถูกต้อง');
        return;
    }
    if (max <= min) {
        alert('⚠️ ค่าสูงสุดต้องมากกว่าค่าต่ำสุด');
        return;
    }
    const step = (max - min) / 5;
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const levels = [
        { label: 'น้อยที่สุด', min: min, max: min + step - 0.01, color: colors[0], alert: false },
        { label: 'น้อย', min: min + step, max: min + step * 2 - 0.01, color: colors[1], alert: false },
        { label: 'ปานกลาง', min: min + step * 2, max: min + step * 3 - 0.01, color: colors[2], alert: false },
        { label: 'มาก', min: min + step * 3, max: min + step * 4 - 0.01, color: colors[3], alert: true },
        { label: 'มากที่สุด', min: min + step * 4, max: max, color: colors[4], alert: true }
    ];
    loadDynamicLevelsFromArray(levels);
    console.log(`✅ สร้างระดับอัตโนมัติจาก ${min} ถึง ${max}`);
};

window.applyRiverLevels = function() {
    const minInput = document.getElementById('riverMin');
    const normalInput = document.getElementById('riverNormal');
    const warningInput = document.getElementById('riverWarning');
    const criticalInput = document.getElementById('riverCritical');
    if (!minInput || !normalInput || !warningInput || !criticalInput) {
        console.warn("⚠️ ไม่พบฟิลด์ River Mode");
        return;
    }
    const min = parseFloat(minInput.value);
    const normal = parseFloat(normalInput.value);
    const warning = parseFloat(warningInput.value);
    const critical = parseFloat(criticalInput.value);
    if (isNaN(min) || isNaN(normal) || isNaN(warning) || isNaN(critical)) {
        alert('⚠️ กรุณากรอกค่าทุกช่องให้ถูกต้อง');
        return;
    }
    if (min >= normal || normal >= warning || warning >= critical) {
        alert('⚠️ ค่าต้องเรียงจากน้อยไปมาก: Min < Normal < Warning < Critical');
        return;
    }
    const levels = [
        { label: 'น้ำน้อยมาก', min: 0, max: min, color: '#6366f1', alert: false },
        { label: 'น้ำน้อย', min: min + 0.01, max: normal, color: '#3b82f6', alert: false },
        { label: 'ปกติ', min: normal + 0.01, max: warning, color: '#10b981', alert: false },
        { label: 'เตือนภัย', min: warning + 0.01, max: critical, color: '#f59e0b', alert: true },
        { label: 'วิกฤต', min: critical + 0.01, max: 9999, color: '#ef4444', alert: true }
    ];
    loadDynamicLevelsFromArray(levels);
    console.log(`✅ ตั้งค่าระดับ River Mode: Min=${min}, Normal=${normal}, Warning=${warning}, Critical=${critical}`);
};

// ============================================================
//  26. SENSOR PROFILES
// ============================================================
window.saveNewProfile = async function() {
    const name = document.getElementById('profileName').value.trim();
    const type = document.getElementById('profileType').value;
    const count = parseInt(document.getElementById('profileLevelCount').value);
    if (!name || isNaN(count)) {
        alert("⚠️ กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    let labels = ["ระดับ 1", "ระดับ 2", "ระดับ 3", "ระดับ 4", "ระดับ 5"];
    if (type === 'ultrasonic') labels = ["วิกฤตต่ำ", "น้ำน้อย", "ปกติ", "น้ำสูง", "น้ำท่วม/เต็ม"];
    if (type === 'soil') labels = ["แห้งมาก", "แห้ง", "พอดี", "ชื้น", "แฉะ/น้ำขัง"];
    if (type === 'temp') labels = ["หนาวจัด", "หนาว", "ปกติ", "ร้อน", "ร้อนจัด"];
    const levels = [];
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    for(let i=0; i < count; i++) {
        levels.push({ 
            label: labels[i] || `ระดับที่ ${i+1}`, 
            min: i * 20, 
            max: (i + 1) * 20, 
            color: colors[i % colors.length], 
            alert: (i >= count - 2)
        });
    }
    try {
        await window.push(window.ref(window.db, 'sensor_profiles'), {
            name: name,
            type: type,
            levels: levels,
            createdAt: new Date().toISOString()
        });
        alert("✅ บันทึกโปรไฟล์สำเร็จ!");
        loadProfileList();
        document.getElementById('profileName').value = '';
    } catch (e) {
        alert("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
};

window.loadProfileList = async function() {
    if (!window.db) return;
    try {
        const snap = await window.get(window.ref(window.db, 'sensor_profiles'));
        const container = document.getElementById('profileList');
        const selector = document.getElementById('profileSelector');
        if (!container || !selector) return;
        container.innerHTML = '';
        selector.innerHTML = '<option value="">-- เลือกจากโปรไฟล์ลักษณะงานที่คุณสร้างไว้ --</option>';
        if(snap.exists()) {
            const profiles = snap.val();
            Object.entries(profiles).forEach(([key, p]) => {
                const levelsJson = JSON.stringify(p.levels).replace(/"/g, '&quot;');
                container.innerHTML += `
                    <div style="padding:10px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
                        <div style="color: #e2e8f0; font-size: 0.85rem;">
                            <b>${escapeHtml(p.name)}</b> <span style="color:#64748b;">(${p.type})</span>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-small" style="background:#3b82f6;" onclick="applyProfileToForm('${levelsJson}', '${p.type}')">ใช้</button>
                            <button class="btn-small" style="background:#ef4444;" onclick="deleteProfile('${key}')">🗑️</button>
                        </div>
                    </div>`;
                const opt = document.createElement('option');
                opt.value = JSON.stringify(p.levels);
                opt.setAttribute('data-type', p.type);
                opt.textContent = `${p.name} (${p.type})`;
                selector.appendChild(opt);
            });
        } else {
            container.innerHTML = '<div style="color:#64748b; font-size:0.8rem; text-align:center;">ยังไม่มีโปรไฟล์ที่บันทึกไว้</div>';
        }
    } catch (e) {
        console.warn("⚠️ loadProfileList error:", e);
    }
};

window.deleteProfile = async function(id) {
    if (confirm("⚠️ ยืนยันการลบโปรไฟล์นี้?")) {
        try {
            await window.remove(window.ref(window.db, `sensor_profiles/${id}`));
            loadProfileList();
        } catch (e) {
            alert("❌ ลบโปรไฟล์ไม่สำเร็จ: " + e.message);
        }
    }
};

window.applyProfileToForm = function(levelsJson, type) {
    try {
        const levelsArray = JSON.parse(levelsJson.replace(/&quot;/g, '"'));
        document.getElementById('dynamicLevelsContainer').innerHTML = '';
        const typeSelect = document.getElementById('devType');
        if (typeSelect) {
            typeSelect.value = type;
            updateCustomTypeVisibility();
        }
        loadDynamicLevelsFromArray(levelsArray);
        document.getElementById('profileModal').style.display = 'none';
        console.log("✅ โหลดการตั้งค่าจากโปรไฟล์ Application-Oriented แล้ว");
    } catch (e) {
        alert("❌ โหลดโปรไฟล์ไม่สำเร็จ: " + e.message);
    }
};

window.applySelectedProfile = function() {
    const selector = document.getElementById('profileSelector');
    if (!selector.value) return;
    const levels = selector.value;
    const type = selector.options[selector.selectedIndex].getAttribute('data-type');
    applyProfileToForm(levels, type);
};

// ============================================================
//  27. UI HELPERS
// ============================================================
window.updateCustomTypeVisibility = function() {
    const type = document.getElementById('devType').value;
    const customContainer = document.getElementById('customTypeContainer');
    const usConfig = document.getElementById('ultrasonicVerticalConfig');
    const usHorizontalConfig = document.getElementById('ultrasonicHorizontalConfig');
    if (customContainer) customContainer.style.display = (type === 'other') ? 'block' : 'none';
    if (usConfig) usConfig.style.display = (type === 'ultrasonic') ? 'block' : 'none';
    if (usHorizontalConfig) {
        const modeSelect = document.getElementById('sensorModeSelect');
        const mode = modeSelect ? modeSelect.value : 'vertical';
        usHorizontalConfig.style.display = (type === 'ultrasonic' && mode === 'horizontal') ? 'block' : 'none';
    }
};

function initCustomTypeFields() {}

window.confirmDeleteDevice = function(id) {
    const config = deviceConfigs[id];
    const deviceName = config ? config.name : id;
    if (confirm(`⚠️ คำเตือน: คุณต้องการลบอุปกรณ์ "${deviceName}" (ID: ${id}) ออกจากระบบถาวรใช่หรือไม่?`)) {
        deleteDevice(id);
    }
};

window.confirmDeleteUser = function(username) {
    if (confirm(`⚠️ คำเตือน: คุณต้องการลบผู้ใช้ "${username}" ออกจากระบบถาวรใช่หรือไม่?`)) {
        deleteUser(username);
    }
};

function applyDisabledCardStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .disabled-card { opacity: 0.6; filter: grayscale(1); border: 2px dashed #64748b; }
        .disabled-card .sensor-value { color: #94a3b8 !important; }
        .disabled-card .sensor-unit { color: #64748b !important; }
        .disabled-card .timestamp { color: #64748b !important; }
        .sensor-card.offline-card { opacity: 0.7; border: 2px solid #f87171 !important; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
        .sensor-card.offline-card .sensor-value { color: #94a3b8 !important; }
        .sensor-card.offline-card .sensor-title { color: #f87171 !important; }
        .sensor-status-badge.offline { background: rgba(239, 68, 68, 0.15); padding: 4px 12px; border-radius: 12px; border: 1px solid #f87171; animation: pulse-offline 2s infinite; }
        .sensor-status-badge.waiting { background: rgba(251, 191, 36, 0.15); padding: 4px 12px; border-radius: 12px; border: 1px solid #fbbf24; }
        .sensor-status-badge.online { background: rgba(74, 222, 128, 0.15); padding: 4px 12px; border-radius: 12px; border: 1px solid #4ade80; }
        @keyframes pulse-offline { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes alertPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.02); } }
        .sensor-card.flood-alert { border: 2px solid #d32f2f !important; box-shadow: 0 0 30px rgba(211, 47, 47, 0.3); animation: alertPulse 1.5s infinite; }
        .sensor-card.warning-alert { border: 2px solid #f57c00 !important; box-shadow: 0 0 20px rgba(245, 124, 0, 0.2); }
        .alert-badge.flood { background: #d32f2f !important; animation: alertPulse 1.5s infinite; }
        .alert-badge.warning { background: #f57c00 !important; }
    `;
    document.head.appendChild(style);
}

// ============================================================
//  28. AUTO-LOG
// ============================================================
window.loadLoggingConfig = async function() {
    if (!window.db) return;
    try {
        const snap = await window.get(window.ref(window.db, 'settings/logging_config'));
        if (snap.exists()) {
            const config = snap.val();
            const periodValue = document.getElementById('periodValue');
            const periodType = document.getElementById('periodType');
            const recordsPerPeriod = document.getElementById('recordsPerPeriod');
            if (periodValue) periodValue.value = config.val || '';
            if (periodType) periodType.value = config.type || 'day';
            if (recordsPerPeriod) recordsPerPeriod.value = config.rec || '';
            const periodLabel = document.getElementById('periodLabel');
            if (periodLabel) {
                const typeMap = { day: 'วัน', hour: 'ชั่วโมง', minute: 'นาที' };
                periodLabel.textContent = typeMap[config.type] || 'วัน';
            }
            const summaryGroupType = document.getElementById('summaryGroupType');
            if (summaryGroupType) {
                const typeMap = { day: 'วัน', hour: 'ชั่วโมง', minute: 'นาที' };
                summaryGroupType.textContent = typeMap[config.type] || 'วัน';
            }
            if (typeof calculateAutoLogPreview === 'function') {
                calculateAutoLogPreview();
            }
            console.log("✅ โหลดการตั้งค่า Auto-Log สำเร็จ:", config);
        } else {
            const periodValue = document.getElementById('periodValue');
            const periodType = document.getElementById('periodType');
            const recordsPerPeriod = document.getElementById('recordsPerPeriod');
            if (periodValue && !periodValue.value) periodValue.value = 1;
            if (periodType && !periodType.value) periodType.value = 'day';
            if (recordsPerPeriod && !recordsPerPeriod.value) recordsPerPeriod.value = 24;
            const periodLabel = document.getElementById('periodLabel');
            if (periodLabel) periodLabel.textContent = 'วัน';
            const summaryGroupType = document.getElementById('summaryGroupType');
            if (summaryGroupType) summaryGroupType.textContent = 'วัน';
            if (typeof calculateAutoLogPreview === 'function') {
                calculateAutoLogPreview();
            }
            console.log("📭 ยังไม่มีการตั้งค่า Auto-Log ใช้ค่าเริ่มต้น");
        }
    } catch (error) {
        console.warn("⚠️ โหลดการตั้งค่า Auto-Log ไม่สำเร็จ:", error);
    }
};

window.applyLoggingConfig = async function() {
    const periodValue = document.getElementById('periodValue');
    const periodType = document.getElementById('periodType');
    const recordsPerPeriod = document.getElementById('recordsPerPeriod');
    if (!periodValue || !periodType || !recordsPerPeriod) {
        alert("❌ ไม่พบฟิลด์การตั้งค่า");
        return;
    }
    const val = parseInt(periodValue.value);
    const type = periodType.value;
    const rec = parseInt(recordsPerPeriod.value);
    if (isNaN(val) || val < 1) { alert("⚠️ กรุณากรอกจำนวนให้ถูกต้อง (อย่างน้อย 1)"); periodValue.focus(); return; }
    if (isNaN(rec) || rec < 1) { alert("⚠️ กรุณากรอกจำนวนครั้งให้ถูกต้อง (อย่างน้อย 1)"); recordsPerPeriod.focus(); return; }
    let intervalMs = 0;
    const typeMap = { day: 'วัน', hour: 'ชั่วโมง', minute: 'นาที' };
    if (type === 'day') {
        intervalMs = (86400000) / rec;
    } else if (type === 'hour') {
        intervalMs = (val * 3600000) / rec;
    } else if (type === 'minute') {
        intervalMs = (val * 60000) / rec;
    } else {
        alert("⚠️ ประเภทข้อมูลไม่ถูกต้อง");
        return;
    }
    if (intervalMs < 1000) {
        alert("⚠️ ความถี่ในการบันทึกน้อยกว่า 1 วินาที กรุณาปรับลดจำนวนครั้ง");
        return;
    }
    if (!confirm(`⚠️ ยืนยันการตั้งค่า Auto-Log:\n\n📊 ระยะเวลา: ${val} ${typeMap[type] || type}\n📈 จำนวนครั้ง: ${rec} ครั้ง\n⏱️ ความถี่: ${(intervalMs / 1000).toFixed(1)} วินาที`)) return;
    try {
        await window.set(window.ref(window.db, 'settings/logging_config'), {
            type: type,
            val: val,
            rec: rec,
            intervalMs: intervalMs,
            maxRecords: val * rec,
            updatedAt: new Date().toISOString()
        });
        startAutoLoggingFromConfig();
        alert("✅ บันทึกการตั้งค่า Auto-Log สำเร็จ");
        const periodLabel = document.getElementById('periodLabel');
        if (periodLabel) {
            periodLabel.textContent = typeMap[type] || type;
        }
        const summaryGroupType = document.getElementById('summaryGroupType');
        if (summaryGroupType) {
            summaryGroupType.textContent = typeMap[type] || 'วัน';
        }
        if (typeof calculateAutoLogPreview === 'function') {
            calculateAutoLogPreview();
        }
    } catch (error) {
        console.error("❌ applyLoggingConfig error:", error);
        alert("❌ บันทึกไม่สำเร็จ: " + error.message);
    }
};

async function startAutoLoggingFromConfig() {
    if (!window.db) return;
    if (autoLogIntervalId) {
        clearInterval(autoLogIntervalId);
        autoLogIntervalId = null;
    }
    try {
        const snap = await window.get(window.ref(window.db, 'settings/logging_config'));
        if (!snap.exists()) {
            console.log("📭 ไม่พบการตั้งค่า Auto-Log ใช้ค่าเริ่มต้น (15 นาที)");
            startAutoLogging(15);
            return;
        }
        const config = snap.val();
        const intervalMs = config.intervalMs || 900000;
        const maxRecords = config.maxRecords || 1000;
        console.log(`⏱️ เริ่ม Auto-Log: ทุก ${(intervalMs / 60000).toFixed(1)} นาที, เก็บสูงสุด ${maxRecords} รายการ`);
        autoLogIntervalId = setInterval(async () => {
            await logSensorDataWithFIFO(maxRecords);
        }, intervalMs);
        setTimeout(async () => {
            await logSensorDataWithFIFO(maxRecords);
        }, 3000);
    } catch (error) {
        console.error("❌ startAutoLoggingFromConfig error:", error);
        startAutoLogging(15);
    }
}

function startAutoLogging(minutes) {
    if (autoLogIntervalId) clearInterval(autoLogIntervalId);
    currentIntervalMinutes = minutes || 15;
    const ms = currentIntervalMinutes * 60 * 1000;
    console.log(`⏱️ เริ่มการบันทึกข้อมูลอัตโนมัติทุกๆ ${currentIntervalMinutes} นาที`);
    autoLogIntervalId = setInterval(async () => {
        if (Object.keys(currentSensorValues).length === 0) return;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const path = `sensor_history/${dateStr}/${timeStr}`;
        try {
            const dataToSave = { ...currentSensorValues, savedAt: now.toISOString() };
            await window.set(window.ref(window.db, path), dataToSave);
            console.log(`📝 บันทึกข้อมูลสถิติลง Firebase สำเร็จ (${timeStr})`);
        } catch (e) { console.error("❌ บันทึกสถิติไม่สำเร็จ:", e); }
    }, ms);
}

async function logSensorDataWithFIFO(maxRecords) {
    if (!window.db) return;
    if (Object.keys(currentSensorValues).length === 0) {
        console.log("📭 ไม่มีข้อมูลเซนเซอร์ให้บันทึก");
        return;
    }
    let hasChange = false;
    const valuesToSave = {};
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    for (const [id, value] of Object.entries(currentSensorValues)) {
        let finalValue = value;
        const config = deviceConfigs[id];
        if (config && config.type === 'ultrasonic' && config.installHeight && value !== undefined && value !== null) {
            const rawDistance = parseFloat(value);
            if (!isNaN(rawDistance)) {
                finalValue = Number(calculateWaterLevel(rawDistance, config.installHeight).toFixed(2));
            }
        }
        if (lastSavedValues[id] !== Number(finalValue)) {
            valuesToSave[id] = Number(finalValue);
            lastSavedValues[id] = Number(finalValue);
            hasChange = true;
        } else {
            console.log(`📝 ${id}: ค่าไม่เปลี่ยนแปลง (${finalValue}) ข้ามการบันทึก`);
        }
    }
    if (!hasChange) {
        console.log("📝 ข้อมูลไม่มีการเปลี่ยนแปลง ข้ามการบันทึก...");
        return;
    }
    try {
        const historyRef = window.ref(window.db, 'sensor_history');
        const newLog = {
            timestamp: now.toISOString(),
            values: valuesToSave,
            deviceConfigs: { ...deviceConfigs }
        };
        await window.push(historyRef, newLog);
        console.log(`📝 บันทึกข้อมูลสำเร็จ (${now.toLocaleString('th-TH')}) - ${Object.keys(valuesToSave).length} ค่าเปลี่ยนแปลง`);
        sensorHistory.timestamps.push(timeLabel);
        if (sensorHistory.timestamps.length > 100) sensorHistory.timestamps.shift();
        for (const [id, value] of Object.entries(valuesToSave)) {
            if (!sensorHistory.data[id]) sensorHistory.data[id] = [];
            sensorHistory.data[id].push(value);
            if (sensorHistory.data[id].length > 100) sensorHistory.data[id].shift();
        }
        if (chart) {
            chart.data.labels = sensorHistory.timestamps;
            chart.update('none');
        }
        const snapshot = await window.get(historyRef);
        if (!snapshot.exists()) return;
        const totalCount = snapshot.numChildren ? snapshot.numChildren() : Object.keys(snapshot.val()).length;
        if (totalCount > maxRecords) {
            const toDelete = totalCount - maxRecords;
            console.log(`🧹 ข้อมูลเกิน ${toDelete} รายการ กำลังลบข้อมูลเก่า...`);
            const oldestQuery = window.query(historyRef, window.orderByKey(), window.limitToFirst(toDelete));
            const oldestSnap = await window.get(oldestQuery);
            if (oldestSnap.exists()) {
                const updates = {};
                oldestSnap.forEach((child) => {
                    updates[child.key] = null;
                });
                await historyRef.update(updates);
                console.log(`✅ ลบข้อมูลเก่า ${toDelete} รายการสำเร็จ`);
            }
        }
    } catch (error) {
        console.error("❌ logSensorDataWithFIFO error:", error);
    }
}

window.updatePeriodLabel = function() {
    const periodType = document.getElementById('periodType');
    const periodLabel = document.getElementById('periodLabel');
    if (!periodType || !periodLabel) return;
    const typeMap = { 'day': 'วัน', 'hour': 'ชั่วโมง', 'minute': 'นาที' };
    const selectedValue = periodType.value;
    periodLabel.textContent = typeMap[selectedValue] || 'วัน';
};

// ============================================================
//  AUTO-LOG PREVIEW - ปรับปรุงให้ดูเป็นมืออาชีพ
// ============================================================

// ============================================================
//  AUTO-LOG PREVIEW - สไตล์ Clean & Minimal (พื้นหลังขาว)
// ============================================================

window.calculateAutoLogPreview = function() {
    const periodValue = document.getElementById('periodValue');
    const periodType = document.getElementById('periodType');
    const recordsPerPeriod = document.getElementById('recordsPerPeriod');
    const previewContainer = document.getElementById('logPreviewContainer');
    
    if (!periodValue || !periodType || !recordsPerPeriod || !previewContainer) {
        console.warn("⚠️ ไม่พบองค์ประกอบที่จำเป็นสำหรับ Auto-Log Preview");
        return;
    }
    
    const val = parseInt(periodValue.value);
    const type = periodType.value;
    const rec = parseInt(recordsPerPeriod.value);
    
    // ✅ กรณีข้อมูลไม่ครบ
    if (isNaN(val) || val < 1 || isNaN(rec) || rec < 1) {
        previewContainer.innerHTML = `
            <div style="
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 12px;
                padding: 16px 20px;
                color: #dc2626;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span style="font-size: 1.3rem;">⚠️</span>
                <span>กรุณากรอกข้อมูลให้ครบถ้วนเพื่อดูตัวอย่าง</span>
            </div>
        `;
        return;
    }
    
    // ✅ คำนวณค่าต่างๆ
    let totalRecords = 0;
    let intervalSeconds = 0;
    let timeUnitText = '';
    const typeMap = { day: 'วัน', hour: 'ชั่วโมง', minute: 'นาที' };
    
    if (type === 'day') {
        totalRecords = val * rec;
        intervalSeconds = (86400) / rec;
        timeUnitText = 'วัน';
    } else if (type === 'hour') {
        totalRecords = val * rec;
        intervalSeconds = (3600) / rec;
        timeUnitText = 'ชั่วโมง';
    } else if (type === 'minute') {
        totalRecords = val * rec;
        intervalSeconds = (60) / rec;
        timeUnitText = 'นาที';
    } else {
        previewContainer.innerHTML = `
            <div style="
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 12px;
                padding: 16px 20px;
                color: #dc2626;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span style="font-size: 1.3rem;">❌</span>
                <span>ประเภทข้อมูลไม่ถูกต้อง</span>
            </div>
        `;
        return;
    }
    
    // ✅ แปลง interval ให้อ่านง่าย
    let intervalDisplay = '';
    if (intervalSeconds >= 3600) {
        const hours = Math.floor(intervalSeconds / 3600);
        const minutes = Math.round((intervalSeconds % 3600) / 60);
        if (minutes === 0) {
            intervalDisplay = `${hours} ชั่วโมง`;
        } else {
            intervalDisplay = `${hours} ชั่วโมง ${minutes} นาที`;
        }
    } else if (intervalSeconds >= 60) {
        const minutes = Math.floor(intervalSeconds / 60);
        const seconds = Math.round(intervalSeconds % 60);
        if (seconds === 0) {
            intervalDisplay = `${minutes} นาที`;
        } else {
            intervalDisplay = `${minutes} นาที ${seconds} วินาที`;
        }
    } else {
        intervalDisplay = `${Math.round(intervalSeconds)} วินาที`;
    }
    
    // ✅ คำนวณขนาดไฟล์โดยประมาณ
    const estimatedSizeKB = Math.round((totalRecords * 0.3) / 1024 * 10) / 10;
    const estimatedSizeMB = Math.round((totalRecords * 0.3) / (1024 * 1024) * 100) / 100;
    
    // ✅ แสดงผลแบบ Clean & Minimal (พื้นหลังขาว ตัวหนังสือฟ้า)
    previewContainer.innerHTML = `
        <div style="
            background: #ffffff;
            border-radius: 12px;
            padding: 20px 22px;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #3b82f6;
            margin-top: 14px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        ">
            <!-- 📊 หัวข้อ -->
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #f1f5f9;
            ">
                <span style="
                    font-size: 1.3rem;
                    background: #eff6ff;
                    padding: 4px 10px;
                    border-radius: 8px;
                ">📊</span>
                <div>
                    <span style="
                        color: #0f172a;
                        font-weight: 700;
                        font-size: 1rem;
                    ">สรุปการบันทึกข้อมูล</span>
                    <span style="
                        color: #94a3b8;
                        font-size: 0.65rem;
                        display: block;
                        margin-top: 1px;
                    ">อัปเดตอัตโนมัติเมื่อเปลี่ยนค่า</span>
                </div>
            </div>

            <!-- 🔢 ตัวเลขสำคัญ 3 คอลัมน์ -->
            <div style="
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            ">
                <!-- จำนวนข้อมูล -->
                <div style="
                    background: #f0f9ff;
                    padding: 12px 8px;
                    border-radius: 10px;
                    border: 1px solid #bae6fd;
                    text-align: center;
                ">
                    <div style="
                        color: #2563eb;
                        font-size: 1.6rem;
                        font-weight: 800;
                        line-height: 1.2;
                    ">
                        ${totalRecords.toLocaleString()}
                    </div>
                    <div style="
                        color: #64748b;
                        font-size: 0.65rem;
                        font-weight: 500;
                        margin-top: 4px;
                    ">
                        📑 จำนวนข้อมูลทั้งหมด
                    </div>
                </div>
                
                <!-- ความถี่ -->
                <div style="
                    background: #f0fdf4;
                    padding: 12px 8px;
                    border-radius: 10px;
                    border: 1px solid #bbf7d0;
                    text-align: center;
                ">
                    <div style="
                        color: #16a34a;
                        font-size: 1.1rem;
                        font-weight: 800;
                        line-height: 1.2;
                        min-height: 2.2rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        ${intervalDisplay}
                    </div>
                    <div style="
                        color: #64748b;
                        font-size: 0.65rem;
                        font-weight: 500;
                        margin-top: 4px;
                    ">
                        ⏱️ บันทึกทุกๆ
                    </div>
                </div>
                
                <!-- ขนาดไฟล์ -->
                <div style="
                    background: #fef2f2;
                    padding: 12px 8px;
                    border-radius: 10px;
                    border: 1px solid #fecaca;
                    text-align: center;
                ">
                    <div style="
                        color: #dc2626;
                        font-size: 1.6rem;
                        font-weight: 800;
                        line-height: 1.2;
                    ">
                        ${estimatedSizeMB > 1 ? `${estimatedSizeMB} MB` : `${estimatedSizeKB} KB`}
                    </div>
                    <div style="
                        color: #64748b;
                        font-size: 0.65rem;
                        font-weight: 500;
                        margin-top: 4px;
                    ">
                        💾 ขนาดไฟล์โดยประมาณ
                    </div>
                </div>
            </div>

            <!-- 📋 รายละเอียดเพิ่มเติม -->
            <div style="
                background: #f8fafc;
                border-radius: 10px;
                padding: 12px 16px;
                border: 1px solid #e2e8f0;
            ">
                <!-- ระยะเวลา -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0;
                    border-bottom: 1px solid #f1f5f9;
                ">
                    <span style="color: #475569; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <span style="color: #3b82f6;">📅</span> ระยะเวลาเก็บข้อมูล
                    </span>
                    <span style="
                        color: #0f172a;
                        font-weight: 700;
                        font-size: 0.85rem;
                        background: #eff6ff;
                        padding: 2px 14px;
                        border-radius: 16px;
                        border: 1px solid #bfdbfe;
                    ">
                        ${val} ${timeUnitText}
                    </span>
                </div>
                
                <!-- จำนวนรอบ -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0;
                    border-bottom: 1px solid #f1f5f9;
                ">
                    <span style="color: #475569; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <span style="color: #22c55e;">📈</span> จำนวนรอบที่บันทึก
                    </span>
                    <span style="
                        color: #0f172a;
                        font-weight: 700;
                        font-size: 0.85rem;
                        background: #f0fdf4;
                        padding: 2px 14px;
                        border-radius: 16px;
                        border: 1px solid #bbf7d0;
                    ">
                        ${rec} ครั้ง / ${timeUnitText}
                    </span>
                </div>
                
                <!-- ความครอบคลุม -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0;
                ">
                    <span style="color: #475569; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <span style="color: #f59e0b;">📦</span> ความครอบคลุมสูงสุด
                    </span>
                    <span style="
                        color: #0f172a;
                        font-weight: 700;
                        font-size: 0.85rem;
                        background: #fffbeb;
                        padding: 2px 14px;
                        border-radius: 16px;
                        border: 1px solid #fde68a;
                    ">
                        ${Math.ceil(totalRecords / rec)} ${timeUnitText}
                    </span>
                </div>
            </div>
            
            <!-- 🔔 ข้อความแจ้งเตือนเพิ่มเติม -->
            ${totalRecords > 5000 ? `
            <div style="
                margin-top: 12px;
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-radius: 8px;
                padding: 8px 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: #b45309;
                font-size: 0.78rem;
            ">
                <span style="font-size: 1rem;">💡</span>
                <span>ข้อมูลจำนวนมาก (${totalRecords.toLocaleString()} รายการ) อาจส่งผลต่อประสิทธิภาพการโหลด</span>
            </div>
            ` : ''}
            
            ${intervalSeconds < 10 ? `
            <div style="
                margin-top: 12px;
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 8px;
                padding: 8px 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: #dc2626;
                font-size: 0.78rem;
            ">
                <span style="font-size: 1rem;">⚠️</span>
                <span>บันทึกข้อมูลบ่อยเกินไป (${intervalDisplay}) อาจทำให้ Firebase ทำงานหนัก</span>
            </div>
            ` : ''}
        </div>
    `;
};
// ============================================================
//  29. MANUAL CLEANUP
// ============================================================
window.manualDeleteByRange = async function() {
    const startInput = document.getElementById('deleteStart');
    const endInput = document.getElementById('deleteEnd');
    if (!startInput || !endInput) {
        alert("❌ ไม่พบฟิลด์เลือกช่วงเวลา");
        return;
    }
    const startStr = startInput.value;
    const endStr = endInput.value;
    if (!startStr || !endStr) {
        alert("⚠️ กรุณาระบุช่วงเวลาให้ครบถ้วน");
        return;
    }
    const startTime = new Date(startStr).getTime();
    const endTime = new Date(endStr).getTime();
    if (isNaN(startTime) || isNaN(endTime)) {
        alert("⚠️ รูปแบบเวลาไม่ถูกต้อง");
        return;
    }
    if (startTime > endTime) {
        alert("⚠️ เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด");
        return;
    }
    if (!confirm(`⚠️ ยืนยันการลบข้อมูลในช่วงเวลา:\n\n📅 ตั้งแต่: ${new Date(startTime).toLocaleString('th-TH')}\n📅 ถึง: ${new Date(endTime).toLocaleString('th-TH')}`)) return;
    try {
        const historyRef = window.ref(window.db, 'sensor_history');
        const snapshot = await window.get(historyRef);
        if (!snapshot.exists()) {
            alert("📭 ไม่มีข้อมูลประวัติในระบบ");
            return;
        }
        let count = 0;
        const updates = {};
        snapshot.forEach((child) => {
            const data = child.val();
            if (data && data.timestamp) {
                const logTime = new Date(data.timestamp).getTime();
                if (logTime >= startTime && logTime <= endTime) {
                    updates[child.key] = null;
                    count++;
                }
            }
        });
        if (count === 0) {
            alert("📭 ไม่พบข้อมูลในช่วงเวลาที่ระบุ");
            return;
        }
        if (confirm(`⚠️ พบข้อมูล ${count} รายการในช่วงเวลานี้ ต้องการลบใช่หรือไม่?`)) {
            await historyRef.update(updates);
            alert(`✅ ลบข้อมูลสำเร็จ ${count} รายการ`);
        }
    } catch (error) {
        console.error("❌ manualDeleteByRange error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    }
};

window.manualDeleteAll = async function() {
    const CONFIRM_CODE = "55555";
    const userInput = prompt(`🔥 คำเตือนขั้นสูงสุด!\n\nคุณกำลังจะลบข้อมูลประวัติเซนเซอร์ทั้งหมดในระบบ!\n\nเพื่อป้องกันการลบโดยไม่ตั้งใจ โปรดกรอกรหัสยืนยัน "${CONFIRM_CODE}" เพื่อดำเนินการต่อ:`);
    if (userInput !== CONFIRM_CODE) {
        if (userInput !== null) {
            alert("❌ รหัสยืนยันไม่ถูกต้อง ระบบยกเลิกการลบข้อมูล");
        } else {
            alert("❌ ยกเลิกการลบข้อมูล");
        }
        return;
    }
    try {
        await window.remove(window.ref(window.db, 'sensor_history'));
        alert("✅ ล้างข้อมูลประวัติทั้งหมดเรียบร้อยแล้ว");
    } catch (error) {
        console.error("❌ manualDeleteAll error:", error);
        alert("❌ เกิดข้อผิดพลาดในการลบข้อมูล: " + error.message);
    }
};

// ============================================================
//  30. STATUS BAR
// ============================================================
window.updateStatusBarBoardDetails = function() {
    const detailEl = document.getElementById('boardDetailStatus');
    const selector = document.getElementById('boardSelector');
    if (!detailEl || !selector) return;
    const boards = Object.entries(deviceConfigs).filter(([id, config]) => config.type === 'board');
    const now = Date.now() + serverTimeOffset;
    if (boards.length > 0) {
        selector.style.display = 'inline-block';
        const currentValue = selector.value;
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        boards.forEach(([id]) => {
            let opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id.length > 20 ? id.substring(0, 18) + '…' : id;
            selector.appendChild(opt);
        });
        if (Array.from(selector.options).some(opt => opt.value === currentValue)) {
            selector.value = currentValue;
        } else {
            selector.value = 'all';
        }
    } else {
        selector.style.display = 'none';
    }
    if (boards.length === 0) {
        detailEl.style.display = 'none';
        return;
    }
    const selectedId = selector.value;
    let html = '';
    if (selectedId === 'all') {
        const total = boards.length;
        const onlineBoards = boards.filter(([_, c]) => {
            const lastSeen = getTimestampMs(c.lastSeen);
            return (now - lastSeen) < 600000; // ✅ 10 นาที
        });
        const onlineCount = onlineBoards.length;
        const offlineCount = total - onlineCount;
        const totalRssi = boards.reduce((sum, [_, c]) => sum + (c.wifi_rssi || 0), 0);
        const avgRssi = total > 0 ? Math.round(totalRssi / total) : 0;
        const rssiStatus = getRSSIStatusText(avgRssi);
        let maxUptime = 0;
        let maxUptimeDisplay = '-';
        onlineBoards.forEach(([_, c]) => {
            const uptime = getTimestampMs(c.onlineSince || c.lastSeen);
            if (uptime > maxUptime) {
                maxUptime = uptime;
                maxUptimeDisplay = formatUptime(uptime);
            }
        });
        html = `
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 1.1rem;">📊</span>
                    <span style="color: #e2e8f0; font-weight: 600;">${total}</span>
                    <span style="color: #94a3b8; font-size: 0.8rem;">บอร์ด</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="color: #4ade80; font-size: 1rem;">🟢</span>
                    <span style="color: #4ade80; font-weight: 600;">${onlineCount}</span>
                    <span style="color: #94a3b8; font-size: 0.75rem;">ออนไลน์</span>
                </div>
                ${offlineCount > 0 ? `
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="color: #f87171; font-size: 1rem;">🔴</span>
                    <span style="color: #f87171; font-weight: 600;">${offlineCount}</span>
                    <span style="color: #94a3b8; font-size: 0.75rem;">ออฟไลน์</span>
                </div>
                ` : ''}
                <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid #334155; padding-left: 12px;">
                    <span style="color: #60a5fa;">📶</span>
                    <span style="color: #e2e8f0; font-weight: 500;">${avgRssi}</span>
                    <span style="color: #94a3b8; font-size: 0.75rem;">dBm</span>
                    <span style="color: #94a3b8; font-size: 0.7rem; background: #1e293b; padding: 0 8px; border-radius: 10px;">${rssiStatus}</span>
                </div>
                ${onlineBoards.length > 0 && maxUptime > 0 ? `
                <div style="display: flex; align-items: center; gap: 4px; border-left: 1px solid #334155; padding-left: 12px;">
                    <span style="color: #fbbf24;">⏳</span>
                    <span style="color: #94a3b8; font-size: 0.75rem;">ออนไลน์ต่อเนื่องสูงสุด</span>
                    <span style="color: #e2e8f0; font-weight: 500; font-size: 0.8rem;">
                        ${maxUptimeDisplay}
                    </span>
                </div>
                ` : ''}
            </div>
        `;
    } else {
        const board = boards.find(([id]) => id === selectedId);
        if (board) {
            const [id, config] = board;
            const lastSeen = getTimestampMs(config.lastSeen);
            const isOnline = (now - lastSeen) < 600000; // ✅ 10 นาที
            const rssi = config.wifi_rssi || 0;
            const rssiText = getRSSIStatusText(rssi);
            const signalBars = getSignalBarsHTML(rssi);
            const uptime = isOnline ? formatUptime(config.onlineSince || config.lastSeen) : '-';
            const lastSeenDisplay = lastSeen > 0 ? new Date(lastSeen).toLocaleString('th-TH') : 'ไม่ทราบ';
            const hasWeather = !!(config.weather_config && config.weather_config.lat);
            const weatherStatus = hasWeather ? '🌤️ มีการตั้งค่า' : '🌤️ ยังไม่ได้ตั้งค่า';
            html = `
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #60a5fa; font-size: 1.2rem;">🆔</span>
                        <span style="color: #e2e8f0; font-weight: 700; font-family: monospace; font-size: 0.9rem;">${escapeHtml(id)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; background: ${isOnline ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)'}; padding: 3px 12px; border-radius: 20px; border: 1px solid ${isOnline ? '#4ade80' : '#f87171'};">
                        <span style="font-size: 1rem;">${isOnline ? '🟢' : '🔴'}</span>
                        <span style="color: ${isOnline ? '#4ade80' : '#f87171'}; font-weight: 600; font-size: 0.85rem;">${isOnline ? 'ออนไลน์' : 'ออฟไลน์'}</span>
                        ${isOnline ? `<span style="color: #94a3b8; font-size: 0.65rem; margin-left: 4px;">(${uptime})</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; border-left: 1px solid #334155; padding-left: 12px;">
                        ${signalBars}
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: #e2e8f0; font-weight: 500; font-size: 0.85rem;">${rssi} dBm</span>
                            <span style="color: #94a3b8; font-size: 0.65rem;">${rssiText}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid #334155; padding-left: 12px;">
                        <span style="color: ${hasWeather ? '#4ade80' : '#f87171'};">${hasWeather ? '🌤️' : '🌤️❌'}</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: ${hasWeather ? '#4ade80' : '#f87171'}; font-size: 0.75rem;">${weatherStatus}</span>
                        </div>
                    </div>
                    ${isOnline ? `
                    <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid #334155; padding-left: 12px;">
                        <span style="color: #fbbf24;">⏳</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: #e2e8f0; font-weight: 500; font-size: 0.85rem;">${uptime}</span>
                            <span style="color: #94a3b8; font-size: 0.65rem;">ออนไลน์ต่อเนื่อง</span>
                        </div>
                    </div>
                    ` : `
                    <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid #334155; padding-left: 12px;">
                        <span style="color: #94a3b8;">📅</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: #94a3b8; font-size: 0.8rem;">ออฟไลน์ตั้งแต่</span>
                            <span style="color: #f87171; font-size: 0.75rem;">${lastSeenDisplay}</span>
                        </div>
                    </div>
                    `}
                </div>
            `;
        } else {
            const total = boards.length;
            const onlineBoards = boards.filter(([_, c]) => {
                const lastSeen = getTimestampMs(c.lastSeen);
                return (now - lastSeen) < 600000; // ✅ 10 นาที
            });
            const onlineCount = onlineBoards.length;
            const offlineCount = total - onlineCount;
            html = `
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
                    <span style="color: #f87171;">⚠️</span>
                    <span style="color: #e2e8f0;">ไม่พบข้อมูลบอร์ดที่เลือก</span>
                    <span style="color: #94a3b8; font-size: 0.8rem;">${total} บอร์ด</span>
                    <span style="color: #4ade80;">🟢 ${onlineCount}</span>
                    ${offlineCount > 0 ? `<span style="color: #f87171;">🔴 ${offlineCount}</span>` : ''}
                </div>
            `;
        }
    }
    detailEl.innerHTML = html;
    detailEl.style.display = 'block';
};

// ============================================================
//  31. SETTINGS MANAGER
// ============================================================
window.openSettingsManager = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadLoggingConfig();
        loadTelegramConfig();
        loadSubscribers();
        loadTelegramHistory();
        renderTelegramSchedules();
    }
};

window.closeSettingsManager = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.saveLogInterval = async function() {
    const min = parseInt(document.getElementById('logInterval').value);
    if (isNaN(min) || min < 1) { alert("กรุณากรอกตัวเลขมากกว่า 0"); return; }
    try {
        await window.set(window.ref(window.db, `settings/log_interval`), min);
        alert(`✅ บันทึกความถี่เป็น ${min} นาที สำเร็จ`);
    } catch (e) { alert("❌ บันทึกไม่สำเร็จ: " + e.message); }
};

window.exportDataOffline = async function() {
    if (!window.db) {
        alert("❌ ระบบฐานข้อมูลยังไม่พร้อม");
        return;
    }
    try {
        if (!confirm("📦 ระบบกำลังจะรวบรวมข้อมูลทั้งหมด (การตั้งค่า, ผู้ใช้, เซนเซอร์, และประวัติ) เพื่อสร้างไฟล์สำรอง คุณต้องการดำเนินการต่อหรือไม่?")) return;
        const btn = document.querySelector('button[onclick="exportDataOffline()"]');
        const originalText = btn.textContent;
        btn.textContent = "⏳ กำลังรวบรวมข้อมูล...";
        btn.disabled = true;
        const nodesToBackup = [
            'device_configs',
            'users',
            'settings',
            'sensor_profiles',
            'sensor_history',
            'alert_history'
        ];
        let fullBackup = {
            backupInfo: {
                version: "2.0",
                exportDate: new Date().toISOString(),
                projectTitle: document.getElementById('projectTitle')?.textContent || "KLT Station"
            },
            data: {}
        };
        for (const node of nodesToBackup) {
            const snapshot = await window.get(window.ref(window.db, node));
            if (snapshot.exists()) {
                fullBackup.data[node] = snapshot.val();
            }
        }
        const dataStr = JSON.stringify(fullBackup, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `KLT_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        btn.textContent = originalText;
        btn.disabled = false;
        alert(`✅ สำรองข้อมูลสำเร็จ!\nไฟล์: ${fileName}`);
    } catch (e) {
        console.error("❌ Export Error:", e);
        alert("❌ การสำรองข้อมูลล้มเหลว: " + e.message);
    }
};

window.importDataOffline = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedPackage = JSON.parse(e.target.result);
            if (!importedPackage.data || !importedPackage.backupInfo) {
                throw new Error("รูปแบบไฟล์สำรองไม่ถูกต้อง (ไม่พบโครงสร้างข้อมูลหลัก)");
            }
            const info = importedPackage.backupInfo;
            const confirmMsg = `⚠️ คำเตือน: คุณกำลังจะนำเข้าข้อมูลสำรอง\n` +
                               `----------------------------------\n` +
                               `ชื่อโครงการ: ${info.projectTitle}\n` +
                               `วันที่สำรอง: ${new Date(info.exportDate).toLocaleString('th-TH')}\n` +
                               `----------------------------------\n` +
                               `❌ การดำเนินการนี้จะ "เขียนทับ" ข้อมูลปัจจุบันทั้งหมดบนระบบ!\n` +
                               `คุณยืนยันที่จะกู้คืนข้อมูลใช่หรือไม่?`;
            if (!confirm(confirmMsg)) {
                event.target.value = '';
                return;
            }
            const updates = {};
            const nodes = Object.keys(importedPackage.data);
            for (const node of nodes) {
                updates[node] = importedPackage.data[node];
            }
            await window.update(window.ref(window.db), updates);
            alert("✅ กู้คืนข้อมูลระบบสำเร็จ! ระบบจะทำการรีโหลดหน้าเว็บ");
            window.location.reload();
        } catch (err) {
            alert("❌ นำเข้าข้อมูลล้มเหลว: " + err.message);
            console.error(err);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

// ============================================================
//  32. CLEANUP MANAGER
// ============================================================
window.openCleanupManager = async function() {
    const modal = document.getElementById('cleanupModal');
    if (!modal) {
        alert("❌ ไม่พบหน้าต่าง Cleanup Manager กรุณาตรวจสอบไฟล์ HTML");
        return;
    }
    modal.style.display = 'flex';
    const tbody = document.getElementById('cleanupTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #60a5fa;">⏳ กำลังสแกนข้อมูล...</td></tr>';
    }
    const searchInput = document.getElementById('cleanupSearchInput');
    if (searchInput) searchInput.value = '';
    const typeFilter = document.getElementById('cleanupTypeFilter');
    if (typeFilter) typeFilter.value = 'all';
    const statusFilter = document.getElementById('cleanupStatusFilter');
    if (statusFilter) statusFilter.value = 'all';
    await renderCleanupTable();
};

window.closeCleanupModal = function() {
    const modal = document.getElementById('cleanupModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const selectAll = document.getElementById('cleanupSelectAll');
    if (selectAll) selectAll.checked = false;
};

async function renderCleanupTable() {
    const tbody = document.getElementById('cleanupTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">⌛ กำลังดึงข้อมูล...</td></tr>';
    try {
        const snapshot = await window.get(window.ref(window.db, 'device_configs'));
        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">📭 ไม่มีข้อมูลอุปกรณ์</td></tr>';
            updateCleanupStats();
            return;
        }
        const configs = snapshot.val();
        if (!configs || typeof configs !== 'object') {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">📭 ไม่มีข้อมูลอุปกรณ์ในระบบ</td></tr>';
            updateCleanupStats();
            return;
        }
        deviceConfigs = configs;
        tbody.innerHTML = '';
        window._cleanupData = [];
        for (const id in configs) {
            if (configs.hasOwnProperty(id)) {
                const config = configs[id];
                if (!config || typeof config !== 'object') continue;
                const isBoard = config.type === 'board';
                const isEnabled = config.enabled !== false;
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', id);
                const statusColor = isEnabled ? '#4ade80' : '#f87171';
                const typeIcon = isBoard ? '🔌 บอร์ด' : (config.type || '🔍 อื่นๆ');
                let boardConnection = '-';
                if (!isBoard && config.boardId) {
                    try {
                        const boardConfig = configs[config.boardId];
                        if (boardConfig) {
                            const boardOnline = boardConfig.status === 'online';
                            boardConnection = `${config.boardId} ${boardOnline ? '🟢' : '🔴'}`;
                        } else {
                            boardConnection = `⚠️ ${config.boardId} (ไม่พบ)`;
                        }
                    } catch (e) {
                        boardConnection = `⚠️ ${config.boardId}`;
                    }
                } else if (isBoard) {
                    let connectedCount = 0;
                    for (const sensorId in configs) {
                        if (configs.hasOwnProperty(sensorId)) {
                            const sensorConfig = configs[sensorId];
                            if (sensorConfig && sensorConfig.boardId === id && sensorConfig.type !== 'board') {
                                connectedCount++;
                            }
                        }
                    }
                    boardConnection = `🔗 เชื่อมต่อ ${connectedCount} ตัว`;
                }
                tr.innerHTML = `
                    <td style="text-align:center; padding: 6px 4px;">
                        <input type="checkbox" class="cleanup-check" value="${escapeHtml(id)}" 
                               data-enabled="${isEnabled}" data-type="${config.type}"
                               onchange="updateCleanupStats()" style="width: 17px; height: 17px; cursor: pointer; accent-color: #3b82f6;">
                    </td>
                    <td style="padding: 8px 12px; font-family: monospace; color: #60a5fa; font-weight: 600;">${escapeHtml(id)}</td>
                    <td style="padding: 8px 12px; color: #e2e8f0;">${escapeHtml(config.name || '-')}</td>
                    <td style="padding: 8px 12px;"><span style="color: ${isBoard ? '#60a5fa' : '#34d399'};">${typeIcon}</span></td>
                    <td style="text-align:center; padding: 8px 12px;">
                        <span style="color: ${statusColor}; font-weight: 500; font-size: 0.8rem;">${isEnabled ? '✅ เปิดใช้งาน' : '❌ ปิดใช้งาน'}</span>
                    </td>
                    <td style="text-align:center; padding: 8px 12px; font-size: 0.75rem; color: #94a3b8;">${boardConnection}</td>
                `;
                tbody.appendChild(tr);
                window._cleanupData.push({
                    id: id,
                    name: config.name || '',
                    type: isBoard ? 'board' : 'sensor',
                    typeDisplay: isBoard ? 'board' : config.type,
                    enabled: isEnabled,
                    boardId: config.boardId || null,
                    element: tr
                });
            }
        }
        updateCleanupStats();
        const selectAll = document.getElementById('cleanupSelectAll');
        if (selectAll) selectAll.checked = false;
        console.log(`✅ โหลดข้อมูล Cleanup สำเร็จ: ${window._cleanupData.length} รายการ`);
    } catch (error) {
        console.error("❌ renderCleanupTable error:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #ef4444;">❌ โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
}

window.updateCleanupStats = function() {
    const checkboxes = document.querySelectorAll('.cleanup-check');
    const total = checkboxes.length;
    let enabled = 0;
    let disabled = 0;
    let selected = 0;
    checkboxes.forEach(cb => {
        const isEnabled = cb.dataset.enabled === 'true';
        if (isEnabled) enabled++;
        else disabled++;
        if (cb.checked) selected++;
    });
    const totalEl = document.getElementById('cleanupTotalCount');
    const enabledEl = document.getElementById('cleanupEnabledCount');
    const disabledEl = document.getElementById('cleanupDisabledCount');
    const selectedEl = document.getElementById('cleanupSelectedCount');
    const deleteCountEl = document.getElementById('cleanupDeleteCount');
    if (totalEl) totalEl.textContent = total;
    if (enabledEl) enabledEl.textContent = enabled;
    if (disabledEl) disabledEl.textContent = disabled;
    if (selectedEl) selectedEl.textContent = selected;
    if (deleteCountEl) deleteCountEl.textContent = selected;
};

window.filterCleanupTable = function() {
    const searchValue = document.getElementById('cleanupSearchInput')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('cleanupTypeFilter')?.value || 'all';
    const statusFilter = document.getElementById('cleanupStatusFilter')?.value || 'all';
    const rows = document.querySelectorAll('#cleanupTableBody tr');
    let visibleCount = 0;
    rows.forEach(row => {
        const checkboxes = row.querySelectorAll('.cleanup-check');
        if (checkboxes.length === 0) {
            row.style.display = '';
            return;
        }
        const cb = checkboxes[0];
        const id = cb.value.toLowerCase();
        const name = row.querySelector('td:nth-child(3)')?.textContent?.toLowerCase() || '';
        const type = cb.dataset.type || '';
        const isEnabled = cb.dataset.enabled === 'true';
        let show = true;
        if (searchValue && !id.includes(searchValue) && !name.includes(searchValue)) {
            show = false;
        }
        if (typeFilter !== 'all') {
            if (typeFilter === 'board' && type !== 'board') show = false;
            if (typeFilter === 'sensor' && type === 'board') show = false;
        }
        if (statusFilter !== 'all') {
            if (statusFilter === 'enabled' && !isEnabled) show = false;
            if (statusFilter === 'disabled' && isEnabled) show = false;
        }
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });
    const visibleCheckboxes = document.querySelectorAll('#cleanupTableBody tr:not([style*="display: none"]) .cleanup-check');
    const totalVisible = visibleCheckboxes.length;
    const selectedVisible = document.querySelectorAll('#cleanupTableBody tr:not([style*="display: none"]) .cleanup-check:checked').length;
    const totalEl = document.getElementById('cleanupTotalCount');
    if (totalEl) totalEl.textContent = totalVisible;
    const deleteCountEl = document.getElementById('cleanupDeleteCount');
    if (deleteCountEl) deleteCountEl.textContent = selectedVisible;
};

window.toggleAllCleanupCheckboxes = function(checked) {
    const checkboxes = document.querySelectorAll('#cleanupTableBody tr:not([style*="display: none"]) .cleanup-check');
    checkboxes.forEach(cb => {
        cb.checked = checked;
    });
    updateCleanupStats();
    const selectAll = document.getElementById('cleanupSelectAll');
    if (selectAll) selectAll.checked = checked;
};

window.selectCleanupByStatus = function(status) {
    const checkboxes = document.querySelectorAll('.cleanup-check');
    checkboxes.forEach(cb => {
        const isEnabled = cb.dataset.enabled === 'true';
        const type = cb.dataset.type || '';
        let shouldSelect = false;
        if (status === 'enabled' && isEnabled) shouldSelect = true;
        else if (status === 'disabled' && !isEnabled) shouldSelect = true;
        else if (status === 'board' && type === 'board') shouldSelect = true;
        else if (status === 'sensor' && type !== 'board') shouldSelect = true;
        cb.checked = shouldSelect;
    });
    updateCleanupStats();
    const selectAll = document.getElementById('cleanupSelectAll');
    if (selectAll) {
        const allChecked = document.querySelectorAll('.cleanup-check:checked').length === document.querySelectorAll('.cleanup-check').length;
        selectAll.checked = allChecked;
    }
};

window.executeSelectedCleanup = async function() {
    const selected = document.querySelectorAll('.cleanup-check:checked');
    if (selected.length === 0) {
        alert("⚠️ กรุณาเลือกรายการที่ต้องการลบ");
        return;
    }
    if (!confirm(`🔥 ยืนยันการลบ ${selected.length} รายการที่เลือก? (ไม่สามารถกู้คืนได้)`)) return;
    const btn = document.querySelector('button[onclick="executeSelectedCleanup()"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ กำลังลบ...';
    }
    try {
        let successCount = 0;
        let failCount = 0;
        const failedItems = [];
        for (const cb of selected) {
            const id = cb.value;
            try {
                await window.remove(window.ref(window.db, `device_configs/${id}`));
                console.log(`✅ ลบ device_configs/${id} สำเร็จ`);
                await window.remove(window.ref(window.db, `alert_history/${id}`));
                console.log(`✅ ลบ alert_history/${id} สำเร็จ`);
                successCount++;
                if (deviceConfigs && deviceConfigs[id]) {
                    delete deviceConfigs[id];
                }
            } catch (err) {
                failCount++;
                failedItems.push(id);
                console.error(`❌ ลบ ${id} ล้มเหลว:`, err);
            }
        }
        console.log("🔄 กำลังรีโหลด device_configs จาก Firebase...");
        const freshSnapshot = await window.get(window.ref(window.db, 'device_configs'));
        if (freshSnapshot.exists()) {
            deviceConfigs = freshSnapshot.val();
            console.log(`📋 โหลด device_configs ใหม่สำเร็จ: ${Object.keys(deviceConfigs).length} รายการ`);
        } else {
            deviceConfigs = {};
        }
        let message = '';
        if (failCount === 0) {
            message = `✅ ลบข้อมูลที่เลือกเรียบร้อยแล้ว (${successCount} รายการ)`;
        } else {
            message = `⚠️ ลบสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ:\n${failedItems.join(', ')}`;
        }
        alert(message);
        closeCleanupModal();
        if (typeof renderDeviceTable === 'function') renderDeviceTable();
        if (typeof renderBoardTable === 'function') renderBoardTable();
        if (typeof renderSensorCards === 'function') renderSensorCards();
        if (typeof updateChartStructure === 'function') updateChartStructure();
        if (typeof updateStandaloneAlertPanel === 'function') updateStandaloneAlertPanel();
        if (typeof renderSummaryTable === 'function') renderSummaryTable();
        if (typeof updateAlertHistoryDropdown === 'function') updateAlertHistoryDropdown();
        if (typeof updateStatusBarBoardDetails === 'function') updateStatusBarBoardDetails();
        if (typeof loadWeatherInfo === 'function') {
            setTimeout(loadWeatherInfo, 500);
        }
        setTimeout(() => {
            if (document.getElementById('cleanupModal')?.style.display === 'flex') {
                renderCleanupTable();
            }
        }, 300);
    } catch (error) {
        console.error("❌ executeSelectedCleanup error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🗑️ ลบที่เลือก';
        }
    }
};

function addCleanupButtonToDeviceManager() {
    const boardSection = document.getElementById('boardSection');
    if (boardSection) {
        const existingBtn = boardSection.querySelector('.cleanup-manager-btn');
        if (!existingBtn) {
            const header = boardSection.querySelector('h3');
            if (header) {
                const btn = document.createElement('button');
                btn.className = 'cleanup-manager-btn';
                btn.textContent = '🧹 จัดการความสะอาด';
                btn.style.cssText = `
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 0.8rem;
                    margin-left: 12px;
                    transition: 0.2s;
                `;
                btn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
                btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
                btn.onclick = function() { window.openCleanupManager(); };
                header.appendChild(btn);
            }
        }
    }
}

function initCleanupManager() {
    console.log("🧹 Cleanup Manager พร้อมทำงาน");
    const adminControls = document.getElementById('adminControls');
    if (adminControls) {
        const existingBtn = adminControls.querySelector('.cleanup-admin-btn');
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.className = 'cleanup-admin-btn';
            btn.textContent = '🧹 จัดการความสะอาด (Cleanup)';
            btn.style.cssText = `
                width: 100%;
                text-align: left;
                padding: 14px 20px;
                border-radius: 12px;
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                color: white;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 1rem;
                transition: 0.2s;
            `;
            btn.onmouseover = function() { this.style.opacity = '0.9'; };
            btn.onmouseout = function() { this.style.opacity = '1'; };
            btn.onclick = function() { window.openCleanupManager(); };
            adminControls.appendChild(btn);
        }
    }
}

// ============================================================
//  33. UTILITY FUNCTIONS
// ============================================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatThaiDateTime(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

function getRSSIStatusText(rssi) {
    if (rssi > -50) return 'ดีมาก 📶📶📶📶📶';
    if (rssi > -60) return 'ดี 📶📶📶📶';
    if (rssi > -70) return 'ปานกลาง 📶📶📶';
    if (rssi > -80) return 'อ่อน 📶📶';
    if (rssi > -90) return 'อ่อนมาก 📶';
    return 'ไม่เสถียร ❌';
}

function getSignalBarsHTML(rssi) {
    const bars = rssi > -50 ? 5 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : rssi > -90 ? 1 : 0;
    let html = '';
    for (let i = 0; i < 5; i++) {
        const isActive = i < bars;
        html += `<span style="color: ${isActive ? '#4ade80' : '#334155'}; font-size: 1.1rem;">${isActive ? '▮' : '▯'}</span>`;
    }
    return html;
}

function formatUptime(since) {
    if (!since) return '-';
    const sinceTime = typeof since === 'string' ? new Date(since).getTime() : since;
    if (isNaN(sinceTime) || sinceTime === 0) return '-';
    const diffMs = Date.now() - sinceTime;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0) return `${diffDay} วัน ${diffHour % 24} ชม.`;
    if (diffHour > 0) return `${diffHour} ชม. ${diffMin % 60} นาที`;
    if (diffMin > 0) return `${diffMin} นาที`;
    return `${diffSec} วินาที`;
}

function getTimestampMs(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return new Date(value).getTime();
    return 0;
}

function calculateWaterLevel(rawDistance, installHeight) {
    if (rawDistance === undefined || rawDistance === null || isNaN(rawDistance)) return 0;
    if (installHeight === undefined || installHeight === null || isNaN(installHeight)) return rawDistance;
    let waterLevel = installHeight - rawDistance;
    if (waterLevel < 0) waterLevel = 0;
    return waterLevel;
}

// ============================================================
//  34. SENSOR INIT
// ============================================================
function initAutoLogging() { startAutoLoggingFromConfig(); }
function renderLevelConfigInline() {}
function toggleLevelMode() {}

function initSensorModule() {
    console.log("🚀 Sensors Module เริ่มทำงาน (เวอร์ชัน 3.1 - แก้ไขข้อความค้าง + อัปเดตบอร์ด)");
    applyDisabledCardStyles();
    updateAlertHistoryDropdown();
    startSensorStatusMonitor();
    initCustomTypeFields();
    initChart();
    renderSensorModeSelector();
    initCleanupManager();
    const eventModeCheckbox = document.getElementById('eventModeEnabled');
    if (eventModeCheckbox) {
        eventModeCheckbox.addEventListener('change', function() {
            const settings = document.getElementById('eventSettings');
            if (settings) {
                settings.style.display = this.checked ? 'block' : 'none';
            }
        });
    }
    renderLevelConfigInline(null);
    toggleLevelMode();
    setTimeout(() => {
        initTemplateSelector();
        renderTemplateSelector();
    }, 500);
    setTimeout(() => {
        updateStatusBarBoardDetails();
        loadProfileList();
        loadWeatherInfo();
        setTimeout(addHistoryButtonsToSensorCards, 500);
    }, 2000);
}

// ============================================================
//  35. ADD HISTORY BUTTONS TO SENSOR CARDS - ✅ FIXED
// ============================================================
function addHistoryButtonsToSensorCards() {
    const cards = document.querySelectorAll('.sensor-card');
    cards.forEach(card => {
        // ✅ ตรวจสอบว่ามีปุ่มอยู่แล้วหรือไม่ (ป้องกันการซ้อน)
        if (card.querySelector('.history-chart-btn')) {
            return;
        }
        
        const titleDiv = card.querySelector('.sensor-title');
        if (titleDiv) {
            const btn = document.createElement('button');
            btn.className = 'history-chart-btn';
            btn.innerHTML = '📊 ประวัติ';
            btn.style.cssText = `
                background: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                border: 1px solid #3b82f6;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 0.6rem;
                cursor: pointer;
                margin-left: 8px;
                transition: 0.2s;
                pointer-events: auto;
            `;
            btn.onmouseover = function() {
                this.style.background = 'rgba(59, 130, 246, 0.4)';
            };
            btn.onmouseout = function() {
                this.style.background = 'rgba(59, 130, 246, 0.2)';
            };
            
            const cardId = card.id;
            if (cardId && cardId.startsWith('card_')) {
                const deviceId = cardId.replace('card_', '');
                btn.onclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log(`📊 คลิกปุ่มประวัติ: ${deviceId}`);
                    if (typeof openHistoryChartForDevice === 'function') {
                        openHistoryChartForDevice(deviceId);
                    } else {
                        console.warn("⚠️ openHistoryChartForDevice ไม่พร้อม");
                    }
                };
            }
            titleDiv.appendChild(btn);
        }
    });
}

// ✅ Export ให้ global
window.addHistoryButtonsToSensorCards = addHistoryButtonsToSensorCards;
// ============================================================
//  36. EDIT BOARD NAME
// ============================================================
// แทนที่ฟังก์ชัน editBoardName ทั้งหมด (ประมาณบรรทัดที่ 2100)
window.editBoardName = async function(boardId) {
    if (!boardId) {
        alert("❌ ไม่พบ ID บอร์ด");
        return;
    }
    
    const config = deviceConfigs[boardId];
    if (!config || config.type !== 'board') {
        alert(`❌ ไม่พบบอร์ด "${boardId}" ในระบบ`);
        return;
    }

    const oldName = config.name || boardId;
    const newName = prompt(`✏️ แก้ไขชื่อบอร์ด (ID: ${boardId}):`, oldName);

    if (newName === null) {
        return;
    }

    if (newName.trim() === "") {
        alert("⚠️ ชื่อบอร์ดไม่สามารถเว้นว่างได้");
        return;
    }

    if (newName.trim() === oldName) {
        return;
    }

    try {
        // 🔥 สำคัญ: อัปเดตเฉพาะฟิลด์ name
        await window.update(window.ref(window.db, `device_configs/${boardId}`), {
            name: newName.trim(),
            updatedAt: new Date().toISOString()
        });
        
        // ✅ อัปเดตในหน่วยความจำ
        if (deviceConfigs[boardId]) {
            deviceConfigs[boardId].name = newName.trim();
            deviceConfigs[boardId].updatedAt = new Date().toISOString();
        }
        
        alert(`✅ เปลี่ยนชื่อบอร์ด "${boardId}" เป็น "${newName.trim()}" สำเร็จ`);
        
        // ✅ รีเฟรช UI
        renderBoardTable();
        renderDeviceTable();
        renderSensorCards();
        updateStatusBarBoardDetails();
        populateBoardSelector();
        
    } catch (e) {
        console.error("❌ editBoardName error:", e);
        alert("❌ เปลี่ยนชื่อไม่สำเร็จ: " + e.message);
    }
};
// ============================================================
//  WEATHER CARD FUNCTIONS - เพิ่มเข้าไปใน sensors.js
// ============================================================

// ============================================================
//  RENDER WEATHER CARD
// ============================================================
function renderWeatherCard(boardId, boardName, config, data) {
    const container = document.getElementById('weatherCardsContainer');
    if (!container) return;
    
    const f = config.weather_config?.fields || {};
    const boardConfig = deviceConfigs[boardId];
    const isBoardOnline = boardConfig?.status === 'online';
    const onlineStatus = isBoardOnline ? '🟢' : '🔴';
    const locationName = config.weather_config?.locationName || 'ไม่ระบุ';
    
    // ✅ หัวข้อสภาพอากาศพร้อมชื่อสถานที่
    const weatherTitle = `🌤️ สภาพอากาศ (${locationName}):`;
    
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
                <!-- <div class="board-location" style="font-size: 0.6rem; color: #64748b;">📍 ${escapeHtml(locationName)}</div> -->
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
            
            <!-- ✅ แสดงหัวข้อสภาพอากาศพร้อมชื่อสถานที่ -->
            <div class="weather-title-text" style="margin-top: 8px; font-size: 0.7rem; color: #60a5fa; font-weight: bold; border-top: 1px solid #334155; padding-top: 8px;">
                ${weatherTitle}
            </div>
            
            <div class="weather-fields" style="margin-top: 4px; font-size: 0.7rem; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; padding-bottom: 4px;">
                ${f.temp ? `<div>🌡️ อุณหภูมิ: ${data.main.temp.toFixed(1)}°C</div>` : ''}
                ${f.humidity ? `<div>💧 ความชื้น: ${data.main.humidity}%</div>` : ''}
                ${f.wind ? `<div>🌬️ ลม: ${data.wind.speed.toFixed(2)} m/s</div>` : ''}
                ${f.pressure ? `<div>⏲️ ความกดอากาศ: ${data.main.pressure} hPa</div>` : ''}
                ${!f.temp && !f.humidity && !f.wind && !f.pressure ? 
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
//  UPDATE WEATHER CARD CONTENT
// ============================================================
function updateWeatherCardContent(card, boardId, config, data) {
    if (!card || !data) return;
    
    const boardConfig = deviceConfigs[boardId];
    const isBoardOnline = boardConfig?.status === 'online';
    const locationName = config.weather_config?.locationName || 'ไม่ระบุ';
    const weatherTitle = `🌤️ สภาพอากาศ (${locationName}):`;
    
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
        

        
        // ✅ อัปเดตหัวข้อสภาพอากาศ
        const titleEl = card.querySelector('.weather-title-text');
        if (titleEl) {
            titleEl.textContent = weatherTitle;
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
        
        // อัปเดตฟิลด์ต่างๆ
        const f = config.weather_config?.fields || {};
        const fieldsEl = card.querySelector('.weather-fields');
        if (fieldsEl) {
            let html = '';
            if (f.temp) html += `<div>🌡️ อุณหภูมิ: ${data.main.temp.toFixed(1)}°C</div>`;
            if (f.humidity) html += `<div>💧 ความชื้น: ${data.main.humidity}%</div>`;
            if (f.wind) html += `<div>🌬️ ลม: ${data.wind.speed.toFixed(2)} m/s</div>`;
            if (f.pressure) html += `<div>⏲️ ความกดอากาศ: ${data.main.pressure} hPa</div>`;
            if (!f.temp && !f.humidity && !f.wind && !f.pressure) {
                html = `<div style="grid-column: span 2; color: #64748b; font-style: italic;">ไม่มีฟิลด์ที่เลือกแสดง</div>`;
            }
            fieldsEl.innerHTML = html;
        }
        
        // อัปเดตเวลาอัปเดต
        const timeEl = card.querySelector('.weather-update-time');
        if (timeEl) {
            timeEl.textContent = `อัปเดต: ${new Date().toLocaleTimeString('th-TH')}`;
        }
        
        // อัปเดตสถานะการเชื่อมต่อบอร์ด
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
//  RENDER WEATHER CARD ERROR
// ============================================================
function renderWeatherCardError(boardId, boardName, config) {
    const container = document.getElementById('weatherCardsContainer');
    if (!container) return;
    
    const locationName = config?.locationName || 'ไม่ระบุ';
    
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
                <!-- <div class="board-location" style="font-size: 0.6rem; color: #64748b;">📍 ${escapeHtml(locationName)}</div> -->
            </div>
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0;">
                <div style="font-size: 2rem;">⚠️</div>
                <div>
                    <div class="weather-temp" style="font-size: 0.9rem; color: #f87171;">ไม่สามารถโหลดข้อมูล</div>
                    <div class="weather-desc" style="font-size: 0.65rem; color: #64748b;">กรุณาตรวจสอบการเชื่อมต่อ</div>
                </div>
            </div>
            <div class="weather-title-text" style="margin-top: 8px; font-size: 0.7rem; color: #f87171; font-weight: bold; border-top: 1px solid #334155; padding-top: 8px;">
                🌤️ สภาพอากาศ (${locationName}):
            </div>
            <div class="weather-fields" style="margin-top: 4px; font-size: 0.7rem; color: #64748b; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; padding-bottom: 4px;">
                <div style="grid-column: span 2; font-style: italic;">ไม่สามารถโหลดข้อมูลสภาพอากาศ</div>
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
//  UPDATE WEATHER CARD ERROR
// ============================================================
function updateWeatherCardError(card, boardId, config) {
    if (!card) return;
    
    try {
        const locationName = config?.weather_config?.locationName || 'ไม่ระบุ';
        
        const statusEl = card.querySelector('.board-status');
        if (statusEl) {
            statusEl.textContent = '🔴';
            statusEl.style.color = '#f87171';
        }
        card.style.borderLeftColor = '#f87171';
        
        const tempEl = card.querySelector('.weather-temp');
        if (tempEl) {
            tempEl.textContent = '--';
            tempEl.style.color = '#f87171';
        }
        
        const descEl = card.querySelector('.weather-desc');
        if (descEl) {
            descEl.textContent = 'ไม่สามารถโหลดข้อมูล';
            descEl.style.color = '#64748b';
        }
        
        const titleEl = card.querySelector('.weather-title-text');
        if (titleEl) {
            titleEl.textContent = `🌤️ สภาพอากาศ (${locationName}):`;
            titleEl.style.color = '#f87171';
        }
        
        const fieldsEl = card.querySelector('.weather-fields');
        if (fieldsEl) {
            fieldsEl.innerHTML = `<div style="grid-column: span 2; color: #64748b; font-style: italic;">ไม่สามารถโหลดข้อมูลสภาพอากาศ</div>`;
        }
        
        const boardStatusEl = card.querySelector('.board-connection-status');
        if (boardStatusEl) {
            boardStatusEl.textContent = '🔴 ออฟไลน์';
            boardStatusEl.style.color = '#f87171';
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
//  37. GPS WEATHER SETTINGS - PER BOARD
// ============================================================

// 1. ฟังก์ชันขอพิกัด GPS จากเบราว์เซอร์/มือถือ
window.useGPSForBoardWeather = function(event) {
    const btn = event?.currentTarget || document.querySelector('button[onclick*="useGPSForBoardWeather"]');
    const originalText = btn ? btn.innerHTML : '📍 ใช้ตำแหน่งปัจจุบันจาก GPS (มือถือ)';
    
    if (!navigator.geolocation) {
        alert("❌ เบราว์เซอร์ของคุณไม่รองรับ GPS");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ กำลังจับสัญญาณ GPS...";
        btn.style.opacity = "0.7";
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            console.log(`📍 GPS ได้รับพิกัด: ${lat}, ${lon}`);
            
            // ✅ แสดงข้อความแจ้งเตือน
            const resultsDiv = document.getElementById('boardLocationResults');
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div style="color:#60a5fa; padding:10px;">✅ ได้รับพิกัดแล้ว กำลังค้นหาชื่อสถานที่...</div>`;
                resultsDiv.style.display = "block";
            }
            
            // ค้นหาชื่อสถานที่จากพิกัด (Reverse Geocoding)
            await searchBoardLocationByCoords(lat, lon);
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.style.opacity = "1";
            }
        },
        (error) => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.style.opacity = "1";
            }
            let msg = "ไม่สามารถระบุตำแหน่งได้";
            if (error.code === 1) msg = "กรุณาอนุญาตให้เข้าถึง GPS (Location)";
            if (error.code === 2) msg = "สัญญาณ GPS ไม่เสถียร กรุณาลองใหม่";
            if (error.code === 3) msg = "หมดเวลาการรับสัญญาณ GPS";
            alert(`❌ GPS Error: ${msg}`);
            console.warn("⚠️ GPS Error:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
};

// 2. ฟังก์ชันค้นหาชื่อสถานที่จากพิกัด (Reverse Geocoding)
async function searchBoardLocationByCoords(lat, lon) {
    const resultsDiv = document.getElementById('boardLocationResults');
    if (!resultsDiv) {
        console.warn("⚠️ ไม่พบ boardLocationResults");
        return;
    }
    
    resultsDiv.innerHTML = "<div style='color:#60a5fa; padding:10px;'>⏳ กำลังระบุสถานที่ใกล้เคียง...</div>";
    resultsDiv.style.display = "block";

    try {
        // ใช้ API แปลงพิกัดเป็นชื่อสถานที่
        const API_KEY = "dd879305b1074776a9c228f0b27798a3";
        const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${API_KEY}`;
        
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = `
                <div style='color:#ef4444; padding:10px;'>
                    ❌ ไม่พบชื่อสถานที่ในพิกัดนี้ 
                    <br><span style="font-size:0.7rem; color:#64748b;">📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}</span>
                    <br><button onclick="saveBoardWeatherLocation('ตำแหน่ง GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})', ${lat}, ${lon})" 
                            style="margin-top:8px; background:#3b82f6; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">
                        💾 บันทึกพิกัดนี้
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <p style="color: #059669; font-size: 0.8rem; margin-bottom: 8px; padding:0 10px; font-weight:bold;">
                📍 พบสถานที่ใกล้เคียง (จาก GPS):
            </p>
            <div style="max-height: 200px; overflow-y: auto;">
        `;
        
        data.forEach(loc => {
            const displayName = `${loc.name}${loc.state ? ', ' + loc.state : ''}${loc.country ? ' (' + loc.country + ')' : ''}`;
            html += `
                <button onclick="saveBoardWeatherLocation('${displayName.replace(/'/g, "\\'")}', ${lat}, ${lon})" 
                        style="display:block; width:100%; text-align:left; padding:12px; margin-bottom:5px; 
                               background:#f0fdf4; color:#065f46; border:1px solid #bbf7d0; border-radius:8px; 
                               cursor:pointer; transition:0.2s;"
                        onmouseover="this.style.background='#d1fae5'; this.style.transform='translateX(4px)'"
                        onmouseout="this.style.background='#f0fdf4'; this.style.transform='translateX(0)'">
                    <span style="display:block; font-weight:bold;">🏡 ${displayName}</span>
                    <span style="font-size:0.7rem; color:#059669;">
                        📍 พิกัด: ${lat.toFixed(4)}, ${lon.toFixed(4)}
                    </span>
                    <span style="display:block; font-size:0.7rem; color:#10b981; margin-top:4px;">
                        ✨ คลิกเพื่อบันทึกลงบอร์ดที่เลือก
                    </span>
                </button>`;
        });
        html += `</div>`;
        resultsDiv.innerHTML = html;
        
    } catch (e) {
        console.error("❌ Reverse Geocoding error:", e);
        resultsDiv.innerHTML = `
            <div style='color:#ef4444; padding:10px;'>
                ❌ เกิดข้อผิดพลาดในการดึงชื่อสถานที่: ${e.message}
                <br><button onclick="saveBoardWeatherLocation('ตำแหน่ง GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})', ${lat}, ${lon})" 
                        style="margin-top:8px; background:#3b82f6; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">
                    💾 บันทึกพิกัดนี้แทน
                </button>
            </div>
        `;
    }
}

// ✅ Export ให้ global
window.useGPSForBoardWeather = useGPSForBoardWeather;
window.searchBoardLocationByCoords = searchBoardLocationByCoords;

console.log("✅ เพิ่มฟังก์ชัน GPS สำหรับ Board Weather แล้ว");
// ============================================================
//  INITIALIZATION
// ============================================================
console.log("✅ sensors.js โหลดเรียบร้อย (เวอร์ชัน 3.2 - Fixed Labels)");