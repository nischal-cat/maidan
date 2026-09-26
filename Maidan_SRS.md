# MAIDAN

## A Multi-Sport Facility Management System

### Software Requirements Specification (SRS)

**System Analysis & Design — Futsal Booking and Management Module**

**Course:** CSC364 – Software Engineering  
**Semester:** VI  
**Submitted to:** Mr. Prakash Neupane, Department of CSIT, Central Campus of Technology  
**Date:** August 16, 2026

### Prepared by

| Name | Role |
|---|---|
| Nischal Pokhrel | Project Manager / Backend Developer |
| Samip Khatiwada | Frontend Developer |
| Anubhab Chapagain | Tester / Documentation |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document defines the complete system analysis and design for Increment 1 of the Maidan platform: the Futsal Booking and Management module. It expands on the Milestone 1 project proposal by specifying functional requirements as use cases, the database and object design through ER and class diagrams, the data flow through the system using DFDs, and the system’s dynamic behaviour using sequence diagrams, activity diagrams, and system flowcharts.

This document is intended for the development team, the course supervisor, and future developers extending Maidan with additional sport modules.

### 1.2 Scope

The system in scope is a web-based Futsal court booking and management platform with three actors: Players, Futsal Owners, and a System Administrator.

Players can register, search real-time slot availability, book and pay for a slot, and manage their booking history. Futsal Owners can list courts, manage time slots and pricing, and view bookings and daily revenue reports. The System Administrator maintains user accounts and the overall system.

The architecture is designed generically so that future modules—such as Cricket, Badminton, and Covered Halls—can plug into the same core booking engine without modifying it.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| ER Diagram | Entity–Relationship Diagram, which models the database structure |
| DFD | Data Flow Diagram, which models how data moves through the system |
| UC | Use Case |
| DB | Database |
| Slot | A fixed time window, such as 6–7 PM, on a specific court that can be booked |
| Admin | System Administrator, who manages users and the overall system |
| Owner | Futsal Owner / Manager, who manages one or more courts |

### 1.4 References

1. Milestone 1: Project Proposal — *Maidan, A Sport Facility Management System*, CSC364, submitted July 16, 2026.
2. IEEE Std 830-1998 — Recommended Practice for Software Requirements Specifications, used as a general structural guide.

---

## 2. Overall Description

### 2.1 Product Perspective

Maidan is a new, self-contained web application. The Futsal Booking module is the first increment of a larger modular platform. The core engine—including authentication, slot management, booking, and the administration dashboard—is designed to be reused by later sport modules.

The architecture separates the generic booking core from Futsal-specific configuration wherever possible.

### 2.2 User Classes and Characteristics

| User Class | Description |
|---|---|
| Player / Customer | A general public user who is comfortable using a mobile or desktop web browser. The primary goal is to find and book an available slot quickly. |
| Futsal Owner / Manager | A person who operates one or more futsal courts. The owner needs an easy dashboard for managing availability, prices, bookings, and daily earnings without technical training. |
| System Administrator | A technical user, such as the project team or campus IT staff, who maintains user accounts, resolves technical issues, and monitors system health. |

### 2.3 Operating Environment

- **Client:** Any modern desktop or mobile web browser, including Chrome, Firefox, Edge, and Safari.
- **Server:** A web application server hosting the booking core, REST API, and business logic.
- **Database:** A relational database, such as MySQL or PostgreSQL, as modelled in Section 5.1.
- **Deployment:** A cloud server or campus server using HTTPS only.

### 2.4 Design and Implementation Constraints

- The core booking engine must remain sport-agnostic so that future modules can reuse it, as required by the Incremental Development Model selected in the Milestone 1 proposal.
- Slot booking must be transaction-safe to prevent the double-booking problem identified in the problem statement.
- The system must be usable over low-bandwidth mobile connections, which are common among the target user base in Nepal.

### 2.5 Assumptions and Dependencies

- Users have a valid email address or phone number for registration and OTP/notification services.
- A third-party payment gateway, such as eSewa, Khalti, or a card gateway, is available for the Make Payment use case.
- Futsal owners provide accurate court and pricing information.

---

## 3. Functional Requirements — Use Case Model

### 3.1 Use Case Diagram

The diagram below identifies the three actors and the use cases in which they participate. `include` relationships show that booking a slot always involves searching for a slot and making a payment.

