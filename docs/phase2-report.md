# Phase 2 Engineering Report: Microservices Architecture & Platform Scalability

## 1. Architecture Summary
The system has been successfully re-architected from a monolithic design into a highly scalable, polyglot microservices platform. This transition optimizes for independent service scaling, fault isolation, and technology alignment with specific domain requirements.

At the core of the architecture is an **API Gateway (NGINX)** acting as the central ingress point, routing traffic securely to four independently deployable workloads:
- **Auth Service (Go):** Handles identity management, OAuth2 integration, and JWT issuance with high cryptographic performance.
- **User Service (Go):** Manages user profiles and relational persistence via PostgreSQL.
- **Chat Service (Node.js):** Drives real-time, WebSocket-based messaging, utilizing Redis for transient state/pub-sub and RabbitMQ for asynchronous event distribution.
- **Dashboard Service (Python/FastAPI):** Facilitates analytics and metrics aggregation, interfacing with OpenSearch for deep data querying.

The deployment topology relies on Docker containers orchestrated via Docker Compose for local environments, ensuring operational consistency and isolation through multi-stage builds. This robust foundation perfectly positions the platform for future migration to cloud-native orchestrators like Azure Container Apps.

## 2. Implementation Challenges and Solutions
Transitioning to a distributed model introduced systemic challenges characteristic of microservices at scale. These were addressed through deliberate architectural patterns:

- **State Management & Bidirectional Communication:** Maintaining stateful WebSocket connections across a distributed Chat service required a decoupled communication model. 
  *Solution:* We integrated Redis as a pub/sub backplane to synchronize message delivery across horizontally scaled instances, ensuring reliable message broadcasting regardless of which node a client connects to.
- **Inter-Service Reliability:** Synchronous dependencies between services increase the risk of cascading failures.
  *Solution:* We implemented asynchronous event-driven patterns using RabbitMQ for non-critical flows and introduced strict timeouts and exponential backoff retry mechanisms for synchronous HTTP calls.
- **Configuration & Infrastructure Sprawl:** Managing dependencies (PostgreSQL, MongoDB, Redis, RabbitMQ) threatened to slow developer onboarding.
  *Solution:* A unified, healthcheck-orchestrated Docker Compose topology was engineered, guaranteeing deterministic startup sequences and complete environmental reproducibility.

## 3. Performance Evaluation
A core objective of this phase is validating the architecture under representative production workloads using automated load generation tools (e.g., k6). The benchmark suite evaluates API Gateway throughput, WebSocket connection density, and microservice latency under concurrency.

*Note: Final benchmark results will be inserted after full execution of the finalized load suite. The evaluation focuses on the following critical dimensions:*

| Metric Target | Evaluation Criteria | Expected Profile |
|---------------|---------------------|------------------|
| **Gateway Throughput** | Requests per second (RPS) under sustained load | Linear scaling with minimal queuing latency |
| **Auth Latency** | JWT issuance and validation speeds | Consistent p95 latency under 50ms |
| **WebSocket Density** | Maximum concurrent connections per Chat node | Graceful degradation at high memory thresholds |
| **Database I/O** | Query execution time under read/write contention | Stable connection pooling behavior |

The architecture is designed to handle spikes gracefully, relying on asynchronous queueing and caching to protect primary data stores.

## 4. Observability
Visibility into distributed workloads is critical for maintaining high availability. We have implemented a comprehensive, unified observability stack utilizing Prometheus, Grafana, and OpenSearch.

- **Unified Metrics:** Each microservice (regardless of language) exposes standardized telemetry via a `/metrics` endpoint. Prometheus acts as the central scraper, aggregating critical data such as HTTP error rates, request latency, and resource utilization.
- **Centralized Dashboards:** Grafana provides a single pane of glass, correlating metrics across the Gateway, Application, and Data layers. This enables rapid bottleneck identification and metrics-driven debugging.
- **Container-Native Logging:** Application logs are aggregated to prevent operational blindness, laying the groundwork for robust log indexing via OpenSearch.

*Observability screenshots will be captured from the finalized monitoring stack and appended to the final deployment artifacts.*

## 5. Security
Security has been integrated at multiple layers of the application lifecycle, adopting a zero-trust stance between the public internet and internal workloads.

- **Gateway Enforcement:** The API Gateway acts as the strict entry point, shielding backend services from direct public access. Future iterations will enforce TLS/HTTPS termination directly at this edge layer.
- **Stateless Authentication:** User authorization is managed via cryptographically signed JWTs issued by the Auth Service. This stateless approach eliminates centralized session bottlenecks and allows individual microservices to validate request authenticity independently.
- **OAuth2 Integration:** The authentication flow successfully integrates external identity providers, delegating credential management and reducing internal attack surfaces.
- **Network Isolation:** All data stores and internal services operate on private subnets/Docker networks, accessible only to explicitly authorized application containers.

## 6. Microservices Complexity Reflection
The migration from a monolith to microservices has illuminated profound trade-offs in distributed system design.

While the monolith provided simplicity in deployment and an in-process execution model, it coupled our failure domains. A memory leak in the dashboard could previously crash the real-time chat infrastructure. 

The new distributed architecture provides exceptional fault isolation and technological flexibility (our polyglot strategy). However, it fundamentally shifts complexity from the code level to the operational and network levels. Data consistency is no longer guaranteed by local transactions, necessitating eventual consistency patterns. Debugging requires distributed tracing and centralized logging rather than a simple stack trace. The architectural decisions made during Phase 2 deliberately balance these complexities by prioritizing strong boundaries, standardized communication, and robust observability.

## 7. Known Limitations
To maintain delivery momentum, certain architectural concerns have been constrained to fit the current project phase and remain prime candidates for future scalability enhancements:

- **Single-Node Infrastructure:** Components like the API Gateway and Prometheus currently operate as single instances. Future high-availability (HA) deployments will require redundancy and load balancing at these tiers.
- **Service Mesh Absence:** Inter-service communication relies on direct HTTP/TCP routing. As the service graph expands, introducing a service mesh (e.g., Istio or Linkerd) will provide advanced traffic management and mutual TLS (mTLS).
- **Local Orchestration:** While Docker Compose is highly effective for current evaluation environments, transitioning to Kubernetes or Azure Container Apps will be necessary to achieve automated bin-packing, self-healing, and dynamic auto-scaling in production.
