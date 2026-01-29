/**
 * IoT Bridge Service
 *
 * Bridges MQTT messages from EMQX to NATS JetStream.
 * Supports both direct device messages and ChirpStack uplink messages.
 */

import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { MqttClient, type MqttMessage } from './mqtt-client.js';
import { NatsClient, type NatsMessage } from './nats-client.js';
import { validateMessage, extractDeviceIdFromTopic } from './validator.js';
import { DeviceMappingService } from './services/device-mapping.js';
import {
  transformChirpStackUplink,
  isChirpStackTopic,
  type ChirpStackUplink,
} from './adapters/chirpstack-adapter.js';

export class BridgeService {
  private mqttClient: MqttClient;
  private natsClient: NatsClient;
  private deviceMappingService: DeviceMappingService;
  private messageQueue: NatsMessage[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Metrics
  private metrics = {
    messagesReceived: 0,
    messagesPublished: 0,
    messagesFailed: 0,
    messagesInvalid: 0,
    messagesTooLarge: 0,
    messagesChirpStack: 0,
    messagesDirect: 0,
    chirpStackUnmapped: 0,
    bytesReceived: 0,
    bytesPublished: 0,
  };

  constructor(
    private config: Config,
    private logger: Logger,
    deviceMappingService?: DeviceMappingService
  ) {
    this.mqttClient = new MqttClient(config, logger);
    this.natsClient = new NatsClient(config, logger);
    this.deviceMappingService = deviceMappingService || new DeviceMappingService({}, logger);
  }

  /**
   * Start the bridge service
   */
  async start(): Promise<void> {
    this.logger.info('Starting IoT Bridge Service');

    // Device mapping service should already be initialized by the caller
    const mappingStats = this.deviceMappingService.getStats();
    this.logger.info(
      { mappingCount: mappingStats.size, lastRefresh: mappingStats.lastRefresh },
      'Using device mapping service'
    );

    // Connect to NATS first (required for message publishing)
    await this.natsClient.connect();

    // Connect to MQTT
    await this.mqttClient.connect();

    // Subscribe to MQTT topics
    await this.mqttClient.subscribe(this.config.mqtt.topics);

    // Set up message handler
    this.mqttClient.onMessage(async (message) => {
      await this.handleMqttMessage(message);
    });

    // Start periodic flush timer
    this.startFlushTimer();

    // Start metrics logging
    this.startMetricsLogging();

    this.logger.info('IoT Bridge Service started successfully');
  }

  /**
   * Handle incoming MQTT message
   * Routes to appropriate handler based on topic pattern
   */
  private async handleMqttMessage(message: MqttMessage): Promise<void> {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += message.payload.length;

    // Route based on topic pattern
    if (isChirpStackTopic(message.topic)) {
      await this.handleChirpStackMessage(message);
    } else if (message.topic.startsWith('devices/')) {
      await this.handleDirectDeviceMessage(message);
    } else {
      this.logger.warn({ topic: message.topic }, 'Unknown topic pattern, ignoring message');
      this.metrics.messagesInvalid++;
    }
  }

  /**
   * Handle ChirpStack uplink message
   */
  private async handleChirpStackMessage(message: MqttMessage): Promise<void> {
    this.metrics.messagesChirpStack++;

    // Parse ChirpStack uplink payload
    let uplink: ChirpStackUplink;
    try {
      uplink = JSON.parse(message.payload.toString('utf-8')) as ChirpStackUplink;
    } catch (error) {
      this.logger.warn(
        { topic: message.topic, error: error instanceof Error ? error.message : String(error) },
        'Failed to parse ChirpStack uplink payload as JSON'
      );
      this.metrics.messagesInvalid++;
      return;
    }

    // Transform to canonical format
    const mappingCache = this.deviceMappingService.getMappingCache();
    const canonical = transformChirpStackUplink(uplink, mappingCache, this.logger);

    if (!canonical) {
      // Device mapping not found (DevEUI not provisioned in ArgusIQ)
      this.metrics.chirpStackUnmapped++;
      return;
    }

    // Create NATS message with canonical format
    const natsMessage: NatsMessage = {
      subject: `${this.config.nats.subjectPrefix}.raw.${canonical.deviceId}`,
      data: new TextEncoder().encode(JSON.stringify(canonical)),
      headers: {
        'mqtt-topic': message.topic,
        'mqtt-qos': message.qos.toString(),
        'device-id': canonical.deviceId,
        'source': 'chirpstack',
        'dev-eui': canonical.metadata.devEui || '',
        'f-port': canonical.metadata.fPort?.toString() || '',
        'received-at': new Date().toISOString(),
      },
    };

    // Check message size
    if (natsMessage.data.length > this.config.processing.maxMessageSize) {
      this.logger.warn(
        {
          deviceId: canonical.deviceId,
          devEui: canonical.metadata.devEui,
          size: natsMessage.data.length,
          maxSize: this.config.processing.maxMessageSize,
        },
        'ChirpStack message exceeds maximum size, dropping'
      );
      this.metrics.messagesTooLarge++;
      return;
    }

    // Add to queue for batch processing
    this.messageQueue.push(natsMessage);
    this.metrics.bytesPublished += natsMessage.data.length;

    // Flush if batch size reached
    if (this.messageQueue.length >= this.config.processing.batchSize) {
      await this.flushQueue();
    }
  }

  /**
   * Handle direct device message (cellular devices, BLE gateways, etc.)
   */
  private async handleDirectDeviceMessage(message: MqttMessage): Promise<void> {
    this.metrics.messagesDirect++;

    // Extract device ID from topic (devices/{uuid}/telemetry)
    const deviceId = extractDeviceIdFromTopic(message.topic);
    if (!deviceId) {
      this.logger.warn({ topic: message.topic }, 'Could not extract device ID from topic');
      this.metrics.messagesInvalid++;
      return;
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(message.payload.toString('utf-8'));
    } catch (error) {
      this.logger.warn(
        { topic: message.topic, error: error instanceof Error ? error.message : String(error) },
        'Failed to parse MQTT payload as JSON'
      );
      this.metrics.messagesInvalid++;
      return;
    }

    // Validate message (if enabled)
    if (this.config.processing.validateMessages) {
      const validated = validateMessage(payload, this.logger);
      if (!validated) {
        this.metrics.messagesInvalid++;
        return;
      }
    }

    // Enrich message with device ID if not present
    if (typeof payload === 'object' && payload !== null && !('deviceId' in payload)) {
      (payload as Record<string, unknown>).deviceId = deviceId;
    }

    // Create NATS message
    const natsMessage: NatsMessage = {
      subject: `${this.config.nats.subjectPrefix}.raw.${deviceId}`,
      data: new TextEncoder().encode(JSON.stringify(payload)),
      headers: {
        'mqtt-topic': message.topic,
        'mqtt-qos': message.qos.toString(),
        'device-id': deviceId,
        'source': 'direct',
        'received-at': new Date().toISOString(),
      },
    };

    // Check message size
    if (natsMessage.data.length > this.config.processing.maxMessageSize) {
      this.logger.warn(
        {
          deviceId,
          size: natsMessage.data.length,
          maxSize: this.config.processing.maxMessageSize,
        },
        'Message exceeds maximum size, dropping'
      );
      this.metrics.messagesTooLarge++;
      return;
    }

    // Add to queue for batch processing
    this.messageQueue.push(natsMessage);
    this.metrics.bytesPublished += natsMessage.data.length;

    // Flush if batch size reached
    if (this.messageQueue.length >= this.config.processing.batchSize) {
      await this.flushQueue();
    }
  }

  /**
   * Flush message queue to NATS
   */
  private async flushQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }

