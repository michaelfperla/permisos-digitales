# Development Setup Guide

Complete guide to setting up the Permisos Digitales development environment.

## Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher (comes with Node.js)
- **PostgreSQL**: 13.0 or higher
- **Redis**: 6.0 or higher
- **Git**: 2.30 or higher

### Development Tools (Recommended)
- **VS Code** with extensions:
  - ES7+ React/Redux/React-Native snippets
  - TypeScript Importer
  - Prettier - Code formatter
  - ESLint
  - PostgreSQL (for database management)
- **Postman** or **Insomnia** for API testing
- **DBeaver** or **pgAdmin** for database management

### Platform-Specific Setup

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install prerequisites
brew install node postgresql redis git

# Start services
brew services start postgresql
brew services start redis
```

#### Windows
```bash
# Install using Chocolatey
choco install nodejs postgresql redis git

# Or download installers:
# - Node.js: https://nodejs.org/
# - PostgreSQL: https://www.postgresql.org/download/windows/
# - Redis: https://redis.io/docs/getting-started/installation/install-redis-on-windows/
```

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL and Redis
sudo apt-get install -y postgresql postgresql-contrib redis-server

# Install Git
sudo apt-get install -y git

# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl enable redis-server
```

---

## Project Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone [repository-url]
cd permisos-digitales

# Check you're on the correct branch
git branch -a
git checkout develop  # if not already on develop
```

### 2. Install Dependencies

#### Backend Dependencies
```bash
# From project root
npm install

# Verify installation
npm list --depth=0
```

#### Frontend Dependencies
```bash
# Change to frontend directory
cd frontend
npm install

# Verify installation
npm list --depth=0

# Return to project root
cd ..
```

### 3. Database Setup

#### Create Database and User
```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Or on macOS/Windows:
psql -U postgres
```

```sql
-- Create database
CREATE DATABASE permisos_digitales_v2;

-- Create user
CREATE USER permisos_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE permisos_digitales_v2 TO permisos_user;

-- Grant schema privileges
\c permisos_digitales_v2;
GRANT ALL ON SCHEMA public TO permisos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO permisos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO permisos_user;

-- Exit psql
\q
```

#### Test Database Connection
```bash
# Test connection with new user
psql -U permisos_user -d permisos_digitales_v2 -h localhost

# You should see the database prompt
# permisos_digitales_v2=> 
```

### 4. Environment Configuration

#### Backend Environment
```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env  # or your preferred editor
```

**Required Environment Variables (.env):**
```bash
# Database Configuration
DATABASE_URL=postgresql://permisos_user:your_secure_password@localhost:5432/permisos_digitales_v2
DB_HOST=localhost
DB_PORT=5432
DB_NAME=permisos_digitales_v2
DB_USER=permisos_user
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
NODE_ENV=development
PORT=3001
SESSION_SECRET=your-super-secret-session-key-change-this

# CORS Configuration
FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3000

# Email Configuration (for development)
EMAIL_FROM=noreply@localhost
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_SECURE=false

# Stripe Configuration (get from Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# File Storage (for development use local)
STORAGE_TYPE=local
STORAGE_PATH=./storage

# Security
BCRYPT_SALT_ROUNDS=12
JWT_SECRET=your-jwt-secret-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log
```

#### Frontend Environment
```bash
# Change to frontend directory
cd frontend

# Copy environment template
cp .env.example .env.local

# Edit environment file
nano .env.local
```

**Required Environment Variables (.env.local):**
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001/api
VITE_APP_BASE_URL=http://localhost:3000

# Stripe Configuration (public key only)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Environment
VITE_NODE_ENV=development

# Feature Flags
VITE_ENABLE_OXXO_PAYMENTS=true
VITE_ENABLE_PAYMENT_RECOVERY=true
VITE_ENABLE_DEBUG_MODE=true

# Monitoring (optional for development)
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

### 5. Database Migration

```bash
# From project root, run migrations
npm run migrate:up

# Verify migrations ran successfully
npm run migrate

