import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Message {
  display?: string;
  [key: string]: unknown;
}

interface ChatHistory {
  id: string;
  ai_summary?: string;
  ai_keywords_type?: string[];
  ai_keywords_topic?: string[];
  metadata?: {
    projectPath?: string;
  };
  agent_type?: string;
  messages?: Message[];
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const agentType = searchParams.get("agentType");
  const projectPath = searchParams.get("projectPath");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const searchTerm = query.toLowerCase().trim();

    // Use PostgreSQL full-text search with tsvector
    let queryBuilder = supabase
      .from("chat_histories")
      .select("*")
      .textSearch("search_vector", searchTerm, {
        type: "websearch",
        config: "english",
      });

    // Apply filters
    if (dateFrom) {
      queryBuilder = queryBuilder.gte("updated_at", dateFrom);
    }
    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      queryBuilder = queryBuilder.lt("updated_at", endDate.toISOString());
    }
    if (agentType) {
      queryBuilder = queryBuilder.eq("agent_type", agentType);
    }
    if (projectPath) {
      queryBuilder = queryBuilder.ilike("metadata->>projectPath", `%${projectPath}%`);
    }

    const { data, error } = await queryBuilder
      .order("latest_message_timestamp", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Full-text search error:", error);
      // Fallback to basic search if full-text search fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("chat_histories")
        .select("*")
        .or(
          `id.ilike.%${searchTerm}%,ai_summary.ilike.%${searchTerm}%,metadata->>projectPath.ilike.%${searchTerm}%,agent_type.ilike.%${searchTerm}%`
        )
        .order("latest_message_timestamp", { ascending: false })
        .limit(100);

      if (fallbackError) {
        console.error("Fallback search error:", fallbackError);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
      }

      // Also search in messages and keywords (client-side for fallback)
      const results = (fallbackData || []).filter((history: ChatHistory) => {
        // Check keywords
        if (
          history.ai_keywords_type?.some((keyword: string) =>
            keyword.toLowerCase().includes(searchTerm)
          ) ||
          history.ai_keywords_topic?.some((keyword: string) =>
            keyword.toLowerCase().includes(searchTerm)
          )
        ) {
          return true;
        }

        // Check messages
        if (Array.isArray(history.messages)) {
          return history.messages.some((message: Message) =>
            message.display?.toLowerCase().includes(searchTerm)
          );
        }

        return true; // Already matched by OR query
      });

      return processSearchResults(results, searchTerm, query);
    }

    // Also check messages content (still need client-side for JSONB array)
    const resultsWithMessages = (data || []).filter((history: ChatHistory) => {
      // Already matched by full-text search, but also check messages
      if (Array.isArray(history.messages)) {
        history.messages.some((message: Message) =>
          message.display?.toLowerCase().includes(searchTerm)
        );
        return true; // Keep all full-text matches
      }
      return true;
    });

    return processSearchResults(resultsWithMessages, searchTerm, query);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function processSearchResults(
  results: ChatHistory[],
  searchTerm: string,
  query: string
) {
  const resultsWithContext = results.map((history) => {
    const matchedIn: string[] = [];

    // Determine which fields matched
    if (history.id.toLowerCase().includes(searchTerm)) {
      matchedIn.push("Session ID");
    }
    if (history.ai_summary?.toLowerCase().includes(searchTerm)) {
      matchedIn.push("Summary");
    }
    if (
      history.ai_keywords_type?.some((k: string) =>
        k.toLowerCase().includes(searchTerm)
      ) ||
      history.ai_keywords_topic?.some((k: string) =>
        k.toLowerCase().includes(searchTerm)
      )
    ) {
      matchedIn.push("Keywords");
    }
    if (history.metadata?.projectPath?.toLowerCase().includes(searchTerm)) {
      matchedIn.push("Project Path");
    }
    if (history.agent_type?.toLowerCase().includes(searchTerm)) {
      matchedIn.push("Agent Type");
    }
    if (
      Array.isArray(history.messages) &&
      history.messages.some((m: Message) =>
        m.display?.toLowerCase().includes(searchTerm)
      )
    ) {
      matchedIn.push("Messages");
    }

    // Generate search snippet from matched content
    let snippet = "";
    if (history.ai_summary?.toLowerCase().includes(searchTerm)) {
      const index = history.ai_summary.toLowerCase().indexOf(searchTerm);
      const start = Math.max(0, index - 50);
      const end = Math.min(
        history.ai_summary.length,
        index + searchTerm.length + 50
      );
      snippet =
        (start > 0 ? "..." : "") +
        history.ai_summary.slice(start, end) +
        (end < history.ai_summary.length ? "..." : "");
    } else if (Array.isArray(history.messages)) {
      const matchedMessage = history.messages.find((m: Message) =>
        m.display?.toLowerCase().includes(searchTerm)
      );
      if (matchedMessage?.display) {
        const index = matchedMessage.display.toLowerCase().indexOf(searchTerm);
        const start = Math.max(0, index - 50);
        const end = Math.min(
          matchedMessage.display.length,
          index + searchTerm.length + 50
        );
        snippet =
          (start > 0 ? "..." : "") +
          matchedMessage.display.slice(start, end) +
          (end < matchedMessage.display.length ? "..." : "");
      }
    }

    return {
      ...history,
      matchedIn,
      snippet,
    };
  });

  return NextResponse.json({
    results: resultsWithContext,
    count: resultsWithContext.length,
    query: query,
  });
}
