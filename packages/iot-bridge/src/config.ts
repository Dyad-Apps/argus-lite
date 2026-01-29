/**
 * IoT Bridge Configuration
 *
 * Loads and validates configuration from environment variables.
 */

import { z } from 'zod';

const configSchema = z.object({
  // Service
  serviceName: z.string().default('iot-bridge'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // MQTT Configuration
  mqtt: z.object({
    brokerUrl: z.string().url().default('mqtt://localhost:1883'),
    clientId: z.string().default('argus-iot-bridge'),
    username: z.string().optional(),
    password: z.string().optional(),
    // Topics to subscribe to (supports wildcards)
    topics: z.array(z.string()).default(['devices/+/telemetry']),
    qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
    // Connection options
    keepalive: z.number().default(60),
    reconnectPeriod: z.number().default(5000),
    connectTimeout: z.number().default(30000),
    clean: z.boolean().default(true),
  }),

  // NATS Configuration
  nats: z.object({
    servers: z.array(z.string()).default(['nats://localhost:4222']),
    // JetStream stream name
    streamName: z.string().default('TELEMETRY'),
    // Subject prefix for publishing
    subjectPrefix: z.string().default('telemetry'),
    // Connection options
    maxReconnectAttempts: z.number().default(-1), // -1 = infinite
    reconnectTimeWait: z.number().default(2000),
    timeout: z.number().default(20000),
  }),

  // Processing Options
  processing: z.object({
    // Maximum message size (bytes)
    maxMessageSize: z.number().default(8 * 1024 * 1024), // 8MB
    // Batch size for publishing to NATS
    batchSize: z.number().default(100),
    // Batch timeout (ms)
    batchTimeout: z.number().default(1000),
    // Enable message validation
    validateMessages: z.boolean().default(true),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    pretty: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  // In development, add random suffix to client ID to avoid conflicts
  const clientId = process.env.MQTT_CLIENT_ID || 'argus-iot-bridge';
  const finalClientId = process.env.NODE_ENV === 'development'
    ? `${clientId}-${Math.random().toString(36).substring(7)}`
    : clientId;

  const config = configSchema.parse({
    serviceName: process.env.SERVICE_NAME,
    nodeEnv: process.env.NODE_ENV,

    mqtt: {
      brokerUrl: process.env.MQTT_BROKER_URL,
      clientId: finalClientId,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      topics: process.env.MQTT_TOPICS?.split(','),
      qos: process.env.MQTT_QOS ? parseInt(process.env.MQTT_QOS) : undefined,
    },

    nats: {
      servers: process.env.NATS_SERVERS?.split(','),
      streamName: process.env.NATS_STREAM_NAME,
      subjectPrefix: process.env.NATS_SUBJECT_PREFIX,
    },

    processing: {
      maxMessageSize: process.env.MAX_MESSAGE_SIZE ? parseInt(process.env.MAX_MESSAGE_SIZE) : undefined,
      batchSize: process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : undefined,
      batchTimeout: process.env.BATCH_TIMEOUT ? parseInt(process.env.BATCH_TIMEOUT) : undefined,
      validateMessages: process.env.VALIDATE_MESSAGES === 'true',
    },

    logging: {
      level: process.env.LOG_LEVEL,
      pretty: process.env.LOG_PRETTY === 'true',
    },
  });

  return config;
}
