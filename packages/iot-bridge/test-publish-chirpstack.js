/**
 * Test ChirpStack Uplink Publisher
 *
 * Simulates ChirpStack MQTT integration by publishing uplink messages
 * to the chirpstack/{applicationId}/devices/{devEui}/up topic.
 *
 * Usage:
 *   node test-publish-chirpstack.js
 */

import mqtt from 'mqtt';

// Example ChirpStack uplink message (v4 format)
const chirpstackUplink = {
  deviceInfo: {
    tenantId: '52f14cd4-c6f1-4fbd-8f87-4025e1d49242',
    tenantName: 'Viaanix',
    applicationId: 'indoor-tracking-app',
    applicationName: 'Indoor Tracking',
    deviceProfileId: 'location-hub-profile',
    deviceProfileName: 'Location Hub Profile',
    deviceName: 'Location Hub 001',
    devEui: '0004a30b00ebd19f', // 16 hex chars - Device EUI
  },
  devAddr: '01020304',
  adr: true,
  dr: 5, // Data rate
  fCnt: 42, // Frame counter
  fPort: 10, // LoRaWAN port
  confirmed: false,
  data: 'eyJsYXQiOjQzLjY1MzIsImxvbiI6LTc5LjM4MzIsImFsdCI6MTIzfQ==', // Base64: {"lat":43.6532,"lon":-79.3832,"alt":123}

  // Decoded payload (via ChirpStack codec)
  object: {
    lat: 43.6532,
    lon: -79.3832,
    alt: 123,
    beacons: [
      { id: 'beacon-001', rssi: -65 },
      { id: 'beacon-002', rssi: -72 },
      { id: 'beacon-003', rssi: -68 },
    ],
  },

  // Reception info from gateways
  rxInfo: [
    {
      gatewayId: 'gateway-warehouse-1',
      uplinkId: 'f3e2d1c0-b1a2-3c4d-5e6f-7g8h9i0j1k2l',
      time: new Date().toISOString(),
      rssi: -85,
      snr: 7.5,
      channel: 0,
      rfChain: 0,
      board: 0,
      antenna: 0,
      location: {
        latitude: 43.6532,
        longitude: -79.3832,
        altitude: 100,
        source: 'MANUAL',
      },
      context: 'bG9yYWNvbnRleHQ=', // Base64 encoded
      metadata: {
        region_config_id: 'us915',
        region_common_name: 'US915',
      },
      crcStatus: 'CRC_OK',
    },
    {
      gatewayId: 'gateway-warehouse-2',
      uplinkId: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
      time: new Date().toISOString(),
      rssi: -92,
      snr: 4.2,
      channel: 1,
      rfChain: 1,
      board: 0,
      antenna: 0,
      crcStatus: 'CRC_OK',
    },
  ],

  // Transmission info
  txInfo: {
    frequency: 915200000, // Hz
    modulation: {
      lora: {
        bandwidth: 125000,
        spreadingFactor: 7,
        codeRate: 'CR_4_5',
      },
    },
  },

  time: new Date().toISOString(),
};

// ChirpStack MQTT topic format: chirpstack/{applicationId}/devices/{devEui}/up
const applicationId = chirpstackUplink.deviceInfo.applicationId;
const devEui = chirpstackUplink.deviceInfo.devEui;
const topic = `chirpstack/${applicationId}/devices/${devEui}/up`;

console.log('========================================');
console.log('ChirpStack Uplink Test Publisher');
console.log('========================================\n');
console.log('Connecting to MQTT broker...');

const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test-chirpstack-publisher',
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');
  console.log('Publishing ChirpStack uplink message:');
  console.log(`  Topic: ${topic}`);
  console.log(`  DevEUI: ${devEui}`);
  console.log(`  Device Name: ${chirpstackUplink.deviceInfo.deviceName}`);
  console.log(`  Application: ${chirpstackUplink.deviceInfo.applicationName}`);
  console.log(`  Frame Counter: ${chirpstackUplink.fCnt}`);
  console.log(`  fPort: ${chirpstackUplink.fPort}`);
  console.log(`  Data Rate: DR${chirpstackUplink.dr}`);
  console.log(`  RSSI: ${chirpstackUplink.rxInfo[0].rssi} dBm`);
  console.log(`  SNR: ${chirpstackUplink.rxInfo[0].snr} dB`);
  console.log(`  Gateways: ${chirpstackUplink.rxInfo.length}`);
  console.log(`  Decoded Payload:`, JSON.stringify(chirpstackUplink.object, null, 2));
  console.log();

  const payload = JSON.stringify(chirpstackUplink);

  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Publish error:', err);
      process.exit(1);
    } else {
      console.log('✅ ChirpStack uplink message published successfully!\n');
      console.log('Expected behavior:');
      console.log('  1. IoT Bridge receives message on chirpstack/+/devices/+/up');
      console.log('  2. ChirpStack adapter transforms to canonical format');
      console.log('  3. DevEUI is mapped to Device UUID (if provisioned)');
      console.log('  4. Canonical message published to NATS telemetry.raw.{deviceId}');
      console.log('  5. Check NATS stream for the message\n');
      console.log('To verify:');
      console.log('  node test-nats-pull.js\n');
      console.log('Note: If DevEUI is not provisioned in ArgusIQ, the message will be');
      console.log('      logged as "Device mapping not found" and dropped.\n');

      client.end();
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT connection error:', err);
  process.exit(1);
});
