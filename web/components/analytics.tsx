"use client";

import Script from "next/script";
import { getClientEnv } from "../lib/env";

/**
 * Analytics placeholder: inject GA4 and/or GTM when IDs are set.
 * Enable only in staging/production via NEXT_PUBLIC_APP_ENV or NODE_ENV.
 */
export function Analytics() {
  const env = getClientEnv();
  const gaId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gtmId = env.NEXT_PUBLIC_GTM_ID;
  const isProd = env.NEXT_PUBLIC_APP_ENV === "production" || env.NEXT_PUBLIC_APP_ENV === "staging";

  if (!isProd && !gaId && !gtmId) return null;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { send_page_view: true });
            `}
          </Script>
        </>
      )}
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
      )}
    </>
  );
}