![Figure 3.1 — Use Case Diagram: Maidan Futsal Booking System](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzLzcxNzAwYzA3M2Q3MGFiMDQ4NTFhNTNiMTIwYWQwZWNhNWJkMGNhMjM.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekx6Y3hOekF3WXpBM00yUTNNR0ZpTURRNE5URmhOVE5pTVRJd1lXUXdaV05oTldKa01HTmhNak0ucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIHwZZP8AlYe7QUv9ZuATAU7DYFnR-6gqEE-XZz1RFYEBAiEArVbViGe5gEPdZkXQsw5j9OCwxvEf1prDRbT~fFZQqXQ_)

*Figure 3.1 — Use Case Diagram: Maidan Futsal Booking System*

### 3.2 Actor Summary

| Actor | Goal in the System |
|---|---|
| Player | Discover, book, and pay for a futsal slot; manage personal bookings. |
| Futsal Owner | Manage courts, time slots, and prices; monitor bookings and revenue. |
| System Administrator | Maintain user accounts and overall system integrity. |

### 3.3 Detailed Use Case Descriptions

The core use cases are detailed below using the standard actor, precondition, main-flow, postcondition, and exception-flow format.

#### UC-01 — Register / Login

| Field | Description |
|---|---|
| Actor(s) | Player, Futsal Owner |
| Description | Allows a new user to create an account or an existing user to authenticate before accessing role-specific features. |
| Preconditions | The user has a valid email address or phone number and internet access. |
| Postconditions | The user has an authenticated session. |

**Main flow**

1. The user opens the application and selects **Register** or **Login**.
2. For registration, the user enters a name, email address or phone number, and password. The system validates the information and creates the account.
3. For login, the user enters credentials. The system verifies them against the User store.
4. The system creates a session and redirects the user to the appropriate role-based dashboard.

**Alternate / exception flow**

If the credentials are invalid, the system shows an error message and allows the user to retry.

#### UC-02 — Search Available Slots

| Field | Description |
|---|---|
| Actor(s) | Player |
| Description | Allows a player to browse courts and view real-time slot availability for a selected date and area. |
| Preconditions | The player is logged in, or guest browsing is allowed. |
| Postconditions | The player sees an accurate, real-time list of open slots. |

**Main flow**

1. The player selects a date, area, and optionally a specific court.
2. The system queries the TimeSlot store for slots matching the criteria.
3. The system returns and displays available slots with their prices.

#### UC-03 — Book a Slot

| Field | Description |
|---|---|
| Actor(s) | Player |
| Description | Allows a player to reserve a specific time slot on a court. This use case includes Search Slots and Make Payment. |
| Preconditions | The player is logged in and has found an available slot. |
| Postconditions | A confirmed Booking and Payment record exist, and the slot is no longer available to other players. |

**Main flow**

1. The player selects a slot and confirms the booking details.
2. The system places a temporary hold on the slot to prevent double-booking.
3. The system redirects the player to the Make Payment flow, UC-05.
4. After successful payment, the system marks the slot as booked and creates or confirms the Booking record.
5. The system sends a booking confirmation to the player.

**Alternate / exception flow**

If the slot is taken by another player during the hold, or if payment fails, the hold is released and the player is notified.

#### UC-05 — Make Payment

| Field | Description |
|---|---|
| Actor(s) | Player |
| Description | Handles secure payment for a held booking through the integrated payment gateway. |
| Preconditions | A slot is on hold for the player. |
| Postconditions | A Payment record is created with a `success` or `failed` status and linked to the Booking. |

**Main flow**

1. The player selects a payment method and enters the required payment details on the gateway page.
2. The system sends a charge request to the Payment Gateway.
3. The gateway returns a success, failure, or pending response.
4. The system records the Payment and confirms or cancels the booking accordingly.

**Alternate / exception flow**

On payment failure, the player may retry payment before the hold expires.

#### UC-08 — Manage Time Slots

| Field | Description |
|---|---|
| Actor(s) | Futsal Owner |
| Description | Allows an owner to define, edit, or remove the time slots offered for a court. |
| Preconditions | The owner is logged in and owns at least one court. |
| Postconditions | The court’s slot list is up to date and immediately visible to players. |

**Main flow**

1. The owner opens the slot-management screen for a court.
2. The owner adds, edits, or removes a time slot consisting of a date and start/end time.
3. The system validates overlap and saves the change to the TimeSlot store.

**Alternate / exception flow**

Overlapping or invalid time ranges are rejected with an explanation.

#### UC-11 — Generate Daily Report

