/**
 * student_workflow.test.js
 *
 * Comprehensive acceptance tests for the Student Portal integration:
 *   AC-1  Student self-registration via POST /api/auth/register
 *   AC-2  Student login (correct + wrong portal enforcement)
 *   AC-3  Student submits a complaint → stored as STUDENT_PORTAL Case, visible to officer queue
 *   AC-4  Student cannot access /api/officer/* or /api/bureau/*
 *   AC-5  Student cannot read another student's complaint by ID
 *   AC-6  Officer assigns student complaint to bureau → bureau sees it, student status updates
 *   AC-7  Bureau marks case needs_info → student sees status change
 *   AC-8  Internal bureau remarks are NOT exposed in the student detail endpoint
 *   AC-9  Student submits reply → CaseAction recorded with isPublic=true, status reverts to pending
 *   AC-10 Student cannot perform admin actions (assign, transfer, escalate, overlap-dismiss)
 */

import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import app from '../app.js';
import {
  User,
  Bureau,
  Institution,
  Case,
  CaseAction,
  SlaRule,
} from '../models/index.js';

let mongoServer;

// Auth tokens
let officerToken = '';
let bureauToken = '';
let studentTokenA = '';
let studentTokenB = '';

// Shared entities
let bureauRB;
let testInstitution;
let userStudentA;
let userStudentB;
let caseA_id; // case created by student A

// ============================================================
// SETUP
// ============================================================
test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const passwordHash = await bcrypt.hash('Password@123', 8);

  bureauRB = await Bureau.create({ code: 'RB', name: 'Regulatory Bureau', type: 'bureau' });

  testInstitution = await Institution.create({
    name: 'Apex Institute of Technology',
    normalizedName: 'apex institute of technology',
    aictePermanentId: '1-SW-99001',
    city: 'Bengaluru',
    state: 'Karnataka',
    region: 'Southern',
  });

  await SlaRule.create({
    category: 'Fee/Refund',
    daysToDispose: 30,
    reminderAfterDays: 7,
    dueSoonDays: 3,
    escalateAfterDaysOverdue: 7,
  });

  // Pre-existing student B (for isolation tests)
  userStudentB = await User.create({
    name: 'Bob Student',
    email: 'bob.student@example.com',
    passwordHash,
    role: 'student',
  });

  await User.create({
    name: 'Officer Admin',
    email: 'admin@aicte.gov.in',
    passwordHash,
    role: 'super_admin',
  });

  await User.create({
    name: 'RB Officer',
    email: 'officer.rb@aicte.gov.in',
    passwordHash,
    role: 'bureau_officer',
    bureau: bureauRB._id,
  });

  // Officer login
  const resOff = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@aicte.gov.in', password: 'Password@123', portal: 'officer' });
  officerToken = resOff.body.token;

  // Bureau login
  const resBureau = await request(app)
    .post('/api/auth/login')
    .send({ email: 'officer.rb@aicte.gov.in', password: 'Password@123', portal: 'bureau' });
  bureauToken = resBureau.body.token;

  // Student B login
  const resB = await request(app)
    .post('/api/auth/login')
    .send({ email: 'bob.student@example.com', password: 'Password@123', portal: 'student' });
  studentTokenB = resB.body.token;
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

// ============================================================
// AC-1: Self-registration
// ============================================================
test('AC-1a: Student registers via POST /api/auth/register → 201 with token', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Alice Student',
      email: 'alice.student@example.com',
      password: 'Password@123',
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.token, 'Token must be returned after registration');
  assert.strictEqual(res.body.user.role, 'student');
  assert.strictEqual(res.body.portal, 'student');

  // Save token and user for subsequent tests
  studentTokenA = res.body.token;
  userStudentA = res.body.user;
});

test('AC-1b: Registration fails with 409 if email already exists', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Alice Duplicate',
      email: 'alice.student@example.com',
      password: 'Password@123',
    });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /already exists/i);
});

test('AC-1c: Registration fails with 400 if password too short', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Short Pass', email: 'shortpass@example.com', password: '123' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /8 characters/i);
});

test('AC-1d: Registration fails with 400 if name is missing', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: '', email: 'noname@example.com', password: 'Password@123' });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /name is required/i);
});

