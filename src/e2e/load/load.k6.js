/**
 * k6 load test, run by e2e/load/run.mts (which seeds creators, logs them in
 * and starts the fake Instagram). Three groups at the same time:
 *   creators   — each logged-in creator keeps opening the DMs page
 *   commenters — keyword comments arrive as signed webhooks
 *   clickers   — people open the tracked links from their DMs (phase 2)
 */
import http from "k6/http"
import crypto from "k6/crypto"
import { check, sleep } from "k6"
import { Counter } from "k6/metrics"
import exec from "k6/execution"

const cfg = JSON.parse(open(__ENV.LOAD_CONFIG))
const APP = cfg.appUrl
const webhooksAccepted = new Counter("webhooks_accepted")

const phase = __ENV.PHASE || "main"
const DURATION = cfg.duration

export const options =
  phase === "main"
    ? {
        scenarios: {
          creators: {
            executor: "constant-vus",
            exec: "creator",
            vus: cfg.creators.length,
            duration: DURATION,
          },
          commenters: {
            executor: "constant-arrival-rate",
            exec: "commenter",
            rate: cfg.commentsPerSecond,
            timeUnit: "1s",
            duration: DURATION,
            preAllocatedVUs: 50,
            maxVUs: 300,
          },
        },
        thresholds: {
          "http_req_failed": ["rate<0.01"],
          "http_req_duration{scenario:creators}": ["p(95)<3000"],
          "http_req_duration{scenario:commenters}": ["p(95)<1000"],
        },
      }
    : {
        scenarios: {
          clickers: {
            executor: "shared-iterations",
            exec: "clicker",
            vus: Math.max(1, Math.min(50, cfg.links.length)),
            iterations: cfg.links.length,
            maxDuration: "2m",
          },
        },
        thresholds: { "http_req_failed": ["rate<0.01"], "http_req_duration": ["p(95)<1000"] },
      }

export function creator() {
  const c = cfg.creators[(__VU - 1) % cfg.creators.length]
  const headers = { cookie: c.cookie }
  const page = http.get(`${APP}/dms`, { headers, redirects: 0, timeout: "15s", tags: { name: "GET /dms" } })
  if (page.status !== 200) console.warn(`GET /dms → ${page.status} ${page.error || ""}`)
  check(page, {
    "dms page 200": (r) => r.status === 200,
    "dms page shows the account": (r) => r.body && r.body.includes(c.username),
  })
  const posts = http.get(`${APP}/api/instagram/posts`, { headers, timeout: "15s", tags: { name: "GET /api/instagram/posts" } })
  check(posts, { "posts 200": (r) => r.status === 200 })
  sleep(1 + Math.random() * 2) // a person reading the page
}

export function commenter() {
  const c = cfg.creators[Math.floor(Math.random() * cfg.creators.length)]
  const commentId = `load_${__VU}_${__ITER}_${Date.now()}`
  const from = `fan_${__VU}_${__ITER}`
  const body = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: c.bizId,
        time: Date.now(),
        changes: [
          {
            field: "comments",
            value: { id: commentId, text: "LINK please", from: { id: from, username: from }, media: { id: "sim_media_1" } },
          },
        ],
      },
    ],
  })
  const res = http.post(`${APP}/api/instagram/webhook`, body, {
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=" + crypto.hmac("sha256", cfg.secret, body, "hex"),
    },
    tags: { name: "POST webhook" },
  })
  if (check(res, { "webhook 200": (r) => r.status === 200 })) webhooksAccepted.add(1)
}

export function clicker() {
  const link = cfg.links[exec.scenario.iterationInTest % cfg.links.length]
  const res = http.get(link, { redirects: 0, tags: { name: "GET /r/:code" } })
  check(res, { "redirects to the creator's link": (r) => r.status === 302 && r.headers["Location"] === "https://example.com/load" })
}
