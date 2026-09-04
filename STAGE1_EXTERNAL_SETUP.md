# Stage 1 · external setup stop point

Do not paste API keys, Google ID tokens, 2FA codes or Cloudflare signing secrets
into chat, GitHub, the ZIP or any project file.

## Information needed before deployment

Write down locally:

1. Exact published Kitsune URL:
   `https://qsqgjhngyt-maker.github.io/algebra8-course/`.
2. Its **origin only**:
   `https://qsqgjhngyt-maker.github.io`.
3. Which Alibaba Model Studio region will be used. The recommended production
   choice must be made by the owner because region controls endpoints, keys,
   available models, billing and data-processing location.

## A. Create the Cloudflare Worker shell

1. Sign in to Cloudflare Dashboard.
2. Open **Workers & Pages**.
3. Choose **Create application** → **Create Worker**.
4. Worker name: `kitsune-hybrid-broker`.
5. Keep the generated `workers.dev` address enabled for Stage 1.
6. Deploy the initial Worker shell.
7. Public Worker URL created for this project:
   `https://kitsune-hybrid-broker.akronikl.workers.dev`.

Do not create a database, KV namespace, D1 database, Durable Object, Analytics
Engine binding or conversation log.

At this point stop. The public Worker URL and exact GitHub Pages URL are needed
to prepare exact CORS and CSP values before the real broker is deployed.

## B. Google Cloud configuration — after exact URLs are known

1. Open Google Cloud Console and select or create a dedicated project.
2. Open **Google Auth Platform**.
3. In **Branding**, enter an adult-facing application name such as
   `Kitsune Parent Access`; use the owner's support/contact email.
4. In **Audience**, use External only if the parent account is outside a Google
   Workspace organization. While testing, keep publishing status **Testing**
   and add only the parent's Google account as a test user.
5. Do not request Drive, Contacts, Calendar or other extra scopes.
6. Open **Clients** → **Create client** → application type **Web application**.
7. Name: `Kitsune Algebra Parent Web`.
8. Under **Authorized JavaScript origins**, add exactly:
   - `https://qsqgjhngyt-maker.github.io`;
   - a localhost origin only if a local browser test is explicitly needed.
9. Do not add a path to Authorized JavaScript origins.
10. This alpha uses Google Identity Services popup callback and does not require
    an OAuth redirect URI. Leave redirect URIs empty unless Google Console
    explicitly requires a flow change.
11. Public Web Client ID created for this project:
    `917733706537-8761p6aqah238r1g2anvlhupstu9s98t.apps.googleusercontent.com`.
    A Client ID is public configuration, not a secret. No client secret is used
    or copied into the PWA.

The stable Google `sub` of the adult is needed for the Worker allowlist. The
alpha panel can display it locally after a Google sign-in attempt. Copy that
value directly into Cloudflare Secret `PARENT_GOOGLE_SUB`; never copy the ID
token itself.

## C. Alibaba Cloud Model Studio — after region decision

1. Sign in and complete 2FA yourself.
2. Activate Model Studio if required.
3. Region selected: Singapore (`ap-southeast-1`), International deployment scope.
4. Stage 1 model selected: `qwen3.7-plus`. Character Voice remains deferred
   until the four Stage 1 checks pass.
5. A dedicated API key was restricted to the Stage 1 model. Alibaba
   Stop-on-Exhaust / Free Quota Only is enabled, and no billing profile was
   completed.
6. Workspace OpenAI-compatible API base:
   `https://ws-xoczzsb7am4cyl8c.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/`.
7. Temporary-token endpoint:
   `https://ws-xoczzsb7am4cyl8c.ap-southeast-1.maas.aliyuncs.com/api/v1/tokens?expire_in_seconds=60`.
8. The permanent key was entered only as Cloudflare Secret
   `DASHSCOPE_API_KEY`; its value is not present in this project.

Temporary credential TTL remains 60 seconds. Direct browser-to-Qwen access is
not assumed to work until the real CORS/SSE test passes.

## D. Cloudflare public variables and secrets — after B and C

Public Worker variables:

- `ALLOWED_ORIGIN`: exact GitHub Pages origin, no trailing path;
- `GOOGLE_CLIENT_ID`: public Google Web Client ID;
- `QWEN_TEMP_TOKEN_URL`: exact region/workspace temporary-token URL;
- `QWEN_REGION`: selected region ID;
- `DEVICE_CERT_TTL_SECONDS`: `43200` for alpha;
- `CHALLENGE_TTL_SECONDS`: `120`.

Cloudflare Secrets:

- `DASHSCOPE_API_KEY`: permanent Model Studio key;
- `GRANT_SIGNING_SECRET`: locally generated random value of at least 32 bytes;
- `PARENT_GOOGLE_SUB`: stable subject of the allowed adult Google account.

In Cloudflare Dashboard open the Worker → **Settings** → **Variables and
Secrets** → **Add** → choose type **Secret**. Enter each value yourself and
deploy. Never use plaintext Worker variables for these three values.

## E. PWA public configuration — no secrets

After the public URLs are final, update `cloud-config-v230.js`:

- `enabled: true`;
- `brokerOrigin`: public Worker origin;
- `googleClientId`: public Web Client ID;
- `qwenApiBase`: exact OpenAI-compatible base ending in `/compatible-mode/v1/`;
- `qwenModel`: selected model ID;
- leave `privacyMode: "direct-temporary-credential"`;
- leave TTL at 60 seconds.

Add the exact Worker origin and exact Qwen origin to `connect-src` in both
`index.html` and `sw.js`. Do not use `https:` or `*.workers.dev` wildcards.

## F. Required Stage 1 test order

1. Publish the alpha PWA and deploy the Worker.
2. Open Adult Center → Cloud Brain.
3. Enable the adult consent switch.
4. Check `Broker connected`.
5. Authorize the adult Google account and enroll the device.
6. Run `Test Qwen`.
7. Confirm all four statuses:
   - Google authorized;
   - Broker connected;
   - Qwen connected;
   - Test answer received.
8. Inspect Cache Storage and confirm no auth, temporary-token or Qwen response.
9. Repeat on desktop, iPhone PWA and Android PWA.

If the direct request fails because of CORS or provider restrictions, stop.
Do not silently enable a proxy. First update the privacy model to state that
Cloudflare transiently processes prompt and response, then implement a narrowly
scoped no-log/no-store proxy.
