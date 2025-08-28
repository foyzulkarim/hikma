# Database Seeding and Management Scripts

This directory contains comprehensive database seeding and management scripts for the Hikma platform. These scripts provide flexible, secure, and environment-aware database initialization and cleanup capabilities.

## 📁 Scripts Overview

### 1. `seed.ts` - Enhanced Main Seeding Script

The primary seeding script with comprehensive improvements:

- **Environment-based configuration** for credentials
- **Multiple user types** (Admin, User, Viewer)
- **Secure password generation** with strength validation
- **Project and relationship seeding**
- **Production safety measures**
- **Enhanced error handling and logging**

### 2. `seed-versions.ts` - Versioned Seed Data

Manages different seed data sets for various environments:

- **Minimal**: Just admin user for production
- **Development**: Full demo data with multiple users and projects
- **Testing**: Complex data with multiple projects and relationships

### 3. `cleanup.ts` - Database Cleanup Script

Safe database cleanup with granular control:

- **Selective cleanup** (users, projects, API keys)
- **Production safety checks**
- **Confirmation prompts**
- **Preserves system admin user**

## 🚀 Quick Start

### Basic Seeding

```bash
# Run enhanced seeding with default settings
npm run seed

# Clean database and reseed
npm run cleanup -- --all --confirm
npm run seed
```

### Environment-Specific Seeding

```bash
# List available seed versions
npm run seed:list

# Seed with specific version
npm run seed:version -- --version minimal
npm run seed:version -- --version development
npm run seed:version -- --version testing
```

### Database Cleanup

```bash
# Interactive cleanup (with confirmation)
npm run cleanup -- --all

# Clean specific data types
npm run cleanup -- --users --confirm
npm run cleanup -- --projects --api-keys
```

## ⚙️ Configuration

### Environment Variables

Add these to your `.env` file for customized seeding:

```env
# Production safety
ALLOW_PRODUCTION_SEEDING=false

# Custom seed credentials (leave empty for secure random passwords)
SEED_ADMIN_EMAIL=admin@hikma.com
SEED_ADMIN_PASSWORD=
SEED_USER_EMAIL=user@hikma.com
SEED_USER_PASSWORD=
SEED_VIEWER_EMAIL=viewer@hikma.com
SEED_VIEWER_PASSWORD=
```

### Password Generation

- **Empty password fields**: Automatically generates secure 16-character passwords
- **Custom passwords**: Validates strength in non-development environments
- **Development mode**: Allows weak passwords for convenience

## 🔒 Security Features

### Production Safety

- **Automatic protection**: Seeding disabled in production by default
- **Override mechanism**: Set `ALLOW_PRODUCTION_SEEDING=true` to override (not recommended)
- **Environment validation**: Checks for required environment variables

### Password Security

- **Secure generation**: Uses cryptographically secure random passwords
- **Strength validation**: Validates password complexity
- **Secure logging**: Only logs credentials for newly created users
- **Hash storage**: All passwords properly hashed with bcrypt

### Data Protection

- **Upsert operations**: Won't overwrite existing users
- **Relationship integrity**: Maintains foreign key constraints
- **Transaction safety**: Proper error handling and rollback

## 📊 Seed Data Structure

### Default Users Created

| Role | Email | Username | Default Password |
|------|-------|----------|------------------|
| ADMIN | admin@hikma.com | admin | Generated/Custom |
| USER | user@hikma.com | demo-user | Generated/Custom |
| VIEWER | viewer@hikma.com | viewer | Generated/Custom |

### Default Project

- **Name**: Demo Project
- **Slug**: demo-project
- **Features**: Knowledge Base, Analytics, Integrations
- **Limits**: 1000 documents, 10000 queries
- **Members**: All users with appropriate roles

## 🛠️ Advanced Usage

### Custom Seed Versions

Create custom seed versions by modifying `seed-versions.ts`:

```typescript
const SEED_VERSIONS: Record<string, SeedVersion> = {
  'custom': {
    version: '1.3.0',
    description: 'Custom seed data for specific use case',
    users: [
      // Your custom users
    ],
    projects: [
      // Your custom projects
    ],
    relationships: [
      // Your custom relationships
    ]
  }
};
```

### Cleanup Options

```bash
# Clean only users (keeps admin)
npm run cleanup -- --users

# Clean only projects and memberships
npm run cleanup -- --projects

# Clean only API keys
npm run cleanup -- --api-keys

# Clean everything (keeps admin)
npm run cleanup -- --all

# Skip confirmation prompt
npm run cleanup -- --all --confirm
```

### Development Workflow

```bash
# 1. Clean existing data
npm run cleanup -- --all --confirm

# 2. Seed with development data
npm run seed:version -- --version development

# 3. Run your tests or development server
npm run dev

# 4. Clean up after testing
npm run cleanup -- --projects --confirm
```

## 🔍 Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure `DATABASE_URL` and `JWT_SECRET` are set in your `.env` file

2. **"Seeding is disabled in production"**
   - This is intentional for safety. Set `ALLOW_PRODUCTION_SEEDING=true` if needed

3. **"Weak password" warnings**
   - Use stronger passwords or set `NODE_ENV=development` for testing

4. **Foreign key constraint errors**
   - Run cleanup before seeding: `npm run cleanup -- --all --confirm`

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
DEBUG=true npm run seed

# Or with specific version
DEBUG=true npm run seed:version -- --version testing
```

## 📝 Logging

### Seed Script Output

- **🌱** Starting seeding process
- **👥** Creating user accounts
- **📁** Creating projects
- **🔗** Creating relationships
- **🔐** Displaying new user credentials
- **✅** Success confirmations
- **⚠️** Warnings and important notes
- **❌** Error messages

### Credential Logging

Credentials are only logged for newly created users:

```
🔐 Created user accounts:
==================================================
📧 admin@hikma.com        (ADMIN ): Xy9#mK2$pL8@nQ4!
📧 user@hikma.com         (USER  ): Bz7&vN3!rM9#sT6@
📧 viewer@hikma.com       (VIEWER): Cw8*xP4$qL2&uR5!
==================================================
⚠️  Please save these credentials and change them after first login!
💡 Tip: Use the /auth/change-password endpoint to update passwords
```

## 🔄 Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Setup Database
  run: |
    npm run migrate:dev
    npm run seed:version -- --version minimal --confirm
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Docker Integration

```dockerfile
# In your Dockerfile
RUN npm run seed:version -- --version minimal --confirm
```

## 📚 API Integration

After seeding, you can immediately use the authentication endpoints:

```bash
# Login with seeded admin user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hikma.com","password":"your_generated_password"}'
```

## 🤝 Contributing

When adding new seed data or features:

1. **Update seed versions** in `seed-versions.ts`
2. **Add environment variables** to `.env.example`
3. **Update this README** with new features
4. **Test with different environments**
5. **Ensure production safety**

## 📄 License

These scripts are part of the Hikma platform and follow the same license terms.