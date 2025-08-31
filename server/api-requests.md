## How to get token (with email: user@example.com and password: Pass@123)

```
curl -X 'POST' \
  'http://localhost:4000/api/v1/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "emailOrUsername": "user@example.com",
  "password": "Pass@123"
}'
```

## How to sync project (with ID: cmey2a0t300013y88wnmwov1y)

```
curl -X 'POST' \
  'http://localhost:4000/api/v1/projects/cmey2a0t300013y88wnmwov1y/sync' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d ''
```