import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";

async function uploadToStrapi(
  strapiUrl: string,
  strapiFormData: FormData,
  authToken: string
) {
  const response = await fetch(`${strapiUrl}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: strapiFormData,
  });

  let result: unknown = {};
  try {
    result = await response.json();
  } catch {
    const textResult = await response.text().catch(() => "");
    console.error("Failed to parse JSON response:", textResult);
    result = {};
  }

  return { response, result };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    if (!userJwt && !apiToken) {
      return NextResponse.json(
        { error: "No authentication token available for upload" },
        { status: 500 }
      );
    }

    // Sanitize filename to avoid issues with special characters
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileBlob = new Blob([fileBuffer], { type: file.type });
    const fileToUpload = new File([fileBlob], sanitizedFileName, {
      type: file.type,
    });

    const createFormData = () => {
      const strapiFormData = new FormData();
      strapiFormData.append("files", fileToUpload);
      return strapiFormData;
    };

    // Use Strapi built-in /api/upload.
    // Prefer user JWT (Authenticated role upload permission), then API token.
    const tokens = [userJwt, apiToken].filter(Boolean) as string[];

    console.log("Uploading file to Strapi:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      strapiUrl: `${strapiUrl}/api/upload`,
      tokenCount: tokens.length,
    });

    let response: Response | null = null;
    let result: unknown = {};

    for (const authToken of tokens) {
      // One retry: Windows + Strapi sharp can hit EBUSY on temp cleanup
      for (let attempt = 0; attempt < 2; attempt++) {
        ({ response, result } = await uploadToStrapi(
          strapiUrl,
          createFormData(),
          authToken
        ));

        if (response.ok) break;
        if (response.status !== 500 || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 350));
      }

      if (response?.ok) {
        break;
      }

      console.warn("Upload attempt failed:", {
        status: response?.status,
        usingUserJwt: authToken === userJwt,
      });

      if (response && response.status !== 401 && response.status !== 403) {
        break;
      }
    }

    if (!response) {
      return NextResponse.json(
        { error: "Upload failed: no auth token available" },
        { status: 500 }
      );
    }

    const uploadedFile = Array.isArray(result) ? result[0] : result;
    const hasFileData =
      uploadedFile &&
      typeof uploadedFile === "object" &&
      ("id" in uploadedFile || "url" in uploadedFile);

    if (!response.ok && !hasFileData) {
      const errorMessage =
        (result as { error?: { message?: string }; message?: string })?.error
          ?.message ||
        (result as { message?: string })?.message ||
        "Failed to upload file";

      console.error("Strapi upload error:", {
        status: response.status,
        error: result,
      });

      return NextResponse.json(
        {
          error:
            response.status === 403
              ? "Upload forbidden. Enable Upload permissions for the Authenticated role (and your API token) in Strapi."
              : errorMessage,
          details: result,
        },
        { status: response.status || 500 }
      );
    }

    if (hasFileData) {
      const fileResult = uploadedFile as {
        id?: number;
        url?: string;
        name?: string;
      };

      console.log("File uploaded successfully:", {
        id: fileResult.id,
        url: fileResult.url,
        name: fileResult.name,
      });

      return NextResponse.json(
        {
          id: fileResult.id,
          url: fileResult.url,
          data: fileResult,
          warning: !response.ok
            ? "File uploaded but optimization may have failed"
            : undefined,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Unexpected response from Strapi", details: result },
      { status: 500 }
    );
  } catch (error) {
    console.error("File upload error:", error);
    const causeCode =
      typeof error === "object" &&
      error &&
      "cause" in error &&
      typeof (error as { cause?: { code?: string } }).cause === "object"
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    const errorMessage =
      causeCode === "ECONNREFUSED"
        ? "Cannot connect to Strapi. Make sure the API is running."
        : error instanceof Error
          ? error.message
          : "Failed to upload file";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
