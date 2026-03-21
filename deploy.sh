#!/bin/bash

# Google Cloud Deployment Script
# Make sure you have gcloud CLI installed and authenticated

set -e

echo "🚀 Deploying Telecom Billing System to Google Cloud..."

# Configuration
PROJECT_ID="telecom-billing-20260212-2222"
SERVICE_NAME="telecom-billing-system"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

echo "📤 Pushing image to Google Container Registry..."
docker push $IMAGE_NAME

echo "🌐 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DB_HOST=/cloudsql/$PROJECT_ID:$REGION:telecom-db,DB_PORT=3306,DB_USERNAME=telecom-user,DB_PASSWORD=MySecureDBPass123,DB_DATABASE=telecomdb,JWT_SECRET=your-super-secret-jwt-key-production-2026" \
  --memory=1Gi \
  --cpu=1 \
  --max-instances=10 \
  --port=8080

echo "✅ Deployment completed!"
echo "🔗 Your app will be available at the URL shown above"
echo ""
echo "📋 Next steps:"
echo "1. Verify your app is running at the provided URL"
echo "2. Monitor logs using 'gcloud logs read --service=$SERVICE_NAME --limit=50'"
echo "3. Configure your domain (optional)"