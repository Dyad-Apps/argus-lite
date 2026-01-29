/**
 * NATS JetStream Client Wrapper
 *
 * Manages connection to NATS and publishes messages to JetStream streams.
 */

import { connect, NatsConnection, JetStreamClient, JetStreamManager, StreamConfig, headers as createHeaders } from 'nats';
import type { Config } from './config.js';
import type { Logger } from './logger.js';

export interface NatsMessage {
  subject: string;
  data: Uint8Array;
  headers?: Record<string, string>;
}

export class NatsClient {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  constructor(
    private config: Config,
    private logger: Logger
  ) {}

  /**
   * Connect to NATS server
   */
  async connect(): Promise<void> {
    this.logger.info(
      { servers: this.config.nats.servers },
      'Connecting to NATS server'
    );

    this.nc = await connect({
      servers: this.config.nats.servers,
      maxReconnectAttempts: this.config.nats.maxReconnectAttempts,
      reconnectTimeWait: this.config.nats.reconnectTimeWait,
      timeout: this.config.nats.timeout,
    });

    this.logger.info('Connected to NATS server');

    // Get JetStream context
    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();

    // Set up event handlers
    (async () => {
      for await (const status of this.nc!.status()) {
        this.logger.info({ type: status.type, data: status.data }, 'NATS status update');
      }
    })();

    // Ensure stream exists
    await this.ensureStream();
  }

  /**
   * Ensure JetStream stream exists
   */
  private async ensureStream(): Promise<void> {
    if (!this.jsm) {
      throw new Error('JetStream manager not initialized');
    }

    const streamName = this.config.nats.streamName;
    const subjectPrefix = this.config.nats.subjectPrefix;

    try {
      // Try to get stream info
      await this.jsm.streams.info(streamName);
      this.logger.info({ streamName }, 'JetStream stream exists');
    } catch (error) {
      // Stream doesn't exist, create it
      this.logger.info({ streamName }, 'Creating JetStream stream');

      const streamConfig: Partial<StreamConfig> = {
        name: streamName,
        subjects: [`${subjectPrefix}.>`], // Match all subjects under prefix
        max_msgs: 1_000_000, // Keep up to 1M messages
        max_bytes: 10 * 1024 * 1024 * 1024, // 10GB
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days (nanoseconds)
        max_msg_size: this.config.processing.maxMessageSize,
        duplicate_window: 2 * 60 * 1_000_000_000, // 2 minutes (nanoseconds)
      };

      await this.jsm.streams.add(streamConfig);
      this.logger.info({ streamName, config: streamConfig }, 'JetStream stream created');
    }
  }

  /**
   * Publish message to JetStream
   */
  async publish(message: NatsMessage): Promise<void> {
    if (!this.js) {
      throw new Error('JetStream client not initialized');
    }

    try {
      // Create headers if provided
      const hdrs = message.headers ? createHeaders() : undefined;
      if (hdrs && message.headers) {
        for (const [key, value] of Object.entries(message.headers)) {
          hdrs.append(key, value);
        }
      }

      const ack = await this.js.publish(message.subject, message.data, {
        headers: hdrs,
      });

      this.logger.debug(
        {
          subject: message.subject,
          stream: ack.stream,
          seq: ack.seq,
        },
        'Published message to NATS'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          subject: message.subject,
        },
        'Failed to publish message to NATS'
      );
      throw error;
    }
  }

  /**
   * Publish batch of messages
   */
  async publishBatch(messages: NatsMessage[]): Promise<void> {
    if (!this.js) {
      throw new Error('JetStream client not initialized');
    }

    this.logger.debug({ count: messages.length }, 'Publishing batch to NATS');

    const results = await Promise.allSettled(
      messages.map((msg) => this.publish(msg))
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(
        { failed: failed.length, total: messages.length },
        'Some messages failed to publish'
      );
    }
  }

  /**
   * Disconnect from NATS
   */
  async disconnect(): Promise<void> {
    if (!this.nc) {
      return;
    }

    this.logger.info('Disconnecting from NATS server');
    await this.nc.drain();
    await this.nc.close();
    this.logger.info('Disconnected from NATS server');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.nc?.isClosed() === false;
  }
}
