// Test MQTT publisher
import mqtt from 'mqtt';

const deviceId = '550e8400-e29b-41d4-a716-446655440000';
const topic = `devices/${deviceId}/telemetry`;
const payload = {
  temp: 22.5,
  humidity: 65.2,
  timestamp: new Date().toISOString()
};

console.log(`Connecting to MQTT broker...`);
const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test-publisher',
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  console.log(`Publishing to topic: ${topic}`);
  console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('Publish error:', err);
    } else {
      console.log('Message published successfully!');
    }
    client.end();
  });
});

client.on('error', (err) => {
  console.error('MQTT error:', err);
  process.exit(1);
});
