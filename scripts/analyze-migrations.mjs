#!/usr/bin/env node
/**
 * Migration Analyzer
 *
 * Analyzes SQL migration files for destructive operations that could
 * break running application instances during blue-green deployments.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Patterns that indicate destructive operations
const DESTRUCTIVE_PATTERNS = [
  { pattern: /DROP\s+TABLE/gi, severity: 'critical', name: 'DROP TABLE' },
  { pattern: /DROP\s+COLUMN/gi, severity: 'critical', name: 'DROP COLUMN' },
  { pattern: /ALTER\s+.*\s+TYPE/gi, severity: 'high', name: 'ALTER TYPE' },
  { pattern: /RENAME\s+COLUMN/gi, severity: 'high', name: 'RENAME COLUMN' },
  { pattern: /RENAME\s+TABLE/gi, severity: 'high', name: 'RENAME TABLE' },
  { pattern: /ALTER\s+.*\s+SET\s+NOT\s+NULL/gi, severity: 'medium', name: 'SET NOT NULL' },
  { pattern: /DROP\s+INDEX/gi, severity: 'low', name: 'DROP INDEX' },
  { pattern: /DROP\s+CONSTRAINT/gi, severity: 'medium', name: 'DROP CONSTRAINT' },
  { pattern: /TRUNCATE/gi, severity: 'critical', name: 'TRUNCATE' },
  { pattern: /DELETE\s+FROM\s+\w+\s*;/gi, severity: 'critical', name: 'DELETE ALL' },
];

// Patterns that are safe (for reference)
const SAFE_PATTERNS = [
  /ADD\s+COLUMN.*NULL/gi,              // Nullable column
  /ADD\s+COLUMN.*DEFAULT/gi,           // Column with default
  /CREATE\s+INDEX\s+CONCURRENTLY/gi,   // Non-blocking index
  /CREATE\s+TABLE/gi,                  // New table
];

/**
 * Analyze a migration file for destructive operations
 */
function analyzeMigration(filePath) {
  if (!existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return { file: filePath, issues: [] };
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (const { pattern, severity, name } of DESTRUCTIVE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineNumber - 1]?.trim() || '';

      issues.push({
        pattern: name,
        severity,
        line: lineNumber,
        context: lineContent.substring(0, 100),
      });
    }
  }

  return { file: filePath, issues };
}

/**
 * Validate expand/contract pattern
 */
function validateExpandContract(filePath) {
  if (!existsSync(filePath)) {
    return { valid: true, errors: [], warnings: [] };
  }

  const content = readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  // Check for ALTER TYPE without expand/contract
  if (/ALTER\s+.*\s+TYPE/gi.test(content)) {
    errors.push(
      `ALTER TYPE in ${filePath} is not backward compatible. ` +
      `Instead: add new column with new type, migrate data, then drop old column.`
    );
  }

  // Check for RENAME without redirect
  if (/RENAME\s+COLUMN/gi.test(content)) {
    errors.push(
      `RENAME COLUMN in ${filePath} breaks running code. ` +
      `Instead: add new column, update code to write both, migrate, drop old.`
    );
  }

  // Warn about SET NOT NULL without default
  if (/SET\s+NOT\s+NULL/gi.test(content) && !/DEFAULT/gi.test(content)) {
    warnings.push(
      `SET NOT NULL in ${filePath} may fail if NULLs exist. ` +
      `Ensure data migration runs first, or add DEFAULT.`
    );
  }

  // Warn about index creation without CONCURRENTLY
  if (/CREATE\s+INDEX\s+(?!CONCURRENTLY)/gi.test(content)) {
    warnings.push(
      `CREATE INDEX in ${filePath} without CONCURRENTLY will lock table. ` +
      `Use CREATE INDEX CONCURRENTLY for production safety.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Main execution
const filesArg = process.argv[2] || '';
const files = filesArg.split('\n').filter(f => f.trim() && f.endsWith('.sql'));

const results = [];
let hasDestructive = false;

for (const file of files) {
  const filePath = resolve(process.cwd(), file);
  const result = analyzeMigration(filePath);

  if (result.issues.length > 0) {
    results.push(result);
    hasDestructive = true;
  }

  // Also validate expand/contract
  const ecResult = validateExpandContract(filePath);
  if (!ecResult.valid) {
    console.log('\n❌ EXPAND/CONTRACT ERRORS:\n');
    ecResult.errors.forEach(e => console.log(`  - ${e}\n`));
  }
  if (ecResult.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    ecResult.warnings.forEach(w => console.log(`  - ${w}\n`));
  }
}

// Output for GitHub Actions
const core = {
  setOutput: (name, value) => {
    const fs = await import('fs');
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `${name}=${value}\n`);
    }
  }
};

// Write outputs
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_destructive=${hasDestructive}\n`);
}

if (hasDestructive) {
  console.log('\n🚨 DESTRUCTIVE MIGRATION OPERATIONS DETECTED:\n');

  for (const result of results) {
    console.log(`📄 ${result.file}:`);
    for (const issue of result.issues) {
      const emoji = issue.severity === 'critical' ? '🔴' :
                    issue.severity === 'high' ? '🟠' :
                    issue.severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${emoji} Line ${issue.line}: ${issue.pattern}`);
      console.log(`     ${issue.context}`);
    }
    console.log('');
  }

  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `details=${JSON.stringify(results)}\n`);
  }
} else if (files.length > 0) {
  console.log('✅ No destructive operations detected in migrations');
} else {
  console.log('ℹ️  No SQL migration files to analyze');
}
