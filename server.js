import 'dotenv/config';
import { init, driverName } from './src/db.js';
import { createApp } from './src/app.js';

const PORT = Number(process.env.PORT || 3000);

await init();

createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`ACU PhD Passport Portal running on http://localhost:${PORT}`);
  console.log(`Database: ${driverName()}`);
});
