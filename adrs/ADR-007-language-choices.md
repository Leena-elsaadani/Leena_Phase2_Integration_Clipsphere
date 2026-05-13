# ADR-007: Polyglot Microservices and Language Choices

## Status
Accepted

## Context
A primary advantage of a distributed microservices architecture is the ability to decouple service implementations from a single technology stack. Different business domains within our platform have distinct operational requirements: the Chat service demands high-throughput real-time event processing, the Auth service requires rigorous security and fast cryptographic operations, and the Dashboard service involves aggregation and analytical queries. Imposing a single language across all domains would necessitate unacceptable compromises in performance or development velocity.

## Decision
We adopt an intentional, domain-driven polyglot architecture, selecting languages optimized for specific workload profiles:

1. **Go (Auth Service & User Service)**
   - **Rationale:** Go provides exceptional performance, minimal memory footprint, and strong concurrency primitives. Its mature standard library excels in security-sensitive workloads, cryptographic operations, and TLS handling. It is structurally ideal for high-throughput, latency-sensitive core services like Authentication and User Identity management.

2. **Node.js (Chat Service)**
   - **Rationale:** The Chat service is heavily reliant on real-time, bidirectional WebSocket connections. Node.js's event-driven, non-blocking I/O model is uniquely suited for maintaining thousands of concurrent WebSocket connections efficiently. The mature ecosystem around real-time messaging libraries further accelerates feature delivery.

3. **Python / FastAPI (Dashboard Service)**
   - **Rationale:** The Dashboard service manages metrics aggregation, administrative analytics, and data visualization workflows. Python dominates the data analysis ecosystem, and FastAPI provides high performance, out-of-the-box data validation via Pydantic, and rapid iteration capabilities perfectly aligned with analytics workflows.

## Consequences
**Positive:**
- **Optimized Workloads:** Each service leverages the ecosystem and runtime characteristics best aligned with its specific operational constraints.
- **Architectural Flexibility:** Teams can adopt the best tool for the job, improving overall system resilience and performance.
- **Isolation of Concerns:** Language-specific vulnerabilities or runtime limitations are constrained to individual services.

**Negative:**
- **Tooling Diversity:** A polyglot architecture introduces additional tooling diversity, requiring broader knowledge across the engineering team for cross-service debugging and CI/CD maintenance.
- **Code Duplication:** Shared models and logic (e.g., standard HTTP response wrappers, authentication middleware) must be implemented idiomatically in multiple languages.

## Alternatives Considered
- **Monoglot (Single Language - e.g., all Node.js or all Go)** — Rejected. While simplifying tooling and CI/CD, this approach would force compromises. Node.js is less optimal for heavy cryptographic operations compared to Go, and Go's data analysis ecosystem is less robust than Python's.
