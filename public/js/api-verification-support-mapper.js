const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES = new Set(["government_id","proof_of_address","business_registration","business_address","ownership_proof","other_supporting"]);
export const isBackendUuid = (value) => UUID.test(String(value || ""));

export function toVerificationSubmission({ subjectType, propertyId, documents } = {}) {
  if (!["identity","business","property_ownership"].includes(subjectType) || !Array.isArray(documents) || !documents.length || documents.length > 6) throw new TypeError("Invalid verification submission.");
  if (subjectType === "property_ownership" ? !isBackendUuid(propertyId) : propertyId !== undefined && propertyId !== null && propertyId !== "") throw new TypeError("Invalid property reference for verification.");
  const clean = documents.map((item) => {
    if (!isBackendUuid(item?.uploadId) || !DOCUMENT_TYPES.has(item.documentType)) throw new TypeError("Invalid verification document.");
    return { uploadId: item.uploadId, documentType: item.documentType };
  });
  if (new Set(clean.map(x => x.uploadId)).size !== clean.length) throw new TypeError("A document upload can only be used once.");
  const allowed = subjectType === "identity" ? new Set(["government_id","proof_of_address","other_supporting"])
    : subjectType === "business" ? new Set(["business_registration","business_address","other_supporting"])
      : new Set(["ownership_proof","other_supporting"]);
  if (clean.some(x => !allowed.has(x.documentType))) throw new TypeError("Document type does not match this verification request.");
  const types = new Set(clean.map(x => x.documentType));
  if (subjectType === "identity" && (!types.has("government_id") || !types.has("proof_of_address"))) throw new TypeError("Identity verification requires an ID and proof of address.");
  if (subjectType === "business" && !types.has("business_registration")) throw new TypeError("Business verification requires registration evidence.");
  if (subjectType === "property_ownership" && !types.has("ownership_proof")) throw new TypeError("Property ownership verification requires ownership evidence.");
  return { subjectType, ...(subjectType === "property_ownership" ? { propertyId } : {}), documents: clean };
}

export function toSupportCasePayload({ caseType, subject, description, propertyId, applicationId } = {}) {
  const clean = { caseType, subject: String(subject || "").trim(), description: String(description || "").trim() };
  if (!["support","property_report","rental_dispute"].includes(caseType) || clean.subject.length < 5 || clean.subject.length > 160 || clean.description.length < 10 || clean.description.length > 5000) throw new TypeError("Complete the support form.");
  if (caseType === "property_report") {
    if (!isBackendUuid(propertyId) || applicationId) throw new TypeError("A property report must reference one property.");
    clean.propertyId = propertyId;
  } else if (caseType === "rental_dispute") {
    if (!isBackendUuid(applicationId) || propertyId) throw new TypeError("A rental dispute must reference one rental application.");
    clean.applicationId = applicationId;
  } else if (propertyId || applicationId) throw new TypeError("General support cases cannot reference a property or application.");
  return clean;
}
