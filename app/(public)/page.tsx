import Image from "next/image";
import Link from "next/link";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HomePageButton = {
  id: number;
  title: string;
  url: string;
  isExternal?: boolean;
};

type HomePageImage = {
  url: string;
  alternativeText?: string | null;
  formats?: Record<string, { url: string }>;
};

type CardIcon = {
  width?: number;
  height?: number;
  iconData?: string;
  iconName?: string;
};

type HowItWorksCard = {
  id: number;
  icon?: CardIcon | HomePageImage | { name?: string; url?: string; alternativeText?: string | null } | string | null;
  title?: string;
  description?: string;
};

type HeroBlock = {
  __component: "components.hero-section";
  id: number;
  heading?: string;
  subHeading?: string;
  image?: HomePageImage | null;
  button?: HomePageButton[];
};

type HowItWorksSection = {
  id: number;
  title?: string;
  cards?: HowItWorksCard[];
};

type HowItWorksBlock = {
  __component: "components.how-it-works";
  id: number;
  heading?: string;
  subHeading?: string;
  forCandidates?: HowItWorksSection | null;
  forEmployers?: HowItWorksSection | null;
};

type HomePageBlock = HeroBlock | HowItWorksBlock;

type HomePageResponse = {
  data?: {
    title?: string;
    blocks?: HomePageBlock[];
  } | null;
};

function getButtonHref(button: HomePageButton): string {
  if (!button.url) {
    return "/";
  }
  if (button.url.startsWith("http://") || button.url.startsWith("https://")) {
    return button.url;
  }
  return button.url.startsWith("/") ? button.url : `/${button.url}`;
}

function resolveBlockImage(image?: HomePageImage | null): string | null {
  if (!image?.url) {
    return null;
  }
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    return null;
  }
  return resolveImageUrl(image, strapiUrl) || null;
}

function resolveCardIcon(
  icon?: CardIcon | HomePageImage | { name?: string; url?: string } | string | null
): string | null {
  if (!icon) {
    return null;
  }

  if (typeof icon === "string") {
    if (icon.startsWith("http://") || icon.startsWith("https://")) {
      return icon;
    }
    const strapiUrl = getStrapiURL();
    if (icon.startsWith("/") && strapiUrl) {
      return `${strapiUrl}${icon}`;
    }
    return null;
  }

  if ("url" in icon && icon.url) {
    return resolveBlockImage(icon as HomePageImage);
  }

  return null;
}

function getCardIconSvg(icon?: HowItWorksCard["icon"]): { svg: string; label?: string } | null {
  if (!icon || typeof icon === "string" || "url" in (icon as { url?: string })) {
    return null;
  }

  const iconData = "iconData" in icon ? icon.iconData : undefined;
  if (!iconData) {
    return null;
  }

  return {
    svg: iconData,
    label: "iconName" in icon ? icon.iconName : undefined,
  };
}

async function getHomePage(): Promise<HomePageResponse> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    return {};
  }

  const response = await fetch(
    `${strapiUrl}/api/home-page?populate[blocks][on][components.hero-section][populate]=*&populate[blocks][on][components.how-it-works][populate][forCandidates][populate][cards][populate]=*&populate[blocks][on][components.how-it-works][populate][forEmployers][populate][cards][populate]=*`,
    {
    method: "GET",
    cache: "no-store",
    }
  );

  if (!response.ok) {
    return {};
  }

  return response.json();
}

export default async function Home() {
  const homepage = await getHomePage();
  const blocks = homepage.data?.blocks || [];
  const heroBlock = blocks.find((block) => block.__component === "components.hero-section") as HeroBlock | undefined;
  const howItWorksBlock = blocks.find((block) => block.__component === "components.how-it-works") as HowItWorksBlock | undefined;

  const heroImageUrl = heroBlock ? resolveBlockImage(heroBlock.image) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {heroBlock && (
          <section className="border-b bg-muted/10">
            <div className="flex flex-col-reverse items-center gap-10 py-12 md:flex-row">
            <div className="flex-1 space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                {heroBlock.heading}
              </h1>
              {heroBlock.subHeading && (
                <p className="text-base text-muted-foreground md:text-lg">
                  {heroBlock.subHeading}
                </p>
              )}
              {heroBlock.button && heroBlock.button.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {heroBlock.button.map((button, index) => {
                    const href = getButtonHref(button);
                    if (button.isExternal) {
                      return (
                        <Button key={button.id} variant={index === 0 ? "default" : "outline"} asChild>
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {button.title}
                          </a>
                        </Button>
                      );
                    }
                    return (
                      <Button key={button.id} variant={index === 0 ? "default" : "outline"} asChild>
                        <Link href={href}>{button.title}</Link>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
            {heroImageUrl && (
              <div className="flex-1">
                <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={heroImageUrl}
                    alt={heroBlock.image?.alternativeText || "Hero image"}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            )}
            </div>
          </section>
        )}

        {howItWorksBlock && (
          <section className="py-12">
            <div className="mb-8 max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                {howItWorksBlock.heading}
              </h2>
              {howItWorksBlock.subHeading && (
                <p className="text-sm text-muted-foreground md:text-base">
                  {howItWorksBlock.subHeading}
                </p>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                { key: "candidates", section: howItWorksBlock.forCandidates },
                { key: "employers", section: howItWorksBlock.forEmployers },
              ].map(({ key, section }) => {
                if (!section) {
                  return null;
                }
                return (
                  <Card key={`${key}-${section.id}`} className="h-full">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <div className="space-y-3">
                        {(section.cards || []).map((card) => {
                          const iconUrl = resolveCardIcon(card.icon);
                          const iconLabel =
                            typeof card.icon === "string"
                              ? card.icon
                              : "name" in (card.icon || {})
                                ? (card.icon as { name?: string }).name
                                : undefined;
                          const iconSvg = getCardIconSvg(card.icon);

                          return (
                            <div key={`${section.id}-${card.id}`} className="rounded-lg border p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                  {iconUrl ? (
                                    <Image
                                      src={iconUrl}
                                      alt={card.title || "Feature"}
                                      width={24}
                                      height={24}
                                    />
                                  ) : iconSvg ? (
                                    <svg
                                      viewBox="0 0 24 24"
                                      width="24"
                                      height="24"
                                      aria-label={iconSvg.label || card.title || "Feature"}
                                      role="img"
                                      dangerouslySetInnerHTML={{ __html: iconSvg.svg }}
                                    />
                                  ) : iconLabel ? (
                                    iconLabel.slice(0, 2).toUpperCase()
                                  ) : (
                                    <span className="text-base">•</span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
                                  {card.description && (
                                    <p className="text-sm text-muted-foreground">{card.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

