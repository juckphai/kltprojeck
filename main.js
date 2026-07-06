// ============================================================
//  main.js - ตัวจัดการหลัก (Module Loader)
//  Version: 2.5 (พร้อม Weather Settings + Storage Monitor + Clear Local Data + Toggle Chart + Toggle Analytics)
// ============================================================

console.log("📦 main.js โหลดเรียบร้อย");

// ============================================================
//  1. ฟังก์ชันรอให้ทุกโมดูลโหลดเสร็จ
// ============================================================
function waitForModules(callback, maxAttempts = 30) {
    let attempts = 0;
    
    const requiredFunctions = [
        'loadWeatherInfo',
        'updateStandaloneAlertPanel',
        'updateStatusBarBoardDetails',
        'applyDisabledCardStyles',
        'loadGlobalMuteStatus',
        'startDeviceHealthMonitor',
        'initTemplateSelector',
        'renderSensorCards',
        'processNewData',
        'initTelegramListeners',
        'initCoreModule',
        'initSensorModule',
        'initTelegramModule',
        'initStorageMonitor'  // ✅ เพิ่ม Storage Monitor
    ];
    
    function check() {
        attempts++;
        const missingFunctions = requiredFunctions.filter(
            fn => typeof window[fn] !== 'function'
        );
        const hasDeviceConfigs = typeof window.deviceConfigs !== 'undefined';
        const isReady = missingFunctions.length === 0 && hasDeviceConfigs;
        
        if (isReady) {
            console.log("✅ ทุกโมดูลพร้อมทำงาน (ใช้เวลา " + attempts + " ครั้ง)");
            if (typeof callback === 'function') {
                callback();
            }
        } else if (attempts < maxAttempts) {
            console.log(`⏳ รอโมดูลโหลด... (${attempts}/${maxAttempts})`);
            if (missingFunctions.length > 0) {
                console.log(`   ขาด: ${missingFunctions.join(', ')}`);
            }
            if (!hasDeviceConfigs) {
                console.log(`   ⏳ รอ deviceConfigs...`);
            }
            setTimeout(check, 300);
        } else {
            console.error("❌ โหลดโมดูลไม่สำเร็จในเวลาที่กำหนด");
            if (missingFunctions.length > 0) {
                console.error("   ฟังก์ชันที่ขาดหายไป:", missingFunctions);
            }
            if (!hasDeviceConfigs) {
                console.error("   ❌ deviceConfigs ไม่ถูกโหลด");
            }
            console.error("   💡 แนะนำ: ตรวจสอบลำดับการโหลดไฟล์ใน index.html");
        }
    }
    check();
}

// ============================================================
//  2. ฟังก์ชันเริ่มต้นระบบหลัก
// ============================================================
function startApp() {
    console.log("🚀 เริ่มต้นระบบ...");
    waitForModules(() => {
        console.log("🔄 กำลังเริ่มระบบ...");
        if (!document.getElementById('mainApp')) {
            console.warn("⚠️ DOM ยังไม่พร้อม รออีก 500ms...");
            setTimeout(startApp, 500);
            return;
        }
        if (typeof initCoreModule === 'function') {
            console.log("📌 เรียก initCoreModule()");
            try { initCoreModule(); } catch(e) { console.error("❌ initCoreModule error:", e); }
        } else {
            console.warn("⚠️ ไม่พบ initCoreModule ใน core.js");
        }
        if (typeof initSensorModule === 'function') {
            console.log("📌 เรียก initSensorModule()");
            try { initSensorModule(); } catch(e) { console.error("❌ initSensorModule error:", e); }
        } else {
            console.warn("⚠️ ไม่พบ initSensorModule ใน sensors.js");
        }
        if (typeof initTelegramModule === 'function') {
            console.log("📌 เรียก initTelegramModule()");
            try { initTelegramModule(); } catch(e) { console.error("❌ initTelegramModule error:", e); }
        } else {
            console.warn("⚠️ ไม่พบ initTelegramModule ใน telegram.js");
        }
        console.log("✅ ระบบเริ่มต้นสมบูรณ์!");
        
        // ✅ เริ่ม Storage Monitor หลังจากระบบหลักทำงาน
        setTimeout(() => {
            if (typeof initStorageMonitor === 'function') {
                console.log("💾 เรียก initStorageMonitor()");
                try { initStorageMonitor(); } catch(e) { console.error("❌ initStorageMonitor error:", e); }
            } else {
                console.warn("⚠️ ไม่พบ initStorageMonitor ใน storage-monitor.js");
            }
        }, 2000);
    });
}

