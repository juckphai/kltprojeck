const CACHE_NAME = 'kltsscoke-cache-v119';
// รายชื่อไฟล์ที่ต้องการให้โหลดได้แม้ไม่มีเน็ต
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './core.js',
  './sensors.js',
  './telegram.js',
  './manifest.json',
  '/192.png',
  '/512.jpg',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ติดตั้งและเก็บไฟล์ลง Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// ล้าง Cache เก่าเมื่อมีการอัปเดตเวอร์ชัน
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// กลยุทธ์การดึงข้อมูล: Network First (พยายามดึงจากเน็ตก่อน ถ้าไม่มีค่อยดึงจาก Cache)
// เหมาะสำหรับแอปที่มีข้อมูล Real-time อย่าง Smart Farm
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firebasedatabase') || event.request.url.includes('openweathermap')) {
    return; // ไม่ต้อง Cache ข้อมูลจาก Firebase หรือ Weather API เพราะต้องการค่าล่าสุดเสมอ
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
