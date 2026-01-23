import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import type { FastifyInstance } from 'fastify';

describe('Health Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.version).toBe('string');
  });

  it('includes request ID in response headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.headers['x-request-id']).toBeDefined();
    // Verify it's a UUID format
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('includes security headers from helmet', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
