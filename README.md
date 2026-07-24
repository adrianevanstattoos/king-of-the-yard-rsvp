# King of the Yard RSVP + Waiver

Cloudflare Worker + static assets + D1 database.

## What is included

- Flyer-first landing page
- RSVP form
- Waiver acceptance checkbox
- Optional media release
- Typed electronic signature
- Server-side timestamp
- Stored IP address, user agent, referrer, and waiver version
- Protected CSV export endpoint

## Deploy

```bash
cd king-of-the-yard-rsvp
npm install
npx wrangler login
npm run db:create
```

Copy the returned D1 database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Then:

```bash
npm run db:migrate:remote
npx wrangler secret put ADMIN_EXPORT_TOKEN
npm run deploy
```

## Export RSVPs

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_EXPORT_TOKEN" \
  https://YOUR-DOMAIN/admin/export.csv \
  -o king-of-the-yard-rsvps.csv
```

## Important legal note

The included waiver is starter copy only and is not legal advice. Replace it with language reviewed by a Utah attorney before accepting registrations.
