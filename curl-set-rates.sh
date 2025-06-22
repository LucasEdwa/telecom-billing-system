# 1. First, login as admin to get a JWT token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourStrongPassword"}' | jq -r .token)

# If you don't have jq, you can manually copy the token from the login response:
# 1. Run this command and copy the "token" value from the output:
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourStrongPassword"}'

# 2. Replace YOUR_TOKEN_HERE below with the copied token:
ADMIN_TOKEN=YOUR_TOKEN_HERE

# 3. Set rates for CALL, SMS, and DATA using the admin token
curl -X PUT http://localhost:3000/rates/CALL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rate": 0.05}'

curl -X PUT http://localhost:3000/rates/SMS \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rate": 0.01}'

curl -X PUT http://localhost:3000/rates/DATA \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rate": 0.10}'

# To install jq on macOS (Homebrew):
brew install jq

# To install jq on Ubuntu/Debian:
sudo apt-get update
sudo apt-get install jq
