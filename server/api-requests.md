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

## How to sync project (with ID: cmez632ld000211bepggjjzwn)

```
curl -X 'POST' 'http://localhost:4000/api/v1/projects/cmez632ld000211bepggjjzwn/sync' -H 'accept: application/json' -H 'Content-Type: application/json' -H 'Authorization: Bearer eyJhbGci...' -d '{}'
```