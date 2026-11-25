import { postmanService } from '../src/services/postmanService';
import fs from 'fs';
import path from 'path';

describe('Postman Collection & Environment Generator Tests', () => {
  it('should generate a valid v2.1.0 Postman collection for the platform', () => {
    const collection = postmanService.generatePlatformCollection('http://localhost:5001');

    expect(collection.info.name).toContain('API Sentinel');
    expect(collection.info.schema).toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    expect(collection.item.length).toBeGreaterThanOrEqual(10);

    const folderNames = collection.item.map((f: any) => f.name);
    expect(folderNames).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Authentication'),
        expect.stringContaining('API Inventory'),
        expect.stringContaining('Security Scans'),
        expect.stringContaining('Webhooks'),
        expect.stringContaining('Reports')
      ])
    );

    // Verify auto token injection script is present in login endpoint
    const authFolder = collection.item.find((f: any) => f.name.includes('Authentication'));
    const loginReq = authFolder.item.find((i: any) => i.name.includes('Login'));
    expect(loginReq.event).toBeDefined();
    expect(loginReq.event[0].script.exec.join(' ')).toContain('jwt_token');
  });

  it('should generate a valid Postman environment', () => {
    const env = postmanService.generatePlatformEnvironment('http://localhost:5001');
    expect(env.name).toBe('API Sentinel Environment');
    expect(env.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'baseUrl', value: 'http://localhost:5001' }),
        expect.objectContaining({ key: 'jwt_token' }),
        expect.objectContaining({ key: 'apiId' }),
        expect.objectContaining({ key: 'scanId' })
      ])
    );
  });

  it('should generate a custom Postman collection for a registered target API', () => {
    const mockApi: any = {
      name: 'Test Store API',
      baseUrl: 'https://store.example.com',
      description: 'E-commerce API',
      authType: 'bearer',
      endpoints: [
        {
          path: '/orders',
          method: 'POST',
          summary: 'Create Order',
          requestBodySchema: { item: 'widget', quantity: 2 }
        },
        {
          path: '/orders/{id}',
          method: 'GET',
          summary: 'Get Order by ID'
        }
      ]
    };

    const targetCollection = postmanService.generateApiCollection(mockApi);
    expect(targetCollection.info.name).toBe('Test Store API - Postman Collection');
    expect(targetCollection.item).toHaveLength(2);
    expect(targetCollection.item[0].request.method).toBe('POST');
    expect(targetCollection.item[0].request.body.raw).toContain('widget');
  });

  it('should ensure the exported postman files exist on disk', () => {
    const collectionPath = path.resolve(__dirname, '../../postman/API_Sentinel.postman_collection.json');
    const envPath = path.resolve(__dirname, '../../postman/API_Sentinel.postman_environment.json');

    expect(fs.existsSync(collectionPath)).toBe(true);
    expect(fs.existsSync(envPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
    expect(parsed.info.name).toContain('API Sentinel');
  });
});
