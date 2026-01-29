/**
 * Database Migration Runner
 *
 * Applies schema migrations and RLS policies.
 * Usage: pnpm db:migrate:run
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Split SQL content into individual statements, respecting dollar-quoted strings.
 * PostgreSQL uses $$ or $tag$ to quote function bodies which may contain semicolons.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];

    // Check for dollar-quote start ($$ or $tag$)
    if (char === '$') {
      const dollarMatch = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
      if (dollarMatch) {
        const dollarTag = dollarMatch[0]; // e.g., "$$" or "$func$"
        current += dollarTag;
        i += dollarTag.length;

        // Find the matching closing dollar-quote
        const closeIndex = sql.indexOf(dollarTag, i);
        if (closeIndex !== -1) {
          current += sql.slice(i, closeIndex + dollarTag.length);
          i = closeIndex + dollarTag.length;
        } else {
          // No closing tag found, consume rest
          current += sql.slice(i);
          i = sql.length;
        }
        continue;
      }
    }

    // Check for single-line comment
    if (char === '-' && sql[i + 1] === '-') {
      const lineEnd = sql.indexOf('\n', i);
      if (lineEnd !== -1) {
        current += sql.slice(i, lineEnd + 1);
        i = lineEnd + 1;
      } else {
        current += sql.slice(i);
        i = sql.length;
      }
      continue;
    }

    // Check for block comment
    if (char === '/' && sql[i + 1] === '*') {
      const commentEnd = sql.indexOf('*/', i + 2);
      if (commentEnd !== -1) {
        current += sql.slice(i, commentEnd + 2);
        i = commentEnd + 2;
      } else {
        current += sql.slice(i);
        i = sql.length;
      }
      continue;
    }

    // Check for string literal
    if (char === "'") {
      current += char;
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          // Escaped quote
          current += "''";
          i += 2;
        } else if (sql[i] === "'") {
          current += "'";
          i++;
          break;
        } else {
          current += sql[i];
          i++;
        }
      }
      continue;
    }

    // Statement terminator
    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // Don't forget any remaining content
  const trimmed = current.trim();
  if (trimmed.length > 0 && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }

  return statements;
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Starting database migrations...');
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);

  // Create connection for migrations (not pooled)
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Step 1: Run Drizzle schema migrations
    console.log('\n📦 Applying schema migrations...');
    // In dist, __dirname is packages/api/dist/db, so we need to go up and reference src
    const migrationsPath = join(__dirname, '..', '..', 'src', 'db', 'migrations');
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('✅ Schema migrations complete');

    // Step 2: Apply custom SQL migrations (RLS policies, LTREE extension, etc.)
    console.log('\n🔒 Applying custom SQL migrations...');
    const migrationsDir = migrationsPath;

    try {
      // Get all SQL files sorted by name (for order: 0001, 0002, etc.)
      const sqlFiles = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const sqlFile of sqlFiles) {
        console.log(`   📄 Applying ${sqlFile}...`);
        const sqlPath = join(migrationsDir, sqlFile);
        const sqlContent = readFileSync(sqlPath, 'utf-8');

        // Split into individual statements, respecting dollar-quoted strings
        const statements = splitSqlStatements(sqlContent);

        for (const statement of statements) {
          try {
            await migrationClient.unsafe(statement);
          } catch (err) {
            // Ignore "already exists" errors for idempotency
            const message = err instanceof Error ? err.message : String(err);
            if (
              !message.includes('already exists') &&
              !message.includes('duplicate key') &&
              !message.includes('does not exist') // For DROP IF EXISTS
            ) {
              console.warn(`      ⚠️  Warning: ${message.split('\n')[0]}`);
            }
          }
        }
        console.log(`   ✅ ${sqlFile} applied`);
      }
      console.log('✅ Custom SQL migrations complete');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('   ℹ️  No migration files found, skipping');
      } else {
        throw err;
      }
    }

    // Step 3: Verify tables
    console.log('\n📊 Verifying database state...');
    const tables = await migrationClient`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log(`   Found ${tables.length} tables`);

    const policies = await migrationClient`
      SELECT COUNT(*) as count FROM pg_policies
    `;
    console.log(`   Found ${policies[0].count} RLS policies`);

    console.log('\n✅ All migrations complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
