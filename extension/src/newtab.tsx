/**
 * WebCollect Chrome Extension - New Tab Entry Point
 * 
 * This is the main entry for the extension version of WebCollect.
 * It reuses the same React components as the web version but:
 * - Uses state-based routing instead of Next.js file routing
 * - Uses chrome.runtime.sendMessage for API calls instead of /api routes
 * - Uses IndexedDB for local storage (same as web version)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { NewTabApp } from "./newtab-app";
import "@/app/globals.css";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <NewTabApp />
    </React.StrictMode>
  );
}
