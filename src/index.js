/* eslint-disable no-case-declarations */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import {
  getAccessToken,
  getEmployeeDirectoryByToken,
  getPayrollById,
  requestPayrollReport,
  createRefreshTask,
  getRefreshTask,
  createUser,
  createUserBridgeToken,
  getLinkReport,
  createOrder,
} from './truv.js';

const { API_CLIENT_ID, API_SECRET, API_PRODUCT_TYPE, IS_ORDER } = process.env;

const app = express();
let accessToken = null;
let accessTokenResponse = null;

// For ES Modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Validate access token is present
const validateAccessToken = () => {
  if (!accessToken) {
    throw new Error('No access token available. Please complete verification first.');
  }
  return accessToken;
};

// Helper: For webhook signing
const generate_webhook_sign = (body, key) => {
  return 'v1=' + crypto.createHmac('sha256', key).update(body).digest('hex');
};

// 1. Middleware (order matters!)
app.use(
  bodyParser.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cors());

// 2. API Routes (these come before static/catch-all!)
app.get('/getBridgeToken', async (_req, res) => {
  try {
    if (IS_ORDER && IS_ORDER.toLowerCase() === 'true') {
      const order = await createOrder();
      res.json(order);
    } else {
      const user = await createUser();
      const bridgeToken = await createUserBridgeToken(user.id);
      res.json(bridgeToken);
    }
  } catch (e) {
    console.error('error with getBridgeToken');
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.get('/getVerifications/:token', async (req, res) => {
  try {
    accessTokenResponse = await getAccessToken(req.params.token);
    if (!accessTokenResponse || !accessTokenResponse.access_token) {
      throw new Error('Failed to obtain access token');
    }
    accessToken = accessTokenResponse.access_token;
    const verifications = await getLinkReport(accessTokenResponse.link_id, API_PRODUCT_TYPE);
    res.json(verifications);
  } catch (e) {
    console.error('error with getVerifications:', e.message);
    res.status(e.message.includes('access token') ? 400 : 500).json({ 
      success: false, 
      error: e.message 
    });
  }
});

app.get('/createRefreshTask', async (_req, res) => {
  try {
    validateAccessToken();
    const refreshTask = await createRefreshTask(accessToken);
    let taskStatus = await getRefreshTask(refreshTask.task_id);

    const finishedStatuses = [
      'done',
      'login_error',
      'mfa_error',
      'config_error',
      'account_locked',
      'no_data',
      'unavailable',
      'error',
    ];

    while (finishedStatuses.indexOf(taskStatus.status) < 0) {
      console.log('TRUV: Refresh task is not finished. Waiting 2 seconds, then checking again.');
      await sleep(2000);
      taskStatus = await getRefreshTask(refreshTask.task_id);
    }

    console.log('TRUV: Refresh task is finished. Pulling the latest data.');
    switch (API_PRODUCT_TYPE) {
      case 'employment':
      case 'income':
        res.json(await getLinkReport(accessTokenResponse.link_id, API_PRODUCT_TYPE));
        break;
      case 'admin': {
        const _accessToken = accessTokenResponse.access_token;
        const directory = await getEmployeeDirectoryByToken(_accessToken);
        // Hardcoded dates for sandbox test
        const reportId = (await requestPayrollReport(_accessToken, '2020-01-01', '2020-02-01')).payroll_report_id;
        const payroll = await getPayrollById(reportId);
        const data = { directory, payroll };
        res.json(data);
        break;
      }
      default:
        res.json({ success: false, error: 'Unknown API_PRODUCT_TYPE' });
        break;
    }
  } catch (e) {
    console.error('error with createRefreshTask');
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.get('/getAdminData/:token', async (req, res) => {
  try {
    const accessTokenResponse = await getAccessToken(req.params.token);
    accessToken = accessTokenResponse.access_token;

    const directory = await getEmployeeDirectoryByToken(accessToken);

    const reportId = (await requestPayrollReport(accessToken, '2020-01-01', '2020-02-01')).payroll_report_id;
    const payroll = await getPayrollById(reportId);

    const data = { directory, payroll };
    res.json(data);
  } catch (e) {
    console.error('error with getAdminData');
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.get('/getDepositSwitchData/:token', async (req, res) => {
  try {
    const accessTokenResponse = await getAccessToken(req.params.token);
    const depositSwitchResult = await getLinkReport(accessTokenResponse.link_id, 'direct_deposit');

    res.json(depositSwitchResult);
  } catch (e) {
    console.error('error with getDepositSwitchData');
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.get('/getPaycheckLinkedLoanData/:token', async (req, res) => {
  try {
    const accessTokenResponse = await getAccessToken(req.params.token);
    const payCheckLinkedLoanResult = await getLinkReport(accessTokenResponse.link_id, 'pll');

    res.json(payCheckLinkedLoanResult);
  } catch (e) {
    console.error('error with getPaycheckLinkedLoanData');
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.post('/webhook', (req, res) => {
  console.log('TRUV: Webhook Received');
  const body = req.rawBody.toString();
  const webhook_sign = generate_webhook_sign(body, API_SECRET);
  console.log(`TRUV: Event type:      ${req.body.event_type}`);
  console.log(`TRUV: Status:          ${req.body.status}`);
  console.log(`TRUV: Signature match: ${webhook_sign === req.headers['x-webhook-sign']}\n`);
  res.status(200).end();
});

// Helper for async sleep (used in refresh polling)
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 3. Static file serving (for /public)
// This comes after API routes so /api doesn't get overridden!
app.use(express.static(path.join(__dirname, '../public')));

// 4. SPA catch-all (for react-router or client-side routing)
// Must be after all API/static routes.
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 5. Global error handler
// (Express expects 4 params: err, req, res, next)
app.use((err, _req, res) => {
  console.error('Global error handler:', err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 6. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('='.repeat(40), 'ENVIRONMENT', '='.repeat(40));
  const environment = {
    API_CLIENT_ID,
    API_SECRET,
    API_PRODUCT_TYPE,
    IS_ORDER,
  };
  console.log(environment);
  console.log('='.repeat(94));
  console.log(`Quickstart Loaded. Navigate to http://localhost:${PORT} to view Quickstart.`);
});
