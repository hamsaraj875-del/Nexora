import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import {
  Institution,
  Bureau,
  User,
  Case,
  CaseAction,
  OverlapGroup,
  CaseLink,
  SlaRule,
  Alert,
  Notification,
  SyncLog,
  ImportBatch,
} from '../models/index.js';
import { normalizeInstitutionName } from '../services/normalizer.js';
import { checkInstitutionOverlap } from '../services/overlap.js';
import { runSlaChecks } from '../services/sla.js';

const SEED_PASSWORD = 'Password@123';

/**
 * Guard: refuse to run in production mode
 */
export const ensureNotProduction = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Operation refused: Cannot seed database or create test student in production environment (NODE_ENV=production).');
  }
};

/**
 * Helper to create a student user (refuses in production)
 */
export const createStudent = async (studentData = {}) => {
  ensureNotProduction();
  const passwordHash = await bcrypt.hash(studentData.password || SEED_PASSWORD, 10);
  return await User.create({
    name: studentData.name || 'Rahul Sharma (Student Complainant)',
    email: (studentData.email || 'student@example.com').toLowerCase(),
    passwordHash,
    role: 'student',
  });
};

const REGIONS = ['Northern', 'Southern', 'Western', 'Eastern', 'Central'];

const INSTITUTION_NAMES = [
  { name: 'Apex Institute of Technology & Management', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pincode: '560001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Global Engineering College of Pune', city: 'Pune', district: 'Pune', state: 'Maharashtra', pincode: '411001', region: 'Western', type: 'Engineering & Technology' },
  { name: 'National College of Engineering and Research', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', pincode: '600001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Institute of Modern Technology & Science', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Delhi Institute of Advanced Management', city: 'New Delhi', district: 'South Delhi', state: 'Delhi', pincode: '110001', region: 'Northern', type: 'Management' },
  { name: 'Kolkata Institute of Pharmaceutical Technology', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', pincode: '700001', region: 'Eastern', type: 'Pharmacy' },
  { name: 'Bhopal Technical Campus and Research Institute', city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', pincode: '462001', region: 'Central', type: 'Engineering & Technology' },
  { name: 'Jaipur University College of Engineering', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', pincode: '302001', region: 'Northern', type: 'Engineering & Technology' },
  { name: 'Mumbai Institute of Industrial Management', city: 'Mumbai', district: 'Mumbai City', state: 'Maharashtra', pincode: '400001', region: 'Western', type: 'Management' },
  { name: 'Lucknow Institute of Polytechnic and Applied Sciences', city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', region: 'Northern', type: 'Polytechnic' },
  { name: 'Coimbatore College of Engineering & Technology', city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Ahmedabad Institute of Technology', city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', pincode: '380001', region: 'Western', type: 'Engineering & Technology' },
  { name: 'Patna Institute of Engineering and Technology', city: 'Patna', district: 'Patna', state: 'Bihar', pincode: '800001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Indore Institute of Management Studies', city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', pincode: '452001', region: 'Central', type: 'Management' },
  { name: 'Chandigarh Polytechnic Institute', city: 'Chandigarh', district: 'Chandigarh', state: 'Punjab', pincode: '160001', region: 'Northern', type: 'Polytechnic' },
  { name: 'Kochi College of Pharmaceutical Sciences', city: 'Kochi', district: 'Ernakulam', state: 'Kerala', pincode: '682001', region: 'Southern', type: 'Pharmacy' },
  { name: 'Nagpur Institute of Technology & Science', city: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', pincode: '440001', region: 'Western', type: 'Engineering & Technology' },
  { name: 'Bhubaneswar Engineering and Research Institute', city: 'Bhubaneswar', district: 'Khurda', state: 'Odisha', pincode: '751001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Dehradun Institute of Technology & Engineering', city: 'Dehradun', district: 'Dehradun', state: 'Uttarakhand', pincode: '248001', region: 'Northern', type: 'Engineering & Technology' },
  { name: 'Raipur Institute of Technology and Architecture', city: 'Raipur', district: 'Raipur', state: 'Chhattisgarh', pincode: '492001', region: 'Central', type: 'Engineering & Technology' },
  { name: 'Visakhapatnam Technical Institute', city: 'Visakhapatnam', district: 'Visakhapatnam', state: 'Andhra Pradesh', pincode: '530001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Surat College of Engineering and Polytechnic', city: 'Surat', district: 'Surat', state: 'Gujarat', pincode: '395001', region: 'Western', type: 'Polytechnic' },
  { name: 'Ranchi Institute of Technology & Sciences', city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', pincode: '834001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Gwalior Institute of Computer Applications', city: 'Gwalior', district: 'Gwalior', state: 'Madhya Pradesh', pincode: '474001', region: 'Central', type: 'MCA' },
  { name: 'Shimla Institute of Technology and Management', city: 'Shimla', district: 'Shimla', state: 'Himachal Pradesh', pincode: '171001', region: 'Northern', type: 'Management' },
  { name: 'Mysuru College of Engineering and Architecture', city: 'Mysuru', district: 'Mysuru', state: 'Karnataka', pincode: '570001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Nashik Polytechnic and Technical Institute', city: 'Nashik', district: 'Nashik', state: 'Maharashtra', pincode: '422001', region: 'Western', type: 'Polytechnic' },
  { name: 'Guwahati Institute of Science & Technology', city: 'Guwahati', district: 'Kamrup', state: 'Assam', pincode: '781001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Jabalpur Engineering College and Research', city: 'Jabalpur', district: 'Jabalpur', state: 'Madhya Pradesh', pincode: '482001', region: 'Central', type: 'Engineering & Technology' },
  { name: 'Agra College of Management and Applied Technology', city: 'Agra', district: 'Agra', state: 'Uttar Pradesh', pincode: '282001', region: 'Northern', type: 'Management' },
  { name: 'Mangaluru Institute of Technology & Engineering', city: 'Mangaluru', district: 'Dakshina Kannada', state: 'Karnataka', pincode: '575001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Vadodara Institute of Technology and Pharmacy', city: 'Vadodara', district: 'Vadodara', state: 'Gujarat', pincode: '390001', region: 'Western', type: 'Pharmacy' },
  { name: 'Cuttack Institute of Technical Studies', city: 'Cuttack', district: 'Cuttack', state: 'Odisha', pincode: '753001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Ujjain Institute of Management & Science', city: 'Ujjain', district: 'Ujjain', state: 'Madhya Pradesh', pincode: '456001', region: 'Central', type: 'Management' },
  { name: 'Varanasi Institute of Engineering Technology', city: 'Varanasi', district: 'Varanasi', state: 'Uttar Pradesh', pincode: '221001', region: 'Northern', type: 'Engineering & Technology' },
  { name: 'Madurai College of Engineering & Technology', city: 'Madurai', district: 'Madurai', state: 'Tamil Nadu', pincode: '625001', region: 'Southern', type: 'Engineering & Technology' },
  { name: 'Rajkot Polytechnic Institute', city: 'Rajkot', district: 'Rajkot', state: 'Gujarat', pincode: '360001', region: 'Western', type: 'Polytechnic' },
  { name: 'Siliguri Institute of Technology', city: 'Siliguri', district: 'Darjeeling', state: 'West Bengal', pincode: '734001', region: 'Eastern', type: 'Engineering & Technology' },
  { name: 'Kanpur Institute of Management Studies', city: 'Kanpur', district: 'Kanpur Nagar', state: 'Uttar Pradesh', pincode: '208001', region: 'Northern', type: 'Management' },
  { name: 'Thiruvananthapuram Engineering College', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', state: 'Kerala', pincode: '695001', region: 'Southern', type: 'Engineering & Technology' },
];

const CATEGORIES = [
  'Fee Issues',
  'Faculty Shortage',
  'Fake Documents',
  'Infrastructure',
  'Admission Irregularities',
  'Harassment',
];

const COMPLAINT_DESCRIPTION_TEMPLATES = {
  'Fee Issues': [
    'The complainant reports that fees were collected beyond the approved schedule and requests verification of the institution fee records.',
    'A grievance has been raised regarding delayed fee refunds and the absence of a clear reimbursement timeline.',
    'The complainant questions additional charges collected during the academic year and seeks an official fee breakdown.',
  ],

  'Faculty Shortage': [
    'Students report that several subjects have remained without permanent faculty, affecting regular classroom instruction.',
    'The complaint highlights vacant teaching positions and requests verification of the faculty strength against approved requirements.',
    'A grievance has been submitted regarding frequent cancellation of lectures due to insufficient teaching staff.',
  ],

  'Fake Documents': [
    'The complaint raises concerns about the authenticity of documents submitted to the institution and requests regulatory verification.',
    'An allegation has been received regarding discrepancies in institutional approval and compliance records.',
    'The complainant requests an inquiry into potentially inconsistent certificates and supporting institutional documents.',
  ],

  'Infrastructure': [
    'Students report inadequate laboratory facilities and request inspection of the equipment available for practical sessions.',
    'The complaint identifies concerns about classroom capacity, building maintenance and the availability of essential facilities.',
    'A grievance has been raised regarding laboratory safety and insufficient infrastructure for the approved intake.',
  ],

  'Admission Irregularities': [
    'The complainant alleges discrepancies in the admission process and requests verification of admission records.',
    'Concerns have been raised regarding admissions beyond the approved intake capacity.',
    'The complaint requests an inquiry into admission procedures and compliance with applicable eligibility requirements.',
  ],

  'Harassment': [
    'A confidential grievance has been submitted alleging inappropriate conduct towards a student and requesting an impartial inquiry.',
    'The complainant raises concerns about repeated intimidation and requests examination of the institution grievance mechanism.',
    'A complaint has been received regarding alleged misconduct on campus and the handling of the reported incident.',
  ],
};

const generateComplaintDescription = (category, institutionName, index) => {
  const templates = COMPLAINT_DESCRIPTION_TEMPLATES[category];

  if (!templates) {
    return `A complaint concerning ${category.toLowerCase()} has been submitted for ${institutionName}. Regulatory review has been requested.`;
  }

  const description = templates[index % templates.length];

  return `${description} The matter relates to ${institutionName}.`;
};


export const seedDatabase = async (shouldDisconnect = true) => {
  ensureNotProduction();
  console.log('[Seed] Starting database seed...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    Institution.deleteMany({}),
    Bureau.deleteMany({}),
    User.deleteMany({}),
    Case.deleteMany({}),
    CaseAction.deleteMany({}),
    OverlapGroup.deleteMany({}),
    CaseLink.deleteMany({}),
    SlaRule.deleteMany({}),
    Alert.deleteMany({}),
    Notification.deleteMany({}),
    SyncLog.deleteMany({}),
    ImportBatch.deleteMany({}),
  ]);
  console.log('[Seed] Cleared old collections.');

  // 1. Create 6 Bureaus/Cells
  const bureausData = [
    { code: 'RB', name: 'Regulatory Bureau', type: 'bureau' },
    { code: 'PGRC', name: 'Public Grievance Redressal Cell', type: 'cell' },
    { code: 'APPROVAL', name: 'Approval Bureau', type: 'bureau' },
    { code: 'ACADEMIC', name: 'Academic Bureau', type: 'bureau' },
    { code: 'RO_NORTH', name: 'Northern Regional Office', type: 'regional_office', region: 'Northern' },
    { code: 'RO_SOUTH', name: 'Southern Regional Office', type: 'regional_office', region: 'Southern' },
  ];
  const bureaus = await Bureau.insertMany(bureausData);
  const bureauMap = new Map(bureaus.map((b) => [b.code, b]));
  console.log(`[Seed] Created ${bureaus.length} Bureaus/Cells.`);

  // 2. Create Users for each role
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const usersData = [
    {
      name: 'Dr. Ramesh Kumar (Super Admin)',
      email: 'admin@aicte.gov.in',
      passwordHash,
      role: 'super_admin',
    },
    {
      name: 'Prof. Anita Sharma (Senior Management)',
      email: 'director@aicte.gov.in',
      passwordHash,
      role: 'senior_management',
    },
    {
      name: 'Vikram Malhotra (RB Officer)',
      email: 'officer.rb@aicte.gov.in',
      passwordHash,
      role: 'bureau_officer',
      bureau: bureauMap.get('RB')._id,
    },
    {
      name: 'Dr. K. Srinivas (Approval Bureau Officer)',
      email: 'officer.approval@aicte.gov.in',
      passwordHash,
      role: 'bureau_officer',
      bureau: bureauMap.get('APPROVAL')._id,
    },
    {
      name: 'Prof. M. K. Roy (Academic Bureau Officer)',
      email: 'officer.academic@aicte.gov.in',
      passwordHash,
      role: 'bureau_officer',
      bureau: bureauMap.get('ACADEMIC')._id,
    },
    {
      name: 'Sunita Rao (PGRC Officer)',
      email: 'officer.pgrc@aicte.gov.in',
      passwordHash,
      role: 'bureau_officer',
      bureau: bureauMap.get('PGRC')._id,
    },
    {
      name: 'Rajesh Verma (RO Northern)',
      email: 'ro.north@aicte.gov.in',
      passwordHash,
      role: 'regional_officer',
      region: 'Northern',
      bureau: bureauMap.get('RO_NORTH')._id,
    },
    {
      name: 'Pooja Nair (Data Operator)',
      email: 'operator@aicte.gov.in',
      passwordHash,
      role: 'data_operator',
      bureau: bureauMap.get('RB')._id,
    },
    {
      name: 'Rahul Sharma (Student Complainant)',
      email: 'student@example.com',
      passwordHash,
      role: 'student',
    },
  ];
  const users = await User.insertMany(usersData);
  const userMap = new Map(users.map((u) => [u.role, u]));
  console.log(`[Seed] Created ${users.length} Users (Password: ${SEED_PASSWORD}).`);

  // 3. Create SLA Rules
  const slaRulesData = [
    { category: 'Fee Issues', daysToDispose: 30, reminderAfterDays: 7, dueSoonDays: 3, escalateAfterDaysOverdue: 7 },
    { category: 'Faculty Shortage', daysToDispose: 45, reminderAfterDays: 10, dueSoonDays: 5, escalateAfterDaysOverdue: 7 },
    { category: 'Fake Documents', daysToDispose: 20, reminderAfterDays: 5, dueSoonDays: 3, escalateAfterDaysOverdue: 5 },
    { category: 'Infrastructure', daysToDispose: 30, reminderAfterDays: 7, dueSoonDays: 3, escalateAfterDaysOverdue: 7 },
    { category: 'Admission Irregularities', daysToDispose: 25, reminderAfterDays: 6, dueSoonDays: 3, escalateAfterDaysOverdue: 7 },
    { category: 'Harassment', daysToDispose: 15, reminderAfterDays: 3, dueSoonDays: 2, escalateAfterDaysOverdue: 4 },
  ];
  await SlaRule.insertMany(slaRulesData);
  console.log(`[Seed] Created ${slaRulesData.length} SLA rules.`);

  // 4. Create 40 Institutions
  const institutionsData = INSTITUTION_NAMES.map((inst, idx) => ({
    ...inst,
    aictePermanentId: `1-${10000000 + idx * 739}`,
    normalizedName: normalizeInstitutionName(inst.name),
  }));
  const institutions = await Institution.insertMany(institutionsData);
  console.log(`[Seed] Created ${institutions.length} Institutions across 5 regions.`);

  // 5. Generate Cases (~150 cases total)
  const now = new Date();
  const casesToInsert = [];
  const rbId = bureauMap.get('RB')._id;
  const pgrcId = bureauMap.get('PGRC')._id;
  const approvalId = bureauMap.get('APPROVAL')._id;
  const academicId = bureauMap.get('ACADEMIC')._id;
  const roNorthId = bureauMap.get('RO_NORTH')._id;
  const roSouthId = bureauMap.get('RO_SOUTH')._id;

  const bureauPool = [rbId, pgrcId, approvalId, academicId, roNorthId, roSouthId];
  const officerPool = [userMap.get('bureau_officer'), userMap.get('super_admin')];

  // 0. Specific Demo Cases
  // (a) Unassigned Student Complaint (enters officer assignment queue & match review)
  casesToInsert.push({
    caseId: 'AICTE-STU-2026-00001',
    sourceSystem: 'STUDENT_PORTAL',
    sourceCaseRef: 'STU-REF-001',
    institution: institutions[0]._id,
    rawInstitutionName: institutions[0].name,
    rawCity: institutions[0].city,
    rawState: institutions[0].state,
    rawPincode: institutions[0].pincode,
    matchStatus: 'matched',
    matchScore: 100,
    category: 'Fee Issues',
    description: 'Institution is demanding unapproved capitation fees and refusing to release original marksheets upon withdrawal.',
    complainantType: 'Student',
    receivedDate: new Date(now.getTime() - 2 * 86400000),
    status: 'pending',
    currentBureau: undefined, // Unassigned!
    submittedBy: userMap.get('student')._id,
    lastActionText: 'Complaint registered via Student Portal',
    lastActionDate: new Date(now.getTime() - 2 * 86400000),
    nextActionText: 'Pending initial bureau allocation by Officer',
    expectedDisposalDate: new Date(now.getTime() + 28 * 86400000),
  });

  // (b) Needs Info Case (student clarification requested)
  casesToInsert.push({
    caseId: 'AICTE-RB-2026-00999',
    sourceSystem: 'STUDENT_PORTAL',
    sourceCaseRef: 'STU-REF-002',
    institution: institutions[1]._id,
    rawInstitutionName: institutions[1].name,
    rawCity: institutions[1].city,
    rawState: institutions[1].state,
    rawPincode: institutions[1].pincode,
    matchStatus: 'matched',
    matchScore: 100,
    category: 'Faculty Shortage',
    description: 'Severe shortage of qualified professors in mechanical engineering laboratory sessions.',
    complainantType: 'Student',
    receivedDate: new Date(now.getTime() - 8 * 86400000),
    status: 'needs_info',
    currentBureau: rbId,
    submittedBy: userMap.get('student')._id,
    assignedOfficer: userMap.get('bureau_officer')._id,
    lastActionText: 'Information requested: Please upload semester fee receipt and schedule of cancelled lectures',
    lastActionDate: new Date(now.getTime() - 1 * 86400000),
    nextActionText: 'Awaiting student clarification response',
    expectedDisposalDate: new Date(now.getTime() + 22 * 86400000),
  });

  // A. 12 Deliberate Overlaps across institutions[0..11]
  // Overlap means Institution has active cases in at least two different bureaus!
  for (let i = 0; i < 12; i++) {
    const inst = institutions[i];

    // Case 1 in Regulatory Bureau (Regulatory penal matter)
    const recDate1 = new Date(now.getTime() - (15 + i) * 86400000);
    const expDate1 = new Date(recDate1.getTime() + 30 * 86400000);
    casesToInsert.push({
      caseId: `AICTE-RB-2026-${String(1000 + i * 2).padStart(5, '0')}`,
      sourceSystem: 'RB',
      sourceCaseRef: `RB-REG-2026-${500 + i}`,
      institution: inst._id,
      rawInstitutionName: inst.name,
      rawCity: inst.city,
      rawState: inst.state,
      rawPincode: inst.pincode,
      matchStatus: 'matched',
      matchScore: 100,
      category: i % 2 === 0 ? 'Faculty Shortage' : 'Fake Documents',
      description: `Formal regulatory enquiry against ${inst.name}: severe non-compliance in staff cadre and missing approval records. Inspection initiated.`,
      complainantType: 'Staff Association',
      receivedDate: recDate1,
      status: 'under_process',
      currentBureau: rbId,
      assignedOfficer: officerPool[0]._id,
      lastActionText: 'Show cause notice dispatched to institute chairman',
      lastActionDate: new Date(recDate1.getTime() + 3 * 86400000),
      nextActionText: 'Await written reply within 14 days',
      expectedDisposalDate: expDate1,
    });

    // Case 2 in PGRC (Grievance matter) for same institution!
    const recDate2 = new Date(now.getTime() - (10 + i) * 86400000);
    const expDate2 = new Date(recDate2.getTime() + 25 * 86400000);
    casesToInsert.push({
      caseId: `AICTE-PGRC-2026-${String(1001 + i * 2).padStart(5, '0')}`,
      sourceSystem: 'PGRC',
      sourceCaseRef: `PGRC-GRV-2026-${800 + i}`,
      institution: inst._id,
      rawInstitutionName: `${inst.name} Campus`,
      rawCity: inst.city,
      rawState: inst.state,
      rawPincode: inst.pincode,
      matchStatus: 'matched',
      matchScore: 95,
      category: i % 2 === 0 ? 'Fee Issues' : 'Harassment',
      description: `Student petition regarding illegal collection of development fees and lack of functioning grievances cell at ${inst.name}.`,
      complainantType: 'Student Union',
      receivedDate: recDate2,
      status: 'pending',
      currentBureau: pgrcId,
      assignedOfficer: officerPool[0]._id,
      lastActionText: 'Notice issued to college principal for comments',
      lastActionDate: new Date(recDate2.getTime() + 2 * 86400000),
      nextActionText: 'Schedule virtual hearing with complainant',
      expectedDisposalDate: expDate2,
    });
  }

  // B. 15 Name Variant cases (some with no permanent ID, fuzzy spelling variants) to test matcher & review queue
  const nameVariants = [
    { rawName: 'Apex Inst of Tech and Mgmt', city: 'Bengaluru', targetIdx: 0 },
    { rawName: 'Global Engg Coll Pune', city: 'Pune', targetIdx: 1 },
    { rawName: 'Natl College of Engg', city: 'Chennai', targetIdx: 2 },
    { rawName: 'Inst of Modern Tech & Sci', city: 'Hyderabad', targetIdx: 3 },
    { rawName: 'Delhi Inst of Adv Management', city: 'New Delhi', targetIdx: 4 },
    { rawName: 'Kolkata Inst of Pharma Tech', city: 'Kolkata', targetIdx: 5 },
    { rawName: 'Bhopal Tech Campus & Research Inst', city: 'Bhopal', targetIdx: 6 },
    { rawName: 'Jaipur Univ Coll of Engg', city: 'Jaipur', targetIdx: 7 },
    { rawName: 'Mumbai Inst of Industrial Mgmt', city: 'Mumbai', targetIdx: 8 },
    { rawName: 'Lucknow Poly & Applied Sci', city: 'Lucknow', targetIdx: 9 },
    { rawName: 'Coimbatore Engg & Tech Coll', city: 'Coimbatore', targetIdx: 10 },
    { rawName: 'Ahmedabad Tech Inst', city: 'Ahmedabad', targetIdx: 11 },
    { rawName: 'Patna Inst of Engg & Tech', city: 'Patna', targetIdx: 12 },
    { rawName: 'Unknown Poly Institute', city: 'Nowhere', targetIdx: -1 }, // Unmatched
    { rawName: 'City College of Management Science', city: 'Unspecified', targetIdx: -1 }, // Review queue
  ];

  nameVariants.forEach((v, idx) => {
    const isTargetMatched = v.targetIdx >= 0;
    const targetInst = isTargetMatched ? institutions[v.targetIdx] : null;
    const recDate = new Date(now.getTime() - (5 + idx) * 86400000);

    casesToInsert.push({
      caseId: `AICTE-VAR-2026-${String(2000 + idx).padStart(5, '0')}`,
      sourceSystem: idx % 2 === 0 ? 'RB' : 'PGRC',
      sourceCaseRef: `VARIANT-${300 + idx}`,
      institution: isTargetMatched ? targetInst._id : undefined,
      rawInstitutionName: v.rawName,
      rawCity: v.city,
      rawState: targetInst ? targetInst.state : 'Unknown',
      rawPincode: targetInst ? targetInst.pincode : '000000',
      matchStatus: isTargetMatched ? 'matched' : (idx === 14 ? 'review' : 'unmatched'),
      matchScore: isTargetMatched ? 88 : (idx === 14 ? 78 : 45),
      category: CATEGORIES[idx % CATEGORIES.length],
      description: `Grievance registered under alternate institution name spelling: ${v.rawName}. Issue regarding syllabus and exam delay.`,
      complainantType: 'Parent',
      receivedDate: recDate,
      status: 'pending',
      currentBureau: bureauPool[idx % bureauPool.length],
      assignedOfficer: officerPool[0]._id,
      lastActionText: 'Initial verification of college credentials',
      lastActionDate: recDate,
      nextActionText: 'Match confirmation required from data operator',
      expectedDisposalDate: new Date(recDate.getTime() + 20 * 86400000),
    });
  });

  // C. 10 Cases past expected disposal date (SLA Breach)
  for (let i = 0; i < 10; i++) {
    const inst = institutions[12 + i];
    const recDate = new Date(now.getTime() - (50 + i * 2) * 86400000); // Received 50+ days ago
    const expDate = new Date(now.getTime() - (10 + i) * 86400000); // Expired 10+ days ago

    casesToInsert.push({
      caseId: `AICTE-BREACH-2026-${String(3000 + i).padStart(5, '0')}`,
      sourceSystem: 'APPROVAL',
      sourceCaseRef: `APP-BREACH-${400 + i}`,
      institution: inst._id,
      rawInstitutionName: inst.name,
      rawCity: inst.city,
      rawState: inst.state,
      rawPincode: inst.pincode,
      matchStatus: 'matched',
      matchScore: 100,
      category: 'Admission Irregularities',
      description: `Critical overdue case: Institutional intake violations and unsanctioned seat expansions beyond approved intake capacity.`,
      complainantType: 'Student',
      receivedDate: recDate,
      status: i % 2 === 0 ? 'escalated' : 'under_process',
      currentBureau: approvalId,
      assignedOfficer: officerPool[0]._id,
      lastActionText: 'Reminder issued to regional scrutinising committee',
      lastActionDate: new Date(now.getTime() - 12 * 86400000),
      nextActionText: 'Immediate hearing before Competent Authority',
      expectedDisposalDate: expDate,
    });
  }

  // D. 10 Cases Due Within 3 Days (Due Soon)
  for (let i = 0; i < 10; i++) {
    const inst = institutions[22 + i];
    const recDate = new Date(now.getTime() - 25 * 86400000);
    const expDate = new Date(now.getTime() + (1 + (i % 3)) * 86400000); // 1 to 3 days from now!

    casesToInsert.push({
      caseId: `AICTE-DUESOON-2026-${String(4000 + i).padStart(5, '0')}`,
      sourceSystem: 'ACADEMIC',
      sourceCaseRef: `ACAD-DUE-${500 + i}`,
      institution: inst._id,
      rawInstitutionName: inst.name,
      rawCity: inst.city,
      rawState: inst.state,
      rawPincode: inst.pincode,
      matchStatus: 'matched',
      matchScore: 100,
      category: 'Fee Issues',
      description: `Refund application submitted by withdrawn candidates awaiting clearance by institute accounts committee.`,
      complainantType: 'Student',
      receivedDate: recDate,
      status: 'under_process',
      currentBureau: academicId,
      assignedOfficer: officerPool[0]._id,
      lastActionText: 'Accounts officer verification underway',
      lastActionDate: new Date(now.getTime() - 2 * 86400000),
      nextActionText: 'Final disposal order generation',
      expectedDisposalDate: expDate,
    });
  }

  // E. Remaining ~95 general cases distributed across bureaus, institutions, and statuses (including disposed)
  const remainingCount = 95;
  for (let i = 0; i < remainingCount; i++) {
    const inst = institutions[i % institutions.length];
    const daysAgo = (i % 60) + 1;
    const recDate = new Date(now.getTime() - daysAgo * 86400000);
    const isDisposed = i % 4 === 0;
    const status = isDisposed ? 'disposed' : (i % 3 === 0 ? 'under_process' : 'pending');
    const expDate = new Date(recDate.getTime() + 30 * 86400000);
    const disposedDate = isDisposed ? new Date(recDate.getTime() + 14 * 86400000) : undefined;

    casesToInsert.push({
      caseId: `AICTE-GEN-2026-${String(5000 + i).padStart(5, '0')}`,
      sourceSystem: ['RB', 'PGRC', 'APPROVAL', 'ACADEMIC', 'RO_NORTH', 'RO_SOUTH'][i % 6],
      sourceCaseRef: `REF-${1000 + i}`,
      institution: inst._id,
      rawInstitutionName: inst.name,
      rawCity: inst.city,
      rawState: inst.state,
      rawPincode: inst.pincode,
      matchStatus: 'matched',
      matchScore: 100,
      category: CATEGORIES[i % CATEGORIES.length],
      description: generateComplaintDescription(CATEGORIES[i % CATEGORIES.length], inst.name, i),
      complainantType: ['Student', 'Faculty', 'Parent', 'Anonymous'][i % 4],
      receivedDate: recDate,
      status,
      currentBureau: bureauPool[i % bureauPool.length],
      assignedOfficer: officerPool[i % officerPool.length]._id,
      lastActionText: isDisposed ? 'Case resolved and formal disposal order issued.' : 'Document inspection in progress',
      lastActionDate: new Date(recDate.getTime() + 5 * 86400000),
      nextActionText: isDisposed ? 'Archived in registry' : 'Awaiting compliance report',
      expectedDisposalDate: expDate,
      disposedDate,
    });
  }

  const insertedCases = await Case.insertMany(casesToInsert);
  console.log(`[Seed] Created ${insertedCases.length} total Cases.`);

  // 6. Create CaseAction audit logs for all cases
  const actionsData = [];
  insertedCases.forEach((c) => {
    actionsData.push({
      case: c._id,
      actionType: 'received',
      performedBy: userMap.get('super_admin')._id,
      remarks: `Initial registration in AICTE Integrated Complaint System from ${c.sourceSystem}.`,
      timestamp: c.receivedDate,
    });

    if (c.status === 'disposed') {
      actionsData.push({
        case: c._id,
        actionType: 'disposed',
        performedBy: userMap.get('bureau_officer')._id,
        remarks: 'All inquiries completed. Full refund/compliance secured. Case formally disposed.',
        timestamp: c.disposedDate || new Date(),
      });
    }

    if (c.status === 'needs_info') {
      actionsData.push({
        case: c._id,
        actionType: 'info_requested',
        performedBy: userMap.get('bureau_officer')._id,
        remarks: 'Please upload semester fee receipt and schedule of cancelled lectures.',
        isPublic: true,
        timestamp: new Date(c.receivedDate.getTime() + 2 * 86400000),
      });
    }
  });
  await CaseAction.insertMany(actionsData);
  console.log(`[Seed] Created ${actionsData.length} CaseAction audit trail records.`);

  // 7. Run Overlap Detection across all 40 institutions
  console.log('[Seed] Evaluating overlap detection across all institutions...');
  for (const inst of institutions) {
    await checkInstitutionOverlap(inst._id);
  }
  const overlapCount = await OverlapGroup.countDocuments({ status: 'open' });
  console.log(`[Seed] Open OverlapGroups formed: ${overlapCount}.`);

  // 8. Run SLA checks to trigger due-soon, breach, and escalation alerts
  console.log('[Seed] Running initial SLA evaluations...');
  const slaStats = await runSlaChecks();
  console.log('[Seed] SLA evaluations complete:', slaStats);

  // 9. Create a Sample SyncLog & ImportBatch
  await SyncLog.create({
    sourceSystem: 'SEED_INITIALIZER',
    startedAt: new Date(now.getTime() - 60000),
    finishedAt: new Date(),
    recordsFetched: insertedCases.length,
    recordsCreated: insertedCases.length,
    recordsUpdated: 0,
    errors: [],
  });

  const alertCount = await Alert.countDocuments();
  const notifCount = await Notification.countDocuments();

  console.log('========================================================');
  console.log('  SEEDING COMPLETED SUCCESSFULLY!                      ');
  console.log(`  Institutions: ${institutions.length}                 `);
  console.log(`  Bureaus:      ${bureaus.length}                      `);
  console.log(`  Users:        ${users.length}                        `);
  console.log(`  Cases:        ${insertedCases.length}                `);
  console.log(`  Overlaps:     ${overlapCount} active                 `);
  console.log(`  Alerts:       ${alertCount} created                  `);
  console.log(`  Notifications:${notifCount} generated                `);
  console.log('========================================================');

  if (shouldDisconnect) {
    await disconnectDB();
  }
};

if (process.argv[1]?.endsWith('seedData.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
