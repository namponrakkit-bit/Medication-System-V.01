# Performance Guide — ระบบจัดการยา

อัปเดตตามโค้ดปัจจุบัน (2026-08-12)

---

## สถานะปัจจุบัน (จากโค้ดจริง)

### Flow การโหลด

```
เปิดเว็บ → getInitialData()
         ├─ getAllMedicines()     อ่านชีตทั้งก้อน
         ├─ getCatalogFromMeds_() วนซ้ำสร้าง catalog
         ├─ getOptions()
         └─ getClientSettings_()

สลับแท็บ RxEbox → loadBoxes() → getBoxesData()  (RPC ครั้งที่ 2)

ค้นหา/กรอง → applyFilters() O(n) ทุกครั้ง
           → renderMoreMeds() 50 รายการ/ครั้ง (RENDER_PAGE_SIZE)
```

### จุดช้าหลัก

| จุด | สถานะ | ผลกระทบโดยประมาณ |
|---|---|---|
| `getInitialData()` โหลดยาทั้งชีต + catalog | ยังทำ | 2–5s เมื่อยา >1,000 |
| `applyFilters()` scan ทุกฟิลด์ O(n) | ยังทำ | 200ms+ เมื่อข้อมูลเยอะ |
| Autocomplete `medCatalog.forEach` | O(n) | 150ms+ |
| `loadBoxes()` แยก RPC เมื่อสลับแท็บ | ยังทำ | หน่วงสลับ RxEbox |
| Render 50 รายการ/ครั้ง (`renderMoreMeds`) | **ทำแล้ว** | ดีหลัง filter |
| `listUsers()` ตอนเปิดตั้งค่า | **ลบแล้ว** | ลด 1 RPC |

### สิ่งที่ optimize แล้ว

1. **Client-side pagination** — `RENDER_PAGE_SIZE = 50` ใน [`gas/Scripts.html`](gas/Scripts.html)
2. **Debounce ค้นหา** — 300ms ก่อน `applyFilters()`
3. **Input validation ก่อน API** — ลด invalid requests
4. **ลบ listUsers จากหน้าตั้งค่า** — เปิด modal เร็วขึ้นเล็กน้อย

---

## เกณฑ์แนะนำ

| จำนวนยา | สถานะ | แนะนำ |
|---|---|---|
| < 1,000 | ใช้ได้ดี | ไม่ต้อง optimize |
| 1,000–5,000 | ควร monitor | สังเกตเวลาโหลดและค้นหา |
| > 5,000 | ช้าชัด | ต้อง server-side pagination |

---

## Optimization ถัดไป (ยังไม่ทำ)

### Priority 1 — เมื่อข้อมูล > 5,000

**Server-side pagination** — API มีแล้วใน [`gas/Medicine.gs`](gas/Medicine.gs):
- `getMedicineStats()` — สรุปจำนวนตามสถานะ
- `searchMedicines({ q, category, location, expiry, had, page, pageSize })` — หน้าละ ~50

Frontend ยังโหลดทั้งหมดผ่าน `getInitialData()` — ต้องสลับมาใช้ `searchMedicines` เมื่อข้อมูลโต

### Priority 2

1. **Search index** สำหรับ autocomplete (O(1) แทน O(n))
2. **Lazy load boxes** — โหลดเมื่อสลับแท็บ (ทำอยู่แล้ว) หรือ prefetch หลัง initial load
3. **รวม catalog** — สร้างตอน backend ครั้งเดียว ไม่วนซ้ำใน `getCatalogFromMeds_`

### Priority 3

- Virtual scrolling สำหรับ list view
- CSS minification

---

## Benchmark เป้าหมาย

| Action | ปัจจุบัน (ยา ~1,000) | หลัง optimize (ยา >5,000) |
|---|---|---|
| Initial load | 1–2s | <1s (paginated) |
| Render หลัง filter | 200ms | 200ms |
| Autocomplete | 50–150ms | <10ms (index) |
| เปิดตั้งค่า | <500ms | <500ms |

---

## วิธีเช็ค performance

### Browser DevTools Console

```javascript
console.time('filter');
applyFilters();
console.timeEnd('filter');
```

### GAS Execution log

```javascript
function logExecutionTime() {
  const start = new Date();
  // ... do something ...
  Logger.log('Execution time: ' + (new Date() - start) + 'ms');
}
```

---

## เมื่อไหร่ควร optimize

- **DO** optimize: โหลด >2s, ผู้ใช้บ่น, ยา >5,000
- **DON'T** optimize: โหลด <1s, ยา <1,000, ไม่มี complaint

**Last Updated**: 2026-08-12
