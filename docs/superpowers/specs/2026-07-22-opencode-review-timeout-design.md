# OpenCode Review Timeout Design

## Problem

The submission reviewer allows only 60 seconds for both the OpenCode request and response-body parsing. A real `kimi-k2.7-code` review exceeded that deadline and failed without an HTTP response. The same 60-second constant also controls LeetCode requests, so increasing the shared value would broaden the change unnecessarily.

## Design

Keep the LeetCode deadline at 60 seconds and introduce a separate 180-second OpenCode deadline. The OpenCode deadline continues to span both the fetch and successful-response body parsing and preserves the existing abort and sanitized failure behavior.

Set `timeout-minutes: 45` on the trusted review job as an outer workflow guard. This allows up to ten sequential three-minute model requests plus setup and problem-data retrieval while remaining far below the GitHub-hosted runner limit.

## Testing

Update the OpenCode fake-timer test to prove the request remains pending immediately before 180 seconds and fails at 180 seconds. Keep the LeetCode timeout test at 60 seconds. Update the workflow configuration test to require a 45-minute review-job timeout, then run the focused and complete test suites.

## Scope

This change does not add retries, parallelize solution reviews, change provider payloads, or alter failure rendering.
