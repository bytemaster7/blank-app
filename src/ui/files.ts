/** Triggers a browser download of a text file. */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Opens the file picker and resolves with the chosen file's text (undefined if cancelled). */
export function pickTextFile(accept = ".json,application/json"): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : undefined);
    };
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

export function safeFilename(name: string): string {
  return name.trim().replace(/[^\w\-. ]+/g, "_").replace(/\s+/g, "_") || "untitled";
}
