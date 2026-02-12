# Google Cloud Deployment Guide

## Prerequisites

1. **Install Google Cloud CLI**:
   ```bash
   # macOS
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   ```

2. **Install Docker** (if not already installed)

3. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## Quick Deployment Steps

### 1. Set up Google Cloud Project
```bash
# Create a new project (or use existing one)
gcloud projects create telecom-billing-20260212-2222
gcloud config set project telecom-billing-20260212-2222

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 2. Set up Database (Google Cloud SQL)
```bash
# Create MySQL instance
gcloud sql instances create telecom-db \
    --database-version=MYSQL_8_0 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create telecomdb --instance=telecom-db

# Create user
gcloud sql users create telecom-user \
    --instance=telecom-db \
    --password=YOUR_SECURE_PASSWORD
```

### 3. Update Configuration
1. Edit `deploy.sh` and replace `your-gcp-project-id` with your actual project ID
2. Get your Cloud SQL connection string:
   ```bash
   gcloud sql instances describe telecom-db --format="value(connectionName)"
   ```

### 4. Deploy Application
```bash
# Run the deployment script
./deploy.sh
```

### 5. Configure Environment Variables
After deployment, set environment variables in Cloud Run:
```bash
gcloud run services update telecom-billing-system \
    --region=us-central1 \
    --set-env-vars="DB_HOST=/cloudsql/YOUR_PROJECT:us-central1:telecom-db,DB_USERNAME=telecom-user,DB_PASSWORD=YOUR_SECURE_PASSWORD,DB_DATABASE=telecomdb,JWT_SECRET=your-jwt-secret"
```

## Manual Deployment (Alternative)

If you prefer manual deployment through Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Cloud Run
3. Click "Create Service"
4. Select "Deploy from source repository" or "Deploy from existing container image"
5. Configure the service with the settings from `deploy.sh`

## Environment Variables to Set in Cloud Run

- `NODE_ENV`: production
- `DB_HOST`: Your Cloud SQL connection string
- `DB_USERNAME`: Your database username
- `DB_PASSWORD`: Your database password  
- `DB_DATABASE`: telecomdb
- `JWT_SECRET`: A secure random string
- `ALLOWED_ORIGINS`: Your frontend domain(s)

## Monitoring and Logs

View logs:
```bash
gcloud logs read --service=telecom-billing-system --limit=50
```

## Cost Optimization

For production:
- Use Cloud SQL Proxy for secure database connections
- Set up proper IAM roles
- Configure health checks
- Set up monitoring and alerting
- Use Cloud CDN for static assets (if any)

## Troubleshooting

1. **Database Connection Issues**: Ensure Cloud SQL instance is running and connection string is correct
2. **Memory Issues**: Increase memory allocation in Cloud Run settings
3. **Cold Starts**: Consider using minimum instances for better performance
4. **Authentication**: Make sure all required APIs are enabled

## Security Best Practices

1. Never commit `.env` files with real credentials
2. Use Google Secret Manager for sensitive data
3. Enable Cloud Run authentication if needed
4. Set up proper CORS origins
5. Use HTTPS only (Cloud Run provides this by default)