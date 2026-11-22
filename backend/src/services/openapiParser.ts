import YAML from 'yaml';
import { IEndpoint } from '../models/Api';

export interface ParseOpenApiResult {
  title?: string;
  version?: string;
  baseUrl?: string;
  endpoints: IEndpoint[];
}

export function parseOpenApiSpec(rawSpec: string): ParseOpenApiResult {
  if (!rawSpec || typeof rawSpec !== 'string') {
    throw new Error('Specification content is empty or invalid');
  }

  let specObj: any;
  try {
    // Attempt JSON first, then YAML
    specObj = JSON.parse(rawSpec);
  } catch {
    try {
      specObj = YAML.parse(rawSpec);
    } catch (err: any) {
      throw new Error(`Failed to parse specification as JSON or YAML: ${err.message}`);
    }
  }

  if (!specObj || typeof specObj !== 'object') {
    throw new Error('Parsed specification is not a valid object');
  }

  const endpoints: IEndpoint[] = [];
  const paths = specObj.paths || {};

  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of httpMethods) {
      if (pathItem[method]) {
        const operation = pathItem[method];

        // Parse parameters
        const parameters: any[] = [];
        const rawParams = [...(pathItem.parameters || []), ...(operation.parameters || [])];
        
        for (const p of rawParams) {
          if (p && p.name) {
            parameters.push({
              name: p.name,
              in: p.in || 'query',
              required: !!p.required,
              type: p.schema?.type || p.type || 'string',
              description: p.description || ''
            });
          }
        }

        // Request body schema for OpenAPI 3 or Swagger 2
        let requestBodySchema: any = null;
        if (operation.requestBody?.content) {
          const contentType = Object.keys(operation.requestBody.content)[0];
          requestBodySchema = operation.requestBody.content[contentType]?.schema;
        } else if (rawParams.find((p: any) => p.in === 'body')) {
          requestBodySchema = rawParams.find((p: any) => p.in === 'body')?.schema;
        }

        // Response schema
        let responseSchema: any = null;
        const successResp = operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.default;
        if (successResp?.content) {
          const contentType = Object.keys(successResp.content)[0];
          responseSchema = successResp.content[contentType]?.schema;
        } else if (successResp?.schema) {
          responseSchema = successResp.schema;
        }

        const authRequired = !!(operation.security?.length || specObj.security?.length);

        endpoints.push({
          path: pathKey,
          method: method.toUpperCase() as any,
          summary: operation.summary || '',
          description: operation.description || '',
          parameters,
          requestBodySchema,
          responseSchema,
          authRequired
        });
      }
    }
  }

  // Derive base URL if available
  let baseUrl = '';
  if (specObj.servers && specObj.servers[0]?.url) {
    baseUrl = specObj.servers[0].url;
  } else if (specObj.host) {
    const scheme = specObj.schemes?.[0] || 'https';
    const basePath = specObj.basePath || '';
    baseUrl = `${scheme}://${specObj.host}${basePath}`;
  }

  return {
    title: specObj.info?.title || 'Imported API',
    version: specObj.info?.version || '1.0.0',
    baseUrl,
    endpoints
  };
}
