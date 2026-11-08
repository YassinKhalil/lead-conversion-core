-- Clinic: a third vertical. A patient is an app.contacts row, a coordinator an
-- app.salespeople row, a clinic location an app.projects row, and an appointment
-- the existing app.appointments / appointment_slots model (migration 020), so
-- routing, notifications and the dashboard directory work unchanged.
--
-- Additive: only widens the vertical check. Existing tenants keep their value.

ALTER TABLE app.clients DROP CONSTRAINT IF EXISTS clients_vertical_check;
ALTER TABLE app.clients
  ADD CONSTRAINT clients_vertical_check CHECK (vertical IN ('real_estate', 'hospitality', 'clinic'));