// ============================================================
//  3. TOGGLE SUMMARY TABLE
// ============================================================
window.toggleSummaryTable = function() {
    const wrapper = document.getElementById('summaryTableWrapper');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    
    if (!wrapper) {
        console.warn("⚠️ ไม่พบ element #summaryTableWrapper");
        return;
    }
    
    if (wrapper.style.display === 'none' || wrapper.style.display === '') {
        wrapper.style.display = 'block';
        if (btnIcon) btnIcon.textContent = '🔼';
        if (btnText) btnText.textContent = 'ซ่อนตาราง';
        if (typeof renderSummaryTable === 'function') {
            renderSummaryTable();
        }
    } else {
        wrapper.style.display = 'none';
        if (btnIcon) btnIcon.textContent = '🔽';
        if (btnText) btnText.textContent = 'แสดงตาราง';
    }
};

// ============================================================
//  4. 🗑️ CLEAR LOCAL DATA - ลบข้อมูลในเครื่อง (LocalStorage, SessionStorage, Cache)
// ============================================================
window.confirmClearLocalData = function() {
    // ✅ รหัสยืนยันเพื่อป้องกันการลบโดยไม่ตั้งใจ
    const CONFIRM_CODE = "55555";
    
    const userInput = prompt(
        `⚠️ คำเตือนขั้นสูงสุด!\n\n` +
        `คุณกำลังจะลบข้อมูลในเครื่อง (Local Data) ทั้งหมด!\n\n` +
        `📌 ข้อมูลที่จะถูกลบ:\n` +
        `   • LocalStorage (ข้อมูลจำลอง, การตั้งค่า)\n` +
        `   • SessionStorage (ข้อมูลการเข้าสู่ระบบชั่วคราว)\n` +
        `   • Cache ของเบราว์เซอร์ (ถ้ามี)\n\n` +
        `❌ การดำเนินการนี้จะทำให้คุณต้องเข้าสู่ระบบใหม่!\n\n` +
        `🔑 กรอกรหัสยืนยัน "${CONFIRM_CODE}" เพื่อดำเนินการ:`
    );
    
    if (userInput === null) {
        console.log("❌ ยกเลิกการลบข้อมูล");
        return;
    }
    
    if (userInput !== CONFIRM_CODE) {
        alert(`❌ รหัสยืนยันไม่ถูกต้อง (ต้องพิมพ์ "${CONFIRM_CODE}" เท่านั้น)`);
        return;
    }
    
    // ✅ ยืนยันอีกครั้ง
    if (!confirm("⚠️ ยืนยันการลบข้อมูลในเครื่องทั้งหมด?\n\n" +
                 "💡 ข้อมูล Firebase ยังคงอยู่ แต่คุณจะต้องเข้าสู่ระบบใหม่")) {
        return;
    }
    
    try {
        // ✅ แสดงข้อความกำลังดำเนินการ
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'clearLocalDataLoading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e293b;
            color: #e2e8f0;
            padding: 30px 40px;
            border-radius: 12px;
            z-index: 99999;
            border: 2px solid #ef4444;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            text-align: center;
            min-width: 320px;
        `;
        loadingDiv.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 15px;">🗑️</div>
            <div style="font-size: 1.2rem; font-weight: bold; color: #f87171;">กำลังลบข้อมูล...</div>
            <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 10px;">กรุณารอสักครู่</div>
            <div style="margin-top: 15px; width: 100%; height: 4px; background: #334155; border-radius: 2px; overflow: hidden;">
                <div style="width: 0%; height: 100%; background: #ef4444; border-radius: 2px; animation: loadingProgress 2s ease-in-out infinite;"></div>
            </div>
            <style>
                @keyframes loadingProgress {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                }
            </style>
        `;
        document.body.appendChild(loadingDiv);
        
        // ✅ หน่วงเวลาเล็กน้อยให้เห็น animation
        setTimeout(() => {
            // ✅ 1. ล้าง LocalStorage
            const localStorageKeys = Object.keys(localStorage);
            let localStorageCount = 0;
            for (const key of localStorageKeys) {
                // ✅ เก็บ key ที่สำคัญไว้ (ถ้าต้องการ)
                if (key === 'pwa_installed') continue; // ข้าม PWA status
                localStorage.removeItem(key);
                localStorageCount++;
            }
            console.log(`✅ ลบ LocalStorage ${localStorageCount} รายการ`);
            
            // ✅ 2. ล้าง SessionStorage
            const sessionStorageKeys = Object.keys(sessionStorage);
            let sessionStorageCount = 0;
            for (const key of sessionStorageKeys) {
                sessionStorage.removeItem(key);
                sessionStorageCount++;
            }
            console.log(`✅ ลบ SessionStorage ${sessionStorageCount} รายการ`);
            
            // ✅ 3. ล้าง Cache (ถ้ามี)
            if ('caches' in window) {
                try {
                    caches.keys().then(cacheNames => {
                        cacheNames.forEach(cacheName => {
                            caches.delete(cacheName);
                            console.log(`✅ ลบ Cache: ${cacheName}`);
                        });
                    });
                } catch (e) {
                    console.warn("⚠️ ไม่สามารถล้าง Cache ได้:", e);
                }
            }
            
            // ✅ 4. ล้าง IndexedDB (ถ้ามี)
            if (window.indexedDB) {
                try {
                    // ✅ ใช้วิธีที่ปลอดภัยกว่า
                    const databases = ['firebaseLocalStorageDb', 'firebaseStorage', 'KLTDB'];
                    databases.forEach(dbName => {
                        try {
                            window.indexedDB.deleteDatabase(dbName);
                            console.log(`✅ ลบ IndexedDB: ${dbName}`);
                        } catch(e) {
                            console.warn(`⚠️ ลบ IndexedDB ${dbName} ไม่สำเร็จ:`, e);
                        }
                    });
                } catch(e) {
                    console.warn("⚠️ ไม่สามารถล้าง IndexedDB ได้:", e);
                }
            }
            
            // ✅ 5. ลบข้อมูลที่เกี่ยวข้องกับ Firebase (ถ้ามี)
            try {
                // ล้าง Firebase Local Cache
                if (window.firebase && window.firebase.auth) {
                    try {
                        window.firebase.auth().signOut();
                        console.log("✅ SignOut Firebase");
                    } catch(e) {}
                }
                
                // ล้าง Service Worker Registration (ถ้ามี)
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(registration => {
                            registration.unregister();
                            console.log("✅ Unregister Service Worker");
                        });
                    });
                }
            } catch(e) {
                console.warn("⚠️ ไม่สามารถล้าง Firebase/SW ได้:", e);
            }
            
            // ✅ 6. ลบ Cookies (ถ้ามี)
            try {
                document.cookie.split(";").forEach(c => {
                    document.cookie = c.replace(/^ +/, "")
                        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                console.log("✅ ลบ Cookies เรียบร้อย");
            } catch(e) {
                console.warn("⚠️ ไม่สามารถลบ Cookies ได้:", e);
            }
            
            // ✅ 7. ลบข้อความโหลด
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
            
            // ✅ 8. แสดงผลสำเร็จ
            alert(`✅ ลบข้อมูลในเครื่องสำเร็จ!\n\n` +
                  `📊 สรุป:\n` +
                  `   • LocalStorage: ${localStorageCount} รายการ\n` +
                  `   • SessionStorage: ${sessionStorageCount} รายการ\n` +
                  `   • Cache: เรียบร้อย\n` +
                  `   • Cookies: เรียบร้อย\n\n` +
                  `🔄 ระบบจะทำการรีโหลดหน้าเว็บเพื่อเริ่มต้นใหม่`);
            
            // ✅ 9. รีโหลดหน้าเว็บ
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        }, 800);
        
    } catch (error) {
        console.error("❌ clearLocalData error:", error);
        const loadingDiv = document.getElementById('clearLocalDataLoading');
        if (loadingDiv) loadingDiv.remove();
        alert(`❌ การลบข้อมูลล้มเหลว: ${error.message}`);
    }
};

