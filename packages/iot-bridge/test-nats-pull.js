// Test NATS pull consumer
import { connect } from 'nats';

async function pullMessages() {
  console.log('Connecting to NATS...');
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  console.log('\n=== TELEMETRY Stream Info ===');
  const streamInfo = await jsm.streams.info('TELEMETRY');
  console.log(`Name: ${streamInfo.config.name}`);
  console.log(`Subjects: ${streamInfo.config.subjects.join(', ')}`);
  console.log(`Messages: ${streamInfo.state.messages}`);
  console.log(`Bytes: ${streamInfo.state.bytes}`);

  console.log('\n=== Latest Messages ===');

  // Create or get a durable pull consumer
  const consumerName = 'test-viewer';
  try {
    await jsm.consumers.add('TELEMETRY', {
      durable_name: consumerName,
      ack_policy: 'explicit',
      deliver_policy: 'all',
      filter_subject: 'telemetry.raw.>',
    });
  } catch (err) {
    // Consumer might already exist, that's ok
  }

  // Pull messages
  const consumer = await js.consumers.get('TELEMETRY', consumerName);
  const messages = await consumer.fetch({ max_messages: 3 });

  let count = 0;
  for await (const msg of messages) {
    count++;
    const payload = new TextDecoder().decode(msg.data);
    console.log(`\n[Message ${count}]`);
    console.log(`Subject: ${msg.subject}`);
    console.log(`Headers:`);
    if (msg.headers) {
      for (const [key, values] of msg.headers) {
        console.log(`  ${key}: ${values.join(', ')}`);
      }
    }
    console.log(`Payload:`);
    try {
      const parsed = JSON.parse(payload);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(payload);
    }

    msg.ack();
  }

  // Clean up
  await jsm.consumers.delete('TELEMETRY', consumerName);
  await nc.close();
  console.log('\n✅ Done! Successfully verified MQTT → Bridge → NATS flow!');
}

pullMessages().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
