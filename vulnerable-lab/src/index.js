const express = require('express');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-sentinel-vulnerable-lab', port: PORT });
});

// Scenario 1: BOLA (Broken Object Level Authorization)
app.get('/api/v1/lab/users/:id', (req, res) => {
  const userId = req.params.id;
  // Flaw: Directly returns object without checking caller authorization
  res.json({
    id: userId,
    fullName: userId === 'user_9921' ? 'Dr. Jane Vance (Victim)' : 'Alex Mercer',
    email: `${userId}@internal-healthcare.org`,
    ssn: '982-12-8812',
    medicalRecordNumber: 'MRN-902188',
    role: 'patient',
    billingAddress: '445 Montgomery St, San Francisco, CA'
  });
});

// Scenario 2: Broken Authentication
app.post('/api/v1/lab/auth/reset-password', (req, res) => {
  const { email, newPassword, resetToken } = req.body;
  // Flaw: Accepts any reset token without database lookup or expiration check
  res.json({
    status: 'success',
    message: `Password has been updated for ${email || 'user'}. Token signature was not verified.`,
    updatedTimestamp: new Date().toISOString()
  });
});

// Scenario 3: Excessive Data Exposure (Broken Property Level Auth)
app.get('/api/v1/lab/accounts/profile', (req, res) => {
  // Flaw: Returns internal private fields in response
  res.json({
    id: 'usr_7718',
    username: 'alice_developer',
    email: 'alice@corp.internal',
    password_hash: '$2b$12$K1n3k9D2Q5sJ7pM8rT9uAe7F6G5H4J3K2L1M0N9O8P7Q6R5S4T3U2',
    salt: '88fa2b109c',
    ssn: '987-65-4321',
    is_admin: false,
    internal_api_secret: 'sec_live_99a8b7c6d5e4f3'
  });
});

// Scenario 4: Permissive CORS with Credentials
app.get('/api/v1/lab/data/export', (req, res) => {
  const origin = req.headers.origin || '*';
  // Flaw: Blindly echoes origin and enables credentials
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.json({
    accountNumber: 'ACT-9823-1192',
    balance: 14250.75,
    currency: 'USD',
    transactions: [
      { id: 'tx_101', amount: -250.0, description: 'Wire Transfer to External Node' },
      { id: 'tx_102', amount: 3500.0, description: 'Direct Deposit Payroll' }
    ]
  });
});

// Scenario 5: Missing Security Headers & Information Disclosure
app.get('/api/v1/lab/public/info', (req, res) => {
  // Flaw: Omits HSTS, CSP, X-Frame-Options, X-Content-Type-Options; leaks Server header
  res.setHeader('Server', 'Express/4.21.2 on Ubuntu 22.04 LTS');
  res.setHeader('X-Powered-By', 'Express.js/4.21.2');
  res.json({
    service: 'Public Gateway',
    environment: 'staging-cluster-04',
    version: '1.4.2-beta',
    status: 'online'
  });
});

// Scenario 6: Unrestricted Resource Consumption
app.get('/api/v1/lab/orders', (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  // Flaw: Accepts arbitrarily massive limit without ceiling
  res.json({
    totalRecordsReturned: limit,
    warning: limit > 1000 ? 'Query executed with no pagination limit. Database memory consumption elevated.' : undefined,
    sampleOrders: Array.from({ length: Math.min(limit, 5) }).map((_, i) => ({
      orderId: `ORD-${1000 + i}`,
      amount: (i + 1) * 45.5,
      status: 'completed'
    }))
  });
});

// Scenario 7: Broken Function Level Authorization (BFLA)
app.post('/api/v1/lab/admin/users/grant-admin', (req, res) => {
  const { targetUserId, role } = req.body;
  // Flaw: Regular non-admin request can elevate roles
  res.json({
    success: true,
    message: `Administrative privileges granted to ${targetUserId || 'caller'}. Role upgraded to ${role || 'superadmin'} without role authorization check.`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Vulnerable Lab] Simulation service running on port ${PORT}`);
});
