import React, { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";

const statusLabels = {
  pending: "Pending", running: "Running", in_progress: "In progress",
  completed: "Completed", success: "Success", failed: "Failed", error: "Error",
};

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const rawStatus = (toolCall.status || "").toLowerCase();
  let failed = ["failed", "error"].includes(rawStatus);
  const success = ["success", "completed"].includes(rawStatus);
  const label = statusLabels[rawStatus] || rawStatus || "Working";

  let parsedResults = toolCall.results;
  if (typeof parsedResults === "string") {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw string */ }
  }
  if (parsedResults && typeof parsedResults === "object" && parsedResults.success === false) failed = true;

  let args = toolCall.arguments_string;
  try { args = JSON.parse(args); } catch { /* keep raw string */ }

  const projection = toolCall.display_projection;
  const hideDetails = projection && projection.hide_details && projection.details_redacted;
  if (hideDetails) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        {success ? (
          <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {projection.label || "Done"}</span>
        ) : failed ? (
          <span className="flex items-center gap-1 text-red-500"><Wrench className="h-3 w-3" /> {projection.error_label || "Failed"}</span>
        ) : (
          <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {projection.active_label || "Working"}…</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-muted text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="no-callout flex min-h-[48px] w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-muted-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Wrench className="h-3.5 w-3.5" />
        <span className="capitalize">{(toolCall.name || "").replace(/_/g, " ")}</span>
        <span className={failed ? "text-red-500" : success ? "text-emerald-500" : "text-muted-foreground"}>
          {success && !failed ? "· success" : failed ? "· failed" : "· running"}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-border px-3 py-2 font-mono text-sm text-muted-foreground">
          <div>
            <span className="font-semibold">Args:</span>{" "}
            <span className="break-all">{typeof args === "string" ? args : JSON.stringify(args, null, 2)}</span>
          </div>
          <div>
            <span className="font-semibold">Result:</span>{" "}
            <span className="break-all">{typeof parsedResults === "string" ? parsedResults : JSON.stringify(parsedResults, null, 2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Splits an analyst reply into the brief answer plus its collapsible
// "Sources" and "The numbers" sections (the agent writes these as headings).
function AssistantContent({ content }) {
  const [openSection, setOpenSection] = useState(null);

  const markers = [];
  const numbersMatch = content.match(/^#{1,6}\s*the numbers\s*$/im);
  const sourcesMatch = content.match(/^#{1,6}\s*sources?\s*$/im);
  if (numbersMatch) markers.push({ key: "numbers", index: numbersMatch.index });
  if (sourcesMatch) markers.push({ key: "sources", index: sourcesMatch.index });
  markers.sort((a, b) => a.index - b.index);

  const main = markers.length ? content.slice(0, markers[0].index).trim() : content;
  const sectionText = key => {
    const start = markers.findIndex(m => m.key === key);
    if (start === -1) return "";
    const end = start + 1 < markers.length ? markers[start + 1].index : content.length;
    return content.slice(markers[start].index, end).trim();
  };

  return (
    <div>
      <ReactMarkdown className="prose prose-sm max-w-none text-sm">{main}</ReactMarkdown>
      {markers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {markers.map(m => (
            <button
              key={m.key}
              onClick={() => setOpenSection(openSection === m.key ? null : m.key)}
              className="no-callout flex min-h-[48px] items-center gap-1 rounded-full border border-border bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {openSection === m.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {m.key === "sources" ? "Sources" : "The numbers"}
            </button>
          ))}
        </div>
      )}
      {openSection && (
        <div className="mt-2 rounded-lg border border-border bg-muted px-3 py-2">
          <ReactMarkdown className="prose prose-sm max-w-none text-sm text-muted-foreground">{sectionText(openSection)}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
        isUser ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
      }`}>
        {message.content && (
          isUser
            ? <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            : <AssistantContent content={message.content} />
        )}
        {message.tool_calls?.map((toolCall, i) => <ToolCallDisplay key={i} toolCall={toolCall} />)}
      </div>
    </div>
  );
}