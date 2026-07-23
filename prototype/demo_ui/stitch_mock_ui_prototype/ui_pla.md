# Praxis UI Design System

> **Purpose:** This document defines the complete design language, user experience, component specifications, interaction patterns, accessibility rules, and visual system for Praxis. It serves as the single source of truth for designers and frontend developers building the production application.

---

# 1. Design Philosophy

## Vision

Praxis is a financial application—not a cryptocurrency dashboard.

Users should feel the same confidence they experience while using modern banking applications, while still maintaining the transparency, openness, and ownership that blockchain provides.

Every interaction should communicate:

- Trust
- Security
- Speed
- Simplicity
- Professionalism

---

## Design Principles

### Security Before Convenience

Security is never hidden.

Critical actions should clearly communicate:

- what is happening
- why confirmation is required
- what the consequences are

The interface should never surprise users.

---

### Progressive Disclosure

Show only the information required for the current decision.

Example:

Dashboard

↓

Wallet

↓

Balance

↓

Token Details

↓

Transaction Details

↓

Blockchain Metadata

↓

Raw JSON

Advanced information remains available without overwhelming everyday users.

---

### Financial Familiarity

The application should borrow interaction patterns from:

- Banking Apps
- UPI Applications
- Stripe Dashboard
- PayPal
- Coinbase
- Revolut
- Wise

rather than traditional Web3 interfaces.

---

### Transparency

Every blockchain action should expose:

- Network
- Wallet
- Token
- Gas Fee
- Transaction Hash
- Explorer Link
- Timestamp
- Confirmation Status

Nothing should be hidden behind generic "Processing..." messages.

---

### Consistency

Every page should follow the same visual hierarchy.

Header

↓

Primary Actions

↓

Content

↓

Secondary Information

↓

Metadata

Users should never relearn navigation.

---

### Feedback

Every action produces immediate feedback.

Examples

Button Click

↓

Loading

↓

Validation

↓

Success / Failure

No action should appear ignored.

---

## User Experience Goals

The interface should always feel

- Fast
- Responsive
- Calm
- Predictable
- Professional

Animations should support comprehension rather than decoration.

---

# 2. Brand Identity

## Personality

Professional

Modern

Minimal

Reliable

Enterprise

Blockchain Native

---

## Emotional Goals

The interface should inspire

Confidence

Ownership

Transparency

Reliability

Security

---

## Visual Tone

Avoid

- neon gradients
- flashy crypto aesthetics
- excessive glow
- meme-inspired design
- gaming UI

Prefer

- subtle shadows
- generous whitespace
- monochrome palette
- restrained accent colors
- clean typography
- soft elevation

---

# 3. Color System

## Primary Colors

Background

Light:
Warm Off White

Dark:
Near Black

Primary

Light:
Near Black

Dark:
Near White

Secondary

Neutral Gray

Muted

Soft Gray

Border

Low Contrast Gray

Input

Subtle Gray

Ring

Medium Gray

---

## Semantic Colors

### Success

Purpose

Completed transactions

Wallet connected

Verified state

Successful invoice

Successful authentication

---

### Pending

Purpose

Blockchain confirmation

Waiting approval

Payment processing

Webhook delivery

Invoice awaiting payment

---

### Warning

Purpose

Spending limits

Wallet expiration

Expiring invoice

Large transaction

High gas fee

---

### Error

Purpose

Failed transaction

Rejected approval

Wallet disconnected

Authentication failure

Server error

Validation failure

---

### Information

Purpose

Notifications

Status updates

Educational messages

Network information

---

### Approval

Purpose

Human approval required

Large payment confirmation

Pending manual review

---

## Security Colors

Wallet Locked

Muted Red

Wallet Unlocked

Muted Green

CAPTCHA Required

Amber

Rate Limited

Red

TOTP Enabled

Green

Session Expiring

Orange

---

# 4. Typography

## Font Family

Primary

Inter

Fallback

System UI

Segoe UI

San Francisco

Roboto

Arial

---

## Font Weights

Regular

Medium

SemiBold

Bold

---

## Scale

Display

Hero pages

Authentication headers

Page Title

Dashboard title

Wallet title

Merchant title

Section Title

Cards

Tables

Forms

Card Title

Analytics cards

Invoice cards

Wallet cards

Body

General interface

Caption

Metadata

Transaction notes

Status

Small labels

Button Labels

Navigation

---

## Monospace Usage

