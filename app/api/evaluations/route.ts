import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json({ error: "Strapi API is not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const applicationDocumentId = searchParams.get("applicationDocumentId");

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery = "populate[application][fields][0]=id&populate[application][fields][1]=documentId";
    const url = applicationDocumentId
      ? `${strapiUrl}/api/evaluations?filters[application][documentId][$eq]=${applicationDocumentId}&${populateQuery}`
      : `${strapiUrl}/api/evaluations?${populateQuery}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(session.jwt
          ? { Authorization: `Bearer ${session.jwt}` }
          : apiToken
            ? { Authorization: `Bearer ${apiToken}` }
            : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch evaluations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isEmployer(session)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ error: "Evaluation creation is disabled" }, { status: 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create evaluation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isEmployer(session)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ error: "Evaluation updates are disabled" }, { status: 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update evaluation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
