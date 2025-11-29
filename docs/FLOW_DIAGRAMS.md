# HMS Backend Flow Diagrams

## 1. Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN FLOW                          │
└─────────────────────────────────────────────────────────────────┘

[Client]
    │
    │ POST /api/auth/login
    │ { email, password }
    │
    ▼
[Auth Controller]
    │
    │ 1. Check Main Database
    │    └─> User.findOne({ email })
    │
    │ 2. If Not Found
    │    └─> Get All Active Hospitals
    │        └─> For Each Hospital:
    │            ├─> createTenantDB(tenantId)
    │            ├─> TenantUser.findOne({ email })
    │            └─> If Found: Break Loop
    │
    │ 3. Validate Password
    │    └─> bcrypt.compare(password, user.password)
    │
    │ 4. Check User Status
    │    └─> status === "ACTIVE"?
    │    └─> forcePasswordChange === false?
    │
    │ 5. Update lastLogin
    │
    │ 6. Generate Tokens
    │    ├─> generateAccessToken(user)
    │    └─> generateRefreshToken(user)
    │
    │ 7. Set Refresh Token Cookie
    │
    ▼
[Response]
    {
      accessToken,
      refreshToken (in cookie),
      user info,
      hospital info
    }
```

## 2. Multi-Tenant Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROTECTED ROUTE REQUEST                       │
└─────────────────────────────────────────────────────────────────┘

[Client Request]
    │
    │ GET /api/patients/search
    │ Headers:
    │   Authorization: Bearer {accessToken}
    │   x-hospital-id: {hospitalId}
    │
    ▼
[Auth Middleware]
    │
    │ 1. Extract Token
    │    └─> req.headers.authorization.split(" ")[1]
    │
    │ 2. Verify JWT
    │    └─> jwt.verify(token, JWT_ACCESS_SECRET)
    │    └─> Extract: { id, hospitalId, roles }
    │
    │ 3. Load User
    │    ├─> Try Main DB: User.findById(id)
    │    └─> If Not Found & hospitalId exists:
    │        ├─> Get Hospital → Get tenantId
    │        ├─> createTenantDB(tenantId)
    │        └─> TenantUser.findById(id)
    │
    │ 4. Populate Roles
    │    └─> Role.find({ _id: { $in: user.roles } })
    │
    │ 5. Attach to Request
    │    └─> req.user = { id, roles, hospitalId, ... }
    │
    ▼
[Tenant Middleware]
    │
    │ 1. Extract hospitalId
    │    └─> req.hospitalId || req.body.hospitalId || req.headers["x-hospital-id"]
    │
    │ 2. Find Hospital
    │    └─> Hospital.findById(hospitalId)
    │
    │ 3. Validate Status
    │    └─> hospital.status === "ACTIVE"?
    │
    │ 4. Attach Tenant Info
    │    └─> req.tenant = { id, name, tenantId }
    │
    ▼
[Permission Middleware]
    │
    │ 1. Get User Roles
    │    └─> Role.find({ _id: { $in: req.user.roles } })
    │
    │ 2. Collect Permissions
    │    └─> roles.forEach(role => permissions.add(...))
    │
    │ 3. Check Required Permission
    │    └─> userPermissions.has("PATIENT:READ")?
    │
    │ 4. Allow or Deny
    │
    ▼
[ABAC Middleware] (Optional)
    │
    │ 1. Get User Attributes
    │    └─> department, specialization, shift
    │
    │ 2. Apply Filters
    │    └─> req.abacFilter = { department: user.department }
    │
    ▼
[Controller]
    │
    │ 1. Get Tenant Connection
    │    └─> createTenantDB(req.tenant.tenantId)
    │
    │ 2. Use Tenant Models
    │    └─> TenantPatient.find({ ...req.abacFilter })
    │
    │ 3. Return Response
    │
    ▼
[Response to Client]
```

## 3. Hospital Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOSPITAL ONBOARDING FLOW                      │
└─────────────────────────────────────────────────────────────────┘

[Step 1: Registration]
    │
    │ POST /api/hospital/register
    │ { name, address, phone, email, licenseNumber }
    │
    ▼
