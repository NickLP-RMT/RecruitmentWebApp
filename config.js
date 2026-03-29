window.APP_CONFIG = {
  // ใส่ URL จาก Apps Script ที่ Deploy เป็น Web App แล้ว
  // ตัวอย่าง: https://script.google.com/macros/s/AKfycb.../exec
  apiEndpoint: "",

  // token แบบง่าย (optional) ต้องตรงกับใน Code.gs
  apiToken: "",

  // ถ้า true จะโหลดข้อสอบจาก Google Sheet ผ่าน API
  // ถ้า false จะใช้ข้อสอบตัวอย่างใน frontend
  useApiForTests: false
};
