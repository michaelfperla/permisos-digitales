# Permisos Digitales - Digital Permit System

A comprehensive digital permit application system built with Node.js/Express backend and React/TypeScript frontend, featuring Stripe payment processing, automated permit generation, and full mobile optimization.

## 🌟 Overview

Modern web application that streamlines the vehicle circulation permit application process in Mexico, eliminating paperwork and providing instant digital permits with integrated payment processing and government portal automation.

## 🚀 Key Features

### User Experience
- **Responsive Design**: Mobile-first approach with full mobile optimization
- **User Authentication**: Secure registration, login, email verification, and password recovery
- **Multi-step Forms**: Intuitive form wizard with validation and progress tracking
- **Real-time Status**: Live permit status updates and queue position tracking

### Payment Processing
- **Stripe Integration**: Secure card payments with 3D Secure support
- **OXXO Payments**: Cash payment vouchers for Mexican market
- **Payment Recovery**: Automatic retry system for failed payments
- **Payment Monitoring**: Real-time payment status tracking

### Government Integration
- **Automated Processing**: Direct integration with government permit portal
- **PDF Generation**: Automated permit document generation
- **Document Storage**: Secure cloud storage with local fallback
- **Permit Validation**: Real-time permit verification system

### Administration
- **Admin Dashboard**: Comprehensive management interface
- **User Management**: Full user lifecycle management
- **Application Tracking**: Detailed application status monitoring
- **Failed Permit Recovery**: Automated retry system for failed permit generation

### Technical Features
- **Health Monitoring**: Comprehensive health checks and metrics
- **Queue Management**: Background job processing for permit generation
- **Security**: CSRF protection, rate limiting, input validation
- **Scalability**: Redis caching, database optimization, PM2 clustering

## 📁 Project Structure

```
permisos-digitales/
├── frontend/          # React frontend application
├── src/              # Node.js backend application
├── docs/             # Documentation
│   ├── database/     # Database schemas and migration guides
│   ├── deployment/   # Production setup and deployment guides
│   └── monitoring/   # Monitoring and alerting documentation
├── scripts/          # Utility scripts
│   ├── database/     # Database management scripts
│   ├── testing/      # Test and verification scripts
│   └── webhooks/     # Webhook testing utilities
├── storage/          # File storage (PDFs, images)
└── logs/            # Application logs
```

## 🛠️ Architecture & Tech Stack

### Backend Stack
- **Runtime**: Node.js 18+ with Express.js framework
- **Database**: PostgreSQL 13+ with connection pooling
- **Cache**: Redis 6+ for sessions and rate limiting
- **Queue**: Bull/Redis for background job processing
- **Storage**: AWS S3 with local filesystem fallback
- **Authentication**: Session-based with CSRF protection

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Styling**: CSS Modules with custom CSS variables
- **State Management**: React Context with useReducer
- **Forms**: React Hook Form with custom validation
- **Testing**: Vitest + React Testing Library

### Payment & Integration
- **Payments**: Stripe API with webhook handling
- **OXXO Integration**: Mexican cash payment system
- **PDF Generation**: Puppeteer with S3 storage
- **Government Portal**: Automated form submission
- **Email**: Nodemailer with template system

### DevOps & Monitoring
- **Process Management**: PM2 with cluster mode
- **Monitoring**: Custom metrics collection and health checks
- **Logging**: Winston with structured logging
- **Error Tracking**: Custom error handling and reporting
- **Security**: Rate limiting, input validation, security headers

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Git

### Installation

1. **Clone repository**
```bash
git clone [repository-url]
cd permisos-digitales
```

2. **Backend setup**
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your local configuration

# Setup database
npm run db:setup
npm run migrate

# Start development server
npm run dev
```

3. **Frontend setup** (new terminal)
```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local with your local configuration

# Start development server
npm run dev
```

4. **Verify setup**
- Backend: http://localhost:3001/health
- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3000/admin

### Environment URLs
- **Development**: http://localhost:3000
- **Staging**: https://staging.permisos-digitales.com
- **Production**: https://permisos-digitales.com

## 📖 Documentation

### Developer Resources
- [Development Setup Guide](docs/development/SETUP.md) - Complete development environment setup
- [Architecture Overview](docs/architecture/OVERVIEW.md) - System architecture and design decisions
- [Coding Standards](docs/development/CODING_STANDARDS.md) - Code style and best practices
- [Testing Guide](docs/development/TESTING_GUIDE.md) - Testing strategies and practices

### API Documentation
- [API Overview](docs/api/README.md) - API endpoints and authentication
- [Authentication API](docs/api/AUTHENTICATION.md) - Login, registration, password reset
- [Applications API](docs/api/APPLICATIONS.md) - Permit application endpoints
- [Payments API](docs/api/PAYMENTS.md) - Payment processing and webhooks
- [Admin API](docs/api/ADMIN.md) - Administrative endpoints

### Frontend Documentation
- [Component Library](docs/frontend/COMPONENTS.md) - UI component documentation
- [Mobile Optimization](docs/frontend/MOBILE.md) - Mobile-first responsive design
- [State Management](docs/frontend/STATE_MANAGEMENT.md) - Context and state patterns
- [Form Handling](docs/frontend/FORMS.md) - Form validation and wizards

### Operations
- [Deployment Guide](docs/operations/DEPLOYMENT.md) - Production deployment procedures
- [Monitoring](docs/operations/MONITORING.md) - Health checks and metrics
- [Security](docs/operations/SECURITY.md) - Security practices and procedures
- [Troubleshooting](docs/operations/TROUBLESHOOTING.md) - Common issues and solutions

### Database
- [Schema Documentation](docs/database/SCHEMA.md) - Database structure and relationships
- [Migrations](docs/database/MIGRATIONS.md) - Migration guide and history
- [Performance](docs/database/PERFORMANCE.md) - Query optimization and indexing

## 🧪 Testing

### Backend Tests
```bash
# Run all backend tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Frontend Tests
```bash
cd frontend

# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage Status
- **Backend**: 42% → Target: 70%
- **Frontend**: 14% → Target: 70%
- **E2E Tests**: In Development

## 📊 System Status

### Production Health
- **Uptime**: 99.9% SLA
- **Response Time**: <200ms average
- **Payment Success Rate**: 98.5%
- **Permit Generation**: 95% success rate

### Monitoring Endpoints
- Health checks: `http://localhost:3001/health`
- Metrics: `http://localhost:3001/metrics`
- Admin Dashboard: `http://localhost:3001/admin`

### Performance Metrics
- Database queries optimized with indexes
- Redis caching for session management
- CDN integration for static assets
- Background job processing for heavy operations

## 🔒 Security Features

- **Authentication**: Session-based with secure cookies
- **Authorization**: Role-based access control (RBAC)
- **Protection**: CSRF, XSS, SQL injection prevention
- **Network**: HTTPS enforced, security headers
- **Validation**: Input sanitization and validation
- **Monitoring**: Security event logging and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🏗️ Development Workflow

1. **Planning**: Create issues for features/bugs
2. **Development**: Feature branches from `develop`
3. **Testing**: Unit, integration, and E2E tests required
4. **Review**: Code review and approval process
5. **Deployment**: Staging → Production with monitoring

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs](docs/) directory
- **Issues**: Report bugs via GitHub Issues
- **Support**: Contact the development team
- **Status**: Check system status dashboard

---

**Last Updated**: June 2025 | **Version**: 2.0.0 | **Status**: Production Ready