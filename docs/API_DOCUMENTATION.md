# HMS Backend API Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Authentication Flow](#authentication-flow)
3. [Multi-Tenancy Flow](#multi-tenancy-flow)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Examples](#requestresponse-examples)
6. [Error Handling](#error-handling)
7. [Security Features](#security-features)

---

## System Architecture

### Overview
The HMS (Hospital Management System) backend is built with:
- **Node.js** with **Express.js** framework
- **MongoDB** with multi-tenant architecture (schema-per-tenant)
- **JWT** for authentication
- **RBAC** (Role-Based Access Control) + **ABAC** (Attribute-Based Access Control)

### Database Structure
```
Main Database (hms_main):
├── Hospitals (tenant registry)
├── Roles (shared across all tenants)
├── Permissions (shared across all tenants)
└── Super Admin Users

Tenant Databases (hms_main_{tenantId}):
├── Users (hospital staff)
├── Patients
├── Appointments
└── Prescriptions
```

### Key Components
- **Controllers**: Handle business logic
- **Models**: Define data schemas
- **Middlewares**: Authentication, authorization, tenant isolation
- **Services**: Email, token generation
- **Utils**: Password validation, ID generation, username generation

---

## Authentication Flow

### 1. User Login Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ 1. POST /api/auth/login
     │    { email, password }
     ▼
┌─────────────────┐
│ Auth Controller │
└────┬────────────┘
     │ 2. Check Main DB
     │    └─> If not found
     │ 3. Search Tenant DBs
     │    └─> Find user in tenant DB
     │ 4. Validate password
     │ 5. Check user status
     │ 6. Generate tokens
     ▼
┌─────────────────┐
│ Response        │
│ - accessToken   │
│ - refreshToken  │
│ - user info     │
│ - hospital info │
└─────────────────┘
```

**Step-by-Step:**
1. User sends email and password to `/api/auth/login`
2. System checks main database for super admin users
3. If not found, searches all active hospital tenant databases
4. Validates password using bcrypt
5. Checks user status (ACTIVE, INACTIVE, LOCKED, PASSWORD_EXPIRED)
6. Generates JWT access token (1 hour) and refresh token (7 days)
7. Returns tokens and user information

### 2. Token Refresh Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ 1. GET /api/auth/refresh
     │    (refreshToken in cookie)
     ▼
┌─────────────────┐
│ Auth Controller │
└────┬────────────┘
     │ 2. Verify refresh token
     │ 3. Find user (main or tenant DB)
     │ 4. Generate new access token
     ▼
┌─────────────────┐
│ Response        │
│ - new accessToken│
└─────────────────┘
```

### 3. Protected Route Access Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ 1. Request with Bearer token
     │    Authorization: Bearer {accessToken}
     ▼
┌──────────────────┐
│ Auth Middleware  │
└────┬─────────────┘
     │ 2. Verify JWT token
     │ 3. Extract user ID & hospitalId
     │ 4. Load user from DB
     │    └─> Check main DB first
     │    └─> If hospitalId exists, check tenant DB
     │ 5. Populate roles & permissions
     │ 6. Attach to req.user
     ▼
┌──────────────────┐
│ Tenant Middleware│
└────┬─────────────┘
     │ 7. Extract hospitalId from req
     │ 8. Verify hospital is ACTIVE
     │ 9. Attach tenant info to req.tenant
     ▼
┌──────────────────┐
│ Permission/Role  │
│ Middleware       │
└────┬─────────────┘
     │ 10. Check user permissions/roles
     │ 11. Allow or deny access
     ▼
┌──────────────────┐
│ Controller       │
│ (Business Logic) │
└──────────────────┘
```

---

## Multi-Tenancy Flow

### Hospital Registration Flow

```
┌─────────┐
│ Hospital│
└────┬────┘
     │ 1. POST /api/hospital/register
     │    { name, address, phone, email, licenseNumber }
     ▼
┌─────────────────────┐
│ Hospital Controller │
└────┬────────────────┘
     │ 2. Validate license uniqueness
     │ 3. Generate tenantId (UUID)
     │ 4. Create hospital in main DB
     │    Status: PENDING
     │ 5. Create tenant database
     │    Connection: hms_main_{tenantId}
     │ 6. Create HOSPITAL_ADMIN role
     │ 7. Create admin user in tenant DB
     │    Email: admin@{hospital-domain}
     │ 8. Send verification email
     ▼
┌─────────────────────┐
│ Hospital clicks link│
│ /api/hospital/verify │
│ /{tenantId}/{token} │
└────┬────────────────┘
     │ 9. Verify token
     │ 10. Update status: VERIFIED
     │ 11. Send admin credentials email
     ▼
┌─────────────────────┐
│ Super Admin         │
│ (Optional)          │
└────┬────────────────┘
     │ 12. PUT /api/admin/hospital/{id}/status
     │     { status: "ACTIVE" }
     ▼
┌─────────────────────┐
│ Hospital Status:    │
│ ACTIVE              │
│ Ready to use!       │
└─────────────────────┘
```

### Tenant Database Access Flow

```
┌─────────────────┐
│ Request comes in│
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Auth Middleware │
│ Sets req.user   │
│ req.hospitalId  │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Tenant Middleware│
│ Gets hospitalId  │
│ from req         │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Find Hospital   │
│ Get tenantId    │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ createTenantDB()│
│ Returns tenant   │
│ connection       │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Controller uses  │
│ TenantUser model │
│ from connection  │
└─────────────────┘
```

---

## API Endpoints

### Authentication Endpoints

#### 1. Login
```http
POST /api/auth/login
Content-Type: application/json

Request Body:
{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}

Response (200 OK):
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": ["507f1f77bcf86cd799439011"],
  "hospital": "City Hospital",
  "hospitalId": "507f1f77bcf86cd799439012",
  "user": {
    "id": "507f1f77bcf86cd799439013",
    "firstName": "John",
    "lastName": "Doe",
    "email": "admin@hospital.com"
  }
}
```

#### 2. Refresh Token
```http
GET /api/auth/refresh
Cookie: refreshToken={token}

Response (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. Change Password
```http
POST /api/auth/change-password
Authorization: Bearer {accessToken}
Content-Type: application/json

Request Body:
{
  "oldPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}

Response (200 OK):
{
  "message": "Password changed successfully"
}
```

#### 4. Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

Request Body:
{
  "email": "user@hospital.com"
}

Response (200 OK):
{
  "message": "Reset link sent to email"
}
```

#### 5. Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

Request Body:
{
  "token": "reset-token-from-email",
  "newPassword": "NewPass@456"
}

Response (200 OK):
{
  "message": "Password reset successful. Please login again."
}
```

#### 6. Logout
```http
POST /api/auth/logout
Authorization: Bearer {accessToken}

Response (200 OK):
{
  "message": "Logged out successfully"
}
```

### Hospital Endpoints

#### 1. Register Hospital
```http
POST /api/hospital/register
Content-Type: application/json

Request Body:
{
  "name": "City Hospital",
  "address": "123 Main St",
  "phone": "+1234567890",
  "email": "contact@cityhospital.com",
  "licenseNumber": "HL-12345"
}

Response (201 Created):
{
  "message": "Hospital registered. Verification mail sent.",
  "tenantId": "hms_a1b2c3d4",
  "adminEmail": "admin@cityhospital.com",
  "adminTemporaryPassword": "Admin@1234"
}
```

#### 2. Verify Hospital
```http
GET /api/hospital/verify/{tenantId}/{token}

Response (HTML):
<h1>✅ Hospital Activated Successfully</h1>
<p>Login credentials have been sent to your registered email.</p>
```

### User Management Endpoints

#### 1. Create User
```http
POST /api/users/create
Authorization: Bearer {accessToken}
x-hospital-id: {hospitalId}
Content-Type: application/json

Request Body:
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@hospital.com",
  "phone": "+1234567890",
  "password": "TempPass@123",
  "roleIds": ["507f1f77bcf86cd799439011"],
  "department": "Cardiology",
  "specialization": "Cardiologist"
}

Response (201 Created):
{
  "message": "User Created Successfully",
  "user": {
    "id": "507f1f77bcf86cd799439014",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@hospital.com",
    "username": "jane.smith@hospital.com",
    "department": "Cardiology",
    "status": "ACTIVE"
  }
}
```

### Patient Endpoints

#### 1. Register Patient
```http
POST /api/patients/create
Authorization: Bearer {accessToken}
x-hospital-id: {hospitalId}
Content-Type: application/json

Request Body:
{
  "name": "John Patient",
  "dob": "1990-01-15",
  "gender": "Male",
  "phone": "+1234567890",
  "email": "john@example.com",
  "bloodGroup": "O+",
  "type": "OPD",
  "address": {
    "street": "456 Oak Ave",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "emergencyContact": {
    "name": "Jane Patient",
    "relationship": "Spouse",
    "phone": "+1234567891"
  }
}

Response (201 Created):
{
  "message": "Patient Registered",
  "patient": {
    "patientId": "hms_a1b2c3d4-P-000001",
    "name": "John Patient",
    "type": "OPD",
    ...
  }
}
```

#### 2. Search Patients
```http
GET /api/patients/search?search=John&patientType=OPD&page=1&limit=20
Authorization: Bearer {accessToken}
x-hospital-id: {hospitalId}

Response (200 OK):
{
  "patients": [
    {
      "patientId": "hms_a1b2c3d4-P-000001",
      "name": "John Patient",
      "type": "OPD",
      "assignedDoctor": {
        "firstName": "Dr. Jane",
        "lastName": "Smith"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Prescription Endpoints

#### 1. Create Prescription
```http
POST /api/prescriptions/create
Authorization: Bearer {accessToken}
x-hospital-id: {hospitalId}
Content-Type: application/json

Request Body:
{
  "patient": "507f1f77bcf86cd799439015",
  "medicines": [
    {
      "name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "Twice daily",
      "duration": "5 days",
      "instructions": "After meals"
    }
  ],
  "notes": "Patient should rest"
}

Response (201 Created):
{
  "message": "Prescription Created",
  "prescription": {
    "prescriptionId": "hms_a1b2c3d4-RX-000001",
    "patient": "507f1f77bcf86cd799439015",
    "doctor": "507f1f77bcf86cd799439014",
    "medicines": [...],
    "status": "ACTIVE"
  }
}
```

### Menu Endpoints

#### 1. Get Dynamic Menu
```http
GET /api/menu
Authorization: Bearer {accessToken}

Response (200 OK):
{
  "menu": {
    "Dashboard": {
      "label": "Dashboard",
      "icon": "dashboard",
      "path": "/dashboard"
    },
    "Patients": {
      "label": "Patients",
      "icon": "people",
      "path": "/patients",
      "children": {
        "Register Patient": {
          "label": "Register Patient",
          "path": "/patients/register"
        },
        "OPD Patients": {
          "label": "OPD Patients",
          "path": "/patients/opd"
        }
      }
    }
  },
  "permissions": [
    "DASHBOARD:VIEW",
    "PATIENT:READ",
    "PATIENT:CREATE"
  ],
  "roles": ["DOCTOR", "HOSPITAL_ADMIN"]
}
```

---

## Request/Response Examples

### Complete User Registration Flow

```javascript
// 1. Hospital Admin logs in
POST /api/auth/login
{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}

// Response includes accessToken

// 2. Create a new doctor user
POST /api/users/create
Headers: {
  "Authorization": "Bearer {accessToken}",
  "x-hospital-id": "{hospitalId}"
}
Body: {
  "firstName": "Dr. Sarah",
  "lastName": "Johnson",
  "email": "sarah.johnson@hospital.com",
  "phone": "+1234567890",
  "password": "TempPass@123",
  "roleIds": ["{doctorRoleId}"],
  "department": "Pediatrics",
  "specialization": "Pediatrician"
}

// 3. New user receives welcome email with credentials
// 4. New user logs in and is forced to change password
```

### Complete Patient Management Flow

```javascript
// 1. Register a patient
POST /api/patients/create
Headers: {
  "Authorization": "Bearer {accessToken}",
  "x-hospital-id": "{hospitalId}"
}
Body: {
  "name": "Alice Brown",
  "dob": "1985-05-20",
  "gender": "Female",
  "phone": "+1234567892",
  "type": "OPD"
}

// Response: patientId = "hms_a1b2c3d4-P-000001"

// 2. Search for patients
GET /api/patients/search?search=Alice&page=1&limit=20
Headers: {
  "Authorization": "Bearer {accessToken}",
  "x-hospital-id": "{hospitalId}"
}

// 3. Create prescription for patient
POST /api/prescriptions/create
Headers: {
  "Authorization": "Bearer {accessToken}",
  "x-hospital-id": "{hospitalId}"
}
Body: {
  "patient": "{patientId}",
  "medicines": [...]
}
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "message": "Authorization token missing"
}
```

#### 403 Forbidden
```json
{
  "message": "Permission denied"
}
```

#### 404 Not Found
```json
{
  "message": "User not found"
}
```

#### 400 Bad Request
```json
{
  "message": "Password validation failed",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter"
  ]
}
```

---

## Security Features

### 1. Password Policy
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Cannot reuse last 3 passwords

### 2. Token Security
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Tokens stored in HTTP-only cookies (refresh token)
- JWT signed with secret key

### 3. Multi-Tenancy Isolation
- Each hospital has separate database
- Cross-tenant data access prevented
- Tenant context validated on every request

### 4. RBAC + ABAC
- Role-based permissions
- Attribute-based filtering (department, specialization)
- Hierarchical role inheritance

---

## Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017/

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
ACCESS_TOKEN_EXPIRE=1h
REFRESH_TOKEN_EXPIRE=7d

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
MAIL_FROM=noreply@hms.com

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

---

## Middleware Chain

### Typical Protected Route
```
Request
  ↓
Auth Middleware (verify token, load user)
  ↓
Tenant Middleware (validate hospital, set tenant context)
  ↓
Role Middleware (check role permissions)
  ↓
Permission Middleware (check specific permission)
  ↓
ABAC Middleware (attribute-based filtering)
  ↓
Controller (business logic)
  ↓
Response
```

---

## Database Models Reference

### User Model Fields
- `firstName`, `lastName`, `email`, `username`
- `password`, `passwordHistory`, `passwordChangedAt`
- `phone`, `department`, `specialization`, `shift`
- `roles`, `hospitalId`
- `status` (ACTIVE, INACTIVE, LOCKED, PASSWORD_EXPIRED)
- `isActive`, `forcePasswordChange`
- `lastLogin`, `resetToken`, `resetExpiry`

### Patient Model Fields
- `patientId`, `name`, `dob`, `gender`
- `phone`, `email`, `bloodGroup`
- `type` (OPD, IPD)
- `address`, `emergencyContact`, `photo`
- `department`, `confidentialityLevel`
- `assignedDoctor`, `hospitalId`

### Prescription Model Fields
- `prescriptionId`, `patient`, `doctor`
- `medicines[]`, `notes`, `template`
- `status` (DRAFT, ACTIVE, COMPLETED, CANCELLED)
- `hospitalId`

---

## Best Practices

1. **Always include `x-hospital-id` header** for hospital-specific operations
2. **Handle token expiration** by refreshing access tokens
3. **Validate input** on client side before sending requests
4. **Store tokens securely** (HTTP-only cookies for refresh tokens)
5. **Implement retry logic** for failed requests
6. **Cache menu data** on frontend to reduce API calls
7. **Use pagination** for list endpoints
8. **Handle force password change** by redirecting to change password page

---

## Support

For issues or questions, please contact the development team.

