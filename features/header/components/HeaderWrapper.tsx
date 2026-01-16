import { fetchGlobalData } from "../services/global.service";
import { TopHeader } from "./TopHeader";
import { Header } from "./Header";

export async function HeaderWrapper() {
  const globalData = await fetchGlobalData();

  // Debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("HeaderWrapper - globalData:", {
      siteName: globalData.siteName,
      hasTopHeader: !!globalData.topHeader,
      hasHeader: !!globalData.header,
      topHeaderEmail: globalData.topHeader.email,
      topHeaderPhone: globalData.topHeader.phone,
      topHeaderButtons: globalData.topHeader.buttons.length,
      headerLogo: globalData.header.logo?.url,
      headerNavLinks: globalData.header.navigationLinks.length,
    });
  }

  return (
    <>
      <TopHeader data={globalData.topHeader} />
      <Header
        data={globalData.header}
        topHeaderData={globalData.topHeader}
        siteName={globalData.siteName}
      />
    </>
  );
}

