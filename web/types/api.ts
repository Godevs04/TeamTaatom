export type ApiError = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: any;
  };
  message?: string;
};

export type PaginationOffset = {
  currentPage: number;
  totalPages: number;
  totalPosts?: number;
  totalShorts?: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
};

export type PaginationCursor = {
  cursor?: string;
  hasNextPage: boolean;
  limit: number;
};

