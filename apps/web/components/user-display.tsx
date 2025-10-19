'use client';

interface UserDisplayProps {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  xGithubName?: string | null;
  xGithubAvatarUrl?: string | null;
  className?: string;
}

export function UserDisplay({ displayName, email, avatarUrl, xGithubName, xGithubAvatarUrl, className = "" }: UserDisplayProps) {
  // Debug logging
  console.log('UserDisplay props:', { displayName, email, avatarUrl, xGithubName, xGithubAvatarUrl });
  
  const displayText = xGithubName || displayName || email;
  const avatarToUse = xGithubAvatarUrl || avatarUrl;
  const fallbackInitial = (xGithubName || displayName || email).charAt(0);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {avatarToUse ? (
        <img 
          src={avatarToUse} 
          alt={displayText}
          className="w-4 h-4 rounded-full object-cover"
        />
      ) : (
        <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-xs">
          {fallbackInitial.toUpperCase()}
        </div>
      )}
      <span className="text-xs font-bold text-muted-foreground">{displayText}</span>
    </div>
  );
}
