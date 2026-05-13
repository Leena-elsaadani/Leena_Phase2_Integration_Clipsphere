# Scalable Real-Time Chat Platform: Complete Architecture Report

## 1. Executive Summary
The Scalable Real-Time Chat Platform is a modern, distributed microservices application engineered for high availability, security, and performance. Transitioning from a legacy monolithic design, the current architecture embraces a polyglot microservices paradigm. By decoupling domain logic into distinct services, the platform achieves independent scalability, fault isolation, and technology optimization tailored to specific workload profiles.

This report details the end-to-end architecture, encompassing traffic routing, application services, state management, observability, and performance validation strategies.

---

## 2. High-Level System Architecture

The system is logically divided into four distinct layers:
1. **Edge / Ingress Layer:** API Gateway (NGINX) managing external traffic.
2. **Application Layer:** Four independently deployable microservices (Auth, User, Chat, Dashboard).
3. **Data & Message Layer:** Purpose-built databases and a message broker.
4. **Observability Layer:** Centralized metrics and logging infrastructure.

### 2.1 The Polyglot Microservices Strategy
To maximize performance and leverage domain-specific ecosystem strengths, a polyglot approach was adopted:

- **Auth Service (Go):** Engineered for rigorous security. Go’s high performance, low latency, and robust standard library for cryptography make it ideal for handling OAuth2 flows, generating JWTs, and validating external identity providers.
- **User Service (Go):** Handles user profile creation, relationship mapping, and state management. Go's efficient concurrency model ensures fast read/write throughput to the relational database.
- **Chat Service (Node.js):** The core of the platform's real-time capabilities. Node.js's non-blocking, event-driven architecture is uniquely suited for managing thousands of persistent, concurrent WebSocket connections with minimal overhead.
- **Dashboard Service (Python/FastAPI):** Built for administrative analytics and aggregation. Python's unparalleled data processing ecosystem, paired with FastAPI's rapid execution, handles complex metrics computation efficiently.

---

## 3. Network and Ingress Management

### 3.1 NGINX API Gateway (Edge Routing)
A centralized **NGINX API Gateway** acts as the strict entry point for all client traffic, decoupling the internal microservices topology from the public web. 

**Key Responsibilities:**
- **Reverse Proxy & Routing:** Inspects incoming request paths (e.g., `/api/v1/auth`, `/api/v1/chat`) and routes them to the appropriate backend container.
- **TLS/HTTPS Termination:** Secures public transit by terminating SSL connections at the edge before passing decrypted traffic into the internal, trusted network.
- **Load Balancing:** Distributes traffic evenly across horizontally scaled instances of specific microservices.
- **Rate Limiting & Security:** Protects backend services from DDoS attacks and brute-force attempts by enforcing strict rate limits per IP.

---

## 4. Data Stores and Message Brokering

The "Database-per-Service" pattern is strictly enforced to prevent tight coupling and ensure that individual service failures do not cascade.

- **PostgreSQL (User & Auth Data):** A relational store ensuring ACID compliance for critical structured data, including user credentials, relationships, and platform metadata.
- **MongoDB (Chat History):** A NoSQL document store optimized for high-volume, unstructured data ingestion, perfectly suited for storing massive chat histories and flexible message payloads.
- **Redis (Caching & Pub/Sub):** Operates dually as a high-speed cache for frequently accessed data (like active user sessions) and as a crucial Pub/Sub backplane. The Pub/Sub mechanism allows multiple scaled Node.js Chat instances to broadcast WebSocket messages across the cluster seamlessly.
- **RabbitMQ (Asynchronous Events):** An enterprise message broker that handles non-real-time, asynchronous communication (e.g., notifying the Dashboard service of system events, or processing offline notifications), ensuring the primary critical paths remain unblocked.

---

## 5. Security and Authentication

Security operates on a zero-trust model between the public internet and the internal virtual network.

- **OAuth2 Integration:** Users authenticate via trusted third-party providers (e.g., Google OAuth). The Auth service validates the callback and manages the exchange securely.
- **Stateless JWT Authorization:** Upon successful authentication, the Auth service issues a cryptographically signed JSON Web Token (JWT).
- **Decentralized Validation:** Because JWTs are stateless, any internal microservice can independently verify the token's signature using a shared public key, entirely eliminating the need for a centralized session database lookup on every request.

---

## 6. Observability and Monitoring

Distributed systems require aggressive, proactive monitoring. The platform implements a unified observability stack:

- **Prometheus (Metrics Scraping):** Every microservice exposes a standardized `/metrics` endpoint. Prometheus acts as the central time-series database, actively scraping and storing telemetry (request latency, error rates, CPU/Memory usage).
- **Grafana (Visualization):** Connects to Prometheus to provide highly visual, real-time dashboards. This "single pane of glass" allows engineers to correlate anomalies across the gateway, services, and databases instantly.
- **OpenSearch (Log Aggregation):** Centralizes application and container logs. Instead of SSH-ing into individual containers, developers can query logs globally across the cluster to trace distributed transactions.

---

## 7. Performance Validation (k6 Testing)

To guarantee the architecture meets stringent production SLAs, automated load testing is integrated into the engineering lifecycle using **k6**.

**Testing Strategy:**
- **Throughput Profiling (RPS):** Stress testing the NGINX API Gateway and Auth Service to validate baseline requests-per-second capabilities under sustained load.
- **WebSocket Connection Density:** Specialized k6 scripts open and hold thousands of concurrent WebSocket connections against the Node.js Chat Service to identify memory limits and validate Redis Pub/Sub broadcast efficiency.
- **Spike & Soak Testing:** Verifying that the application gracefully degrades (using RabbitMQ queues) during sudden traffic spikes, and ensuring no memory leaks occur during extended periods of continuous operation.

---

## 8. Containerization and Deployment Topology

### 8.1 Docker & Docker Compose
The entire infrastructure is fully containerized using **Docker**, utilizing multi-stage builds to ensure minimal, secure, and production-ready images. For development and evaluation, **Docker Compose** acts as the orchestration engine. 

It guarantees reproducibility through strictly defined network topologies and native healthcheck orchestration (ensuring databases boot before application services).

### 8.2 Production Target (Azure)
The architecture is inherently cloud-native and designed for a seamless transition to the Azure ecosystem:
- **Compute:** Services map directly to *Azure Container Apps* for managed, serverless microservice scaling.
- **Data:** Local databases translate to managed services: *Azure Database for PostgreSQL Flexible Server*, *Cosmos DB for MongoDB*, and *Azure Cache for Redis*.
- **Messaging:** RabbitMQ can be gracefully swapped for *Azure Service Bus*.
- **Edge Security:** The NGINX gateway will sit securely behind an *Azure Application Gateway*.

---

## 9. Conclusion
This architecture represents a highly mature, defensively engineered system. By embracing domain-driven language choices, decoupling state via Pub/Sub, enforcing zero-trust API boundaries, and relying on data-driven load testing, the platform is comprehensively prepared for high-scale, real-time production environments.
