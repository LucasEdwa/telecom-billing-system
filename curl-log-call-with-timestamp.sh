# Make sure to replace YOUR_USER_TOKEN with a valid JWT token for userId 2.
# To get the token, login as the user and copy the "token" value from the response:
# Example:
# curl -X POST http://localhost:3000/users/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"user@example.com","password":"lucas.1234"}'

# Then, set:
# export USER_TOKEN=PASTE_YOUR_TOKEN_HERE

# DO NOT use placeholders like YOUR_USER_TOKEN or YOUR_USER_ID in the actual curl command.
# Make sure to set USER_TOKEN and USER_ID to real values before running the script.

# Example of setting real values:
export USER_TOKEN=PASTE_YOUR_ACTUAL_JWT_TOKEN_HERE
USER_ID=2

curl -X POST http://localhost:3000/usage/calls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"userId": 2, "duration": 15, "timestamp": "2024-06-01T12:00:00Z"}'