Use monospace exclusively for

Wallet Address

Transaction Hash

Block Number

Contract Address

API Keys

Webhook Secrets

Invoice IDs

Session IDs

---

# 5. Iconography

Primary Library

Lucide Icons

Categories

Navigation

Wallet

Payments

Merchant

Analytics

Security

Notifications

Settings

Administration

Icons should always communicate meaning before decoration.

Never use decorative icons inside financial workflows.

---

# 6. Layout Principles

Desktop First

Minimum Width

1280px

Maximum Content Width

1600px

Content Padding

24px

Card Gap

24px

Section Gap

40px

Page Gap

48px

Sidebar Width

Expanded

260px

Collapsed

72px

Right Drawers

420px

Modals

Small

Medium

Large

Full Screen

Depending on workflow complexity.

---

# 7. Grid System

12 Column Responsive Grid

Dashboard

Analytics

Merchant

Wallet Overview

use 12-column layout.

Forms

use 8-column centered layout.

Authentication

use 4-column centered layout.

Dialogs

Maximum readable width.

---

# 8. Elevation

Level 0

Background

Level 1

Cards

Level 2

Interactive Cards

Level 3

Dropdowns

Level 4

Dialogs

Level 5

Critical Security Modals

No component should exceed Level 5.

---

# 9. Border Radius

Extra Small

Inputs

Small

Buttons

Medium

Cards

Large

Dialogs

Extra Large

Hero Cards

Full

Badges

Avatars

Wallet Indicators

---

# 10. Shadows

Use soft shadows only.

Never use hard black shadows.

Dark mode should use opacity rather than blur intensity to differentiate elevation.

Critical dialogs should use stronger backdrop blur instead of heavier shadows.

---

# 11. Motion Philosophy

Animations should communicate

State

Hierarchy

Focus

Progress

Completion

Animations must never delay workflows.

Target Duration

100–300ms

Exceptions

Loading indicators

Blockchain confirmations

Wallet connection animations

```
# 12. Layout Architecture

## Application Structure

```
Application

└── Root Layout
    ├── Theme Provider
    ├── Authentication Provider
    ├── Query Provider
    ├── Wallet Provider
    ├── Notification Provider
    ├── Global Toast Manager
    ├── Command Palette
    ├── Global Search
    ├── Main Layout
    │   ├── Sidebar
    │   ├── Top Navigation
    │   ├── Main Content
    │   └── Right Utility Panel
    ├── Global Drawers
    ├── Global Dialogs
    └── Footer
