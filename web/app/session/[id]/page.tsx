import { supabase, ChatHistory } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getSessionById(id: string): Promise<ChatHistory | null> {
  const { data, error } = await supabase
    .from("chat_histories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }

  return data;
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  const messages = Array.isArray(session.messages) ? session.messages : [];
  const projectPath = session.metadata?.projectPath || "/";

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to overview
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>
            <div className="space-y-1 mt-2">
              <div>
                <span className="font-medium">Project Path:</span>{" "}
                <span className="font-mono text-xs">{projectPath}</span>
              </div>
              <div>
                <span className="font-medium">Session ID:</span>{" "}
                <span className="font-mono text-xs">{session.id}</span>
              </div>
              <div>
                <span className="font-medium">Agent Type:</span>{" "}
                {session.agent_type || "-"}
              </div>
              <div>
                <span className="font-medium">Created:</span>{" "}
                {new Date(session.created_at).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span>{" "}
                {new Date(session.updated_at).toLocaleString()}
              </div>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Conversation ({messages.length} message
            {messages.length !== 1 ? "s" : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages in this session
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Message #{index + 1}
                    </span>
                    {Object.keys(message.pastedContents || {}).length > 0 && (
                      <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                        Has attachments
                      </span>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.display}
                  </div>
                  {message.pastedContents &&
                    Object.keys(message.pastedContents).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Pasted Content:
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-xs font-mono overflow-x-auto">
                          {Object.entries(message.pastedContents).map(
                            ([key, value]) => (
                              <div key={key} className="mb-2 last:mb-0">
                                <div className="font-semibold text-muted-foreground">
                                  {key}:
                                </div>
                                <div className="whitespace-pre-wrap break-words">
                                  {typeof value === "string"
                                    ? value
                                    : JSON.stringify(value, null, 2)}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
