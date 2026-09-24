// Shared helpers for smoke tests (run against a live server + your real DB).
const mongoose = require('mongoose');
const { connectDB } = require('../../src/config/db');
const { User } = require('../../src/models');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5000/api/v1';

// A tiny HTTP client with its own cookie jar (one per logged-in role)
function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

function reporter() {
  const state = { passed: 0, failed: 0 };
  const check = (name, condition, info) => {
    if (condition) state.passed++;
    else state.failed++;
    console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `\n      got: ${JSON.stringify(info)}`}`);
  };
  const done = async () => {
    console.log(`\n${state.passed} passed, ${state.failed} failed`);
    await mongoose.disconnect();
    process.exit(state.failed ? 1 : 0);
  };
  return { check, done };
}

// Creates (or resets) a smoke account with a known password and role
async function ensureUser(email, role, name = email.split('@')[0]) {
  let user = await User.findOne({ email });
  if (!user) user = new User({ email, name, role, password: 'Smoke12345' });
  user.role = role;
  user.password = 'Smoke12345';
  await user.save();
  return user;
}

async function loginAs(email) {
  const call = client();
  const r = await call('POST', '/auth/login', { email, password: 'Smoke12345' });
  if (r.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(r.body)}`);
  return call;
}

module.exports = { BASE, client, reporter, ensureUser, loginAs, connectDB };
