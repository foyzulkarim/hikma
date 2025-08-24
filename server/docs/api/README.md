# Hikma API Documentation

Welcome to the comprehensive Hikma API documentation! This directory contains all the documentation you need to integrate with the Hikma Agentic Code Intelligence Platform.

## 📖 Reading Order

Please read the documentation in this order for the best experience:

### 1. [API Overview](./01-overview.md) 
**Start here!** Get familiar with the API basics, authentication, and see a quick start example.

**What you'll learn:**
- What Hikma API can do
- Base URLs and API version
- Authentication flow
- Response formats
- Quick start example

### 2. [API Reference](./02-api-reference.md)
Complete reference documentation for all endpoints with detailed examples.

**What you'll find:**
- All API endpoints documented
- Request/response examples
- Authentication requirements
- Error codes and handling
- Parameter descriptions

### 3. [Setup Guide](./03-setup-guide.md)
Step-by-step guide with real-world examples and troubleshooting.

**What you'll get:**
- Detailed setup instructions
- Complete workflow examples
- curl command examples
- Troubleshooting guide
- Best practices

## 🚀 Quick Links

### For Developers New to Hikma
👉 **[Start with the Overview](./01-overview.md)**

### For Integration Work
👉 **[Jump to API Reference](./02-api-reference.md)**

### For Hands-on Learning
👉 **[Follow the Setup Guide](./03-setup-guide.md)**

## 🌐 Interactive Documentation

While reading these docs, you can also use our interactive Swagger UI:

- **Swagger UI**: `http://localhost:3000/documentation`
- **API Info**: `http://localhost:3000/api/v1/docs`

## 📋 Quick Reference

### Base URLs
- **Development**: `http://localhost:3000`
- **Production**: `https://api.hikma.dev`

### Authentication
```bash
# Get token by logging in
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"your-email","password":"your-password"}'

# Use token in requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/projects
```

### Main Endpoint Groups
- **Authentication**: `/api/v1/auth/*`
- **Projects**: `/api/v1/projects/*`
- **AI Queries**: `/api/v1/query/*`
- **Health**: `/api/v1/health/*`
- **Monitoring**: `/api/v1/monitoring/*`

## 🆘 Need Help?

- **System Health**: `GET /api/v1/health`
- **API Status**: `GET /api/v1/docs`
- **Interactive Testing**: `http://localhost:3000/documentation`

---

**Ready to get started?** Begin with the **[API Overview](./01-overview.md)** 🚀