[Hospital Controller]
    │
    │ 1. Validate License Uniqueness
    │    └─> Hospital.findOne({ licenseNumber })
    │
    │ 2. Generate Tenant ID
    │    └─> tenantId = `hms_${uuid().slice(0,8)}`
    │
    │ 3. Generate Verification Token
    │    └─> crypto.randomBytes(32)
    │
    │ 4. Create Hospital Record
    │    └─> Hospital.create({
    │          name, address, phone, email, licenseNumber,
    │          tenantId, verificationToken, tokenExpiry
    │          status: "PENDING"
    │        })
    │
    │ 5. Create Tenant Database
    │    └─> createTenantDB(tenantId)
    │        └─> mongoose.createConnection(`${MONGO_URI}${tenantId}`)
    │
    │ 6. Create HOSPITAL_ADMIN Role
    │    └─> Role.findOne({ name: "HOSPITAL_ADMIN" }) || Role.create(...)
    │
    │ 7. Create Admin User in Tenant DB
    │    └─> createTenantAdmin(connection, hospital, roleId)
    │        ├─> email = `admin@${hospital-domain}`
    │        ├─> password = `Admin@${random}`
    │        └─> TenantUser.create({ ... })
    │
    │ 8. Send Verification Email
    │    └─> sendHospitalVerification(email, verificationLink)
    │
    ▼
[Response]
    {
      message: "Hospital registered. Verification mail sent.",
      tenantId,
      adminEmail,
      adminTemporaryPassword
    }

[Step 2: Email Verification]
    │
    │ Hospital clicks link in email
    │ GET /api/hospital/verify/{tenantId}/{token}
    │
    ▼
[Hospital Controller - verifyHospital]
    │
    │ 1. Find Hospital by Token
    │    └─> Hospital.findOne({ verificationToken: token, tokenExpiry > now })
    │
    │ 2. Update Status
    │    └─> hospital.status = "VERIFIED"
    │    └─> Clear verificationToken
    │
    │ 3. Get Tenant Connection
    │    └─> createTenantDB(tenantId)
    │
    │ 4. Get Admin Credentials
    │    └─> TenantUser.findOne({ roles: hospitalAdminRole._id })
    │
    │ 5. Send Credentials Email
    │    └─> sendHospitalCredentials(hospital.email, admin.email, admin.password)
    │
    ▼
[Response: HTML Page]
    "✅ Hospital Activated Successfully"

[Step 3: Activation (Optional - by Super Admin)]
    │
    │ PUT /api/admin/hospital/{id}/status
    │ { status: "ACTIVE" }
    │
    ▼
[Admin Controller]
    │
    │ 1. Validate Status Flow
    │    └─> PENDING → VERIFIED → ACTIVE
    │
    │ 2. Update Hospital Status
    │    └─> hospital.status = "ACTIVE"
    │
    │ 3. Send Status Email
    │
    ▼
[Hospital is now ACTIVE and ready to use]
```

## 4. User Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CREATE USER FLOW                            │
└─────────────────────────────────────────────────────────────────┘

[Hospital Admin]
    │
    │ POST /api/users/create
    │ Headers: Authorization, x-hospital-id
    │ Body: { firstName, lastName, email, password, roleIds, ... }
    │
    ▼
[User Controller]
    │
    │ 1. Validate Password Policy
    │    └─> validatePassword(password)
    │        ├─> Min 8 chars?
    │        ├─> Has uppercase?
    │        ├─> Has lowercase?
    │        ├─> Has number?
    │        └─> Has special char?
    │
    │ 2. Get Hospital Info
    │    └─> Hospital.findById(req.user.hospitalId)
    │
    │ 3. Generate Username
    │    └─> generateUniqueUsername(User, firstName, lastName, hospitalEmail)
    │        └─> Format: `{firstName}.{lastName}@{hospital-domain}`
    │
    │ 4. Hash Password
    │    └─> bcrypt.hash(password, 10)
    │
    │ 5. Prepare User Data
    │    └─> {
    │          firstName, lastName, email, username, phone,
    │          password: hashedPassword,
    │          roles: roleIds,
    │          department, specialization,
    │          passwordHistory: [{ password: hashedPassword }],
    │          forcePasswordChange: true,
    │          status: "ACTIVE"
    │        }
    │
    │ 6. Determine Database
    │    ├─> If req.tenant exists:
    │    │   └─> Create in Tenant DB
    │    │       └─> createTenantDB(tenantId)
    │    │       └─> TenantUser.create(userData)
    │    └─> Else:
    │        └─> Create in Main DB
    │            └─> User.create(userData)
    │
    │ 7. Send Welcome Email
    │    └─> sendWelcomeEmail(email, username, password, firstName)
    │
    ▼
[Response]
    {
      message: "User Created Successfully",
      user: { ... } (password excluded)
    }

[New User]
    │
    │ 1. Receives Welcome Email
    │    └─> Contains: username, temporary password
    │
    │ 2. Logs In
    │    └─> POST /api/auth/login
    │
    │ 3. System Detects forcePasswordChange = true
    │    └─> Returns: { message: "Password change required", forcePasswordChange: true }
    │
    │ 4. User Changes Password
    │    └─> POST /api/auth/change-password
    │        { oldPassword, newPassword }
    │
    │ 5. Password Validated
    │    └─> Check policy, check history
    │
    │ 6. Password Updated
    │    └─> forcePasswordChange = false
    │
    ▼
[User can now access system]
```

