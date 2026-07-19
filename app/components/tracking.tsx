import type { TrackingSettings } from "../../workers/lib/tracking";
import { TRACKER_FIELDS } from "../../workers/lib/tracking";

/**
 * Official analytics snippets with a shelter's validated IDs interpolated.
 *
 * The IDs are whitelist-validated both when saved and again when parsed
 * back out of seo_json (see parseSeo), so nothing here can carry markup.
 * As a final guard we re-check each value against its pattern before
 * rendering — an ID that fails simply renders nothing.
 */
function safe(t: TrackingSettings, key: keyof TrackingSettings): string {
  const field = TRACKER_FIELDS.find((f) => f.key === key);
  const value = t[key];
  return field && value && field.pattern.test(value) ? value : "";
}

export function TrackingTags({ tracking }: { tracking: TrackingSettings }) {
  const ga4 = safe(tracking, "ga4");
  const gtm = safe(tracking, "gtm");
  const pixel = safe(tracking, "meta_pixel");
  const plausible = safe(tracking, "plausible");
  if (!ga4 && !gtm && !pixel && !plausible) return null;

  return (
    <>
      {ga4 && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`,
            }}
          />
        </>
      )}
      {gtm && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
          }}
        />
      )}
      {pixel && (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`,
          }}
        />
      )}
      {plausible && (
        <script defer data-domain={plausible} src="https://plausible.io/js/script.js" />
      )}
    </>
  );
}
