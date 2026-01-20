/**
 * Folder Item Component
 *
 * Displays a collapsible project folder with lock icon.
 */

export interface FolderItemProps {
  name: string;
  isCollapsed: boolean;
  isLocked: boolean;
  showLock: boolean;
  /** Highlight color, or null if no highlight (explicit no-color state) */
  highlightColor: string | null;
  folderPath: string | undefined;
  onToggle: () => void;
  onLockToggle: () => void;
}

export function FolderItem({
  name,
  isCollapsed,
  isLocked,
  showLock,
  highlightColor,
  folderPath,
  onToggle,
  onLockToggle,
}: FolderItemProps) {
  return (
    <div className="sidebar-folder-header-wrapper">
      <button className={`sidebar-folder-header ${!showLock ? 'no-lock' : ''}`} onClick={onToggle}>
        <span className={`sidebar-folder-icon ${isCollapsed ? 'collapsed' : 'expanded'}`}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </span>
        {isCollapsed ? (
          <FolderClosedIcon color={highlightColor} />
        ) : (
          <FolderOpenIcon color={highlightColor} />
        )}
        <span className="sidebar-folder-name" style={{ color: highlightColor ?? undefined }}>
          {name}
        </span>
      </button>
      {showLock && folderPath && (
        <button
          type="button"
          className={`sidebar-folder-lock ${isLocked ? 'locked' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLockToggle();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title={isLocked ? 'Unlock folder' : 'Lock folder'}
        >
          {isLocked ? <LockClosedIcon /> : <LockOpenIcon />}
        </button>
      )}
    </div>
  );
}

function FolderClosedIcon({ color }: { color: string | null }) {
  return (
    <svg
      className="sidebar-folder-svg"
      width="14"
      height="14"
      viewBox="0 0 800 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: color ?? undefined }}
    >
      <path
        d="M100 304L100.001 187.5C100.001 170.924 106.586 155.027 118.307 143.306C130.028 131.585 145.925 125 162.501 125H281.079C293.42 125 305.484 128.654 315.751 135.5L359.251 164.5C369.519 171.346 381.583 175 393.923 175H637.501C654.077 175 669.974 181.585 681.695 193.306C693.417 205.027 700.001 220.924 700.001 237.5V304"
        stroke="currentColor"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M727.072 353.984L724.499 612.5C724.499 629.057 717.929 644.938 706.232 656.656C694.535 668.373 678.666 674.971 662.109 675H137.893C121.336 674.971 105.467 668.373 93.7692 656.656C82.0718 644.938 75.5021 629.057 75.5021 612.5L74.0028 353.984C73.4527 347.104 74.3332 340.185 76.5886 333.662C78.844 327.138 82.4255 321.153 87.1077 316.082C91.7898 311.01 97.4712 306.964 103.794 304.196C110.117 301.428 116.944 300 123.847 300L677.385 300C684.274 300.021 691.084 301.466 697.388 304.243C703.692 307.02 709.355 311.07 714.02 316.139C718.686 321.208 722.253 327.186 724.499 333.698C726.745 340.211 727.621 347.117 727.072 353.984Z"
        stroke="currentColor"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderOpenIcon({ color }: { color: string | null }) {
  return (
    <svg
      className="sidebar-folder-svg"
      width="14"
      height="14"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: color ?? undefined }}
    >
      <path
        d="M64,192V120a40,40,0,0,1,40-40h75.89a40,40,0,0,1,22.19,6.72l27.84,18.56A40,40,0,0,0,252.11,112H408a40,40,0,0,1,40,40v40"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <path
        d="M479.9,226.55,463.68,392a40,40,0,0,1-39.93,40H88.25a40,40,0,0,1-39.93-40L32.1,226.55A32,32,0,0,1,64,192h384.1A32,32,0,0,1,479.9,226.55Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
    </svg>
  );
}

function LockClosedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 134 197"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262V100.977C133.301 85.6445 125.684 77.832 111.328 77.832H21.9727C7.61719 77.832 0 85.6445 0 100.977V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336V99.9023C15.8203 95.1172 18.2617 92.5781 22.4609 92.5781H110.84C115.137 92.5781 117.48 95.1172 117.48 99.9023V169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.0898 85.3516H32.6172V52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V85.3516H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.1133 0 17.0898 17.7734 17.0898 54.4922V85.3516Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 134 197"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.9727 191.504H111.328C125.684 191.504 133.301 183.691 133.301 168.262L133.301 131.899C133.301 116.566 125.684 108.754 111.328 108.754H21.9727C7.61719 108.754 0 116.566 0 131.899V168.262C0 183.691 7.61719 191.504 21.9727 191.504ZM22.4609 176.758C18.2617 176.758 15.8203 174.121 15.8203 169.336L15.8203 130.824C15.8203 126.039 18.2617 123.5 22.4609 123.5H110.84C115.137 123.5 117.48 126.039 117.48 130.824L117.48 169.336C117.48 174.121 115.137 176.758 110.84 176.758H22.4609ZM17.1142 52.4792C17.0872 53.5835 17.9852 54.4922 19.0898 54.4922H30.5664C31.699 54.4922 32.6172 53.574 32.6172 52.4414C32.6172 27.7344 48.3398 14.7461 66.6016 14.7461C84.8633 14.7461 100.781 27.7344 100.781 52.4414V114H116.211V54.4922C116.211 17.7734 92.1875 0 66.6016 0C41.5835 0 17.9767 17.1236 17.1142 52.4792Z"
        fill="currentColor"
      />
    </svg>
  );
}
