// Test NATS stream viewer
import { connect } from 'nats';

async function viewMessages() {
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

  console.log('\n=== Latest Messages ===');
  const js = nc.jetstream();

  // Get the last few messages using the lastSeq from streamInfo
  const lastSeq = streamInfo.state.last_seq;

  // Fetch last 3 messages
  for (let seq = Math.max(1, lastSeq - 2); seq <= lastSeq; seq++) {
    try {
      const msg = await js.streams.getMessage('TELEMETRY', { seq });
      const payload = new TextDecoder().decode(msg.data);
      console.log(`\n[Message ${seq}]`);
      console.log(`Subject: ${msg.subject}`);
      console.log(`Headers:`);
      if (msg.headers) {
        for (const [key, values] of msg.headers) {
          console.log(`  ${key}: ${values.join(', ')}`);
        }
      }
      console.log(`Payload: ${payload}`);
    } catch (error) {
      console.log(`Could not fetch message ${seq}: ${error.message}`);
    }
  }

  await nc.close();
}

viewMessages().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
