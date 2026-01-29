// Test NATS consumer
import { connect, AckPolicy, DeliverPolicy } from 'nats';

async function consumeMessages() {
  console.log('Connecting to NATS...');
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const jsm = await nc.jetstreamManager();

  console.log('\n=== TELEMETRY Stream Info ===');
  const streamInfo = await jsm.streams.info('TELEMETRY');
  console.log(`Name: ${streamInfo.config.name}`);
  console.log(`Subjects: ${streamInfo.config.subjects.join(', ')}`);
  console.log(`Messages: ${streamInfo.state.messages}`);
  console.log(`Bytes: ${streamInfo.state.bytes}`);
  console.log(`First Seq: ${streamInfo.state.first_seq}`);
  console.log(`Last Seq: ${streamInfo.state.last_seq}`);

  console.log('\n=== Consuming Latest Messages ===');
  const js = nc.jetstream();

  // Create a temporary consumer to read the last messages
  const consumer = await js.consumers.get('TELEMETRY', 'test-consumer').catch(async () => {
    return await jsm.consumers.add('TELEMETRY', {
      durable_name: 'test-consumer',
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
    });
  });

  // Fetch last 3 messages
  const messages = await consumer.consume({ max_messages: 3 });
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
    console.log(`Payload: ${payload}`);
    msg.ack();

    if (count >= 3) {
      break;
    }
  }

  // Clean up consumer
  await jsm.consumers.delete('TELEMETRY', 'test-consumer');
  await nc.close();
  console.log('\n✅ Done!');
}

consumeMessages().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
