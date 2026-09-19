-- Idempotent setup for the Agent Trace Review Workbench.
--
-- Safe to re-run: every statement is CREATE ... IF NOT EXISTS, so CI can
-- execute this on every deploy without guarding it. That is the property
-- that makes automated deployment safe — a deploy step you are afraid to
-- run twice is a deploy step you will eventually run twice by accident.
--
-- This file contains ONLY what the CI deploy role is allowed to do. The
-- database, schema, role, service user and network policy are created once
-- by an administrator (see docs/deployment.md) and deliberately NOT here:
-- if CI could create databases, CI would need CREATE DATABASE on the
-- account, and a compromised workflow could create objects anywhere.
-- Privileged one-time bootstrap and unprivileged repeatable deploy are
-- different jobs and should need different authority.
--
-- Target objects (Eudemo / SFSEEUROPE.EU_DEMO211):
--   RULE190.APP.AGENT_TRACE_HUMAN_REVIEW  - reviewer output, written by the app
-- Trace data is read from DEMO_AGENTIC.SUPPORT.SUPPORT_AGENT via
-- SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS and is never written to.

CREATE TABLE IF NOT EXISTS RULE190.APP.AGENT_TRACE_HUMAN_REVIEW (
  REVIEW_ID VARCHAR DEFAULT UUID_STRING(),
  REVIEWER VARCHAR NOT NULL,
  SOURCE VARCHAR NOT NULL,
  AGENT_FQN VARCHAR NOT NULL,
  TRACE_ID VARCHAR NOT NULL,
  RECORD_ID VARCHAR,
  INPUT_SNAPSHOT VARCHAR,
  OUTPUT_SNAPSHOT VARCHAR,
  OUTCOME VARCHAR NOT NULL,
  DECISION_QUALITY VARCHAR,
  EXECUTION_QUALITY VARCHAR,
  RESPONSE_QUALITY VARCHAR,
  FAILURE_SPAN_ID VARCHAR,
  UNCERTAINTY_REASON VARCHAR,
  FAILURE_TAG VARCHAR,
  OBSERVATION VARCHAR,
  DESIRED_BEHAVIOR VARCHAR,
  REVIEW_STATUS VARCHAR NOT NULL,
  RUBRIC_VERSION INTEGER DEFAULT 1,
  CREATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
  UPDATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
  -- One review per reviewer per trace. The app MERGEs on this key, so two
  -- reviewers can disagree about the same trace without overwriting each
  -- other, which is what makes evaluator calibration possible.
  PRIMARY KEY (REVIEWER, SOURCE, AGENT_FQN, TRACE_ID)
);