// ============================================================
// AC-2: Login enforcement
// ============================================================
test('AC-2a: Student can login via student portal → 200 with token', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice.student@example.com', password: 'Password@123', portal: 'student' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.token);
});

test('AC-2b: Student login via officer portal returns 403 (wrong portal)', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice.student@example.com', password: 'Password@123', portal: 'officer' });

  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /not registered for the Officer portal/i);
});

test('AC-2c: Wrong password returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice.student@example.com', password: 'WrongPassword!', portal: 'student' });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

// ============================================================
// AC-3: Student submits a complaint → stored as STUDENT_PORTAL Case
// ============================================================
test('AC-3: Student submits complaint → Case created with STUDENT_PORTAL source, visible in officer queue', async () => {
  const res = await request(app)
    .post('/api/student/cases')
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({
      institutionId: testInstitution._id.toString(),
      category: 'Fee/Refund',
      description: 'The institution has not refunded caution deposit after course completion.',
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data._id);
  assert.ok(res.body.data.caseId, 'caseId should be generated');
  assert.match(res.body.data.caseId, /^AICTE-STU-/, 'Student case ID should start with AICTE-STU-');

  caseA_id = res.body.data._id;

  // Verify sourceSystem is set correctly in DB
  const dbCase = await Case.findById(caseA_id);
  assert.strictEqual(dbCase.sourceSystem, 'STUDENT_PORTAL');

  // Case is visible in the officer assignment queue (unassigned cases)
  const queueRes = await request(app)
    .get('/api/officer/cases?status=pending')
    .set('Authorization', `Bearer ${officerToken}`);

  assert.strictEqual(queueRes.status, 200);
  const found = queueRes.body.data.some((c) => c._id.toString() === caseA_id.toString());
  assert.strictEqual(found, true, 'Student complaint should appear in officer case list');
});

test('AC-3b: Student complaint submission fails with 400 if description is missing', async () => {
  const res = await request(app)
    .post('/api/student/cases')
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({
      institutionId: testInstitution._id.toString(),
      category: 'Fee/Refund',
      description: '',
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
});

// ============================================================
// AC-4: Student cannot call officer or bureau endpoints
// ============================================================
test('AC-4a: Student token is rejected by /api/officer/* with 403', async () => {
  const res = await request(app)
    .get('/api/officer/cases')
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /officer portal/i);
});

test('AC-4b: Student token is rejected by /api/bureau/* with 403', async () => {
  const res = await request(app)
    .get('/api/bureau/cases')
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /bureau portal/i);
});

// ============================================================
// AC-5: Cross-student isolation
// ============================================================
test("AC-5: Student B cannot read Student A's complaint (404)", async () => {
  const res = await request(app)
    .get(`/api/student/cases/${caseA_id}`)
    .set('Authorization', `Bearer ${studentTokenB}`);

  assert.ok(res.status === 404 || res.status === 403);
  assert.strictEqual(res.body.success, false);
});

test('AC-5b: Student A can read her own complaint (200)', async () => {
  const res = await request(app)
    .get(`/api/student/cases/${caseA_id}`)
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data._id.toString(), caseA_id.toString());
});

// ============================================================
// AC-6: Officer assigns complaint to bureau → bureau sees it
// ============================================================
test('AC-6: Officer assigns student complaint to RB bureau → bureau case list reflects it', async () => {
  const resAssign = await request(app)
    .post(`/api/officer/cases/${caseA_id}/assign`)
    .set('Authorization', `Bearer ${officerToken}`)
    .send({
      bureauId: bureauRB._id.toString(),
      remarks: 'Assigned to Regulatory Bureau for caution deposit review.',
    });

  assert.strictEqual(resAssign.status, 200);
  assert.strictEqual(resAssign.body.success, true);
  assert.strictEqual(resAssign.body.data.currentBureau._id.toString(), bureauRB._id.toString());

  // Bureau list includes case
  const resQueue = await request(app)
    .get('/api/bureau/cases')
    .set('Authorization', `Bearer ${bureauToken}`);

  assert.strictEqual(resQueue.status, 200);
  const inQueue = resQueue.body.data.some((c) => c._id.toString() === caseA_id.toString());
  assert.strictEqual(inQueue, true, 'Assigned case should appear in bureau case list');
});

