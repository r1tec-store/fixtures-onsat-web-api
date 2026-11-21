import { createApp } from './app.js';
import { config } from './config.js';
import { EspnScoresProvider } from './providers/espn/index.js';
import { FixturesOnsatProvider } from './providers/fixtures-onsat/index.js';
import { DataStore } from './services/store.js';
import { logger } from './utils/logger.js';

let store: DataStore;
// The provider reports structural parse problems (changed/missing fields) to the store's issue log.
const provider = new FixturesOnsatProvider(config.sourceBaseUrl, (w) => store.issue('warning', w));
store = new DataStore(provider, config.enableScores ? new EspnScoresProvider() : null);

await store.init();
const server = createApp(store).listen(config.port, () => logger.info({ port: config.port }, 'Fixtures ONSAT API listening'));

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    store.stop();
    server.close(() => process.exit(0));
  });
}
