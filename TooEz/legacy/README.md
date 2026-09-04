# Legacy: persona-based academic PDF intelligence system

This folder holds the project that previously occupied this repository — a FastAPI +
Streamlit + Supabase system for turning academic PDFs into persona-specific,
exam-oriented answers.

It is unrelated to TooEz (the AI revenue agent that now lives at the repo root) and is
preserved here untouched rather than deleted. Nothing at the root imports from it, and
it is not part of the TooEz build.

Its original README follows.

---

# TOOEZ  
Persona-Based Academic PDF Intelligence System

TOOEZ is a modular full-stack application designed to process academic PDF documents and generate persona-specific, exam-oriented structured content (e.g., 10-mark answers). The system combines a FastAPI backend, a Streamlit frontend, and a configurable persona-based processing pipeline.

---

## Project Objectives

- Convert unstructured academic PDFs into structured, usable content
- Generate answers tailored to a specific academic persona or role
- Support exam-oriented outputs such as summaries and long-form answers
- Provide a simple web-based interface for students
- Enable future persistence and user management via Supabase

---

## High-Level Architecture Overview

The system follows a layered architecture with clear separation of concerns.

Streamlit Frontend
|
v
FastAPI Backend (API Layer)
|
v
Persona Extraction & Processing Pipeline
|
v
Structured JSON Output (Storage-ready)


### Architectural Rationale

- **Frontend (Streamlit)**  
  Handles user interaction, authentication flow, PDF upload, and result visualization.

- **Backend (FastAPI)**  
  Acts as the orchestration layer. It exposes APIs, validates inputs, invokes the persona pipeline, and prepares responses.

- **Persona Processing Pipeline**  
  Encapsulates the core logic for:
  - PDF parsing
  - Section extraction
  - Persona-based relevance scoring
  - Structured answer generation

- **Storage Layer (Supabase – Planned)**  
  Intended for user data, uploaded documents, and generated outputs.

This separation allows independent development, testing, and future scaling.

---

## Backend Setup

### Local Development (Without Docker)

```bash
cd backend
pip install -r requirements.txt
python -m app.main