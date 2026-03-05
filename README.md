# GitHub Automation Engine

A Zapier-like automation engine built specifically for GitHub workflows.

## Features

- GitHub OAuth authentication
- Webhook trigger system
- Kafka-based event processing
- Fault-tolerant worker with retry & backoff
- Multiple GitHub automation actions

## Supported Triggers

- issues.opened
- issues.closed
- pull_request.opened
- pull_request.synchronize

## Supported Actions

- create_comment
- add_label
- assign_reviewer
- close_issue
- call_webhook

## Tech Stack

- Node.js
- Express
- Kafka
- Prisma
- PostgreSQL
- Next.js
