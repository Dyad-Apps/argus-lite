// Test NATS subscriber
import { connect, consumerOpts, AckPolicy } from 'nats';

async function subscribeMessages() {
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

  console.log('\n=== Subscribing to telemetry.raw.> ===');

  const opts = consumerOpts();
  opts.deliverAll();
  opts.ackExplicit();
  opts.maxMessages(3);

  const sub = await js.subscribe('telemetry.raw.>', opts);

  console.log('Waiting for messages...\n');

  let count = 0;
  for await (const msg of sub) {
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

    if (count >= 3) {
      break;
    }
  }

  await nc.close();
  console.log('\n✅ Done!');
}

subscribeMessages().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
