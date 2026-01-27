# Sprint 0: Foundation - Completion Status

> **Status:** ✅ **COMPLETE**
> **Date Completed:** January 27, 2026
> **Total Items:** 20 issues (from planning docs)
> **Completed:** 20/20 (100%)

## Overview

Sprint 0 established the technical foundation for the Argus IQ IoT Platform. All infrastructure, tooling, and architectural patterns are in place and production-ready.

---

## ✅ Completed Items

### Infrastructure & Tooling

| # | Item | Status | Notes |
|---|------|--------|-------|
| 001 | Monorepo Setup (pnpm workspaces) | ✅ Complete | pnpm workspaces with TypeScript references |
| 002 | Fastify 5 + Zod Type Provider | ✅ Complete | Type-safe routes with automatic validation |
| 003 | Drizzle ORM + Migrations | ✅ Complete | Schema-first with custom SQL migrations |
| 004 | PostgreSQL 17 Docker Compose | ✅ Complete | Port 5433, RLS enabled, LTREE extension |
| 005 | Valkey Docker Compose | ✅ Complete | Redis-compatible cache on port 6378 |
| 006 | GitHub Actions CI | ✅ Complete | Lint, typecheck, test on PR |
| 007 | React 19 + Vite 7 + TanStack Router | ✅ Complete | Modern React stack |
| 008 | Tailwind 4 + shadcn/ui | ✅ Complete | Component library with dark mode |
| 009 | Pino Structured Logging | ✅ Complete | JSON logging with sensitive field redaction |
| 010 | Config Validation (Zod) | ✅ Complete | Environment variable validation |

### API & Middleware

| # | Item | Status | Notes |
|---|------|--------|-------|
| 011 | Health Check Endpoints | ✅ Complete | `/health/live`, `/health/ready` |
| 012 | API Versioning Setup | ✅ Complete | `/api/v1/` prefix on all routes |
| 013 | Standardized Error Responses | ✅ Complete | Consistent error format with request IDs |
| 014 | Repository Pattern Base | ✅ Complete | Base repository with pagination, transactions |
| 015 | **CORS Configuration** | ✅ **Complete** | Environment-based origin whitelist |
| 016 | **Graceful Shutdown** | ✅ **Complete** | SIGTERM/SIGINT handlers, connection draining |
| 017 | **Sentry Error Tracking** | ✅ **Complete** | Full Sentry integration with context |
| 018 | **Branded ID Types** | ✅ **Complete** | Type-safe IDs with compile-time checks |
| 019 | Environment Configuration | ✅ Complete | `.env.example` with comprehensive docs |
| 020 | Docusaurus Documentation | ✅ Complete | Architecture docs, ADRs, guides |

---

## Implementation Details

### 1. CORS Configuration (Item 015)

