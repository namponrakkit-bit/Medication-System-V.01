# 🔒 ระบบความปลอดภัย - ระบบจัดการยา v.01

## ✅ มาตรการรักษาความปลอดภัยที่ได้ยึดถือ

### 1. XSS (Cross-Site Scripting) Prevention
- ✅ **HTML Escaping**: ใช้ `escapeHtml()` สำหรับทุกข้อมูลที่ render ลง DOM
- ✅ **Attribute Escaping**: เข้ารหัส data attributes ที่เก็บข้อมูลผู้ใช้
- ✅ **Content Security Policy (CSP)**: ตั้งค่า meta tag เพื่อจำกัด script sources

### 2. Input Validation & Sanitization
- ✅ **String Sanitization**: `sanitizeInput()` จำกัดความยาว 500 ตัวอักษร
- ✅ **Number Validation**: `validateNumber()` ตรวจสอบช่วงค่า
- ✅ **Date Validation**: `validateDate()` ตรวจสอบรูปแบบ ISO 8601
- ✅ **Email Validation**: `validateEmail()` สำหรับอีเมลแอดมิน
- ✅ **Type Checking**: ตรวจสอบประเภท input ก่อนการประมวลผล

### 3. Sensitive Data Protection
- ✅ **LINE Token ซ่อน**: ไม่แสดง Token ใน Frontend - เก็บเฉพาะ Backend
- ✅ **Password/Token ไม่ cache**: ไม่เก็บข้อมูลที่เป็นความลับใน localStorage
- ✅ **HTTPS Only**: ต้องใช้ HTTPS เมื่อ deploy

### 4. Authentication & Authorization
- ⚠️ **Backend RBAC**: ต้องตรวจสอบสิทธิ์ user ใน .gs backend
- ⚠️ **Admin Email Verification**: เช็ค admin emails ก่อน allow edit operations
- ⚠️ **User Tracking**: บันทึก user ที่ทำ action ทั้งหมด (audit log)

### 5. API Security
- ✅ **No Hardcoded Secrets**: ไม่มี API keys/tokens ใน HTML
- ⚠️ **CORS**: ต้องตั้งค่า allowable origins ใน Google Apps Script
- ⚠️ **Rate Limiting**: ควรตั้ง quota ใน backend

---

## ⚠️ จุดที่ต้องขยายเพิ่มเติมใน Backend (.gs)

### Priority 1: ขาดไม่ได้
1. **Authentication Check** ทุก function
   ```javascript
   function getInitialData() {
     const user = Session.getActiveUser();
     if (!user) throw new Error('Unauthorized');
     
     const adminEmails = getAdminEmails();
     if (adminEmails && !adminEmails.includes(user.getEmail())) {
       throw new Error('Access denied - not an admin');
     }
     // ...
   }
   ```

2. **Audit Logging** - บันทึก action ทั้งหมด
   ```javascript
   function logAction(userId, action, details) {
     const sheet = SpreadsheetApp.getActive().getSheetByName('AuditLog');
     sheet.appendRow([
       new Date(),
       userId,
       action,
       JSON.stringify(details),
       Session.getActiveUser().getEmail()
     ]);
   }
   ```

3. **Data Validation ใน Backend**
   ```javascript
   function addMedicine(data) {
     // Validate all fields
     if (!data['ชื่อยา'] || data['ชื่อยา'].trim().length === 0) {
       throw new Error('ชื่อยาว่าง');
     }
     if (data['จำนวนคงเหลือ'] && data['จำนวนคงเหลือ'] < 0) {
       throw new Error('จำนวนไม่ถูกต้อง');
     }
     // ...
   }
   ```

### Priority 2: ควรมี
4. **Encryption สำหรับข้อมูลอ่อนไหว**
   - ใช้ Google Cloud KMS หรือ Cipher API
   - encrypt LINE Token, Admin Emails

5. **Rate Limiting**
   - จำกัด API calls per user per minute
   - ป้องกัน DoS attack

6. **Input Length Limits**
   - DB schema ต้องมี field length constraints

---

## 🔐 Best Practices ที่กำลังใช้

### Frontend Level
```javascript
// ✅ SAFE: Escape HTML
const name = escapeHtml(medicine.name);
element.textContent = name; // ปลอดภัย

// ✅ SAFE: Use data attributes
button.dataset.id = escapeHtml(String(id));

// ✅ SAFE: Validate before send
if (!validateNumber(qty, 0)) {
  showToast('Invalid quantity', 'error');
  return;
}
```

### What NOT to do
```javascript
// ❌ UNSAFE: Direct innerHTML with user data
element.innerHTML = `<div>${medicine.name}</div>`;

// ❌ UNSAFE: Eval or Function
eval(userData); // NEVER

// ❌ UNSAFE: Trust user input
const html = userInput + '<script>alert("xss")</script>';
element.innerHTML = html;
```

---

## 📋 Deployment Checklist

### Before Deploy to Production
- [ ] Confirm HTTPS is enforced
- [ ] Set admin emails in Admin Settings
- [ ] Test RBAC permissions
- [ ] Enable audit logging
- [ ] Set up Google Cloud KMS for secrets
- [ ] Configure CORS properly
- [ ] Review all API responses (no secrets)
- [ ] Test with malicious input (fuzzing)

### Google Apps Script Settings
```
Deploy > New deployment > Web app
- Execute as: Your email
- Who has access: 
  * Option 1: Only you (private)
  * Option 2: Specific Google accounts (set in admin settings)
  * Option 3: Anyone with the link (use with RBAC in code)
```

---

## 🚨 Security Headers ที่ควรมี

```html
<!-- ✅ Content Security Policy -->
<meta http-equiv="Content-Security-Policy" 
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'">

<!-- ✅ Prevent Clickjacking -->
<meta http-equiv="X-Frame-Options" content="DENY">

<!-- ✅ MIME Type Sniffing -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">

<!-- ✅ Referrer Policy -->
<meta name="referrer" content="strict-origin-when-cross-origin">
```

---

## 🔄 Incident Response

หากพบความผิดปกติ:
1. Check Audit Log ใน Google Sheet
2. Review `google.script.run` error messages
3. Verify user permissions
4. Revert changes if necessary
5. Update password/tokens ถ้าเสียหาย

---

## 📞 Contact & Support

สำหรับปัญหาความปลอดภัย:
- ติดต่อ Admin ของ Google Sheet
- ตรวจสอบ Audit Log
- Review การตั้งค่า Admin Settings

**Update: 2026-08-06**
