"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertCircle, Plus, X, Upload, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";

type Skill = {
  id?: number;
  documentId?: string;
  skillName: string;
  level: string;
};

type Education = {
  id?: number;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description?: string;
};

type Experience = {
  id?: number;
  companyName: string;
  jobTitle: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: Array<{
    type: string;
    children?: Array<{ text?: string }>;
  }>;
};

type CandidateProfileFormData = {
  fullName: string;
  phone: string;
  bio: string;
  profilePicture: number | null;
  resume: number | null;
  skills: Skill[];
  education: Education[];
  experience: Experience[];
};

type CandidateProfile = {
  id: number;
  documentId: string;
  fullName: string;
  phone?: string;
  bio?: string;
  profilePicture?: {
    id: number;
    url: string;
    formats?: Record<string, { url: string }>;
    alternativeText?: string | null;
  } | null;
  resume?: {
    id: number;
    url: string;
    name: string;
  } | null;
  skills?: Array<{
    id: number;
    documentId?: string;
    skillName: string;
    level: string;
  }>;
  education?: Array<Education>;
  experience?: Array<Experience>;
};

type CandidateProfileCompletionFormProps = {
  initialData?: Partial<CandidateProfile> | null;
  isEditMode?: boolean;
};

const PROFILE_DOC_KEY = "dadu_candidate_profile_documentId";
const SKILL_LEVELS = ["Beginner", "Intermediate", "Expert"] as const;

function normalizeSkillLevel(level?: string | null): string {
  if (level && (SKILL_LEVELS as readonly string[]).includes(level)) return level;
  const lower = String(level || "").toLowerCase();
  if (lower === "advanced" || lower === "proficient") return "Intermediate";
  if (lower === "junior" || lower === "basic") return "Beginner";
  if (lower === "senior" || lower === "master") return "Expert";
  return "Intermediate";
}

function profileToFormData(profile: Partial<CandidateProfile>): CandidateProfileFormData {
  return {
    fullName: profile.fullName || "",
    phone: profile.phone || "",
    bio: profile.bio || "",
    profilePicture: profile.profilePicture?.id || null,
    resume: profile.resume?.id || null,
    skills:
      profile.skills?.map((s) => ({
        id: s.id,
        documentId: s.documentId,
        skillName: s.skillName,
        level: normalizeSkillLevel(s.level),
      })) || [],
    education:
      profile.education?.map((e) => ({
        id: e.id,
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })) || [],
    experience:
      profile.experience?.map((e) => ({
        id: e.id,
        companyName: e.companyName,
        jobTitle: e.jobTitle,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        description: e.description,
      })) || [],
  };
}

