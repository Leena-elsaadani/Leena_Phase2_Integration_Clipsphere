# ADR-004: Unified Observability Stack

## Status
Accepted

## Context
As the architecture scales into a polyglot microservices pattern, maintaining visibility into system health, performance, and application behavior becomes paramount. A distributed architecture introduces complexity in tracking service availability, network latency, and resource utilization across isolated workloads. We require a monitoring and logging solution that is container-native, highly extensible, and capable of aggregating telemetry from disparate services seamlessly.

## Decision
We adopt a unified, open-source-first observability stack comprising:
- **Prometheus** for metrics scraping and time-series data storage.
- **Grafana** for advanced dashboarding, visualization, and alerting.
- **OpenSearch** for centralized logging, search indexing, and analytics capabilities.
- **Language-specific Prometheus client libraries** (e.g., `promhttp` for Go, `prom-client` for Node.js, `prometheus_client` for Python) embedded directly within each microservice to expose a unified `/metrics` endpoint.

Single-node Prometheus was selected to reduce operational complexity during the current deployment stage while preserving a straightforward migration path toward federated or HA monitoring in future environments.

## Consequences
**Positive:**
- **Unified Metrics Strategy:** All services expose metrics using a standardized protocol, allowing unified dashboarding in Grafana regardless of the underlying language.
- **Operational Efficiency:** The chosen tools are industry standards, well-documented, and boast mature ecosystems with low operational overhead.
- **Container-Native Integration:** Prometheus natively integrates with container orchestrators, making it ideal for our Docker/Azure Container Apps deployment target.
- **Extensibility and Flexibility:** PromQL offers sophisticated querying capabilities for alerting and analysis, while OpenSearch provides robust log aggregation.

**Negative:**
- **Storage Management:** Time-series data and application logs require thoughtful retention policies to prevent unbounded disk usage.
- **Implementation Overhead:** Developers must instrument their services intentionally and maintain consistent metric nomenclature across different codebases.

## Alternatives Considered
- **Commercial APM Solutions (Datadog, New Relic)** — Rejected. While feature-rich, they introduce high licensing costs and vendor lock-in. The open-source stack provides sufficient power with greater flexibility.
- **ELK Stack (Elasticsearch, Logstash, Kibana)** — Rejected in favor of OpenSearch, which offers an open-source, community-driven alternative with comparable capabilities and better alignment with our deployment model.
