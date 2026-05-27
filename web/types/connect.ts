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
  /** 12-grid column width (1-12). Adjacent blocks summing <=12 share a row. */
  col?: number;
  /** Per-block color overrides. '' / undefined = inherit page default. */
  backgroundColor?: string;
  color?: string;
  /** Bold text: true = fontWeight 700 for text, 800 for heading */
  bold?: boolean;
  /** Text alignment. Heading defaults to center, text defaults to left. */
  align?: "left" | "center" | "right";
  /** Font size tier */
  fontSize?: "small" | "normal" | "large";
  /** Stack this block into the last column of the previous row */
  stacked?: boolean;
};

export type ConnectPageOwner = {
  _id: string;
  username?: string;
  fullName?: string;
  profilePic?: string;
};

export type BuyItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  active: boolean;
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
  websiteBackground?: string;
  websiteTextColor?: string;
  subscriptionBackground?: string;
  subscriptionTextColor?: string;
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
  buyItems?: BuyItem[];
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
