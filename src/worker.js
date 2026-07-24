const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

const EVENT_DATE = "2026-09-26";

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function getIp(request) {
  return request.headers.get("CF-Connecting-IP") || "";
}

function isAdmin(request, env, url) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const query = url.searchParams.get("token") || "";
  const token = bearer || query;
  return Boolean(env.ADMIN_EXPORT_TOKEN && token && token === env.ADMIN_EXPORT_TOKEN);
}

function ageOnDate(dateOfBirth, eventDate = EVENT_DATE) {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const event = new Date(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob > event) return null;
  let age = event.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    event.getUTCMonth() < dob.getUTCMonth() ||
    (event.getUTCMonth() === dob.getUTCMonth() && event.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/rsvp" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid request body." }, { status: 400 });
      }

      const fullName = clean(body.fullName, 120);
      const email = clean(body.email, 180).toLowerCase();
      const phone = clean(body.phone, 40);
      const dob = clean(body.dateOfBirth, 20);
      const participantAddress = clean(body.participantAddress, 300);
      const emergencyName = clean(body.emergencyContactName, 120);
      const emergencyPhone = clean(body.emergencyContactPhone, 40);
      const emergencyRelationship = clean(body.emergencyContactRelationship, 80);
      const attendanceType = clean(body.attendanceType, 30);
      const notes = clean(body.notes, 1000);
      const typedSignature = clean(body.typedSignature, 120);
      const waiverAccepted = body.waiverAccepted === true;
      const minorAcknowledged = body.minorAcknowledged === true;
      const mediaReleaseChoice = clean(body.mediaReleaseChoice, 10);
      const waiverText = clean(body.waiverText, 30000);

      const guardianName = clean(body.guardianName, 120);
      const guardianRelationship = clean(body.guardianRelationship, 80);
      const guardianDob = clean(body.guardianDateOfBirth, 20);
      const guardianPhone = clean(body.guardianPhone, 40);
      const guardianEmail = clean(body.guardianEmail, 180).toLowerCase();
      const guardianAddress = clean(body.guardianAddress, 300);
      const guardianSignature = clean(body.guardianSignature, 120);
      const guardianPresent = body.guardianPresent === true;
      const guardianAuthority = body.guardianAuthority === true;
      const guardianConsent = body.guardianConsent === true;

      const allowedTypes = new Set(["rider", "spectator", "volunteer", "sponsor", "other"]);
      const age = ageOnDate(dob, env.EVENT_DATE || EVENT_DATE);
      const isMinor = age !== null && age < 18;

      if (!fullName || !email || !phone || !dob || age === null || !participantAddress ||
          !emergencyName || !emergencyPhone || !emergencyRelationship ||
          !typedSignature || !waiverAccepted || !waiverText || !allowedTypes.has(attendanceType)) {
        return json({ ok: false, error: "Please complete all required participant, emergency-contact, and waiver fields." }, { status: 400 });
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return json({ ok: false, error: "Enter a valid participant email address." }, { status: 400 });
      }

      if (typedSignature.toLowerCase() !== fullName.toLowerCase()) {
        return json({ ok: false, error: "The participant signature must match the participant's full legal name." }, { status: 400 });
      }

      if (!["yes", "no"].includes(mediaReleaseChoice)) {
        return json({ ok: false, error: "Select yes or no for the media release." }, { status: 400 });
      }

      if (isMinor) {
        if (!minorAcknowledged || !guardianName || !guardianRelationship || !guardianDob ||
            !guardianPhone || !guardianEmail || !guardianAddress || !guardianSignature ||
            !guardianPresent || !guardianAuthority || !guardianConsent) {
          return json({ ok: false, error: "A parent or legal guardian must complete every minor-participant field, consent, sign, and agree to remain present." }, { status: 400 });
        }
        if (!/^\S+@\S+\.\S+$/.test(guardianEmail)) {
          return json({ ok: false, error: "Enter a valid parent or guardian email address." }, { status: 400 });
        }
        if (guardianSignature.toLowerCase() !== guardianName.toLowerCase()) {
          return json({ ok: false, error: "The guardian signature must match the guardian's full legal name." }, { status: 400 });
        }
        const guardianAge = ageOnDate(guardianDob, env.EVENT_DATE || EVENT_DATE);
        if (guardianAge === null || guardianAge < 18) {
          return json({ ok: false, error: "The signing parent or legal guardian must be at least 18 on the event date." }, { status: 400 });
        }
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const waiverVersion = env.WAIVER_VERSION || "unknown";
      const waiverTextHash = await sha256(waiverText);
      const mediaAccepted = mediaReleaseChoice === "yes";

      await env.DB.prepare(`
        INSERT INTO rsvps (
          id, full_name, email, phone, date_of_birth, age_on_event_date,
          participant_address, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relationship, attendance_type, notes, is_minor,
          guardian_name, guardian_relationship, guardian_date_of_birth,
          guardian_phone, guardian_email, guardian_address, guardian_present,
          guardian_authority_confirmed, guardian_consent_confirmed,
          minor_acknowledged, guardian_signature,
          waiver_version, waiver_text, waiver_text_hash,
          waiver_accepted, media_release_accepted, media_release_choice,
          typed_signature, accepted_at, created_at, ip_address, user_agent, referrer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, fullName, email, phone, dob, age,
        participantAddress, emergencyName, emergencyPhone,
        emergencyRelationship, attendanceType, notes, isMinor ? 1 : 0,
        isMinor ? guardianName : null,
        isMinor ? guardianRelationship : null,
        isMinor ? guardianDob : null,
        isMinor ? guardianPhone : null,
        isMinor ? guardianEmail : null,
        isMinor ? guardianAddress : null,
        isMinor && guardianPresent ? 1 : 0,
        isMinor && guardianAuthority ? 1 : 0,
        isMinor && guardianConsent ? 1 : 0,
        isMinor && minorAcknowledged ? 1 : 0,
        isMinor ? guardianSignature : null,
        waiverVersion, waiverText, waiverTextHash,
        1, mediaAccepted ? 1 : 0, mediaReleaseChoice,
        typedSignature, now, now, getIp(request),
        clean(request.headers.get("user-agent"), 500),
        clean(request.headers.get("referer"), 500)
      ).run();

      return json({ ok: true, id, acceptedAt: now, age, isMinor, waiverTextHash });
    }

    if (url.pathname === "/admin/export.csv" && request.method === "GET") {
      if (!isAdmin(request, env, url)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const { results } = await env.DB.prepare(`SELECT * FROM rsvps ORDER BY created_at DESC`).all();
      const headers = [
        "id", "full_name", "email", "phone", "date_of_birth", "age_on_event_date",
        "participant_address", "emergency_contact_name", "emergency_contact_phone",
        "emergency_contact_relationship", "attendance_type", "notes", "is_minor",
        "guardian_name", "guardian_relationship", "guardian_date_of_birth",
        "guardian_phone", "guardian_email", "guardian_address", "guardian_present",
        "guardian_authority_confirmed", "guardian_consent_confirmed", "minor_acknowledged",
        "guardian_signature", "waiver_version", "waiver_text_hash", "waiver_accepted",
        "media_release_accepted", "media_release_choice", "typed_signature",
        "accepted_at", "created_at", "ip_address", "user_agent", "referrer"
      ];
      const lines = [headers.map(csvCell).join(",")];
      for (const row of results || []) lines.push(headers.map((key) => csvCell(row[key])).join(","));

      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="king-of-the-yard-rsvps-${new Date().toISOString().slice(0,10)}.csv"`
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