## 5. Patient Registration & Prescription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PATIENT & PRESCRIPTION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

[Step 1: Register Patient]
    │
    │ POST /api/patients/create
    │ { name, dob, gender, phone, type, address, ... }
    │
    ▼
[Patient Controller]
    │
    │ 1. Get Tenant ID
    │    └─> Hospital.findById(hospitalId) → tenantId
    │
    │ 2. Generate Patient ID
    │    └─> generatePatientId(Patient, tenantId)
    │        └─> Format: `{tenantId}-P-{sequential}`
    │        └─> Example: "hms_a1b2c3d4-P-000001"
    │
    │ 3. Create Patient
    │    └─> Patient.create({
    │          patientId, name, dob, gender, phone,
    │          address, emergencyContact, ...
    │        })
    │
    ▼
[Response: Patient Created with patientId]

[Step 2: Create Prescription]
    │
    │ POST /api/prescriptions/create
    │ { patient: patientId, medicines: [...], notes }
    │
    ▼
[Prescription Controller]
    │
    │ 1. Get Tenant ID
    │    └─> Hospital.findById(hospitalId) → tenantId
    │
    │ 2. Generate Prescription ID
    │    └─> generatePrescriptionId(Prescription, tenantId)
    │        └─> Format: `{tenantId}-RX-{sequential}`
    │        └─> Example: "hms_a1b2c3d4-RX-000001"
    │
    │ 3. Create Prescription
    │    └─> Prescription.create({
    │          prescriptionId,
    │          patient: patientId,
    │          doctor: req.user.id,
    │          medicines, notes,
    │          status: "ACTIVE"
    │        })
    │
    ▼
[Response: Prescription Created]

[Step 3: Search Patients]
    │
    │ GET /api/patients/search?search=John&type=OPD&page=1
    │
    ▼
[Patient Controller - searchPatients]
    │
    │ 1. Build Query
    │    └─> {
    │          hospitalId: req.user.hospitalId,
    │          $or: [
    │            { patientId: /search/i },
    │            { name: /search/i },
    │            { phone: /search/i }
    │          ],
    │          type: "OPD",
    │          ...
    │        }
    │
    │ 2. Apply Pagination
    │    └─> skip = (page - 1) * limit
    │
    │ 3. Execute Query
    │    └─> Patient.find(query)
    │        .populate("assignedDoctor")
    │        .skip(skip)
    │        .limit(limit)
    │
    │ 4. Count Total
    │    └─> Patient.countDocuments(query)
    │
    ▼
[Response]
    {
      patients: [...],
      pagination: { page, limit, total, pages }
    }
```

## 6. Password Reset Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      PASSWORD RESET FLOW                         │
└─────────────────────────────────────────────────────────────────┘

[Step 1: Request Reset]
    │
    │ POST /api/auth/forgot-password
    │ { email }
    │
    ▼
[Auth Controller - forgotPassword]
    │
    │ 1. Find User
    │    ├─> Check Main DB
    │    └─> If not found, check Tenant DBs
    │
    │ 2. Generate Reset Token
    │    └─> crypto.randomBytes(32).toString("hex")
    │
    │ 3. Set Token & Expiry
    │    └─> user.resetToken = token
    │    └─> user.resetExpiry = now + 1 hour
    │
    │ 4. Send Reset Email
    │    └─> sendResetPasswordMail(email, resetLink)
    │
    ▼
[Response: "Reset link sent to email"]

[Step 2: Reset Password]
    │
    │ User clicks link in email
    │ POST /api/auth/reset-password
    │ { token, newPassword }
    │
    ▼
[Auth Controller - resetPassword]
    │
    │ 1. Find User by Token
    │    ├─> Check Main DB
    │    └─> If not found, check Tenant DBs
    │    └─> Verify: resetExpiry > now
    │
    │ 2. Validate Password Policy
    │    └─> validatePassword(newPassword)
    │
    │ 3. Check Password History
    │    └─> checkPasswordHistory(newPassword, user.passwordHistory, 3)
    │        └─> Cannot reuse last 3 passwords
    │
    │ 4. Hash New Password
    │    └─> bcrypt.hash(newPassword, 10)
    │
    │ 5. Update Password History
    │    └─> Keep last 2, add new one
    │    └─> passwordHistory.push({ password: hashed, changedAt: now })
    │
    │ 6. Update User
    │    └─> user.password = hashedPassword
    │    └─> user.passwordChangedAt = now
    │    └─> user.resetToken = null
    │    └─> user.resetExpiry = null
    │    └─> user.status = "ACTIVE"
    │
    │ 7. Invalidate All Sessions
    │    └─> (Note: Implement session blacklist in production)
    │
    ▼
[Response: "Password reset successful. Please login again."]
```

