import assert from "node:assert/strict";
import { test } from "node:test";
import { toBackendOnboardingPayload } from "../public/js/api-onboarding-mapper.js";

test("maps legacy landlord and agent account details without granting verification", () => {
  const landlord = toBackendOnboardingPayload({ role: "homeowner", name: "Owner", location: "Lekki, Lagos" }, { displayName: "Firebase Name" });
  assert.equal(landlord.role, "landlord");
  assert.equal(landlord.displayName, "Owner");
  assert.equal(landlord.serviceArea, "Lekki, Lagos");
  assert.equal("verification" in landlord, false);

  const agent = toBackendOnboardingPayload({ role: "agent", agentInfo: { phone: "+2348000000000", areas: "Ikeja" } });
  assert.equal(agent.role, "agent");
  assert.equal(agent.phoneNumber, "+2348000000000");
  assert.equal(agent.serviceArea, "Ikeja");
});

test("maps legacy agency details into the backend business profile schema", () => {
  const payload = toBackendOnboardingPayload({
    role: "business",
    agency: {
      business: "Example Realty", cac: "RC 123456", supportEmail: "help@example.test",
      phone: "+2348000000000", address: "Lagos office", city: "Ikeja", state: "Lagos", country: "Nigeria"
    }
  });
  assert.equal(payload.role, "agency");
  assert.deepEqual(payload.agencyProfile, {
    businessName: "Example Realty",
    businessType: "real_estate",
    registrationNumber: "RC 123456",
    supportEmail: "help@example.test",
    supportPhone: "+2348000000000",
    officeAddress: "Lagos office",
    serviceLocation: "Ikeja, Lagos, Nigeria"
  });
});

test("missing agency business details fail safely instead of creating a blank business profile", () => {
  assert.throws(() => toBackendOnboardingPayload({ role: "agency", agency: {} }), /business name/);
});

test("unrecognised and privileged legacy roles never become backend privileged roles", () => {
  for (const role of ["admin", "owner", "support", "superuser", "unknown"]) {
    assert.equal(toBackendOnboardingPayload({ role }).role, "renter");
  }
});
