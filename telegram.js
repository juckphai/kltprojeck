// ============================================================
//  KLT Smart Farm Station - Telegram Module
//  Version: 2.6 (Per-Board Weather Support)
// ============================================================

// ============================================================
//  1. GET LOCATION INFO
// ============================================================
function getLocationInfo() {
    const weatherConfig = window._weatherConfig || {};
    const locationData = {
        name: weatherConfig.locationName || 'ไม่ระบุสถานที่',
        lat: weatherConfig.lat || null,
        lon: weatherConfig.lon || null,
        hasLocation: !!(weatherConfig.locationName && weatherConfig.lat && weatherConfig.lon)
    };
    
    // พยายามดึงพิกัดจาก GPS ของเบราว์เซอร์ (ถ้าอนุญาต)
    if (!locationData.hasLocation && navigator.geolocation) {
        // ใช้ cached location ถ้ามี
        const cached = sessionStorage.getItem('gps_location');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                locationData.lat = parsed.lat;
                locationData.lon = parsed.lon;
                locationData.name = parsed.name || 'ตำแหน่งปัจจุบัน (GPS)';
                locationData.hasLocation = true;
            } catch(e) {}
        }
    }
    
    return locationData;
}

// ฟังก์ชันบันทึก GPS Location
// ============================================================
//  GPS FUNCTIONS FOR TELEGRAM REPORTS
// ============================================================

