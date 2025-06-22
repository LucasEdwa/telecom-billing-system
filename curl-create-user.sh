curl -X POST http://localhost:3000/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "normaluser",
    "email": "user@example.com",
    "password": "lucas.1234",
    "accountType": "user"
  }'
