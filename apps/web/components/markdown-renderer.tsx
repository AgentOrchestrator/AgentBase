'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { theme } = useTheme();
  
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert text-muted-foreground', className)}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
                if (!inline && language) {
                  return (
                    <SyntaxHighlighter
                      style={theme === 'dark' ? oneDark : oneLight}
                      language={language}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                }
            
            return (
              <code
                className={cn(
                  'relative rounded px-[0.3rem] py-[0.2rem] text-[0.7rem] font-normal',
                  'font-[ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace]',
                  theme === 'dark' 
                    ? 'bg-border text-muted-foreground' 
                    : 'bg-muted text-muted-foreground',
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children, ...props }) {
            return (
              <pre className="rounded-md p-4 overflow-x-auto" {...props}>
                {children}
              </pre>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="mt-6 border-l-2 pl-6 italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          h1({ children, ...props }) {
            return (
              <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-3xl" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2 className="scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight first:mt-0" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="scroll-m-20 text-lg font-semibold tracking-tight" {...props}>
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4 className="scroll-m-20 text-base font-semibold tracking-tight" {...props}>
                {children}
              </h4>
            );
          },
          p({ children, ...props }) {
            return (
              <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
                {children}
              </p>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li className="mt-2" {...props}>
                {children}
              </li>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="my-6 w-full overflow-y-auto">
                <table className="w-full" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }) {
            return (
              <thead className="[&_tr]:border-b" {...props}>
                {children}
              </thead>
            );
          },
          tbody({ children, ...props }) {
            return (
              <tbody className="[&_tr:last-child]:border-0" {...props}>
                {children}
              </tbody>
            );
          },
          tr({ children, ...props }) {
            return (
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" {...props}>
                {children}
              </tr>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="h-12 px-4 text-left align-middle font-medium text-gray-600 [&:has([role=checkbox])]:pr-0"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0" {...props}>
                {children}
              </td>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          strong({ children, ...props }) {
            return (
              <strong className="font-semibold" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, ...props }) {
            return (
              <em className="italic" {...props}>
                {children}
              </em>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
