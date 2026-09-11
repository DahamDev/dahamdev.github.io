---
title: "AI Has Raised the Bar for Software Engineers"
date: 2026-09-11
draft: false
author: "Daham Navinda"
description: "AI can generate increasingly capable software, but that does not eliminate software engineering fundamentals. It makes judgment, systems understanding, and operational experience more important."
excerpt: "AI hasn't lowered the bar for software engineers. It has raised it. As machines generate more code, the ability to understand, evaluate, deploy, and operate software becomes even more important."
tags: ["AI", "Software Engineering", "Education"]
---

For decades, learning to become a software engineer followed a relatively familiar path.

## The familiar path

Learn a programming language. Learn data structures and algorithms. Build applications. Learn databases. Understand operating systems and networks. Write increasingly complex software.

There was a simple assumption: if you could write good code, you were becoming a good software engineer.

That assumption is now being challenged by artificial intelligence.

## AI changes the signal

Large language models can write functions, generate APIs, create tests, refactor applications, explain unfamiliar code and even build entire features from a natural-language description. AI coding agents are increasingly capable of navigating repositories, modifying multiple files and working through development tasks with surprisingly little human intervention.

This has led to a hot topic: if AI can write the code, perhaps we no longer need software engineers to learn how to write code.

I think that conclusion misses the point.

> AI hasn’t lowered the bar for software engineers. It has raised it.

## Software engineering is not arithmetic

One of the common arguments about AI and programming is that calculators once automated arithmetic, and nobody today expects mathematicians to perform multiplication by hand. Therefore, the argument goes, AI will simply do the same thing to programming. But this analogy doesn't apply to LLMs.

A calculator is deterministic. Give it a well-defined calculation and it will reliably produce the same answer. If you ask it to calculate 25 × 17, there is no ambiguity about what constitutes a correct answer.

Software engineering is different. Give an AI agent a requirement to build an authentication service and there are countless possible implementations. The question isn’t simply whether the generated code compiles.

You also need to ask:

- Is the authentication mechanism secure?
- Does it handle concurrent requests correctly?
- What happens when the database is unavailable?
- Are tokens invalidated correctly?
- Does the architecture scale?
- Are sensitive credentials exposed in logs?
- Can the system be observed in production?
- Does the implementation actually satisfy the business requirement?
- Is the code maintainable six months from now?

There isn’t a calculator-like notion of correctness that can be established simply by producing an output.

There is judgment.

And judgment is precisely where software engineering becomes more than code generation.

## Judgment is the differentiator

The junior engineer’s job is changing. The layer between a junior engineer and senior engineers is becoming thinner and thinner.

This creates an uncomfortable question for the industry and, perhaps more importantly, for universities: what should we expect from a junior software engineer when AI can already write a significant amount of the code?

Historically, one of the clearest demonstrations of competence was the ability to implement something correctly.

That is becoming a weaker signal.

A junior engineer may now receive an AI-generated pull request containing hundreds of lines of code. The valuable skill isn’t necessarily typing those hundreds of lines themselves.

It is being able to look at the pull request and say:

> “This is wrong, and here is why.”

## Fundamentals matter more, not less

That requires understanding:

- How databases work
- Networking
- Concurrency
- APIs
- Security
- Distributed systems
- Testing
- Deployment and operations

AI doesn’t eliminate the need for these fundamentals.

It makes them more important.

Because if you don’t understand the underlying system, you have no reliable way of evaluating what the AI has produced.

You are effectively asking one black box to evaluate another.

## Software engineering education needs to catch up

This is where I believe the traditional software engineering curriculum needs to evolve, and we should start treating software engineering as a core engineering discipline.

Five years ago, graduating with an engineering degree that taught the fundamentals of programming was often enough to get your foot in the door. You could learn algorithms, object-oriented programming, databases and other core concepts at university, then spend your first few years in the industry picking up the practical side of software engineering.

That path is becoming harder.

AI has raised the entry bar for software engineers. Knowing the fundamentals still matters, but fundamentals alone are no longer enough. A student can graduate with a solid understanding of algorithms, object-oriented programming and database theory and still be completely unprepared for the environment they will encounter inside a modern software company.

## Real software engineering is messy

Software lives inside repositories. It is reviewed by other engineers. It runs in cloud environments. It communicates with other services. It produces logs and metrics. It fails at inconvenient times. It needs security controls. It gets deployed through CI/CD pipelines. It accumulates technical debt. It needs to be monitored and maintained.

Students should experience this before they graduate.

They should learn how to:

- Build a service
- Containerize it
- Deploy it
- Monitor it
- Break it
- Debug it
- Recover it

They should also:

- Work with Git workflows and code reviews
- Understand cloud infrastructure
- Encounter authentication, authorization, queues, caching, databases and distributed systems

## Working with AI-generated software

And now there is another essential skill:

They should learn how to work with AI-generated software.

Teach the fundamentals more deeply. Then teach students how those fundamentals are applied in real systems. Teach them how to use AI. Teach them how to challenge AI. Teach them how to evaluate AI-generated code. Teach them how to build, deploy and operate software in the real world.

Because the future of software engineering isn’t necessarily about humans competing with machines over who can type code faster.
