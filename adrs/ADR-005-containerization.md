# ADR-005: Containerization and Orchestration Strategy

## Status
Accepted

## Context
Deploying a microservices architecture inherently introduces infrastructure complexity. Ensuring that the application behaves consistently across local development, testing, and production environments requires a robust packaging strategy. We need an approach that isolates dependencies, streamlines onboarding, and manages service lifecycle dependencies efficiently, while remaining proportional to the current stage of the project.

## Decision
We adopt **Docker** for containerization of all microservices and infrastructure components, utilizing **Docker Compose** as the orchestration layer for development, testing, and evaluation environments.

Key architectural choices within this strategy include:
- **Multi-Stage Builds:** Dockerfiles utilize multi-stage builds to ensure that the final production images remain minimal, omitting build dependencies and reducing the attack surface.
- **Healthcheck Orchestration:** Service startup ordering is managed via native Docker Compose healthchecks (`depends_on` with `condition: service_healthy`), ensuring that applications only boot when their dependencies (databases, message brokers) are fully ready.
- **Service Isolation:** Each microservice runs in an isolated container mapped to a unified virtual network, ensuring consistent network topography.

Kubernetes is identified as a future evolution path, but its adoption is intentionally deferred at this stage to avoid unnecessary operational overhead and to maintain agility.

## Consequences
**Positive:**
- **Reproducibility:** 'Works on my machine' issues are eliminated. The entire stack—including data stores and messaging infrastructure—can be spun up reliably with a single command.
- **Security Benefits:** Minimal base images and isolated container runtimes enhance the overall security posture.
- **Operationally Lightweight:** Docker Compose provides sufficient orchestration for our current scale without the steep learning curve and infrastructure requirements of Kubernetes.
- **Streamlined Workflows:** The setup is ideal for team onboarding, architectural evaluations, and final demonstrations.

**Negative:**
- **Production Orchestration Gap:** Docker Compose is optimized for single-host deployments. Transitioning to a distributed production environment (e.g., Azure Container Apps or AKS) will require translating Compose configurations into cloud-native deployment manifests.

## Alternatives Considered
- **Kubernetes (k3s, Minikube)** — Rejected for the current phase. While powerful for production, it introduces excessive complexity for local development and rapid iteration. It remains a viable option for future scaling.
- **Native Installations (Bare Metal)** — Rejected. Managing dependencies, versions, and network configurations directly on host machines is error-prone, insecure, and defeats the purpose of modular microservices.