// ============================================================
//  5. 🗑️ CLEAR LOCAL DATA (แบบง่าย - ไม่ต้องรหัสยืนยัน)
// ============================================================
window.clearLocalDataSimple = function() {
    if (!confirm("⚠️ ยืนยันลบข้อมูลในเครื่องทั้งหมด?\n\n" +
                 "คุณจะต้องเข้าสู่ระบบใหม่หลังจากนี้")) {
        return;
    }
    
    try {
        // ✅ ล้าง LocalStorage
        localStorage.clear();
        console.log("✅ ล้าง LocalStorage เรียบร้อย");
        
        // ✅ ล้าง SessionStorage
        sessionStorage.clear();
        console.log("✅ ล้าง SessionStorage เรียบร้อย");
        
        // ✅ ล้าง Cache
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                });
            });
        }
        
        alert("✅ ลบข้อมูลในเครื่องสำเร็จ! ระบบจะรีโหลดหน้าเว็บ");
        window.location.reload();
        
    } catch (error) {
        console.error("❌ clearLocalDataSimple error:", error);
        alert(`❌ การลบข้อมูลล้มเหลว: ${error.message}`);
    }
};

// ============================================================
//  6. 🔕 ปิดการแจ้งเตือนแบบถาวร
// ============================================================
window.disableAllAlerts = async function() {
    if (!window.db) {
        alert("❌ ระบบฐานข้อมูลยังไม่พร้อม");
        return;
    }
    
    if (!confirm("⚠️ ยืนยันปิดการแจ้งเตือนทั้งหมด?\n\n" +
                 "📌 การดำเนินการนี้จะ:\n" +
                 "   • รีเซ็ต alert_count ของทุกอุปกรณ์เป็น 0\n" +
                 "   • ตั้งค่า is_acknowledged = true (รับทราบแล้ว)\n" +
                 "   • ล้าง last_alert_time ทั้งหมด\n\n" +
                 "❌ การแจ้งเตือนจะหยุดทำงานจนกว่าจะมีสถานะใหม่")) {
        return;
    }
    
    try {
        const snapshot = await window.get(window.ref(window.db, 'device_configs'));
        if (!snapshot.exists()) {
            alert("📭 ไม่มีข้อมูลอุปกรณ์ในระบบ");
            return;
        }
        
        const configs = snapshot.val();
        let successCount = 0;
        let failCount = 0;
        const failedDevices = [];
        
        for (const [id, config] of Object.entries(configs)) {
            if (config.type === 'board') continue;
            
            try {
                await window.update(window.ref(window.db, `device_configs/${id}`), {
                    alert_count: 0,
                    is_acknowledged: true,
                    last_alert_time: null,
                    updatedAt: new Date().toISOString()
                });
                successCount++;
                console.log(`✅ ปิดการแจ้งเตือน ${id} สำเร็จ`);
            } catch (err) {
                failCount++;
                failedDevices.push(id);
                console.error(`❌ ปิดการแจ้งเตือน ${id} ล้มเหลว:`, err);
            }
        }
        
        let message = '';
        if (failCount === 0) {
            message = `✅ ปิดการแจ้งเตือนทั้งหมด ${successCount} อุปกรณ์เรียบร้อย`;
        } else {
            message = `⚠️ ปิดการแจ้งเตือนสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`;
            if (failedDevices.length > 0) {
                message += `\n\n❌ อุปกรณ์ที่ล้มเหลว:\n${failedDevices.join(', ')}`;
            }
        }
        alert(message);
        
        if (typeof window.eventStateTracker !== 'undefined') {
            window.eventStateTracker = {};
            console.log("🔄 รีเซ็ต eventStateTracker แล้ว");
        }
        
        if (typeof updateStandaloneAlertPanel === 'function') {
            updateStandaloneAlertPanel();
        }
        if (typeof renderDeviceTable === 'function') {
            renderDeviceTable();
        }
        if (typeof renderBoardTable === 'function') {
            renderBoardTable();
        }
        if (typeof renderSummaryTable === 'function') {
            renderSummaryTable();
        }
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        }
        if (typeof renderSensorCards === 'function') {
            renderSensorCards();
        }
        
        console.log("✅ ปิดการแจ้งเตือนทั้งหมดเสร็จสิ้น");
        
    } catch (error) {
        console.error("❌ disableAllAlerts error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    }
};

// ============================================================
//  7. 🔕 เปิดการแจ้งเตือนใหม่
// ============================================================
window.reactivateAlerts = async function() {
    if (!window.db) {
        alert("❌ ระบบฐานข้อมูลยังไม่พร้อม");
        return;
    }
    
    if (!confirm("⚠️ ยืนยันเปิดการแจ้งเตือนใหม่?\n\n" +
                 "📌 การดำเนินการนี้จะ:\n" +
                 "   • ตั้งค่า is_acknowledged = false (ยังไม่รับทราบ)\n" +
                 "   • รีเซ็ต alert_count = 0\n" +
                 "   • ระบบจะเริ่มตรวจจับการแจ้งเตือนใหม่")) {
        return;
    }
    
    try {
        const snapshot = await window.get(window.ref(window.db, 'device_configs'));
        if (!snapshot.exists()) {
            alert("📭 ไม่มีข้อมูลอุปกรณ์ในระบบ");
            return;
        }
        
        const configs = snapshot.val();
        let count = 0;
        
        for (const [id, config] of Object.entries(configs)) {
            if (config.type === 'board') continue;
            
            await window.update(window.ref(window.db, `device_configs/${id}`), {
                is_acknowledged: false,
                alert_count: 0,
                last_alert_time: null,
                updatedAt: new Date().toISOString()
            });
            count++;
        }
        
        alert(`✅ เปิดการแจ้งเตือนใหม่ ${count} อุปกรณ์เรียบร้อย`);
        
        if (typeof window.eventStateTracker !== 'undefined') {
            window.eventStateTracker = {};
            console.log("🔄 รีเซ็ต eventStateTracker แล้ว");
        }
        
        if (typeof updateStandaloneAlertPanel === 'function') {
            updateStandaloneAlertPanel();
        }
        if (typeof renderDeviceTable === 'function') {
            renderDeviceTable();
        }
        if (typeof renderSummaryTable === 'function') {
            renderSummaryTable();
        }
        if (typeof updateStatusBarBoardDetails === 'function') {
            updateStatusBarBoardDetails();
        }
        
    } catch (error) {
        console.error("❌ reactivateAlerts error:", error);
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    }
};

// ============================================================
//  8. 🔕 สร้างปุ่มจัดการการแจ้งเตือนใน Admin Menu
// ============================================================
window.addAlertManagementButtons = function() {
    const adminControls = document.getElementById('adminControls');
    if (!adminControls) {
        console.warn("⚠️ ไม่พบ #adminControls");
        return;
    }
    
    if (adminControls.querySelector('.alert-management-section')) {
        console.log("✅ มีปุ่มจัดการการแจ้งเตือนอยู่แล้ว");
        return;
    }
    
    const section = document.createElement('div');
    section.className = 'alert-management-section';
    section.style.cssText = `
        margin-top: 15px;
        padding-top: 15px;
        border-top: 2px solid #334155;
        width: 100%;
    `;
    
    section.innerHTML = `
        <div style="font-size: 0.9rem; font-weight: bold; color: #f87171; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            🔕 จัดการการแจ้งเตือน
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <button onclick="disableAllAlerts()" 
                    style="width:100%; text-align:left; padding: 12px 20px; border-radius: 12px; 
                           background: linear-gradient(135deg, #dc2626, #b91c1c); color:white; 
                           border:none; cursor:pointer; display: flex; align-items: center; gap: 10px;
                           transition: 0.2s;">
                <span style="font-size: 1.2rem;">🔕</span>
                <span>ปิดการแจ้งเตือนทั้งหมด (Reset All)</span>
            </button>
            
            <button onclick="reactivateAlerts()" 
                    style="width:100%; text-align:left; padding: 12px 20px; border-radius: 12px; 
                           background: linear-gradient(135deg, #059669, #047857); color:white; 
                           border:none; cursor:pointer; display: flex; align-items: center; gap: 10px;
                           transition: 0.2s;">
                <span style="font-size: 1.2rem;">🔔</span>
                <span>เปิดการแจ้งเตือนใหม่ (Reactivate)</span>
            </button>
            
            <button onclick="window.updateStandaloneAlertPanel ? updateStandaloneAlertPanel() : alert('⏳ กำลังโหลด...')" 
                    style="width:100%; text-align:left; padding: 12px 20px; border-radius: 12px; 
                           background: #475569; color:white; 
                           border:none; cursor:pointer; display: flex; align-items: center; gap: 10px;
                           transition: 0.2s;">
                <span style="font-size: 1.2rem;">🔄</span>
                <span>รีเฟรชสถานะการแจ้งเตือน</span>
            </button>
        </div>
        <div style="
            font-size: 0.8rem; 
            line-height: 1.6; 
            color: #cbd5e1; 
            margin-top: 18px; 
            padding: 14px 18px; 
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8)); 
            border-radius: 12px; 
            border: 1px solid #334155;
            border-left: 4px solid #f59e0b; 
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 1.1rem;">💡</span>
                <b style="color: #fcd34d; letter-spacing: 0.5px;">คำแนะนำการจัดการระบบ:</b>
            </div>
            <div style="padding-left: 2px;">
                • <span style="color: #fca5a5; font-weight: 600;">ปิดการแจ้งเตือนทั้งหมด:</span> สำหรับเคลียร์สถานะ Alert ที่ค้างอยู่ (Reset) ของทุกอุปกรณ์ในครั้งเดียว<br>
                • <span style="color: #86efac; font-weight: 600;">เปิดการแจ้งเตือนใหม่:</span> เพื่อให้ระบบเริ่มเฝ้าระวังและพร้อมส่งแจ้งเตือนใหม่อีกครั้งตามเงื่อนไข
            </div>
        </div>
    `;
    
    adminControls.appendChild(section);
    console.log("✅ เพิ่มปุ่มจัดการการแจ้งเตือนใน Admin Menu แล้ว");
};

// ============================================================
//  9. TOGGLE CHART (แสดง/ซ่อน กราฟ)
// ============================================================
window.toggleChart = function() {
    const container = document.getElementById('chartContainer');
    const btn = document.getElementById('chartToggleBtn');
    
    if (!container || !btn) return;
    
    // ตรวจสอบสถานะปัจจุบัน
    const isHidden = container.classList.contains('hidden-chart');
    
    if (isHidden) {
        // แสดงกราฟ
        container.classList.remove('hidden-chart');
        btn.textContent = '🔼 ซ่อนกราฟ';
        btn.classList.remove('shrink');
        // ต้อง resize chart หลังจากแสดง
        setTimeout(() => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        }, 300);
        localStorage.setItem('chartVisible', 'true');
    } else {
        // ซ่อนกราฟ
        container.classList.add('hidden-chart');
        btn.textContent = '🔽 แสดงกราฟ';
        btn.classList.add('shrink');
        localStorage.setItem('chartVisible', 'false');
    }
};

