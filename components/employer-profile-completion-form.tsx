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
import { CheckCircle2, Loader2, AlertCircle, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";

type SocialLink = {
  id?: number;
  label: string;
  url: string;
};

type EmployerProfileFormData = {
  fullName: string;
  jobTitle: string;
  phone: string;
  bio: string;
  profilePicture: number | null;
  companyName: string;
  companyWebsite: string;
  companyIndustry: string;
  companySize: string;
  companyLocation: string;
  companyDescription: string;
  companyTagline: string;
  companyLogo: number | null;
  socialLinks: SocialLink[];
};

export function EmployerProfileCompletionForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companySaveSuccess, setCompanySaveSuccess] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileDocumentId, setProfileDocumentId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [formData, setFormData] = useState<EmployerProfileFormData>({
    fullName: "",
    jobTitle: "",
    phone: "",
    bio: "",
    profilePicture: null,
    companyName: "",
    companyWebsite: "",
    companyIndustry: "",
    companySize: "",
    companyLocation: "",
    companyDescription: "",
    companyTagline: "",
    companyLogo: null,
    socialLinks: [],
  });

  // Load existing profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/employer-profiles?myProfile=true");
        if (response.ok) {
          const result = await response.json();
          if (result?.data) {
            const profile = result.data;
            setProfileId(profile.id);
            setProfileDocumentId(profile.documentId || null);
            
            const strapiUrl = getStrapiURL();
            
            setFormData({
              fullName: profile.fullName || "",
              jobTitle: profile.jobTitle || "",
              phone: profile.phone || "",
              bio: profile.bio || "",
              profilePicture: profile.profilePicture?.id || null,
              companyName: profile.company?.name || "",
              companyWebsite: profile.company?.website || "",
              companyIndustry: profile.company?.industry || "",
              companySize: profile.company?.companySize || "",
              companyLocation: profile.company?.location || "",
              companyDescription: profile.company?.description || "",
              companyTagline: profile.company?.tagline || "",
              companyLogo: profile.company?.logo?.[0]?.id || null,
              socialLinks: profile.company?.socialLinks?.map((link: SocialLink) => ({
                id: link.id,
                label: link.label || "",
                url: link.url || "",
              })) || [],
            });

            if (profile.company?.id) {
              setCompanyId(profile.company.id);
            }

            if (profile.profilePicture && strapiUrl) {
              const imageUrl = resolveImageUrl(profile.profilePicture, strapiUrl);
              setProfilePictureUrl(imageUrl || null);
            }

            if (profile.company?.logo?.[0] && strapiUrl) {
              const logoUrl = resolveImageUrl(profile.company.logo[0], strapiUrl);
              setCompanyLogoUrl(logoUrl || null);
            }
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (field: keyof EmployerProfileFormData, value: string | SocialLink[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addSocialLink = () => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { label: "", url: "" }],
    }));
  };

  const removeSocialLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index),
    }));
  };

  const updateSocialLink = (index: number, field: keyof SocialLink, value: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPicture(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const result = await response.json();
      if (result?.data?.id) {
        setFormData((prev) => ({
          ...prev,
          profilePicture: result.data.id,
        }));

        const strapiUrl = getStrapiURL();
        if (strapiUrl && result.data.url) {
          setProfilePictureUrl(`${strapiUrl}${result.data.url}`);
        }
      }
    } catch (error) {
      console.error("Error uploading picture:", error);
      setSubmitError("Failed to upload profile picture");
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload logo");
      }

      const result = await response.json();
      if (result?.data?.id) {
        setFormData((prev) => ({
          ...prev,
          companyLogo: result.data.id,
        }));

        const strapiUrl = getStrapiURL();
        if (strapiUrl && result.data.url) {
          setCompanyLogoUrl(`${strapiUrl}${result.data.url}`);
        }
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      setSubmitError("Failed to upload company logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    setSubmitError(null);
    setCompanySaveSuccess(false);

    try {
      // Validate required fields
      if (!formData.companyName.trim()) {
        throw new Error("Company name is required");
      }

      const companyData: Record<string, unknown> = {
        name: formData.companyName.trim(),
        industry: formData.companyIndustry || null,
        companySize: formData.companySize || null,
        location: formData.companyLocation || null,
        description: formData.companyDescription || null,
        tagline: formData.companyTagline || null,
      };

      if (formData.companyWebsite.trim()) {
        companyData.website = formData.companyWebsite.trim();
      }

      if (formData.companyLogo) {
        companyData.logo = [formData.companyLogo];
      }

      // Handle social links - always include array (even if empty) to sync with server
      // Filter out only completely empty links (where both label and url are empty)
      // Include all links that have at least one field filled
      if (formData.socialLinks && formData.socialLinks.length > 0) {
        companyData.socialLinks = formData.socialLinks
          .filter((link) => link.label.trim() || link.url.trim())
          .map((link) => ({
            ...(link.id && { id: link.id }),
            label: link.label.trim() || "",
            url: link.url.trim() || "",
          }));
      } else {
        // Always send empty array if no social links to sync with server
        companyData.socialLinks = [];
      }

      // Save company
      const companyUrl = "/api/companies";
      const companyMethod = companyId ? "PUT" : "POST";
      const companyBody = companyId
        ? { data: { id: companyId, ...companyData } }
        : { data: companyData };

      const companyResponse = await fetch(companyUrl, {
        method: companyMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyBody),
      });

      const companyResponseText = await companyResponse.text();
      let companyResult: Record<string, unknown> = {};
      if (companyResponseText) {
        try {
          companyResult = JSON.parse(companyResponseText);
        } catch {
          companyResult = { error: companyResponseText };
        }
      }

      if (!companyResponse.ok) {
        let errorMessage = "Failed to save company";
        
        if (companyResult?.error) {
          if (typeof companyResult.error === "string") {
            errorMessage = companyResult.error;
          } else if (typeof companyResult.error === "object" && companyResult.error !== null && "message" in companyResult.error) {
            errorMessage = (companyResult.error as { message?: string }).message || errorMessage;
          }
        } else if (companyResult?.message && typeof companyResult.message === "string") {
          errorMessage = companyResult.message;
        }
        
        throw new Error(errorMessage);
      }

      // Get company ID from response
      const savedCompany = (companyResult as { data?: { data?: { id?: number; documentId?: string }; id?: number; documentId?: string } })?.data?.data || 
                          (companyResult as { data?: { id?: number; documentId?: string } })?.data;
      if (savedCompany && typeof savedCompany === "object") {
        const newCompanyId = savedCompany.id || savedCompany.documentId;
        if (newCompanyId) {
          const finalCompanyId = typeof newCompanyId === "number" ? newCompanyId : null;
          if (finalCompanyId) {
            setCompanyId(finalCompanyId);
          }
        }
      }

      setCompanySaveSuccess(true);
      setTimeout(() => setCompanySaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving company:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save company");
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setSubmitError(null);
    setProfileSaveSuccess(false);

    try {
      // Validate required fields
      if (!formData.fullName.trim()) {
        throw new Error("Full name is required");
      }

      // Company ID is optional - profile can be saved without company
      // but if company exists, we should use it

      // Save profile with company ID reference (if company exists)
      const profilePayload: Record<string, unknown> = {
        fullName: formData.fullName.trim(),
        jobTitle: formData.jobTitle.trim(),
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
      };

      // Only include company if it exists
      if (companyId) {
        profilePayload.company = companyId;
      }

      if (formData.profilePicture) {
        profilePayload.profilePicture = formData.profilePicture;
      }

      const profileUrl = "/api/employer-profiles";
      const profileMethod = (profileId || profileDocumentId) ? "PUT" : "POST";
      const profileBody = (profileId || profileDocumentId)
        ? { data: { 
            ...(profileDocumentId ? { documentId: profileDocumentId } : {}),
            ...(profileId ? { id: profileId } : {}),
            ...profilePayload 
          } }
        : { data: profilePayload };

      const profileResponse = await fetch(profileUrl, {
        method: profileMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileBody),
      });

      const profileResponseText = await profileResponse.text();
      let profileResult: Record<string, unknown> = {};
      if (profileResponseText) {
        try {
          profileResult = JSON.parse(profileResponseText);
        } catch {
          profileResult = { error: profileResponseText };
        }
      }

      if (!profileResponse.ok) {
        let errorMessage = "Failed to save profile";
        
        if (profileResult?.error) {
          if (typeof profileResult.error === "string") {
            errorMessage = profileResult.error;
          } else if (typeof profileResult.error === "object" && profileResult.error !== null && "message" in profileResult.error) {
            errorMessage = (profileResult.error as { message?: string }).message || errorMessage;
          }
        } else if (profileResult?.message && typeof profileResult.message === "string") {
          errorMessage = profileResult.message;
        }
        
        throw new Error(errorMessage);
      }

      const profileData = (profileResult as { data?: { data?: { id?: number; documentId?: string }; id?: number; documentId?: string } })?.data?.data || 
                          (profileResult as { data?: { id?: number; documentId?: string } })?.data;
      if (profileData && typeof profileData === "object") {
        if ("id" in profileData && profileData.id && !profileId) {
          setProfileId(profileData.id);
        }
        if ("documentId" in profileData && profileData.documentId && !profileDocumentId) {
          setProfileDocumentId(profileData.documentId);
        }
      }

      setProfileSaveSuccess(true);
      setTimeout(() => {
        setProfileSaveSuccess(false);
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSavingProfile(false);
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
    <form className="space-y-6">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {companySaveSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Company saved successfully!</AlertDescription>
        </Alert>
      )}
      {profileSaveSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Profile saved successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your personal and professional details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              placeholder="e.g., John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) => handleInputChange("jobTitle", e.target.value)}
              placeholder="e.g., HR Manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="e.g., 0912345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profilePicture">Profile Picture</Label>
            <div className="flex items-center gap-4">
              {profilePictureUrl && (
                <div className="relative h-20 w-20 overflow-hidden rounded-full border">
                  <Image
                    src={profilePictureUrl}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <Input
                  id="profilePicture"
                  type="file"
                  accept="image/*"
                  onChange={handlePictureUpload}
                  disabled={isUploadingPicture}
                  className="cursor-pointer"
                />
                {isUploadingPicture && (
                  <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button 
              type="button" 
              onClick={handleSaveProfile}
              disabled={isSavingCompany || isSavingProfile}
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Details about your company</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              placeholder="e.g., Acme Corporation"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyTagline">Company Tagline</Label>
            <Input
              id="companyTagline"
              value={formData.companyTagline}
              onChange={(e) => handleInputChange("companyTagline", e.target.value)}
              placeholder="e.g., Building the future"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Website</Label>
              <Input
                id="companyWebsite"
                type="url"
                value={formData.companyWebsite}
                onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyLocation">Location</Label>
              <Input
                id="companyLocation"
                value={formData.companyLocation}
                onChange={(e) => handleInputChange("companyLocation", e.target.value)}
                placeholder="e.g., Addis Ababa, Ethiopia"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyIndustry">Industry</Label>
              <Select
                value={formData.companyIndustry}
                onValueChange={(value) => handleInputChange("companyIndustry", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Hospitality">Hospitality</SelectItem>
                  <SelectItem value="Construction">Construction</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Select
                value={formData.companySize}
                onValueChange={(value) => handleInputChange("companySize", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="I(1-10)">I(1-10)</SelectItem>
                  <SelectItem value="II(11-50)">II(11-50)</SelectItem>
                  <SelectItem value="III(51-200)">III(51-200)</SelectItem>
                  <SelectItem value="IV(201-500)">IV(201-500)</SelectItem>
                  <SelectItem value="V(500+)">V(500+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyDescription">Company Description</Label>
            <Textarea
              id="companyDescription"
              value={formData.companyDescription}
              onChange={(e) => handleInputChange("companyDescription", e.target.value)}
              placeholder="Describe your company, its mission, values, and culture..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyLogo">Company Logo</Label>
            <div className="flex items-center gap-4">
              {companyLogoUrl && (
                <div className="relative h-20 w-20 overflow-hidden rounded border">
                  <Image
                    src={companyLogoUrl}
                    alt="Company Logo"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <Input
                  id="companyLogo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  className="cursor-pointer"
                />
                {isUploadingLogo && (
                  <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>Add your company&apos;s social media links</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSocialLink}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.socialLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No social links added yet.</p>
          ) : (
            <div className="space-y-4">
              {formData.socialLinks.map((link, index) => (
                <div key={index} className="flex gap-4 items-end border-b pb-4 last:border-0">
                  <div className="flex-1 space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={link.label}
                      onChange={(e) => updateSocialLink(index, "label", e.target.value)}
                      placeholder="e.g., Facebook, Twitter, LinkedIn"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={link.url}
                      onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeSocialLink(index)}
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleSaveCompany}
              disabled={isSavingCompany || isSavingProfile}
            >
              {isSavingCompany ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Company...
                </>
              ) : (
                "Save Company"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Button */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
