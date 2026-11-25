const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { frontendRequire, loadFrontendModule } = require('../helpers/project_loader.cjs');

const React = frontendRequire('react');
const ReactDOMServer = frontendRequire('react-dom/server');

describe('Frontend React Components & API Client Unit Tests', () => {
  const origWindow = global.window;
  const origLocalStorage = global.localStorage;

  afterEach(() => {
    global.window = origWindow;
    global.localStorage = origLocalStorage;
  });

  it('SeverityBadge: renders CRITICAL, HIGH, MEDIUM, LOW, and INFO badges with expected color classes', () => {
    const { SeverityBadge } = loadFrontendModule('components/SeverityBadge.tsx');

    const criticalHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SeverityBadge, { severity: 'critical' })
    );
    assert.match(criticalHtml, /CRITICAL/);
    assert.match(criticalHtml, /text-rose-400/);

    const highHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SeverityBadge, { severity: 'high', size: 'sm' })
    );
    assert.match(highHtml, /HIGH/);
    assert.match(highHtml, /text-amber-400/);
    assert.match(highHtml, /font-semibold/);

    const infoHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SeverityBadge, { severity: 'informational' })
    );
    assert.match(infoHtml, /INFO/);
    assert.match(infoHtml, /text-purple-400/);

    // Unknown fallback defaults to LOW styling
    const unknownHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SeverityBadge, { severity: 'unknown' })
    );
    assert.match(unknownHtml, /text-sky-400/);
  });

  it('Header: renders page title, subtitle, telemetry status indicators, and custom actions', () => {
    const { Header } = loadFrontendModule('components/Header.tsx');

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Header, {
        title: 'Security Findings',
        subtitle: 'Live vulnerability evidence catalog',
        actions: React.createElement('button', { type: 'button' }, 'Export PDF')
      })
    );

    assert.match(html, /Security Findings/);
    assert.match(html, /Live vulnerability evidence catalog/);
    assert.match(html, /Engine Active/);
    assert.match(html, /FastAPI: Online/);
    assert.match(html, /MongoDB: Connected/);
    assert.match(html, /Export PDF/);
  });

  it('Sidebar: renders all 11 navigation modules, brand header, and authenticated user badge', () => {
    const mockAuthContext = {
      useAuth: () => ({
        user: { username: 'jaswanth_sec', role: 'admin' },
        logout: () => {}
      })
    };

    const mockRouterDom = {
      NavLink: ({ to, children, className }) => {
        const cls = typeof className === 'function' ? className({ isActive: to === '/' }) : className;
        return React.createElement('a', { href: to, className: cls }, children);
      }
    };

    const { Sidebar } = loadFrontendModule('components/Sidebar.tsx', {
      '../context/AuthContext': mockAuthContext,
      'react-router-dom': mockRouterDom
    });

    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(Sidebar));

    assert.match(html, /API SENTINEL/);
    assert.match(html, /jaswanth_sec/);
    assert.match(html, /admin/);

    const expectedRoutes = [
      'Main Dashboard',
      'API Inventory',
      'Add New API',
      'API Workspace',
      'Vulnerability Scanner',
      'Security Findings',
      'API Monitoring',
      'Scan History',
      'Reports',
      'Simulation Lab',
      'Settings'
    ];
    for (const label of expectedRoutes) {
      assert.ok(html.includes(label), `Expected Sidebar to contain navigation label "${label}"`);
    }
  });

  it('services/api.ts: attaches JWT token on request and handles 401 session expiration safely', async () => {
    const store = {
      api_sentinel_token: 'jwt_front_token_999',
      api_sentinel_user: '{"username":"alice"}'
    };

    global.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      removeItem: (k) => {
        delete store[k];
      }
    };
    global.window = {
      location: { pathname: '/dashboard', href: '/dashboard' }
    };

    const apiMod = loadFrontendModule('services/api.ts');
    const apiClient = apiMod.default;

    assert.equal(apiClient.defaults.baseURL, '/api/v1');

    // Execute registered request interceptor
    const reqHandler = apiClient.interceptors.request.handlers[0].fulfilled;
    const reqConfig = reqHandler({ headers: {} });
    assert.equal(reqConfig.headers.Authorization, 'Bearer jwt_front_token_999');

    // Execute registered 401 response error interceptor
    const resRejected = apiClient.interceptors.response.handlers[0].rejected;
    await assert.rejects(() => resRejected({ response: { status: 401 } }));

    assert.equal(store.api_sentinel_token, undefined);
    assert.equal(store.api_sentinel_user, undefined);
    assert.equal(global.window.location.href, '/login');
  });
});