// ฟังก์ชันบันทึก GPS Location (ปรับปรุง)
window.saveGPSLocation = function() {
    if (!navigator.geolocation) {
        alert("❌ เบราว์เซอร์นี้ไม่รองรับ GPS");
        return;
    }
    
    const btn = document.querySelector('button[onclick*="saveGPSLocation"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ กำลังจับสัญญาณ GPS...";
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                name: 'ตำแหน่งปัจจุบัน (GPS)',
                timestamp: new Date().toISOString()
            };
            sessionStorage.setItem('gps_location', JSON.stringify(location));
            alert(`✅ บันทึกพิกัด GPS สำเร็จ:\n📍 ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`);
            
            // อัปเดต UI
            const locDisplay = document.getElementById('currentWeatherLoc');
            if (locDisplay) {
                locDisplay.innerHTML = `
                    <span style="color:#2e7d32; font-weight:bold;">📍 ${location.name}</span>
                    <br><span style="font-size:0.7rem; color:#666;">(${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})</span>
                `;
            }
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "📡 ใช้ตำแหน่งปัจจุบัน (GPS)";
            }
        },
        (error) => {
            console.warn("⚠️ GPS Error:", error);
            let msg = "ไม่สามารถระบุตำแหน่งได้";
            if (error.code === 1) msg = "กรุณาอนุญาตให้เข้าถึง GPS (Location)";
            alert(`❌ GPS Error: ${msg}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "📡 ใช้ตำแหน่งปัจจุบัน (GPS)";
            }
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// ============================================================
//  2. FORMAT TELEGRAM MESSAGE (UPDATED - with Location & GPS)
// ============================================================
function formatTelegramMessage(body, sender = "ระบบแจ้งเตือน", title = "รายงานจากระบบ") {
    const projectTitle = document.getElementById('projectTitle')?.textContent || "Smart Farm Station";
    const now = new Date().toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    let message = `🏠 <b>สถานี:</b> ${projectTitle}\n`;
    
    // ===== เพิ่มตำแหน่ง (Location) จาก Weather Config และ GPS =====
    const weatherConfig = window._weatherConfig || {};
    const locationInfo = getLocationInfo();
    
    // ใช้ข้อมูลจาก Weather Config ก่อน
    if (weatherConfig.locationName) {
        message += `📍 <b>ตำแหน่ง:</b> ${weatherConfig.locationName}\n`;
        if (weatherConfig.lat && weatherConfig.lon) {
            message += `📍 <b>พิกัด:</b> ${weatherConfig.lat.toFixed(6)}, ${weatherConfig.lon.toFixed(6)}\n`;
        }
    } else if (locationInfo.hasLocation) {
        message += `📍 <b>ตำแหน่ง:</b> ${locationInfo.name}\n`;
        if (locationInfo.lat && locationInfo.lon) {
            message += `📍 <b>พิกัด:</b> ${locationInfo.lat.toFixed(6)}, ${locationInfo.lon.toFixed(6)}\n`;
        }
    }
    
    // ===== เพิ่มข้อมูลบอร์ดที่เชื่อมต่อ =====
    const boardStatus = checkAllBoardsStatus();
    const onlineBoards = Object.values(boardStatus).filter(b => b.isOnline).length;
    const totalBoards = Object.keys(boardStatus).length;
    if (totalBoards > 0) {
        message += `📡 <b>บอร์ดที่เชื่อมต่อ:</b> ${onlineBoards}/${totalBoards} ออนไลน์\n`;
    }
    
    message += `👤 <b>ผู้รายงาน:</b> ${sender}\n` +
               `📅 <b>เวลา:</b> ${now} น.\n` +
               `━━━━━━━━━━━━━━━━━━\n` +
               body;
    
    // ===== เพิ่มข้อมูลสภาพอากาศหลัก (Weather) - ใช้สำหรับอ้างอิง =====
    const weatherData = window.weatherData;
    if (weatherConfig.attachToReport === true && weatherData) {
        let weatherBody = `\n━━━━━━━━━━━━━━━━━━\n🌤️ <b>สภาพอากาศ (${weatherData.name || 'ปัจจุบัน'}):</b>\n`;
        const f = weatherConfig.fields || {};
        let hasContent = false;
        if (f.temp) { weatherBody += `🌡️ อุณหภูมิ: ${weatherData.main.temp}°C\n`; hasContent = true; }
        if (f.humidity) { weatherBody += `💧 ความชื้น: ${weatherData.main.humidity}%\n`; hasContent = true; }
        if (f.description) { weatherBody += `☁️ สภาพ: ${weatherData.weather[0].description}\n`; hasContent = true; }
        if (f.wind) { weatherBody += `🌬️ ลม: ${weatherData.wind.speed} m/s\n`; hasContent = true; }
        if (f.pressure) { weatherBody += `⏲️ ความกดอากาศ: ${weatherData.main.pressure} hPa\n`; hasContent = true; }
        if (hasContent) {
            message += weatherBody;
        }
    }
    
    return message;
}

// ============================================================
//  3. GENERATE REPORTS
// ============================================================
async function generateReportContent(type) {
    if (type === 'status') {
        return await generateStatusReport();
    }
    if (type === 'system') {
        return await generateSystemReport();
    }
    if (type === 'summary') {
        return await generateSummaryReport();
    }
    if (type === 'full') {
        const statusBody = await generateStatusReport();
        const systemBody = await generateSystemReport();
        return statusBody + '\n━━━━━━━━━━━━━━━━━━\n' + systemBody;
    }
    return await generateStatusReport();
}

// ============================================================
//  4. STATUS REPORT (UPDATED - PER-BOARD WEATHER) 
//   แก้ไข: เอาส่วนแสดงสภาพอากาศแบบบรรทัดเดียวในแต่ละบอร์ดออก
// ============================================================
async function generateStatusReport() {
    let body = "📊 <b>รายละเอียดการวัดแยกตามพื้นที่</b>\n\n";
    
    // กลุ่มเซนเซอร์ตามบอร์ด
    const boardGroups = {};
    let unknownSensors = [];
    
    Object.entries(deviceConfigs).forEach(([id, config]) => {
        if (config.type === 'board' || !config.enabled) return;
        
        // ข้ามเซนเซอร์อัตโนมัติ
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) return;
        
        const bId = config.boardId || 'unknown';
        if (!boardGroups[bId]) boardGroups[bId] = [];
        boardGroups[bId].push({id, config});
    });
    
    // ถ้าไม่มีเซนเซอร์
    if (Object.keys(boardGroups).length === 0) {
        body += "📭 <i>ไม่มีอุปกรณ์ที่เปิดใช้งาน</i>";
        return body;
    }
    
    // วนลูปแต่ละบอร์ด
    for (const [boardId, sensors] of Object.entries(boardGroups)) {
        const boardName = deviceConfigs[boardId]?.name || boardId;
        const boardConfig = deviceConfigs[boardId];
        const isBoardOnline = boardConfig?.status === 'online';
        const onlineIcon = isBoardOnline ? '🟢' : '🔴';
        
        body += `🏢 <b>พื้นที่/บอร์ด: ${boardName}</b> ${onlineIcon}\n`;
        body += `━━━━━━━━━━━━━━━━━━\n`;
        
        // ===== 🔴 เอาส่วนนี้ (แสดงสภาพอากาศแบบบรรทัดเดียว) ออก 🔴 =====
        // ไม่แสดงสภาพอากาศในส่วนนี้แล้ว
        
        body += `------------------\n`;
        
        // แสดงข้อมูลเซนเซอร์ในบอร์ดนี้
        sensors.forEach(s => {
            let val = currentSensorValues[s.id];
            let displayVal = val !== undefined && val !== null ? val : '--';
            let unit = s.config.unit || '';
            
            // จัดการ Ultrasonic
            if (s.config.type === 'ultrasonic' && s.config.installHeight && val !== undefined && val !== null) {
                const raw = parseFloat(val);
                const installHeight = parseFloat(s.config.installHeight);
                if (!isNaN(raw) && !isNaN(installHeight)) {
                    const waterLevel = Math.max(0, installHeight - raw);
                    displayVal = waterLevel.toFixed(2);
                }
            }
            
            // จัดการ Soil
            if (s.config.type === 'soil' && val !== undefined && val !== null) {
                const soilVal = parseFloat(val);
                if (!isNaN(soilVal)) {
                    displayVal = soilVal.toFixed(2);
                }
            }
            
            // จัดการ Temperature
            if (s.config.type === 'temp' && val !== undefined && val !== null) {
                const tempVal = parseFloat(val);
                if (!isNaN(tempVal)) {
                    displayVal = tempVal.toFixed(2);
                }
            }
            
            // จัดการ Rain
            if (s.config.type === 'rain' && val !== undefined && val !== null) {
                const rainVal = parseFloat(val);
                if (!isNaN(rainVal)) {
                    displayVal = rainVal.toFixed(1);
                }
            }
            
            // จัดการ pH
            if (s.config.type === 'ph' && val !== undefined && val !== null) {
                const phVal = parseFloat(val);
                if (!isNaN(phVal)) {
                    displayVal = phVal.toFixed(1);
                }
            }
            
            const iconMap = { ultrasonic: '🌊', soil: '🌱', rain: '🌧️', ph: '🧪', temp: '🌡️' };
            const icon = iconMap[s.config.type] || '📌';
            
            // หาสถานะระดับ
            let numValue = parseFloat(displayVal);
            let levelLabel = "ไม่ได้ตั้งค่า";
            if (!isNaN(numValue)) {
                const levelResult = evaluateLevelWithCustom(numValue, s.config.levels);
                if (levelResult && levelResult.label !== 'ไม่ได้ตั้งค่า') {
                    levelLabel = levelResult.label;
                }
            }
            
            // เพิ่มโหมดการทำงาน
            const modeLabel = s.config.sensorMode === 'vertical' ? 'แนวตั้ง' : 
                             (s.config.sensorMode === 'horizontal' ? 'แนวนอน' : '');
            
            body += `🔹 ${icon} <b>${s.config.name}</b> (${s.id}): <b>${displayVal}</b> ${unit}\n`;
            body += `   📊 สถานะ: ${levelLabel}`;
            if (modeLabel) {
                body += ` | 📐 ${modeLabel}`;
            }
            body += `\n`;
            
            // เพิ่มข้อมูลเพิ่มเติมสำหรับ Ultrasonic
            if (s.config.type === 'ultrasonic' && s.config.installHeight && val !== undefined && val !== null) {
                const raw = parseFloat(val);
                const installHeight = parseFloat(s.config.installHeight);
                if (!isNaN(raw) && !isNaN(installHeight)) {
                    const waterLevel = Math.max(0, installHeight - raw);
                    const bankHeight = s.config.bankHeight ? parseFloat(s.config.bankHeight) : null;
                    
                    body += `   📏 ระยะที่วัดได้: ${raw.toFixed(2)} ${unit}\n`;
                    body += `   🌊 ระดับน้ำจริง: ${waterLevel.toFixed(2)} ${unit}\n`;
                    
                    if (bankHeight && bankHeight > 0) {
                        const percent = (waterLevel / bankHeight) * 100;
                        let statusText = '';
                        if (percent >= 100) {
                            statusText = '🌊 น้ำล้นตลิ่ง! (วิกฤต)';
                        } else if (percent >= 80) {
                            statusText = '📈 ใกล้ตลิ่งมาก';
                        } else if (percent >= 60) {
                            statusText = '📈 ระดับน้ำสูง';
                        } else if (percent >= 40) {
                            statusText = '📊 ระดับน้ำปานกลาง';
                        } else if (percent >= 20) {
                            statusText = '📉 ระดับน้ำต่ำ';
                        } else {
                            statusText = '📉 ระดับน้ำต่ำมาก';
                        }
                        body += `   📌 ${statusText}\n`;
                        body += `   📊 ${percent.toFixed(0)}% ของตลิ่ง\n`;
                    }
                }
            }
            
            // เพิ่มข้อมูลเพิ่มเติมสำหรับ Soil
            if (s.config.type === 'soil' && !isNaN(parseFloat(displayVal))) {
                const num = parseFloat(displayVal);
                let soilStatus = "";
                if (num < 20) soilStatus = "🌵 แห้งมาก";
                else if (num < 40) soilStatus = "🌿 แห้ง";
                else if (num < 60) soilStatus = "🌱 พอดี";
                else if (num < 80) soilStatus = "🌳 ชื้น";
                else soilStatus = "💧 ชื้นมาก";
                body += `   🌱 สภาพดิน: ${soilStatus}\n`;
            }
            
            // เพิ่มข้อมูลเพิ่มเติมสำหรับ Temperature
            if (s.config.type === 'temp' && !isNaN(parseFloat(displayVal))) {
                const num = parseFloat(displayVal);
                let tempStatus = "";
                if (num < 10) tempStatus = "❄️ หนาวจัด";
                else if (num < 20) tempStatus = "🥶 หนาว";
                else if (num < 30) tempStatus = "😊 ปกติ";
                else if (num < 40) tempStatus = "🥵 ร้อน";
                else tempStatus = "🔥 ร้อนจัด";
                body += `   🌡️ สภาพอากาศ: ${tempStatus}\n`;
            }
            
            // เพิ่มข้อมูลเพิ่มเติมสำหรับ Rain
            if (s.config.type === 'rain' && !isNaN(parseFloat(displayVal))) {
                const num = parseFloat(displayVal);
                let rainStatus = "";
                if (num < 1) rainStatus = "☀️ ไม่มีฝน";
                else if (num < 5) rainStatus = "🌤️ ฝนเล็กน้อย";
                else if (num < 20) rainStatus = "🌧️ ฝนปานกลาง";
                else if (num < 50) rainStatus = "🌧️ ฝนหนัก";
                else rainStatus = "⛈️ ฝนหนักมาก";
                body += `   🌧️ สถานะฝน: ${rainStatus}\n`;
            }
            
            // เพิ่มข้อมูลเพิ่มเติมสำหรับ pH
            if (s.config.type === 'ph' && !isNaN(parseFloat(displayVal))) {
                const num = parseFloat(displayVal);
                let phStatus = "";
                if (num < 4) phStatus = "🧪 กรดจัด";
                else if (num < 6) phStatus = "🧪 กรดอ่อน";
                else if (num <= 8) phStatus = "🧪 เป็นกลาง";
                else if (num <= 10) phStatus = "🧪 ด่างอ่อน";
                else phStatus = "🧪 ด่างจัด";
                body += `   🧪 สถานะ pH: ${phStatus}\n`;
            }
            
            // แสดงเวลาอัปเดตล่าสุด
            if (s.config.lastSeen) {
                const lastSeenTime = new Date(s.config.lastSeen);
                if (!isNaN(lastSeenTime.getTime())) {
                    body += `   🕐 อัปเดตล่าสุด: ${lastSeenTime.toLocaleString('th-TH')}\n`;
                }
            }
            body += `\n`;
        });
    }
    
    // ===== เพิ่มสรุปท้าย =====
    body += `━━━━━━━━━━━━━━━━━━\n`;
    
    // สรุปจำนวนอุปกรณ์แยกตามประเภท
    const sensorTypeCount = {};
    Object.entries(deviceConfigs).forEach(([id, config]) => {
        if (config.type === 'board' || !config.enabled) return;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) return;
        const type = config.type || 'other';
        sensorTypeCount[type] = (sensorTypeCount[type] || 0) + 1;
    });
    
    const typeLabels = {
        'ultrasonic': '🌊 Ultrasonic',
        'soil': '🌱 Soil',
        'rain': '🌧️ Rain',
        'ph': '🧪 pH',
        'temp': '🌡️ Temperature'
    };
    
    let totalSensors = 0;
    for (const count of Object.values(sensorTypeCount)) {
        totalSensors += count;
    }
    
    body += `📊 <b>สรุป:</b> ${Object.keys(boardGroups).length} พื้นที่, ${totalSensors} อุปกรณ์\n`;
    
    // แสดงสรุปแยกตามประเภท
    if (Object.keys(sensorTypeCount).length > 0) {
        body += `📋 <b>แยกตามประเภท:</b>\n`;
        for (const [type, count] of Object.entries(sensorTypeCount)) {
            const label = typeLabels[type] || type;
            body += `   • ${label}: ${count} ตัว\n`;
        }
    }
    
    // แสดงสรุปโหมดการทำงาน
    let verticalCount = 0;
    let horizontalCount = 0;
    Object.entries(deviceConfigs).forEach(([id, config]) => {
        if (config.type === 'board' || !config.enabled) return;
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        if (isAutoGenerated) return;
        if (config.sensorMode === 'vertical') verticalCount++;
        if (config.sensorMode === 'horizontal') horizontalCount++;
    });
    
    if (verticalCount > 0 || horizontalCount > 0) {
        body += `📐 <b>โหมดการทำงาน:</b>\n`;
        if (verticalCount > 0) body += `   • 📏 แนวตั้ง: ${verticalCount} ตัว\n`;
        if (horizontalCount > 0) body += `   • 📐 แนวนอน: ${horizontalCount} ตัว\n`;
    }
    
    return body;
}
// ============================================================
//  5. SYSTEM REPORT (UPDATED - with Location & Per-Board Weather)
//   แก้ไข: เอาส่วนแสดงตำแหน่งหลัก และสภาพอากาศในแต่ละบอร์ดออก
// ============================================================
async function generateSystemReport() {
    let body = "⚙️ <b>รายงานสถานะอุปกรณ์และระบบ</b>\n\n";
    
    // ===== 🔴 เอาส่วนแสดงตำแหน่งหลัก (Location) ออก 🔴 =====
    // ไม่แสดงตำแหน่งที่ตั้งหลักในรายงานระบบแล้ว
    
    // ===== ข้อมูลบอร์ดและสภาพอากาศของแต่ละบอร์ด =====
    body += "📡 <b>ข้อมูลบอร์ด</b>\n";
    const boards = Object.entries(deviceConfigs).filter(([id, config]) => config.type === 'board');
    
    if (boards.length === 0) {
        body += "  • 📭 ไม่มีบอร์ดที่ติดตั้ง\n";
    } else {
        const now = Date.now() + serverTimeOffset;
        let onlineCount = 0;
        let offlineCount = 0;
        
        boards.forEach(([id, config]) => {
            const lastSeen = getTimestampMs(config.lastSeen);
            const isOnline = (now - lastSeen) < 420000;
            if (isOnline) onlineCount++;
            else offlineCount++;
        });
        
        body += `  • บอร์ดทั้งหมด: ${boards.length} ตัว\n`;
        body += `  • 🟢 ออนไลน์: ${onlineCount} ตัว\n`;
        body += `  • 🔴 ออฟไลน์: ${offlineCount} ตัว\n\n`;
        
        // รายละเอียดแต่ละบอร์ด
        body += `  📋 <b>รายละเอียดแต่ละบอร์ด:</b>\n`;
        boards.forEach(([id, config]) => {
            const lastSeen = getTimestampMs(config.lastSeen);
            const isOnline = (now - lastSeen) < 420000;
            const rssi = config.wifi_rssi || 0;
            const statusText = isOnline ? '🟢 ออนไลน์' : '🔴 ออฟไลน์';
            const uptime = isOnline ? formatUptime(config.onlineSince || config.lastSeen) : '-';
            const lastSeenDisplay = lastSeen > 0 ? new Date(lastSeen).toLocaleString('th-TH') : 'ไม่ทราบ';
            
            body += `    • <b>${config.name || id}</b>: ${statusText} | 📶 ${rssi} dBm | ⏳ ${uptime}\n`;
            
            // ===== 🔴 เอาส่วนแสดงสภาพอากาศของบอร์ดนี้ (🌤️ สภาพอากาศ: ...) ออก 🔴 =====
            // ไม่แสดงสภาพอากาศในส่วนนี้แล้ว
            
            if (!isOnline) {
                body += `      📅 ออฟไลน์ตั้งแต่: ${lastSeenDisplay}\n`;
            }
        });
    }
    
    body += `\n━━━━━━━━━━━━━━━━━━\n`;
    
    // ===== ข้อมูลเซนเซอร์ =====
    body += "🌱 <b>ข้อมูลเซนเซอร์</b>\n";
    const sensors = Object.entries(deviceConfigs).filter(([id, config]) => config.type !== 'board');
    const enabledSensors = sensors.filter(([id, config]) => config.enabled !== false);
    const disabledSensors = sensors.filter(([id, config]) => config.enabled === false);
    
    // ข้ามเซนเซอร์อัตโนมัติ
    const manualSensors = enabledSensors.filter(([id, config]) => {
        const isAutoGenerated = !config.name || 
                               config.name === `เซนเซอร์ (${id})` || 
                               config.name === '' ||
                               config.name === id;
        return !isAutoGenerated;
    });
    
    body += `  • เซนเซอร์ทั้งหมด: ${sensors.length} ตัว\n`;
    body += `  • ✅ เปิดใช้งาน: ${manualSensors.length} ตัว\n`;
    body += `  • ❌ ปิดใช้งาน: ${disabledSensors.length} ตัว\n`;
    
    // แยกตามประเภท
    const typeCount = {};
    manualSensors.forEach(([id, config]) => {
        const type = config.type || 'other';
        typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const typeLabels = {
        'ultrasonic': '📡 Ultrasonic',
        'soil': '🌱 Soil',
        'rain': '🌧️ Rain',
        'ph': '🧪 pH',
        'temp': '🌡️ Temperature',
        'other': '📝 อื่นๆ'
    };
    body += `\n  📊 <b>แยกตามประเภท:</b>\n`;
    for (const [type, count] of Object.entries(typeCount)) {
        const label = typeLabels[type] || type;
        body += `    • ${label}: ${count} ตัว\n`;
    }
    
    // ===== เพิ่มสรุปโหมดการทำงาน =====
    const verticalCount = manualSensors.filter(([id, config]) => config.sensorMode === 'vertical').length;
    const horizontalCount = manualSensors.filter(([id, config]) => config.sensorMode === 'horizontal').length;
    if (verticalCount > 0 || horizontalCount > 0) {
        body += `\n  📐 <b>โหมดการทำงานของเซนเซอร์:</b>\n`;
        if (verticalCount > 0) body += `    • 📏 แนวตั้ง: ${verticalCount} ตัว\n`;
        if (horizontalCount > 0) body += `    • 📐 แนวนอน: ${horizontalCount} ตัว\n`;
    }
    
    body += `\n━━━━━━━━━━━━━━━━━━\n`;
    
    // ===== สถานะการแจ้งเตือน =====
    body += "🔔 <b>สถานะการแจ้งเตือน</b>\n";
    const alertEnabledSensors = manualSensors.filter(([id, config]) => config.alertEnabled !== false);
    const alertDisabledSensors = manualSensors.filter(([id, config]) => config.alertEnabled === false);
    body += `  • 🔊 เปิดการแจ้งเตือน: ${alertEnabledSensors.length} ตัว\n`;
    body += `  • 🔇 ปิดการแจ้งเตือน: ${alertDisabledSensors.length} ตัว\n`;
    
    const pendingAlerts = manualSensors.filter(([id, config]) => 
        config.alert_count > 0 && config.is_acknowledged !== true
    );
    if (pendingAlerts.length > 0) {
        body += `\n  ⚠️ <b>อุปกรณ์ที่กำลังแจ้งเตือน (รอรับทราบ):</b>\n`;
        pendingAlerts.forEach(([id, config]) => {
            body += `    • ${config.name || id}: แจ้งเตือน ${config.alert_count || 0} ครั้ง\n`;
        });
    } else {
        body += `  ✅ ไม่มีอุปกรณ์ที่กำลังแจ้งเตือน\n`;
    }
    
    body += `\n━━━━━━━━━━━━━━━━━━\n`;
    
    // ===== ข้อมูลระบบ =====
    body += "🛠️ <b>ข้อมูลระบบ</b>\n";
    try {
        const presenceSnap = await window.get(window.ref(window.db, 'online_users'));
        if (presenceSnap.exists()) {
            const users = presenceSnap.val();
            const now = Date.now();
            let onlineUsers = 0;
            Object.keys(users).forEach(u => {
                const lastSeen = new Date(users[u].lastSeen).getTime();
                if (now - lastSeen < 30000) onlineUsers++;
            });
            body += `  • 👤 ผู้ใช้ออนไลน์: ${onlineUsers} คน\n`;
        }
    } catch (e) {
        body += `  • 👤 ผู้ใช้ออนไลน์: ไม่สามารถดึงข้อมูลได้\n`;
    }
    const autoLogStatus = autoLogIntervalId ? '✅ กำลังทำงาน' : '⏸️ หยุดทำงาน';
    body += `  • 📝 Auto-Log: ${autoLogStatus}\n`;
    const muteStatus = globalAlertMuted ? '🔕 ปิดการแจ้งเตือน' : '🔔 แจ้งเตือนปกติ';
    body += `  • 🔔 สถานะ Mute: ${muteStatus}\n`;
    const nowStr = new Date().toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    body += `  • 🕐 เวลาปัจจุบัน: ${nowStr} น.\n`;
    
    return body;
}
// ============================================================
//  6. SUMMARY REPORT (UPDATED - with Location)
//   แก้ไข: เอาส่วนแสดงตำแหน่งที่ตั้งและพิกัดออก
// ============================================================
async function generateSummaryReport() {
    let body = "📈 <b>สรุปข้อมูลเชิงวิเคราะห์ (Analytics)</b>\n\n";
    
    // ===== 🔴 เอาส่วนแสดงตำแหน่งที่ตั้งและพิกัดออก 🔴 =====
    // ไม่แสดงตำแหน่งที่ตั้งในรายงานสรุปแล้ว
    
    if (!window.db) {
        body += "❌ ระบบฐานข้อมูลไม่พร้อม\n";
        return body;
    }
    
    try {
        const historySnap = await window.get(window.ref(window.db, 'sensor_history'));
        if (!historySnap.exists()) {
            body += "📭 ไม่มีข้อมูลประวัติในระบบ\n";
            return body;
        }
        const historyData = historySnap.val();
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        const sensorStats = {};
        const sensorLatest = {};
        let totalLogs = 0;
        let logsIn24h = 0;
        let logsIn7d = 0;
        
        for (const [key, entry] of Object.entries(historyData)) {
            if (!entry || !entry.timestamp) continue;
            totalLogs++;
            const logTime = new Date(entry.timestamp).getTime();
            if (logTime >= oneDayAgo) logsIn24h++;
            if (logTime >= sevenDaysAgo) logsIn7d++;
            if (entry.values) {
                for (const [id, val] of Object.entries(entry.values)) {
                    if (typeof val !== 'number' || isNaN(val)) continue;
                    if (!sensorStats[id]) {
                        sensorStats[id] = {
                            count: 0,
                            sum: 0,
                            min: Infinity,
                            max: -Infinity,
                            values: []
                        };
                    }
                    sensorStats[id].count++;
                    sensorStats[id].sum += val;
                    sensorStats[id].min = Math.min(sensorStats[id].min, val);
                    sensorStats[id].max = Math.max(sensorStats[id].max, val);
                    sensorStats[id].values.push(val);
                    if (!sensorLatest[id] || logTime > sensorLatest[id].time) {
                        sensorLatest[id] = { value: val, time: logTime };
                    }
                }
            }
        }
        
        // กรองเฉพาะเซนเซอร์ที่ติดตั้งด้วยตนเอง
        const enabledSensors = Object.entries(deviceConfigs)
            .filter(([id, config]) => {
                if (config.type === 'board' || !config.enabled) return false;
                const isAutoGenerated = !config.name || 
                                       config.name === `เซนเซอร์ (${id})` || 
                                       config.name === '' ||
                                       config.name === id;
                return !isAutoGenerated;
            });
        
        const onlineSensors = enabledSensors.filter(([id, config]) => {
            const lastSeen = getTimestampMs(config.lastSeen);
            return (now - lastSeen) < 300000;
        });
        
        body += `📊 <b>ภาพรวมข้อมูล</b>\n`;
        body += `  • บันทึกทั้งหมด: ${totalLogs.toLocaleString()} รายการ\n`;
        body += `  • 24 ชั่วโมงล่าสุด: ${logsIn24h.toLocaleString()} รายการ\n`;
        body += `  • 7 วันที่ผ่านมา: ${logsIn7d.toLocaleString()} รายการ\n`;
        body += `  • อุปกรณ์ที่เปิดใช้งาน: ${enabledSensors.length} ตัว\n`;
        body += `  • ออนไลน์ (5 นาที): ${onlineSensors.length} ตัว\n`;
        body += `  • ออฟไลน์: ${enabledSensors.length - onlineSensors.length} ตัว\n\n`;
        
        body += `━━━━━━━━━━━━━━━━━━\n`;
        body += `📋 <b>สถิติรายอุปกรณ์</b>\n\n`;
        
        for (const [id, config] of enabledSensors) {
            const stats = sensorStats[id];
            const latest = sensorLatest[id];
            const iconMap = { ultrasonic: '🌊', soil: '🌱', rain: '🌧️', ph: '🧪', temp: '🌡️' };
            const icon = iconMap[config.type] || '📌';
            
            // ===== เพิ่มโหมดการทำงาน =====
            const modeLabel = config.sensorMode === 'vertical' ? 'แนวตั้ง' : (config.sensorMode === 'horizontal' ? 'แนวนอน' : '');
            
            body += `${icon} <b>${config.name}</b> (${id})\n`;
            body += `  • หน่วย: ${config.unit || '-'}\n`;
            if (modeLabel) {
                body += `  • 📐 โหมด: ${modeLabel}\n`;
            }
            if (stats && stats.count > 0) {
                const avg = stats.sum / stats.count;
                body += `  • จำนวนข้อมูล: ${stats.count} รายการ\n`;
                body += `  • ค่าเฉลี่ย: ${avg.toFixed(2)} ${config.unit || ''}\n`;
                body += `  • ค่าต่ำสุด: ${stats.min.toFixed(2)} ${config.unit || ''}\n`;
                body += `  • ค่าสูงสุด: ${stats.max.toFixed(2)} ${config.unit || ''}\n`;
                body += `  • ช่วงค่า: ${(stats.max - stats.min).toFixed(2)} ${config.unit || ''}\n`;
            } else {
                body += `  • 📭 ยังไม่มีข้อมูลประวัติ\n`;
            }
            if (latest) {
                const lastSeen = new Date(latest.time);
                body += `  • ค่าล่าสุด: ${latest.value.toFixed(2)} ${config.unit || ''}\n`;
                body += `  • อัปเดตล่าสุด: ${lastSeen.toLocaleString('th-TH')}\n`;
            }
            if (config.alert_count > 0 && config.is_acknowledged !== true) {
                body += `  • ⚠️ กำลังแจ้งเตือน: ${config.alert_count} ครั้ง\n`;
            } else {
                body += `  • ✅ สถานะปกติ\n`;
            }
            body += `\n`;
        }
        
        body += `━━━━━━━━━━━━━━━━━━\n`;
        body += `🔔 <b>สรุปการแจ้งเตือน</b>\n`;
        const pendingAlerts = enabledSensors.filter(([id, config]) => 
            config.alert_count > 0 && config.is_acknowledged !== true
        );
        if (pendingAlerts.length > 0) {
            body += `  • ⚠️ อุปกรณ์ที่กำลังแจ้งเตือน: ${pendingAlerts.length} ตัว\n`;
            pendingAlerts.forEach(([id, config]) => {
                body += `    - ${config.name || id}: ${config.alert_count} ครั้ง\n`;
            });
        } else {
            body += `  • ✅ ไม่มีอุปกรณ์ที่กำลังแจ้งเตือน\n`;
        }
        
        body += `\n━━━━━━━━━━━━━━━━━━\n`;
        body += `📈 <b>อัตราการเปลี่ยนแปลง</b>\n`;
        for (const [id, config] of enabledSensors) {
            const stats = sensorStats[id];
            if (stats && stats.count >= 2) {
                const sortedValues = stats.values || [];
                if (sortedValues.length >= 2) {
                    const firstVal = sortedValues[0];
                    const lastVal = sortedValues[sortedValues.length - 1];
                    const change = lastVal - firstVal;
                    const changePercent = firstVal !== 0 ? (change / Math.abs(firstVal)) * 100 : 0;
                    const trendIcon = change > 0 ? '📈' : (change < 0 ? '📉' : '➡️');
                    body += `${trendIcon} ${config.name}: `;
                    body += `${change > 0 ? '+' : ''}${change.toFixed(2)} ${config.unit || ''} `;
                    body += `(${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)\n`;
                }
            }
        }
        
        const nowStr = new Date().toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        body += `\n🕐 ณ เวลา: ${nowStr} น.`;
        return body;
    } catch (error) {
        console.error("❌ generateSummaryReport error:", error);
        return `❌ เกิดข้อผิดพลาดในการสร้างรายงาน: ${error.message}`;
    }
}
// ============================================================
//  7. SEND TELEGRAM
// ============================================================
async function sendTelegramMessage(text) {
    const MAX_LENGTH = 4000;
    if (!window.db) {
        console.warn("⚠️ Firebase ยังไม่พร้อม");
        return false;
    }
    try {
        const configSnap = await window.get(window.ref(window.db, 'settings/telegram/config'));
        if (!configSnap.exists()) {
            console.warn("⚠️ ไม่พบการตั้งค่า Telegram");
            return false;
        }
        const config = configSnap.val();
        if (!config.enabled) {
            console.warn("⚠️ Telegram ถูกปิดใช้งาน");
            return false;
        }
        const botToken = config.botToken;
        if (!botToken || botToken.trim() === '') {
            console.warn("⚠️ ไม่มี Bot Token");
            return false;
        }
        const subsSnap = await window.get(window.ref(window.db, 'settings/telegram/subscribers'));
        if (!subsSnap.exists()) {
            console.warn("⚠️ ไม่มีผู้รับในระบบ");
            return false;
        }
        const subscribers = subsSnap.val();
        let messages = text.length > MAX_LENGTH 
            ? text.match(new RegExp('.{1,' + MAX_LENGTH + '}', 'g')) 
            : [text];
        let successCount = 0;
        let totalCount = 0;
        const results = [];
        for (const [key, sub] of Object.entries(subscribers)) {
            const chatId = sub.chatId;
            if (!chatId) continue;
            totalCount++;
            let allSuccess = true;
            for (const msgPart of messages) {
                const result = await sendTelegramTextManual(botToken, chatId, msgPart);
                if (!result) allSuccess = false;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            if (allSuccess) {
                successCount++;
                results.push({ chatId, name: sub.name || chatId, status: 'success' });
                console.log(`✅ ส่งไปยัง ${sub.name || chatId} สำเร็จ (${messages.length} ส่วน)`);
            } else {
                results.push({ chatId, name: sub.name || chatId, status: 'failed' });
                console.warn(`⚠️ ส่งไปยัง ${sub.name || chatId} ล้มเหลว`);
            }
        }
        for (const result of results) {
            await window.push(window.ref(window.db, 'settings/telegram/history'), {
                recipient: result.name,
                chatId: result.chatId,
                sender: currentUsername || 'ระบบ',
                status: result.status,
                message: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                timestamp: new Date().toISOString(),
                fullMessage: text.substring(0, 500) + (text.length > 500 ? '... (ตัด)' : ''),
                partsCount: messages.length
            });
        }
        if (successCount === 0) {
            console.warn(`❌ ส่งไม่สำเร็จทุกช่องทาง (${totalCount} รายการ)`);
            return false;
        }
        console.log(`✅ ส่งสำเร็จ ${successCount}/${totalCount} รายการ (${messages.length} ส่วน)`);
        return true;
    } catch (error) {
        console.error("❌ sendTelegramMessage error:", error);
        return false;
    }
}

async function sendTelegramTextManual(botToken, chatId, text) {
    if (!botToken || !chatId) {
        console.warn("⚠️ ขาด Bot Token หรือ Chat ID");
        return false;
    }
    try {
        let cleanText = text.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        console.log(`📤 กำลังส่งไปยัง Chat ID: ${chatId}`);
        console.log(`📤 ความยาวข้อความ: ${cleanText.length} ตัวอักษร`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: cleanText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log(`✅ ส่งข้อความไปยัง ${chatId} สำเร็จ`);
            return true;
        } else {
            console.error(`❌ Telegram API Error: ${data.description}`);
            console.log(`🔍 ข้อความที่ส่ง (200 ตัวแรก): ${cleanText.substring(0, 200)}...`);
            return false;
        }
    } catch (error) {
        console.error(`❌ sendTelegramTextManual error:`, error);
        return false;
    }
}

async function testBotToken(botToken) {
    if (!botToken) return false;
    try {
        const url = `https://api.telegram.org/bot${botToken}/getMe`;
        const response = await fetch(url);
        const data = await response.json();
        return data.ok === true;
    } catch (error) {
        console.error("❌ ทดสอบ Bot Token ล้มเหลว:", error);
        return false;
    }
}

// ============================================================
//  8. TELEGRAM CONFIG
// ============================================================
window.saveTelegramConfig = async function() {
    const botToken = document.getElementById('teleBotToken').value.trim();
    const enabled = document.getElementById('teleEnabled').checked;
    if (!botToken) {
        alert("⚠️ กรุณากรอก Bot Token");
        return;
    }
    const isValid = await testBotToken(botToken);
    if (!isValid) {
        alert("❌ Bot Token ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง\n\n💡 วิธีหา Bot Token:\n1. พิมพ์ @BotFather ใน Telegram\n2. สร้าง Bot ใหม่ หรือเลือก Bot ที่มีอยู่\n3. คัดลอก Token ที่ได้");
        return;
    }
    try {
        await window.set(window.ref(window.db, 'settings/telegram/config'), {
            botToken: botToken,
            enabled: enabled,
            updatedAt: new Date().toISOString()
        });
        telegramBotToken = botToken;
        telegramEnabled = enabled;
        alert("✅ บันทึกการตั้งค่า Telegram สำเร็จ!");
        await loadTelegramConfig();
        await loadSubscribers();
        await loadTelegramHistory();
    } catch (error) {
        console.error("❌ saveTelegramConfig error:", error);
        alert("❌ บันทึกไม่สำเร็จ: " + error.message);
    }
};

async function loadTelegramConfig() {
    try {
        const configSnap = await window.get(window.ref(window.db, 'settings/telegram/config'));
        const tokenInput = document.getElementById('teleBotToken');
        const enabledCheck = document.getElementById('teleEnabled');
        if (configSnap.exists()) {
            const config = configSnap.val();
            telegramBotToken = config.botToken || '';
            telegramEnabled = config.enabled || false;
            if (tokenInput) tokenInput.value = telegramBotToken;
            if (enabledCheck) enabledCheck.checked = telegramEnabled;
        } else {
            if (tokenInput) tokenInput.value = '';
            if (enabledCheck) enabledCheck.checked = false;
        }
    } catch (error) {
        console.warn("⚠️ loadTelegramConfig error:", error);
    }
}

// ============================================================
//  9. SUBSCRIBERS
// ============================================================
window.saveSubscriber = async function() {
    const name = document.getElementById('subName').value.trim();
    const chatId = document.getElementById('subChatId').value.trim();
    if (!name || !chatId) {
        alert("⚠️ กรุณากรอกชื่อและ Chat ID ให้ครบถ้วน");
        return;
    }
    if (!/^\d+$/.test(chatId)) {
        alert("⚠️ Chat ID ต้องเป็นตัวเลขเท่านั้น (เช่น 123456789)");
        return;
    }
    try {
        const subsSnap = await window.get(window.ref(window.db, 'settings/telegram/subscribers'));
        if (subsSnap.exists()) {
            const subs = subsSnap.val();
            for (const key in subs) {
                if (subs[key].chatId === chatId) {
                    alert(`⚠️ มี Chat ID "${chatId}" ในระบบแล้ว (ชื่อ: ${subs[key].name})`);
                    return;
                }
            }
        }
        await window.push(window.ref(window.db, 'settings/telegram/subscribers'), {
            name: name,
            chatId: chatId,
            createdAt: new Date().toISOString()
        });
        alert(`✅ เพิ่มผู้รับ "${name}" (Chat ID: ${chatId}) สำเร็จ`);
        document.getElementById('subName').value = '';
        document.getElementById('subChatId').value = '';
        await loadSubscribers();
    } catch (error) {
        console.error("❌ saveSubscriber error:", error);
        alert("❌ บันทึกผู้รับไม่สำเร็จ: " + error.message);
    }
};

async function loadSubscribers() {
    const tbody = document.getElementById('subTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748b;">📥 กำลังโหลดรายชื่อ...</td></tr>';
    try {
        const subsSnap = await window.get(window.ref(window.db, 'settings/telegram/subscribers'));
        if (!subsSnap.exists()) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748b;">📭 ยังไม่มีผู้รับในระบบ</td></tr>';
            return;
        }
        const subs = subsSnap.val();
        tbody.innerHTML = '';
        for (const [key, data] of Object.entries(subs)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="ชื่อ"><strong>${escapeHtml(data.name)}</strong></td>
                <td data-label="Chat ID"><code style="background:#1e293b; padding:2px 8px; border-radius:4px; font-size:0.85rem;">${escapeHtml(data.chatId)}</code></td>
                <td data-label="จัดการ">
                    <button onclick="deleteSubscriber('${key}')" class="btn-small danger" style="background:#d32f2f; color:white; border:none; padding:4px 12px; border-radius:4px; cursor:pointer;">🗑️ ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error("❌ loadSubscribers error:", error);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#ef4444;">❌ โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
}

window.deleteSubscriber = async function(key) {
    if (!confirm("⚠️ ยืนยันการลบผู้รับนี้?")) return;
    try {
        await window.remove(window.ref(window.db, `settings/telegram/subscribers/${key}`));
        alert("✅ ลบผู้รับสำเร็จ");
        await loadSubscribers();
    } catch (error) {
        console.error("❌ deleteSubscriber error:", error);
        alert("❌ ลบผู้รับไม่สำเร็จ: " + error.message);
    }
};

// ============================================================
//  10. TELEGRAM HISTORY
// ============================================================
async function loadTelegramHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">📥 กำลังโหลดประวัติ...</td></tr>';
    try {
        const historySnap = await window.get(window.ref(window.db, 'settings/telegram/history'));
        if (!historySnap.exists()) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">📭 ยังไม่มีประวัติการส่ง</td></tr>';
            return;
        }
        const history = historySnap.val();
        const historyArray = Object.entries(history).map(([key, data]) => ({ key, ...data }));
        historyArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = historyArray.slice(0, 50);
        tbody.innerHTML = '';
        for (const item of recent) {
            const tr = document.createElement('tr');
            const statusText = item.status === 'success' ? '✅ สำเร็จ' : '❌ ล้มเหลว';
            const statusColor = item.status === 'success' ? '#4caf50' : '#ef4444';
            let messagePreview = item.message || '-';
            if (messagePreview.length > 30) {
                messagePreview = messagePreview.substring(0, 30) + '...';
            }
            tr.innerHTML = `
                <td data-label="เวลา" style="font-size:0.75rem;">${formatThaiDateTime(item.timestamp)}</td>
                <td data-label="ถึง">${escapeHtml(item.recipient || '-')}</td>
                <td data-label="ผู้ส่ง">${escapeHtml(item.sender || 'ระบบ')}</td>
                <td data-label="ข้อความ" style="font-size:0.7rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.fullMessage || item.message || '')}">${escapeHtml(messagePreview)}</td>
                <td data-label="สถานะ"><span style="color:${statusColor}; font-weight:bold;">${statusText}</span></td>
                <td data-label="จัดการ">
                    <button onclick="deleteTelegramHistoryItem('${item.key}')" class="btn-small danger" style="background:#d32f2f; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; font-size:0.7rem;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
        if (historyArray.length > 50) {
            const extraRow = document.createElement('tr');
            extraRow.innerHTML = `<td colspan="6" style="text-align:center; padding:10px; color:#64748b; font-size:0.8rem;">📌 แสดง 50 รายการล่าสุด จากทั้งหมด ${historyArray.length} รายการ</td>`;
            tbody.appendChild(extraRow);
        }
    } catch (error) {
        console.error("❌ loadTelegramHistory error:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">❌ โหลดประวัติล้มเหลว: ${error.message}</tr>`;
    }
}

window.deleteTelegramHistoryItem = async function(key) {
    if (!confirm("⚠️ ยืนยันการลบประวัติรายการนี้?")) return;
    try {
        await window.remove(window.ref(window.db, `settings/telegram/history/${key}`));
        await loadTelegramHistory();
    } catch (error) {
        console.error("❌ deleteTelegramHistoryItem error:", error);
        alert("❌ ลบไม่สำเร็จ: " + error.message);
    }
};

window.confirmClearTelegramHistory = async function() {
    if (!confirm("⚠️ ยืนยันการล้างประวัติการส่งทั้งหมด?")) return;
    try {
        await window.remove(window.ref(window.db, 'settings/telegram/history'));
        alert("✅ ล้างประวัติการส่งทั้งหมดสำเร็จ");
        await loadTelegramHistory();
    } catch (error) {
        console.error("❌ confirmClearTelegramHistory error:", error);
        alert("❌ ล้างประวัติไม่สำเร็จ: " + error.message);
    }
};

// ============================================================
//  11. SCHEDULES
// ============================================================
async function loadTelegramSchedules() {
    const tbody = document.getElementById('teleScheduleTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:10px; color:#64748b;">📥 กำลังโหลดตาราง...</td></tr>';
    try {
        const schedSnap = await window.get(window.ref(window.db, 'settings/telegram/schedules'));
        if (!schedSnap.exists()) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:10px; color:#64748b;">📭 ยังไม่มีตารางเวลา</td></tr>';
            return;
        }
        const schedules = schedSnap.val();
        tbody.innerHTML = '';
        const typeMap = {
            'status': '📊 สถานะฮาร์ดแวร์',
            'system': '⚙️ สภาพการทำงาน',
            'summary': '📈 สรุปวิเคราะห์'
        };
        for (const [key, sched] of Object.entries(schedules)) {
            const tr = document.createElement('tr');
            const typeLabel = typeMap[sched.type] || sched.type;
            const titleDisplay = sched.title || typeLabel;
            const statusIcon = sched.enabled !== false ? '🟢' : '🔴';
            let nextSend = '--';
            if (sched.enabled !== false) {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const lastSent = sched.lastSent || '';
                const lastSentDate = lastSent.split('T')[0] || '';
                if (lastSentDate !== today) {
                    const startMin = timeToMinutes(sched.start || '08:00');
                    const endMin = timeToMinutes(sched.end || '20:00');
                    const count = parseInt(sched.count) || 1;
                    const interval = (endMin - startMin) / count;
                    if (interval > 0) {
                        const currentMin = now.getHours() * 60 + now.getMinutes();
                        let found = false;
                        for (let i = 0; i < count; i++) {
                            const slotStart = startMin + (interval * i);
                            if (currentMin < slotStart) {
                                const h = Math.floor(slotStart / 60);
                                const m = Math.floor(slotStart % 60);
                                nextSend = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            const h = Math.floor(startMin / 60);
                            const m = Math.floor(startMin % 60);
                            nextSend = `พรุ่งนี้ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        }
                    }
                } else {
                    nextSend = 'ส่งแล้ววันนี้';
                }
            } else {
                nextSend = '⏸️ ปิดใช้งาน';
            }
            tr.innerHTML = `
                <td data-label="หัวข้อ">
                    ${statusIcon} <strong>${escapeHtml(titleDisplay)}</strong>
                    <div style="font-size:0.6rem; color:#64748b;">${typeLabel}</div>
                </td>
                <td data-label="จำนวน">${sched.count || 1} ครั้ง/วัน</td>
                <td data-label="ช่วงเวลา">${sched.start || '08:00'} - ${sched.end || '20:00'}</td>
                <td data-label="ส่งครั้งต่อไป">${nextSend}</td>
                <td data-label="จัดการ">
                    <button onclick="editTelegramSchedule('${key}')" class="btn-small" style="background:#ffa726; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; margin-right:4px;" title="แก้ไขหัวข้อ">✏️</button>
                    <button onclick="toggleTelegramSchedule('${key}', ${sched.enabled !== false ? 'false' : 'true'})" class="btn-small" style="background:${sched.enabled !== false ? '#f59e0b' : '#4caf50'}; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">
                        ${sched.enabled !== false ? '⏸️' : '▶️'}
                    </button>
                    <button onclick="deleteTelegramSchedule('${key}')" class="btn-small danger" style="background:#d32f2f; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error("❌ loadTelegramSchedules error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:10px; color:#ef4444;">❌ โหลดตารางล้มเหลว: ${error.message}</td></tr>`;
    }
}

function renderTelegramSchedules() {
    loadTelegramSchedules();
}

window.addTelegramSchedule = async function() {
    const type = document.getElementById('schedType').value;
    const title = document.getElementById('schedTitle')?.value.trim() || '';
    const count = parseInt(document.getElementById('schedCount').value) || 1;
    const start = document.getElementById('schedStart').value || '08:00';
    const end = document.getElementById('schedEnd').value || '20:00';
    if (count < 1 || count > 24) {
        alert("⚠️ จำนวนครั้งต้องอยู่ระหว่าง 1-24 ครั้งต่อวัน");
        return;
    }
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (startMin >= endMin) {
        alert("⚠️ เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด");
        return;
    }
    try {
        await window.push(window.ref(window.db, 'settings/telegram/schedules'), {
            type: type,
            title: title || getDefaultScheduleTitle(type),
            count: count,
            start: start,
            end: end,
            enabled: true,
            sentSlots: [],
            createdAt: new Date().toISOString()
        });
        alert("✅ เพิ่มตารางส่งรายงานสำเร็จ");
        await loadTelegramSchedules();
        document.getElementById('schedType').value = 'status';
        document.getElementById('schedTitle').value = '';
        document.getElementById('schedCount').value = '1';
        document.getElementById('schedStart').value = '08:00';
        document.getElementById('schedEnd').value = '20:00';
    } catch (error) {
        console.error("❌ addTelegramSchedule error:", error);
        alert("❌ เพิ่มตารางไม่สำเร็จ: " + error.message);
    }
};

function getDefaultScheduleTitle(type) {
    const map = {
        'status': '📊 รายงานสถานะฮาร์ดแวร์',
        'system': '⚙️ รายงานสภาพการทำงาน',
        'summary': '📈 สรุปข้อมูลวิเคราะห์'
    };
    return map[type] || 'รายงานอัตโนมัติ';
}

window.editTelegramSchedule = async function(key) {
    if (!key) {
        alert("❌ ไม่พบรหัสรายการ");
        return;
    }
    try {
        const schedSnap = await window.get(window.ref(window.db, `settings/telegram/schedules/${key}`));
        if (!schedSnap.exists()) {
            alert("❌ ไม่พบข้อมูลตารางนี้");
            return;
        }
        const sched = schedSnap.val();
        const newTitle = prompt("✏️ แก้ไขหัวข้อรายงาน:", sched.title || "");
        if (newTitle !== null && newTitle.trim() !== '') {
            await window.update(window.ref(window.db, `settings/telegram/schedules/${key}`), { 
                title: newTitle.trim(),
                updatedAt: new Date().toISOString()
            });
            await loadTelegramSchedules();
            console.log(`✅ อัปเดตหัวข้อรายงานของ ${key} สำเร็จ`);
        } else if (newTitle === '') {
            alert("⚠️ หัวข้อไม่สามารถเว้นว่างได้");
        }
    } catch (error) {
        console.error("❌ editTelegramSchedule error:", error);
        alert("❌ แก้ไขหัวข้อไม่สำเร็จ: " + error.message);
    }
};

window.toggleTelegramSchedule = async function(key, newStatus) {
    try {
        await window.update(window.ref(window.db, `settings/telegram/schedules/${key}`), {
            enabled: newStatus
        });
        await loadTelegramSchedules();
    } catch (error) {
        console.error("❌ toggleTelegramSchedule error:", error);
        alert("❌ เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
    }
};

window.deleteTelegramSchedule = async function(key) {
    if (!confirm("⚠️ ยืนยันการลบตารางนี้?")) return;
    try {
        await window.remove(window.ref(window.db, `settings/telegram/schedules/${key}`));
        alert("✅ ลบตารางสำเร็จ");
        await loadTelegramSchedules();
    } catch (error) {
        console.error("❌ deleteTelegramSchedule error:", error);
        alert("❌ ลบไม่สำเร็จ: " + error.message);
    }
};

// ============================================================
//  12. AUTO CHECK SCHEDULE
// ============================================================
function startTelegramAutoCheck() {
    if (telegramCheckInterval) {
        clearInterval(telegramCheckInterval);
    }
    telegramCheckInterval = setInterval(async () => {
        try {
            await checkTelegramSchedule();
        } catch (error) {
            console.warn("⚠️ checkTelegramSchedule error:", error);
        }
    }, 60000);
    console.log("✅ เริ่มระบบตรวจสอบตารางส่ง Telegram อัตโนมัติ");
}

async function checkTelegramSchedule() {
    if (!window.db) return;
    try {
        const configSnap = await window.get(window.ref(window.db, 'settings/telegram/config'));
        if (!configSnap.exists() || !configSnap.val().enabled) {
            return;
        }
        const scheduleSnap = await window.get(window.ref(window.db, 'settings/telegram/schedules'));
        if (!scheduleSnap.exists()) return;
        const schedules = scheduleSnap.val();
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const today = now.toISOString().split('T')[0];
        for (const [key, sched] of Object.entries(schedules)) {
            if (sched.enabled === false) continue;
            const lastSent = sched.lastSent || '';
            const lastSentDate = lastSent.split('T')[0] || '';
            if (lastSentDate === today) continue;
            const startMin = timeToMinutes(sched.start || '08:00');
            const endMin = timeToMinutes(sched.end || '20:00');
            const count = parseInt(sched.count) || 1;
            if (count <= 0) continue;
            const interval = (endMin - startMin) / count;
            if (interval <= 0) continue;
            for (let i = 0; i < count; i++) {
                const slotStart = startMin + (interval * i);
                const slotEnd = slotStart + interval;
                if (currentTime >= slotStart && currentTime < slotEnd) {
                    const slotKey = `${today}_${i}`;
                    if (sched.sentSlots && sched.sentSlots.includes(slotKey)) continue;
                    await sendScheduledReport(sched.type || 'status', key);
                    const sentSlots = sched.sentSlots || [];
                    sentSlots.push(slotKey);
                    await window.update(window.ref(window.db, `settings/telegram/schedules/${key}`), {
                        sentSlots: sentSlots,
                        lastSent: new Date().toISOString()
                    });
                    break;
                }
            }
        }
        for (const [key, sched] of Object.entries(schedules)) {
            const lastSent = sched.lastSent || '';
            const lastSentDate = lastSent.split('T')[0] || '';
            if (lastSentDate !== today && sched.sentSlots && sched.sentSlots.length > 0) {
                await window.update(window.ref(window.db, `settings/telegram/schedules/${key}`), {
                    sentSlots: []
                });
            }
        }
    } catch (error) {
        console.error("❌ checkTelegramSchedule error:", error);
    }
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

async function sendScheduledReport(type, scheduleKey) {
    try {
        const schedSnap = await window.get(window.ref(window.db, `settings/telegram/schedules/${scheduleKey}`));
        const sched = schedSnap.exists() ? schedSnap.val() : {};
        const defaultLabels = {
            'status': '📊 รายงานสถานะฮาร์ดแวร์ (อัตโนมัติ)',
            'system': '⚙️ รายงานสภาพการทำงาน (อัตโนมัติ)',
            'summary': '📈 สรุปข้อมูลวิเคราะห์ (อัตโนมัติ)'
        };
        const title = sched.title || defaultLabels[type] || 'รายงานอัตโนมัติ';
        const body = await generateReportContent(type);
        const finalMessage = formatTelegramMessage(body, "ระบบรายงานอัตโนมัติ", title);
        return await sendTelegramMessage(finalMessage);
    } catch (error) {
        console.error("❌ sendScheduledReport error:", error);
        return false;
    }
}

// ============================================================
//  13. MANUAL REPORT
// ============================================================
window.triggerManualReport = async function() {
    const btn = document.querySelector('.tele-btn-manual');
    const originalText = btn?.innerHTML || '🚀 ส่งรายงานทาง Telegram ทันที';
    if (btn) { 
        btn.innerHTML = "⏳ กำลังส่ง..."; 
        btn.disabled = true; 
        btn.style.opacity = "0.7";
    }
    try {
        const reportType = document.getElementById('reportTypeSelect')?.value || 'status';
        const typeLabels = {
            'status': '📊 รายละเอียดการวัดล่าสุด (แยกตามพื้นที่)',
            'system': '⚙️ รายงานสถานะอุปกรณ์และระบบ',
            'summary': '📈 สรุปข้อมูลเชิงวิเคราะห์ (Analytics)'
        };
        const title = typeLabels[reportType] || '📊 รายงานจากระบบ';
        console.log(`📤 กำลังสร้างรายงาน: ${title}`);
        const body = await generateReportContent(reportType);
        let finalBody = body;
        
        // เพิ่มสรุปเพิ่มเติมสำหรับรายงานสถานะ
        if (reportType === 'status') {
            // นับเซนเซอร์ที่ติดตั้งด้วยตนเอง
            const manualSensors = Object.entries(deviceConfigs).filter(([id, config]) => {
                if (config.type === 'board' || !config.enabled) return false;
                const isAutoGenerated = !config.name || 
                                       config.name === `เซนเซอร์ (${id})` || 
                                       config.name === '' ||
                                       config.name === id;
                return !isAutoGenerated;
            });
            
            const totalSensors = manualSensors.length;
            const onlineCount = manualSensors.filter(([id, config]) => {
                const lastSeen = getTimestampMs(config.lastSeen);
                const now = Date.now() + serverTimeOffset;
                return (now - lastSeen) < 300000;
            }).length;
            
            // นับจำนวนบอร์ดที่มี weather_config
            const boardsWithWeather = Object.entries(deviceConfigs).filter(([id, config]) => 
                config.type === 'board' && 
                config.weather_config && 
                config.weather_config.lat
            ).length;
            
            finalBody += `\n━━━━━━━━━━━━━━━━━━\n📊 <b>สรุป:</b>\n`;
            finalBody += `  • อุปกรณ์ทั้งหมด: ${totalSensors} ตัว\n`;
            finalBody += `  • ออนไลน์: ${onlineCount} ตัว\n`;
            finalBody += `  • ออฟไลน์: ${totalSensors - onlineCount} ตัว\n`;
            finalBody += `  • 🌤️ พื้นที่ที่มีสภาพอากาศ: ${boardsWithWeather} บอร์ด\n`;
            
            // สรุปโหมดการทำงาน
            const verticalCount = manualSensors.filter(([id, config]) => config.sensorMode === 'vertical').length;
            const horizontalCount = manualSensors.filter(([id, config]) => config.sensorMode === 'horizontal').length;
            if (verticalCount > 0 || horizontalCount > 0) {
                finalBody += `\n📐 <b>โหมดการทำงาน:</b>\n`;
                if (verticalCount > 0) finalBody += `  • 📏 แนวตั้ง: ${verticalCount} ตัว\n`;
                if (horizontalCount > 0) finalBody += `  • 📐 แนวนอน: ${horizontalCount} ตัว\n`;
            }
        }
        
        const finalMessage = formatTelegramMessage(finalBody, currentUsername || "ผู้ดูแลระบบ", title);
        const success = await sendTelegramMessage(finalMessage);
        if (success) {
            alert("🚀 ส่งรายงานไปยัง Telegram สำเร็จ! (ดูประวัติในแท็บ Telegram)");
        } else {
            alert("❌ ส่งไม่สำเร็จ! กรุณาตรวจสอบการตั้งค่า Bot Token และ Chat ID");
        }
    } catch (e) {
        console.error("Manual Report Error:", e);
        alert("❌ เกิดข้อผิดพลาด: " + e.message);
    } finally {
        if (btn) { 
            btn.innerHTML = originalText; 
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
};

// ============================================================
//  14. INIT TELEGRAM LISTENERS
// ============================================================
function initTelegramListeners() {
    const configRef = window.ref(window.db, 'settings/telegram/config');
    window.onValue(configRef, (snapshot) => {
        if (snapshot.exists()) {
            const config = snapshot.val();
            telegramBotToken = config.botToken || '';
            telegramEnabled = config.enabled || false;
            if (telegramEnabled && telegramBotToken) {
                startTelegramAutoCheck();
            }
        }
    });
    setTimeout(() => {
        loadTelegramConfig();
        loadSubscribers();
        loadTelegramHistory();
        loadTelegramSchedules();
    }, 1000);
}

// ============================================================
//  15. GPS BUTTON IN UI (Utility)
// ============================================================
window.addGPSButton = function() {
    const container = document.getElementById('gpsButtonContainer');
    if (!container) {
        // สร้าง container ถ้าไม่มี
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            const weatherSection = settingsModal.querySelector('.user-management-form:last-of-type');
            if (weatherSection) {
                const gpsContainer = document.createElement('div');
                gpsContainer.id = 'gpsButtonContainer';
                gpsContainer.style.cssText = 'margin-top: 10px;';
                weatherSection.appendChild(gpsContainer);
            }
        }
    }
    const gpsContainer = document.getElementById('gpsButtonContainer');
    if (gpsContainer) {
        gpsContainer.innerHTML = `
            <button onclick="saveGPSLocation()" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                📡 ใช้ตำแหน่งปัจจุบัน (GPS)
            </button>
            <span style="font-size: 0.7rem; color: #64748b; margin-left: 8px;">* ระบบจะขออนุญาตใช้งาน GPS ของเบราว์เซอร์</span>
        `;
    }
};

// ============================================================
//  16. FETCH WEATHER DATA (สำหรับใช้ใน generateStatusReport)
// ============================================================
async function fetchWeatherData(lat, lon) {
    if (!lat || !lon) return null;
    try {
        const WEATHER_API_KEY = "dd879305b1074776a9c228f0b27798a3";
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=th&appid=${WEATHER_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        return data;
    } catch (err) {
        console.warn("❌ Weather API Error:", err.message);
        return null;
    }
}

// ============================================================
//  17. TELEGRAM INIT
// ============================================================
function initTelegramModule() {
    console.log("🚀 Telegram Module เริ่มทำงาน (เวอร์ชัน 2.6 - Per-Board Weather Support)");
    setTimeout(() => {
        loadTelegramConfig();
        loadSubscribers();
        loadTelegramHistory();
        loadTelegramSchedules();
        addGPSButton();
    }, 1000);
}

console.log("✅ telegram.js โหลดเรียบร้อย (เวอร์ชัน 2.6 - Per-Board Weather Support)");