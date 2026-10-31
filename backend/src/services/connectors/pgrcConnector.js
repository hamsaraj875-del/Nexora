import { mockPgrcCases } from '../../routes/mockRoutes.js';

const mapPgrcCase = (raw) => ({
  sourceSystem: 'PGRC',
  sourceCaseRef: raw.grievance_id || raw.ticket_id,
  aictePermanentId: raw.institute_code || raw.aicte_pid,
  rawInstitutionName: raw.institute_name || raw.college,
  rawAddress: raw.address_line,
  rawCity: raw.place || raw.city,
  rawState: raw.state_name || raw.state,
  rawPincode: raw.pin,
  category: raw.grievance_type || raw.category || 'Grievance Redressal',
  description: raw.narrative || raw.issue_description || raw.complaint,
  complainantType: raw.complainant_category || 'Complainant',
  receivedDate: raw.submission_date || raw.created_on,
  status: raw.progress_state || 'pending',
  lastActionText: raw.status_note || 'Logged in Public Grievance portal',
  isSimulated: Boolean(raw.isSimulated ?? true),
});

export const fetchPgrcCases = async (baseUrl = `http://localhost:${process.env.PORT || 5000}`) => {
  const targetUrl = process.env.PGRC_API_URL || `${baseUrl}/mock/pgrc/cases`;
  const isSimulated = !process.env.PGRC_API_URL;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        ...(process.env.PGRC_API_KEY ? { 'Authorization': `Bearer ${process.env.PGRC_API_KEY}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`PGRC Connector HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const grievances = data.grievances || [];
    return grievances.map((c) => mapPgrcCase({ ...c, isSimulated }));
  } catch (error) {
    if (isSimulated && mockPgrcCases.length > 0) {
      console.warn(`[PGRC Connector] Using simulated mock demo data (endpoint ${targetUrl} unavailable: ${error.message})`);
      return mockPgrcCases.map((c) => mapPgrcCase({ ...c, isSimulated: true }));
    }
    throw new Error(`Public Grievance Redressal Cell connector synchronization failed: ${error.message}`);
  }
};
