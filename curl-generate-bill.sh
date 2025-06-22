export USER_TOKEN=PASTE_YOUR_ACTUAL_JWT_TOKEN_HERE
USER_ID=2

curl -s -X GET http://localhost:3000/billing/$USER_ID \
  -H "Authorization: Bearer $USER_TOKEN" | jq