// ============================================================
//  9.1 TOGGLE ANALYTICS (แสดง/ซ่อน Analytics)
// ============================================================
window.toggleAnalytics = function() {
    const section = document.getElementById('analyticsSection');
    const btn = document.getElementById('analyticsToggleBtn');
    
    if (!section || !btn) return;
    
    // ตรวจสอบสถานะปัจจุบัน
    const isHidden = section.classList.contains('hidden-analytics');
    
    if (isHidden) {
        // แสดง Analytics
        section.classList.remove('hidden-analytics');
        btn.textContent = '🔼 ซ่อน Analytics';
        btn.classList.remove('show');
        localStorage.setItem('analyticsVisible', 'true');
    } else {
        // ซ่อน Analytics
        section.classList.add('hidden-analytics');
        btn.textContent = '🔽 แสดง Analytics';
        btn.classList.add('show');
        localStorage.setItem('analyticsVisible', 'false');
    }
};

// ============================================================
//  10. โหลดสถานะการแสดงกราฟจาก LocalStorage
// ============================================================
window.loadChartVisibility = function() {
    // ✅ เปลี่ยนเป็นซ่อนกราฟเป็นค่าเริ่มต้น
    const isVisible = localStorage.getItem('chartVisible');
    
    // ถ้ายังไม่เคยตั้งค่า หรือตั้งค่าเป็น 'false' ให้ซ่อน
    if (isVisible === null || isVisible === 'false') {
        const container = document.getElementById('chartContainer');
        const btn = document.getElementById('chartToggleBtn');
        if (container && btn) {
            container.classList.add('hidden-chart');
            btn.textContent = '🔽 แสดงกราฟ';
            btn.classList.add('shrink');
            localStorage.setItem('chartVisible', 'false');
        }
    } else if (isVisible === 'true') {
        const container = document.getElementById('chartContainer');
        const btn = document.getElementById('chartToggleBtn');
        if (container && btn) {
            container.classList.remove('hidden-chart');
            btn.textContent = '🔼 ซ่อนกราฟ';
            btn.classList.remove('shrink');
        }
    }
};

