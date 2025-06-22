# 1. Login as the normal user to get a JWT token
USER_TOKEN=$(curl -s -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"lucas.1234"}' | jq -r .token)

# 2. Set your user ID (replace with the actual user ID, e.g., 2)
USER_ID=2

# 3. Make 3 call logs using the token and user ID
curl -X POST http://localhost:3000/usage/calls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"userId\": $USER_ID, \"duration\": 10}"

curl -X POST http://localhost:3000/usage/calls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"userId\": $USER_ID, \"duration\": 5}"

curl -X POST http://localhost:3000/usage/calls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"userId\": $USER_ID, \"duration\": 20}"
