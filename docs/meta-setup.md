# Official Meta API setup and capability check

Paperplay uses the official Meta Model API. The `openai` npm package is only a compatible client; requests go to `https://api.meta.ai/v1`, not OpenAI inference. The initial configurable model is `muse-spark-1.3`.

## Local setup

Copy `.env.example` to `.env.local` and set `MODEL_API_KEY` locally. `META_MODEL` is optional. Both files with real credentials and Next build output are ignored by Git. Do not use `NEXT_PUBLIC_` for private keys.

The prepared M0 application and all routine checks work without a key. `/api/health` exposes only configuration presence and the model name. A configured key does not by itself establish working provider access or available credits.

## Explicit live probe

```sh
npm run meta:check
npm run meta:check -- --live
```

The first command checks local configuration without calling the provider. The second makes at most three tiny response-creation requests: one strict JSON response, one background response that is retrieved, and one background response that is cancelled and then retrieved. Each creation is limited to 512 output tokens; SDK automatic retries are disabled. Pending accepted jobs are cancelled during cleanup if possible.

Results are written to `docs/meta-capabilities.json`. The report omits credentials, response IDs, private request content and raw provider error bodies. A configuration-only invocation replaces the previous report with a configuration-only result; preserve the live verification evidence in the milestone report before rerunning if needed.

The probe checks a small supported schema and background primitives. It does not prove that the complete Paperplay schema is accepted by Meta or that document analysis, grounded figure generation and browser resume are implemented. Those belong to later issues. Account credit balance is not exposed by this check; inspect it in the Meta dashboard.

## M0 live result

The supplied project credentials successfully exercised all four checks (structured output, background acceptance, final retrieval, cancellation). The two completed responses reported 244 and 273 total tokens respectively; the cancelled response supplied no usage. This is observed usage, not an assertion that cancellation is free or that any particular credit balance remains.

## Primary references

- [Meta Responses API and background constraints](https://dev.meta.ai/docs/protocols/responses)
- [Structured output](https://dev.meta.ai/docs/structured-output)
- [Retrieving a response](https://dev.meta.ai/docs/api-reference/responses/retrieve-response)

Model access and platform behavior can change. Keep the report timestamp and rerun the bounded check after provider configuration changes.