# You should see a list of applied migrations
```

### 6. Start Development Servers

#### Option A: Start Backend and Frontend Separately

**Terminal 1 - Backend:**
```bash
# From project root
npm run dev

# Backend will start on http://localhost:3001
# You should see: "Server running on port 3001"
```

**Terminal 2 - Frontend:**
```bash
# From frontend directory
cd frontend
npm run dev

# Frontend will start on http://localhost:3000
# You should see: "Local: http://localhost:3000"
```

**Terminal 3 - Admin Panel (Optional):**
```bash
# From frontend directory
cd frontend
npm run dev:admin

# Admin panel will start on http://localhost:3001
```

#### Option B: Start All Services Together
```bash
# From project root (if concurrently is configured)
npm run dev:all

# This will start both backend and frontend
```

### 7. Verify Installation

#### Backend Health Check
```bash
# Test backend is running
curl http://localhost:3001/health

# Expected response:
# {"success":true,"data":{"status":"healthy",...}}
```

#### Frontend Access
1. **Main Application**: http://localhost:3000
2. **Admin Panel**: http://localhost:3000/admin
3. **API Documentation**: http://localhost:3001/api-docs (if configured)

#### Database Verification
```bash
# Connect to database
psql -U permisos_user -d permisos_digitales_v2 -h localhost

# Check tables were created
\dt

# You should see: users, permit_applications, payment_events, etc.
```

#### Redis Verification
```bash
# Connect to Redis
redis-cli

# Test Redis is working
ping
# Should return: PONG

# Exit Redis CLI
exit
```

---

## Development Workflow

### Daily Development

#### 1. Start Development Environment
```bash
# Pull latest changes
git pull origin develop

# Install any new dependencies
npm install
cd frontend && npm install && cd ..

# Start development servers
npm run dev  # Terminal 1
cd frontend && npm run dev  # Terminal 2
```

#### 2. Code Changes
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes...

# Check code quality
npm run lint
cd frontend && npm run lint && cd ..

# Run tests
npm test
cd frontend && npm test && cd ..
```

#### 3. Test Your Changes
```bash
# Backend tests
npm run test:unit      # Unit tests
npm run test:integration  # Integration tests
npm run test:coverage  # With coverage report

# Frontend tests
cd frontend
npm run test:unit      # Unit tests
npm run test:coverage  # With coverage report
npm run test:admin     # Admin panel tests
```

### Database Management

#### Common Migration Commands
```bash
# Create new migration
npm run migrate:create -- migration-name

# Run migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate
```

#### Reset Database (Development Only)
```bash
# Drop and recreate database
dropdb -U postgres permisos_digitales_v2
createdb -U postgres permisos_digitales_v2

# Re-run migrations
npm run migrate:up
```

### Code Quality

#### Linting
```bash
# Backend linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues

# Frontend linting
cd frontend
npm run lint          # Check for issues
```

#### Formatting
```bash
# Frontend formatting (Prettier)
cd frontend
npm run format        # Format all files
npm run format:check  # Check if files need formatting
```

---

## Testing

### Backend Testing

#### Test Structure
```
src/
├── __tests__/                 # Unit tests
├── test/                     # Test utilities
├── routes/__tests__/         # Route integration tests
├── services/__tests__/       # Service tests
└── repositories/__tests__/   # Repository tests
```

#### Running Tests
```bash
# All tests
npm test

# Specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# Specific test file
npm test -- auth.controller.test.js

# Test with debug output
DEBUG=* npm test
```

### Frontend Testing

#### Test Structure
```
frontend/src/
├── __tests__/                    # Global tests
├── components/__tests__/         # Component tests
├── pages/__tests__/             # Page tests
├── services/__tests__/          # Service tests
├── hooks/__tests__/             # Hook tests
└── admin/__tests__/             # Admin tests
```

#### Running Tests
```bash
cd frontend

# All tests
npm test

# Specific test types
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:admin          # Admin panel tests
npm run test:client         # Client application tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# Specific test file
npm test -- Button.test.tsx
```

---

## Debugging

### Backend Debugging