```

Every page should inherit this layout except:

- Login
- Signup
- Forgot Password
- Reset Password
- Public Invoice
- Public Payment Link

These pages use a simplified authentication layout.

---

## Sidebar

### Width

Expanded

260px

Collapsed

72px

### Sections

Primary

- Dashboard
- Wallet
- Payments
- Merchant
- History
- Analytics

Secondary

- Notifications
- Settings
- Profile

Administration

Visible only for admin users.

Contains

- Users
- Merchants
- Audit Logs
- API Keys
- System Health

---

## Top Navigation

Contains

Left

- Breadcrumb
- Current Page Title

Center

- Global Search

Right

- Notifications
- Connected Wallet
- Current Network
- User Avatar

---

## Right Utility Panel

Dynamic drawer.

Can display

- Notifications
- Transaction Details
- Wallet Details
- Invoice Details
- Run Timeline
- Analytics Inspector

Width

420px

Pushes page content instead of overlaying it.

---

# 13. Navigation System

## Navigation Principles

Navigation should always answer

Where am I?

What can I do here?

How do I return?

---

## Primary Navigation

Dashboard

Wallet

Payments

Merchant

History

Analytics

---

## Wallet Section

Overview

Linked Wallets

Token Balances

Security

Wallet Re-auth

---

## Payments Section

Send

Receive

Contacts

Pending Transactions

---

## Merchant Section

Invoices

Payment Links

Webhooks

API Keys

Settlement

---

## Analytics Section

Overview

Revenue

Transactions

Wallet Activity

Merchant Performance

Chain Usage

---

## Profile

Personal Information

Security

Sessions

Spending Limits

Connected Wallets

Preferences

---

# 14. Dashboard

## Purpose

The dashboard provides a complete overview of the user's financial activity.

It should answer

How much do I own?

What happened recently?

Is anything waiting for me?

---

## Dashboard Layout

Top Row

- Total Balance
- Monthly Volume
- Pending Payments
- Active Wallet

Second Row

- Balance Chart
- Transaction Activity
- Revenue Trend

Third Row

- Recent Transactions
- Pending Approvals
- Notifications

Bottom Row

- Quick Actions
- Merchant Overview
- Security Status

---

## Quick Actions

Send

Receive

Create Invoice

Connect Wallet

Export History

View Analytics

---

## Dashboard Cards

Each card includes

Title

Primary Metric

Secondary Information

Trend Indicator

Action Button

Loading State

Error State

---

# 15. Wallet Overview

## Purpose

The wallet page is the central financial workspace.

Unlike the dashboard, this page focuses entirely on blockchain assets.

---

## Sections

Wallet Summary

Token Portfolio

Network Information

Recent Activity

Security Status

Connected Wallets

---

## Wallet Summary Card

Displays

Current Wallet

Network

Address

Connection Status

Default Wallet

Copy Address Button

Explorer Button

---

## Balance Card

Displays

Total Portfolio Value

Today's Change

Weekly Change

Monthly Change

Largest Holding

---

## Token Portfolio

Columns

Token

Amount

USD Value

Network

24 Hour Change

Actions

---

## Token Actions

Send

Receive

Swap

View Explorer

Copy Contract

View History

---

## Network Card

Displays

Current Chain

RPC Status

Gas Price

Latest Block

Connection Health

---

# 16. Wallet Connection

## Supported Wallets

MetaMask

WalletConnect

Coinbase Wallet

Ledger

Future wallets should integrate without changing layout.

---

## Connection Flow

Connect Wallet

↓

Select Provider

↓

Approve Connection

↓

Verify Network

↓

Display Wallet Summary

---

## Connection States

Disconnected

Connecting

Connected

Wrong Network

Connection Failed

Permission Denied

---

## Wrong Network

Display

Current Network

Expected Network

Switch Network Button

Retry Connection

---

# 17. Wallet Manager

Displays every linked wallet.

Columns

Wallet Name

Address

Network

Default

Last Used

Actions

---

## Available Actions

Rename

Set Default

Copy Address

View Explorer

Remove Wallet

---

## Remove Wallet

Requires password confirmation.

Displays warning explaining that removing a wallet does not affect on-chain assets.

---

# 18. Wallet Re-auth

Purpose

Protect sensitive financial operations.

Triggers before

Viewing balances

Sending funds

Connecting wallets

Removing wallets

Viewing API keys

Approving transactions

---

## Authentication Methods

PIN

Password

PIN + Password

Depending on security policy.

---

## PIN Screen

Contains

Lock Icon

Instruction Text

Six Dot Display

Numeric Keypad

Backspace

Switch to Password

CAPTCHA

Remaining Attempts

---

## Wrong PIN

Animation

Horizontal Shake

Dots Clear

Error Message

Focus Returns Automatically

---

## Successful Unlock

Animation

Lock Opens

Success Checkmark

Redirect to Requested Page

---

## Timeout

Wallet session expires automatically.

User must authenticate again.

No sensitive information remains visible after timeout.

---

# 19. PIN Pad Component

Grid

```
1 2 3

4 5 6

7 8 9

⌫ 0 ✓
```

Requirements

Keyboard Support

Touch Support

Accessible Labels

High Contrast

Auto Submit After Sixth Digit

---

# 20. Wallet Security

Displays

PIN Enabled

2FA Enabled

Wallet Session Timeout

Connected Devices

Recent Unlocks

Failed Attempts

Risk Level

---

## Security Badges

Protected

Requires Attention

At Risk

Locked

Verified

---

## Spending Limits

Displays

Daily Limit

Remaining Amount

Per Transaction Limit

Approval Threshold

Progress visualization should update immediately after every successful transaction.

```

# 21. Send Payments

## Purpose

The Send flow allows users to securely transfer supported assets to another wallet while providing complete visibility into fees, network details, and security confirmations before signing.

Every transaction must follow the same structured workflow.

```
Recipient

↓

Amount

↓

Review

↓

Security Verification

↓

Wallet Signature

↓

Broadcast

↓

Confirmation
```

---

## Step 1 — Recipient

### Input Methods

- Wallet Address
- ENS Name
- Address Book
- Recent Recipients
- QR Code Scanner

---

### Validation

Validate in real time.

Checks include

- Address format
- Checksum validation
- Supported network
- Blacklisted address
- Duplicate recipient
- Own wallet detection