// ============================================================
//  10.1 โหลดสถานะการแสดง Analytics จาก LocalStorage
// ============================================================
window.loadAnalyticsVisibility = function() {
    // ✅ ซ่อน Analytics เป็นค่าเริ่มต้น
    const isVisible = localStorage.getItem('analyticsVisible');
    
    // ถ้ายังไม่เคยตั้งค่า หรือตั้งค่าเป็น 'false' ให้ซ่อน
    if (isVisible === null || isVisible === 'false') {
        const section = document.getElementById('analyticsSection');
        const btn = document.getElementById('analyticsToggleBtn');
        if (section && btn) {
            section.classList.add('hidden-analytics');
            btn.textContent = '🔽 แสดง Analytics';
            btn.classList.add('show');
            localStorage.setItem('analyticsVisible', 'false');
        }
    } else if (isVisible === 'true') {
        const section = document.getElementById('analyticsSection');
        const btn = document.getElementById('analyticsToggleBtn');
        if (section && btn) {
            section.classList.remove('hidden-analytics');
            btn.textContent = '🔼 ซ่อน Analytics';
            btn.classList.remove('show');
        }
    }
};

// ============================================================
//  11. WEATHER SETTINGS - รองรับทั้ง board และ global
// ============================================================

/**
 * บันทึกการตั้งค่าสภาพอากาศ (Global - ใช้ใน Settings Modal)
 */
