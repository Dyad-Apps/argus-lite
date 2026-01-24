# ArgusIQ Lite

A multi-tenant IoT platform with unlimited recursive organization hierarchies.

## Architecture

This platform implements a recursive multi-tenant model designed for enterprise IoT deployments.

### Key Features

- **Unlimited Tenant Hierarchy**: Organizations can be nested to any depth using PostgreSQL LTREE
- **Subdomain-Based Routing**: Each root organization is identified by subdomain (e.g., `radio.argusiq.com`)
- **Multi-Tenant User Access**: Users can access multiple organizations with different roles
- **Data Isolation**: Complete data isolation between root tenant universes

## Project Structure

```
argusiq-lite/
├── packages/
│   ├── api/          # Fastify backend API
│   ├── shared/       # Shared types and utilities
│   └── web/          # React frontend
├── monitoring/       # Prometheus + Grafana config
├── docs/             # Documentation
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Clone and install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Valkey)
docker compose up -d

# Set up environment variables
cp .env.example .env

# Build the API package (required for migrations)
cd packages/api && pnpm build

# Run database migrations
pnpm db:migrate:run

# Seed the database
pnpm db:seed

# Start development servers (from project root)
cd ../.. && pnpm dev
```

### Optional: Start Monitoring Stack

```bash
# Start Prometheus, Grafana, and Node Exporter
docker compose --profile monitoring up -d
```

**Access:**
- **API**: http://localhost:3040
- **Web**: http://localhost:5173
- **Grafana**: http://localhost:3001 (admin / argus_dev)
- **Prometheus**: http://localhost:9090
- **API Metrics**: http://localhost:3040/metrics

## Documentation

### Architecture Decision Records

- [ADR-001: Multi-Tenant Model](docs/ADR-IMPLEMENTATION-STATUS.md#adr-001-multi-tenant-model-with-unlimited-recursive-tenant-trees) - Recursive tenant hierarchy with LTREE
- [ADR-002: Subdomain Routing](docs/ADR-IMPLEMENTATION-STATUS.md#adr-002-subdomain-based-root-tenant-identification) - Root tenant identification via subdomain
- [ADR-003: Page Development Workflow](docs/ADR-003-page-development-workflow.md) - Page planning and data source classification

### Technical Documentation

| Document | Description |
|----------|-------------|
| [ADR Implementation Status](docs/ADR-IMPLEMENTATION-STATUS.md) | Tracks ADR requirements vs implementation |
| [ADR-003 Page Development Workflow](docs/ADR-003-page-development-workflow.md) | Page planning and data source classification |
| [Test Coverage Report](docs/TEST-COVERAGE.md) | Test coverage and gap analysis |
| [Theming Guide](packages/web/docs/THEMING.md) | Frontend theming and customization |
| [Monitoring Setup](monitoring/README.md) | Prometheus + Grafana monitoring stack |

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run API tests with coverage
cd packages/api && pnpm test:coverage
```

### Database Commands

```bash
cd packages/api

# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate:run

# Open Drizzle Studio
pnpm db:studio

# Seed database
pnpm db:seed
```

## Tech Stack

### Backend (`packages/api`)

- **Runtime**: Node.js 22
- **Framework**: Fastify 5
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Valkey (Redis-compatible)
- **Auth**: JWT with refresh token rotation
- **Validation**: Zod
- **Metrics**: prom-client (Prometheus)

### Frontend (`packages/web`)

- **Framework**: React 19
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui + Radix UI

### Shared (`packages/shared`)

- **Types**: Branded types for IDs
- **Validation**: Zod schemas
- **Utilities**: Common utilities

### Infrastructure (Docker Compose)

- **Database**: PostgreSQL 17
- **Cache**: Valkey 8
- **Metrics**: Prometheus 2.54
- **Dashboards**: Grafana 11.3
- **Host Metrics**: Node Exporter 1.8

## Implementation Status

### Sprint 1: Auth & Multi-Org (Current)

| Feature | Status |
|---------|--------|
| Multi-tenant database schema | ✅ Complete |
| User authentication | ✅ Complete |
| Organization management | ✅ Complete |
| Dashboard UI | ✅ Complete |
| Subdomain routing | 🔄 Partial |
| Tenant switching | ❌ Not Started |

See [ADR Implementation Status](docs/ADR-IMPLEMENTATION-STATUS.md) for detailed tracking.

## License

Proprietary - All Rights Reserved

---

*Built with the Viaanix Design System*
