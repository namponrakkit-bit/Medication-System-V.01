# คู่มือ Deploy + สิทธิ์ (RBAC) — ระบบจัดการยา & กล่องยา (RxEbox)

ระบบนี้ทำงานบน **Google Apps Script (GAS) + Google Sheets** โค้ดทั้งหมดถูกแยกเป็นไฟล์ย่อยในโฟลเดอร์ [`gas/`](gas/) เพื่อให้ดูแลง่าย

---

## 1. โครงสร้างไฟล์ (mirror ของโปรเจกต์ GAS)

| ไฟล์ในโฟลเดอร์ `gas/` | ชนิดใน GAS | หน้าที่ |
|---|---|---|
| `Config.gs` | Script | ค่าคงที่: ชื่อชีต, หัวตาราง, ค่าคงที่ LINE |
| `Main.gs` | Script | `doGet` (Web App entry) + `include()` |
| `Auth.gs` | Script | `getUserEmail_`, `isAdmin_`, `requireAdmin_`, `getCurrentUser` |
| `SheetHelpers.gs` | Script | เปิดชีต, `rowToObject_` |
| `Settings.gs` | Script | ตั้งค่าระบบ (`getAdminSettings` ภายใน / `getClientSettings_` ปลอดภัย) |
| `Medicine.gs` | Script | CRUD คลังยา + `getInitialData` + `getMedicineStats`/`searchMedicines` |
| `Options.gs` | Script | หมวดหมู่ / ที่จัดเก็บ |
| `ExportNotify.gs` | Script | สถานะวันหมดอายุ, Export CSV/Sheet, แจ้งเตือน LINE |
| `Boxes.gs` | Script | RxEbox ทั้งหมด |
| `Users.gs` | Script | จัดการผู้ใช้/บทบาท (แท็บ `Users`) |
| `Index.html` | HTML | โครงหน้า + `include('Styles')` / `include('Scripts')` |
| `Styles.html` | HTML | CSS ทั้งหมด |
| `Scripts.html` | HTML | JavaScript ทั้งหมด |
| `appsscript.json` | Manifest | timezone + ค่า Web App |

> ใน GAS: ไฟล์ `.gs` ใช้ **global scope ร่วมกัน** จึงเรียกฟังก์ชัน/ค่าคงที่ข้ามไฟล์ได้เลย ส่วนไฟล์ HTML สร้างด้วยเมนู **File → New → HTML file** โดยใช้ชื่อ `Index`, `Styles`, `Scripts` (ไม่ต้องพิมพ์ `.html`)

---

## 2. วิธีนำโค้ดขึ้น GAS

### 2.1 คัดลอกเอง (ง่ายสุด)
1. เปิดโปรเจกต์ Apps Script ที่ผูกกับ Google Sheet ของคลังยา
2. สร้างไฟล์ให้ตรงชื่อในตารางด้านบน แล้ววางเนื้อหาจากโฟลเดอร์ `gas/`
   - ไฟล์ HTML สร้างชื่อ `Index`, `Styles`, `Scripts`
3. บันทึกทุกไฟล์

### 2.2 ใช้ clasp (ลดการ copy-paste ผิดพลาด — แนะนำเมื่อแก้บ่อย)
```bash
npm install -g @google/clasp
clasp login
# ในโฟลเดอร์ gas/  (ครั้งแรก: clasp clone <scriptId> หรือ clasp create)
cd gas
clasp push
```
> clasp จะแปลง `.gs` เป็น `.js` ให้อัตโนมัติเมื่อ push ส่วนไฟล์ HTML ใช้ชื่อเดิม

---

## 3. ตั้งค่า Script Properties (ครั้งแรก)

ไปที่ **Project Settings → Script Properties** แล้วเพิ่ม:

| Key | ค่า | จำเป็น |
|---|---|---|
| `ADMIN_EMAILS` | อีเมลแอดมิน คั่นด้วยจุลภาค เช่น `a@hosp.go.th, b@hosp.go.th` | แนะนำอย่างยิ่ง |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token | เฉพาะถ้าใช้แจ้งเตือน |
| `LINE_TARGET_ID` | User/Group ID ปลายทาง | เฉพาะถ้าใช้แจ้งเตือน |
| `SHEET_ID` | ID ของ Spreadsheet (ถ้าไม่ผูกกับชีตโดยตรง) | ไม่บังคับ |
| `RED_MONTHS` / `YELLOW_MONTHS` | เกณฑ์เดือนแดง/เหลือง (ตั้งผ่านหน้าเว็บได้) | ไม่บังคับ |

> LINE token ตั้งผ่านหน้าเว็บ (โมดัลตั้งค่า) ได้เช่นกัน และ **จะไม่ถูกส่งกลับมาที่ frontend** อีก — หน้าเว็บเห็นแค่สถานะ "ตั้งค่าไว้แล้ว/ยังไม่ได้ตั้งค่า" เท่านั้น เว้นช่อง token ว่างไว้ = คงค่าเดิม

