# OpenCode Kimi Temperature Fix Design

## Problem

The OpenCode submission reviewer sends `temperature: 0` to the Go chat-completions endpoint for `kimi-k2.7-code`. That model uses fixed sampling settings, so the provider rejects the request with HTTP 400 before review generation begins.

## Design

Remove the `temperature` property from the OpenCode request body and let the provider apply the model's required default. Keep the endpoint, model IDs, authentication, timeout, response validation, and sanitized failure reporting unchanged.

## Testing

Update the existing `OpenCodeClient` request-shape test to require exactly `model` and `messages`. Run that test before the production change to confirm it fails because the request still contains `temperature`, then remove the production property and run the focused and complete test suites.

## Scope

This fix does not add model-specific parameter configuration, expose provider response bodies, or change retry behavior.
