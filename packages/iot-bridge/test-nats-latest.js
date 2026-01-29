// View the latest message in NATS stream (should be the ChirpStack message)
import { connect } from 'nats';

async function viewLatestMessage() {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  const streamInfo = await jsm.streams.info('TELEMETRY');
  console.log(`\n=== TELEMETRY Stream Info ===`);
  console.log(`Total messages: ${streamInfo.state.messages}`);
  console.log(`Latest sequence: ${streamInfo.state.last_seq}`);
  console.log(`\nFetching latest message (seq ${streamInfo.state.last_seq})...\n`);

  // Create consumer starting from the last message
  const consumerName = 'test-latest-viewer';
  try {
    await jsm.consumers.delete('TELEMETRY', consumerName);
  } catch {}

  await jsm.consumers.add('TELEMETRY', {
    durable_name: consumerName,
    ack_policy: 'explicit',
    deliver_policy: 'by_start_sequence',
    opt_start_seq: streamInfo.state.last_seq,
    filter_subject: 'telemetry.raw.>',
  });

  const consumer = await js.consumers.get('TELEMETRY', consumerName);
  const messages = await consumer.fetch({ max_messages: 1, expires: 2000 });

  for await (const msg of messages) {
    const payload = new TextDecoder().decode(msg.data);
    console.log(`=== Latest Message (Seq ${streamInfo.state.last_seq}) ===\n`);
    console.log(`Subject: ${msg.subject}`);
    console.log(`\nHeaders:`);
    if (msg.headers) {
      for (const [key, values] of msg.headers) {
        console.log(`  ${key}: ${values.join(', ')}`);
      }
    }
    console.log(`\nPayload:`);
    try {
      const parsed = JSON.parse(payload);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(payload);
    }
    msg.ack();
  }

  await jsm.consumers.delete('TELEMETRY', consumerName);
  await nc.close();
  console.log('\n✅ Done!');
}

viewLatestMessage().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
