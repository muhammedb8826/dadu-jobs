"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Mail, Phone, X } from "lucide-react";
import { GlobalData } from "../types/global.types";

type HeaderProps = {
  data: GlobalData["header"];
  topHeaderData: GlobalData["topHeader"];
  siteName: string;
};

export function Header({ data, topHeaderData, siteName }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("Header component - data:", {
      hasLogo: !!data.logo,
      logoUrl: data.logo?.url,
      navLinksCount: data.navigationLinks.length,
      navGroupsCount: data.navigationGroups.length,
      buttonsCount: data.buttons?.length || 0,
    });
  }

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // Always render header, even if empty
  return (
    <>
      <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-md" data-testid="main-header">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo or Site Name */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              {data.logo ? (
                <div className="relative h-12 w-auto shrink-0">
                  <Image
                    src={data.logo.url}
                    width={192}
                    height={192}
                    alt={data.logo.alternativeText || siteName}
                    className="object-contain"
                    sizes="192px"
                  />
                </div>
              ) : (
                <span className="text-lg font-semibold">{siteName}</span>
              )}
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              {data.navigationLinks && data.navigationLinks.length > 0 && data.navigationLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="text-sm font-medium transition-colors whitespace-nowrap text-white hover:text-(--brand-accent)"
                >
                  {link.label}
                </Link>
              ))}

              {data.navigationGroups && data.navigationGroups.length > 0 && data.navigationGroups.map((group) => (
                <div key={group.label} className="relative group">
                  <button
                    className="text-sm font-medium whitespace-nowrap text-white hover:text-(--brand-accent) transition-colors flex items-center gap-1"
                  >
                    {group.label}
                    <svg
                      className="h-3 w-3 transition-transform group-hover:rotate-180"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <div className="hidden group-hover:block transition duration-150 absolute left-0 top-full min-w-[200px] rounded-md bg-white text-(--brand-black) shadow-lg border border-border/40 z-50">
                    <div className="py-2">
                      {group.links.map((link) => (
                        <Link
                          key={`${group.label}-${link.label}-${link.url}`}
                          href={link.url}
                          target={link.isExternal ? "_blank" : undefined}
                          rel={link.isExternal ? "noopener noreferrer" : undefined}
                          className="block px-4 py-2 text-sm hover:bg-(--brand-accent)/10 hover:text-(--brand-accent)"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {group.links.length === 0 && (
                        <span className="block px-4 py-2 text-sm text-muted-foreground">Coming soon</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </nav>

            {/* Desktop Header Buttons */}
            {data.buttons && data.buttons.length > 0 && (
              <div className="hidden md:flex items-center gap-2">
                {data.buttons.map((button, index) => {
                  const normalizedUrl = button.url && !button.url.startsWith("/") && !button.url.startsWith("http") 
                    ? `/${button.url}` 
                    : button.url;
                  return (
                    <Link
                      key={`header-button-${button.label}-${index}`}
                      href={normalizedUrl}
                      target={button.isExternal ? "_blank" : undefined}
                      rel={button.isExternal ? "noopener noreferrer" : undefined}
                      className={`px-4 py-2 text-sm font-semibold transition ${
                        index === data.buttons.length - 1
                          ? "rounded-md bg-(--brand-accent) text-[#0c0d0f] hover:bg-(--brand-accent)/90"
                          : "rounded-md border border-white/20 text-white hover:bg-white/10"
                      }`}
                    >
                      {button.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 hover:opacity-80 rounded transition-opacity w-10 h-10 flex items-center justify-center"
              aria-label="Menu"
              onClick={() => setIsMenuOpen(true)}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Modal */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-primary text-primary-foreground shadow-xl overflow-y-auto">
            <div className="flex flex-col h-full">
              {/* Close Button */}
              <div className="flex justify-end p-4">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-full bg-(--brand-black) text-(--brand-accent) hover:opacity-80 transition-opacity w-10 h-10 flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-6 py-4">
                <div className="flex flex-col gap-1">
                  {data.navigationLinks.map((link) => (
                    <Link
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      target={link.isExternal ? "_blank" : undefined}
                      rel={link.isExternal ? "noopener noreferrer" : undefined}
                      className="text-lg font-medium py-3 transition-colors hover:text-(--brand-accent)"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {data.navigationGroups.map((group) => (
                    <div key={`m-${group.label}`} className="py-2">
                      <div className="text-sm font-semibold text-white/80 px-1">{group.label}</div>
                      <div className="flex flex-col">
                        {group.links.map((link) => (
                          <Link
                            key={`${group.label}-${link.label}-${link.url}`}
                            href={link.url}
                            target={link.isExternal ? "_blank" : undefined}
                            rel={link.isExternal ? "noopener noreferrer" : undefined}
                            className="text-base py-2 pl-3 transition-colors hover:text-(--brand-accent)"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {link.label}
                          </Link>
                        ))}
                        {group.links.length === 0 && (
                          <span className="text-sm text-white/60 pl-3 py-2">Coming soon</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </nav>

              {/* Contact Section */}
              <div className="px-6 py-6 border-t border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium">Contact us</span>
                  <span className="text-lg">→</span>
                </div>
                
                {topHeaderData.email && (
                    <a
                      href={`mailto:${topHeaderData.email}`}
                      className="flex items-center gap-3 py-2 text-base transition-colors hover:text-(--brand-accent)"
                    onClick={() => setIsMenuOpen(false)}
                  >
                      <Mail className="h-5 w-5" />
                    <span>{topHeaderData.email}</span>
                  </a>
                )}
                
                {topHeaderData.phone && (
                    <a
                      href={`tel:${topHeaderData.phone}`}
                      className="flex items-center gap-3 py-2 text-base transition-colors hover:text-(--brand-accent)"
                    onClick={() => setIsMenuOpen(false)}
                  >
                      <Phone className="h-5 w-5" />
                    <span>{topHeaderData.phone}</span>
                  </a>
                )}
              </div>

              {/* Header Buttons */}
              {data.buttons && data.buttons.length > 0 && (
                <div className="px-6 pb-4 space-y-2">
                  {data.buttons.map((button, index) => {
                    const normalizedUrl = button.url && !button.url.startsWith("/") && !button.url.startsWith("http") 
                      ? `/${button.url}` 
                      : button.url;
                    return (
                      <Link
                        key={`mobile-header-button-${button.label}-${index}`}
                        href={normalizedUrl}
                        target={button.isExternal ? "_blank" : undefined}
                        rel={button.isExternal ? "noopener noreferrer" : undefined}
                        className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
                          index === data.buttons.length - 1
                            ? "bg-(--brand-accent) text-[#0c0d0f] hover:bg-(--brand-accent)/90"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {button.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Buttons */}
              <div className="px-6 pb-6 flex gap-3">
                {topHeaderData.buttons.map((button, index) => (
                  <Link
                    key={`${button.url}-${index}`}
                    href={button.url}
                    className={
                      button.isPrimary
                        ? "flex-1 rounded-lg bg-(--brand-green) px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-(--brand-accent)"
                        : "flex-1 rounded-lg bg-(--brand-black) px-4 py-3 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {button.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

