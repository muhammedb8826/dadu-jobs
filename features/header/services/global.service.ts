import { strapiFetch, getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { StrapiGlobalResponse, GlobalData } from "../types/global.types";

export const EMPTY_GLOBAL_DATA: GlobalData = {
  siteName: "DADU Admission",
  siteDescription: "",
  topHeader: {
    email: undefined,
    phone: undefined,
    socialLinks: [],
    buttons: [],
  },
  header: {
    logo: undefined,
    navigationLinks: [],
    navigationGroups: [],
    ctaButton: undefined,
  },
  footer: {
    copyRight: "© DADU Admission. All rights reserved.",
    about: undefined,
    quickLinks: {
      title: undefined,
      links: [],
    },
    contactInformation: {
      title: undefined,
      address: undefined,
      contacts: [],
    },
    followUs: {
      title: undefined,
      socialLinks: [],
    },
  },
};

// Using Strapi v4 populate format - matches API structure from examples
const GLOBAL_POPULATE = {
  topHeader: {
    populate: "*",
  },
  header: {
    populate: "*",
  },
  footer: {
    populate: {
      about: {
        populate: "*",
      },
      quickLinks: {
        populate: {
          populate: "*",
        },
      },
      contactInformation: {
        populate: {
          populate: "*",
        },
      },
      followUs: {
        populate: "*",
      },
    },
  },
};

export async function fetchGlobalData(): Promise<GlobalData> {
  try {
    const baseUrl = getStrapiURL();
    if (!baseUrl) {
      console.warn("NEXT_PUBLIC_API_BASE_URL is not set");
      return EMPTY_GLOBAL_DATA;
    }

    const response = await strapiFetch<StrapiGlobalResponse>("global", {
      params: { populate: GLOBAL_POPULATE },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    const data = response.data;

    return {
      siteName: data.siteName,
      siteDescription: data.siteDescription,
      topHeader: {
        email: (() => {
          const emailCta = data.topHeader?.cta?.find(
            (item) => item.url?.includes("@") || item.label?.includes("@")
          );
          return emailCta?.url || emailCta?.label || undefined;
        })(),
        phone: (() => {
          const phoneCta = data.topHeader?.cta?.find(
            (item) => item.url?.startsWith("+") || item.label?.startsWith("+")
          );
          return phoneCta?.url || phoneCta?.label || undefined;
        })(),
        socialLinks:
          data.topHeader?.socialIcon?.map((item) => {
            // Extract platform name from iconName (e.g., "ic:baseline-facebook" -> "facebook")
            const iconName = item.icon?.iconName || "";
            const platformMatch = iconName.match(
              /(?:ic:baseline-|mdi:)([\w-]+)/
            );
            const platform = platformMatch
              ? platformMatch[1]
              : iconName.split(":")[1] || "";

            return {
              platform: platform.toLowerCase(),
              url: item.url || "",
              iconName: iconName,
              iconData: item.icon?.iconData,
            };
          }) || [],
        buttons:
          data.topHeader?.button?.map((btn) => ({
            label: btn.title || "",
            url: btn.url || "#",
            // Mark primary button (usually the last one or one with specific keywords)
            isPrimary:
              btn.title?.toLowerCase().includes("register") ||
              btn.title?.toLowerCase().includes("apply") ||
              false,
          })) || [],
      },
      header: {
        logo: (() => {
          if (!data.header?.logo?.url) return undefined;
          const resolvedUrl = resolveImageUrl(data.header.logo, getStrapiURL());
          if (!resolvedUrl) return undefined;
          return {
            url: resolvedUrl,
            alternativeText: data.header.logo.alternativeText || undefined,
          };
        })(),
        navigationLinks: [
          ...(data.header?.menu?.map((item) => ({
            label: item.title,
            url: item.url,
            isExternal: item.isExternal,
          })) || []),
        ],
        navigationGroups:
          data.header?.subMenu?.map((group) => ({
            label: group.title,
            links:
              group.subMenu?.map((link) => ({
                label: link.title,
                url: link.url || "#",
                isExternal: link.isExternal,
              })) || [],
          })) || [],
        ctaButton:
          data.header?.button && data.header.button.length > 0
            ? {
                label: data.header.button[0].title,
                url: data.header.button[0].url,
                isExternal: data.header.button[0].isExternal,
              }
            : undefined,
      },
      footer: {
        copyRight:
          data.footer?.copyRight || "© DADU Admission. All rights reserved.",
        about: data.footer?.about
          ? {
              title: data.footer.about.title || undefined,
              description: data.footer.about.description || undefined,
            }
          : undefined,
        quickLinks: {
          title: data.footer?.quickLinks?.title || "Quick Links",
          links:
            data.footer?.quickLinks?.link?.map((link) => ({
              label: link.title,
              url: link.url,
              isExternal: link.isExternal,
            })) || [],
        },
        contactInformation: {
          title: data.footer?.contactInformation?.title || "Contact Us",
          address: data.footer?.contactInformation?.address || undefined,
          contacts:
            data.footer?.contactInformation?.link?.map((link) => ({
              label: link.label || link.url || undefined,
              url: link.url || undefined,
              iconName: link.icon?.iconName || undefined,
              iconData: link.icon?.iconData || undefined,
            })) || [],
        },
        followUs: {
          title: data.footer?.followUs?.title || "Follow Us",
          socialLinks:
            data.footer?.followUs?.socialLinks?.map((social) => ({
              url: social.url || undefined,
              iconName: social.icon?.iconName || undefined,
              iconData: social.icon?.iconData || undefined,
            })) || [],
        },
      },
    };
  } catch (error) {
    console.error("Error fetching global data:", error);
    return EMPTY_GLOBAL_DATA;
  }
}
