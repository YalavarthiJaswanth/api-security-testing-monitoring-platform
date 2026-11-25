import { IApi } from '../models/Api';

export interface PostmanCollection {
  info: {
    _postman_id?: string;
    name: string;
    description?: string;
    schema: string;
  };
  auth?: any;
  variable?: Array<{ key: string; value: string; type?: string }>;
  item: any[];
}

export class PostmanService {
  /**
   * Generates a complete Postman Collection v2.1.0 for the API Sentinel platform
   */
  public generatePlatformCollection(baseUrl: string = 'http://localhost:5001'): PostmanCollection {
    return {
      info: {
        name: 'API Sentinel - Security Testing & Monitoring Platform API',
        description: 'Complete Postman API Collection for API Sentinel Backend microservice, testing engine, monitoring, and webhooks.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        { key: 'baseUrl', value: baseUrl, type: 'string' },
        { key: 'jwt_token', value: '', type: 'string' },
        { key: 'apiId', value: '', type: 'string' },
        { key: 'scanId', value: '', type: 'string' },
        { key: 'findingId', value: '', type: 'string' },
        { key: 'webhookId', value: '', type: 'string' }
      ],
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string'
          }
        ]
      },
      item: [
        {
          name: '1. Health & Status',
          item: [
            {
              name: 'Health Check',
              request: {
                auth: { type: 'noauth' },
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/health',
                  host: ['{{baseUrl}}'],
                  path: ['health']
                },
                description: 'Verify system uptime, database status, and health.'
              }
            }
          ]
        },
        {
          name: '2. Authentication',
          item: [
            {
              name: 'Register User',
              request: {
                auth: { type: 'noauth' },
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      username: 'security_lead',
                      email: 'lead@apisentinel.local',
                      password: 'SuperSecurePassword2026!'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/auth/register',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'auth', 'register']
                }
              }
            },
            {
              name: 'Login User (Auto-sets Token)',
              event: [
                {
                  listen: 'test',
                  script: {
                    type: 'text/javascript',
                    exec: [
                      'const jsonData = pm.response.json();',
                      'if (jsonData.token) {',
                      '    pm.environment.set("jwt_token", jsonData.token);',
                      '    pm.collectionVariables.set("jwt_token", jsonData.token);',
                      '    console.log("JWT token stored in environment variable jwt_token");',
                      '}'
                    ]
                  }
                }
              ],
              request: {
                auth: { type: 'noauth' },
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      email: 'lead@apisentinel.local',
                      password: 'SuperSecurePassword2026!'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/auth/login',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'auth', 'login']
                }
              }
            },
            {
              name: 'Get Current Profile (Me)',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/auth/me',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'auth', 'me']
                }
              }
            }
          ]
        },
        {
          name: '3. API Inventory Management',
          item: [
            {
              name: 'List Registered APIs',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/apis',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'apis']
                }
              }
            },
            {
              name: 'Register Target API',
              event: [
                {
                  listen: 'test',
                  script: {
                    type: 'text/javascript',
                    exec: [
                      'const jsonData = pm.response.json();',
                      'if (jsonData.api && jsonData.api.id) {',
                      '    pm.environment.set("apiId", jsonData.api.id);',
                      '    pm.collectionVariables.set("apiId", jsonData.api.id);',
                      '}'
                    ]
                  }
                }
              ],
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      name: 'Payment Service API',
                      baseUrl: 'http://localhost:5050',
                      description: 'Core payment processing REST API',
                      environment: 'development',
                      authType: 'bearer',
                      credentials: {
                        token: 'sentinel-test-token-2026'
                      },
                      isLabApi: true,
                      endpoints: [
                        {
                          path: '/api/v1/users',
                          method: 'GET',
                          summary: 'List users',
                          authRequired: true
                        },
                        {
                          path: '/api/v1/transfer',
                          method: 'POST',
                          summary: 'Funds transfer',
                          authRequired: true
                        }
                      ]
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/apis',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'apis']
                }
              }
            },
            {
              name: 'Get API Details',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/apis/{{apiId}}',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'apis', '{{apiId}}']
                }
              }
            },
            {
              name: 'Export API as Postman Collection',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/apis/{{apiId}}/postman',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'apis', '{{apiId}}', 'postman']
                }
              }
            },
            {
              name: 'Import OpenAPI / Swagger Spec',
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      specContent: 'openapi: "3.0.0"\ninfo:\n  title: Sample API\n  version: 1.0.0\npaths:\n  /users:\n    get:\n      summary: Get users\n      responses:\n        "200":\n          description: OK'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/apis/import-openapi',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'apis', 'import-openapi']
                }
              }
            }
          ]
        },
        {
          name: '4. Interactive API Testing Proxy',
          item: [
            {
              name: 'Send Real Request via SSRF Safe Proxy',
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      url: 'http://localhost:5050/api/v1/users',
                      method: 'GET',
                      headers: {
                        'Accept': 'application/json'
                      },
                      allowLocalLab: true
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/test/request',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'test', 'request']
                }
              }
            }
          ]
        },
        {
          name: '5. Security Scans',
          item: [
            {
              name: 'Trigger OWASP Security Scan',
              event: [
                {
                  listen: 'test',
                  script: {
                    type: 'text/javascript',
                    exec: [
                      'const jsonData = pm.response.json();',
                      'if (jsonData.scan && jsonData.scan._id) {',
                      '    pm.environment.set("scanId", jsonData.scan._id);',
                      '    pm.collectionVariables.set("scanId", jsonData.scan._id);',
                      '}'
                    ]
                  }
                }
              ],
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      apiId: '{{apiId}}',
                      scanType: 'full_owasp'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/scans/trigger',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'scans', 'trigger']
                }
              }
            },
            {
              name: 'List Scans History',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/scans',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'scans']
                }
              }
            },
            {
              name: 'Get Scan Details & Log',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/scans/{{scanId}}',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'scans', '{{scanId}}']
                }
              }
            }
          ]
        },
        {
          name: '6. Vulnerability Findings',
          item: [
            {
              name: 'List Security Findings',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/findings',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'findings']
                }
              }
            },
            {
              name: 'Update Finding Remediation Status',
              request: {
                method: 'PATCH',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      status: 'mitigated'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/findings/{{findingId}}/status',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'findings', '{{findingId}}', 'status']
                }
              }
            }
          ]
        },
        {
          name: '7. Continuous Monitoring',
          item: [
            {
              name: 'List Monitoring Configurations',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/monitoring',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'monitoring']
                }
              }
            },
            {
              name: 'Trigger Immediate Health Check',
              request: {
                method: 'POST',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/monitoring/{{apiId}}/trigger',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'monitoring', '{{apiId}}', 'trigger']
                }
              }
            }
          ]
        },
        {
          name: '8. Webhooks & Alerting',
          item: [
            {
              name: 'List Registered Webhooks',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/webhooks',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'webhooks']
                }
              }
            },
            {
              name: 'Create Webhook Endpoint',
              event: [
                {
                  listen: 'test',
                  script: {
                    type: 'text/javascript',
                    exec: [
                      'const jsonData = pm.response.json();',
                      'if (jsonData.webhook && jsonData.webhook.id) {',
                      '    pm.environment.set("webhookId", jsonData.webhook.id);',
                      '    pm.collectionVariables.set("webhookId", jsonData.webhook.id);',
                      '}'
                    ]
                  }
                }
              ],
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      name: 'Security Incident Slack Webhook',
                      url: 'https://webhook.site/test-endpoint',
                      events: ['scan.completed', 'finding.detected', 'monitoring.alert'],
                      isActive: true,
                      customHeaders: {
                        'X-Custom-Auth': 'Bearer test-token'
                      }
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/webhooks',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'webhooks']
                }
              }
            },
            {
              name: 'Test Webhook (Send Ping Event)',
              request: {
                method: 'POST',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/webhooks/{{webhookId}}/test',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'webhooks', '{{webhookId}}', 'test']
                }
              }
            },
            {
              name: 'Get Webhook Details & Delivery History',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/webhooks/{{webhookId}}',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'webhooks', '{{webhookId}}']
                }
              }
            },
            {
              name: 'Delete Webhook',
              request: {
                method: 'DELETE',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/webhooks/{{webhookId}}',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'webhooks', '{{webhookId}}']
                }
              }
            }
          ]
        },
        {
          name: '9. Reports & Exports',
          item: [
            {
              name: 'Export Platform Postman Collection',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/reports/postman',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'reports', 'postman']
                }
              }
            },
            {
              name: 'Export Platform Postman Environment',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/reports/postman-environment',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'reports', 'postman-environment']
                }
              }
            },
            {
              name: 'Export Platform OpenAPI Specification',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/reports/openapi',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'reports', 'openapi']
                }
              }
            },
            {
              name: 'Download PDF Audit Report',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/reports/pdf/{{scanId}}',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'reports', 'pdf', '{{scanId}}']
                }
              }
            }
          ]
        },
        {
          name: '10. Simulation Lab',
          item: [
            {
              name: 'Get Simulation Scenarios',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/simulation/scenarios',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'simulation', 'scenarios']
                }
              }
            },
            {
              name: 'Trigger Simulation Attack',
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      intensity: 'standard'
                    },
                    null,
                    2
                  )
                },
                url: {
                  raw: '{{baseUrl}}/api/v1/simulation/trigger/bola',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'simulation', 'trigger', 'bola']
                }
              }
            }
          ]
        },
        {
          name: '11. Settings & Platform Config',
          item: [
            {
              name: 'Get System Settings & SSRF Policy',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{baseUrl}}/api/v1/settings',
                  host: ['{{baseUrl}}'],
                  path: ['api', 'v1', 'settings']
                }
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Generates a Postman Environment file for API Sentinel
   */
  public generatePlatformEnvironment(baseUrl: string = 'http://localhost:5001') {
    return {
      id: 'sentinel-env-production-dev',
      name: 'API Sentinel Environment',
      values: [
        { key: 'baseUrl', value: baseUrl, enabled: true },
        { key: 'jwt_token', value: '', enabled: true },
        { key: 'apiId', value: '', enabled: true },
        { key: 'scanId', value: '', enabled: true },
        { key: 'findingId', value: '', enabled: true },
        { key: 'webhookId', value: '', enabled: true }
      ],
      _postman_variable_scope: 'environment'
    };
  }

  /**
   * Converts a registered Target API into a Postman Collection
   */
  public generateApiCollection(api: IApi): PostmanCollection {
    const items = (api.endpoints || []).map((ep) => {
      const pathClean = ep.path.startsWith('/') ? ep.path.slice(1) : ep.path;
      const pathSegments = pathClean.split('/');

      const headers: any[] = [{ key: 'Accept', value: 'application/json' }];
      if (api.authType === 'apiKey' && api.authConfig?.apiKeyHeader) {
        headers.push({ key: api.authConfig.apiKeyHeader, value: '{{api_key}}' });
      }

      const postmanReq: any = {
        name: ep.summary || `${ep.method} /${pathClean}`,
        request: {
          method: ep.method,
          header: headers,
          url: {
            raw: `{{apiBaseUrl}}/${pathClean}`,
            host: ['{{apiBaseUrl}}'],
            path: pathSegments
          },
          description: ep.description || ep.summary || ''
        }
      };

      if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        postmanReq.request.header.push({ key: 'Content-Type', value: 'application/json' });
        postmanReq.request.body = {
          mode: 'raw',
          raw: JSON.stringify(ep.requestBodySchema || { example: 'sample_payload' }, null, 2)
        };
      }

      return postmanReq;
    });

    const collection: PostmanCollection = {
      info: {
        name: `${api.name} - Postman Collection`,
        description: api.description || `Generated from API Sentinel for target ${api.name}`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        { key: 'apiBaseUrl', value: api.baseUrl, type: 'string' }
      ],
      item: items
    };

    if (api.authType === 'bearer') {
      collection.auth = {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{bearer_token}}', type: 'string' }]
      };
      collection.variable?.push({ key: 'bearer_token', value: '', type: 'string' });
    }

    return collection;
  }
}

export const postmanService = new PostmanService();
