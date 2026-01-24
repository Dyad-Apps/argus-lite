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
├── docs/             # Documentation
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 15+ with LTREE extension

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp packages/api/.env.example packages/api/.env

# Run database migrations
cd packages/api && pnpm db:migrate:run

# Seed the database
pnpm db:seed

# Start development servers
cd ../.. && pnpm dev
```

## Documentation

### Architecture Decision Records

- [ADR-001: Multi-Tenant Model](docs/ADR-IMPLEMENTATION-STATUS.md#adr-001-multi-tenant-model-with-unlimited-recursive-tenant-trees) - Recursive tenant hierarchy with LTREE
- [ADR-002: Subdomain Routing](docs/ADR-IMPLEMENTATION-STATUS.md#adr-002-subdomain-based-root-tenant-identification) - Root tenant identification via subdomain

### Technical Documentation

| Document | Description |
|----------|-------------|
| [ADR Implementation Status](docs/ADR-IMPLEMENTATION-STATUS.md) | Tracks ADR requirements vs implementation |
| [Test Coverage Report](docs/TEST-COVERAGE.md) | Test coverage and gap analysis |
| [Theming Guide](packages/web/docs/THEMING.md) | Frontend theming and customization |

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
- **Auth**: JWT with refresh token rotation
- **Validation**: Zod

### Frontend (`packages/web`)

- **Framework**: React 19
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui + Radix UI

### Shared (`packages/shared`)

- **Types**: Branded types for IDs
- **Validation**: Zod schemas
- **Utilities**: Common utilities

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