export function CandidateProfileCompletionForm({
  initialData,
  isEditMode = false,
}: CandidateProfileCompletionFormProps = {}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(initialData?.id || null);
  const [profileDocumentId, setProfileDocumentId] = useState<string | null>(
    initialData?.documentId || null
  );
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  const [formData, setFormData] = useState<CandidateProfileFormData>(() =>
    profileToFormData(initialData || {})
  );

  const applyProfile = (profile: Partial<CandidateProfile>) => {
    setProfileId(profile.id ?? null);
    setProfileDocumentId(profile.documentId ?? null);
    if (profile.documentId && typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_DOC_KEY, profile.documentId);
    }
    setFormData(profileToFormData(profile));

    const strapiUrl = getStrapiURL();
    if (profile.profilePicture && strapiUrl) {
      setProfilePictureUrl(resolveImageUrl(profile.profilePicture, strapiUrl) || null);
    }
    if (profile.resume?.url && strapiUrl) {
      setResumeUrl(`${strapiUrl}${profile.resume.url}`);
    }
  };

  // Load saved profile: server initialData first, then API (+ localStorage claim)
  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        if (initialData?.fullName || initialData?.documentId) {
          applyProfile(initialData);
          if (!cancelled) setIsLoading(false);
          return;
        }

        const storedDocId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(PROFILE_DOC_KEY)
            : null;
        const claimQuery = storedDocId
          ? `&claimDocumentId=${encodeURIComponent(storedDocId)}`
          : "";
        const response = await fetch(
          `/api/candidate-profiles?myProfile=true${claimQuery}`
        );
        if (response.ok) {
          const result = await response.json();
          if (result?.data && !cancelled) {
            applyProfile(result.data);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount / when server data arrives
  }, [initialData?.documentId, initialData?.id, isEditMode]);

  const handleFileUpload = async (file: File, type: "picture" | "resume") => {
    if (type === "picture") {
      setIsUploadingPicture(true);
    } else {
      setIsUploadingResume(true);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload file");
      }

      const uploadedFile = result[0] || result;
      const fileId = uploadedFile.id;

      if (type === "picture") {
        setFormData((prev) => ({ ...prev, profilePicture: fileId }));
        const strapiUrl = getStrapiURL();
        if (strapiUrl && uploadedFile.url) {
          setProfilePictureUrl(resolveImageUrl(uploadedFile, strapiUrl) || null);
        }
      } else {
        setFormData((prev) => ({ ...prev, resume: fileId }));
        const strapiUrl = getStrapiURL();
        if (strapiUrl && uploadedFile.url) {
          setResumeUrl(`${strapiUrl}${uploadedFile.url}`);
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      if (type === "picture") {
        setIsUploadingPicture(false);
      } else {
        setIsUploadingResume(false);
      }
    }
  };

  // Generic helper to update array items (preserves IDs for existing entries)
  const updateArrayItem = <T extends { id?: number }>(
    field: 'skills' | 'education' | 'experience',
    index: number,
    key: string,
    value: unknown
  ) => {
    setFormData((prev) => {
      const newArray = [...prev[field]] as unknown as T[];
      newArray[index] = { ...newArray[index], [key]: value } as T;
      return { ...prev, [field]: newArray as unknown as typeof prev[typeof field] };
    });
  };

  // Generic helper to remove items from arrays
  const removeItem = (field: 'skills' | 'education' | 'experience', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const addSkill = () => {
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, { skillName: "", level: "Intermediate" }],
    }));
  };

  const removeSkill = (index: number) => {
    removeItem('skills', index);
  };

  const updateSkill = (index: number, field: keyof Skill, value: string) => {
    updateArrayItem<Skill>('skills', index, field, value);
  };

  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: "",
          degree: "",
          fieldOfStudy: "",
          startDate: "",
          endDate: "",
          description: "",
        },
      ],
    }));
  };

  const removeEducation = (index: number) => {
    removeItem('education', index);
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    updateArrayItem<Education>('education', index, field, value);
  };

  const addExperience = () => {
    setFormData((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          companyName: "",
          jobTitle: "",
          location: "",
          startDate: "",
          endDate: "",
          isCurrent: false,
          description: [{ type: "paragraph", children: [{ text: "", type: "text" }] }],
        },
      ],
    }));
  };

  const removeExperience = (index: number) => {
    removeItem('experience', index);
  };

  const updateExperience = (index: number, field: keyof Experience, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === index ? { ...exp, [field]: value } : exp
      ),
    }));
  };

  const updateExperienceDescription = (index: number, text: string) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === index
          ? {
              ...exp,
              description: [
                {
                  type: "paragraph",
                  children: [{ text, type: "text" }],
                },
              ],
            }
          : exp
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSubmitError(null);

    try {
      // Validate required fields
      if (!formData.fullName.trim()) {
        throw new Error("Full name is required");
      }

      // Prepare payload
      // ALWAYS include skills, education, and experience (even if empty arrays)
      // This ensures the server state matches the frontend state
      const payload: Record<string, unknown> = {
        fullName: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
      };

      if (formData.profilePicture) {
        payload.profilePicture = formData.profilePicture;
      }

      if (formData.resume) {
        payload.resume = formData.resume;
      }

      // Handle skills - for manyToOne relation, we need to send IDs or objects
      // The API route will process objects and convert them to IDs
      // Send objects for new skills (no ID), IDs for existing skills
      // ALWAYS include this array, even if empty, to sync with server
      payload.skills = formData.skills
        .map((skill) => {
          // Prefer documentId for Strapi 5 relation linking
          if (skill.documentId || skill.id) {
            return {
              ...(skill.documentId ? { documentId: skill.documentId } : {}),
              ...(skill.id ? { id: skill.id } : {}),
              skillName: skill.skillName,
              level: normalizeSkillLevel(skill.level),
            };
          }
          if (skill.skillName && skill.level) {
            return {
              skillName: skill.skillName.trim(),
              level: normalizeSkillLevel(skill.level),
            };
          }
          return null;
        })
        .filter((skill): skill is NonNullable<typeof skill> => skill !== null);

      // Education and experience are components - can be passed as arrays
      // Include ID if present (for updates), omit if not (for creates)
      // ALWAYS include these arrays, even if empty, to sync with server
      payload.education = formData.education.map((edu) => {
        const eduData: Record<string, unknown> = {
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.fieldOfStudy,
          startDate: edu.startDate,
          endDate: edu.endDate,
        };
        if (edu.description) {
          eduData.description = edu.description;
        }
        // Include ID if present (for updates)
        if (edu.id) {
          eduData.id = edu.id;
        }
        return eduData;
      });

      payload.experience = formData.experience.map((exp) => {
        const expData: Record<string, unknown> = {
          companyName: exp.companyName,
          jobTitle: exp.jobTitle,
          startDate: exp.startDate,
        };
        if (exp.location) {
          expData.location = exp.location;
        }
        if (exp.endDate) {
          expData.endDate = exp.endDate;
        }
        if (exp.isCurrent !== undefined) {
          expData.isCurrent = exp.isCurrent;
        }
        if (exp.description) {
          expData.description = exp.description;
        }
        // Include ID if present (for updates)
        if (exp.id) {
          expData.id = exp.id;
        }
        return expData;
      });

      const url = "/api/candidate-profiles";
      const method = (profileId || profileDocumentId) ? "PUT" : "POST";
      const body = (profileId || profileDocumentId)
        ? { data: { 
            ...(profileDocumentId ? { documentId: profileDocumentId } : {}),
            ...(profileId ? { id: profileId } : {}),
            ...payload 
          } }
        : { data: payload };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let result: Record<string, unknown> = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch {
          result = { error: responseText };
        }
      }

      if (!response.ok) {
        let errorMessage = "Failed to save profile";
        
        if (result?.error) {
          if (typeof result.error === "string") {
            errorMessage = result.error;
          } else if (typeof result.error === "object" && result.error !== null && "message" in result.error) {
            errorMessage = (result.error as { message?: string }).message || errorMessage;
          }
        } else if (result?.message && typeof result.message === "string") {
          errorMessage = result.message;
        }
        
        throw new Error(errorMessage);
      }

      const profileData =
        (result as { data?: { data?: CandidateProfile; id?: number; documentId?: string } })
          ?.data?.data ||
        (result as { data?: CandidateProfile })?.data;
      if (profileData && typeof profileData === "object") {
        applyProfile(profileData as CandidateProfile);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/candidate-profile");
        router.refresh();
      }, 1200);
    } catch (error) {
      console.error("Error saving profile:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {submitSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription>Profile saved. Opening your profile…</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>
            Name, phone, and bio are enough to get started — you can add more later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+251-XX-XXX-XXXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us about yourself..."
              rows={5}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-4">
                {profilePictureUrl ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border">
                    <Image
                      src={profilePictureUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "picture");
                    }}
                    disabled={isUploadingPicture}
                  />
                  {isUploadingPicture && (
                    <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resume/CV</Label>
              <div className="flex items-center gap-4">
                {resumeUrl ? (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Resume
                  </a>
                ) : null}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "resume");
                    }}
                    disabled={isUploadingResume}
                  />
                  {isUploadingResume && (
                    <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Skills</CardTitle>
              <CardDescription>Your professional skills and proficiency levels</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSkill}>
              <Plus className="w-4 h-4 mr-1" /> Add Skill
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            formData.skills.map((skill, index) => (
              <div key={skill.id || index} className="flex gap-4 items-end border-b pb-4 last:border-0">
                <div className="flex-1 space-y-2">
                  <Label>Skill Name</Label>
                  <Input
                    value={skill.skillName}
                    onChange={(e) => updateSkill(index, "skillName", e.target.value)}
                    placeholder="e.g., JavaScript"
                  />
                </div>
                <div className="w-40 space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={skill.level}
                    onValueChange={(value) => updateSkill(index, "level", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={() => removeSkill(index)}
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Education</CardTitle>
              <CardDescription>Your educational background</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEducation}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Education
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {formData.education.length === 0 ? (
            <p className="text-sm text-muted-foreground">No education entries yet.</p>
          ) : (
            formData.education.map((edu, index) => (
              <div key={edu.id || index} className="relative grid grid-cols-2 gap-4 border p-4 rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-destructive"
                  onClick={() => removeEducation(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="col-span-2 space-y-2">
                  <Label>Institution</Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) => updateEducation(index, "institution", e.target.value)}
                    placeholder="University Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) => updateEducation(index, "degree", e.target.value)}
                    placeholder="e.g., BSc, MSc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Field of Study</Label>
                  <Input
                    value={edu.fieldOfStudy}
                    onChange={(e) => updateEducation(index, "fieldOfStudy", e.target.value)}
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={edu.startDate}
                    onChange={(e) => updateEducation(index, "startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={edu.endDate}
                    onChange={(e) => updateEducation(index, "endDate", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={edu.description || ""}
                    onChange={(e) => updateEducation(index, "description", e.target.value)}
                    placeholder="Additional details about your education..."
                    rows={3}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Work Experience</CardTitle>
              <CardDescription>Your professional work experience</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExperience}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Experience
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {formData.experience.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work experience entries yet.</p>
          ) : (
            formData.experience.map((exp, index) => (
              <div key={exp.id || index} className="relative space-y-4 p-4 border rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-destructive"
                  onClick={() => removeExperience(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input
                      value={exp.jobTitle}
                      onChange={(e) => updateExperience(index, "jobTitle", e.target.value)}
                      placeholder="e.g., Software Developer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={exp.companyName}
                      onChange={(e) => updateExperience(index, "companyName", e.target.value)}
                      placeholder="Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={exp.location || ""}
                      onChange={(e) => updateExperience(index, "location", e.target.value)}
                      placeholder="City, Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(index, "startDate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={exp.endDate || ""}
                      onChange={(e) => updateExperience(index, "endDate", e.target.value)}
                      disabled={exp.isCurrent}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`current-${index}`}
                        checked={exp.isCurrent || false}
                        onChange={(e) => updateExperience(index, "isCurrent", e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`current-${index}`} className="cursor-pointer">
                        Currently working here
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={
                      exp.description?.[0]?.children?.[0]?.text || ""
                    }
                    onChange={(e) => updateExperienceDescription(index, e.target.value)}
                    placeholder="Describe your responsibilities and achievements..."
                    rows={4}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {profileDocumentId ? "Editing saved profile" : "Creating your candidate profile"}
          </p>
          <div className="flex flex-1 justify-end gap-3 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/candidate-profile")}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="min-w-[140px]">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : profileDocumentId ? (
                "Save changes"
              ) : (
                "Save profile"
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