---

### Recipient Card

Displays

- Address
- ENS (if available)
- Network
- Contact Name
- Trust Status

---

### Suspicious Address

Display a warning banner when

- Address is newly created
- Listed in security database
- Previously failed verification
- High-risk score

Require explicit acknowledgement before proceeding.

---

# 22. Amount Selection

## Components

Token Selector

Amount Input

Available Balance

USD Conversion

MAX Button

Network Fee Estimate

---

## Token Selector

Displays

Token Icon

Token Name

Available Balance

USD Value

Network

Search

---

## Amount Field

Features

Live validation

Thousands separator

Decimal precision

Maximum balance validation

Minimum transfer validation

---

## Balance Information

Display

Available

Locked

Pending

Estimated After Transaction

---

## Gas Estimation

Display

Slow

Standard

Fast

Estimated confirmation time

Estimated network fee

Gas values should update automatically.

---

# 23. Transaction Review

## Purpose

Users must review every financial action before signing.

No hidden information.

---

## Summary Card

Displays

Recipient

Amount

Token

Network

Gas Fee

Estimated Total

Transaction Type

---

## Advanced Details

Expandable section

Contains

Nonce

Gas Limit

Priority Fee

Contract

Explorer Preview

Estimated Confirmation

---

## Warnings

Display warning cards for

High Gas

Large Transaction

Unknown Recipient

New Wallet

Approval Required

---

# 24. Security Confirmation

## Confirmation Levels

### Standard Transaction

Require

PIN

or

Password

---

### Medium Risk

Require

PIN

+

Wallet Session Validation

---

### High Value

Require

PIN

Password

CAPTCHA

---

### Critical Actions

Require

Password

TOTP

CAPTCHA

---

## Confirmation Dialog

Contains

Action Summary

Credential Input

CAPTCHA (if required)

Attempts Remaining

Cancel

Confirm

---

# 25. Wallet Signature

## Purpose

Praxis never signs transactions directly.

Users always approve inside their connected wallet.

---

## Status

Preparing Transaction

Waiting for Wallet

Signature Requested

Signing

Broadcasting

Submitted

Confirmed

Failed

---

## Wallet Popup

Display helper panel while wallet is open.

Contains

Current Step

Wallet Provider

Expected Network

Estimated Fee

---

# 26. Transaction Status

## Pending

Animation

Progress indicator

Displays

Transaction Hash

Explorer Link

Confirmation Count

Estimated Time

---

## Success

Animation

Checkmark

Display

Amount

Recipient

Hash

Explorer Button

Download Receipt

Share Receipt

Done

---

## Failure

Display

Failure Reason

Retry

Contact Support

View Logs

Explorer

---

# 27. Receive Payments

## Purpose

Provide a simple way to receive assets.

---

## Receive Screen

Displays

Wallet Address

QR Code

Network

Selected Token

Copy Button

Share Button

---

## QR Code

Contains

Wallet Address

Network

Optional Amount

Optional Memo

---

## Copy Actions

Copy Address

Copy QR

Copy Payment Link

---

## Share

Native Share

Download QR

Print

---

# 28. Address Book

## Purpose

Store trusted recipients.

---

## Contact Card

Displays

Avatar

Name

Address

Network

Last Used

Favorite

---

## Actions

Add

Edit

Delete

Favorite

Copy

Send

---

## Search

Supports

Name

ENS

Wallet Address

---

# 29. Pending Transactions

Displays transactions awaiting blockchain confirmation.

---

## Columns

Status

Hash

Type

Network

Submitted

Confirmations

Actions

---

## Available Actions

View

Speed Up

Cancel

Explorer

---

## Speed Up

Uses same nonce with higher gas.

Requires PIN confirmation.

---

## Cancel

Creates replacement transaction.

Requires PIN confirmation.

---

# 30. Merchant Dashboard

## Purpose

Provide merchants with a centralized workspace to manage payments.

---

## Dashboard Cards

Total Revenue

Invoices

Paid Today

Pending

Failed Payments

Average Settlement Time

---

## Charts

Revenue

Transactions

Payment Methods

Chain Usage

Token Distribution

---

## Recent Activity

Latest Payments

Latest Webhooks

Recent Customers

Recent Invoices

---

# 31. Invoice Management

## Invoice List

Columns

Invoice ID

Customer

Description

Amount

Status

Created

Expiry

Actions

---

## Actions

View

