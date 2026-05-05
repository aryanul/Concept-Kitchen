import { config } from 'dotenv';
import { join } from 'node:path';

// Monorepo: a single .env at the repo root, regardless of which workspace runs the script.
config({ path: join(__dirname, '..', '..', '.env') });
