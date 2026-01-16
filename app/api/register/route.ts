import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";

type StrapiAuthResponse = {
  jwt?: string;
  user: {
    id: number;
    username: string;
    email: string;
    confirmed?: boolean;
    blocked?: boolean;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  };
};

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body. Please ensure the request is properly formatted." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    const username = body?.username as string | undefined;
    const email = body?.email as string | undefined;
    const password = body?.password as string | undefined;
    const type = body?.type as string | undefined;

    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate user type
    if (!type || (type !== "EMPLOYER" && type !== "CANDIDATE")) {
      return NextResponse.json(
        { error: "Please select a valid user type (EMPLOYER or CANDIDATE)" },
        { status: 400 }
      );
    }

    // Validate username length
    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    // Prepare registration data for Strapi auth/local/register
    // Strapi requires: username, email, password
    // We also include the type field for user type
    const registrationData = {
      username: username,
      email: email,
      password: password,
      type: type,
    };

    // Call Strapi registration endpoint
    let response: Response;
    try {
      response = await fetch(`${strapiUrl}/api/auth/local/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to connect to Strapi. Please try again later." },
        { status: 503 }
      );
    }

    let result: Record<string, unknown> = {};
    try {
      const responseText = await response.text();
      if (responseText) {
        result = JSON.parse(responseText) as Record<string, unknown>;
      }
    } catch (parseError) {
      console.error("Failed to parse Strapi response:", parseError);
      result = {};
    }

    if (!response.ok) {
      let errorMessage = "Registration failed. Please try again.";
      
      // Type-safe error extraction
      const errorObj = result?.error as Record<string, unknown> | undefined;
      const errorData = errorObj?.data as Array<{ messages?: Array<{ message?: string }> }> | undefined;
      
      if (errorObj?.error && typeof errorObj.error === "object") {
        const nestedError = errorObj.error as Record<string, unknown>;
        if (typeof nestedError.message === "string") {
          errorMessage = nestedError.message;
        }
      } else if (errorObj && typeof errorObj.message === "string") {
        errorMessage = errorObj.message;
      } else if (errorData?.[0]?.messages?.[0]?.message) {
        errorMessage = errorData[0].messages[0].message;
      } else if (typeof result?.message === "string") {
        errorMessage = result.message;
      } else if (typeof errorObj === "string") {
        errorMessage = errorObj;
      }
      
      console.error("Strapi registration error:", {
        status: response.status,
        error: result,
        extractedMessage: errorMessage,
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: result,
        },
        { status: response.status || 400 }
      );
    }

    const authData = result as unknown as StrapiAuthResponse;

    // Check if email confirmation is required
    // When email confirmation is enabled in Strapi:
    // - New users have confirmed: false (explicitly set)
    // - If confirmed field is undefined/missing, we default to requiring confirmation
    //   (safe default when email confirmation is enabled)
    // - Only if confirmed is explicitly true do we skip confirmation
    const isEmailConfirmed = authData.user.confirmed === true;
    
    // If confirmed is not explicitly true, assume confirmation is required
    const requiresEmailConfirmation = !isEmailConfirmed;
    
    if (requiresEmailConfirmation) {
      return NextResponse.json(
        {
          success: true,
          requiresConfirmation: true,
          message: "Registration successful! Please check your email to confirm your account before logging in.",
          user: {
            id: authData.user.id,
            username: authData.user.username,
            email: authData.user.email,
            confirmed: false,
          },
        },
        { status: 201 }
      );
    }

    // Email already confirmed (or confirmation not required)
    return NextResponse.json(
      {
        success: true,
        requiresConfirmation: false,
        message: "Registration successful! Please login to continue.",
        user: {
          id: authData.user.id,
          username: authData.user.username,
          email: authData.user.email,
          confirmed: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}

