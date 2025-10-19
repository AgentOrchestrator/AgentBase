'use client';

import { ChatHistory } from "@/lib/supabase";
import { SessionContent } from "./session-content";
import { useEffect, useRef, useState } from "react";

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface SessionPageProps {
  session: ChatHistory;
  userInfo?: UserInfo | null;
}

export function SessionPageContent({ session, userInfo }: SessionPageProps) {
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
  const messageRefs = useRef<Record<number, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const projectPath = session.metadata?.projectPath || "/";

  useEffect(() => {
    const handleScroll = () => {
      // Find all user messages and their positions relative to viewport
      const userMessagePositions: Array<{ index: number; element: HTMLElement; top: number; bottom: number }> = [];
      
      Object.entries(messageRefs.current).forEach(([index, el]) => {
        if (el && messages[parseInt(index)]?.role === 'user') {
          const rect = el.getBoundingClientRect();
          userMessagePositions.push({
            index: parseInt(index),
            element: el,
            top: rect.top,
            bottom: rect.bottom
          });
        }
      });

      // Sort by index to get chronological order
      userMessagePositions.sort((a, b) => a.index - b.index);

      // Find the most recent user message that has scrolled past the top of viewport
      let activeIndex: number | null = null;
      
      // Look for the most recent user message that has scrolled past the top
      for (let i = userMessagePositions.length - 1; i >= 0; i--) {
        const { index, top, bottom } = userMessagePositions[i];
        
        // If this user message has scrolled past the top of the viewport
        if (top < 0) {
          // This is the most recent user message that has scrolled past
          activeIndex = index;
          break;
        }
      }

      // Debug logging
      console.log('Scroll positions:', userMessagePositions.map(p => ({ index: p.index, top: p.top })));
      console.log('Active index:', activeIndex);

      setActiveMessageIndex(activeIndex);
    };

    // Listen to window scroll
    window.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [messages]);

  const activeMessage = activeMessageIndex !== null ? messages[activeMessageIndex] : null;

  return (
    <SessionContent
      session={session}
      messages={messages}
      projectPath={projectPath}
      activeMessage={activeMessage}
      messageRefs={messageRefs}
      scrollContainerRef={scrollContainerRef}
      userInfo={userInfo}
    />
  );
}
