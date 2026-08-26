import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthed } from "./adminAuth.js";

export default function AdminGate({ children }) {
  if (!isAuthed()) return <Navigate to="/admin/login" replace />;
  return children;
}
