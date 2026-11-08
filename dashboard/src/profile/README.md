# Tenant profiles

One dashboard, three presentations (real estate, hospitality, clinic). A profile maps the generic records the engine stores (leads, answers by question key, scores, assignments) to the words and facts one vertical's team expects. It is frontend only: nothing in `src/`, `migrations/` or the API changes, and nothing here changes what is stored, sent or scored.

| File | What it holds |
|---|---|
| `types.ts` | `TenantProfile`: terms, the four facts, the queue summary, label maps, list and management copy |
| `real-estate.ts` | The dashboard as it shipped. `tests/dashboard-profiles.test.ts` pins it to those strings |
| `hospitality.ts` | Guests, hosts, venues, party size, zone. Answer keys are the contract a hospitality config must use |
| `clinic.ts` | Patients, coordinators, clinics, appointments. `valueLabels` turns stored values (`this_week`) into words. Answer keys are the contract `config/seed-clinic.json` uses |
| `index.ts` | `resolveProfile`, the registry `CLIENT_VERTICALS` |
| `words.ts` | `words('Add {person}', terms)`: fills a vertical's nouns into a sentence |
| `ProfileProvider.tsx` | `useProfile()` for components |

## Which tenant gets which profile

The API sends the client's `vertical` on the session (`app.clients.vertical`, set by `npm run tenant:hospitality` / `tenant:clinic`). `resolveProfile` decides: a preview override, then that field, then `CLIENT_VERTICALS[clientKey]` (an optional frontend override, empty today), then real estate. Nothing to ship to move a tenant: set its vertical.

## Not profile-dependent, on purpose

The conversation panel, the handoff control, the temperature badge, the queue's urgency ordering and the clock take no profile and render identically in every vertical. A test fails if a profile grows a key for them.

## Adding a word

Write the sentence with tokens (`{lead}`, `{leads}`, `{person}`, `{people}`, `{place}`, `{places}`, `{category}`, `{categories}`, `{booked}`, `{visit}`; a capital letter keeps the term's capital) and call it through `w = (s) => words(s, profile.terms)`. Real estate maps each noun to itself, so the sentence reads as before. If the text is a fixed label, add it to both profiles: the shape test fails when they differ, and a vocabulary test fails when real-estate words appear in the hospitality profile or the reverse.

## Previewing both views

Build with `EXPO_PUBLIC_ALLOW_PROFILE_OVERRIDE=1`, then add `?vertical=hospitality` or `?vertical=clinic` to any URL (it is remembered for the tab). A production build ignores the parameter.

Text that arrives from the API, such as a score factor's `reason`, is data and is shown as sent. It is not re-labelled here.