| Field | Description |
|---|---|
| Actor(s) | Futsal Owner |
| Description | Produces a summary of bookings and revenue for a court over a selected period, replacing manual paper records. |
| Preconditions | The owner is logged in and has at least one booking on record. |
| Postconditions | The owner has an accurate, real-time record of earnings and bookings that can be exported as a report. |

**Main flow**

1. The owner selects a court and a date range.
2. The system aggregates Bookings and Payments for that court and period.
3. The system displays total bookings and total revenue and allows report export.

### 3.4 Supporting Use Cases

| ID | Use Case | Actor | Summary |
|---|---|---|---|
| UC-04 | View Court Details | Player | View a court’s location, photos, amenities, and pricing before booking. |
| UC-06 | View Booking History | Player | View past and upcoming bookings and their statuses. |
| UC-07 | Cancel Booking | Player | Cancel an upcoming booking, subject to the cancellation policy. |
| UC-09 | Set / Update Pricing | Futsal Owner | Set or change the price per hour for a court. |
| UC-10 | View All Bookings | Futsal Owner | View all bookings made for the owner’s courts. |
| UC-12 | Manage Court Details | Futsal Owner | Add or edit a court’s profile, including name, location, and amenities. |
| UC-13 | Manage User Accounts | System Administrator | Suspend, verify, or edit any user account. |
| UC-14 | Maintain System | System Administrator | Monitor system health and resolve technical issues. |

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Slot search results must return within two seconds under normal load. |
| Reliability | Slot booking must be atomic and transaction-safe so that two players can never book the same slot. This addresses the double-booking problem. |
| Availability | The booking system should be available 24/7, with planned maintenance windows communicated in advance. |
| Usability | The interface must be usable by non-technical futsal owners with minimal training. |
| Security | Passwords are stored as hashes. Payment details are never stored in plaintext and pass through a PCI-compliant gateway. |
| Scalability | The core booking engine must support adding new sport modules, such as cricket, badminton, and covered halls, without redesign. |

---

## 5. System Design

### 5.1 Entity–Relationship Diagram

The relational schema supports all booking, court, and payment operations. A User with `role = owner` owns Courts. Each Court exposes many TimeSlots. A Booking links one User to one TimeSlot and is settled by exactly one Payment. DailyReport aggregates Bookings and Payments per Court.

![Figure 5.1 — Entity–Relationship Diagram](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzL2NlNzBmNzMxMTg3MjlmYTMxZWQ1ZGY0M2NlYmUwYjIyZmZmMzgwN2U.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekwyTmxOekJtTnpNeE1UZzNNamxtWVRNeFpXUTFaR1kwTTJObFltVXdZakl5Wm1abU16Z3dOMlUucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEYCIQCN2ndJkotYYGVAFVzkEZyKyTHJmw2ecIiexkytX71lyQIhAKVPYrDTfTD2TAQTUzHq~-~t-Z-sJg5RClngNy2507jg)

*Figure 5.1 — Entity–Relationship Diagram*

### 5.2 Class Diagram

The object model mirrors the ER schema but adds behaviour. User is specialised into Player, FutsalOwner, and SystemAdmin. Booking and Payment encapsulate the transactional core of the system.

![Figure 5.2 — Class Diagram](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzLzJiYTQ0NDE2ZDUzZjMzZGQ2MWNhNjkxYzMwYTk3NTJkZmEwMTY5MGQ.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekx6SmlZVFEwTkRFMlpEVXpaak16WkdRMk1XTmhOamt4WXpNd1lUazNOVEprWm1Fd01UWTVNR1EucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIQDzoofKVDhss8troHMHFyj88F8y94bsZOzwMOi1Tod1zwIgHFxCgKNupjqZuAqit87GqDt0yleXuJ5j4sjpIXtYw~U_)

*Figure 5.2 — Class Diagram*

### 5.3 Data Dictionary

#### User

| Field | Type | Description |
|---|---|---|
| `user_id` | `INT (PK)` | Unique identifier. |
| `name` | `VARCHAR` | Full name. |
| `email` | `VARCHAR` unique | Login identifier or contact. |
| `phone` | `VARCHAR` | Contact number. |
| `password_hash` | `VARCHAR` | Hashed password. |
| `role` | `ENUM` | `player`, `owner`, or `admin`. |

#### Court

