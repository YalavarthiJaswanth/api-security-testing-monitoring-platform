# API Sentinel — API Security Testing & Monitoring Platform

> **Secure Every API. Detect Every Threat.**

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-Jenkins%2014--Stage-blue?style=flat-square&logo=jenkins)](./Jenkinsfile)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kind%20Kubernetes-326ce5?style=flat-square&logo=kubernetes)](./k8s)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ed?style=flat-square&logo=docker)](./docker-compose.yml)
[![OWASP](https://img.shields.io/badge/Security-OWASP%20API%20Top%2010%20(2023)-critical?style=flat-square)](https://owasp.org/www-project-api-security/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

---

## 🛡️ Project Overview

**API Sentinel** is an enterprise-grade API Security Testing & Continuous Monitoring SaaS platform built for DevSecOps teams and cybersecurity engineers. It provides genuine, dynamic API security testing (DAST) conforming to the **OWASP API Security Top 10 (2023)**, Postman-style interactive testing, real-time availability and latency monitoring, cryptographic credential storage, and an isolated Simulation Lab for security demonstrations.

### Key Capabilities
- **Real Dynamic Security Testing (DAST):** Automated vulnerability assessments with genuine HTTP evidence gathering—no mock or hardcoded results.
- **OWASP API Security Top 10 (2023):** Specialized checks for BOLA/IDOR, Broken Authentication, Broken Object Property Level Authorization, Unrestricted Resource Consumption, BFLA, SSRF, and Security Misconfigurations.
- **Interactive Postman-Style API Workspace:** Craft custom GET/POST/PUT/PATCH/DELETE requests, inspect live response headers, status codes, latency in milliseconds, payload size, and formatted JSON.
- **OpenAPI / Swagger Auto-Discovery:** Instant parsing of OpenAPI 3.0 and Swagger 2.0 specifications from URLs or pasted JSON/YAML.
- **Continuous API Availability Monitoring:** Background synthetic ping workers tracking uptime %, latency thresholds, and health status over time.
- **Separate Vulnerable Simulation Lab:** Completely isolated educational laboratory with 7 real vulnerable API endpoints for university and interview demonstrations.
- **Executive & Technical Reporting:** One-click generation of formal security reports in **PDF** and **JSON** formats.
- **Defense-in-Depth:** AES-256-GCM encryption for stored API credentials and strict anti-SSRF protections blocking private RFC1918 subnets and cloud metadata endpoints.
- **Cloud-Native & Production-Ready:** Complete Docker Compose setup, 14-stage Jenkins CI/CD pipeline, and local Kubernetes (Kind) manifests.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts | Premium cybersecurity dark-mode UI with 12 distinct pages and real database metrics. |
| **Backend API** | Node.js 20, Express, TypeScript, Mongoose, Axios, jsPDF | REST API gateway, JWT authentication, OpenAPI parser, SSRF filter, report generator. |
| **Security Engine** | Python 3.11, FastAPI, Uvicorn, HTTPX, Pydantic | Asynchronous microservice executing non-destructive OWASP API Top 10 vulnerability checks. |
| **Simulation Lab** | Node.js Express Isolated Microservice (Port 5050) | Dedicated vulnerable target environment replicating real API weaknesses. |
| **Database** | MongoDB 7.0 | Document store with indexes, data isolation, and persistent volume claim support. |
| **CI/CD** | Jenkins | 14-stage automated pipeline with linting, testing, Docker builds, Trivy scans, GHCR, and K8s rollout. |
| **Orchestration** | Docker Compose & Kubernetes (Kind) | Multi-container composition and Kubernetes StatefulSet, Deployments, and Services. |

For detailed system topology, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 🖥️ Platform Modules & Pages (12 Views)

1. **Login & Registration:** Secure user authentication using bcrypt password hashing and signed JWT sessions.
2. **Main Dashboard:** Real-time SOC dashboard aggregating live MongoDB metrics: Total APIs, Active Scans, Vulnerabilities by Severity, OWASP Category Breakdown, and Uptime %.
3. **API Inventory:** Management console for registered API targets with environment tags, auth types, and route counts.
4. **Add New API:** Wizard supporting manual endpoint registration or automatic OpenAPI JSON/YAML discovery.
5. **API Testing Workspace:** Interactive Postman-style HTTP console with real-time response inspection (status, latency ms, size KB, response headers, JSON formatting).
6. **Vulnerability Scanner:** Automated scanner console supporting Full OWASP Top 10, Quick Audit, and Misconfiguration scan profiles with live terminal logs.
7. **Security Findings:** Filterable vulnerability catalog with expandable detail views displaying explanation, impact, remediation, and raw HTTP evidence.
8. **API Monitoring:** Uptime and latency telemetry with area charts, configurable ping intervals, and threshold alerts.
9. **Scan History:** Audit trail of all previous security scans with duration, findings breakdown, and log archives.
10. **Reports:** Executive and technical security report exporter supporting PDF and JSON formats.
11. **Simulation Lab:** Educational sandbox demonstrating 7 vulnerable API attack scenarios with side-by-side exploit comparison.
12. **Settings:** Platform configuration overview displaying AES-256-GCM vault status, SSRF policies, and Kubernetes cluster telemetry.

---

## 🚀 Quick Start with Docker Compose

Ensure [Docker](https://docs.docker.com/get-docker/) is running on your machine.

### 1. Clone & Enter the Repository
```bash
git clone https://github.com/YalavarthiJaswanth/api-security-testing-monitoring-platform.git
cd api-security-testing-monitoring-platform
```

### 2. Launch All Services
```bash
docker compose up --build -d
```

### 3. Verify Service Health
```bash
docker compose ps
```

All 5 services will start and report healthy:
- **Frontend SOC Dashboard:** [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000))
- **Backend API Gateway:** [http://localhost:5001/health](http://localhost:5001/health)
- **Python Security Testing Engine:** [http://localhost:8000/health](http://localhost:8000/health)
- **Vulnerable Simulation Lab:** [http://localhost:5050/health](http://localhost:5050/health)
- **MongoDB Database:** `localhost:27017`

### 4. Stop Services
```bash
docker compose down
```

---

## ☸️ Local Kubernetes Deployment (Kind)

Deploy the complete application to a local **Kind** Kubernetes cluster.

### 1. Verify Prerequisites
```bash
kubectl version --client
kind version
```

### 2. Create Cluster (or use existing)
```bash
kind create cluster --name api-sentinel-cluster
```

### 3. Build & Load Images into Kind
```bash
docker build -t sentinel-frontend:latest frontend/
docker build -t sentinel-backend:latest backend/
docker build -t sentinel-security-engine:latest security-engine/
docker build -t sentinel-vulnerable-lab:latest vulnerable-lab/

kind load docker-image sentinel-frontend:latest --name api-sentinel-cluster
kind load docker-image sentinel-backend:latest --name api-sentinel-cluster
kind load docker-image sentinel-security-engine:latest --name api-sentinel-cluster
kind load docker-image sentinel-vulnerable-lab:latest --name api-sentinel-cluster
```

### 4. Apply Kubernetes Manifests
```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets-configmap.yaml
kubectl apply -f k8s/02-mongodb.yaml
kubectl apply -f k8s/03-security-engine.yaml
kubectl apply -f k8s/04-backend.yaml
kubectl apply -f k8s/05-vulnerable-lab.yaml
kubectl apply -f k8s/06-frontend.yaml
```

### 5. Verify Rollout & Access
```bash
kubectl get pods,services,pvc -n api-sentinel -o wide
kubectl port-forward svc/frontend 8080:80 -n api-sentinel
```
Open [http://localhost:8080](http://localhost:8080) to access the platform.

---

## 🧪 Local Development Setup

To run each microservice locally for development:

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Python Security Engine
```bash
cd security-engine
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Vulnerable Lab
```bash
cd vulnerable-lab
npm install
npm start
```

---

## 🔒 Security & Safe Testing Notice

API Sentinel implements strict target filtering. By default:
- Testing against private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and cloud metadata (`169.254.169.254`) is rejected.
- Only authorized targets owned by the operator should be tested.
- The Simulation Lab provides a safe, locally hosted environment for vulnerability demonstration.

---

## 👥 Core Development Team & Contributors

| Team Member | GitHub Profile | Project Contributions & Responsibilities |
| :--- | :--- | :--- |
| **Yalavarthi Jaswanth** (Lead) | [@YalavarthiJaswanth](https://github.com/YalavarthiJaswanth) | Full-Stack Platform Architecture, Backend REST APIs, AES-256 Vault, Kind Kubernetes & CI/CD Pipeline |
| **Pramodh Chitta** | [@chittapramodh05](https://github.com/chittapramodh05) | OWASP Vulnerability Testing Heuristics, Simulation Lab Scenarios, Scanner Pytest Suite & Exploit Guides |
| **Anjan Krishna** | [@Anjankrishna260106](https://github.com/Anjankrishna260106) | Real-Time Latency & Health Monitoring Engine, Executive PDF/JSON Reporting & Regulatory Compliance (SOC2/HIPAA) |

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
