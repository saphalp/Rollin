# Getting Started

This guide explains how to set up the Rollin development environment and run the application locally.

## Prerequisites

Before working on Rollin, you should have:

- Git
- Node.js and npm
- Visual Studio Code or another code editor
- An Android emulator or physical Android device
- Access to the Rollin Supabase project

Rollin currently uses Expo SDK 54, React Native, TypeScript, and Expo Router.

## Repository Setup

Clone the public Rollin repository through either GitHub, or by following the steps below:

```powershell
git clone https://github.com/saphalp/Rollin.git
cd Rollin
```

Install the JavaScript dependencies:

```powershell
npm install
```

When developing or editing code, create or switch to a feature branch before making changes:

```powershell
git switch -c descriptive-branch-name
```

## Environment Configuration

The app needs a `.env.local` file in the project root with the following variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

These values connect the app to Supabase and should be received from a project administrator. Both variables are public client configuration, but the team's actual project values should be kept in the local environment file rather than copied into this documentation. Supabase service-role keys, SMTP passwords, and other administrative credentials must never be placed in the client application.

## Running the Application

Start the Expo development server:

```powershell
npx expo start
```

The Expo terminal provides options for opening the project on a connected device, emulator, or web browser. Follow the provided documentation in the Expo terminal.

## Running on Each Platform

### Android

Android is supported through an emulator or compatible physical device.

### iOS

The project includes iOS support, but native iOS builds require macOS and Xcode. The team should document the devices and iOS versions that have been tested.