| Field | Type | Description |
|---|---|---|
| `court_id` | `INT (PK)` | Unique identifier. |
| `owner_id` | `INT (FK → User)` | Owning futsal owner. |
| `name` | `VARCHAR` | Court or venue name. |
| `location` | `VARCHAR` | Address or area. |
| `price_per_hour` | `DECIMAL` | Base hourly price. |
| `status` | `ENUM` | `active` or `inactive`. |

#### TimeSlot

| Field | Type | Description |
|---|---|---|
| `slot_id` | `INT (PK)` | Unique identifier. |
| `court_id` | `INT (FK → Court)` | Court to which the slot belongs. |
| `slot_date` | `DATE` | Calendar date of the slot. |
| `start_time` / `end_time` | `TIME` | Slot window. |
| `status` | `ENUM` | `available`, `held`, or `booked`. |

#### Booking

| Field | Type | Description |
|---|---|---|
| `booking_id` | `INT (PK)` | Unique identifier. |
| `user_id` | `INT (FK → User)` | Player who booked. |
| `slot_id` | `INT (FK → TimeSlot)` | Reserved slot. |
| `booking_date` | `DATETIME` | Date and time when the booking was made. |
| `total_amount` | `DECIMAL` | Amount due. |
| `status` | `ENUM` | `pending`, `confirmed`, or `cancelled`. |

#### Payment

| Field | Type | Description |
|---|---|---|
| `payment_id` | `INT (PK)` | Unique identifier. |
| `booking_id` | `INT (FK → Booking)` | Related booking. |
| `amount` | `DECIMAL` | Amount charged. |
| `payment_method` | `VARCHAR` | For example, `eSewa`, `Khalti`, or `card`. |
| `payment_status` | `ENUM` | `success`, `failed`, or `pending`. |

### 5.4 Data Flow Diagram — Context, Level 0

The context diagram treats the whole booking system as a single process and shows its data exchange with each external entity.

![Figure 5.3 — DFD Level 0, Context Diagram](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzL2E1ZTBhZTU3ODMyNTU5OTIyNTg1NGE4N2RkYTlhMDQ4NTBjOWFiN2E.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekwyRTFaVEJoWlRVM09ETXlOVFU1T1RJeU5UZzFOR0U0TjJSa1lUbGhNRFE0TlRCak9XRmlOMkUucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIEVnW8~Fe9Qeq9UmmPO-C77zXskq73bd870HOB1h1h2gAiEAzu0LKxh2STVlJpxJ0JUVLn6cxSfss9FzkQtr5Mhkkhk_)

*Figure 5.3 — DFD Level 0, Context Diagram*

### 5.5 Data Flow Diagram — Level 1

The system is decomposed into five core processes, each reading from or writing to the data stores that support the ER model.

![Figure 5.4 — DFD Level 1](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzLzU2MGYzZTQxMjZiYjllMzg0MjIwMTk2MzhhZGM3YTU2YzA4YWU1OGQ.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekx6VTJNR1l6WlRReE1qWmlZamxsTXpnME1qSXdNVGsyTXpoaFpHTTNZVFUyWXpBNFlXVTFPR1EucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEYCIQDjQP7bDxSZA~XrXpz~Y5NvQZ1s1KVCfpYFeADzqop1BgIhANmzeNbI4d~fUH7T8QL-lYlEImV5YfWMZRpROftpPA8u)

*Figure 5.4 — DFD Level 1*

### 5.6 Sequence Diagrams

#### 5.6.1 Book a Futsal Slot

This is the system’s most critical interaction. It shows how a slot is held before payment to prevent double-booking and committed only after payment succeeds.

![Figure 5.5 — Sequence Diagram: Book a Futsal Slot](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzL2UyNmFkN2RkMDYyNDkxMDc3ZjNlNTMwYWU0ZmIwOTU2NTJhYjU5YjM.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekwyVXlObUZrTjJSa01EWXlORGt4TURjM1pqTmxOVE13WVdVMFptSXdPVFUyTlRKaFlqVTVZak0ucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIGhPkkmGP2JooM59FbmmDr~R1XsQTzRqICzMsth0NCRpAiEA4EyDpPkZeyFA5giQSg5AwAI3eMk5Wrfj6FzK5I8hSEs_)

*Figure 5.5 — Sequence Diagram: Book a Futsal Slot*

#### 5.6.2 Owner Manages Time Slots

