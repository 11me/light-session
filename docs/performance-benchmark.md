# ChatGPT Web Performance Benchmark with LightSession

> **Status:** COMPLETED

This report documents a performance test performed on ChatGPT Web in Firefox, comparing the same long conversation with LightSession disabled and enabled.

The goal was to measure the impact of limiting the amount of active conversation history handled by the frontend.

## Table of Contents

- [1. Context](#1-context)
- [2. Hypothesis](#2-hypothesis)
- [3. Environment and Configuration](#3-environment-and-configuration)
- [4. Methodology](#4-methodology)
- [5. Results](#5-results)
- [6. Memory Usage](#6-memory-usage)
- [7. Analysis](#7-analysis)
- [8. Conclusion](#8-conclusion)

---

## 1. Context

In long conversations, ChatGPT Web showed progressive performance degradation. Typing became delayed, scrolling became less fluid, the interface started to stutter, and the browser process reached approximately 1 GB to 2 GB of memory usage.

The issue was clearly noticeable in the web interface itself. Model generation continued to work, but interacting with the page became increasingly sluggish as the conversation grew.

To investigate this behavior, LightSession was tested. LightSession reduces the amount of conversation history kept active by the ChatGPT frontend.

The difference after enabling it was immediately noticeable: the same long conversation became significantly more responsive during typing and navigation.

This benchmark was performed to quantify that difference.

---

## 2. Hypothesis

The tested hypothesis was:

> **Hypothesis:** keeping an excessive amount of conversation history active in the frontend is a major contributor to ChatGPT Web performance degradation in long conversations.

The problem can be represented in simplified form as:

```text
long conversation
    ↓
large amount of active history
    ↓
more frontend work
    ↓
more JavaScript, DOM activity, and updates
    ↓
more main-thread work
    ↓
higher interface latency
```

LightSession reduces this workload by limiting how much history remains active in the interface.

---

## 3. Environment and Configuration

The test was performed in Firefox using the same long ChatGPT conversation.

Two states were compared:

| State | Configuration |
|---|---|
| `LightSession OFF` | `enabled: false` |
| `LightSession ON` | `enabled: true`, `keep: 1` |

When enabled, LightSession was configured with:

```text
enabled: true
keep: 1
ultraLean: false
```

This allowed the same frontend to be compared while keeping a much smaller amount of conversation history active.

---

## 4. Methodology

Three runs of approximately 15 seconds were performed in each state.

During each run, the page was actively used through scrolling and typing.

A JavaScript benchmark executed in the browser console collected:

- total DOM element count;
- estimated frame rate;
- frame duration;
- event-loop delay;
- keyboard-to-next-frame latency;
- scroll-to-next-frame latency;
- DOM mutation count;
- added and removed DOM nodes.

Memory usage was observed separately through Firefox `about:processes`.

For the primary comparison, the median of the three runs was used.

---

## 5. Results

### 5.1 Individual Runs

| Metric | OFF #1 | OFF #2 | OFF #3 | ON #1 | ON #2 | ON #3 |
|---|---:|---:|---:|---:|---:|---:|
| DOM elements | 3,063 | 2,538 | 1,064 | 1,904 | 2,602 | 836 |
| Estimated FPS | 29.13 | 27.47 | 29.93 | 53.80 | 49.07 | 48.40 |
| Frame p95 | 83.64 ms | 133.04 ms | 66.40 ms | 17.28 ms | 49.38 ms | 34.18 ms |
| Event-loop p95 | 132 ms | 209 ms | 109 ms | 24 ms | 58 ms | 62 ms |
| Input p95 | 229 ms | 485 ms | 406 ms | 391 ms | — | 41 ms |
| Scroll p95 | 57 ms | 2 ms | 4 ms | 2 ms | 10 ms | 15 ms |
| DOM mutations | 2,079 | 841 | 108 | 45 | 461 | 399 |

### 5.2 Median Comparison

| Metric | LightSession OFF | LightSession ON | Change |
|---|---:|---:|---:|
| Estimated FPS | 29.13 | 49.07 | **+68.5%** |
| Frame time p95 | 83.64 ms | 34.18 ms | **-59.1%** |
| Event-loop delay p95 | 132 ms | 58 ms | **-56.1%** |
| DOM elements | 2,538 | 1,904 | **-25.0%** |
| DOM mutations | 841 | 399 | **-52.6%** |

The performance improvement is clearly visible across the main metrics.

Median estimated FPS increased from:

```text
29.13 FPS
```

to:

```text
49.07 FPS
```

This represents a **68.5% increase**.

The `frame time p95` dropped from:

```text
83.64 ms
```

to:

```text
34.18 ms
```

a **59.1% reduction**.

The event-loop delay p95 dropped from:

```text
132 ms
```

to:

```text
58 ms
```

a **56.1% reduction**.

Median observed DOM mutations dropped from:

```text
841
```

to:

```text
399
```

a **52.6% reduction**.

Median DOM element count dropped from:

```text
2,538
```

to:

```text
1,904
```

a reduction of approximately **25%**.

---

## 6. Memory Usage

The difference was also clearly visible in ChatGPT's browser-process memory usage.

Without LightSession, the observed memory range was approximately:

```text
1 GB to 2 GB
```

With LightSession enabled, the process remained approximately within:

```text
650 MB to 800 MB
```

Using only the midpoint of the observed ranges as a rough reference:

```text
LightSession OFF ≈ 1.5 GB
LightSession ON  ≈ 725 MB
```

the process operated at roughly half the previously observed memory level.

The drop in memory usage followed the same direction as the improvements seen in responsiveness.

---

## 7. Analysis

The results show that the amount of active conversation history has a substantial impact on ChatGPT Web performance in long conversations.

With LightSession disabled, the same conversation ran at approximately 29 FPS, with a `frame time p95` of 83.64 ms and an event-loop delay p95 of 132 ms.

With the active history drastically reduced by LightSession, the same conversation reached approximately 49 FPS, while `frame time p95` dropped to 34.18 ms and event-loop delay dropped to 58 ms.

This was not only a subjective improvement.

The difference appeared simultaneously in:

```text
FPS
+
frame time
+
event-loop delay
+
DOM mutations
+
DOM element count
+
memory usage
```

All of these metrics point in the same direction: keeping a long conversation active in the frontend significantly increases the amount of work performed by the browser.

The result also shows that the perceived slowness is not necessarily caused by model-generation speed.

LightSession does not make the model or OpenAI's servers faster. It changes the amount of work performed locally by the frontend.

Even so, the user experience changes dramatically.

This demonstrates that a substantial part of the performance degradation in long conversations exists in the web application's frontend architecture.

The core architectural principle is simple:

```text
conversation history
        ≠
conversation DOM
```

A conversation can contain hundreds of messages without requiring all of them to remain active and rendered at the same time.

The full conversation can remain available as application data while only the currently relevant region is materialized in the interface.

The LightSession test demonstrates the practical impact of making that distinction.

---

## 8. Conclusion

The benchmark showed a major performance improvement when limiting the amount of active history in ChatGPT Web.

With LightSession enabled, the following changes were observed:

- **68.5% increase in median estimated FPS**;
- **59.1% reduction in frame time p95**;
- **56.1% reduction in event-loop delay p95**;
- **52.6% reduction in observed DOM mutations**;
- **25% reduction in median DOM element count**;
- observed memory usage dropping from approximately **1–2 GB to 650–800 MB**.

In practical use, the same conversation that showed delayed typing, heavy scrolling, and noticeable stuttering became significantly more responsive once the amount of active history was reduced.

The experiment shows that long conversations impose a growing cost on the current ChatGPT frontend, and that reducing that active workload produces immediate and measurable performance gains.

The central architectural point is straightforward:

> **The total size of a conversation should not determine the amount of rendering work required to interact with the small portion currently visible on screen.**

Keeping hundreds of messages available does not require keeping hundreds of messages simultaneously active in the interface.

This benchmark shows the practical performance impact of separating those two concerns.
