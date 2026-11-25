import fs from 'fs';
import path from 'path';
import { postmanService } from '../services/postmanService';
import { swaggerSpec } from '../config/swagger';

async function main() {
  const rootDir = path.resolve(__dirname, '../../..');
  const postmanDirs = [
    path.join(rootDir, 'postman'),
    path.join(rootDir, 'docs', 'postman')
  ];

  const swaggerDirs = [
    path.join(rootDir, 'docs', 'swagger'),
    path.join(rootDir, 'docs')
  ];

  for (const d of [...postmanDirs, ...swaggerDirs]) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  const collection = postmanService.generatePlatformCollection('http://localhost:5001');
  const environment = postmanService.generatePlatformEnvironment('http://localhost:5001');

  for (const d of postmanDirs) {
    fs.writeFileSync(
      path.join(d, 'API_Sentinel.postman_collection.json'),
      JSON.stringify(collection, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(d, 'API_Sentinel.postman_environment.json'),
      JSON.stringify(environment, null, 2),
      'utf8'
    );
    console.log(`[Postman Export] Generated Postman files in: ${d}`);
  }

  // Also write swagger.json
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'swagger', 'openapi.json'),
    JSON.stringify(swaggerSpec, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(rootDir, 'docs', 'openapi.json'),
    JSON.stringify(swaggerSpec, null, 2),
    'utf8'
  );
  console.log(`[Swagger Export] Generated OpenAPI specs in docs/`);
}

main().catch((err) => {
  console.error('Error generating exports:', err);
  process.exit(1);
});