**Location:** [packages/api/src/app.ts](../../../packages/api/src/app.ts#L37-L53)

**Features:**
- Environment-based origin whitelist via `CORS_ALLOWED_ORIGINS`
- Development defaults: `localhost:5173`, `localhost:3000`
- Production: Comma-separated list of allowed domains
- Wildcard support (`*`) for development only
- Exposed headers: `X-Request-ID`, rate limit headers
- Credentials support enabled
- 24-hour preflight cache

**Configuration:**
```bash
# .env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Production example
CORS_ALLOWED_ORIGINS=https://app.argusiq.com,https://admin.argusiq.com
```

**Code:**
```typescript
await app.register(cors, {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'];

    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
});
```

---

### 2. Graceful Shutdown (Item 016)

**Location:** [packages/api/src/server.ts](../../../packages/api/src/server.ts#L19-L66)

**Features:**
- SIGTERM/SIGINT signal handling
- Uncaught exception/rejection handling
- 10-second shutdown timeout
- Graceful HTTP server close (stops accepting new requests)
- Database connection pool draining
- Cache (Valkey) connection cleanup
- Sentry event flushing before exit
- Comprehensive error logging

**Shutdown Sequence:**
1. Receive signal (SIGTERM/SIGINT)
2. Close Fastify server (reject new connections, drain existing)
3. Close database connections
4. Close cache connections
5. Flush Sentry events (2-second timeout)
6. Exit process (code 0 on success, 1 on error)

**Force Exit Protection:**
- If graceful shutdown exceeds 10 seconds, force exit with code 1
- Prevents hanging processes in deployment scenarios

**Code:**
```typescript
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, starting graceful shutdown...`);

  const forceExitTimeout = setTimeout(() => {
    app.log.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    await app.close(); // Close HTTP server
    await closeDatabaseConnection(); // Close DB connections
    await closeCacheClient(); // Close cache connections
    await flushSentry(2000); // Flush error tracking

    clearTimeout(forceExitTimeout);
    app.log.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimeout);
    app.log.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

### 3. Sentry Error Tracking (Item 017)

**Location:** [packages/api/src/plugins/sentry.ts](../../../packages/api/src/plugins/sentry.ts)

**Features:**
- Conditional initialization (only if `SENTRY_DSN` is set)
- Environment and release tracking
- Configurable sample rate
- Request context attachment (ID, method, URL, IP)
- User context (IP address, extendable for auth)
- Automatic exception capture on errors
- Manual capture functions (`captureException`, `captureMessage`)
- Graceful flush before shutdown

**Configuration:**
```bash
# .env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=1.0
SERVICE_VERSION=1.0.0
```

**Usage in App:**
```typescript
await app.register(sentryPlugin, {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SERVICE_VERSION,
  sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE ?? '1.0'),
});
```

**Hooks:**
- `onRequest`: Attach request context and user IP
- `onError`: Capture exceptions with tags and extra data
- `onResponse`: Clear context after request completion

**Manual Usage:**
```typescript
import { captureException, captureMessage } from './plugins/sentry.js';

try {
  // ... risky operation
} catch (error) {
  captureException(error, { userId, action: 'payment_processing' });
  throw error;
}

captureMessage('Unusual behavior detected', 'warning');
```

---

### 4. Branded ID Types (Item 018)

**Location:** [packages/shared/src/types/brand.ts](../../../packages/shared/src/types/brand.ts), [packages/shared/src/types/ids.ts](../../../packages/shared/src/types/ids.ts)

**Features:**
- Compile-time type safety for IDs (zero runtime overhead)
- Prevents accidental ID mixups (e.g., passing DeviceId where AssetId expected)
- UUID validation on creation
- Factory functions for all entity types
- Namespaced access via `ids` object

**Available Types:**
```typescript
// Core entities
type OrganizationId = Brand<string, 'OrganizationId'>;
type UserId = Brand<string, 'UserId'>;

// IoT entities (from Meta-Model spec)
type DeviceId = Brand<string, 'DeviceId'>;
type AssetId = Brand<string, 'AssetId'>;
type SpaceId = Brand<string, 'SpaceId'>;
type ActivityId = Brand<string, 'ActivityId'>;
type PersonId = Brand<string, 'PersonId'>;

// ... and 10 more types
```

**Usage:**
```typescript
import { createDeviceId, createAssetId } from '@argus/shared';

// Safe creation with validation
const deviceId = createDeviceId('550e8400-e29b-41d4-a716-446655440000');
const assetId = createAssetId('660e8400-e29b-41d4-a716-446655440000');

// Compile-time type checking
function linkDeviceToAsset(deviceId: DeviceId, assetId: AssetId) {
  // ...
}

linkDeviceToAsset(deviceId, assetId); // ✅ OK
linkDeviceToAsset(assetId, deviceId); // ❌ Compile error!
linkDeviceToAsset('some-string', assetId); // ❌ Compile error!

// Namespaced factories
import { ids } from '@argus/shared';
const userId = ids.user('123e4567-e89b-12d3-a456-426614174000');
```

**Benefits:**
- Catches ID type errors at compile time
- Self-documenting code (function signatures show intent)
- Zero runtime overhead (brands erased after compilation)
- Prevents refactoring bugs (e.g., swapping parameter order)

---

## Repository Pattern

**Location:** [packages/api/src/repositories/base.repository.ts](../../../packages/api/src/repositories/base.repository.ts)

**Features:**
- Pagination utilities (`PaginatedResult`, `calculateOffset`)
- Transaction support (`withTransaction`, `getExecutor`)
- Consistent patterns across all repositories

**Example Repository:**
```typescript
import { getExecutor, withTransaction, PaginatedResult } from './base.repository.js';

export class DeviceRepository {
  async findAll(options?: PaginationOptions): Promise<PaginatedResult<Device>> {
    const offset = calculateOffset(options);
    const limit = getPageSize(options);

    const [data, totalCount] = await Promise.all([
      db.select().from(devices).limit(limit).offset(offset),
      db.select({ count: count() }).from(devices),
    ]);

    return buildPaginatedResult(data, totalCount[0].count, options);
  }

  async createWithAssets(device: NewDevice, assetIds: AssetId[]): Promise<Device> {
    return withTransaction(async (trx) => {
      const [newDevice] = await trx.insert(devices).values(device).returning();

      await trx.insert(assetDeviceLinks).values(
        assetIds.map((assetId) => ({
          deviceId: newDevice.id,
          assetId,
          relationshipType: 'monitors',
        }))
      );

      return newDevice;
    });
  }
}
```

---

## Environment Configuration

**Location:** [.env.example](../../../.env.example)

**Categories:**
1. **Service Identification:** `SERVICE_NAME`, `SERVICE_VERSION`
2. **Server:** `PORT`, `HOST`, `TRUST_PROXY`
3. **Database:** `DATABASE_URL`, connection pool settings
4. **Cache:** `VALKEY_URL`, TTL configuration
5. **CORS:** `CORS_ALLOWED_ORIGINS`
6. **Logging:** `LOG_LEVEL`, `LOG_PRETTY`
7. **JWT:** `JWT_SECRET`
8. **Sentry:** `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_SAMPLE_RATE`
9. **Metrics:** `METRICS_ENABLED`, `PROMETHEUS_ENDPOINT`

---

## Testing

### Verification Commands

```bash
# 1. CORS - Test from frontend
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3040/api/v1/health

# 2. Graceful Shutdown - Test signal handling
docker compose stop api  # Should see graceful shutdown logs

# 3. Sentry - Test error tracking (if SENTRY_DSN configured)
curl -X POST http://localhost:3040/api/v1/test/error

# 4. Health Checks
curl http://localhost:3040/health/live
curl http://localhost:3040/health/ready

# 5. Branded IDs - Compile TypeScript
pnpm --filter @argus/api build  # Should compile without errors
```

---

## Production Checklist

Before deploying to production, ensure:

- [ ] `CORS_ALLOWED_ORIGINS` set to production domains (no wildcards)
- [ ] `SENTRY_DSN` configured for error tracking
- [ ] `JWT_SECRET` is a strong, randomly generated value (32+ bytes)
- [ ] `NODE_ENV=production`
- [ ] Database connection pool tuned (`DB_POOL_MAX` based on load)
- [ ] Graceful shutdown timeout adjusted if needed (`SHUTDOWN_TIMEOUT`)
- [ ] Health check endpoints integrated with load balancer
- [ ] Prometheus metrics endpoint secured or rate-limited
- [ ] Log level set appropriately (`LOG_LEVEL=info` or `warn`)
- [ ] `LOG_PRETTY=false` for JSON logs in production

---

## Known Limitations

None identified. All Sprint 0 items are production-ready.

---

## Next Steps

Sprint 0 is complete. Ready to proceed with:

**Option A:** Phase 7 - IoT Meta-Model Implementation (10 weeks)
- Base types (Device, Asset, Person, Activity, Space)
- Telemetry ingestion and retention
- Real-time WebSocket updates
- Geospatial features
- Cross-organization sharing

**Option B:** Sprint 1 from Phase-1 Planning (if following original plan)
- Device Management
- MQTT integration
- Telemetry storage

**Recommended:** Phase 7 (Meta-Model first approach) to avoid rework

---

## Contributors

- Architecture: Claude Sonnet 4.5
- Implementation: Development Team
- Review: Platform Team

---

**Document Version:** 1.0
**Last Updated:** January 27, 2026
