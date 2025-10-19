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

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Create file path: profile-pictures/{user_id}/{timestamp}.{extension}
    const fileExtension = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
    const filePath = `profile-pictures/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars") // Make sure this bucket exists in Supabase
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Update user metadata with the profile picture URL
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: publicUrl,
      },
    });

    if (updateError) {
      console.error("Error updating user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to update user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "Profile picture updated successfully",
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
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

    // Get avatar URL from user metadata
    const avatarUrl = user.user_metadata?.avatar_url || null;

    return NextResponse.json({
      avatar_url: avatarUrl,
    });
  } catch (error) {
    console.error("Get profile picture error:", error);
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

    const avatarUrl = user.user_metadata?.avatar_url;

    if (avatarUrl) {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathParts = url.pathname.split("/");
      const filePath = pathParts.slice(pathParts.indexOf("profile-pictures")).join("/");

      // Delete from storage
      await supabase.storage.from("avatars").remove([filePath]);
    }

    // Remove avatar URL from user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: null,
      },
    });

    if (updateError) {
      console.error("Error removing avatar from user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to remove profile picture" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
