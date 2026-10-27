import { mockRbCases } from '../../routes/mockRoutes.js';

const mapRbCase = (raw) => ({
  sourceSystem: 'RB',
  sourceCaseRef: raw.complaint_no || raw.ref_id,
  aictePermanentId: raw.aicte_id || raw.permanent_id,
  rawInstitutionName: raw.institute_title || raw.college_name,
  rawAddress: raw.address,
  rawCity: raw.campus_city || raw.city,
  rawState: raw.state,
  rawPincode: raw.pincode,
  category: raw.regulatory_category || raw.category || 'Regulatory Compliance',
  description: raw.matter_summary || raw.details || raw.description,
  complainantType: raw.filed_by || 'Complainant',
  receivedDate: raw.registration_dt || raw.date,
  status: raw.complaint_status || 'pending',
  lastActionText: raw.recent_action || 'Registered in Regulatory Bureau',
  isSimulated: Boolean(raw.isSimulated ?? true),
});

export const fetchRbCases = async (baseUrl = `http://localhost:${process.env.PORT || 5000}`) => {
  const targetUrl = process.env.RB_API_URL || `${baseUrl}/mock/rb/cases`;
  const isSimulated = !process.env.RB_API_URL;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        ...(process.env.RB_API_KEY ? { 'Authorization': `Bearer ${process.env.RB_API_KEY}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Regulatory Bureau Connector HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const cases = data.cases || [];
    return cases.map((c) => mapRbCase({ ...c, isSimulated }));
  } catch (error) {
    if (isSimulated && mockRbCases.length > 0) {
      console.warn(`[RB Connector] Using simulated mock demo data (endpoint ${targetUrl} unavailable: ${error.message})`);
      return mockRbCases.map((c) => mapRbCase({ ...c, isSimulated: true }));
    }
    throw new Error(`Regulatory Bureau connector synchronization failed: ${error.message}`);
  }
};
