import { ClaudeCodeAgent } from '../src/main/services/coding-agent/implementations/ClaudeCodeAgent';

async function debug() {
  const agent = new ClaudeCodeAgent({});
  await agent.initialize();

  const result = await agent.listSessionSummaries({ lookbackDays: 1 });
  if (result.success === false) {
    console.log('Error:', result.error);
    return;
  }

  // Show raw timestamps from the top 10 sessions
  console.log('Top 10 sessions by timestamp:');
  for (const s of result.data.slice(0, 10)) {
    console.log(
      `${s.id.substring(0, 8)} | ts: ${s.timestamp} | upd: ${s.updatedAt} | proj: ${s.projectName}`
    );
  }
}

debug();
