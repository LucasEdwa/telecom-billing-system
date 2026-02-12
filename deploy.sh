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
  --set-env-vars="NODE_ENV=production" \
  --memory=1Gi \
  --cpu=1 \
  --max-instances=10 \
  --port=8080

echo "✅ Deployment completed!"
echo "🔗 Your app will be available at the URL shown above"
echo ""
echo "📋 Next steps:"
echo "1. Set up Google Cloud SQL for your database"
echo "2. Update environment variables in Cloud Run console"
echo "3. Configure your domain (optional)"