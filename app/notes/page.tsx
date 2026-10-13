import type { Metadata } from "next";

import { NotesApp } from "@/components/notes/notes-app";

export const metadata: Metadata = { title: "Notes Lab" };

export default function NotesPage() {
  return <NotesApp />;
}
