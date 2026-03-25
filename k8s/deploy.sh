#!/bin/bash
# -------------------------------------------------------
# Kubernetes deployment script for telecom-billing-system
# Uses minikube for local cluster deployment
# -------------------------------------------------------

set -e

PROFILE=${MINIKUBE_PROFILE:-demo}
IMAGE_NAME="telecom-billing:latest"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TLS_SECRET_NAME="telecom-billing-tls"
TLS_NAMESPACE="telecom-billing"
DOMAIN="api.lucasdev"

echo "================================================"
echo " Telecom Billing System - Kubernetes Deploy"
echo "================================================"

# ---- Step 1: Ensure Docker is running ----
echo ""
echo "==> [1/5] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker is not running."
  echo "Please open Docker Desktop and wait for it to start, then re-run this script."
  exit 1
fi
echo "    Docker is running."

# ---- Step 2: Start minikube if not running ----
echo ""
echo "==> [2/5] Checking minikube cluster '$PROFILE'..."
MINIKUBE_STATUS=$(minikube status -p "$PROFILE" --format='{{.Host}}' 2>/dev/null || echo "Stopped")

if [ "$MINIKUBE_STATUS" != "Running" ]; then
  echo "    Cluster not running. Starting minikube..."
  minikube start -p "$PROFILE" --driver=docker --cpus=2 --memory=2048
else
  echo "    Cluster is already running."
fi

# Set kubectl context to this profile
kubectl config use-context "$PROFILE"

# ---- Step 3: Build image inside minikube's Docker daemon ----
echo ""
echo "==> [3/5] Building Docker image inside minikube..."
echo "    (Pointing Docker CLI to minikube's Docker daemon)"
eval "$(minikube -p "$PROFILE" docker-env)"

docker build -t "$IMAGE_NAME" "$PROJECT_ROOT"
echo "    Image '$IMAGE_NAME' built successfully."

# ---- Step 4: Apply Kubernetes manifests ----
echo ""
echo "==> [4/5] Applying Kubernetes manifests..."

kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/secret.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/deployment.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/service.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/hpa.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/networkpolicy.yaml"

# ---- TLS: Generate browser-trusted cert using mkcert ----
echo ""
echo "==> [TLS] Setting up trusted TLS certificate with mkcert..."

if ! command -v mkcert &> /dev/null; then
  echo "    Installing mkcert..."
  brew install mkcert
fi

# Install local CA into system/browser trust stores (only needed once)
mkcert -install

# Generate cert trusted by all browsers for our domain
TMP_DIR=$(mktemp -d)
mkcert -cert-file "$TMP_DIR/tls.crt" -key-file "$TMP_DIR/tls.key" \
  "$DOMAIN" "127.0.0.1" "localhost"

# Create/update the k8s TLS secret
kubectl delete secret "$TLS_SECRET_NAME" -n "$TLS_NAMESPACE" --ignore-not-found
kubectl create secret tls "$TLS_SECRET_NAME" \
  --cert="$TMP_DIR/tls.crt" \
  --key="$TMP_DIR/tls.key" \
  -n "$TLS_NAMESPACE"

rm -rf "$TMP_DIR"
echo "    TLS secret '$TLS_SECRET_NAME' created (browser-trusted)."

# Add domain to /etc/hosts if not already there
if ! grep -q "$DOMAIN" /etc/hosts; then
  echo "    Adding $DOMAIN to /etc/hosts (requires sudo)..."
  echo "127.0.0.1  $DOMAIN" | sudo tee -a /etc/hosts > /dev/null
  echo "    Added."
else
  echo "    $DOMAIN already in /etc/hosts."
fi

# Ingress requires the ingress addon — enable it if not already on
if ! minikube addons list -p "$PROFILE" | grep -q "ingress.*enabled"; then
  echo "    Enabling minikube ingress addon..."
  minikube addons enable ingress -p "$PROFILE"
fi

# Wait for the ingress webhook to be ready before applying
echo "    Waiting for ingress-nginx webhook to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml"

# ---- Step 5: Wait and show status ----
echo ""
echo "==> [5/5] Waiting for deployment to roll out..."
kubectl rollout status deployment/telecom-billing -n telecom-billing --timeout=120s

echo ""
echo "================================================"
echo " Deployment complete!"
echo "================================================"
echo ""
echo "Pods:"
kubectl get pods -n telecom-billing

echo ""
echo "Services:"
kubectl get svc -n telecom-billing

echo ""
echo "==> Opening tunnel to expose the service locally..."
echo "    Run this in a separate terminal to access the API:"
echo ""
echo "    kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8443:443"
echo ""
echo "    Then open: https://$DOMAIN:8443/api-docs"
echo ""
