const form = document.querySelector("#rsvpForm");
const message = document.querySelector("#formMessage");
const dobInput = form.elements.dateOfBirth;
const ageOutput = document.querySelector("#calculatedAge");
const minorSection = document.querySelector("#minorSection");
const waiverCopy = document.querySelector("#waiverText");
const submitButton = form.querySelector('button[type="submit"]');
const EVENT_DATE = "2026-09-26";

function ageOnEventDate(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const event = new Date(`${EVENT_DATE}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob > event) return null;
  let age = event.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = event.getUTCMonth() < dob.getUTCMonth() ||
    (event.getUTCMonth() === dob.getUTCMonth() && event.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function updateMinorState() {
  const age = ageOnEventDate(dobInput.value);
  const isMinor = age !== null && age < 18;
  ageOutput.textContent = age === null ? "Enter a valid birth date" : `${age} on September 26, 2026`;
  minorSection.hidden = !isMinor;
  minorSection.querySelectorAll("input").forEach((input) => {
    input.required = isMinor && input.dataset.minorRequired === "true";
    if (!isMinor && input.type === "checkbox") input.checked = false;
    if (!isMinor && input.type !== "checkbox") input.value = "";
  });
}

dobInput.addEventListener("change", updateMinorState);
dobInput.addEventListener("input", updateMinorState);
updateMinorState();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateMinorState();

  if (!form.reportValidity()) return;

  const age = ageOnEventDate(dobInput.value);
  if (age === null) {
    message.className = "message error";
    message.textContent = "Enter a valid date of birth.";
    return;
  }

  const data = new FormData(form);
  const isMinor = age < 18;
  const payload = {
    fullName: data.get("fullName"),
    email: data.get("email"),
    phone: data.get("phone"),
    dateOfBirth: data.get("dateOfBirth"),
    participantAddress: data.get("participantAddress"),
    emergencyContactName: data.get("emergencyContactName"),
    emergencyContactPhone: data.get("emergencyContactPhone"),
    emergencyContactRelationship: data.get("emergencyContactRelationship"),
    attendanceType: data.get("attendanceType"),
    notes: data.get("notes"),
    waiverAccepted: data.get("waiverAccepted") === "on",
    mediaReleaseChoice: data.get("mediaReleaseChoice"),
    typedSignature: data.get("typedSignature"),
    minorAcknowledged: isMinor && data.get("minorAcknowledged") === "on",
    guardianName: isMinor ? data.get("guardianName") : "",
    guardianRelationship: isMinor ? data.get("guardianRelationship") : "",
    guardianDateOfBirth: isMinor ? data.get("guardianDateOfBirth") : "",
    guardianPhone: isMinor ? data.get("guardianPhone") : "",
    guardianEmail: isMinor ? data.get("guardianEmail") : "",
    guardianAddress: isMinor ? data.get("guardianAddress") : "",
    guardianSignature: isMinor ? data.get("guardianSignature") : "",
    guardianPresent: isMinor && data.get("guardianPresent") === "on",
    guardianAuthority: isMinor && data.get("guardianAuthority") === "on",
    guardianConsent: isMinor && data.get("guardianConsent") === "on",
    waiverText: waiverCopy.innerText.trim()
  };

  message.className = "message";
  message.textContent = "Submitting…";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Submission failed.");

    form.reset();
    updateMinorState();
    message.className = "message success";
    message.textContent = `You're registered. Waiver accepted at ${new Date(result.acceptedAt).toLocaleString()}.`;
  } catch (error) {
    message.className = "message error";
    message.textContent = error.message || "Something went wrong. Try again.";
  } finally {
    submitButton.disabled = false;
  }
});
