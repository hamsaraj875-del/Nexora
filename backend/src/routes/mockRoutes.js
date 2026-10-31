import { Router } from 'express';

const router = Router();

export const mockRbCases = [
    {
      complaint_no: 'RB-2026-00891',
      aicte_id: '1-45678912',
      institute_title: 'Apex Institute of Technology & Management',
      campus_city: 'Bengaluru',
      state: 'Karnataka',
      regulatory_category: 'Faculty Shortage',
      matter_summary: 'Severe shortage of qualified professors and PhD guides in CSE & AI departments violating faculty-student ratio 1:20.',
      filed_by: 'Faculty Association',
      registration_dt: new Date(Date.now() - 10 * 86400000).toISOString(),
      complaint_status: 'under_process',
      recent_action: 'Show cause notice dispatched to management',
    },
    {
      complaint_no: 'RB-2026-00914',
      aicte_id: '1-99887766',
      institute_title: 'Global Engg College of Pune',
      campus_city: 'Pune',
      state: 'Maharashtra',
      regulatory_category: 'Fake Documents',
      matter_summary: 'Allegations of submitted forged land conversion certificates and fraudulent land registry documents during extension of approval.',
      filed_by: 'Local Authority',
      registration_dt: new Date(Date.now() - 35 * 86400000).toISOString(),
      complaint_status: 'pending',
      recent_action: 'State verification panel constituted',
    },
    {
      complaint_no: 'RB-2026-00945',
      // Name variant without permanent ID
      institute_title: 'Inst of Modern Tech & Science',
      campus_city: 'Hyderabad',
      state: 'Telangana',
      regulatory_category: 'Infrastructure',
      matter_summary: 'Inadequate laboratory equipment and non-functional safety equipment in Chemical & Mechanical workshops.',
      filed_by: 'Student Council',
      registration_dt: new Date(Date.now() - 5 * 86400000).toISOString(),
      complaint_status: 'pending',
      recent_action: 'Inspection team scheduled',
    },
    {
      complaint_no: 'RB-2026-01002',
      aicte_id: '1-22334455',
      institute_title: 'National College of Engg and Research',
      campus_city: 'Chennai',
      state: 'Tamil Nadu',
      regulatory_category: 'Admission Irregularities',
      matter_summary: 'Collecting unapproved capitation fees and arbitrary management quota surcharges above state fee committee limits.',
      filed_by: 'Parent Association',
      registration_dt: new Date(Date.now() - 40 * 86400000).toISOString(),
      complaint_status: 'escalated',
      recent_action: 'Withdrawal of approval proceedings initiated',
    },
  ];

// Mock Regulatory Bureau API (Simulated Demonstration Endpoint)
router.get('/rb/cases', (req, res) => {
  res.json({
    success: true,
    isSimulated: true,
    source: 'SIMULATED_MOCK_REGULATORY_BUREAU',
    notice: 'Demonstration synthetic data for SIH evaluation. Set RB_API_URL and RB_API_KEY for live AICTE RB endpoint.',
    count: mockRbCases.length,
    cases: mockRbCases,
  });
});

export const mockPgrcCases = [
    {
      grievance_id: 'PGRC-GRV-2026-4412',
      institute_code: '1-45678912', // Deliberate overlap with Apex Inst!
      institute_name: 'Apex Inst of Tech & Mgmt',
      place: 'Bengaluru',
      state_name: 'Karnataka',
      grievance_type: 'Fee Issues',
      narrative: 'Students being forced to pay non-refundable lab charges of Rs 45,000 without AICTE or state committee clearance.',
      complainant_category: 'Student',
      submission_date: new Date(Date.now() - 8 * 86400000).toISOString(),
      progress_state: 'in_progress',
      status_note: 'Explanation demanded from college finance office',
    },
    {
      grievance_id: 'PGRC-GRV-2026-4428',
      institute_code: '1-99887766', // Deliberate overlap with Global Engg Pune!
      institute_name: 'Global Engineering College',
      place: 'Pune',
      state_name: 'Maharashtra',
      grievance_type: 'Harassment',
      narrative: 'Non-functioning Anti-Ragging committee and victim intimidation inside senior student hostels.',
      complainant_category: 'First Year Student',
      submission_date: new Date(Date.now() - 12 * 86400000).toISOString(),
      progress_state: 'open',
      status_note: 'Internal ombudsman notice served',
    },
    {
      grievance_id: 'PGRC-GRV-2026-4475',
      institute_name: 'Univ Institute of Pharmaceutical Sciences',
      place: 'Jaipur',
      state_name: 'Rajasthan',
      grievance_type: 'Admission Irregularities',
      narrative: 'Refusal to refund admission fee following withdrawal of admission before national cutoff deadline.',
      complainant_category: 'Parent',
      submission_date: new Date(Date.now() - 4 * 86400000).toISOString(),
      progress_state: 'pending',
      status_note: 'Pending verification with admissions cell',
    },
  ];

// Mock Public Grievance Redressal Cell API (Simulated Demonstration Endpoint)
router.get('/pgrc/cases', (req, res) => {
  res.json({
    success: true,
    isSimulated: true,
    source: 'SIMULATED_MOCK_PGRC',
    notice: 'Demonstration synthetic data for SIH evaluation. Set PGRC_API_URL and PGRC_API_KEY for live AICTE PGRC endpoint.',
    count: mockPgrcCases.length,
    grievances: mockPgrcCases,
  });
});

export default router;