#### Debug Mode
```bash
# Start with debug output
DEBUG=app:* npm run dev

# Debug specific modules
DEBUG=app:auth,app:payment npm run dev

# Node.js inspector
node --inspect src/server.js
```

#### VS Code Debugging
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "app:*"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

### Frontend Debugging

#### Browser DevTools
- **React DevTools**: Install browser extension
- **Redux DevTools**: For state debugging (if using Redux)
- **Network Tab**: API request debugging

#### VS Code Debugging
Vite includes built-in source maps for debugging in VS Code.

### Database Debugging

#### Query Logging
Add to your `.env`:
```bash
# Enable query logging
LOG_QUERIES=true
DB_QUERY_LOG_LEVEL=debug
```

#### Manual Queries
```bash
# Connect to database
psql -U permisos_user -d permisos_digitales_v2 -h localhost

# Example queries
SELECT * FROM users LIMIT 5;
SELECT * FROM permit_applications WHERE status = 'pending';
SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 10;
```

---

## Common Issues & Solutions

### Port Already in Use
```bash
# Find process using port
lsof -i :3001  # or :3000 for frontend

# Kill process
kill -9 PID_NUMBER

# Or use different port
PORT=3002 npm run dev
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Check connection parameters
psql -U permisos_user -d permisos_digitales_v2 -h localhost

# Reset database password
sudo -u postgres psql
ALTER USER permisos_user PASSWORD 'new_password';
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Restart Redis
sudo systemctl restart redis-server  # Linux
brew services restart redis  # macOS

# Check Redis configuration
redis-cli CONFIG GET "*"
```

### Node.js Version Issues
```bash
# Check Node.js version
node --version  # Should be 18+

# Install correct version using n (Node.js version manager)
npx n 18

# Or using nvm
nvm install 18
nvm use 18
```

### Permission Issues
```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm

# Fix file permissions
chmod -R 755 node_modules
```

### Clear Cache
```bash
# Clear npm cache
npm cache clean --force

# Clear frontend cache
cd frontend
rm -rf node_modules/.vite
npm run dev
```

---

## Development Best Practices

### Git Workflow
1. Always work on feature branches
2. Keep commits small and focused
3. Write descriptive commit messages
4. Pull latest changes before starting work
5. Test your changes before pushing

### Code Style
- Follow ESLint/Prettier configurations
- Use TypeScript for new frontend code
- Write tests for new features
- Document complex logic
- Use meaningful variable names

### Security
- Never commit sensitive data (API keys, passwords)
- Use environment variables for configuration
- Validate all user inputs
- Test authentication and authorization

### Performance
- Monitor database query performance
- Use React DevTools Profiler
- Optimize bundle size
- Test on different devices/browsers

---

## Useful Commands

### Development
```bash
# Backend
npm run dev              # Start development server
npm run migrate:up       # Run database migrations
npm run lint            # Check code style
npm test               # Run tests

# Frontend
cd frontend
npm run dev            # Start development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run test           # Run tests
```

### Database
```bash
npm run migrate                    # Check migration status
npm run migrate:up                 # Run pending migrations
npm run migrate:down              # Rollback last migration
npm run migrate:create -- name    # Create new migration
```

### Production Testing
```bash
# Build and test production builds
npm run build
cd frontend && npm run build

# Test production server locally
NODE_ENV=production npm start
```

---

## Getting Help

### Documentation
- [API Documentation](../api/README.md)
- [Architecture Overview](../architecture/OVERVIEW.md)
- [Database Schema](../database/SCHEMA.md)

### Resources
- **Logs**: Check `./logs/app.log` for backend logs
- **Database**: Use pgAdmin or DBeaver for database inspection
- **API Testing**: Use Postman collection (if available)

### Support
- Create GitHub issue for bugs
- Ask team members for help
- Check existing documentation first
- Include error messages and logs when asking for help

---

**Next Steps**: Once your development environment is set up, check out the [Architecture Overview](../architecture/OVERVIEW.md) to understand the system design, and review the [API Documentation](../api/README.md) to understand the available endpoints.

---

**Last Updated**: June 2025 | **Setup Version**: 2.0