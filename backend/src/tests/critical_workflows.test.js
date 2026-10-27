import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { env } from '../config/env.js';
import { portalForRole } from '../utils/portal.js';
import {
  User,
  Bureau,
  Institution,
  Case,
  CaseAction,
  OverlapGroup,
  SlaRule,
  Alert,
} from '../models/index.js';
import { generateCaseId, ingestCases } from '../services/ingestion.js';
import { checkInstitutionOverlap, evaluateCasePair } from '../services/overlap.js';
import { runSlaChecks } from '../services/sla.js';

let mongoServer;

let bureauRB;
let bureauPGRC;
let instSouthern;
let instNorthern;

let superAdminUser;
let seniorMgmtUser;
let regionalOfficerSouthern;
let bureauOfficerRB;
let bureauOfficerPGRC;

const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      portal: portalForRole(user.role),
    },
    env.JWT_SECRET,
    { expiresIn: '2h' }
  );
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const passwordHash = await bcrypt.hash('Password@123', 8);

  // 1. Create Bureaus
  bureauRB = await Bureau.create({
    code: 'RB',
    name: 'Regulatory Bureau',
    type: 'bureau',
  });
  bureauPGRC = await Bureau.create({
    code: 'PGRC',
    name: 'Public Grievance Redressal Cell',
    type: 'cell',
  });

  // 2. Create Institutions in different regions
  instSouthern = await Institution.create({
    name: 'Apex Institute of Technology & Management',
    normalizedName: 'apex institute of technology management',
    aictePermanentId: '1-10000001',
    city: 'Bengaluru',
    state: 'Karnataka',
    region: 'Southern',
  });

  instNorthern = await Institution.create({
    name: 'Northern Engineering College',
    normalizedName: 'northern engineering college',
    aictePermanentId: '1-20000002',
    city: 'New Delhi',
    state: 'Delhi',
    region: 'Northern',
  });

  // 3. Create SLA Rules
  await SlaRule.create({
    category: 'Fee Issues',
    daysToDispose: 30,
    reminderAfterDays: 7,
    dueSoonDays: 3,
    escalateAfterDaysOverdue: 7,
  });
  await SlaRule.create({
    category: 'Regulatory Compliance',
    daysToDispose: 45,
    reminderAfterDays: 10,
    dueSoonDays: 5,
    escalateAfterDaysOverdue: 10,
  });

  // 4. Create Users for role-based scoping tests
  superAdminUser = await User.create({
    name: 'Super Admin',
    email: 'admin.crit@aicte.gov.in',
    passwordHash,
    role: 'super_admin',
    bureau: bureauRB._id,
    isActive: true,
  });

  seniorMgmtUser = await User.create({
    name: 'Senior Director',
    email: 'senior.crit@aicte.gov.in',
    passwordHash,
    role: 'senior_management',
    isActive: true,
  });

  regionalOfficerSouthern = await User.create({
    name: 'South Regional Officer',
    email: 'ro.south.crit@aicte.gov.in',
    passwordHash,
    role: 'regional_officer',
    region: 'Southern',
    isActive: true,
  });

  bureauOfficerRB = await User.create({
    name: 'RB Officer',
    email: 'rb.officer.crit@aicte.gov.in',
    passwordHash,
    role: 'bureau_officer',
    bureau: bureauRB._id,
    isActive: true,
  });

  bureauOfficerPGRC = await User.create({
    name: 'PGRC Officer',
    email: 'pgrc.officer.crit@aicte.gov.in',
    passwordHash,
    role: 'bureau_officer',
    bureau: bureauPGRC._id,
    isActive: true,
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('Test 1: Idempotent data ingestion with zero duplicate cases', async () => {
  const records = [
    {
      sourceSystem: 'RB',
      sourceCaseRef: 'IDEMP-001',
      rawInstitutionName: 'Apex Institute of Technology & Management',
      aictePermanentId: '1-10000001',
      category: 'Fee Issues',
      description: 'Complaint regarding excess capitation fee collection',
      receivedDate: '2026-02-15',
      status: 'pending',
    },
    {
      sourceSystem: 'RB',
      sourceCaseRef: 'IDEMP-002',
      rawInstitutionName: 'Northern Engineering College',
      aictePermanentId: '1-20000002',
      category: 'Regulatory Compliance',
      description: 'Faculty shortage in Mechanical department',
      receivedDate: '2026-02-16',
      status: 'under_process',
    },
  ];

  // 1st ingestion pass: should insert both
  const firstPass = await ingestCases(records, superAdminUser._id);
  assert.strictEqual(firstPass.inserted, 2);
  assert.strictEqual(firstPass.skipped, 0);
  assert.strictEqual(firstPass.failed, 0);

  const initialCount = await Case.countDocuments({
    sourceCaseRef: { $in: ['IDEMP-001', 'IDEMP-002'] },
  });
  assert.strictEqual(initialCount, 2);

  // 2nd ingestion pass with identical data: must skip both, zero duplicates
  const secondPass = await ingestCases(records, superAdminUser._id);
  assert.strictEqual(secondPass.inserted, 0);
  assert.strictEqual(secondPass.updated, 0);
  assert.strictEqual(secondPass.skipped, 2);
  assert.strictEqual(secondPass.failed, 0);

  const afterCount = await Case.countDocuments({
    sourceCaseRef: { $in: ['IDEMP-001', 'IDEMP-002'] },
  });
  assert.strictEqual(afterCount, 2, 'Case count must remain unchanged after repeat import');
});

test('Test 2: Cryptographically unique, collision-safe Case ID generation', async () => {
  const promises = [];
  for (let i = 0; i < 25; i++) {
    promises.push(generateCaseId('RB'));
  }
  const generatedIds = await Promise.all(promises);

  assert.strictEqual(generatedIds.length, 25);
  const uniqueSet = new Set(generatedIds);
  assert.strictEqual(uniqueSet.size, 25, 'Every generated Case ID must be distinct');

  for (const id of generatedIds) {
    assert.match(
      id,
      /^AICTE-RB-\d{4}-[A-Z0-9]+$/,
      `Case ID ${id} must follow standard AICTE format`
    );
  }
});

test('Test 3: Bureau transfer audit history records true fromBureau and toBureau', async () => {
  const tokenRB = createToken(bureauOfficerRB);

  // Create a case owned by RB
  const testCase = await Case.create({
    caseId: await generateCaseId('RB'),
    sourceSystem: 'RB',
    sourceCaseRef: 'XFER-001',
    institution: instSouthern._id,
    rawInstitutionName: instSouthern.name,
    category: 'Fee Issues',
    description: 'Case to test bureau transfer audit trail',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'under_process',
    currentBureau: bureauRB._id,
  });

  // Transfer case from RB to PGRC
  const res = await request(app)
    .post(`/api/bureau/cases/${testCase._id}/transfer`)
    .set('Authorization', `Bearer ${tokenRB}`)
    .send({
      targetBureauId: bureauPGRC._id.toString(),
      remarks: 'Transferred to PGRC for student grievance committee review',
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);

  // Verify Case record updated
  const updatedCase = await Case.findById(testCase._id);
  assert.strictEqual(updatedCase.currentBureau.toString(), bureauPGRC._id.toString());
  assert.strictEqual(updatedCase.status, 'transferred');

  // Verify CaseAction audit trail contains accurate fromBureau and toBureau
  const action = await CaseAction.findOne({
    case: testCase._id,
    actionType: 'transferred',
  });
  assert.ok(action, 'CaseAction of type transferred must exist');
  assert.strictEqual(
    action.fromBureau.toString(),
    bureauRB._id.toString(),
    'fromBureau must match the originating bureau'
  );
  assert.strictEqual(
    action.toBureau.toString(),
    bureauPGRC._id.toString(),
    'toBureau must match the destination bureau'
  );
});

test('Test 4: Overlap engine distinguishes duplicate complaints from different matters', async () => {
  // Case A in RB for instSouthern
  const caseA = await Case.create({
    caseId: await generateCaseId('RB'),
    sourceSystem: 'RB',
    sourceCaseRef: 'DUP-RB-101',
    institution: instSouthern._id,
    rawInstitutionName: instSouthern.name,
    category: 'Fee Issues',
    description: 'Capitation fee refund withheld by administration after admission withdrawal',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'pending',
    currentBureau: bureauRB._id,
  });

  // Case B in PGRC for same instSouthern with identical category and grievance
  const caseB = await Case.create({
    caseId: await generateCaseId('PGRC'),
    sourceSystem: 'PGRC',
    sourceCaseRef: 'DUP-PGRC-102',
    institution: instSouthern._id,
    rawInstitutionName: instSouthern.name,
    category: 'Fee Issues',
    description: 'Student capitation fee refund pending since admission cancellation',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'under_process',
    currentBureau: bureauPGRC._id,
  });

  // 1. Evaluate pair directly
  const evalResult = evaluateCasePair(caseA, caseB);
  assert.strictEqual(evalResult.overlapType, 'duplicate_complaint');
  assert.ok(evalResult.reason.includes('duplicate complaint'));

  // 2. Trigger institution overlap check
  const overlapGroup = await checkInstitutionOverlap(instSouthern._id);
  assert.ok(overlapGroup, 'Overlap group should be generated');
  assert.strictEqual(overlapGroup.overlapType, 'duplicate_complaint');
  assert.strictEqual(overlapGroup.severity, 'high');
  assert.ok(overlapGroup.reason.length > 0);

  // 3. Different complaints test:
  // Distinct institution with unrelated complaints should not be classified as duplicate
  const caseDiff1 = {
    category: 'Fee Issues',
    description: 'Hostel caution deposit refund query',
    currentBureau: bureauRB,
  };
  const caseDiff2 = {
    category: 'Infrastructure',
    description: 'Library roof maintenance and reading room AC broken',
    currentBureau: bureauPGRC,
  };
  const evalDiff = evaluateCasePair(caseDiff1, caseDiff2);
  assert.notStrictEqual(evalDiff.overlapType, 'duplicate_complaint');
});

test('Test 5: Overlap group review, explainability, and officer resolution', async () => {
  const tokenOfficer = createToken(superAdminUser);

  const existingGroup = await OverlapGroup.findOne({
    institution: instSouthern._id,
    status: 'open',
  });
  assert.ok(existingGroup, 'Open overlap group must exist from Test 4');
  assert.ok(existingGroup.reason, 'Explainable reason must be present');

  // Resolve overlap group as coordinated
  const res = await request(app)
    .post(`/api/officer/overlaps/${existingGroup._id}/resolve`)
    .set('Authorization', `Bearer ${tokenOfficer}`)
    .send({
      status: 'coordinated',
      remarks: 'Joint inquiry scheduled by RB and PGRC to issue unified directive.',
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);

  const updatedGroup = await OverlapGroup.findById(existingGroup._id);
  assert.strictEqual(updatedGroup.status, 'coordinated');
  assert.strictEqual(
    updatedGroup.resolutionRemarks,
    'Joint inquiry scheduled by RB and PGRC to issue unified directive.'
  );

  // Check alert is also resolved
  const openAlerts = await Alert.countDocuments({
    overlapGroup: existingGroup._id,
    resolvedAt: { $exists: false },
  });
  assert.strictEqual(openAlerts, 0, 'Associated alerts must be marked resolved');
});

test('Test 6: Overlap dismissal persistence prevents repeat alerts on recalculation', async () => {
  // Create two cases in different bureaus for instNorthern
  const caseN1 = await Case.create({
    caseId: await generateCaseId('RB'),
    sourceSystem: 'RB',
    sourceCaseRef: 'DISMISS-01',
    institution: instNorthern._id,
    rawInstitutionName: instNorthern.name,
    category: 'Fee Issues',
    description: 'Fee collection audit query',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'pending',
    currentBureau: bureauRB._id,
  });

  const caseN2 = await Case.create({
    caseId: await generateCaseId('PGRC'),
    sourceSystem: 'PGRC',
    sourceCaseRef: 'DISMISS-02',
    institution: instNorthern._id,
    rawInstitutionName: instNorthern.name,
    category: 'Fee Issues',
    description: 'Fee structure explanation requested by student',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'under_process',
    currentBureau: bureauPGRC._id,
  });

  // Generate initial overlap group
  const group = await checkInstitutionOverlap(instNorthern._id);
  assert.ok(group, 'Initial overlap group created');

  // Dismiss overlap group
  const tokenOfficer = createToken(superAdminUser);
  const res = await request(app)
    .post(`/api/officer/overlaps/${group._id}/resolve`)
    .set('Authorization', `Bearer ${tokenOfficer}`)
    .send({
      status: 'dismissed',
      remarks: 'False positive: distinct student cases with separate scopes.',
    });
  assert.strictEqual(res.statusCode, 200);

  const dismissedGroup = await OverlapGroup.findById(group._id);
  assert.strictEqual(dismissedGroup.status, 'dismissed');
  assert.ok(dismissedGroup.dismissedCasePairs?.length > 0, 'dismissedCasePairs populated');

  // Trigger recalculation on the same institution
  const recheckGroup = await checkInstitutionOverlap(instNorthern._id);
  assert.strictEqual(
    recheckGroup,
    null,
    'Recalculation must respect dismissed pairs and return null'
  );

  // Verify no new open overlap group exists for instNorthern
  const activeGroups = await OverlapGroup.countDocuments({
    institution: instNorthern._id,
    status: 'open',
  });
  assert.strictEqual(activeGroups, 0, 'No repeat open overlap group must be created');
});

test('Test 7: Institution match confirmation updates case and recalculates overlaps', async () => {
  const tokenOfficer = createToken(superAdminUser);

  // Ingest unmatched case with review status
  const reviewCase = await Case.create({
    caseId: await generateCaseId('RB'),
    sourceSystem: 'RB',
    sourceCaseRef: 'MATCH-REV-01',
    rawInstitutionName: 'Apex Inst of Tech & Mgmt Campus',
    category: 'Fee Issues',
    description: 'Uncertain match requiring manual verification',
    receivedDate: new Date(),
    expectedDisposalDate: new Date(Date.now() + 30 * 86400000),
    status: 'pending',
    matchStatus: 'review',
    matchScore: 78,
    currentBureau: bureauRB._id,
  });

  // Officer confirms match to instSouthern
  const res = await request(app)
    .post(`/api/officer/match-review/${reviewCase._id}/confirm`)
    .set('Authorization', `Bearer ${tokenOfficer}`)
    .send({
      institutionId: instSouthern._id.toString(),
      remarks: 'Verified campus identity from AICTE portal records',
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);

  const updatedCase = await Case.findById(reviewCase._id);
  assert.strictEqual(updatedCase.matchStatus, 'matched');
  assert.strictEqual(updatedCase.matchScore, 100);
  assert.strictEqual(updatedCase.institution.toString(), instSouthern._id.toString());
});

test('Test 8: SLA alerts, deduplication, and auto-resolution upon case disposal', async () => {
  // Case overdue by 15 days
  const overdueCase = await Case.create({
    caseId: await generateCaseId('RB'),
    sourceSystem: 'RB',
    sourceCaseRef: 'SLA-OVERDUE-01',
    institution: instSouthern._id,
    rawInstitutionName: instSouthern.name,
    category: 'Fee Issues',
    description: 'Overdue grievance for SLA check testing',
    receivedDate: new Date(Date.now() - 45 * 86400000),
    expectedDisposalDate: new Date(Date.now() - 15 * 86400000),
    status: 'under_process',
    currentBureau: bureauRB._id,
  });

  // Run SLA checks
  const stats1 = await runSlaChecks();
  assert.ok(stats1.checked > 0);

  const alertsCount1 = await Alert.countDocuments({
    case: overdueCase._id,
    resolvedAt: { $exists: false },
  });
  assert.ok(alertsCount1 >= 1, 'Should have at least 1 active overdue/breach alert');

  // Run SLA checks again: should not duplicate alert
  await runSlaChecks();
  const alertsCount2 = await Alert.countDocuments({
    case: overdueCase._id,
    resolvedAt: { $exists: false },
  });
  assert.strictEqual(alertsCount1, alertsCount2, 'Alerts should be deduplicated and not multiplied');

  // Mark case disposed -> should auto-resolve open alerts
  overdueCase.status = 'disposed';
  await overdueCase.save();
  await runSlaChecks();

  const remainingOpenAlerts = await Alert.countDocuments({
    case: overdueCase._id,
    resolvedAt: { $exists: false },
  });
  assert.strictEqual(remainingOpenAlerts, 0, 'Open SLA alerts must be resolved once case is disposed');
});

test('Test 9: Server-side RBAC scoping for regional officers, bureau officers, and senior management', async () => {
  const tokenRegionalSouth = createToken(regionalOfficerSouthern);
  const tokenSeniorMgmt = createToken(seniorMgmtUser);
  const tokenBureauPGRC = createToken(bureauOfficerPGRC);

  // 1. Regional officer (Southern) gets cases: must not see Northern cases
  const resRegional = await request(app)
    .get('/api/officer/cases')
    .set('Authorization', `Bearer ${tokenRegionalSouth}`);

  assert.strictEqual(resRegional.statusCode, 200);
  const regionalCases = resRegional.body.data;
  for (const c of regionalCases) {
    if (c.institution?.region) {
      assert.strictEqual(
        c.institution.region,
        'Southern',
        'Regional officer must only see cases from Southern region'
      );
    }
  }

  // 2. Bureau officer (PGRC) accessing an RB case gets 403 Forbidden
  const rbOnlyCase = await Case.findOne({ currentBureau: bureauRB._id });
  if (rbOnlyCase) {
    const resForbidden = await request(app)
      .get(`/api/bureau/cases/${rbOnlyCase._id}`)
      .set('Authorization', `Bearer ${tokenBureauPGRC}`);
    assert.strictEqual(
      resForbidden.statusCode,
      403,
      'Bureau officer accessing another bureau case must be rejected with 403'
    );
  }

  // 3. Senior management cannot resolve overlap (read-only monitoring access)
  const anyOverlap = await OverlapGroup.findOne();
  if (anyOverlap) {
    const resReadOnly = await request(app)
      .post(`/api/officer/overlaps/${anyOverlap._id}/resolve`)
      .set('Authorization', `Bearer ${tokenSeniorMgmt}`)
      .send({ status: 'coordinated', remarks: 'Attempt by senior mgmt' });
    assert.strictEqual(
      resReadOnly.statusCode,
      403,
      'Senior management mutation must be rejected with 403'
    );
  }
});

test('Test 10: Dashboard statistics and clean tabular CSV export', async () => {
  const tokenOfficer = createToken(superAdminUser);

  // 1. Summary KPI check
  const resSummary = await request(app)
    .get('/api/officer/dashboard/summary')
    .set('Authorization', `Bearer ${tokenOfficer}`);

  assert.strictEqual(resSummary.statusCode, 200);
  assert.ok(resSummary.body.data.totalCases > 0);
  assert.ok(typeof resSummary.body.data.openCases === 'number');
  assert.ok(typeof resSummary.body.data.activeOverlaps === 'number');

  // 2. CSV report export check
  const resCsv = await request(app)
    .get('/api/officer/reports/bureau?format=csv')
    .set('Authorization', `Bearer ${tokenOfficer}`);

  assert.strictEqual(resCsv.statusCode, 200);
  assert.ok(resCsv.headers['content-type'].includes('text/csv'));
  assert.ok(resCsv.text.includes('Bureau Code'));
  assert.ok(resCsv.text.includes('Bureau Name'));
  assert.ok(resCsv.text.includes('Total Cases'));
});

test('Test 11: Import error reporting for invalid dates and rejection of legacy .xls files', async () => {
  const tokenBureau = createToken(bureauOfficerRB);

  // 1. Ingestion service handles invalid date gracefully with structured error report
  const invalidDateRecord = [
    {
      sourceSystem: 'RB',
      sourceCaseRef: 'BAD-DATE-001',
      rawInstitutionName: 'Apex Institute of Technology & Management',
      category: 'Fee Issues',
      description: 'Complaint with non-parseable received date',
      receivedDate: 'not-a-valid-date',
    },
  ];

  const ingestRes = await ingestCases(invalidDateRecord, bureauOfficerRB._id);
  assert.strictEqual(ingestRes.failed, 1);
  assert.ok(ingestRes.errors.length === 1);
  assert.ok(ingestRes.errors[0].reason.includes('Date Validation Error'));

  // 2. Multer file upload rejects legacy .xls file
  const fakeXlsBuffer = Buffer.from('FAKE-EXCEL-BINARY-CONTENT');
  const resXls = await request(app)
    .post('/api/bureau/import/upload')
    .set('Authorization', `Bearer ${tokenBureau}`)
    .attach('file', fakeXlsBuffer, 'legacy_complaints.xls');

  assert.strictEqual(resXls.statusCode, 400);
  assert.strictEqual(resXls.body.success, false);
  assert.ok(
    resXls.body.message.includes('Legacy Excel (.xls) binary files are not supported'),
    'Actionable error message advising .xlsx or .csv must be returned'
  );
});
