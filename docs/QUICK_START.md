# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Setup Environment

Create a `.env` file:
```env
MONGO_URI=mongodb://localhost:27017/
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
ACCESS_TOKEN_EXPIRE=1h
REFRESH_TOKEN_EXPIRE=7d
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
MAIL_FROM=noreply@hms.com
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

### Step 2: Install & Run

```bash
npm install
npm run dev
```

Server runs on `http://localhost:5000`

---

## 📝 Common Use Cases

### Use Case 1: Hospital Onboarding

```bash
# 1. Register Hospital
curl -X POST http://localhost:5000/api/hospital/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "City Hospital",
    "address": "123 Main St",
    "phone": "+1234567890",
    "email": "contact@cityhospital.com",
    "licenseNumber": "HL-12345"
  }'

# Response:
# {
#   "message": "Hospital registered. Verification mail sent.",
#   "tenantId": "hms_a1b2c3d4",
#   "adminEmail": "admin@cityhospital.com",
#   "adminTemporaryPassword": "Admin@1234"
# }

# 2. Click verification link in email
# GET http://localhost:5000/api/hospital/verify/{tenantId}/{token}

# 3. Login with admin credentials
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cityhospital.com",
    "password": "Admin@1234"
  }'

# Response includes accessToken - save this!
```

### Use Case 2: Create Hospital Staff

```bash
# After logging in as HOSPITAL_ADMIN
curl -X POST http://localhost:5000/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-hospital-id: YOUR_HOSPITAL_ID" \
  -d '{
    "firstName": "Dr. Sarah",
    "lastName": "Johnson",
    "email": "sarah.johnson@cityhospital.com",
    "phone": "+1234567891",
    "password": "TempPass@123",
    "roleIds": ["DOCTOR_ROLE_ID"],
    "department": "Cardiology",
    "specialization": "Cardiologist"
  }'

# New user receives welcome email with credentials
```

### Use Case 3: Patient Registration

```bash
curl -X POST http://localhost:5000/api/patients/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-hospital-id: YOUR_HOSPITAL_ID" \
  -d '{
    "name": "John Patient",
    "dob": "1990-01-15",
    "gender": "Male",
    "phone": "+1234567892",
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
      "phone": "+1234567893"
    }
  }'

# Response includes patientId: "hms_a1b2c3d4-P-000001"
```

### Use Case 4: Create Prescription

```bash
curl -X POST http://localhost:5000/api/prescriptions/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-hospital-id: YOUR_HOSPITAL_ID" \
  -d '{
    "patient": "PATIENT_ID",
    "medicines": [
      {
        "name": "Paracetamol",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "duration": "5 days",
        "instructions": "After meals"
      },
      {
        "name": "Ibuprofen",
        "dosage": "400mg",
        "frequency": "Once daily",
        "duration": "3 days",
        "instructions": "With food"
      }
    ],
    "notes": "Patient should rest and drink plenty of water"
  }'

# Response includes prescriptionId: "hms_a1b2c3d4-RX-000001"
```

### Use Case 5: Search Patients

```bash
# Search by name
curl -X GET "http://localhost:5000/api/patients/search?search=John&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-hospital-id: YOUR_HOSPITAL_ID"

# Search with filters
curl -X GET "http://localhost:5000/api/patients/search?search=John&patientType=OPD&department=Cardiology&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-hospital-id: YOUR_HOSPITAL_ID"

# Response:
# {
#   "patients": [...],
#   "pagination": {
#     "page": 1,
#     "limit": 20,
#     "total": 45,
#     "pages": 3
#   }
# }
```

### Use Case 6: Get Dynamic Menu

```bash
curl -X GET http://localhost:5000/api/menu \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
# {
#   "menu": {
#     "Dashboard": { "label": "Dashboard", "icon": "dashboard", "path": "/dashboard" },
#     "Patients": {
#       "label": "Patients",
#       "icon": "people",
#       "path": "/patients",
#       "children": {
#         "Register Patient": { "label": "Register Patient", "path": "/patients/register" },
#         "OPD Patients": { "label": "OPD Patients", "path": "/patients/opd" }
#       }
#     }
#   },
#   "permissions": ["DASHBOARD:VIEW", "PATIENT:READ", "PATIENT:CREATE"],
#   "roles": ["DOCTOR", "HOSPITAL_ADMIN"]
# }
```