function saveWeatherPref() {
    const fields = document.querySelectorAll('.weather-field:checked');
    const selected = Array.from(fields).map(cb => cb.value);
    
    // บันทึกลง localStorage
    localStorage.setItem('weatherFields', JSON.stringify(selected));
    
    // บันทึกสถานะ attach
    const attach = document.getElementById('attachWeatherToReport');
    if (attach) {
        localStorage.setItem('attachWeatherToReport', attach.checked ? 'true' : 'false');
    }
    
    showToast('✅ บันทึกการตั้งค่าสภาพอากาศเรียบร้อยแล้ว');
}

/**
 * โหลดการตั้งค่าสภาพอากาศ (Global)
 */
function loadWeatherPref() {
    const saved = localStorage.getItem('weatherFields');
    if (saved) {
        try {
            const fields = JSON.parse(saved);
            document.querySelectorAll('.weather-field').forEach(cb => {
                cb.checked = fields.includes(cb.value);
            });
        } catch(e) {
            console.warn('⚠️ โหลด weatherFields ไม่สำเร็จ:', e);
        }
    }
    
    const attach = localStorage.getItem('attachWeatherToReport');
    if (attach !== null) {
        const el = document.getElementById('attachWeatherToReport');
        if (el) el.checked = attach === 'true';
    }
}