---

## 4. Deploy เป็น Web App (สำคัญต่อ RBAC)

**Deploy → New deployment → Web app** แล้วตั้งค่า:

- **Execute as: `User accessing the web app`** ← ต้องเป็นแบบนี้
- **Who has access: `Anyone with Google account`** (หรือจำกัดเฉพาะโดเมนองค์กร)

เหตุผล: RBAC ในระบบใช้ `Session.getActiveUser().getEmail()` เพื่อดูว่าอีเมลผู้ใช้อยู่ใน `ADMIN_EMAILS` หรือไม่ ถ้า Deploy เป็น *Execute as: Me* ระบบจะได้อีเมลเจ้าของสคริปต์เสมอ ทำให้ RBAC ไม่ทำงาน

> ทุกครั้งที่แก้โค้ดแล้วต้องการให้ผู้ใช้เห็นเวอร์ชันใหม่: **Deploy → Manage deployments → แก้ deployment เดิม → Version: New version**

---

## 5. RBAC ทำงานอย่างไร (3 บทบาท)

ระบบสิทธิ์เป็นแบบ **capability** กำหนดที่เดียวใน `ROLE_CAPS` ([`gas/Auth.gs`](gas/Auth.gs))

| ความสามารถ | แอดมิน | เภสัชกร | พยาบาล |
|---|:---:|:---:|:---:|
| ดู / ค้นหา | ✅ | ✅ | ✅ |
| เพิ่ม/แก้ไข/ลบยา (คลังหลัก) | ✅ | ✅ | ❌ |
| จัดการหมวดหมู่ / ที่จัดเก็บ | ✅ | ✅ | ❌ |
| Export CSV / Sheet | ✅ | ✅ | ❌ |
| จัดการกล่องยา (สร้าง/ลบ/ย้ายแผนก/ยาในกล่อง) | ✅ | ✅ | ❌ |
| ตั้งค่าระบบ (LINE/เกณฑ์เตือน) | ✅ | ❌ | ❌ |
| จัดการผู้ใช้/สิทธิ์ | ✅ | ❌ | ❌ |

- Backend: ทุก write path เรียก `require_(capability)` ก่อนเสมอ — กันการยิงตรงจาก client
- Frontend: `getInitialData()` คืน `currentUser = { email, role, roleLabel, caps }` แล้วซ่อน/แสดงปุ่มตาม `caps`
- ป้ายมุมขวาบนแสดงบทบาท: `🔓 แอดมิน` / `🧪 เภสัชกร` / `👁️ ดูอย่างเดียว` พร้อมอีเมล

### การกำหนดบทบาทให้ผู้ใช้
1. อีเมลใน `ADMIN_EMAILS` (Script Property) หรือ `DEFAULT_ADMIN_EMAILS` (ในโค้ด) = **admin เสมอ** (safety net กันล็อกตัวเองออก ลบผ่านหน้าเว็บไม่ได้)
2. อีเมลอื่นดูจากแท็บ **`Users`** ในชีต (คอลัมน์ `email | role | name`, role = `admin`/`pharmacist`/`nurse`)
3. ไม่พบในทั้งสองที่ = `nurse` (ดูอย่างเดียว) โดยอัตโนมัติ

จัดการผู้ใช้ได้ 2 ทาง: ผ่านปุ่ม **👥 ผู้ใช้ / สิทธิ์** ในหน้าเว็บ (เฉพาะแอดมิน) หรือแก้แท็บ `Users` ในชีตตรงๆ

> ตรวจสิทธิ์ตัวเองได้โดย Run ฟังก์ชัน `whoAmI` ใน GAS editor แล้วดู `role` / `caps` ใน Execution log

---

## 6. รองรับข้อมูลจำนวนมาก (พร้อมใช้เมื่อจำเป็น)

หน้าเว็บ render การ์ดยาแบบแบ่งหน้า (ครั้งละ 50 รายการ + ปุ่ม "โหลดเพิ่ม") กัน DOM ค้างเมื่อรายการเยอะ

เมื่อคลังยาโตถึงหลักพัน สามารถสลับมาโหลดข้อมูลแบบหน้าได้ด้วย API ที่เตรียมไว้แล้ว:
- `getMedicineStats()` → คืนสรุปจำนวนตามสถานะ โดยไม่ส่งรายการทั้งหมด
- `searchMedicines({ q, category, location, expiry, had, page, pageSize })` → คืนหน้าละ ~50 รายการ + `total`, `totalPages`

---

## 7. Trigger แจ้งเตือนอัตโนมัติ (ไม่บังคับ)

รันฟังก์ชัน `createDailyTrigger()` หนึ่งครั้งใน GAS editor เพื่อตั้งแจ้งเตือน LINE ทุกวัน 08:00 น.
