# Marketing UTM links

Paste-ready URLs for the channels we currently post on. Each link tags
the visitor's `utm_source` so /admin's Signup Sources breakdown can
attribute conversions back to the channel.

The signup page reads `utm_source` from the URL on mount, stashes it in
`sessionStorage`, and persists it on the `users.signup_source` column at
signup. NULL → bucketed as "direct" in admin.

## Live links

- LinkedIn — https://getsocialgrowth.tech?utm_source=linkedin
- Substack — https://getsocialgrowth.tech?utm_source=substack
- Reddit — https://getsocialgrowth.tech?utm_source=reddit
- Facebook — https://getsocialgrowth.tech?utm_source=facebook
- Instagram — https://getsocialgrowth.tech?utm_source=instagram

## Adding a new channel

1. Pick a short, lowercase tag (no spaces) — it becomes the table row
   in /admin → Signup Sources, so keep it consistent (`twitter`, not
   `twitter-com` or `Twitter`).
2. Use it directly in the URL, e.g. `?utm_source=twitter`.
3. No code or schema change needed; new sources show up the moment the
   first tagged signup lands.

## Notes

- We only capture `utm_source` right now. Adding `utm_campaign` later
  is a column add + a small extension to `captureUtmSource()`.
- The value is trimmed to 64 chars and lowercased on display, so a
  tampered URL can't stuff junk into the column.
