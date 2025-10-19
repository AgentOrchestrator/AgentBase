# Web Application Conventions

## Color Scheme

### Overview
The web application uses a unified color scheme with consistent gray tones for different UI elements. All colors are based on Tailwind CSS gray scale for consistency.

### Primary Colors
- **Background**: `#f9fafb` (gray-50) - Main canvas and page backgrounds
- **White**: `#FFFFFF` - Card backgrounds, panels, and content areas
- **Black**: `#000000` - Primary text, active states, and emphasis elements

### Text Hierarchy
- **Primary Text**: `text-black` (`#000000`) - Agent names, user names, and important labels
- **Secondary/Tertiary Text**: `text-gray-600` (`#4b5563`) - Summaries, timestamps, metadata, descriptions

### UI Elements
- **Borders, Dividers, Inactive Elements**: `border-gray-300` (`#d1d5db`) - All subtle UI elements
- **Edges**: `#d1d5db` (gray-300) - ReactFlow canvas edges
- **Conversation Box Borders**: `border-gray-300` (`#d1d5db`) - Default conversation node borders
- **User Message Borders**: `border-gray-300` (`#d1d5db`) - Chat message borders
- **Markdown Code Highlighting**: `bg-gray-300` (`#d1d5db`) - Inline code backgrounds
- **Fallback Avatars**: `bg-gray-300` (`#d1d5db`) - Default avatar backgrounds

### Interactive States
- **Hover Backgrounds**: `hover:bg-gray-50` (`#f9fafb`) - Light hover states
- **Active Hover**: `hover:bg-gray-100` (`#f3f4f6`) - Stronger hover states
- **Disabled Elements**: `opacity-50` - Disabled buttons and elements

### Special Elements
- **Live Indicator**: `#3cd158` - Green with animated glow for live sessions
- **Pinned Elements**: `border-black` - Black borders for pinned conversations
- **Linked Users**: `#000000` - Black edges for linked user nodes

### Implementation Guidelines
1. **Consistency**: Always use the same gray-300 (`#d1d5db`) for all subtle UI elements
2. **Hierarchy**: Use black for important text, gray-600 for secondary text
3. **Unified Language**: All borders, edges, and inactive elements share the same color
4. **Accessibility**: Maintain sufficient contrast ratios for readability

### Tailwind Classes Reference
```css
/* Primary Colors */
bg-gray-50     /* #f9fafb - Backgrounds */
bg-white       /* #FFFFFF - Cards, panels */
text-black     /* #000000 - Primary text */

/* Text Hierarchy */
text-gray-600  /* #4b5563 - Secondary/tertiary text */

/* UI Elements */
border-gray-300    /* #d1d5db - All borders, edges, dividers */
bg-gray-300        /* #d1d5db - Fallback avatars, code highlighting */
hover:bg-gray-50   /* #f9fafb - Light hover states */
hover:bg-gray-100  /* #f3f4f6 - Strong hover states */

/* Special States */
border-black       /* #000000 - Pinned elements */
opacity-50         /* Disabled elements */
```

### Files Using These Conventions
- `components/canvas-flow.tsx` - Canvas edges, user nodes, conversation panels
- `components/session-block.tsx` - Conversation boxes, message borders
- `components/agent-display.tsx` - Agent name styling
- `components/user-display.tsx` - User name and avatar styling
- `components/markdown-renderer.tsx` - Code highlighting
- `components/chat-histories-list.tsx` - List item styling
- All future components displaying UI elements

## Timestamp Formatting

### Overview
All timestamps in the web application should use consistent formatting with smart relative time display and live indicators for recent activity.

### Helper Functions
Use these standardized functions for timestamp formatting:

#### `formatLastActive(timestamp: string, currentTime?: Date): string`
Smart relative time formatting with progressive detail:
- **< 1 minute**: "Just now"
- **< 1 hour**: "5 min ago", "30 min ago"
- **< 24 hours**: "2h ago", "12h ago"
- **Yesterday**: "Yesterday at 3:45 PM"
- **< 7 days**: "3 days ago at 2:30 PM"
- **≥ 7 days**: Full date/time format

#### `isLive(timestamp: string, currentTime?: Date): boolean`
Returns `true` if timestamp is within 10 minutes of current time.

#### `getLatestMessageTimestamp(session: ChatHistory): string`
Gets the latest message timestamp, falling back to `updated_at` if not available.

### Live Indicator Component
```tsx
function LiveIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span>Live</span>
      <div 
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ 
          backgroundColor: '#3cd158',
          boxShadow: '0 0 8px rgba(60, 209, 88, 0.6), 0 0 16px rgba(60, 209, 88, 0.4)',
          animation: 'livePulse 4s ease-in-out infinite'
        }}
      />
    </div>
  );
}
```

### Implementation Pattern
```tsx
// Required state for hydration handling
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

// Timestamp display
<div className="text-sm text-muted-foreground font-bold" suppressHydrationWarning>
  {isMounted ? (
    isLive(getLatestMessageTimestamp(session)) ? (
      <LiveIndicator />
    ) : (
      formatLastActive(getLatestMessageTimestamp(session))
    )
  ) : (
    new Date(getLatestMessageTimestamp(session)).toLocaleString()
  )}
</div>
```

### Styling Classes
- **Container**: `text-sm text-muted-foreground font-bold`
- **Hydration**: Always include `suppressHydrationWarning` attribute
- **Layout**: Use `flex justify-between items-center` for title + timestamp layouts

### Usage Examples
- **Chat Histories List**: Top-right of conversation cards
- **User Conversations Panel**: Top-right of conversation items
- **Session Blocks**: Activity indicators and timestamps
- **Canvas Flow**: Any conversation-related timestamp display

### Key Principles
1. **Consistency**: Always use the same helper functions across components
2. **Hydration Safety**: Use `isMounted` state and `suppressHydrationWarning`
3. **Live Indicators**: Show "Live" for sessions within 10 minutes
4. **Progressive Detail**: More detail for older timestamps
5. **Accessibility**: Clear, readable time formats

### Files Using These Conventions
- `components/chat-histories-list.tsx`
- `components/canvas-flow.tsx`
- `components/session-block.tsx`
- Any future components displaying timestamps
