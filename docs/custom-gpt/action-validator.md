# GPT Action: YAML Validator

This is the smallest reliable way to make the Custom GPT self-check its generated routine YAML against the real project validator.

## What the action does

The GPT drafts a full routine YAML, then calls a public HTTPS endpoint with that YAML.

The endpoint:

1. loads the project exercise catalog
2. runs `validateAndNormalizeRoutine(...)`
3. returns either:
   - `ok: true`
   - or `ok: false` plus field-level validation errors

The GPT then:

- returns the YAML if validation passes
- or fixes the YAML and retries if validation fails

## Why this needs a separate service

Your current app is a static Vite frontend. It has no backend runtime in this repo today, and GitHub Pages cannot host a server-side validator endpoint.

Relevant local files:

- validator logic: `web/src/services/routine-service.ts`
- catalog parser: `web/src/services/catalog-service.ts`
- catalog data: `web/src/data/catalog.csv`

So the action must call a separate public API, for example on:

- Vercel Functions
- Netlify Functions
- Cloudflare Workers
- a small Express/Fastify service on your own domain

## Recommended endpoint contract

Use one endpoint:

- `POST /validate-routine`

Request body:

```json
{
  "yaml": "version: 1\nname: \"...\"\n..."
}
```

Successful validation response:

```json
{
  "ok": true,
  "message": "Routine YAML is valid."
}
```

Failed validation response:

```json
{
  "ok": false,
  "message": "Routine YAML is invalid.",
  "errors": [
    {
      "path": "days.A.entries[2].sets[0].reps",
      "message": "Range min (12) must be less than max (8)"
    }
  ]
}
```

## Endpoint implementation shape

Minimal server logic:

1. read `yaml` from JSON body
2. load and parse the catalog into an `exerciseLookup` map
3. call `validateAndNormalizeRoutine(yaml, exerciseLookup)`
4. if valid, return `{ ok: true }`
5. if invalid, return `{ ok: false, errors }`

## Practical implementation note

`validateAndNormalizeRoutine(...)` itself is pure enough for server reuse, but your current browser-side catalog loader uses Vite's `?raw` import, which is not suitable for a generic server runtime.

For the validator service, use one of these patterns:

- read `web/src/data/catalog.csv` directly from disk in Node and pass it to `parseExerciseCatalog(...)`
- or move the validator and CSV parsing into a small shared package used by both frontend and validator service

The second option is cleaner long term, but the first is the fastest path.

## GPT Builder setup

In the GPT editor:

1. open `Actions`
2. click `Create new action`
3. paste the schema from `docs/custom-gpt/action-validator.openapi.yaml`
4. replace `https://YOUR_VALIDATOR_DOMAIN` with the real public endpoint domain
5. choose auth:
   - `None` for a private personal GPT
   - `API key` if you want to protect the endpoint
6. test the action in Preview

## Instruction addition

Add this behavior to the GPT instructions:

```text
Before returning final YAML, call the validateRoutineYaml action with the exact YAML draft.
If the action returns ok=false, fix the YAML and validate again.
Only return final YAML to the user after the validator returns ok=true.
```

## Security recommendation

For your own private GPT, no-auth is acceptable for a first version if the endpoint only validates text and does not mutate anything.

If you plan to share it, use API key auth and add simple rate limiting.

## Operational limits to design for

Keep the validator small and fast. The action path should be treated as synchronous validation, not a long-running job.

Useful production rules from OpenAI's action docs:

- requests time out after about 45 seconds
- request and response payloads must stay under the documented size limits
- use HTTPS with a valid public certificate

## Suggested next step

If you want, I can scaffold the first pass of this as:

- a tiny Vercel validator service
- a shared validation module extracted from the current frontend code
- the final action schema wired to that endpoint
