# Owner Action: Dental clinic onboarding

Status: backend, demo and dashboard built and tested locally (WhatsApp appointment booking). Nothing below has been done against a real clinic or a real Meta number.

## What the backend does today

- A patient messages the clinic's WhatsApp number and books by chat in English or Arabic (Egyptian-dialect wording, right to left): language, permission, what the visit is for (the clinic's own treatment list: consultation, check-up, cleaning, filling, whitening, braces, implants by default), new or existing patient, how soon, morning or afternoon, how the visit is paid, and whether to see times now.
- The first message and the permission question tell the patient to call their local emergency number in an emergency and not to send medical details in the chat. The flow never asks why the patient is coming, only what the front desk needs to book.
- A patient who asks for times gets a WhatsApp list of real slots, built from the clinic's `appointmentHours` and `closedDays`, in the patient's language (weekday and month names in English or Arabic). Tapping one books it; two patients cannot take the same slot. A patient who prefers a call is handed to the team.
- Every finished conversation is scored `clinic_v1` (how soon, new patient, asked for a slot, and so on, out of 100) and routed to a coordinator assigned to the clinic. The score only orders the front desk's queue. It is not a clinical assessment and reads no symptoms.
- The dashboard at app.kadensio.com shows clinic tenants their own words (Patients, Coordinators, Clinics, Appointments) and an Appointments screen (today / tomorrow / upcoming, per day, read only; open a row for the whole conversation).

## What it does not do yet

- **Changing or cancelling a booked appointment from the chat.** Not built: the patient writes and a person handles it.
- **Calendar sync.** Google Calendar writes exist from the real-estate flow (`04-google-calendar.md`) and are not set up for clinics.
- **Reminders.** The reservation reminder is hospitality only. There is no appointment reminder yet.
- **Several practitioners or rooms.** One slot list per clinic; a slot is not tied to a practitioner.
- **Phone calls and voice.** Not built.

## Owner steps for a clinic

1. **Meta number.** Register a WhatsApp Business number for the clinic and note its phone number id (see `03-meta-whatsapp.md`).
2. **Spec.** Copy `docs/examples/clinic-tenant.example.json`: clinic, up to ten treatments (row titles 24 characters at most), appointment hours, closed days, coordinators, the phone number id. Check it: `npm run tenant:clinic -- --spec tenant.json --validate-only`.
3. **Provision.** `npm run tenant:clinic -- --spec tenant.json` (production: `npm run tenant:clinic:prod`). Safe to re-run after editing the spec.
4. **Logins.** `npm run user:create -- --client-key <key> --email ... --name ... --role salesperson --salesperson-phone +34...` for each coordinator, and a manager. The dashboard picks the clinic view from the client's `vertical`; nothing else to configure.
5. **Go live.** `directSendEnabled` is `false` by default. Set it to `true` only after a staging conversation has been read end to end by a person who speaks the clinic's languages.

## Compliance to settle before a real patient is served

- Health data is special-category data under GDPR. The flow avoids collecting any, but a patient can still type it. The clinic's privacy notice must say what is stored (name, phone, the booking answers, the chat), for how long, and who to ask to erase it, and a data processing agreement must be signed.
- The visit type (for example "Implants") can itself reveal health information. Review the service list with the clinic's data protection lead.
- Opt-out words in Arabic and English are recognised, as for real estate.
