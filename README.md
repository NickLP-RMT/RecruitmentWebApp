# Recruitment Web App (Starter)

Starter project สำหรับระบบรับสมัครงาน + แบบทดสอบออนไลน์ โดยเก็บข้อมูลในไฟล์ JSON ชั่วคราว และเตรียมจุดเชื่อม Google Sheets ไว้แล้ว

## Run

```bash
node server.js
```

เปิดใช้งานที่ `http://localhost:3000`

## Pages

- `/` หน้า Applicant (Job Openings, Apply Now, Online Test)
- `/admin.html` หน้า HR/Admin (ค้นหา, ดูผู้สมัคร, เปลี่ยนสถานะ)

## API

- `GET /api/health`
- `GET /api/tests/sample`
- `POST /api/tests/score`
- `POST /api/applications`
- `GET /api/admin/applicants`
- `PUT /api/admin/applicants/:id`

## Google Sheets Integration

ระบบรองรับ webhook แบบง่ายผ่าน env:

- `GOOGLE_SHEETS_WEBHOOK_URL`

เมื่อมีผู้สมัครใหม่หรือเปลี่ยนสถานะ ระบบจะ POST payload ไปยัง URL นี้

## Notes

- โค้ดชุดนี้เป็น starter MVP
- ไฟล์แนบตอนนี้เก็บเฉพาะชื่อไฟล์ในฐานข้อมูล
- ก่อนใช้งานจริงควรเพิ่ม auth, upload จริง (Drive), RBAC, PDPA flow, audit log