/**
 * บันทึกการตั้งค่าสภาพอากาศสำหรับบอร์ด (Board-specific)
 */
function saveBoardWeatherSettings() {
    const fields = document.querySelectorAll('.board-weather-field:checked');
    const selected = Array.from(fields).map(cb => cb.value);
    
    // ใช้ key เฉพาะบอร์ด
    localStorage.setItem('boardWeatherFields', JSON.stringify(selected));
    
    const attach = document.getElementById('boardAttachWeatherToReport');
    if (attach) {
        localStorage.setItem('boardAttachWeatherToReport', attach.checked ? 'true' : 'false');
    }
    
    showToast('✅ บันทึกการตั้งค่าสภาพอากาศสำหรับบอร์ดเรียบร้อยแล้ว');
    closeBoardWeatherSettings();
}

/**
 * โหลดการตั้งค่าสภาพอากาศสำหรับบอร์ด
 */
function loadBoardWeatherPref() {
    const saved = localStorage.getItem('boardWeatherFields');
    if (saved) {
        try {
            const fields = JSON.parse(saved);
            document.querySelectorAll('.board-weather-field').forEach(cb => {
                cb.checked = fields.includes(cb.value);
            });
        } catch(e) {
            console.warn('⚠️ โหลด boardWeatherFields ไม่สำเร็จ:', e);
        }
    }
    
    const attach = localStorage.getItem('boardAttachWeatherToReport');
    if (attach !== null) {
        const el = document.getElementById('boardAttachWeatherToReport');
        if (el) el.checked = attach === 'true';
    }
}

/**
 * ฟังก์ชันดึงค่าสภาพอากาศที่เลือก (ใช้ในรายงาน)
 * @param {string} type - 'global' หรือ 'board'
 * @returns {string[]} รายการฟิลด์ที่เลือก
 */
function getSelectedWeatherFields(type = 'global') {
    const prefix = type === 'board' ? 'board' : '';
    const key = prefix ? 'boardWeatherFields' : 'weatherFields';
    const saved = localStorage.getItem(key);
    
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) {
            console.warn('⚠️ getSelectedWeatherFields parse error:', e);
            return ['temp', 'humidity', 'description'];
        }
    }
    // ค่าเริ่มต้น
    return ['temp', 'humidity', 'description'];
}

/**
 * ตรวจสอบว่าแนบสภาพอากาศในรายงานหรือไม่
 * @param {string} type - 'global' หรือ 'board'
 * @returns {boolean}
 */
function isWeatherAttachedToReport(type = 'global') {
    const key = type === 'board' ? 'boardAttachWeatherToReport' : 'attachWeatherToReport';
    const val = localStorage.getItem(key);
    return val === 'true';
}

/**
 * ฟังก์ชันดึงข้อมูลสภาพอากาศแบบเต็ม (ใช้ในรายงาน)
 * @param {Object} weatherData - ข้อมูลสภาพอากาศจาก API
 * @param {string} type - 'global' หรือ 'board'
 * @returns {string} ข้อความสภาพอากาศที่จัดรูปแบบ
 */
function getWeatherReportText(weatherData, type = 'global') {
    if (!weatherData || typeof weatherData !== 'object') {
        return 'ไม่มีข้อมูลสภาพอากาศ';
    }
    
    const fields = getSelectedWeatherFields(type);
    const parts = [];
    
    // แปลงฟิลด์เป็นข้อความที่อ่านง่าย
    const fieldMap = {
        'temp': `🌡️ ${weatherData.temp ?? weatherData.temperature ?? 'N/A'}°C`,
        'humidity': `💧 ${weatherData.humidity ?? 'N/A'}%`,
        'description': `🌤️ ${weatherData.description ?? weatherData.weather ?? 'N/A'}`,
        'wind': `💨 ${weatherData.wind ?? weatherData.windSpeed ?? 'N/A'} km/h`,
        'pressure': `📊 ${weatherData.pressure ?? weatherData.pressure ?? 'N/A'} hPa`,
        'feels_like': `🌡️ รู้สึก ${weatherData.feels_like ?? weatherData.feelsLike ?? 'N/A'}°C`,
        'sunrise': `🌅 ${weatherData.sunrise ?? 'N/A'}`,
        'sunset': `🌇 ${weatherData.sunset ?? 'N/A'}`
    };
    
    fields.forEach(field => {
        if (fieldMap[field]) {
            parts.push(fieldMap[field]);
        }
    });
    
    return parts.length > 0 ? parts.join(' | ') : 'ไม่มีข้อมูลสภาพอากาศ';
}

