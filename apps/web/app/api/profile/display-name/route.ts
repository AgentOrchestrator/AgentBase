import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "Display name is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate display name
    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "Display name cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Display name must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Update user metadata with display name
    const { data, error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: trimmedName,
      },
    });

    if (updateError) {
      console.error("Error updating display name:", updateError);
      return NextResponse.json(
        { error: "Failed to update display name" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      display_name: trimmedName,
      message: "Display name updated successfully",
    });
  } catch (error) {
    console.error("Display name update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // Get display name from user metadata
    const displayName = user.user_metadata?.display_name || null;

    return NextResponse.json({
      display_name: displayName,
      email: user.email,
    });
  } catch (error) {
    console.error("Get display name error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // Remove display name from user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: null,
      },
    });

    if (updateError) {
      console.error("Error removing display name:", updateError);
      return NextResponse.json(
        { error: "Failed to remove display name" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Display name removed successfully",
    });
  } catch (error) {
    console.error("Delete display name error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