// ============================================================
// AC-7: Bureau requests info → student status updates
// ============================================================
test('AC-7: Bureau requests info from student → case status becomes needs_info, student sees it', async () => {
  const resInfo = await request(app)
    .post(`/api/bureau/cases/${caseA_id}/request-info`)
    .set('Authorization', `Bearer ${bureauToken}`)
    .send({ message: 'Please provide the original fee receipt and bank statement.' });

  assert.strictEqual(resInfo.status, 200);
  assert.strictEqual(resInfo.body.success, true);

  // Student fetches case — status should be needs_info
  const resStudent = await request(app)
    .get(`/api/student/cases/${caseA_id}`)
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(resStudent.status, 200);
  assert.strictEqual(resStudent.body.data.status, 'needs_info');
});

// ============================================================
// AC-8: Internal bureau remarks NOT exposed to student
// ============================================================
test('AC-8: Internal bureau remarks (isPublic=false) are not returned in student case detail', async () => {
  // Insert an internal-only action directly into DB with a valid actionType
  const caseDoc = await Case.findById(caseA_id);
  assert.ok(caseDoc, 'Case must exist before testing internal note filtering');

  await CaseAction.create({
    case: caseDoc._id,
    actionType: 'note',
    performedBy: caseDoc.submittedBy || caseDoc._id,
    remarks: 'INTERNAL: Escalating to Director if no response in 48h',
    isPublic: false,
    timestamp: new Date(),
  });

  const resStudent = await request(app)
    .get(`/api/student/cases/${caseA_id}`)
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(resStudent.status, 200);

  const timeline = resStudent.body.data.timeline || [];
  const internalAction = timeline.find((a) => a.remarks && a.remarks.includes('INTERNAL:'));
  assert.strictEqual(internalAction, undefined, 'Internal remarks must not be exposed to student');
});

// ============================================================
// AC-9: Student reply → CaseAction recorded
// ============================================================
test('AC-9: Student submits reply → CaseAction isPublic=true, status reverts to pending', async () => {
  const resReply = await request(app)
    .post(`/api/student/cases/${caseA_id}/reply`)
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({
      message: 'Attaching the fee receipt and bank statement as requested. Please see attached.',
      attachments: [{ url: 'https://example.com/receipt.pdf', name: 'fee_receipt.pdf' }],
    });

  assert.strictEqual(resReply.status, 200);
  assert.strictEqual(resReply.body.success, true);

  // Fetch updated case
  const resCase = await request(app)
    .get(`/api/student/cases/${caseA_id}`)
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(resCase.body.data.status, 'pending', 'Case should revert to pending after student reply');

  const timeline = resCase.body.data.timeline || [];
  const replyAction = timeline.find((a) => a.actionType === 'info_replied');
  assert.ok(replyAction, 'A public info_replied action should appear in timeline');
  assert.strictEqual(replyAction.isPublic, true);
});

// ============================================================
// AC-10: Student cannot perform admin actions
// ============================================================
test('AC-10a: Student cannot assign a case', async () => {
  const res = await request(app)
    .post(`/api/officer/cases/${caseA_id}/assign`)
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({ bureauId: bureauRB._id.toString(), remarks: 'Unauthorized assign attempt' });

  assert.strictEqual(res.status, 403);
});

test('AC-10b: Student cannot transfer a case via bureau endpoint', async () => {
  const res = await request(app)
    .post(`/api/bureau/cases/${caseA_id}/transfer`)
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({ targetBureauId: bureauRB._id.toString(), remarks: 'Unauthorized transfer' });

  assert.strictEqual(res.status, 403);
});

test('AC-10c: Student cannot update case status via bureau endpoint', async () => {
  const res = await request(app)
    .patch(`/api/bureau/cases/${caseA_id}/status`)
    .set('Authorization', `Bearer ${studentTokenA}`)
    .send({ status: 'disposed', remarks: 'Unauthorized disposal' });

  assert.strictEqual(res.status, 403);
});

test('AC-10d: Student cannot fetch overlap groups', async () => {
  const res = await request(app)
    .get('/api/officer/overlaps')
    .set('Authorization', `Bearer ${studentTokenA}`);

  assert.strictEqual(res.status, 403);
});
