/** Outcome of one input line, sent to the browser by the "My library" action. */
export type ArticleResult = {
  input: string;
  status: "saved" | "updated" | "missing" | "invalid" | "error";
  message: string;
  title?: string;
  url?: string;
};

export type LibraryPage = {
  id: number;
  title: string;
  url: string;
  last_fetched_at: string;
};
