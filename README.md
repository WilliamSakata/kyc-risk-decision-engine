# KYC Risk Decision Engine

> Status: 🚧 planned — not yet implemented

## Goal

A service that receives a customer, queries an external verification, and decides whether to release or block their balance based on risk rules.

## Features

- Core domain isolated in hexagonal architecture, with no infrastructure dependencies
- Call to a mock external risk-verification API
- Simple rules engine: score + history → approve, deny, or send to manual review

## Stack

TypeScript or Python. Core domain tested via TDD with in-memory fixtures — the suite runs without a database and without network access.

## Kubernetes

Not the focus of this project. A simple Dockerfile with docker-compose is enough; forcing k8s here would add complexity without demonstrating anything new.

## What it demonstrates

DDD and TDD actually applied, not just name-dropped on a résumé. Clear separation between business rules and infrastructure.