![Figure 5.6 — Sequence Diagram: Owner Manages Time Slots](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzLzI4NjBmNTA4NzA1MWM3YjllZTQxMzkyNjVjMmRkNmU1ODY4ZjFhY2I.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekx6STROakJtTlRBNE56QTFNV00zWWpsbFpUUXhNemt5TmpWak1tUmtObVUxT0RZNFpqRmhZMkkucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEQCIDeWJN4tnuiPEJXweRZjI2oezGqgQCoRoPrHGQB8lDHUAiAVfbGIcXyiRQtbBVUrvnMMJ41m87hnd7e~is42RtQy4Q__)

*Figure 5.6 — Sequence Diagram: Owner Manages Time Slots*

### 5.7 Activity Diagram — Booking Process

This activity diagram elaborates the booking workflow’s decision points: slot availability at selection time and payment outcome.

![Figure 5.7 — Activity Diagram: Slot Booking Process](assets/75a72a8ecdf04f6c36ac6619058b6bf3c392a5.png)

*Figure 5.7 — Activity Diagram: Slot Booking Process*

### 5.8 System Flowchart

This is a high-level, system-wide view of how a session flows after a user opens the application and how the process branches by role after authentication.

![Figure 5.8 — System Flowchart](https://private-us-east-1.manuscdn.com/sessionFile/vwZOw1QEPlbgYce8A2BQWF/sandbox/i2rJY8AwF4tQgPhc4TYiUu-images_1787208098544_na1fn_L2hvbWUvdWJ1bnR1L01haWRhbl9TUlNfTWFya2Rvd24vYXNzZXRzLzQwNmZiYjAxMjdmOGZiZDEzMTMxYzAzMzFiNDIzNDA1NTUwZjRkOTU.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvdndaT3cxUUVQbGJnWWNlOEEyQlFXRi9zYW5kYm94L2kyckpZOEF3RjR0UWdQaGM0VFlpVXUtaW1hZ2VzXzE3ODcyMDgwOTg1NDRfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwwMWhhV1JoYmw5VFVsTmZUV0Z5YTJSdmQyNHZZWE56WlhSekx6UXdObVppWWpBeE1qZG1PR1ppWkRFek1UTXhZekF6TXpGaU5ESXpOREExTlRVd1pqUmtPVFUucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzg5NDMwNDAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEYCIQCEZAJHMATzdseZiJwygpTF-kBtnhTHbff0bBwATVLGPQIhAIyoTQl-01sF5jTUU8K8JmWDHFT5obnPFecAVCd~0WMY)

*Figure 5.8 — System Flowchart*

### 5.9 Sample Forms

#### Registration Form

| Field | Type | Validation |
|---|---|---|
| Full Name | Text | Required. |
| Email | Email | Required, unique, and valid format. |
| Phone | Text | Required, 10 digits. |
| Password | Password | Required, minimum eight characters. |
| Role | Dropdown | `Player` or `Futsal Owner`. |

#### Book a Slot Form

| Field | Type | Validation |
|---|---|---|
| Court | Dropdown | Required. |
| Date | Date picker | Required; today or later. |
| Time Slot | Radio / list | Required; must currently be available. |
| Payment Method | Dropdown | Required. |

#### Manage Time Slot Form — Owner

| Field | Type | Validation |
|---|---|---|
| Court | Dropdown | Required; must belong to the logged-in owner. |
| Date | Date picker | Required. |
| Start Time / End Time | Time picker | Required; end must be later than start, with no overlap with existing slots. |
| Price Override | Number | Optional; defaults to the court’s base price. |

---

## 6. Team Formation and Roles

| Name | Role | Responsibilities |
|---|---|---|
| Nischal Pokhrel | Project Manager / Backend Developer | Planning, coordination, database design, and server-side logic. |
| Samip Khatiwada | Frontend Developer | Designing the user interface and implementing client-side features. |
| Anubhab Chapagain | Tester / Documentation | Writing reports, testing for bugs, and preparing manuals. |

---

## 7. Conclusion

This SRS translates the goals and scope defined in the Milestone 1 proposal into a concrete analysis and design. It describes fourteen use cases across three actors, a normalised five-entity data model, context and Level 1 data-flow diagrams, two representative sequence diagrams, an activity diagram for the core booking decision logic, and a system-wide flowchart.

Together, these artefacts form the blueprint for implementing Increment 1—the Futsal Booking core—in a way that keeps the architecture generic enough to support Maidan’s future multi-sport modules.

---

## Appendix A — Included Source Figures

The original diagrams extracted from the supplied Word document are stored in the `assets/` directory alongside this Markdown file. The Markdown image links are relative, so keep the Markdown file and the `assets/` folder together when moving or uploading the document.