    const batch = this.messageQueue.splice(0, this.messageQueue.length);

    try {
      await this.natsClient.publishBatch(batch);
      this.metrics.messagesPublished += batch.length;

      this.logger.debug(
        { count: batch.length },
        'Flushed message batch to NATS'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          count: batch.length,
        },
        'Failed to flush message batch'
      );
      this.metrics.messagesFailed += batch.length;
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.messageQueue.length > 0) {
        await this.flushQueue();
      }
    }, this.config.processing.batchTimeout);
  }

  /**
   * Start metrics logging
   */
  private startMetricsLogging(): void {
    setInterval(() => {
      this.logger.info(
        {
          ...this.metrics,
          queueSize: this.messageQueue.length,
          mqttConnected: this.mqttClient.isConnected(),
          natsConnected: this.natsClient.isConnected(),
        },
        'Bridge metrics'
      );
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop the bridge service
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Stopping IoT Bridge Service');

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining messages
    await this.flushQueue();

    // Close device mapping service
    await this.deviceMappingService.close();

    // Disconnect clients
    await this.mqttClient.disconnect();
    await this.natsClient.disconnect();

    // Log final metrics
    this.logger.info({ metrics: this.metrics }, 'Final bridge metrics');
    this.logger.info('IoT Bridge Service stopped');
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.messageQueue.length,
      mqttConnected: this.mqttClient.isConnected(),
      natsConnected: this.natsClient.isConnected(),
    };
  }
}
