import { createServer } from './server.js';
import { loadEnv } from './lib/env.js';

const env = loadEnv();
const app = createServer(env);

const port = env.PORT;
app.listen(port, () => {
  console.log(`Base44 backend listening on port ${port}`);
});
