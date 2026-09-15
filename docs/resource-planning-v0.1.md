# Waypoint Resource Planning v0.1

## Purpose

Waypoint v0.1 answers two operational questions every week: **where is each person's time going, and who has usable capacity?** It complements the existing task board; it does not replace it.

The core model is **person × time × work × project × capacity**. A task can have more than one planned allocation, each allocation becomes a dated time block on one person's timeline, and logged time remains separate as the actual record of work performed.

The next canonical layer is `WorkAllocation`: one read model for planned task work, meetings,
support, administration, training, unplanned work, and unavailable time. Existing assignments,
time blocks, and availability remain as operational write models while consumers migrate to the
allocation API. `TimeEntry` remains the actual-work source of truth rather than being copied into
planning records prematurely.

## Users and decisions

 Context switching is surfaced when a person has planned work across three or more projects in the selected week.

## V0.1 entities

| Entity | Responsibility |
| --- | --- |
| `User` | Identity and default weekly capacity (40 hours by default). |
| `Project`, `Task` | Existing work hierarchy. |
| `TaskAssignment` | A planned allocation of a task to a person on a date, measured in minutes. |
 The capacity dashboard surfaces overload and context-switching signals alongside the underlying numbers.
| `TimeBlock` | A dated calendar block: work, meeting, support, or other. Task plans create a linked work block. |
| `Availability` | A time range in which someone cannot be scheduled; it reduces capacity. |
| `TimeEntry` | Existing actual work record. It is never overwritten by planning data. |
| `Skill`, `UserSkill`, `TaskSkillRequirement` | Stored now so future allocation recommendations have a clean foundation; matching is deliberately deferred. |

`WorkSession` is represented by existing `TimeEntry` records in v0.1. External `CalendarEvent` ingestion is deferred: imports should create reviewable `TimeBlock` records rather than a competing calendar model.

## Rules

1. Only project members can view or create project-linked plans.
2. A task allocation is granular: split work across people or days by making several assignments.
3. Planned effort is calculated from planned blocks; actual effort is calculated only from logged time.
4. Unavailable time reduces capacity. Meetings and support consume planned workload but are not automatically attached to a project.
5. The capacity dashboard reports a week at a time. It shows an explicit overload state rather than hiding it behind an average.

## V0.1 success criteria

- A teammate can add work or unavailable time to their weekly timeline.
- A task can be scheduled for a teammate with hours and a date.
- A manager can see capacity, planned time, actual time, workload, and project allocation across the team.
- Planned and actual effort can be compared for each scheduled task.

## Deliberately next

Notifications, calendar sync, automatic time collection, skill-based recommendations, dependency risk, and optimization all build on this dataset. They should be added only after teams rely on planning data consistently.
