curl -X POST http://localhost:3000/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "adminuser",
    "email": "admin@example.com",
    "password": "yourStrongPassword",
    "accountType": "admin"
  }'
