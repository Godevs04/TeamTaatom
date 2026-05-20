import React, { memo } from 'react';

export type ConnectWebsiteAdProps = {
  pageId: string;
  skipAds?: boolean;
};

function ConnectWebsiteAdComponent(_props: ConnectWebsiteAdProps) {
  return null;
}

export const ConnectWebsiteAd = memo(ConnectWebsiteAdComponent);
export default ConnectWebsiteAd;
