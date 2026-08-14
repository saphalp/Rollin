# Messaging and Notifications

## Purpose

## Assumptions

## Decisions

## Technical Hurdles

## Feature Workflow

## Interface Details

## Relevant Files

| File | Role |
|---|---|
| `app/(tabs)/chats.tsx` | Displays the user's direct and activity-group conversations |
| `app/chat/[id].tsx` | Loads a conversation, sends messages, and renders incoming real-time messages |
| `app/(tabs)/notifications.tsx` | Loads notifications and handles follow and activity-join request decisions |
| `components/chats/ChatCards.tsx` | Renders a conversation preview in the chat list |
| `components/chats/ConversationHeader.tsx` | Displays the conversation title, avatar, and back navigation |
| `components/chats/MessageBubble.tsx` | Renders sent and received message bubbles |
| `components/chats/MessageInput.tsx` | Provides the message composer and send action |
| `components/notification-row.tsx` | Renders a standard read or unread notification |
| `components/follow-request-row.tsx` | Renders follow-request accept and reject actions |
| `components/activity-join-request-row.tsx` | Renders activity-join request accept and reject actions |
| `hooks/use-conversations.ts` | Builds conversation summaries and loads their latest messages |
| `hooks/use-messages-realtime.ts` | Subscribes to new messages for the active conversation |
| `hooks/use-notification-realtime.ts` | Subscribes to new notifications for the signed-in user |
| `services/ride-notifications-service.ts` | Configures and sends local notifications used by live rides |
