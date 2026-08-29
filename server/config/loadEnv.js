import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Always load server/.env regardless of PM2 working directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });
