---
trigger: always_on
---

# AI Engineering & Agent Workflow Guidelines

## 1. Autonomous Execution & Problem Solving
- **Root Cause First**: Always identify the root cause of an issue before making edits. Avoid applying surface-level patches that mask deeper errors.
- **Proactive Verification**: Always verify code changes with existing build, test, and lint scripts before marking tasks complete.
- **Zero Hallucination of APIs**: When integrating third-party libraries, inspect actual type definitions or documentation rather than guessing API contracts.

## 2. Frontend & Full-Stack Best Practices
- **Modern UI & Aesthetic Excellence**: Ensure modern, responsive designs with thoughtful typography, rich micro-interactions, consistent color tokens, and clean dark/light mode compatibility.
- **State Management**: Keep client state predictable, localized where possible, and avoid unnecessary re-renders.
- **Security & Data Handling**: Never hardcode secrets or sensitive tokens in client-side code. Use environment variables.

## 3. Git & Team Collaboration
- Write clear, concise, conventional commit messages (`feat:`, `fix:`, `chore:`, `refactor:`, `perf:`).