## 7. Dynamic Menu Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      MENU GENERATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

[Client]
    │
    │ GET /api/menu
    │ Authorization: Bearer {accessToken}
    │
    ▼
[Menu Controller]
    │
    │ 1. Get User Roles
    │    └─> Role.find({ _id: { $in: req.user.roles } })
    │        .populate("permissions")
    │
    │ 2. Collect Permissions
    │    └─> userPermissions = new Set()
    │    └─> roles.forEach(role => {
    │          role.permissions.forEach(p => 
    │            userPermissions.add(p.name)
    │          )
    │        })
    │
    │ 3. Define Menu Structure
    │    └─> menuStructure = {
    │          Dashboard: { permission: "DASHBOARD:VIEW", ... },
    │          Patients: {
    │            permission: "PATIENT:READ",
    │            children: {
    │              "Register Patient": { permission: "PATIENT:CREATE" },
    │              "OPD Patients": { permission: "PATIENT:READ" }
    │            }
    │          },
    │          ...
    │        }
    │
    │ 4. Filter Menu Recursively
    │    └─> For each menu item:
    │        ├─> Check if user has permission
    │        ├─> If has children, filter children recursively
    │        └─> Only include if has permission or has visible children
    │
    │ 5. Return Filtered Menu
    │
    ▼
[Response]
    {
      menu: {
        Dashboard: { label, icon, path },
        Patients: {
          label, icon, path,
          children: {
            "Register Patient": { label, path },
            "OPD Patients": { label, path }
          }
        }
      },
      permissions: ["DASHBOARD:VIEW", "PATIENT:READ", ...],
      roles: ["DOCTOR", "HOSPITAL_ADMIN"]
    }
```

---

## Key Concepts

### 1. Multi-Tenancy
- **Schema-per-tenant**: Each hospital has its own database
- **Tenant ID**: Format `hms_{uuid}` (e.g., `hms_a1b2c3d4`)
- **Database Connection**: `mongodb://localhost:27017/hms_main_{tenantId}`
- **Isolation**: Complete data isolation between hospitals

### 2. Authentication
- **JWT Tokens**: Access token (1h) + Refresh token (7d)
- **Token Payload**: `{ id, role, hospitalId }`
- **Cookie Storage**: Refresh token in HTTP-only cookie
- **Header Storage**: Access token in Authorization header

### 3. Authorization
- **RBAC**: Role-Based Access Control
  - Roles: SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, PHARMACIST, RECEPTIONIST
  - Permissions: Format `RESOURCE:ACTION` (e.g., `PATIENT:CREATE`)
- **ABAC**: Attribute-Based Access Control
  - User attributes: department, specialization, shift
  - Resource attributes: patient_department, confidentiality_level

### 4. Password Management
- **Policy**: Min 8 chars, uppercase, lowercase, number, special char
- **History**: Tracks last 3 passwords, prevents reuse
- **Force Change**: Admin can force password change on first login
- **Reset**: Token-based reset with 1-hour expiry

### 5. ID Generation
- **Patient ID**: `{tenantId}-P-{sequential}` (e.g., `hms_a1b2c3d4-P-000001`)
- **Prescription ID**: `{tenantId}-RX-{sequential}` (e.g., `hms_a1b2c3d4-RX-000001`)
- **Sequential**: Auto-increments per tenant

---

## Error Scenarios

### 1. Invalid Token
```
Request: GET /api/patients/search
Headers: Authorization: Bearer invalid_token
 
Response: 401 Unauthorized
{
  "message": "Invalid or expired token"
}
```

### 2. Insufficient Permissions
```
Request: POST /api/patients/create
User Role: RECEPTIONIST
Required Permission: PATIENT:CREATE

Response: 403 Forbidden
{
  "message": "Permission denied"
}
```

### 3. Tenant Not Active
```
Request: GET /api/patients/search
Hospital Status: SUSPENDED

Response: 403 Forbidden
{
  "message": "Tenant is not active (SUSPENDED)"
}
```

### 4. Password Policy Violation
```
Request: POST /api/auth/reset-password
Body: { token, newPassword: "weak" }

Response: 400 Bad Request
{
  "message": "Password validation failed",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    ...
  ]
}
```

---

This documentation provides a complete understanding of how the HMS backend works. Refer to `API_DOCUMENTATION.md` for detailed API endpoint specifications.