Copy Link

Download QR

Cancel

Duplicate

Delete

---

## Status

Pending

Paid

Expired

Cancelled

Failed

---

## Invoice Details

Displays

Reference

Description

Customer

Network

Wallet

Amount

Token

Status

Payment Hash

Explorer Link

Timeline

---

# 32. Create Invoice

## Fields

Customer

Description

Reference

Amount

Token

Expiry

Memo

---

## Security

Requires wallet authentication before creation.

---

## Success

Display

Payment Link

QR Code

Copy Link

Download QR

Share

---

# 33. Public Payment Page

## Layout

Merchant Logo

Invoice Summary

Amount

Token

QR Code

Wallet Connect Button

Pay Now

Expiry Countdown

---

## States

Waiting

Wallet Connected

Signing

Processing

Paid

Expired

Cancelled

---

## Confirmation

After payment

Display

Success

Transaction Hash

Explorer Button

Receipt

Back to Merchant

```
# 34. Webhook Management

## Purpose

Webhook management enables merchants to receive real-time updates whenever important events occur inside Praxis.

Events include

- Invoice Paid
- Invoice Expired
- Payment Failed
- Transaction Completed
- Transaction Reverted
- Settlement Completed
- Wallet Connected
- API Key Revoked

---

## Webhook Dashboard

Displays

Active Endpoints

Failed Deliveries

Recent Events

Retry Queue

Webhook Health

Average Response Time

---

## Endpoint Table

Columns

URL

Subscribed Events

Status

Secret Updated

Last Delivery

Success Rate

Actions

---

## Available Actions

Create Endpoint

Edit

Rotate Secret

Disable

Delete

Retry Failed Deliveries

View Logs

---

## Delivery Log

Displays

Timestamp

Event

Status Code

Latency

Attempts

Response Preview

---

## Retry Timeline

First Retry

1 Minute

Second Retry

5 Minutes

Third Retry

30 Minutes

Final Retry

2 Hours

---

## Security

Webhook secrets are never displayed after creation.

Users may only regenerate them.

---

# 35. Analytics Dashboard

## Purpose

Provide insights into financial activity and business performance.

---

## KPI Cards

Total Revenue

Total Transactions

Average Transaction Value

Conversion Rate

Settlement Time

Success Rate

Failed Transactions

Pending Payments

---

## Revenue Chart

Time Ranges

Today

Week

Month

Quarter

Year

Custom

---

## Transaction Analytics

Displays

Completed

Pending

Failed

Refunded

Cancelled

---

## Wallet Analytics

Displays

Connected Wallets

Most Active Wallet

New Wallets

Wallet Growth

---

## Merchant Analytics

Displays

Invoices Created

Invoices Paid

Average Payment Time

Most Used Token

Largest Invoice

Top Customer

---

## Network Analytics

Displays

Network Usage

Gas Costs

Average Confirmation Time

Failed Network Requests

---

## Token Distribution

Pie Chart

Displays percentage allocation of

USDC

ETH

Other Supported Assets

---

# 36. Transaction History

## Purpose

Provide complete transparency for every transaction.

---

## History Filters

Status

Token

Wallet

Network

Merchant

Date Range

Minimum Amount

Maximum Amount

Search

---

## Table Columns

Status

Hash

Type

Token

Amount

Network

Date

Explorer

---

## Status Types

Completed

Pending

Failed

Awaiting Approval

Expired

Cancelled

---

## Row Actions

View Details

Copy Hash

Open Explorer

Download Receipt

Export

---

# 37. Transaction Detail Drawer

## Layout

Header

Transaction Summary

Timeline

Blockchain Details

Merchant Details

Audit Trail

Footer Actions

---

## Summary

Displays

Amount

Recipient

Sender

Wallet

Network

Token

Fee

---

## Blockchain Details

Transaction Hash

Block Number

Nonce

Gas Used

Gas Price

Priority Fee

Explorer Link

---

## Timeline

Transaction Created

Wallet Approved

Broadcast

Included In Block

Confirmed

Completed

---

## Footer Actions

Copy Hash

Explorer

Download Receipt

Share

---

# 38. Notifications

## Categories

Payments

Invoices

Wallet

Security

Merchant

System

---

## Priority Levels

Low

Medium

High

Critical

---

## Notification Card

Displays

Title

Description

Timestamp

Priority

Action Button

Dismiss

---

## Notification Drawer

Sections

Unread

Today

This Week

Earlier

---

## Actions

Mark Read

Mark All Read

Archive

Delete

Open Related Item

---

# 39. Toast System

## Purpose

Provide immediate feedback without interrupting workflow.

---

## Toast Types

Success

Information

Warning

Error

Loading

---

## Success Toast

Examples

Payment Sent

Wallet Connected

Invoice Created

Webhook Saved

Profile Updated

---

## Warning Toast

Examples

Gas Increased

Wallet Session Expiring

Invoice Expiring

Approval Required

---

## Error Toast

Examples

Payment Failed

Authentication Failed

Wallet Disconnected

Server Error

Validation Failed

---

# 40. Security Center

## Purpose

Centralize every security-related setting.

---

## Sections

Password

Two Factor Authentication

Wallet PIN

Wallet Sessions

Active Devices

Audit Logs

Recovery Codes

Spending Limits

Connected Wallets

---

## Password

Displays

Last Changed

Strength

Change Password

---

## Two Factor Authentication

Displays

Status

Authenticator App

Backup Codes

Disable

Regenerate Codes

---

## Wallet PIN

Displays

PIN Enabled

Last Updated

Change PIN

Remove PIN

---

## Sessions

Columns

Device

Operating System

Browser

IP Address

Location

Last Active

Current Session

---

## Session Actions

Revoke

Sign Out Others

Sign Out All

---

## Spending Limits

Displays

Daily Limit

Remaining Limit

Per Transaction Limit

Approval Threshold

Reset Time

---

# 41. Audit Logs

## Purpose

Record every security-sensitive action.

---

## Events

Login

Logout

Password Changed

Wallet Connected

Wallet Removed

PIN Changed

2FA Enabled

2FA Disabled

Payment Sent

Invoice Created

Webhook Updated

API Key Created

API Key Revoked

---

## Columns

Time

User

Action

Result

IP Address

Device

Location

---

# 42. API Key Management

## Purpose

Allow merchants to securely create and manage API credentials.

---

## API Key Card

Displays

Key Name

Created

Last Used

Permissions

Status

---

## Actions

Create

Rotate

Disable

Delete

Copy

---

## Security

Secret keys are shown only once during creation.

Rotation immediately invalidates previous credentials.

Deletion requires password confirmation.

---

# 43. Empty States

## Dashboard

"No activity yet."

Primary Action

Connect Wallet

---

## Wallet

"No wallets connected."

Primary Action

Connect Wallet

---

## History

"No transactions found."

Primary Action

Clear Filters

---

## Merchant

"No invoices created."

Primary Action

Create Invoice

---

## Notifications

"You're all caught up."

---

# 44. Loading States

Use skeleton loaders instead of spinners whenever content structure is known.

---

## Skeleton Components

Dashboard Cards

Wallet Cards

Tables

Invoice Cards

History Rows

Analytics Charts

Notification Cards

---

# 45. Error States

## Network Error

Display

Illustration

Title

Description

Retry

---

## Server Error

Display

Reference ID

Retry

Contact Support

---

## Wallet Error

Display

Reconnect Wallet

Switch Network

Retry

---

## Blockchain Error

Display

Transaction Hash

Failure Reason

Explorer Link

Retry

---

# 46. Success States

Every successful financial action displays

Success Animation

Summary

Transaction Hash

Explorer Link

Receipt Download

Share

Done

---

# 47. Accessibility

Minimum contrast ratio

4.5:1

Interactive elements require

Keyboard Navigation

Visible Focus

Screen Reader Labels

Logical Tab Order

ARIA Labels

Reduced Motion Support

Touch targets

Minimum 44 × 44 pixels

---

# 48. Responsive Design

## Desktop

Complete experience.

---

## Tablet

Collapsible sidebar.

Responsive tables.

Drawer adapts to screen width.

---

## Mobile

Bottom navigation.

Full-screen dialogs.

Optimized PIN pad.

QR scanner support.

Large touch targets.

One-column layouts.

---

# 49. Keyboard Shortcuts

Ctrl/Cmd + K

Global Search

Ctrl/Cmd + W

Wallet

Ctrl/Cmd + S

Send

Ctrl/Cmd + R

Receive

Ctrl/Cmd + I

Invoices

Ctrl/Cmd + H

History

Ctrl/Cmd + A

Analytics

Ctrl/Cmd + P

Profile

Ctrl/Cmd + D

Toggle Theme

Esc

Close Drawer or Dialog

---

# 50. Component Library

## Core Components

Button

Icon Button

Card

Badge

Avatar

Input

Textarea

Select

Checkbox

Radio

Switch

Tabs

Accordion

Tooltip

Popover

Dropdown

Table

Pagination

Breadcrumb

Search

Command Palette

Dialog

Drawer

Toast

Skeleton

Empty State

Charts

Forms

Stepper

Timeline

Progress

---

## Wallet Components

Wallet Card

Wallet Manager

Wallet Connect Button

Network Badge

Balance Card

Token Selector

Token Row

PIN Pad

Wallet Lock Screen

Wallet Session Banner

---

## Payment Components

Recipient Card

Amount Input

Review Card

Gas Estimator

Confirmation Dialog

Transaction Timeline

Transaction Status

Receipt Card

Explorer Button

---

## Merchant Components

Invoice Card

Invoice Table

Invoice QR

Payment Link Card

Webhook Table

API Key Card

Revenue Card

Settlement Card

---

## Analytics Components

Metric Card

Area Chart

Line Chart

Bar Chart

Pie Chart

Heat Map

Trend Indicator

Leaderboard

---

## Security Components

Password Dialog

PIN Dialog

TOTP Dialog

CAPTCHA Widget

Recovery Code Viewer

Session Table

Audit Table

Risk Banner

Spending Limit Card

Sensitive Action Modal

---

# 51. Design Principles Summary

Every interface in Praxis should satisfy the following principles.

- Security is always visible.
- Every financial action is understandable before execution.
- Confirmation is explicit.
- Blockchain details remain transparent.
- Components are reusable and consistent.
- Performance is prioritized over decoration.
- Accessibility is built into every interaction.
- Users always know the current state of the application.
- The interface feels like a modern financial platform rather than a traditional Web3 dashboard.

# 52. Interaction Patterns

## General Rules

Every interaction should follow a predictable lifecycle.

```
Idle

