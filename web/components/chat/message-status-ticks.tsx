"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ChatMessage } from "../../types/chat";

export type MessageReceiptStatus = "sent" | "delivered" | "read";

/** WhatsApp-style receipt: read beats delivered beats sent. */
export function getMessageReceiptStatus(msg: ChatMessage): MessageReceiptStatus {
  if (msg.status === "read" || msg.seen || msg.readAt) return "read";
  if (msg.status === "delivered" || msg.deliveredAt) return "delivered";
  return "sent";
}

/** Group chats: blue ticks only once every other participant has seen the message. */
export function getGroupMessageReceiptStatus(
  msg: ChatMessage,
  otherParticipantIds: string[]
): MessageReceiptStatus {
  const seenBy = new Set((msg.seenBy ?? []).map(String));
  if (
    otherParticipantIds.length > 0 &&
    otherParticipantIds.every((id) => seenBy.has(id))
  ) {
    return "read";
  }
  if (msg.seen) return "read";
  if (seenBy.size > 0 || msg.status === "delivered" || msg.deliveredAt) return "delivered";
  return "sent";
}

export function messageTime(msg: ChatMessage): string | undefined {
  return msg.createdAt || msg.timestamp || undefined;
}

/**
 * WhatsApp-style ticks on outgoing bubbles:
 * one grey check = sent, two grey = delivered, two blue = read.
 */
export function MessageStatusTicks({
  status,
  className,
}: {
  status: MessageReceiptStatus;
  className?: string;
}) {
  const label = status === "read" ? "Read" : status === "delivered" ? "Delivered" : "Sent";
  const color = status === "read" ? "text-[#53bdeb]" : "text-white/75";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      title={label}
      aria-label={label}
    >
      {status === "sent" ? (
        <Check className={cn("h-3.5 w-3.5", color)} strokeWidth={2.5} />
      ) : (
        <CheckCheck className={cn("h-3.5 w-3.5", color)} strokeWidth={2.5} />
      )}
    </span>
  );
}
