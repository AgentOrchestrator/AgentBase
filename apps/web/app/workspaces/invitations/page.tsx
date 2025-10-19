"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Check, X, Users, Clock } from "lucide-react";

interface Invitation {
  id: string;
  workspace_id: string;
  role: string;
  invited_at: string;
  invited_by_user_id: string | null;
  invited_by_email: string;
  invited_by_display_name: string | null;
  workspaces: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
}

export default function InvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const response = await fetch("/api/workspaces/invitations");
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      } else {
        console.error("Error fetching invitations:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitation = async (invitationId: string, action: "accept" | "decline") => {
    setProcessingId(invitationId);
    try {
      const response = await fetch("/api/workspaces/invitations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invitation_id: invitationId,
          action,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.message);

        // Remove the invitation from the list
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

        // If accepted, redirect to workspaces page after a short delay
        if (action === "accept") {
          setTimeout(() => {
            router.push("/workspaces");
          }, 1500);
        }
      } else {
        const error = await response.json();
        console.error("Error processing invitation:", error.error);
        alert(`Failed to ${action} invitation: ${error.error}`);
      }
    } catch (error) {
      console.error("Error processing invitation:", error);
      alert(`Failed to ${action} invitation`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Workspace Invitations</h1>
          <p className="text-muted-foreground">
            Accept or decline invitations to join workspaces
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && invitations.length === 0 && (
          <div className="bg-card rounded-lg p-12 text-center">
            <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No pending invitations
            </h2>
            <p className="text-muted-foreground mb-6">
              You don't have any workspace invitations at the moment
            </p>
            <button
              onClick={() => router.push("/workspaces")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Workspaces
            </button>
          </div>
        )}

        {/* Invitations List */}
        {!loading && invitations.length > 0 && (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Workspace Icon */}
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="h-6 w-6 text-primary" />
                    </div>

                    {/* Invitation Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {invitation.workspaces?.name || "Unknown Workspace"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">
                          {invitation.invited_by_display_name || invitation.invited_by_email}
                        </span>{" "}
                        invited you to join as{" "}
                        <span className="font-medium capitalize">{invitation.role}</span>
                      </p>
                      {invitation.workspaces?.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {invitation.workspaces.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Invited {formatDate(invitation.invited_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleInvitation(invitation.id, "accept")}
                      disabled={processingId === invitation.id}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      {processingId === invitation.id ? "Processing..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleInvitation(invitation.id, "decline")}
                      disabled={processingId === invitation.id}
                      className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      {processingId === invitation.id ? "Processing..." : "Decline"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
