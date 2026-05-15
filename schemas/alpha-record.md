# Alpha Record Schema

## Stored alpha fields
- `alpha_id` - server-generated unique identifier
- `expression` - exact submitted expression
- `hypothesis` - economic hypothesis submitted with the alpha when available
- `status` - `pending | leased | running | tested | failed_retryable | failed_terminal`
- `submitted_by` - generator-agent identifier when available
- `lease_id` - active lease identifier when status is `leased` or `running`
- `leased_to` - execution-agent identifier when status is `leased` or `running`
- `brain_account_id` - assigned account for the current or last execution attempt
- `chrome_profile_id` - assigned isolated browser profile for the current or last execution attempt
- `attempt_count` - number of execution attempts
- `last_error_class` - most recent failure class when present
- `last_error_message` - most recent failure message when present
- `functions` - parsed function tokens with counts
- `datafields` - parsed datafield tokens with counts
- `max_similarity_at_submit` - highest similarity seen at acceptance time
- `closest_alpha_id_at_submit` - nearest stored alpha at acceptance time, if any
- `settings` - observed BRAIN settings after execution
- `metrics` - observed BRAIN result metrics after execution
- `created_at`
- `updated_at`

## Unstored rejection response
A similarity-rejected alpha is not stored as a normal alpha record. The response should still expose:
- `status=rejected_similarity`
- `max_similarity`
- `closest_alpha_id`
- `threshold=0.70`

## State transitions
- accepted submission: `pending`
- worker claim: `pending -> leased`
- worker starts BRAIN execution: `leased -> running`
- successful result submission: `running -> tested`
- retryable failure report: `running -> failed_retryable`
- terminal failure report: `running -> failed_terminal`
- explicit requeue of retryable failure: `failed_retryable -> pending`

## Invariants
- one stored alpha has one canonical `alpha_id`
- one stored alpha is leased to at most one worker at a time
- one similarity-rejected alpha does not consume a stored `alpha_id`
- one tested alpha keeps the exact submitted expression and the exact observed settings and metrics
- one failure record keeps the exact worker, account, profile, and attempt metadata for that failure
