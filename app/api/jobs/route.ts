import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";
import {
  fetchCategories,
  fetchJobById,
  fetchJobs,
  getEmployerCompanyId,
  checkJobCodeExists,
  generateSlug,
  createJob,
  verifyJobOwnership,
  updateJob,
  deleteJob,
} from "@/features/jobs/api/job.api";
import { WORKPLACE_TYPES, EXPERIENCE_LEVELS, APPROVAL_STATUSES } from "@/features/jobs/constants/job.constants";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("id");
    const categoriesOnly = searchParams.get("categories") === "true";

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // If requesting categories only
    if (categoriesOnly) {
      const categories = await fetchCategories(apiToken);
      return NextResponse.json({ data: categories }, { status: 200 });
    }

    // If requesting a specific job
    if (jobId) {
      // Only employers can view individual jobs for editing
      if (!session || !isEmployer(session)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      try {
        console.log("API: Fetching job with ID:", jobId);
        const job = await fetchJobById(jobId, apiToken, session.jwt);
        console.log("API: Job fetched successfully:", job?.title);
        
        // Verify the job belongs to the current user
        const userId = Number(session.userId);
        // Check both numeric ID and the documentId structure
        const jobUserId = typeof job?.user === 'object' && job.user !== null 
          ? job.user.id 
          : typeof job?.user === 'number' 
            ? job.user 
            : null;
        
        if (jobUserId && jobUserId !== userId) {
          console.error("API: Job ownership mismatch. Job user:", jobUserId, "Current user:", userId);
          return NextResponse.json(
            { error: "Job not found or access denied" },
            { status: 404 }
          );
        }
        
        return NextResponse.json({ data: job }, { status: 200 });
      } catch (error) {
        console.error("API: Error fetching job:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch job";
        
        // If it's a 404, return 404 status
        if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
          return NextResponse.json(
            { error: "Job not found" },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    }

    // List all jobs (public endpoint, but can be filtered by employer)
    const userId = session && isEmployer(session) ? Number(session.userId) : undefined;
    const result = await fetchJobs(userId, apiToken, session?.jwt);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Jobs fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch jobs";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST handler for creating jobs
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can create jobs
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can create job postings." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);

    // Get employer's company
    const companyId = await getEmployerCompanyId(userId, apiToken, userJwt);

    // Extract and prepare job data
    const {
      title,
      description,
      location,
      jobType,
      deadline,
      workplaceType,
      isFeatured,
      isActive,
      experience,
      salary,
      categories,
      jobCode,
    } = body.data;

    // Validate required fields
    if (!title || !description || !deadline || !jobCode) {
      return NextResponse.json(
        { error: "Title, description, deadline, and job code are required" },
        { status: 400 }
      );
    }

    // Check if jobCode already exists
    if (await checkJobCodeExists(jobCode, undefined, apiToken)) {
      return NextResponse.json(
        { error: "Job code already exists. Please use a unique job code." },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = generateSlug(title);

    // Prepare job payload
    const jobData: Record<string, unknown> = {
      title,
      slug,
      description,
      deadline,
      workplaceType: workplaceType || WORKPLACE_TYPES[1], // Default to "On Site"
      isFeatured: isFeatured || false,
      isActive: isActive !== undefined ? isActive : true,
      experience: experience || EXPERIENCE_LEVELS[0], // Default to "Entry"
      user: userId,
      approvalStatus: APPROVAL_STATUSES[0], // Default to "Pending"
      jobCode,
    };

    // Link company if available
    if (companyId) {
      jobData.company = companyId;
    }

    if (location) {
      jobData.location = location;
    }

    if (jobType) {
      jobData.jobType = jobType;
    }

    // Handle salary as a Component
    if (salary !== undefined) {
      if (typeof salary === 'object' && salary !== null && !Array.isArray(salary)) {
        jobData.salary = {
          min: salary.min ?? null,
          max: salary.max ?? null,
          currency: salary.currency || "ETB",
          isNegotiable: !!salary.isNegotiable
        };
      } else if (typeof salary === 'number') {
        jobData.salary = salary;
      }
    }

    // Handle categories
    if (categories && Array.isArray(categories) && categories.length > 0) {
      jobData.categories = categories;
    }

    // Create the job
    const job = await createJob(jobData, userJwt, apiToken);
    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    console.error("Job creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create job posting";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT handler for updating jobs
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can update jobs
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can update job postings." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);
    const jobId = body.data.id || body.data.documentId;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required for updates" },
        { status: 400 }
      );
    }

    // Get employer's company
    const companyId = await getEmployerCompanyId(userId, apiToken, userJwt);

    // Verify the job belongs to the logged-in user
    if (!(await verifyJobOwnership(jobId, userId, apiToken))) {
      return NextResponse.json(
        { error: "Access denied. You can only update your own job postings." },
        { status: 403 }
      );
    }

    // Clean the data - Whitelist only allowed fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'description', 'location', 'jobType', 
      'deadline', 'workplaceType', 'isFeatured', 'isActive',
      'experience', 'jobCode', 'categories'
    ];

    allowedFields.forEach(field => {
      if (body.data[field] !== undefined) {
        updateData[field] = body.data[field];
      }
    });

    // Handle slug regeneration if title changed
    if (updateData.title) {
      updateData.slug = generateSlug(String(updateData.title));
    }

    // Handle jobCode with uniqueness validation
    if (updateData.jobCode) {
      if (await checkJobCodeExists(String(updateData.jobCode), jobId, apiToken)) {
        return NextResponse.json(
          { error: "Job code already exists. Please use a unique job code." },
          { status: 400 }
        );
      }
    }

    // Link company if available
    if (companyId) {
      updateData.company = companyId;
    }

    // Handle salary (Component)
    if (body.data.salary !== undefined) {
      const salary = body.data.salary;
      if (typeof salary === 'object' && salary !== null && !Array.isArray(salary)) {
        updateData.salary = {
          min: salary.min ?? null,
          max: salary.max ?? null,
          currency: salary.currency || "ETB",
          isNegotiable: !!salary.isNegotiable
        };
      } else if (typeof salary === 'number') {
        updateData.salary = salary;
      }
    }

    // Handle categories
    if (updateData.categories !== undefined && !Array.isArray(updateData.categories)) {
      delete updateData.categories;
    }

    // Execute update
    const job = await updateJob(jobId, updateData, userJwt, apiToken);
    return NextResponse.json({ data: job }, { status: 200 });
  } catch (error) {
    console.error("Job update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update job posting";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE handler for deleting jobs
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can delete jobs
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can delete job postings." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("id");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);

    // Verify the job belongs to the logged-in user
    if (!(await verifyJobOwnership(jobId, userId, apiToken))) {
      return NextResponse.json(
        { error: "Access denied. You can only delete your own job postings." },
        { status: 403 }
      );
    }

    // Delete the job
    await deleteJob(jobId, userJwt, apiToken);

    return NextResponse.json(
      { success: true, message: "Job deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Job delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete job posting";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
