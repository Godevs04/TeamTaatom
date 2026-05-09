/** Connect / creator pages — aligned with backend ConnectPage model */

export type ContentBlockType =
  | "heading"
  | "text"
  | "image"
  | "video"
  | "button"
  | "divider"
  | "embed";

export type ContentBlock = {
  _id?: string;
  type: ContentBlockType;
  content: string;
  order: number;
  url?: string;
  embedType?: "youtube" | "map" | "custom" | "";
};

export type CanvasElement = {
  _id?: string;
  type: "text" | "image" | "video";
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  zIndex?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: string;
  backgroundColor?: string;
};

export type ConnectPageOwner = {
  _id: string;
  username?: string;
  fullName?: string;
  profilePic?: string;
};

export type ConnectPage = {
  _id: string;
  userId: ConnectPageOwner | string;
  name: string;
  type: "public" | "private";
  profileImage?: string;
  bannerImage?: string;
  bio?: string;
  features: {
    website: boolean;
    groupChat: boolean;
    subscription: boolean;
  };
  websiteContent?: ContentBlock[];
  subscriptionContent?: ContentBlock[];
  canvasContent?: CanvasElement[];
  canvasBackground?: string;
  subscriptionPrice?: number | null;
  subscriptionCurrency?: string;
  subscriptionApproval?: {
    status: "none" | "pending" | "approved" | "rejected";
    requestedPrice?: number | null;
  };
  category?: "connect" | "community";
  isAdminPage?: boolean;
  chatRoomId?: string | null;
  followerCount?: number;
  viewCount?: number;
  isFollowing?: boolean;
  status?: string;
  createdAt?: string;
};

export type ConnectPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SubscriptionStatusPayload = {
  isSubscribed: boolean;
  subscription: {
    _id: string;
    status: string;
    amount: number;
    activatedAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
};

export type PageAnalytics = {
  totalFollowers: number;
  totalViews: number;
  followerGrowth: { date: string; count: number }[];
  viewGrowth: { date: string; count: number }[];
};

export type PayoutFeeStructure = {
  gatewayFeePercent: number;
  fxChargePercent: number;
  commissionPercent: number;
  gstPercent: number;
  wiseFeePercent: number;
};

/** Creator earnings preview — matches GET /connect/subscription/payout-preview/:id */
export type PayoutPreview = {
  grossAmount: number;
  gatewayFee: number;
  gatewayFeePercent: number;
  fxCharge: number;
  netAfterGateway: number;
  commissionPercent: number;
  commissionAmount: number;
  gstPercent: number;
  gstAmount: number;
  taatoKeeps: number;
  wiseFee: number;
  wiseFeePercent: number;
  creatorPayout: number;
  currency: string;
  currencySymbol: string;
  isInternational: boolean;
  feeStructure: PayoutFeeStructure;
  note: string;
};