### Use Case 7: Password Management

```bash
# Change Password (authenticated user)
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "oldPassword": "OldPass@123",
    "newPassword": "NewPass@456"
  }'

# Forgot Password
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@hospital.com"
  }'

# Reset Password (using token from email)
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-from-email",
    "newPassword": "NewPass@456"
  }'
```

---

## 🔑 Authentication Flow

### Step-by-Step Login

1. **Send Login Request**
```javascript
POST /api/auth/login
{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}
```

2. **Receive Tokens**
```javascript
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..." // in HTTP-only cookie
}
```

3. **Use Access Token**
```javascript
// Include in all protected requests
Authorization: Bearer {accessToken}
x-hospital-id: {hospitalId}
```

4. **Refresh Token When Expired**
```javascript
GET /api/auth/refresh
// Automatically uses refreshToken from cookie
// Returns new accessToken
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│           Client Application             │
└──────────────┬───────────────────────────┘
               │
               │ HTTP Requests
               │
┌──────────────▼───────────────────────────┐
│         Express.js Server                 │
│  ┌────────────────────────────────────┐  │
│  │  Middleware Chain:                  │  │
│  │  1. Auth Middleware                 │  │
│  │  2. Tenant Middleware                │  │
│  │  3. Permission/Role Middleware      │  │
│  │  4. ABAC Middleware (optional)       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Controllers:                       │  │
│  │  - Business Logic                   │  │
│  │  - Database Operations              │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               │ MongoDB Queries
               │
┌──────────────▼───────────────────────────┐
│         MongoDB Databases                 │
│  ┌────────────────────────────────────┐  │
│  │  Main DB (hms_main):                │  │
│  │  - Hospitals                        │  │
│  │  - Roles                            │  │
│  │  - Permissions                      │  │
│  │  - Super Admin Users                │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Tenant DBs (hms_main_{tenantId}):  │  │
│  │  - Users                            │  │
│  │  - Patients                         │  │
│  │  - Appointments                     │  │
│  │  - Prescriptions                    │  │
│  └────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

---

## 📋 Common Patterns

### Pattern 1: Making Authenticated Requests

```javascript
// JavaScript/TypeScript Example
const response = await fetch('http://localhost:5000/api/patients/search', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-hospital-id': hospitalId,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Pattern 2: Handling Token Refresh

```javascript
async function makeRequest(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    },
    credentials: 'include' // Include cookies for refresh token
  });

  // If token expired, refresh and retry
  if (response.status === 401) {
    const refreshResponse = await fetch('http://localhost:5000/api/auth/refresh', {
      credentials: 'include' // Send refresh token cookie
    });
    
    const { accessToken: newToken } = await refreshResponse.json();
    accessToken = newToken;
    
    // Retry original request
    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });
  }

  return response;
}
```

### Pattern 3: Error Handling

```javascript
try {
  const response = await fetch('/api/patients/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patientData)
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 401) {
      // Token expired, refresh
      await refreshToken();
    } else if (response.status === 403) {
      // Permission denied
      console.error('Permission denied:', error.message);
    } else if (response.status === 400) {
      // Validation error
      console.error('Validation errors:', error.errors);
    }
    
    throw new Error(error.message);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

---

## 🐛 Troubleshooting

### Issue: "User not found" on login
**Solution**: Check if:
- User exists in correct database (main or tenant)
- Hospital is ACTIVE
- Email is correct

### Issue: "Tenant (hospitalId) is required"
**Solution**: Include `x-hospital-id` header in request:
```javascript
headers: {
  'x-hospital-id': hospitalId
}
```

### Issue: "Permission denied"
**Solution**: Check if:
- User has required role
- User has required permission
- Hospital is ACTIVE

### Issue: "Invalid or expired token"
**Solution**: 
- Refresh token using `/api/auth/refresh`
- Re-login if refresh token expired

### Issue: Password validation fails
**Solution**: Ensure password meets:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

---

## 📚 Next Steps

1. Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference
2. Check [FLOW_DIAGRAMS.md](FLOW_DIAGRAMS.md) for visual flow diagrams
3. Review [README.md](../README.md) for project overview

---

**Happy Coding! 🚀**