↓

Hover

↓

Focus

↓

Active

↓

Loading

↓

Success / Error
```

Never leave the user without visible feedback.

---

## Button States

### Default

Primary action.

### Hover

Increase elevation slightly.

Background changes subtly.

### Active

Reduce scale slightly.

Maintain shadow consistency.

### Disabled

Lower opacity.

Remove hover effects.

Display tooltip when appropriate.

### Loading

Replace icon with loading indicator.

Disable repeated interaction.

---

## Form Validation

Validation occurs

- While typing
- On field blur
- Before submission

Errors should appear beneath the related field.

Never display validation only inside toast notifications.

---

## Confirmation Pattern

High-risk actions require confirmation.

Pattern

```
User Action

↓

Confirmation Dialog

↓

Credential Verification

↓

Loading

↓

Result
```

---

## Progressive Loading

Priority order

1. Layout
2. Skeletons
3. Primary Content
4. Secondary Content
5. Analytics
6. Background Updates

---

# 53. Design Tokens

## Spacing Scale

2px

4px

8px

12px

16px

20px

24px

32px

40px

48px

64px

80px

96px

Use multiples of the spacing scale across every component.

---

## Border Width

Thin

1px

Medium

2px

Heavy

4px

Used only for warnings and accessibility.

---

## Opacity Scale

100%

90%

80%

60%

40%

20%

10%

Never reduce interactive elements below 40% opacity.

---

## Z-Index Layers

Background

0

Content

10

Sticky Header

100

Sidebar

200

Drawer

500

Modal

1000

Critical Security Dialog

2000

Toast

3000

Loading Overlay

4000

Emergency Lock Screen

9999

---

# 54. Data Visualization

## Principles

Charts should emphasize readability over decoration.

Avoid unnecessary gradients.

Use consistent semantic colors.

---

## Supported Charts

Line

Area

Bar

Pie

Donut

Heat Map

Timeline

Sparkline

---

## Chart Features

Tooltips

Legend

Download

Time Filter

Fullscreen

Export CSV

---

## Empty Charts

Display

Illustration

Message

Suggested Action

---

# 55. Search Experience

## Global Search

Searches

Transactions

Invoices

Wallets

Contacts

Merchants

Notifications

API Keys

Audit Logs

---

## Results

Grouped by category.

Recent searches appear first.

Keyboard navigation supported.

---

## Search States

Empty

Loading

Results

No Results

Error

---

# 56. Filters

## Common Filters

Date

Status

Wallet

Merchant

Network

Token

Amount

User

---

## Filter Behavior

Filters should update results immediately.

Applied filters appear as removable chips.

Support multiple selections where appropriate.

---

# 57. Export System

Supported Formats

CSV

JSON

PDF (future)

---

## Export Sources

History

Invoices

Analytics

Audit Logs

Merchant Reports

---

## Export Flow

Export

↓

Generate

↓

Download

↓

Confirmation

---

# 58. File Uploads

Supported Areas

Profile Avatar

Merchant Logo

CSV Import

Future Document Verification

---

## Upload States

Waiting

Uploading

Processing

Completed

Failed

Cancelled

---

## Validation

Maximum file size

Supported file types

Duplicate detection

Virus scan (future)

---

# 59. Internationalization

Support

Multiple Languages

Localized Dates

Localized Currency

Localized Number Formats

24-hour and 12-hour time

Right-to-left layout (future)

---

# 60. Theme System

## Supported Themes

Light

Dark

System

---

## Theme Persistence

Theme preference should persist across sessions.

---

## Theme Behavior

Charts

Dialogs

Cards

Inputs

Tables

Navigation

Animations

All adapt automatically.

---

# 61. Performance Guidelines

Initial page load should prioritize

Navigation

Primary actions

Critical balances

Recent activity

Analytics load progressively.

---

## Lazy Loading

Analytics

History

Merchant Reports

Notification History

Audit Logs

Charts

---

## Pagination

Required for

History

Invoices

Audit Logs

Notifications

Webhook Logs

Merchants

Users

---

# 62. Offline Experience

If connectivity is lost

Display persistent offline banner.

Disable financial actions.

Allow browsing previously loaded data.

Automatically retry requests when online.

---

# 63. Error Recovery

Whenever possible

Provide

Retry

Alternative Action

Help Link

Support Reference ID

Never leave users at a dead end.

---

# 64. Security UX Standards

Sensitive information should remain hidden until explicitly revealed.

Examples

Wallet Address (partial by default)

API Secret

Webhook Secret

Recovery Codes

Private Metadata

---

## Auto Lock

Wallet automatically locks after configured inactivity period.

Sensitive screens blur immediately when locked.

---

## Clipboard Protection

Display confirmation when copying

Wallet Address

Transaction Hash

API Keys

Webhook Secret

Recovery Codes

Automatically clear clipboard for secrets where supported.

---

# 65. Notification Standards

Critical notifications remain persistent until acknowledged.

Examples

Failed Payment

Wallet Disconnected

Security Alert

Approval Required

Rate Limit

High-Risk Login

---

# 66. Future Expansion

The design system should support future modules without redesigning the existing architecture.

Reserved modules

Subscriptions

Recurring Payments

Escrow

Payroll

Team Wallets

Role-Based Permissions

Fiat On-Ramp

Fiat Off-Ramp

NFT Payments

Multi-Chain Expansion

Cross-Chain Bridge

Hardware Wallet Enhancements

Risk Engine Dashboard

AI Fraud Detection

Treasury Management

---

# 67. Naming Conventions

## Components

PascalCase

Example

WalletCard

TransactionTimeline

InvoiceTable

---

## Hooks

camelCase prefixed with use

Example

useWallet

useInvoices

useTransactions

---

## CSS Variables

Prefix

--praxis-

Example

--praxis-background

--praxis-primary

--praxis-success

---

## Icons

Follow Lucide naming where possible.

---

# 68. Documentation Standards

Every component must document

Purpose

Props

Variants

States

Accessibility

Keyboard Support

Examples

Edge Cases

Related Components

---

# 69. Quality Standards

Every new UI feature must satisfy

Visual consistency

Accessibility compliance

Responsive behavior

Performance optimization

Keyboard accessibility

Screen reader support

Loading states

Empty states

Error states

Security review

---

# 70. Final Design Principles

Praxis is designed to make blockchain payments feel as safe, intuitive, and reliable as modern digital banking while preserving the transparency and ownership of decentralized technology.

Every screen, component, interaction, animation, and workflow should reinforce five principles:

- Trust before novelty.
- Security before convenience.
- Clarity before complexity.
- Consistency before customization.
- Transparency before abstraction.

No interface element should exist without a clear functional purpose. Every user action must communicate intent, progress, and outcome with confidence, ensuring that merchants, enterprises, and individual users can perform financial operations efficiently without sacrificing security or usability.