/**
 * MQTT Client Wrapper
 *
 * Manages connection to EMQX MQTT broker and message subscription.
 */

import mqtt from 'mqtt';
import type { Config } from './config.js';
import type { Logger } from './logger.js';

export interface MqttMessage {
  topic: string;
  payload: Buffer;
  qos: 0 | 1 | 2;
  retain: boolean;
}

export type MessageHandler = (message: MqttMessage) => Promise<void>;

export class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private messageHandler: MessageHandler | null = null;

  constructor(
    private config: Config,
    private logger: Logger
  ) {}

  /**
   * Connect to MQTT broker
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(
        { brokerUrl: this.config.mqtt.brokerUrl },
        'Connecting to MQTT broker'
      );

      this.client = mqtt.connect(this.config.mqtt.brokerUrl, {
        clientId: this.config.mqtt.clientId,
        username: this.config.mqtt.username,
        password: this.config.mqtt.password,
        keepalive: this.config.mqtt.keepalive,
        reconnectPeriod: this.config.mqtt.reconnectPeriod,
        connectTimeout: this.config.mqtt.connectTimeout,
        clean: this.config.mqtt.clean,
      });

      this.client.on('connect', () => {
        this.logger.info('Connected to MQTT broker');
        resolve();
      });

      this.client.on('error', (error) => {
        this.logger.error({ error: error.message }, 'MQTT connection error');
        reject(error);
      });

      this.client.on('reconnect', () => {
        this.logger.info('Reconnecting to MQTT broker');
      });

      this.client.on('close', () => {
        this.logger.warn('MQTT connection closed');
      });

      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline');
      });

      this.client.on('message', async (topic, payload, packet) => {
        if (this.messageHandler) {
          try {
            await this.messageHandler({
              topic,
              payload,
              qos: packet.qos as 0 | 1 | 2,
              retain: packet.retain,
            });
          } catch (error) {
            this.logger.error(
              { error: error instanceof Error ? error.message : String(error), topic },
              'Error handling MQTT message'
            );
          }
        }
      });
    });
  }

  /**
   * Subscribe to topics
   */
  async subscribe(topics: string[]): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topics, { qos: this.config.mqtt.qos }, (error, granted) => {
        if (error) {
          this.logger.error({ error: error.message, topics }, 'Failed to subscribe to topics');
          reject(error);
        } else {
          this.logger.info({ granted }, 'Subscribed to MQTT topics');
          resolve();
        }
      });
    });
  }

  /**
   * Set message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    return new Promise((resolve) => {
      this.logger.info('Disconnecting from MQTT broker');
      this.client!.end(false, {}, () => {
        this.logger.info('Disconnected from MQTT broker');
        resolve();
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
