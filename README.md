# Hospital Management System (HMS) Backend

A comprehensive multi-tenant Hospital Management System backend built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Multi-Tenancy**: Schema-per-tenant architecture with complete data isolation
- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: RBAC (Role-Based Access Control) + ABAC (Attribute-Based Access Control)
- **User Management**: Complete user lifecycle with password policies
- **Patient Management**: Patient registration, search, and filtering
- **Prescription Management**: Digital prescription creation and tracking
- **Dynamic Menu**: Role and permission-based menu generation
- **Email Services**: Welcome emails, password reset, hospital verification

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🔧 Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd hms-backend-rbac/src
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# Database
MONGO_URI=mongodb://localhost:27017/

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
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

4. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on port 5000 (or the port specified in your environment).

## 📁 Project Structure

```
src/
├── config/           # Database configuration
├── constants/         # Role constants
├── controllers/       # Business logic handlers
│   ├── auth.controller.js
│   ├── hospital.controller.js
│   ├── user.controller.js
│   ├── patient.controller.js
│   ├── prescription.controller.js
│   └── menu.controller.js
├── middlewares/       # Request middleware
│   ├── auth.middleware.js      # JWT authentication
│   ├── tenant.middleware.js    # Tenant isolation
│   ├── permission.middleware.js # Permission checking
│   ├── role.middleware.js      # Role checking
│   └── abac.middleware.js      # Attribute-based access
├── models/           # Database models
│   ├── user.model.js
│   ├── hospital.model.js
│   ├── patient.model.js
│   ├── prescription.model.js
│   └── user.tenant.schema.js
├── routes/           # API routes
├── services/         # External services
│   ├── mail.service.js
│   └── token.service.js
├── utils/            # Utility functions
│   ├── passwordValidator.js
│   ├── usernameGenerator.js
│   ├── idGenerator.js
│   └── createTenantDB.js
├── docs/             # Documentation
│   ├── API_DOCUMENTATION.md
│   └── FLOW_DIAGRAMS.md
├── app.js            # Express app configuration
└── server.js         # Server entry point
```

## 🔐 Authentication Flow

1. **Login**: User sends email and password
2. **Validation**: System checks main DB, then tenant DBs
3. **Token Generation**: Creates access token (1h) and refresh token (7d)
4. **Response**: Returns tokens and user information

See [FLOW_DIAGRAMS.md](docs/FLOW_DIAGRAMS.md) for detailed flow diagrams.

## 🏥 Multi-Tenancy

Each hospital gets:
- **Unique Tenant ID**: Format `hms_{uuid}`
- **Separate Database**: `hms_main_{tenantId}`
- **Isolated Data**: Complete data isolation
- **Shared Roles**: Roles and permissions in main DB

## 👥 User Roles

- **SUPER_ADMIN**: Platform administrator
- **HOSPITAL_ADMIN**: Hospital administrator
- **DOCTOR**: Medical practitioner
- **NURSE**: Nursing staff
- **PHARMACIST**: Pharmacy staff
- **RECEPTIONIST**: Front desk staff

## 📚 API Documentation

### Quick Start Examples

#### 1. Hospital Registration
```bash
POST /api/hospital/register
{
  "name": "City Hospital",
  "address": "123 Main St",
  "phone": "+1234567890",
  "email": "contact@cityhospital.com",
  "licenseNumber": "HL-12345"
}
```

#### 2. User Login
```bash
POST /api/auth/login
{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}
```

#### 3. Create User
```bash
POST /api/users/create
Headers: 
  Authorization: Bearer {accessToken}
  x-hospital-id: {hospitalId}
Body:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@hospital.com",
  "password": "TempPass@123",
  "roleIds": ["{roleId}"],
  "department": "Cardiology"
}
```

#### 4. Register Patient
```bash
POST /api/patients/create
Headers:
  Authorization: Bearer {accessToken}
  x-hospital-id: {hospitalId}
Body:
{
  "name": "Jane Patient",
  "dob": "1990-01-15",
  "gender": "Male",
  "phone": "+1234567890",
  "type": "OPD"
}
```

#### 5. Get Dynamic Menu
```bash
GET /api/menu
Headers:
  Authorization: Bearer {accessToken}
```

For complete API documentation, see [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## 🔒 Security Features

- **Password Policy**: 
  - Minimum 8 characters
  - Uppercase, lowercase, number, special character
  - Cannot reuse last 3 passwords

- **Token Security**:
  - Access tokens expire in 1 hour
  - Refresh tokens expire in 7 days
  - HTTP-only cookies for refresh tokens

- **Multi-Tenant Isolation**:
  - Complete data separation
  - Tenant validation on every request

- **RBAC + ABAC**:
  - Role-based permissions
  - Attribute-based filtering

## 🛠️ Development

### Running in Development
```bash
npm run dev
```

### Environment Variables
See `.env.example` for all required environment variables.

### Database Setup
1. Ensure MongoDB is running
2. The system will automatically create databases as needed
3. Main database: `hms_main`
4. Tenant databases: `hms_main_{tenantId}`

## 📖 Documentation

- **[API Documentation](docs/API_DOCUMENTATION.md)**: Complete API reference
- **[Flow Diagrams](docs/FLOW_DIAGRAMS.md)**: Visual flow diagrams for all processes

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test
```

## 📝 License

This project is proprietary software.

## 👥 Support

For issues or questions, please contact the development team.

---

## 🎯 Key Endpoints Summary

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/login` | POST | User login | No |
| `/api/auth/refresh` | GET | Refresh access token | No (cookie) |
| `/api/auth/change-password` | POST | Change password | Yes |
| `/api/auth/forgot-password` | POST | Request password reset | No |
| `/api/auth/reset-password` | POST | Reset password | No |
| `/api/hospital/register` | POST | Register hospital | No |
| `/api/hospital/verify/:id/:token` | GET | Verify hospital | No |
| `/api/users/create` | POST | Create user | Yes |
| `/api/patients/create` | POST | Register patient | Yes |
| `/api/patients/search` | GET | Search patients | Yes |
| `/api/prescriptions/create` | POST | Create prescription | Yes |
| `/api/menu` | GET | Get dynamic menu | Yes |

---

**Built with ❤️ for healthcare management**