/**
 * เปิด/ปิด Modal การตั้งค่าสภาพอากาศสำหรับบอร์ด
 */
function toggleBoardWeatherSettings() {
    const modal = document.getElementById('boardWeatherSettingsModal');
    if (!modal) return;
    
    const isOpen = modal.style.display === 'flex' || modal.style.display === 'block';
    
    if (isOpen) {
        closeBoardWeatherSettings();
    } else {
        openBoardWeatherSettings();
    }
}

/**
 * เปิด Modal การตั้งค่าสภาพอากาศสำหรับบอร์ด
 */
function openBoardWeatherSettings() {
    const modal = document.getElementById('boardWeatherSettingsModal');
    if (!modal) {
        console.warn('⚠️ ไม่พบ boardWeatherSettingsModal');
        return;
    }
    
    // โหลดค่าปัจจุบัน
    loadBoardWeatherPref();
    
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.style.overflow = 'hidden';
}

/**
 * ปิด Modal การตั้งค่าสภาพอากาศสำหรับบอร์ด
 */
function closeBoardWeatherSettings() {
    const modal = document.getElementById('boardWeatherSettingsModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// ============================================================
//  12. TOAST NOTIFICATION
// ============================================================
function showToast(message, duration = 3000) {
    // ลบ toast เก่าถ้ามี
    const old = document.querySelector('.custom-toast');
    if (old) old.remove();
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #0d2b1a;
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 99999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        max-width: 90%;
        text-align: center;
        border: 1px solid rgba(255,255,255,0.1);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================
//  13. เพิ่ม CSS animation สำหรับ Toast (ถ้ายังไม่มี)
// ============================================================
(function injectToastStyles() {
    if (document.querySelector('#toast-style')) return;
    
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
        @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
})();

// ============================================================
//  14. EXPORT
// ============================================================
window.waitForModules = waitForModules;
window.startApp = startApp;
window.loadChartVisibility = loadChartVisibility;
window.loadAnalyticsVisibility = loadAnalyticsVisibility;

// Export Weather Functions
window.saveWeatherPref = saveWeatherPref;
window.loadWeatherPref = loadWeatherPref;
window.saveBoardWeatherSettings = saveBoardWeatherSettings;
window.loadBoardWeatherPref = loadBoardWeatherPref;
window.getSelectedWeatherFields = getSelectedWeatherFields;
window.isWeatherAttachedToReport = isWeatherAttachedToReport;
window.getWeatherReportText = getWeatherReportText;
window.toggleBoardWeatherSettings = toggleBoardWeatherSettings;
window.openBoardWeatherSettings = openBoardWeatherSettings;
window.closeBoardWeatherSettings = closeBoardWeatherSettings;
window.showToast = showToast;

// ============================================================
//  15. เริ่มต้นเมื่อ DOM พร้อม
// ============================================================
if (document.readyState === 'loading') {
    console.log("⏳ รอ DOM โหลด...");
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (typeof window.addAlertManagementButtons === 'function') {
                window.addAlertManagementButtons();
            }
        }, 1500);
        startApp();
        // ✅ โหลดสถานะการแสดงกราฟ (ซ่อนเป็นค่าเริ่มต้น)
        setTimeout(loadChartVisibility, 800);
        // ✅ โหลดสถานะการแสดง Analytics (ซ่อนเป็นค่าเริ่มต้น)
        setTimeout(loadAnalyticsVisibility, 900);
        // ✅ โหลดการตั้งค่าสภาพอากาศ
        setTimeout(() => {
            loadWeatherPref();
            loadBoardWeatherPref();
            console.log('✅ โหลดการตั้งค่าสภาพอากาศเรียบร้อย');
        }, 1000);
    });
} else {
    console.log("✅ DOM โหลดเสร็จแล้ว");
    setTimeout(() => {
        if (typeof window.addAlertManagementButtons === 'function') {
            window.addAlertManagementButtons();
        }
    }, 1500);
    setTimeout(startApp, 100);
    // ✅ โหลดสถานะการแสดงกราฟ (ซ่อนเป็นค่าเริ่มต้น)
    setTimeout(loadChartVisibility, 800);
    // ✅ โหลดสถานะการแสดง Analytics (ซ่อนเป็นค่าเริ่มต้น)
    setTimeout(loadAnalyticsVisibility, 900);
    // ✅ โหลดการตั้งค่าสภาพอากาศ
    setTimeout(() => {
        loadWeatherPref();
        loadBoardWeatherPref();
        console.log('✅ โหลดการตั้งค่าสภาพอากาศเรียบร้อย');
    }, 1000);
}

console.log("✅ main.js พร้อมทำงาน (เวอร์ชัน 2.5)");