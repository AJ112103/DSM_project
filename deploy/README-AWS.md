# AWS Deployment Guide — DSM Project

## Architecture
- **Backend**: AWS App Runner (ap-south-1, Mumbai) — runs the FastAPI API
- **Frontend**: Vercel (free) — hosts the Next.js app
- **Alternative**: Deploy both via a single EC2 instance

---

## Option 1: AWS App Runner (Recommended — Serverless)

### Prerequisites
1. AWS CLI configured (`aws configure` with ap-south-1 region)
2. Docker installed locally
3. An ECR repository created

### Steps

```bash
# 1. Create ECR repository (one-time)
aws ecr create-repository \
  --repository-name dsm-project-api \
  --region ap-south-1

# 2. Build and push Docker image
cd /path/to/DSM_project

# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Build
docker build -f backend/Dockerfile -t dsm-project-api .

# Tag and push
docker tag dsm-project-api:latest \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/dsm-project-api:latest

docker push \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/dsm-project-api:latest

# 3. Create App Runner service
aws apprunner create-service \
  --service-name dsm-project-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/dsm-project-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "GROQ_API_KEY": "<your-groq-api-key>"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  }' \
  --region ap-south-1
```

### After deployment:
- App Runner gives you a URL like `https://xxxxx.ap-south-1.awsapprunner.com`
- Set this as `NEXT_PUBLIC_API_URL` in your Vercel frontend deployment

---

## Option 2: EC2 Instance (Full Control)

```bash
# 1. Launch EC2 instance (t3.small, Ubuntu 22.04, ap-south-1)
# 2. SSH in and install dependencies:
sudo apt update && sudo apt install -y python3-pip nodejs npm
pip3 install -r backend/requirements.txt

# 3. Clone repo and start
cd DSM_project
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
cd frontend && npm install && npm run build && npm start &

# 4. Configure security group: allow inbound on ports 8000 and 3000
```

---

## Frontend Deployment (Vercel)

```bash
# From the frontend/ directory:
cd frontend
npx vercel --prod

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://your-apprunner-url.ap-south-1.awsapprunner.com
```

---

## Environment Variables

| Variable | Where | Value |
|---|---|---|
| `GROQ_API_KEY` | Backend (App Runner / EC2) | Your Groq API key for LLM agent |
| `NEXT_PUBLIC_API_URL` | Frontend (Vercel) | Backend API URL |
